import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { Campaign } from '../models/Campaign.js'
import { CampaignMembership } from '../models/CampaignMembership.js'
import { User } from '../models/User.js'

const getTokenFromHandshake = (socket) => {
  const authHeader = socket.handshake.headers.authorization
  if (authHeader) {
    const [scheme, value] = authHeader.split(' ')
    if (scheme?.toLowerCase() === 'bearer' && value) {
      return value
    }
  }

  const authToken = socket.handshake.auth?.token
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim()
  }

  return null
}

const verifyMembership = async (campaignId, userId) => {
  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    return { authorized: false, reason: 'Campaign not found' }
  }

  if (campaign.dmId === userId) {
    return { authorized: true, role: 'dm', campaign }
  }

  if (!userId) {
    return { authorized: false, reason: 'Authentication required' }
  }

  const membership = await CampaignMembership.findOne({
    where: { campaignId, userId },
  })

  if (!membership || membership.status !== 'accepted') {
    return { authorized: false, reason: 'Not a campaign member' }
  }

  return { authorized: true, role: membership.roleInCampaign, campaign }
}

const rooms = {
  campaign: (campaignId) => `campaign:${campaignId}`,
  board: (boardId) => `board:${boardId}`,
}

const presenceByCampaign = new Map()
const sessionStateByCampaign = new Map()
const countdownTimers = new Map()

const MIN_COUNTDOWN_SECONDS = 3
const MAX_COUNTDOWN_SECONDS = 30
const DEFAULT_COUNTDOWN_SECONDS = 5

const defaultSessionState = () => ({
  status: 'idle',
  startedAt: null,
  startsAt: null,
  startedBy: null,
  countdownSeconds: null,
})

const getSessionState = (campaignId) => {
  const stored = sessionStateByCampaign.get(campaignId)
  const base = stored ? { ...stored } : defaultSessionState()
  return { campaignId, ...base }
}

const updateSessionState = (campaignId, patch = {}) => {
  const next = { ...defaultSessionState(), ...patch }
  sessionStateByCampaign.set(campaignId, next)
  return { campaignId, ...next }
}

const resetSessionState = (campaignId) => {
  sessionStateByCampaign.delete(campaignId)
  return getSessionState(campaignId)
}

const stopCountdown = (campaignId) => {
  const timer = countdownTimers.get(campaignId)
  if (timer) {
    clearTimeout(timer)
    countdownTimers.delete(campaignId)
  }
}

const ensurePresenceEntry = (campaignId) => {
  if (!presenceByCampaign.has(campaignId)) {
    presenceByCampaign.set(campaignId, { members: new Map() })
  }
  return presenceByCampaign.get(campaignId)
}

const toPresencePayload = (campaignId) => {
  const entry = presenceByCampaign.get(campaignId)
  const members = entry ? Array.from(entry.members.values()) : []
  const counts = members.reduce(
    (acc, member) => {
      if (member.role === 'player') acc.players += 1
      if (member.role === 'dm') acc.dms += 1
      acc.total += 1
      return acc
    },
    { players: 0, dms: 0, total: 0 },
  )

  return { campaignId, members, counts }
}

const broadcastPresence = (io, campaignId) => {
  const payload = toPresencePayload(campaignId)
  io.to(rooms.campaign(campaignId)).emit('presence:update', payload)
}

const broadcastSessionState = (io, campaignId) => {
  const payload = getSessionState(campaignId)
  io.to(rooms.campaign(campaignId)).emit('session:state', payload)
}

const sanitizeUser = (user) => ({
  id: user.id,
  displayName: user.displayName,
  username: user.username,
  role: user.role,
})

const clampCountdownSeconds = (value) => {
  const numeric = Number.isInteger(value) ? value : Number.parseInt(value, 10)
  if (!Number.isFinite(numeric)) return DEFAULT_COUNTDOWN_SECONDS
  return Math.min(Math.max(numeric, MIN_COUNTDOWN_SECONDS), MAX_COUNTDOWN_SECONDS)
}

const removeSocketFromCampaign = (io, socket, campaignId) => {
  const entry = presenceByCampaign.get(campaignId)
  if (!entry) return

  const removed = entry.members.delete(socket.id)
  socket.data.campaigns?.delete(campaignId)

  if (!removed) return

  if (entry.members.size === 0) {
    presenceByCampaign.delete(campaignId)
    stopCountdown(campaignId)
    resetSessionState(campaignId)
    broadcastSessionState(io, campaignId)
  }

  broadcastPresence(io, campaignId)
}

export const registerSocketHandlers = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = getTokenFromHandshake(socket)
      if (!token) {
        return next(new Error('Missing token'))
      }

      const payload = jwt.verify(token, env.jwtSecret)
      const user = await User.findByPk(payload.sub)

      if (!user) {
        return next(new Error('User not found'))
      }

      socket.data.user = {
        id: user.id,
        role: user.role,
        displayName: user.displayName,
        username: user.username,
      }

      return next()
    } catch (error) {
      return next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    const { user } = socket.data
    console.info(`Socket connected: ${socket.id} user=${user.id}`)

    socket.data.campaigns = socket.data.campaigns ?? new Set()

    socket.on('disconnect', (reason) => {
      const joinedCampaigns = Array.from(socket.data.campaigns ?? [])
      joinedCampaigns.forEach((campaignId) => {
        removeSocketFromCampaign(io, socket, campaignId)
      })
      console.info(`Socket disconnected: ${socket.id} reason=${reason}`)
    })

    socket.on('join:campaign', async ({ campaignId }, callback) => {
      if (!campaignId) {
        callback?.({ status: 'error', message: 'campaignId is required' })
        return
      }

      const membership = await verifyMembership(campaignId, user.id)
      if (!membership.authorized) {
        callback?.({ status: 'error', message: membership.reason })
        return
      }

      const room = rooms.campaign(campaignId)
      await socket.join(room)

      const presenceEntry = ensurePresenceEntry(campaignId)
      presenceEntry.members.set(socket.id, {
        socketId: socket.id,
        userId: user.id,
        role: membership.role,
        displayName: user.displayName,
        username: user.username,
        joinedAt: new Date().toISOString(),
      })
      socket.data.campaigns.add(campaignId)

      broadcastPresence(io, campaignId)
      broadcastSessionState(io, campaignId)

      callback?.({
        status: 'ok',
        room,
        role: membership.role,
        presence: toPresencePayload(campaignId),
        session: getSessionState(campaignId),
      })
    })

    socket.on('leave:campaign', ({ campaignId }, callback) => {
      if (!campaignId) {
        callback?.({ status: 'error', message: 'campaignId is required' })
        return
      }

      const room = rooms.campaign(campaignId)
      socket.leave(room).catch(() => {})

      removeSocketFromCampaign(io, socket, campaignId)
      callback?.({ status: 'ok' })
    })

    socket.on('session:status', ({ campaignId }, callback) => {
      if (!campaignId) {
        callback?.({ status: 'error', message: 'campaignId is required' })
        return
      }

      callback?.({
        status: 'ok',
        session: getSessionState(campaignId),
        presence: toPresencePayload(campaignId),
      })
    })

    socket.on('session:start', async ({ campaignId, countdownSeconds }, callback) => {
      if (!campaignId) {
        callback?.({ status: 'error', message: 'campaignId is required' })
        return
      }

      const membership = await verifyMembership(campaignId, user.id)
      if (!membership.authorized) {
        callback?.({ status: 'error', message: membership.reason })
        return
      }

      if (membership.role !== 'dm') {
        callback?.({ status: 'error', message: 'Only the DM can start the session' })
        return
      }

      const current = getSessionState(campaignId)
      if (current.status === 'countdown') {
        callback?.({ status: 'error', message: 'Session is already counting down' })
        return
      }

      if (current.status === 'active') {
        callback?.({ status: 'error', message: 'Session is already active' })
        return
      }

      const presence = toPresencePayload(campaignId)
      if (presence.counts.players === 0) {
        callback?.({ status: 'error', message: 'At least one player must be connected' })
        return
      }

      const seconds = clampCountdownSeconds(countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS)
      stopCountdown(campaignId)

      const startsAt = new Date(Date.now() + seconds * 1000)
      const startedBy = sanitizeUser(user)

      const countdownState = updateSessionState(campaignId, {
        status: 'countdown',
        startsAt: startsAt.toISOString(),
        startedAt: null,
        startedBy,
        countdownSeconds: seconds,
      })

      broadcastSessionState(io, campaignId)

      const room = rooms.campaign(campaignId)
      io.to(room).emit('session:starting', {
        campaignId,
        startsAt: countdownState.startsAt,
        countdownSeconds: countdownState.countdownSeconds,
        startedBy: countdownState.startedBy,
      })

      const timer = setTimeout(() => {
        const activeState = updateSessionState(campaignId, {
          status: 'active',
          startedAt: new Date().toISOString(),
          startsAt: null,
          startedBy,
          countdownSeconds: null,
        })
        broadcastSessionState(io, campaignId)
        io.to(room).emit('session:started', {
          campaignId,
          startedAt: activeState.startedAt,
          startedBy: activeState.startedBy,
        })
        countdownTimers.delete(campaignId)
      }, seconds * 1000)

      countdownTimers.set(campaignId, timer)

      callback?.({
        status: 'ok',
        session: countdownState,
        presence,
      })
    })

    socket.on('session:end', async ({ campaignId }, callback) => {
      if (!campaignId) {
        callback?.({ status: 'error', message: 'campaignId is required' })
        return
      }

      const membership = await verifyMembership(campaignId, user.id)
      if (!membership.authorized) {
        callback?.({ status: 'error', message: membership.reason })
        return
      }

      if (membership.role !== 'dm') {
        callback?.({ status: 'error', message: 'Only the DM can end the session' })
        return
      }

      const current = getSessionState(campaignId)
      if (current.status === 'idle') {
        callback?.({ status: 'ok', session: current })
        return
      }

      stopCountdown(campaignId)
      const endedAt = new Date().toISOString()
      const endedState = resetSessionState(campaignId)
      broadcastSessionState(io, campaignId)

      const room = rooms.campaign(campaignId)
      io.to(room).emit('session:ended', {
        campaignId,
        endedAt,
        endedBy: sanitizeUser(user),
      })

      callback?.({
        status: 'ok',
        session: endedState,
      })
    })

    socket.on('join:board', async ({ campaignId, boardId }, callback) => {
      if (!boardId) {
        callback?.({ status: 'error', message: 'boardId is required' })
        return
      }

      const membership = await verifyMembership(campaignId, user.id)
      if (!membership.authorized) {
        callback?.({ status: 'error', message: membership.reason })
        return
      }

      const room = rooms.board(boardId)
      await socket.join(room)
      callback?.({ status: 'ok', room, role: membership.role })
    })

    socket.on('chat:send', ({ campaignId, message }, callback) => {
      if (!message?.trim()) {
        callback?.({ status: 'error', message: 'Message cannot be empty' })
        return
      }

      const room = rooms.campaign(campaignId)
      io.to(room).emit('chat:message', {
        message,
        campaignId,
        user: socket.data.user,
        timestamp: new Date().toISOString(),
      })

      callback?.({ status: 'ok' })
    })

    socket.on('token:create', ({ boardId, token }, callback) => {
      if (!boardId || !token) {
        callback?.({ status: 'error', message: 'boardId and token required' })
        return
      }

      const room = rooms.board(boardId)
      io.to(room).emit('token:created', {
        token,
        user: socket.data.user,
      })
      callback?.({ status: 'ok' })
    })

    socket.on('token:update', ({ boardId, token }, callback) => {
      if (!boardId || !token) {
        callback?.({ status: 'error', message: 'boardId and token required' })
        return
      }

      const room = rooms.board(boardId)
      io.to(room).emit('token:updated', {
        token,
        user: socket.data.user,
      })
      callback?.({ status: 'ok' })
    })

    socket.on('token:delete', ({ boardId, tokenId }, callback) => {
      if (!boardId || !tokenId) {
        callback?.({ status: 'error', message: 'boardId and tokenId required' })
        return
      }

      const room = rooms.board(boardId)
      io.to(room).emit('token:deleted', {
        tokenId,
        user: socket.data.user,
      })
      callback?.({ status: 'ok' })
    })

    socket.on('board:image:set', async ({ campaignId, boardId, scenarioId, imageIndex }, callback) => {
      if (!campaignId || !boardId || !scenarioId || !Number.isInteger(imageIndex) || imageIndex < 0) {
        callback?.({ status: 'error', message: 'campaignId, boardId, scenarioId and imageIndex required' })
        return
      }

      const membership = await verifyMembership(campaignId, user.id)
      if (!membership.authorized) {
        callback?.({ status: 'error', message: membership.reason })
        return
      }

      const room = rooms.board(boardId)
      io.to(room).emit('board:image:changed', {
        campaignId,
        boardId,
        scenarioId,
        imageIndex,
        user: socket.data.user,
      })

      callback?.({ status: 'ok' })
    })

    socket.on('npc:highlight', async ({ campaignId, boardId, npcId }, callback) => {
      if (!campaignId || !boardId || !npcId) {
        callback?.({ status: 'error', message: 'campaignId, boardId and npcId required' })
        return
      }

      const membership = await verifyMembership(campaignId, user.id)
      if (!membership.authorized) {
        callback?.({ status: 'error', message: membership.reason })
        return
      }

      const room = rooms.board(boardId)
      io.to(room).emit('npc:highlighted', {
        campaignId,
        boardId,
        npcId,
        user: socket.data.user,
        timestamp: new Date().toISOString(),
      })

      callback?.({ status: 'ok' })
    })

    socket.on('scenario:set', ({ campaignId, scenarioId }, callback) => {
      if (!campaignId || !scenarioId) {
        callback?.({ status: 'error', message: 'campaignId and scenarioId required' })
        return
      }

      const room = rooms.campaign(campaignId)
      io.to(room).emit('scenario:changed', {
        scenarioId,
        user: socket.data.user,
      })
      callback?.({ status: 'ok' })
    })
  })
}
