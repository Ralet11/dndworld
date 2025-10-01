import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api/client'

export default function Inventory(){
  const { id } = useParams()
  const [items, setItems] = useState([])
  const [all, setAll] = useState([])
  const [sel, setSel] = useState('')
  const [qty, setQty] = useState(1)

  const load = async()=>{
    const inv = await api.get(`/characters/${id}/inventory`); setItems(inv.data)
    const ai = await api.get('/items'); setAll(ai.data)
  }
  useEffect(()=>{ load() },[id])

  const add = async()=>{
    await api.post(`/characters/${id}/inventory`, { itemId: sel, qty: Number(qty)||1 })
    load()
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Inventario</h2>
      <div className="card space-y-2">
        <div className="font-semibold">Agregar</div>
        <div className="grid grid-cols-3 gap-2">
          <select value={sel} onChange={e=>setSel(e.target.value)}><option value="">Ítem…</option>{all.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select>
          <input type="number" value={qty} onChange={e=>setQty(e.target.value)} />
          <button className="btn" onClick={add} disabled={!sel}>Añadir</button>
        </div>
      </div>
      <div className="card">
        <div className="font-semibold mb-2">Tus ítems</div>
        <div className="grid md:grid-cols-3 gap-3">
          {items.map(it=>(
            <div key={it.id} className="border border-slate-700 rounded p-3">
              <div className="font-semibold">{it.Item?.name}</div>
              <div className="text-sm opacity-70">x{it.qty}</div>
            </div>
          ))}
          {items.length===0 && <div className="opacity-70">Vacío</div>}
        </div>
      </div>
    </div>
  )
}
