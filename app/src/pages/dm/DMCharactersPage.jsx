// app/src/pages/dm/DMCharactersPage.jsx
import { useMemo, useState } from 'react'
import { useSessionStore } from '../../store/useSessionStore'
import { useCampaignSession } from '../../hooks/useCampaignSession'
import { createNpc } from '../../api/campaigns'

const initial = {
  name: '',
  title: '',
  creatureType: '',
  disposition: 'unknown',
  scenarioId: '',
  portraitUrl: '',
}

const DMCharactersPage = () => {
  const campaignId = useSessionStore(s => s.session.activeCampaignId)
  const { campaign, isLoading, error, refetch } = useCampaignSession(campaignId, { role: 'dm' })

  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const npcs = campaign?.npcs ?? []
  const scenarios = campaign?.scenarios ?? []

  const scenarioLookup = useMemo(
    () => Object.fromEntries(scenarios.map(s => [s.id, s.title])),
    [scenarios]
  )

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (err) setErr(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!campaign) return
    if (!form.name.trim()) {
      setErr('El nombre es obligatorio.')
      return
    }
    setBusy(true)
    try {
      const payload = {
        name: form.name.trim(),
        disposition: form.disposition,
      }
      if (form.title.trim()) payload.title = form.title.trim()
      if (form.creatureType.trim()) payload.creatureType = form.creatureType.trim()
      if (form.scenarioId) payload.scenarioId = form.scenarioId
      if (form.portraitUrl.trim()) payload.portraitUrl = form.portraitUrl.trim()

      await createNpc(campaign.id, payload)
      setForm(initial)
      await refetch()
    } catch (e2) {
      setErr(e2?.response?.data?.message || e2?.message || 'No se pudo crear el NPC')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">NPCs</p>
        <h1 className="font-display text-3xl text-parchment">Gestión de PNJs</h1>
      </header>

      {isLoading && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
          Cargando información…
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-400/60 bg-red-900/40 px-4 py-3 text-sm text-red-200">
          {error.message || 'No se pudo cargar la campaña'}
        </div>
      )}

      {campaign && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* formulario */}
          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold text-parchment">Nuevo NPC</h2>
            <form className="space-y-4" onSubmit={submit}>
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400">Nombre</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-widest text-slate-400">Título/rol</label>
                  <input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-slate-400">Tipo de criatura</label>
                  <input
                    name="creatureType"
                    value={form.creatureType}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-widest text-slate-400">Disposición</label>
                  <select
                    name="disposition"
                    value={form.disposition}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  >
                    <option value="friendly">Aliada</option>
                    <option value="neutral">Neutral</option>
                    <option value="hostile">Hostil</option>
                    <option value="unknown">Sin definir</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-slate-400">Escenario vinculado</label>
                  <select
                    name="scenarioId"
                    value={form.scenarioId}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  >
                    <option value="">Sin asignar</option>
                    {scenarios.map(s => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400">URL del retrato</label>
                <input
                  name="portraitUrl"
                  value={form.portraitUrl}
                  onChange={handleChange}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                />
              </div>

              {err && <p className="text-sm text-red-300">{err}</p>}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
              >
                {busy ? 'Creando…' : 'Agregar NPC'}
              </button>
            </form>
          </section>

          {/* lista de npcs */}
          <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-sm font-semibold text-parchment">NPCs existentes</h2>
            <div className="space-y-2">
              {npcs.length ? (
                npcs.map(npc => (
                  <article key={npc.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="font-semibold text-parchment">{npc.name}</h4>
                        {npc.title && <p className="text-xs text-slate-400">{npc.title}</p>}
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
                        {npc.disposition}
                      </span>
                    </div>
                    {npc.scenarioId && (
                      <p className="mt-2 text-[10px] uppercase tracking-[0.35em] text-ember">
                        Escenario: {scenarioLookup[npc.scenarioId] ?? '—'}
                      </p>
                    )}
                    {npc.creatureType && <p className="mt-2 text-xs text-slate-400">Tipo: {npc.creatureType}</p>}
                  </article>
                ))
              ) : (
                <p className="text-xs text-slate-400">Todavía no hay NPCs.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export default DMCharactersPage
