import { useEffect, useState } from 'react'
import api from '../../api/client'
import { useNavigate } from 'react-router-dom'

export default function CreateCharacter(){
  const [races, setRaces] = useState([])
  const [classes, setClasses] = useState([])
  const [form, setForm] = useState({ name:'', raceId:'', classId:'', alignment:'TRUE_NEUTRAL', background:'', fears:'', goalsShort:'', goalsLong:'' })
  const nav = useNavigate()
  useEffect(()=>{ api.get('/catalog/races').then(r=>setRaces(r.data)); api.get('/catalog/classes').then(r=>setClasses(r.data)) },[])
  const submit = async (e)=>{
    e.preventDefault()
    const { data } = await api.post('/characters', form)
    await api.post(`/characters/${data.characterId}/choices`)
    nav(`/personajes/${data.characterId}/oferta`)
  }
  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-3">Crear personaje</h2>
      <form onSubmit={submit} className="space-y-3">
        <div><label>Nombre</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label>Raza</label><select value={form.raceId} onChange={e=>setForm(f=>({...f,raceId:e.target.value}))} required><option value="">Elegí…</option>{races.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
          <div><label>Clase</label><select value={form.classId} onChange={e=>setForm(f=>({...f,classId:e.target.value}))} required><option value="">Elegí…</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        </div>
        <div><label>Alineación</label><select value={form.alignment} onChange={e=>setForm(f=>({...f,alignment:e.target.value}))}>
          {["LAWFUL_GOOD","NEUTRAL_GOOD","CHAOTIC_GOOD","LAWFUL_NEUTRAL","TRUE_NEUTRAL","CHAOTIC_NEUTRAL","LAWFUL_EVIL","NEUTRAL_EVIL","CHAOTIC_EVIL"].map(a=><option key={a} value={a}>{a}</option>)}
        </select></div>
        <div><label>Background</label><textarea rows="3" value={form.background} onChange={e=>setForm(f=>({...f,background:e.target.value}))}></textarea></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label>Miedos</label><textarea rows="3" value={form.fears} onChange={e=>setForm(f=>({...f,fears:e.target.value}))}></textarea></div>
          <div><label>Objetivos</label><textarea rows="3" value={(form.goalsShort?form.goalsShort+'\n':'') + (form.goalsLong||'')} onChange={e=>{
            const [short, ...rest] = e.target.value.split('\n'); setForm(f=>({...f,goalsShort: short || '', goalsLong: rest.join('\n')}))
          }}></textarea></div>
        </div>
        <button className="btn">Crear</button>
      </form>
    </div>
  )
}
