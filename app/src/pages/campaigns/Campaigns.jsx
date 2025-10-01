import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/client'

export default function Campaigns(){
  const [list, setList] = useState([])
  useEffect(()=>{ api.get('/campaigns').then(r=>setList(r.data)) },[])
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Campañas</h2>
        <Link to="/campanias/crear" className="btn">Nueva campaña</Link>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map(c=>(
          <Link key={c.id} to={`/campanias/${c.id}`} className="card block">
            <div className="font-semibold">{c.name}</div>
            <div className="opacity-70 text-sm">{c.status}</div>
          </Link>
        ))}
        {list.length===0 && <div className="opacity-70">No estás en campañas aún.</div>}
      </div>
    </div>
  )
}
