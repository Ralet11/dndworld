import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../api/client'

export default function Scenarios(){
  const { id: campaignId } = useParams()
  const [list, setList] = useState([])
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const load = ()=> api.get(`/scenarios/by-campaign/${campaignId}`).then(r=>setList(r.data))
  useEffect(()=>{ load() },[campaignId])
  const create = async ()=>{ await api.post(`/scenarios/${campaignId}`, { name, shortDescription: desc }); setName(''); setDesc(''); load() }
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Escenarios</h2>
      <div className="card space-y-2">
        <input placeholder="Nombre" value={name} onChange={e=>setName(e.target.value)} />
        <input placeholder="Descripción corta" value={desc} onChange={e=>setDesc(e.target.value)} />
        <button className="btn" onClick={create} disabled={!name}>Crear</button>
      </div>
      <div className="grid gap-3">
        {list.map(s=>(
          <Link key={s.id} to={`/dm/escenarios/${s.id}`} className="card block">
            <div className="font-semibold">{s.name}</div>
            <div className="opacity-70 text-sm">{s.shortDescription}</div>
          </Link>
        ))}
        {list.length===0 && <div className="opacity-70">No hay escenarios aún.</div>}
      </div>
    </div>
  )
}
