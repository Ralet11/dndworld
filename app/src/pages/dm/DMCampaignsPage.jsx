import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../../store/useSessionStore'
// Si ya tienes API: import { fetchCampaigns, createCampaign } from '../../api/campaigns'

export default function DMCampaignsPage() {
  const navigate = useNavigate()
  const session = useSessionStore(s => s.session)
  const setCampaigns = useSessionStore(s => s.setCampaigns)
  const assignCampaign = useSessionStore(s => s.assignCampaign)
  const setActiveCampaign = useSessionStore(s => s.setActiveCampaign)

  const campaigns = session.campaigns ?? []
  const [form, setForm] = useState({ name: '', description: '', status: 'draft' })
  const activeId = session.activeCampaignId

  const sorted = useMemo(
    () => [...campaigns].sort((a, b) => (a.updatedAt || a.createdAt || '').localeCompare(b.updatedAt || b.createdAt || '')),
    [campaigns]
  )

  const onCreate = async (e) => {
    e.preventDefault()
    // Si tienes backend: const created = await createCampaign(form)
    const created = {
      id: crypto.randomUUID(),
      name: form.name || 'Nueva campaña',
      description: form.description || '',
      status: form.status || 'draft',
      createdAt: new Date().toISOString(),
    }
    assignCampaign(created)            // añade y la deja activa
    setForm({ name: '', description: '', status: 'draft' })
  }

  const setActive = (id) => {
    setActiveCampaign(id)
  }

  const goToTools = () => {
    if (!session.activeCampaignId) return
    navigate(`/session/${session.activeCampaignId}/tools`)
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Dungeon Master Access</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={goToTools}
            disabled={!session.activeCampaignId}
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-950 transition disabled:cursor-not-allowed disabled:bg-emerald-500/40"
          >
            Abrir tablero en vivo
          </button>
        </div>
      </header>

      <section className="grid gap-8 lg:grid-cols-[1fr,1.2fr]">
        {/* Crear campaña */}
        <article className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <h2 className="text-lg font-semibold text-parchment">Crear nueva campaña</h2>
          <form className="space-y-4" onSubmit={onCreate}>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400">Nombre</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Campaña de prueba"
                required
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400">Descripción</label>
              <textarea
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Resumen corto…"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400">Estado</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                <option value="draft">Borrador</option>
                <option value="active">Activa</option>
                <option value="archived">Archivada</option>
              </select>
            </div>

            <button className="rounded-full bg-emerald-500 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-emerald-400">
              Crear campaña
            </button>
          </form>
        </article>

        {/* Lista de campañas */}
        <article className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <h2 className="text-lg font-semibold text-parchment">Mis campañas</h2>

          {sorted.length === 0 ? (
            <p className="text-sm text-slate-400">Aún no tienes campañas.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {sorted.map(c => {
                const isActive = c.id === activeId
                return (
                  <li key={c.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-parchment">{c.name}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-400">{c.description || 'Sin descripción'}</p>
                        <p className="mt-2 text-[10px] uppercase tracking-widest text-slate-500">Estado: {c.status || 'borrador'}</p>
                      </div>
                      {isActive ? (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                          Activa
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {!isActive && (
                        <button
                          onClick={() => setActive(c.id)}
                          className="rounded-full border border-emerald-400/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-300 transition hover:bg-emerald-400/10"
                        >
                          Marcar activa
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setActive(c.id)
                          navigate(`/session/${c.id}/tools`)
                        }}
                        className="rounded-full bg-ember px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-amber-400"
                      >
                        Abrir herramientas
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </article>
      </section>
    </div>
  )
}
