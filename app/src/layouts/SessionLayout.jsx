import { NavLink, Outlet, useParams } from "react-router-dom"

const SessionLayout = () => {
  const { campaignId } = useParams()

  const linkBase =
    "rounded-full px-4 py-1 transition font-semibold uppercase tracking-wide"
  const linkActive =
    "bg-ember text-slate-950 shadow-sm"
  const linkInactive =
    "text-slate-300 hover:bg-slate-800/60"

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ember">Campaign Session</p>
            <h1 className="font-display text-2xl text-parchment">Session {campaignId}</h1>
          </div>

          <nav className="flex items-center gap-4 text-sm">
            <NavLink
              to="dm"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkInactive}`
              }
            >
              DM
            </NavLink>

            <NavLink
              to="player"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkActive : linkInactive}`
              }
            >
              Jugadores
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}

export default SessionLayout
