import { Link } from 'react-router-dom'
import { useSessionStore } from '../store/useSessionStore'

const featureHighlights = [
  {
    title: 'Campaign Sync',
    description:
      'Real-time campaign state powered by Zustand stores and websocket events keeps the table aligned without spreadsheets.',
  },
  {
    title: 'Immersive Styling',
    description:
      'Tailwind CSS theming provides a parchment-meets-midnight aesthetic that scales across DM and player dashboards.',
  },
  {
    title: 'Modular Routing',
    description:
      'React Router segmentation prepares discrete views for DMs, players, and shared campaign spaces.',
  },
]

const HomePage = () => {
  const session = useSessionStore((state) => state.session)
  const assignCampaign = useSessionStore((state) => state.assignCampaign)
  const clearSession = useSessionStore((state) => state.clearSession)

  const handleLoadDemo = () => {
    assignCampaign({
      id: 'demo-campaign',
      name: 'Shadows of Aetheria',
      role: 'Player',
    })
  }

  return (
    <section className="space-y-12">
      <header className="space-y-6 text-center">
        <p className="text-sm uppercase tracking-[0.4em] text-ember">Forge the adventure</p>
        <h1 className="font-display text-5xl text-parchment drop-shadow-md">DND World Control Panel</h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-300">
          This scaffold establishes the core styling, routing, and state layers needed to bring dungeon masters and heroes
          into the same synchronized encounter space.
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-3">
        {featureHighlights.map((feature) => (
          <article
            key={feature.title}
            className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-parchment transition hover:border-ember"
          >
            <h2 className="text-xl font-semibold text-parchment">{feature.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{feature.description}</p>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          to="/dm"
          className="rounded-full bg-ember px-6 py-3 text-sm font-semibold uppercase tracking-wide text-midnight transition hover:bg-amber-400"
        >
          DM Dashboard
        </Link>
        <Link
          to="/player"
          className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-slate-200 transition hover:border-ember hover:text-ember"
        >
          Player Portal
        </Link>
        <button
          type="button"
          onClick={handleLoadDemo}
          className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-emerald-300 transition hover:bg-emerald-500/20"
        >
          Load Demo Campaign
        </button>
        <button
          type="button"
          onClick={clearSession}
          className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-slate-200 transition hover:border-red-500/60 hover:text-red-300"
        >
          Clear Session
        </button>
      </div>
      <div className="mx-auto max-w-3xl rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-parchment">
        <h2 className="text-lg font-semibold text-parchment">Current Session Snapshot</h2>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-950/80 p-4 text-left text-xs leading-relaxed text-slate-300">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>
    </section>
  )
}

export default HomePage
