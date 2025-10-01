import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'

export default function CampaignCreate(){
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const nav = useNavigate()
  const submit = async (e)=>{
    e.preventDefault()
    const { data } = await api.post('/campaigns', { name, description: desc })
    nav(`/campanias/${data.id}`)
  }
  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold mb-2">Nueva campaña</h2>
      <form onSubmit={submit} className="space-y-3 card">
        <input placeholder="Nombre" value={name} onChange={e=>setName(e.target.value)} required />
        <textarea rows="3" placeholder="Descripción" value={desc} onChange={e=>setDesc(e.target.value)} />
        <button className="btn">Crear</button>
      </form>
    </div>
  )
}
