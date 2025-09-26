// app/src/pages/dm/DMItemsPage.jsx
import { useState } from 'react'
import { useSessionStore } from '../../store/useSessionStore'
import { useCampaignSession } from '../../hooks/useCampaignSession'
import { createItem } from '../../api/campaigns'

const initial = { name: '', type: 'misc', data: '' }

const DMItemsPage = () => {
  const campaignId = useSessionStore(s => s.session.activeCampaignId)
  const { campaign, isLoading, error, refetch } = useCampaignSession(campaignId, { role: 'dm' })

  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const items = campaign?.items ?? []

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
        type: form.type,
      }
      if (form.data.trim()) {
        // Permite JSON rápido en un textarea
        try { payload.data = JSON.parse(form.data) } catch { payload.data = { notes: form.data } }
      }
      await createItem(campaign.id, payload)
      setForm(initial)
      await refetch()
    } catch (e2) {
      setErr(e2?.response?.data?.message || e2?.message || 'No se pudo crear el objeto')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Objetos</p>
        <h1 className="font-display text-3xl text-parchment">Inventario y tesoros</h1>
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
          {/* form */}
          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold text-parchment">Nuevo objeto</h2>
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
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400">Tipo</label>
                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                >
                  <option value="misc">Misceláneo</option>
                  <option value="consumable">Consumible</option>
                  <option value="weapon">Arma</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400">Datos (JSON o texto)</label>
                <textarea
                  name="data"
                  rows={4}
                  value={form.data}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                />
              </div>

              {err && <p className="text-sm text-red-300">{err}</p>}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
              >
                {busy ? 'Creando…' : 'Agregar objeto'}
              </button>
            </form>
          </section>

          {/* lista */}
          <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-sm font-semibold text-parchment">Objetos existentes</h2>
            <div className="space-y-2">
              {items.length ? (
                items.map(it => (
                  <article key={it.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
                    <div className="flex items-center justify-between gap-4">
                      <h4 className="font-semibold text-parchment">{it.name}</h4>
                      <span className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
                        {it.type}
                      </span>
                    </div>
                    {it.data && (
                      <pre className="mt-2 overflow-auto rounded bg-slate-900/70 p-2 text-xs text-slate-300">
                        {JSON.stringify(it.data, null, 2)}
                      </pre>
                    )}
                  </article>
                ))
              ) : (
                <p className="text-xs text-slate-400">Todavía no hay objetos.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export default DMItemsPage
