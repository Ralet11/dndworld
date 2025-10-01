import { Outlet, Link, useLocation } from 'react-router-dom'
import useAuth from '../store/useAuth'
import { useEffect } from 'react'

export default function Layout(){
  const { user, me, logout } = useAuth()
  const loc = useLocation()
  useEffect(()=>{ me() },[])
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="font-bold text-lg">Dungeon World</Link>
          <nav className="flex gap-1">
            <Link className="navlink" to="/">Home</Link>
            <Link className="navlink" to="/campanias">Campañas</Link>
            <Link className="navlink" to="/personajes">Personajes</Link>
            {user?.roles?.includes('DM') && <>
              <Link className="navlink" to="/dm">DM</Link>
              <Link className="navlink" to="/dm/npcs">NPCs</Link>
              <Link className="navlink" to="/dm/items">Ítems</Link>
              <Link className="navlink" to="/dm/quests">Quests</Link>
            </>}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm opacity-80">{user?.name}</span>
            <Link className="navlink" to="/perfil">Perfil</Link>
            <button className="btn" onClick={logout}>Salir</button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet key={loc.pathname}/>
      </main>
      <footer className="border-t border-slate-800 py-4 text-center text-sm opacity-70">
        © {new Date().getFullYear()} Dungeon World
      </footer>
    </div>
  )
}
