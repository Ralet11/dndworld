import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useCampaignList } from "../hooks/useCampaignList"
import { useSessionStore } from "../store/useSessionStore"

const SessionEntryPage = ({ role }) => {
  const navigate = useNavigate()
  const { campaigns = [], isLoading, error, refetch } = useCampaignList()
  const activeCampaignId = useSessionStore((state) => state.session.activeCampaignId)

  const buildSessionPath = (id) =>
    `/session/${id}/${role === "dm" ? "dm" : "player"}`

  useEffect(() => {
    if (!activeCampaignId) return
    navigate(buildSessionPath(activeCampaignId), { replace: true })
  }, [activeCampaignId, navigate, role])

  const handleJoin = (campaignId) => {
    navigate(buildSessionPath(campaignId))
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-10">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-ember">
          {role === "dm" ? "Dungeon Master Access" : "Player Access"}
        </p>
        <h1 className="font-display text-4xl text-parchment">
          {role === "dm" ? "Selecciona tu campaña" : "Únete a una campaña"}
        </h1>
        <p className="max-w-2xl text-sm text-slate-300">
          {role === "dm"
            ? "Elige la campaña que quieres dirigir para abrir la consola del DM."
            : "Selecciona la campaña asignada para entrar a la sala compartida."}
        </p>
      </header>

      {isLoading && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
          Cargando campañas disponibles...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-400/60 bg-red-900/40 px-4 py-3 text-sm text-red-200">
          <p className="font-semibold">No pudimos obtener la lista de campañas.</p>
          <p className="mt-1 text-red-100/80">
            {error.message ?? "Intenta nuevamente en unos segundos."}
          </p>
          <button
            type="button"
            onClick={refetch}
            className="mt-3 rounded-full border border-red-300/60 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-100 transition hover:bg-red-300/20"
          >
            Reintentar
          </button>
        </div>
      )}

      {!isLoading && !error && campaigns.length === 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-6 text-center text-sm text-slate-400">
          Aún no hay campañas registradas. Crea una desde el panel del DM para comenzar.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {campaigns.map((campaign) => (
          <article
            key={campaign.id}
            className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40"
          >
            <div className="space-y-3">
              <div>
                <h2 className="font-display text-xl text-parchment">{campaign.name}</h2>
                <p className="text-xs uppercase tracking-widest text-slate-500">
                  Estado: {campaign.status}
                </p>
              </div>
              {campaign.description && (
                <p className="line-clamp-3 text-sm text-slate-300">{campaign.description}</p>
              )}
              {campaign.dm && (
                <p className="text-xs text-slate-400">
                  DM:{" "}
                  <span className="font-semibold text-ember">
                    {campaign.dm.displayName ?? campaign.dm.username}
                  </span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleJoin(campaign.id)}
              className="mt-4 inline-flex items-center justify-center rounded-full bg-ember px-4 py-2 text-sm font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-ember/90"
            >
              {role === "dm" ? "Dirigir sesión" : "Unirme como jugador"}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

export const DMEntryPage = () => <SessionEntryPage role="dm" />
export const PlayerEntryPage = () => <SessionEntryPage role="player" />

export default SessionEntryPage
