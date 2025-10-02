import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../../api/client'

export default function CharacterDetail(){
  const { id } = useParams()
  const [ch, setCh] = useState(null)
  const [attrs, setAttrs] = useState(null)
  const [res, setRes] = useState([])
  const [wallet, setWallet] = useState(null)
  useEffect(()=>{
    api.get(`/characters/${id}`).then(r=>setCh(r.data))
    api.get(`/characters/${id}/resources`).then(r=>setRes(r.data))
    api.get(`/characters/${id}/wallet`).then(r=>setWallet(r.data))
    api.post(`/characters/${id}/attributes`, {}).then(r=>setAttrs(r.data)).catch(()=>{})
  },[id])
  if (!ch) return <div>Cargando…</div>

  const portrait = ch.Creature?.portrait
  const portraitUrl = portrait?.meta?.secureUrl

  return (
    <div className="space-y-3">
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-28 h-28 border border-slate-700 rounded overflow-hidden flex items-center justify-center bg-slate-900">
              {portraitUrl ? (
                <img src={portraitUrl} alt={`Retrato de ${ch.Creature?.name ?? 'personaje'}`} className="w-full h-full object-cover" />
              ) : portrait ? (
                <div className="text-xs text-center px-2">Retrato en proceso…</div>
              ) : (
                <div className="text-xs text-center px-2 opacity-70">Sin retrato</div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{ch.Creature?.name}</h2>
              <div className="text-sm opacity-70">Nivel {ch.Creature?.level}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to={`/personajes/${id}/perfil`} className="btn">Perfil</Link>
            <Link to={`/personajes/${id}/talentos`} className="btn">Talentos</Link>
            <Link to={`/personajes/${id}/mazo`} className="btn">Mazo</Link>
            <Link to={`/personajes/${id}/inventario`} className="btn">Inventario</Link>
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <div className="card">
          <div className="font-semibold mb-2">Atributos</div>
          {attrs ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {["str","dex","con","int","wis","cha"].map(k=>(<div key={k}><b>{k.toUpperCase()}</b>: {attrs[k]}</div>))}
            </div>
          ):<div className="opacity-70 text-sm">Sin datos</div>}
        </div>
        <div className="card">
          <div className="font-semibold mb-2">Recursos</div>
          {res.map(r=>(<div key={r.id} className="text-sm">{r.resource}: {r.current}/{r.max}</div>))}
        </div>
        <div className="card">
          <div className="font-semibold mb-2">Oro</div>
          <div className="text-2xl">{wallet?.gold ?? 0}g</div>
          <button className="btn mt-2" onClick={async()=>{ await api.post(`/characters/${id}/respec`, {confirm:true}); const w = await api.get(`/characters/${id}/wallet`); setWallet(w.data) }}>Respec (100g)</button>
        </div>
      </div>
    </div>
  )
}
