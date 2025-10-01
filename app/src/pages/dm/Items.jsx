import { useEffect, useState } from 'react'
import api from '../../api/client'

export default function Items(){
  const [list, setList] = useState([])
  const [form, setForm] = useState({ name:'', description:'' })
  const load = ()=> api.get('/items').then(r=>setList(r.data))
  useEffect(()=>{ load() },[])
  const create = async()=>{ await api.post('/items', form); setForm({ name:'', description:'' }); load() }
  const del = async(id)=>{ await api.delete(`/items/${id}`); load() }
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Ítems</h2>
      <div className="card grid md:grid-cols-3 gap-2">
        <input placeholder="Nombre" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
        <input placeholder="Descripción" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
        <button className="btn" onClick={create} disabled={!form.name}>Crear</button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {list.map(i=>(
          <div key={i.id} className="card">
            <div className="font-semibold">{i.name}</div>
            <div className="text-sm opacity-70">{i.description}</div>
            <button className="btn mt-2" onClick={()=>del(i.id)}>Eliminar</button>
          </div>
        ))}
        {list.length===0 && <div className="opacity-70">No hay ítems.</div>}
      </div>
    </div>
  )
}
