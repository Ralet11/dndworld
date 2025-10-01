import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api/client'

export default function DeckManager(){
  const { id } = useParams()
  const [decks, setDecks] = useState([])
  const [cards, setCards] = useState([])
  const [newName, setNewName] = useState('')

  useEffect(()=>{ load() },[id])
  const load = async()=>{
    const d = await api.get(`/characters/${id}/decks`); setDecks(d.data)
    if (d.data[0]) {
      const c = await api.get(`/characters/decks/${d.data[0].id}/cards`); setCards(c.data)
    } else { setCards([]) }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Mazo</h2>
      <div className="card space-y-2">
        <div className="font-semibold">Decks</div>
        <div className="flex gap-2 flex-wrap">
          {decks.map(d=>(<span key={d.id} className="px-2 py-1 rounded bg-slate-800 border border-slate-700">{d.name}</span>))}
        </div>
        <div className="flex gap-2">
          <input placeholder="Nuevo deck" value={newName} onChange={e=>setNewName(e.target.value)} />
          <button className="btn" onClick={async()=>{ await api.post(`/characters/${id}/decks`, { name:newName || 'Nuevo' }); setNewName(''); load() }}>Crear</button>
        </div>
      </div>
      <div className="card">
        <div className="font-semibold mb-2">Cartas (deck principal)</div>
        <div className="grid md:grid-cols-3 gap-3">
          {cards.map(cc=>(
            <div key={cc.id} className="border border-slate-700 rounded p-3">
              <div className="font-semibold">{cc.Card?.Ability?.name || 'Carta'}</div>
              <div className="text-sm opacity-70">Copias: {cc.copies}</div>
            </div>
          ))}
          {cards.length===0 && <div className="opacity-70">Tu mazo está vacío.</div>}
        </div>
      </div>
    </div>
  )
}
