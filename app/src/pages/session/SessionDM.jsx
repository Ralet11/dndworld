import { useEffect } from 'react'
import useSession from '../../store/useSession'

export default function SessionDM({ sessionId, ctx }){
  const { ctx:storeCtx, map, tokens, layers, participants, dmMessage, bootstrap, changeLayer, moveToken, sendDmMessage } = useSession()
  useEffect(()=>{ bootstrap(sessionId) },[sessionId])

  return (
    <div className="grid grid-cols-12 gap-4">
      <aside className="col-span-3 space-y-3">
        <div className="card">
          <div className="font-semibold mb-2">Jugadores</div>
          <div className="space-y-1 text-sm">
            {participants.map(p=>(
              <div key={p.id} className="flex justify-between">
                <span>{p.userName}</span>
                <span className="opacity-70">{p.status || 'En línea'}</span>
              </div>
            ))}
            {participants.length===0 && <div className="opacity-70">Nadie conectado aún</div>}
          </div>
        </div>
      </aside>

      <section className="col-span-6 space-y-3">
        <div className="card flex items-end gap-2">
          <div className="flex-1">
            <div className="font-semibold">Capas del escenario</div>
            <div className="flex flex-wrap gap-2 mt-2">
              {layers.map(l=>(
                <button key={l.id}
                  className={"btn " + (l.id===storeCtx?.activeLayerId? 'opacity-100' : 'opacity-70')}
                  onClick={()=>changeLayer(sessionId, l.id)}>
                  {l.layerType} · {l.sortOrder}
                </button>
              ))}
              {layers.length===0 && <span className="text-sm opacity-70">Aún no hay capas.</span>}
            </div>
          </div>
          <button className="btn">Iniciar</button>
          <button className="btn">Finalizar</button>
        </div>

        {!map && <div className="opacity-70">Capa no táctica activa. (Activa una TÁCTICA para ver el mapa)</div>}
        {map && (
          <div className="relative inline-block p-2 border border-slate-700 rounded" style={{"--cols": map.widthCells, "--rows": map.heightCells}}>
            <div className="grid-board">
              {Array.from({length: map.widthCells * map.heightCells}).map((_,i)=><div key={i} className="grid-cell"></div>)}
            </div>
            {tokens.map(t=>(
              <div key={t.id}
                   className={"token " + t.tokenType}
                   style={{ left: (t.x*32)+18, top: (t.y*32)+18 }}
                   title="Doble click para mover"
                   onDoubleClick={()=>{
                     const nx = Number(prompt('X nueva', t.x) ?? t.x)
                     const ny = Number(prompt('Y nueva', t.y) ?? t.y)
                     moveToken(t.id, nx, ny)
                   }}>
                {t.label || (t.tokenType + (t.creatureId ? ' #' + t.creatureId.slice(0,4) : ''))}
              </div>
            ))}
          </div>
        )}
      </section>

      <aside className="col-span-3 space-y-3">
        <div className="card">
          <div className="font-semibold mb-2">Mensaje del DM</div>
          <textarea id="dmmsg" rows="6" placeholder="Escribe un mensaje...">{dmMessage}</textarea>
          <button className="btn mt-2" onClick={()=>sendDmMessage(sessionId, document.getElementById('dmmsg').value)}>Enviar a jugadores</button>
        </div>
      </aside>
    </div>
  )
}
