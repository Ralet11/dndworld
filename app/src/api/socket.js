import { io } from 'socket.io-client'
let socket = null
export function getSocket(){
  if (socket) return socket
  try {
    socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3001', {
      autoConnect: true,
      auth: { token: localStorage.getItem('token') || '' }
    })
    return socket
  } catch (e) { console.warn('Socket disabled', e); return null }
}
