import { useSessionStore } from '../store/useSessionStore'

const PlayerView = () => {
  const { session } = useSessionStore()
  const activeCampaign = session.campaigns.find((campaign) => campaign.id === session.activeCampaignId)

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-ember">Player Portal</p>
        <h1 className="font-display text-4xl text-parchment">Shared Encounter Space</h1>
        <p className="max-w-3xl text-sm text-slate-300">
          Party chat, initiative orders, and synchronized maps will land here as the project evolves.
        </p>
      </header>
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-parchment">
        <h2 className="text-lg font-semibold text-parchment">Your Campaign</h2>
        {activeCampaign ? (
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <p>
              Currently adventuring in <span className="font-semibold text-ember">{activeCampaign.name}</span>
            </p>
            {activeCampaign.role && (
              <p>
                Role:{' '}
                <span className="rounded-full border border-ember/40 bg-ember/10 px-3 py-1 text-xs uppercase tracking-wider text-ember">
                  {activeCampaign.role}
                </span>
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Join a campaign to view shared encounters.</p>
        )}
      </div>
    </section>
  )
}

export default PlayerView
