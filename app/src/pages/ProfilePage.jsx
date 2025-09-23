import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../store/useSessionStore'

const ProfilePage = () => {
  const navigate = useNavigate()
  const session = useSessionStore((state) => state.session)
  const logout = useSessionStore((state) => state.logout)

  const campaigns = session.campaigns ?? []

  const firstName = useMemo(() => session.user?.name?.split(' ')?.[0] ?? session.user?.email, [session.user])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Tu perfil</p>
        <h1 className="font-display text-4xl text-parchment">Hola {firstName}</h1>
        <p className="text-sm text-slate-300">
          Esta cuenta vive solo en tu navegador por ahora. Cuando conectemos el backend, migraremos estos datos.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <h2 className="text-lg font-semibold text-parchment">Datos principales</h2>
          <dl className="space-y-3 text-sm text-slate-200">
            <div>
              <dt className="text-xs uppercase tracking-widest text-slate-500">Nombre</dt>
              <dd className="text-parchment">{session.user?.name ?? 'Sin definir'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-slate-500">Email</dt>
              <dd className="text-parchment">{session.user?.email}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-red-400/60 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-red-200 transition hover:bg-red-400/20"
          >
            Cerrar sesion
          </button>
        </article>

        <article className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <h2 className="text-lg font-semibold text-parchment">Campanas guardadas</h2>
          {campaigns.length ? (
            <ul className="space-y-3 text-sm text-slate-200">
              {campaigns.map((campaign) => (
                <li key={campaign.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="font-semibold text-parchment">{campaign.name ?? 'Campana sin nombre'}</p>
                  <p className="text-xs uppercase tracking-widest text-slate-500">Rol: {campaign.role ?? 'Sin rol'}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Todavia no guardaste campanas locales. Explora la demo para generar algunas.</p>
          )}
        </article>
      </div>
    </section>
  )
}

export default ProfilePage
