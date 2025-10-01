import { Link } from 'react-router-dom'

export default function DMTools(){
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Herramientas del DM</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <Link to="/campanias/crear" className="card">Crear campaña</Link>
        <Link to="/dm/npcs" className="card">NPCs</Link>
        <Link to="/dm/items" className="card">Ítems</Link>
        <Link to="/dm/quests" className="card">Quests</Link>
      </div>
      <p className="opacity-70 text-sm">Gestioná campañas, escenarios, NPCs, ítems y misiones.</p>
    </div>
  )
}
