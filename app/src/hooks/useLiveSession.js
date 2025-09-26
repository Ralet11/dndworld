import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSocket } from './useSocket'

const createInitialSessionState = () => ({
  status: 'idle',
  startedAt: null,
  startsAt: null,
  countdownSeconds: null,
  startedBy: null,
})

const createInitialPresenceState = () => ({
  members: [],
  counts: { players: 0, dms: 0, total: 0 },
})

const normalizeSessionState = (raw) => ({
  status: raw?.status ?? 'idle',
  startedAt: raw?.startedAt ?? null,
  startsAt: raw?.startsAt ?? null,
  countdownSeconds: raw?.countdownSeconds ?? null,
  startedBy: raw?.startedBy ?? null,
})

const normalizePresenceState = (raw) => {
  const members = Array.isArray(raw?.members) ? raw.members : []
  const counts = raw?.counts ?? {}
  const coerce = (value, fallback = 0) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  return {
    members,
    counts: {
      players: coerce(counts.players),
      dms: coerce(counts.dms),
      total: coerce(counts.total, members.length),
    },
  }
}

export const useLiveSession = (campaignId) => {
  const socket = useSocket()
  const isMountedRef = useRef(false)

  const [session, setSession] = useState(() => createInitialSessionState())
  const [presence, setPresence] = useState(() => createInitialPresenceState())
  const [announcement, setAnnouncement] = useState(null)
  const [lastError, setLastError] = useState(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [hasSynced, setHasSynced] = useState(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    setSession(createInitialSessionState())
    setPresence(createInitialPresenceState())
    setAnnouncement(null)
    setLastError(null)
    setHasSynced(false)
  }, [campaignId])

  const refreshStatus = useCallback(() => {
    if (!socket || !campaignId) return Promise.resolve(null)

    return new Promise((resolve) => {
      socket.emit('session:status', { campaignId }, (ack) => {
        if (!isMountedRef.current) {
          resolve(null)
          return
        }

        if (ack?.status === 'ok') {
          if (ack.session) setSession(normalizeSessionState(ack.session))
          if (ack.presence) setPresence(normalizePresenceState(ack.presence))
          setHasSynced(true)
        } else if (ack?.message) {
          setLastError(ack.message)
        }

        resolve(ack ?? null)
      })
    })
  }, [socket, campaignId])

  useEffect(() => {
    if (!socket || !campaignId) return undefined

    const handlePresenceUpdate = (payload) => {
      if (payload?.campaignId !== campaignId || !isMountedRef.current) return
      setPresence(normalizePresenceState(payload))
    }

    const handleSessionState = (payload) => {
      if (payload?.campaignId !== campaignId || !isMountedRef.current) return
      setSession(normalizeSessionState(payload))
      setHasSynced(true)
    }

    const handleSessionStarting = (payload) => {
      if (payload?.campaignId !== campaignId || !isMountedRef.current) return
      setAnnouncement({ type: 'starting', receivedAt: new Date().toISOString(), payload })
    }

    const handleSessionStarted = (payload) => {
      if (payload?.campaignId !== campaignId || !isMountedRef.current) return
      setAnnouncement({ type: 'started', receivedAt: new Date().toISOString(), payload })
    }

    const handleSessionEnded = (payload) => {
      if (payload?.campaignId !== campaignId || !isMountedRef.current) return
      setAnnouncement({ type: 'ended', receivedAt: new Date().toISOString(), payload })
    }

    socket.on('presence:update', handlePresenceUpdate)
    socket.on('session:state', handleSessionState)
    socket.on('session:starting', handleSessionStarting)
    socket.on('session:started', handleSessionStarted)
    socket.on('session:ended', handleSessionEnded)

    refreshStatus()

    return () => {
      socket.off('presence:update', handlePresenceUpdate)
      socket.off('session:state', handleSessionState)
      socket.off('session:starting', handleSessionStarting)
      socket.off('session:started', handleSessionStarted)
      socket.off('session:ended', handleSessionEnded)
    }
  }, [socket, campaignId, refreshStatus])

  const startSession = useCallback(
    ({ countdownSeconds } = {}) =>
      new Promise((resolve, reject) => {
        if (!socket || !campaignId) {
          const error = new Error('Socket connection unavailable')
          setLastError(error.message)
          reject(error)
          return
        }

        setIsStarting(true)
        setLastError(null)

        socket.emit(
          'session:start',
          { campaignId, countdownSeconds },
          (ack) => {
            if (!isMountedRef.current) {
              resolve(null)
              return
            }

            setIsStarting(false)

            if (ack?.status === 'ok') {
              if (ack.session) setSession(normalizeSessionState(ack.session))
              if (ack.presence) setPresence(normalizePresenceState(ack.presence))
              resolve(ack)
            } else {
              const message = ack?.message ?? 'Unable to start session'
              setLastError(message)
              reject(new Error(message))
            }
          },
        )
      }),
    [socket, campaignId],
  )

  const endSession = useCallback(
    () =>
      new Promise((resolve, reject) => {
        if (!socket || !campaignId) {
          const error = new Error('Socket connection unavailable')
          setLastError(error.message)
          reject(error)
          return
        }

        setIsEnding(true)
        setLastError(null)

        socket.emit('session:end', { campaignId }, (ack) => {
          if (!isMountedRef.current) {
            resolve(null)
            return
          }

          setIsEnding(false)

          if (ack?.status === 'ok') {
            if (ack.session) setSession(normalizeSessionState(ack.session))
            resolve(ack)
          } else {
            const message = ack?.message ?? 'Unable to end session'
            setLastError(message)
            reject(new Error(message))
          }
        })
      }),
    [socket, campaignId],
  )

  const clearAnnouncement = useCallback(() => setAnnouncement(null), [])
  const clearError = useCallback(() => setLastError(null), [])

  const derived = useMemo(
    () => ({
      status: session.status,
      isIdle: session.status === 'idle',
      isCountdown: session.status === 'countdown',
      isActive: session.status === 'active',
      playersConnected: presence.counts.players,
      dmsConnected: presence.counts.dms,
      totalConnected: presence.counts.total,
      countdownTarget: session.startsAt ? new Date(session.startsAt) : null,
    }),
    [session.status, session.startsAt, presence.counts.players, presence.counts.dms, presence.counts.total],
  )

  return {
    session,
    presence,
    ...derived,
    startSession,
    endSession,
    refreshStatus,
    isStarting,
    isEnding,
    hasSynced,
    announcement,
    clearAnnouncement,
    lastError,
    clearError,
  }
}
