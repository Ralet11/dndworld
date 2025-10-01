import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api/client'

export default function TalentTree(){
  const { id } = useParams()
  const [talents, setTalents] = useState([])
  const [owned, setOwned] = useState([])

  useEffect(()=>{
    async function load(){
      const ch = await api.get(`/characters/${id}`)
      const classId = ch.data.Creature?.classId
      if (classId) {
        const list = await api.get(`/catalog/classes/${classId}/talents`)
        setTalents(list.data)
      }
      const ct = await api.get(`/characters/${id}/talents`)
      setOwned(ct.data)
    }
    load()
  },[id])

  const ownedIds = useMemo(()=> new Set(owned.map(o=>o.talentId)), [owned])

  const assign = async (talentId)=>{
    await api.post(`/characters/${id}/talents/assign`, { talentId, points:1 })
    const ct = await api.get(`/characters/${id}/talents`); setOwned(ct.data)
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Árbol de talentos</h2>
      <div className="grid md:grid-cols-3 gap-3">
        {talents.map(t=>(
          <div key={t.id} className={"card " + (ownedIds.has(t.id) ? "ring-2 ring-emerald-400" : "")}>
            <div className="font-semibold">{t.name}</div>
            <div className="text-sm opacity-80">{t.description}</div>
            <div className="text-xs opacity-70 mt-1">Tier {t.tier} · Max {t.maxPoints}</div>
            <button className="btn mt-2" onClick={()=>assign(t.id)} disabled={ownedIds.has(t.id)}>Asignar</button>
          </div>
        ))}
        {talents.length===0 && <div className="opacity-70">Esta clase aún no tiene talentos cargados.</div>}
      </div>
    </div>
  )
}
