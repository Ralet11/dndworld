import { useEffect } from 'react'
import useSession from '../../store/useSession'
import api from '../../api/client'

export default function SessionPlayer({ sessionId, ctx }){
  const { map, tokens, dmMessage, bootstrap } = useSession()
  const [hand, setHand] = React.useState([])
  useEffect(()=>{ bootstrap(sessionId); (async()=>{
    try { const h = await api.get(`/characters/${ctx.characterId}/hand`); setHand(h.data || []) } catch {}
  })() },[sessionId])

  const play = async (cardId)=>{
    await api.post(`/sessions/${sessionId}/characters/${ctx.characterId}/play-card`, { cardId })
    try { const h = await api.get(`/characters/${ctx.characterId}/hand`); setHand(h.data || []) } catch {}
  }

  return (
    <div className="space-y-3">
      <div className="card flex items-center justify-between">
        <div className="font-semibold">Sesión #{sessionId}</div>
        <div className="text-sm opacity-80">Turno: —</div>
      </div>
      {dmMessage && <div className="card">{dmMessage}</div>}

      {!map && <div className="opacity-70">Esperando mapa táctico…</div>}
      {map && (
        <div className="relative inline-block p-2 border border-slate-700 rounded" style={{"--cols": map.widthCells, "--rows": map.heightCells}}>
          <div className="grid-board">
            {Array.from({length: map.widthCells * map.heightCells}).map((_,i)=><div key={i} className="grid-cell"></div>)}
          </div>
          {tokens.map(t=>(
            <div key={t.id} className={"token " + t.tokenType} style={{ left: (t.x*32)+18, top: (t.y*32)+18 }}>
              {t.label || (t.tokenType)}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="font-semibold mb-2">Tu mano</div>
        <div className="grid md:grid-cols-3 gap-3">
          {hand.map(c=>(
            <div key={c.id} className="border border-slate-700 rounded p-3">
              <div className="font-semibold">{c.Card?.Ability?.name || 'Carta'}</div>
              <div className="text-sm opacity-70">{c.Card?.Ability?.description}</div>
              <button className="btn mt-2" onClick={()=>play(c.id)}>Jugar</button>
            </div>
          ))}
          {hand.length===0 && <div className="opacity-70">No tenés cartas en mano.</div>}
        </div>
      </div>
    </div>
  )
}
