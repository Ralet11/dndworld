import { Link, Outlet } from 'react-router-dom'

const RootLayout = () => {
  return (
    <div className="flex min-h-screen flex-col bg-midnight text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-display text-2xl text-ember drop-shadow">
            DND World
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold uppercase tracking-wide text-slate-300">
            <Link to="/" className="transition hover:text-ember">
              Overview
            </Link>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200">
              Pre-alpha
            </span>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10">
        <Outlet />
      </main>
      <footer className="border-t border-slate-800 bg-slate-950/70 py-3 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} DND World. Crafted for collaborative storytelling.
      </footer>
    </div>
  )
}

export default RootLayout
