import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import AuthModal from '../components/auth/AuthModal'
import { useSessionStore } from '../store/useSessionStore'

const navItemClassName = ({ isActive }) =>
  `rounded-xl px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.28em] transition-all duration-200 ${
    isActive
      ? 'text-primary bg-primary/10 ring-1 ring-primary/45 shadow-[0_14px_34px_rgba(59,130,246,0.35)]'
      : 'text-text-muted hover:text-primary hover:bg-surface-interactive hover:ring-1 hover:ring-primary/20'
  }`

const RootLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const session = useSessionStore((state) => state.session)
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

  const isActive = (pathPrefix) => location.pathname.startsWith(pathPrefix)
  const isPlayerMode = session.activeMode === 'player'
  const isDmMode = session.activeMode === 'dm'

  const dmToolsPath = '/dm/tools'
  const dmToolsTitle = 'Herramientas del DM (requiere campana activa)'

  const modeAwareLinks = []

  if (session.user) {
    if (isDmMode) {
      modeAwareLinks.push({
        key: 'dm-campaigns',
        label: 'Campanas',
        to: '/dm?view=list',
        title: 'Resumen de campanas',
        isActive: isActive('/dm') && !isActive('/dm/tools'),
      })

      modeAwareLinks.push({
        key: 'dm-tools',
        label: 'Herramientas DM',
        to: dmToolsPath,
        title: dmToolsTitle,
        isActive: isActive('/dm/tools'),
      })
    }

    if (isPlayerMode) {
      modeAwareLinks.push({
        key: 'player-campaigns',
        label: 'Campanas',
        to: '/player/campaigns',
        title: 'Campanas del jugador',
        isActive: isActive('/player') && !isActive('/player/characters'),
      })

      modeAwareLinks.push({
        key: 'player-characters',
        label: 'Personajes',
        to: '/player/characters',
        title: 'Personajes activos',
        isActive: isActive('/player/characters'),
      })
    }

    modeAwareLinks.push({
      key: 'profile',
      label: 'Perfil',
      to: '/profile',
      title: 'Preferencias y datos de perfil',
      isActive: isActive('/profile'),
    })
  }

  const firstName =
    (session.user?.displayName || session.user?.name || '')
      .split(' ')
      .filter(Boolean)[0] ||
    session.user?.email ||
    'Usuario'

  return (
    <div className="flex min-h-screen flex-col text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-surface backdrop-blur-xl shadow-holo">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-6 px-6 py-5">
          <Link to="/" className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary shadow-[0_10px_26px_rgba(59,130,246,0.35)]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 3l8 4v6c0 5.25-3.78 9.21-8 10-4.22-.79-8-4.75-8-10V7l8-4z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 12l6 3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 12L6 9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="font-display text-lg font-semibold uppercase tracking-[0.4em] text-primary">Dungeon</p>
              <p className="text-xs uppercase tracking-[0.45em] text-text-muted">world toolkit</p>
            </div>
          </Link>

          <nav className="flex items-center gap-3">
            <NavLink to="/" end className={navItemClassName}>
              Overview
            </NavLink>

            {modeAwareLinks.map(({ key, to, label, title }) => (
              <NavLink key={key} to={to} title={title} className={navItemClassName}>
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <div className="gaming-pill-switch">
              <button
                type="button"
                onClick={() => handleModeChange('dm')}
                className={`text-[0.65rem] ${session.activeMode === 'dm' ? 'is-active text-primary-foreground' : ''}`}
              >
                Modo DM
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('player')}
                className={`text-[0.65rem] ${session.activeMode === 'player' ? 'is-active text-primary-foreground' : ''}`}
              >
                Modo jugador
              </button>
            </div>

            {session.user ? (
              <div className="flex items-center gap-3">
                <span className="rounded-xl border border-border/60 bg-surface-interactive px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-text-secondary shadow-[0_12px_28px_rgba(4,10,26,0.35)]">
                  {firstName}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-xl border border-border/50 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-text-muted transition-all duration-200 hover:border-primary hover:text-primary hover:shadow-[0_12px_28px_rgba(59,130,246,0.3)]"
                >
                  Salir
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleOpenAuth('login')}
                  className="rounded-xl border border-border/60 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-text-muted transition-all duration-200 hover:border-primary hover:text-primary"
                >
                  Iniciar sesion
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAuth('register')}
                  className="gaming-button px-5 py-2"
                >
                  Crear cuenta
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-6 py-10">
        <Outlet context={{ openAuthModal: handleOpenAuth }} />
      </main>

      <footer className="border-t border-border/40 bg-surface py-4 text-center text-[0.65rem] uppercase tracking-[0.3em] text-text-subtle">
        &copy; {new Date().getFullYear()} Dungeon World Toolkit
      </footer>

      {authModalMode ? (
        <AuthModal
          isOpen={Boolean(authModalMode)}
          mode={authModalMode}
          onClose={handleCloseAuth}
          onSwitchMode={setAuthModalMode}
        />
      ) : null}
    </div>
  )
}

export default RootLayout
