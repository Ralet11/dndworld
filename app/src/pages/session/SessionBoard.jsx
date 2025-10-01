import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api/client'
import SessionDM from './SessionDM.jsx'
import SessionPlayer from './SessionPlayer.jsx'

export default function SessionBoard(){
  const { id } = useParams()
  const [ctx, setCtx] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try {
        const { data } = await api.get(`/sessions/${id}/me`)
        if (mounted) setCtx(data)
      } catch {
        if (mounted) setCtx(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return ()=>{ mounted = false }
  },[id])

  if (loading) return <div>Cargando sesión…</div>
  if (!ctx) return <div className="text-red-300">No podés acceder a esta sesión.</div>

  return ctx.roleInSession === 'DM'
    ? <SessionDM sessionId={id} ctx={ctx} />
    : <SessionPlayer sessionId={id} ctx={ctx} />
}
