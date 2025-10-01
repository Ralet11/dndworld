import { useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api/client'

export default function CampaignMembers(){
  const { id } = useParams()
  const [email, setEmail] = useState('')
  const [invites, setInvites] = useState([])

  const invite = async ()=>{
    const res = await api.post(`/campaigns/${id}/invites`, { email })
    setInvites(v=>[res.data, ...v]); setEmail('')
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Invitaciones</h2>
      <div className="card flex gap-2">
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <button className="btn" onClick={invite} disabled={!email}>Invitar</button>
      </div>
      <div className="card">
        <div className="font-semibold mb-2">Historial</div>
        {invites.length===0 && <div className="opacity-70">Sin invitaciones aún</div>}
        <ul className="list-disc ml-5">
          {invites.map(i=>(<li key={i.id}>{i.email} · token: {i.token}</li>))}
        </ul>
      </div>
    </div>
  )
}
