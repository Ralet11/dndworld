import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/client'
export default function Characters(){
  const [list, setList] = useState([])
  useEffect(()=>{ api.get('/characters/mine').then(r=>setList(r.data)) },[])
  const hasReachedLimit = list.length >= 3
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Mis personajes</h2>
        {hasReachedLimit ? (
          <button
            type="button"
            className="btn cursor-not-allowed opacity-60"
            disabled
            title="Límite de personajes alcanzado"
          >
            Crear personaje
          </button>
        ) : (
          <Link to="/personajes/crear" className="btn">Crear personaje</Link>
        )}
      </div>
      {hasReachedLimit && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Solo podés tener 3 personajes activos a la vez. Archivá uno para crear uno nuevo.
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {list.map(ch=>(
          <Link key={ch.id} to={`/personajes/${ch.id}`} className="card block">
            <div className="font-semibold">{ch.Creature?.name}</div>
            <div className="text-sm opacity-70">Nivel {ch.Creature?.level}</div>
          </Link>
        ))}
        {list.length===0 && <div className="opacity-70">Aún no tenés personajes.</div>}
      </div>
    </div>
  )
}
