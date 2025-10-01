import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/client'

export default function OfferPicker(){
  const { id } = useParams()
  const [offer, setOffer] = useState(null)
  const [selected, setSelected] = useState(null)
  const nav = useNavigate()

  useEffect(()=>{ api.post(`/characters/${id}/choices`).then(r=>setOffer(r.data)) },[id])
  const confirm = async ()=>{
    if (!selected) return
    await api.post(`/characters/${id}/choices/${offer.offerId}/select`, { abilityId: selected })
    nav(`/personajes/${id}`)
  }
  if (!offer) return <div>Cargando oferta…</div>
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Elegí tu primera carta</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {offer.options.map(opt=>(
          <label key={opt.id} className={"card cursor-pointer " + (selected===opt.id?'ring-2 ring-brand-500':'')}>
            <input type="radio" name="ability" className="hidden" onChange={()=>setSelected(opt.id)} />
            <div className="font-semibold">{opt.name}</div>
            <p className="text-sm opacity-80">{opt.description}</p>
            <div className="text-xs opacity-70 mt-2">Velocidad: {opt.speed}</div>
          </label>
        ))}
      </div>
      <button className="btn" disabled={!selected} onClick={confirm}>Confirmar</button>
    </div>
  )
}
