import { useSessionStore } from '../store/useSessionStore'

const DMView = () => {
  const { session } = useSessionStore()

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-ember">Dungeon Master Console</p>
        <h1 className="font-display text-4xl text-parchment">Campaign Orchestration</h1>
        <p className="max-w-3xl text-sm text-slate-300">
          Detailed encounter controls, initiative tracking, and narrative prompts will live here. For now, confirm that routing
          and shared state wiring are working end-to-end.
        </p>
      </header>
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-parchment">
        <h2 className="text-lg font-semibold text-parchment">Active Campaign</h2>
        {session.activeCampaignId ? (
          <p className="mt-2 text-sm text-slate-300">
            Managing campaign <span className="font-semibold text-ember">{session.activeCampaignId}</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No campaign assigned yet.</p>
        )}
      </div>
    </section>
  )
}

export default DMView
