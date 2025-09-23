import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { useSessionStore } from '../store/useSessionStore'

const resolveSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'
  if (apiBase.endsWith('/api')) {
    return apiBase.slice(0, -4)
  }
  return apiBase
}

const SOCKET_URL = resolveSocketUrl()

export const useSocket = () => {
  const token = useSessionStore((state) => state.session.token)
  const socketRef = useRef(null)

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      return
    }

    if (!socketRef.current) {
      socketRef.current = io(SOCKET_URL, {
        autoConnect: false,
        transports: ['websocket'],
      })
    }

    const socket = socketRef.current
    socket.auth = { token }

    if (!socket.connected) {
      socket.connect()
    }

    return () => {
      socket.off()
    }
  }, [token])

  useEffect(() => () => {
    socketRef.current?.disconnect()
    socketRef.current = null
  }, [])

  return socketRef.current
}
