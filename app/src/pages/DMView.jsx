import { useParams } from 'react-router-dom'
import { useCampaignSession } from '../hooks/useCampaignSession'

const DMView = () => {
  const { campaignId } = useParams()
  const { campaign: activeCampaign, isLoading, error, refetch } = useCampaignSession(campaignId, { role: 'dm' })

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

      {isLoading && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
          Cargando información de la campaña...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-400/60 bg-red-900/40 px-4 py-3 text-sm text-red-200">
          <p className="font-semibold">No pudimos obtener la campaña.</p>
          <p className="mt-1 text-red-100/80">{error.message ?? 'Intenta nuevamente en unos segundos.'}</p>
          <button
            type="button"
            onClick={refetch}
            className="mt-3 rounded-full border border-red-300/60 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-100 transition hover:bg-red-300/20"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-parchment">
        <h2 className="text-lg font-semibold text-parchment">Active Campaign</h2>
        {activeCampaign ? (
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <p>
              Managing campaign <span className="font-semibold text-ember">{activeCampaign.name}</span>
            </p>
            <p className="text-xs uppercase tracking-widest text-slate-500">ID: {activeCampaign.id}</p>
            <p className="text-xs uppercase tracking-widest text-slate-500">State: {activeCampaign.status}</p>
            {activeCampaign.dm && (
              <p className="text-xs text-slate-400">
                DM asignado: <span className="font-semibold text-parchment">{activeCampaign.dm.displayName ?? activeCampaign.dm.username}</span>
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No campaign assigned yet.</p>
        )}
      </div>
    </section>
  )
}

export default DMView
