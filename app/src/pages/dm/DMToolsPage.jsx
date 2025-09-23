// app/src/pages/dm/DMToolsPage.jsx
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  createNpc,
  createScenario,
  updateItem,
  updateNpc,
  updateScenario,
} from '../../api/campaigns'
import { useCampaignSession } from '../../hooks/useCampaignSession'

const scenarioInitialState = {
  title: '',
  summary: '',
  objective: '',
  environmentTags: '',
}

const scenarioEditInitialState = { ...scenarioInitialState }

const npcInitialState = {
  name: '',
  title: '',
  creatureType: '',
  disposition: 'unknown',
  scenarioId: '',
  portraitUrl: '',
}

const npcEditInitialState = { ...npcInitialState }

const itemInitialState = {
  name: '',
  type: 'misc',
  scenarioId: '',
  data: '',
}

const itemTypeLabels = {
  consumable: 'Consumible',
  weapon: 'Arma',
  misc: 'Miscelaneo',
}

const DMToolsPage = () => {
  const { campaignId } = useParams()
  const { campaign: activeCampaign, isLoading, error, refetch } = useCampaignSession(campaignId, { role: 'dm' })

  const [scenarioForm, setScenarioForm] = useState(scenarioInitialState)
  const [scenarioError, setScenarioError] = useState(null)
  const [isCreatingScenario, setIsCreatingScenario] = useState(false)

  const [editingScenarioId, setEditingScenarioId] = useState(null)
  const [scenarioEditForm, setScenarioEditForm] = useState(scenarioEditInitialState)
  const [scenarioEditError, setScenarioEditError] = useState(null)
  const [isUpdatingScenario, setIsUpdatingScenario] = useState(false)

  const [npcForm, setNpcForm] = useState(npcInitialState)
  const [npcError, setNpcError] = useState(null)
  const [isCreatingNpc, setIsCreatingNpc] = useState(false)

  const [editingNpcId, setEditingNpcId] = useState(null)
  const [npcEditForm, setNpcEditForm] = useState(npcEditInitialState)
  const [npcEditError, setNpcEditError] = useState(null)
  const [isUpdatingNpc, setIsUpdatingNpc] = useState(false)

  const [editingItemId, setEditingItemId] = useState(null)
  const [itemForm, setItemForm] = useState(itemInitialState)
  const [itemError, setItemError] = useState(null)
  const [isUpdatingItem, setIsUpdatingItem] = useState(false)

  const scenarios = activeCampaign?.scenarios ?? []
  const allNpcs = activeCampaign?.npcs ?? []
  const items = activeCampaign?.items ?? []

  const scenarioLookup = useMemo(() => {
    const entries = scenarios.map((scenario) => [scenario.id, scenario.title])
    return Object.fromEntries(entries)
  }, [scenarios])

  const handleScenarioInputChange = (event) => {
    const { name, value } = event.target
    setScenarioForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleScenarioEditInputChange = (event) => {
    const { name, value } = event.target
    setScenarioEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const startScenarioEdit = (scenario) => {
    setEditingScenarioId(scenario.id)
    setScenarioEditForm({
      title: scenario.title ?? '',
      summary: scenario.summary ?? '',
      objective: scenario.objective ?? '',
      environmentTags: Array.isArray(scenario.environmentTags)
        ? scenario.environmentTags.join(', ')
        : '',
    })
    setScenarioEditError(null)
  }

  const cancelScenarioEdit = () => {
    setEditingScenarioId(null)
    setScenarioEditForm(scenarioEditInitialState)
    setScenarioEditError(null)
  }

  const handleNpcInputChange = (event) => {
    const { name, value } = event.target
    setNpcForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleNpcEditInputChange = (event) => {
    const { name, value } = event.target
    setNpcEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const startNpcEdit = (npc) => {
    setEditingNpcId(npc.id)
    setNpcEditForm({
      name: npc.name ?? '',
      title: npc.title ?? '',
      creatureType: npc.creatureType ?? '',
      disposition: npc.disposition ?? 'unknown',
      scenarioId: npc.scenarioId ?? '',
      portraitUrl: npc.portraitUrl ?? '',
    })
    setNpcEditError(null)
  }

  const cancelNpcEdit = () => {
    setEditingNpcId(null)
    setNpcEditForm(npcEditInitialState)
    setNpcEditError(null)
  }

  const handleItemInputChange = (event) => {
    const { name, value } = event.target
    setItemForm((prev) => ({ ...prev, [name]: value }))
  }

  const startItemEdit = (item) => {
    setEditingItemId(item.id)
    setItemForm({
      name: item.name ?? '',
      type: item.type ?? 'misc',
      scenarioId: item.scenarioId ?? '',
      data: item.data ? JSON.stringify(item.data, null, 2) : '',
    })
    setItemError(null)
  }

  const cancelItemEdit = () => {
    setEditingItemId(null)
    setItemForm(itemInitialState)
    setItemError(null)
  }

  const submitScenario = async (event) => {
    event.preventDefault()
    if (!activeCampaign) return

    if (!scenarioForm.title.trim()) {
      setScenarioError('El titulo del escenario es obligatorio.')
      return
    }

    setIsCreatingScenario(true)
    setScenarioError(null)

    try {
      const payload = { title: scenarioForm.title.trim() }

      if (scenarioForm.summary.trim()) payload.summary = scenarioForm.summary.trim()
      if (scenarioForm.objective.trim()) payload.objective = scenarioForm.objective.trim()
      if (scenarioForm.environmentTags.trim()) {
        payload.environmentTags = scenarioForm.environmentTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      }

      await createScenario(activeCampaign.id, payload)
      setScenarioForm(scenarioInitialState)
      await refetch()
    } catch (creationError) {
      const message =
        creationError.response?.data?.message ??
        creationError.message ??
        'No se pudo crear el escenario.'
      setScenarioError(message)
    } finally {
      setIsCreatingScenario(false)
    }
  }

  const submitScenarioUpdate = async (event) => {
    event.preventDefault()
    if (!activeCampaign || !editingScenarioId) return

    if (!scenarioEditForm.title.trim()) {
      setScenarioEditError('El titulo del escenario es obligatorio.')
      return
    }

    setIsUpdatingScenario(true)
    setScenarioEditError(null)

    try {
      const payload = {
        title: scenarioEditForm.title.trim(),
        summary: scenarioEditForm.summary.trim() ? scenarioEditForm.summary.trim() : null,
        objective: scenarioEditForm.objective.trim() ? scenarioEditForm.objective.trim() : null,
        environmentTags: scenarioEditForm.environmentTags.trim()
          ? scenarioEditForm.environmentTags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)
          : null,
      }

      await updateScenario(activeCampaign.id, editingScenarioId, payload)
      cancelScenarioEdit()
      await refetch()
    } catch (updateError) {
      const message =
        updateError.response?.data?.message ??
        updateError.message ??
        'No se pudo actualizar el escenario.'
      setScenarioEditError(message)
    } finally {
      setIsUpdatingScenario(false)
    }
  }

  const submitNpc = async (event) => {
    event.preventDefault()
    if (!activeCampaign) return

    if (!npcForm.name.trim()) {
      setNpcError('El nombre del NPC es obligatorio.')
      return
    }

    setIsCreatingNpc(true)
    setNpcError(null)

    try {
      const payload = {
        name: npcForm.name.trim(),
        disposition: npcForm.disposition,
      }

      if (npcForm.title.trim()) payload.title = npcForm.title.trim()
      if (npcForm.creatureType.trim()) payload.creatureType = npcForm.creatureType.trim()
      if (npcForm.scenarioId) payload.scenarioId = npcForm.scenarioId
      if (npcForm.portraitUrl.trim()) payload.portraitUrl = npcForm.portraitUrl.trim()

      await createNpc(activeCampaign.id, payload)
      setNpcForm(npcInitialState)
      await refetch()
    } catch (creationError) {
      const message =
        creationError.response?.data?.message ??
        creationError.message ??
        'No se pudo crear el NPC.'
      setNpcError(message)
    } finally {
      setIsCreatingNpc(false)
    }
  }

  const submitNpcUpdate = async (event) => {
    event.preventDefault()
    if (!activeCampaign || !editingNpcId) return

    if (!npcEditForm.name.trim()) {
      setNpcEditError('El nombre del NPC es obligatorio.')
      return
    }

    setIsUpdatingNpc(true)
    setNpcEditError(null)

    try {
      const payload = {
        name: npcEditForm.name.trim(),
        disposition: npcEditForm.disposition,
        title: npcEditForm.title.trim() ? npcEditForm.title.trim() : null,
        creatureType: npcEditForm.creatureType.trim() ? npcEditForm.creatureType.trim() : null,
        scenarioId: npcEditForm.scenarioId || null,
        portraitUrl: npcEditForm.portraitUrl.trim() ? npcEditForm.portraitUrl.trim() : null,
      }

      await updateNpc(activeCampaign.id, editingNpcId, payload)
      cancelNpcEdit()
      await refetch()
    } catch (updateError) {
      const message =
        updateError.response?.data?.message ??
        updateError.message ??
        'No se pudo actualizar el NPC.'
      setNpcEditError(message)
    } finally {
      setIsUpdatingNpc(false)
    }
  }

  const submitItemUpdate = async (event) => {
    event.preventDefault()
    if (!activeCampaign || !editingItemId) return

    if (!itemForm.name.trim()) {
      setItemError('El nombre del item es obligatorio.')
      return
    }

    let parsedData = null
    if (itemForm.data.trim()) {
      try {
        parsedData = JSON.parse(itemForm.data)
      } catch (parseError) {
        setItemError('Los datos deben ser JSON valido.')
        return
      }
    }

    setIsUpdatingItem(true)
    setItemError(null)

    try {
      const payload = {
        name: itemForm.name.trim(),
        type: itemForm.type,
        scenarioId: itemForm.scenarioId || null,
        data: parsedData,
      }

      await updateItem(activeCampaign.id, editingItemId, payload)
      cancelItemEdit()
      await refetch()
    } catch (updateError) {
      const message =
        updateError.response?.data?.message ??
        updateError.message ??
        'No se pudo actualizar el item.'
      setItemError(message)
    } finally {
      setIsUpdatingItem(false)
    }
  }

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-ember">Dungeon Master Toolkit</p>
          <h1 className="font-display text-4xl text-parchment">Preparacion de campana</h1>
        </div>
        <p className="max-w-3xl text-sm text-slate-300">
          Organiza escenarios, crea NPCs y afina los detalles narrativos antes de reunirte con tu grupo. Cuando estes
          listo, puedes saltar al tablero en vivo en cualquier momento.
        </p>
        {activeCampaign?.id && (
          <Link
            to={`/session/${activeCampaign.id}/dm`}
            className="inline-flex w-full items-center justify-center rounded-full border border-emerald-400 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-400/10 sm:w-auto"
          >
            Ir al tablero en vivo
          </Link>
        )}
      </header>

      {isLoading && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
          Cargando informacion de la campana...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-400/60 bg-red-900/40 px-4 py-3 text-sm text-red-200">
          <p className="font-semibold">No pudimos obtener la campana.</p>
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

      {activeCampaign && (
        <div className="space-y-6">
          <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-lg">
            <header className="space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Herramientas de gestion</p>
              <h2 className="text-xl font-semibold text-parchment">Escenarios y NPCs</h2>
              <p className="text-sm text-slate-400">
                Agrega nuevos escenarios o aliados desde aqui. Los cambios se reflejaran automaticamente en el tablero.
              </p>
            </header>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h3 className="text-lg font-semibold text-parchment">Nuevo escenario</h3>
                <form className="space-y-4" onSubmit={submitScenario}>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="scenario-title">
                      Titulo
                    </label>
                    <input
                      id="scenario-title"
                      name="title"
                      type="text"
                      value={scenarioForm.title}
                      onChange={handleScenarioInputChange}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      placeholder="Encuentro en el bosque ancestral"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="scenario-summary">
                      Resumen
                    </label>
                    <textarea
                      id="scenario-summary"
                      name="summary"
                      rows={3}
                      value={scenarioForm.summary}
                      onChange={handleScenarioInputChange}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      placeholder="Describe el contexto general y los objetivos narrativos."
                    />
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="scenario-objective">
                      Objetivo principal
                    </label>
                    <input
                      id="scenario-objective"
                      name="objective"
                      type="text"
                      value={scenarioForm.objective}
                      onChange={handleScenarioInputChange}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      placeholder="Negociar con el consejo druida"
                    />
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="scenario-tags">
                      Etiquetas (separadas por coma)
                    </label>
                    <input
                      id="scenario-tags"
                      name="environmentTags"
                      type="text"
                      value={scenarioForm.environmentTags}
                      onChange={handleScenarioInputChange}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      placeholder="bosque, noche, ritual"
                    />
                  </div>

                  {scenarioError && <p className="text-sm text-red-300">{scenarioError}</p>}

                  <button
                    type="submit"
                    className="inline-flex rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                    disabled={isCreatingScenario}
                  >
                    {isCreatingScenario ? 'Creando...' : 'Agregar escenario'}
                  </button>
                </form>
              </section>

              <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h3 className="text-lg font-semibold text-parchment">Nuevo NPC</h3>
                <form className="space-y-4" onSubmit={submitNpc}>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="npc-name">
                      Nombre
                    </label>
                    <input
                      id="npc-name"
                      name="name"
                      type="text"
                      value={npcForm.name}
                      onChange={handleNpcInputChange}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      placeholder="Aria, guardiana del portal"
                      required
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="npc-title">
                        Rol o titulo
                      </label>
                      <input
                        id="npc-title"
                        name="title"
                        type="text"
                        value={npcForm.title}
                        onChange={handleNpcInputChange}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                        placeholder="Sabia local"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="npc-creature">
                        Tipo de criatura
                      </label>
                      <input
                        id="npc-creature"
                        name="creatureType"
                        type="text"
                        value={npcForm.creatureType}
                        onChange={handleNpcInputChange}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                        placeholder="Humano, tiefling, elemental..."
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="npc-disposition">
                        Disposicion
                      </label>
                      <select
                        id="npc-disposition"
                        name="disposition"
                        value={npcForm.disposition}
                        onChange={handleNpcInputChange}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      >
                        <option value="friendly">Aliada</option>
                        <option value="neutral">Neutral</option>
                        <option value="hostile">Hostil</option>
                        <option value="unknown">Sin definir</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="npc-scenario">
                        Escenario vinculado
                      </label>
                      <select
                        id="npc-scenario"
                        name="scenarioId"
                        value={npcForm.scenarioId}
                        onChange={handleNpcInputChange}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      >
                        <option value="">Sin asignar</option>
                        {scenarios.map((scenario) => (
                          <option key={scenario.id} value={scenario.id}>
                            {scenario.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="npc-portrait">
                      URL del retrato
                    </label>
                    <input
                      id="npc-portrait"
                      name="portraitUrl"
                      type="url"
                      value={npcForm.portraitUrl}
                      onChange={handleNpcInputChange}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      placeholder="https://..."
                    />
                  </div>

                  {npcError && <p className="text-sm text-red-300">{npcError}</p>}

                  <button
                    type="submit"
                    className="inline-flex rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                    disabled={isCreatingNpc}
                  >
                    {isCreatingNpc ? 'Creando...' : 'Agregar NPC'}
                  </button>
                </form>
              </section>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h3 className="text-sm font-semibold text-parchment">Escenarios existentes</h3>
                <div className="space-y-2">
                  {scenarios.length ? (
                    scenarios.map((scenario) => (
                      <article
                        key={scenario.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-4">
                              <h4 className="font-semibold text-parchment">{scenario.title}</h4>
                              <span className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
                                {scenario.images?.length ?? 0} imagenes
                              </span>
                            </div>
                            {scenario.summary && <p className="text-xs text-slate-400">{scenario.summary}</p>}
                            {scenario.objective && (
                              <p className="text-xs text-emerald-300/90">
                                Objetivo: <span className="text-slate-200">{scenario.objective}</span>
                              </p>
                            )}
                            {Array.isArray(scenario.environmentTags) && scenario.environmentTags.length > 0 && (
                              <p className="text-[10px] uppercase tracking-[0.35em] text-emerald-400">
                                Tags: {scenario.environmentTags.join(', ')}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => startScenarioEdit(scenario)}
                            className="self-start rounded-full border border-emerald-300/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-200 transition hover:bg-emerald-400/10"
                          >
                            {editingScenarioId === scenario.id ? 'Editando...' : 'Editar'}
                          </button>
                        </div>
                        {editingScenarioId === scenario.id && (
                          <form className="mt-3 space-y-3 border-t border-slate-800 pt-3" onSubmit={submitScenarioUpdate}>
                            <div>
                              <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`edit-scenario-title-${scenario.id}`}>
                                Titulo
                              </label>
                              <input
                                id={`edit-scenario-title-${scenario.id}`}
                                name="title"
                                type="text"
                                value={scenarioEditForm.title}
                                onChange={handleScenarioEditInputChange}
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`edit-scenario-summary-${scenario.id}`}>
                                Resumen
                              </label>
                              <textarea
                                id={`edit-scenario-summary-${scenario.id}`}
                                name="summary"
                                rows={3}
                                value={scenarioEditForm.summary}
                                onChange={handleScenarioEditInputChange}
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                              />
                            </div>
                            <div>
                              <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`edit-scenario-objective-${scenario.id}`}>
                                Objetivo principal
                              </label>
                              <input
                                id={`edit-scenario-objective-${scenario.id}`}
                                name="objective"
                                type="text"
                                value={scenarioEditForm.objective}
                                onChange={handleScenarioEditInputChange}
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                              />
                            </div>
                            <div>
                              <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`edit-scenario-tags-${scenario.id}`}>
                                Etiquetas (separadas por coma)
                              </label>
                              <input
                                id={`edit-scenario-tags-${scenario.id}`}
                                name="environmentTags"
                                type="text"
                                value={scenarioEditForm.environmentTags}
                                onChange={handleScenarioEditInputChange}
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                              />
                            </div>
                            {scenarioEditError && <p className="text-xs text-red-300">{scenarioEditError}</p>}
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="submit"
                                className="inline-flex rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                                disabled={isUpdatingScenario}
                              >
                                {isUpdatingScenario ? 'Guardando...' : 'Guardar cambios'}
                              </button>
                              <button
                                type="button"
                                onClick={cancelScenarioEdit}
                                className="inline-flex rounded-full border border-slate-600 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200"
                              >
                                Cancelar
                              </button>
                            </div>
                          </form>
                        )}
                      </article>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">Todavia no hay escenarios registrados.</p>
                  )}
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h3 className="text-sm font-semibold text-parchment">NPCs existentes</h3>
                <div className="space-y-2">
                  {allNpcs.length ? (
                    allNpcs.map((npc) => (
                      <article
                        key={npc.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
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
                              <p className="text-[10px] uppercase tracking-[0.35em] text-ember">
                                Escenario: {scenarioLookup[npc.scenarioId] ?? 'Sin coincidencia'}
                              </p>
                            )}
                            {npc.creatureType && <p className="text-xs text-slate-400">Tipo: {npc.creatureType}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={() => startNpcEdit(npc)}
                            className="self-start rounded-full border border-emerald-300/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-200 transition hover:bg-emerald-400/10"
                          >
                            {editingNpcId === npc.id ? 'Editando...' : 'Editar'}
                          </button>
                        </div>
                        {editingNpcId === npc.id && (
                          <form className="mt-3 space-y-3 border-t border-slate-800 pt-3" onSubmit={submitNpcUpdate}>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`edit-npc-name-${npc.id}`}>
                                  Nombre
                                </label>
                                <input
                                  id={`edit-npc-name-${npc.id}`}
                                  name="name"
                                  type="text"
                                  value={npcEditForm.name}
                                  onChange={handleNpcEditInputChange}
                                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                  required
                                />
                              </div>
                              <div>
                                <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`edit-npc-title-${npc.id}`}>
                                  Rol o titulo
                                </label>
                                <input
                                  id={`edit-npc-title-${npc.id}`}
                                  name="title"
                                  type="text"
                                  value={npcEditForm.title}
                                  onChange={handleNpcEditInputChange}
                                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                />
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`edit-npc-creature-${npc.id}`}>
                                  Tipo de criatura
                                </label>
                                <input
                                  id={`edit-npc-creature-${npc.id}`}
                                  name="creatureType"
                                  type="text"
                                  value={npcEditForm.creatureType}
                                  onChange={handleNpcEditInputChange}
                                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                />
                              </div>
                              <div>
                                <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`edit-npc-disposition-${npc.id}`}>
                                  Disposicion
                                </label>
                                <select
                                  id={`edit-npc-disposition-${npc.id}`}
                                  name="disposition"
                                  value={npcEditForm.disposition}
                                  onChange={handleNpcEditInputChange}
                                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                >
                                  <option value="friendly">Aliada</option>
                                  <option value="neutral">Neutral</option>
                                  <option value="hostile">Hostil</option>
                                  <option value="unknown">Sin definir</option>
                                </select>
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`edit-npc-scenario-${npc.id}`}>
                                  Escenario vinculado
                                </label>
                                <select
                                  id={`edit-npc-scenario-${npc.id}`}
                                  name="scenarioId"
                                  value={npcEditForm.scenarioId}
                                  onChange={handleNpcEditInputChange}
                                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                >
                                  <option value="">Sin asignar</option>
                                  {scenarios.map((scenario) => (
                                    <option key={scenario.id} value={scenario.id}>
                                      {scenario.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`edit-npc-portrait-${npc.id}`}>
                                  URL del retrato
                                </label>
                                <input
                                  id={`edit-npc-portrait-${npc.id}`}
                                  name="portraitUrl"
                                  type="url"
                                  value={npcEditForm.portraitUrl}
                                  onChange={handleNpcEditInputChange}
                                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                />
                              </div>
                            </div>
                            {npcEditError && <p className="text-xs text-red-300">{npcEditError}</p>}
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="submit"
                                className="inline-flex rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                                disabled={isUpdatingNpc}
                              >
                                {isUpdatingNpc ? 'Guardando...' : 'Guardar cambios'}
                              </button>
                              <button
                                type="button"
                                onClick={cancelNpcEdit}
                                className="inline-flex rounded-full border border-slate-600 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200"
                              >
                                Cancelar
                              </button>
                            </div>
                          </form>
                        )}
                      </article>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">Todavia no hay NPCs registrados.</p>
                  )}
                </div>
              </section>
            </div>
          </section>
          <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-lg">
            <header className="space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Recursos y botin</p>
              <h2 className="text-xl font-semibold text-parchment">Inventario de la campana</h2>
              <p className="text-sm text-slate-400">
                Ajusta los objetos clave, reasignalos a escenas especificas y actualiza sus detalles sin salir de la
                herramienta de preparacion.
              </p>
            </header>

            <div className="space-y-3">
              {items.length ? (
                items.map((item) => {
                  const rawPreview = item.data ? JSON.stringify(item.data) : ''
                  const preview = rawPreview.length > 160 ? `${rawPreview.slice(0, 157)}...` : rawPreview

                  return (
                    <article
                      key={item.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <h4 className="font-semibold text-parchment">{item.name}</h4>
                              <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
                                {itemTypeLabels[item.type] ?? item.type}
                              </p>
                            </div>
                            <span className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
                              {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                            </span>
                          </div>
                          {item.scenarioId && (
                            <p className="text-[10px] uppercase tracking-[0.35em] text-emerald-300">
                              Escenario: {scenarioLookup[item.scenarioId] ?? 'Sin coincidencia'}
                            </p>
                          )}
                          {preview && (
                            <p className="text-xs text-slate-400">
                              Datos: <span className="break-all text-slate-300">{preview}</span>
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => startItemEdit(item)}
                          className="self-start rounded-full border border-emerald-300/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-200 transition hover:bg-emerald-400/10"
                        >
                          {editingItemId === item.id ? 'Editando...' : 'Editar'}
                        </button>
                      </div>
                      {editingItemId === item.id && (
                        <form className="mt-3 space-y-3 border-t border-slate-800 pt-3" onSubmit={submitItemUpdate}>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`edit-item-name-${item.id}`}>
                                Nombre
                              </label>
                              <input
                                id={`edit-item-name-${item.id}`}
                                name="name"
                                type="text"
                                value={itemForm.name}
                                onChange={handleItemInputChange}
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`edit-item-type-${item.id}`}>
                                Tipo
                              </label>
                              <select
                                id={`edit-item-type-${item.id}`}
                                name="type"
                                value={itemForm.type}
                                onChange={handleItemInputChange}
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                              >
                                {Object.entries(itemTypeLabels).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`edit-item-scenario-${item.id}`}>
                              Escenario vinculado
                            </label>
                            <select
                              id={`edit-item-scenario-${item.id}`}
                              name="scenarioId"
                              value={itemForm.scenarioId}
                              onChange={handleItemInputChange}
                              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                            >
                              <option value="">Sin asignar</option>
                              {scenarios.map((scenario) => (
                                <option key={scenario.id} value={scenario.id}>
                                  {scenario.title}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`edit-item-data-${item.id}`}>
                              Datos adicionales (JSON)
                            </label>
                            <textarea
                              id={`edit-item-data-${item.id}`}
                              name="data"
                              rows={4}
                              value={itemForm.data}
                              onChange={handleItemInputChange}
                              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                              placeholder={'{"descripcion": "Pocion brillante"}'}
                            />
                          </div>
                          {itemError && <p className="text-xs text-red-300">{itemError}</p>}
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="submit"
                              className="inline-flex rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                              disabled={isUpdatingItem}
                            >
                              {isUpdatingItem ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelItemEdit}
                              className="inline-flex rounded-full border border-slate-600 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200"
                            >
                              Cancelar
                            </button>
                          </div>
                        </form>
                      )}
                    </article>
                  )
                })
              ) : (
                <p className="text-xs text-slate-400">Todavia no hay objetos registrados.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export default DMToolsPage
