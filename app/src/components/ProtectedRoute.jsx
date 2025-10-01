import useAuth from '../store/useAuth'
import { Navigate } from 'react-router-dom'
export function ProtectedRoute({ children }){
  const { isAuthed } = useAuth()
  if (!isAuthed) return <Navigate to="/" replace />
  return children
}
