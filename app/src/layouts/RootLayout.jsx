import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import AuthModal from '../components/auth/AuthModal'
import { useSessionStore } from '../store/useSessionStore'

const RootLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const session = useSessionStore((state) => state.session)
  const activeCampaignId = useSessionStore((state) => state.session.activeCampaignId)
  const logout = useSessionStore((state) => state.logout)
  const setActiveMode = useSessionStore((state) => state.setActiveMode)

  const [authModalMode, setAuthModalMode] = useState(null)

  const handleOpenAuth = (mode = 'login') => setAuthModalMode(mode)
  const handleCloseAuth = () => setAuthModalMode(null)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleModeChange = (mode) => {
    if (session.activeMode === mode) return
    setActiveMode(mode)
  }

  // Helpers de navegación/modo
  const isActive = (pathPrefix) => location.pathname.startsWith(pathPrefix)
  const isPlayerMode = session.activeMode === 'player'
  const isDmMode = session.activeMode === 'dm'

  const dmToolsPath = activeCampaignId ? `/session/${activeCampaignId}/dm` : '/dm'
  const dmToolsTitle = activeCampaignId
    ? 'Abrir herramientas del DM para la campaña activa.'
    : 'Selecciona una campaña para habilitar las herramientas del DM.'

  const modeAwareLinks = []

  if (session.user) {
    if (isDmMode) {
      modeAwareLinks.push({
        key: 'dm-campaigns',
        label: 'Campañas',
        to: '/dm',
        isActive: isActive('/dm'),
      })

      modeAwareLinks.push({
        key: 'dm-tools',
        label: 'Herramientas DM',
        to: dmToolsPath,
        isActive: activeCampaignId ? location.pathname.startsWith(`/session/${activeCampaignId}/dm`) : false,
        muted: !activeCampaignId,
        title: dmToolsTitle,
      })
    }

    if (isPlayerMode) {
      modeAwareLinks.push({
        key: 'player-campaigns',
        label: 'Campañas',
        to: '/player/campaigns',
        isActive: isActive('/player'),
      })

      modeAwareLinks.push({
        key: 'player-characters',
        label: 'Personajes',
        to: '/player/characters',
        isActive: isActive('/player/characters'),
      })
    }

    modeAwareLinks.push({
      key: 'profile',
      label: 'Perfil',
      to: '/profile',
      isActive: isActive('/profile'),
    })
  }

  const buildNavLinkClassName = (isLinkActive, isMuted = false) => {
    if (isLinkActive) return 'transition text-emerald-300'
    if (isMuted) return 'transition text-slate-500 hover:text-emerald-200'
    return 'transition hover:text-emerald-200'
  }

  const firstName =
    (session.user?.displayName || session.user?.name || '')
      .split(' ')
      .filter(Boolean)[0] ||
    session.user?.email ||
    'Usuario'

  return (
    <div className="flex min-h-screen flex-col bg-midnight text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-display text-2xl text-ember drop-shadow">
            DND World
          </Link>

          <nav className="flex items-center gap-4 text-sm font-semibold uppercase tracking-wide text-slate-300">
            <Link
              to="/"
              className={`transition ${location.pathname === '/' ? 'text-emerald-300' : 'hover:text-ember'}`}
            >
              Overview
            </Link>

            {modeAwareLinks.map(({ key, label, to, isActive: linkIsActive, muted, title }) => (
              <Link key={key} to={to} title={title} className={buildNavLinkClassName(linkIsActive, muted)}>
                {label}
              </Link>
            ))}

            <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 p-1 text-xs">
              <button
                type="button"
                onClick={() => handleModeChange('dm')}
                className={`rounded-full px-3 py-1 transition ${
                  session.activeMode === 'dm'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-emerald-200'
                }`}
              >
                Modo DM
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('player')}
                className={`rounded-full px-3 py-1 transition ${
                  session.activeMode === 'player'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-emerald-200'
                }`}
              >
                Modo jugador
              </button>
            </div>

            {session.user ? (
              <>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200">
                  {firstName}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200"
                >
                  Salir
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleOpenAuth('login')}
                  className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200"
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAuth('register')}
                  className="rounded-full bg-emerald-500 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-emerald-400"
                >
                  Crear cuenta
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
        <Outlet context={{ openAuthModal: handleOpenAuth }} />
      </main>

      <footer className="border-t border-slate-800 bg-slate-950/70 py-3 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} DND World. Crafted for collaborative storytelling.
      </footer>

      {authModalMode ? (
        <AuthModal mode={authModalMode} onClose={handleCloseAuth} onSwitchMode={setAuthModalMode} />
      ) : null}
    </div>
  )
}

export default RootLayout
