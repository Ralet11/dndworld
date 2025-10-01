import { useEffect, useState } from 'react'
import api from '../../api/client'

export default function Quests(){
  const [list, setList] = useState([])
  const [form, setForm] = useState({ name:'', description:'' })
  const [steps, setSteps] = useState([])
  const [rewards, setRewards] = useState([])
  const [selected, setSelected] = useState(null)

  const load = ()=> api.get('/quests').then(r=>setList(r.data))
  useEffect(()=>{ load() },[])
  const create = async()=>{ await api.post('/quests', form); setForm({ name:'', description:'' }); load() }
  const open = async(id)=>{
    const q = await api.get(`/quests/${id}`)
    setSelected(q.data)
    setSteps(q.data.QuestSteps || [])
    setRewards(q.data.QuestRewards || [])
  }
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Quests</h2>
      <div className="card grid md:grid-cols-3 gap-2">
        <input placeholder="Nombre" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
        <input placeholder="Descripción" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
        <button className="btn" onClick={create} disabled={!form.name}>Crear</button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {list.map(q=>(
          <div key={q.id} className="card">
            <div className="font-semibold">{q.name}</div>
            <div className="text-sm opacity-70">{q.description}</div>
            <button className="btn mt-2" onClick={()=>open(q.id)}>Abrir</button>
          </div>
        ))}
        {list.length===0 && <div className="opacity-70">No hay quests.</div>}
      </div>
      {selected && (
        <div className="grid md:grid-cols-2 gap-3">
          <div className="card">
            <div className="font-semibold mb-2">Pasos</div>
            <div className="space-y-2">
              {steps.map(s=>(<div key={s.id} className="text-sm">#{s.stepOrder} {s.text}</div>))}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <input id="stepOrder" type="number" placeholder="Orden" />
              <input id="stepText" placeholder="Descripción" />
              <button className="btn" onClick={async()=>{
                const order = Number(document.getElementById('stepOrder').value)||1
                const text = document.getElementById('stepText').value
                await api.post(`/quests/${selected.id}/steps`, { stepOrder: order, text })
                open(selected.id)
              }}>Añadir</button>
            </div>
          </div>
          <div className="card">
            <div className="font-semibold mb-2">Recompensas</div>
            <div className="space-y-2">{rewards.map(r=>(<div key={r.id} className="text-sm">{r.rewardType}</div>))}</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <select id="rewardType"><option value="GOLD">Oro</option><option value="ITEM">Ítem</option><option value="CARD">Carta</option></select>
              <input id="rewardPayload" placeholder="Payload JSON" />
              <button className="btn" onClick={async()=>{
                let payload={}; try{ payload = JSON.parse(document.getElementById('rewardPayload').value || "{}") }catch{ alert("JSON inválido"); return }
                await api.post(`/quests/${selected.id}/rewards`, { rewardType: document.getElementById('rewardType').value, payload })
                open(selected.id)
              }}>Añadir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
