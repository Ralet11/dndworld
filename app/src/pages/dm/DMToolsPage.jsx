// app/src/pages/dm/DMToolsPage.jsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  createCampaign,
  updateCampaign,
  createScenario,
  updateScenario,
  deleteScenario,
  createNpc,
  updateNpc,
  deleteNpc,
  getCampaignItems,
  createItem,
  updateItem,
} from '../../api/campaigns'
import { useCampaignList } from '../../hooks/useCampaignList'
import { useCampaignSession } from '../../hooks/useCampaignSession'

const scenarioInitialState = {
  title: '',
  summary: '',
  objective: '',
  environmentTags: '',
}

const npcInitialState = {
  name: '',
  title: '',
  creatureType: '',
  disposition: 'unknown',
  scenarioId: '',
  portraitUrl: '',
}

const campaignInitialState = {
  name: '',
  description: '',
  status: 'draft',
}

const itemInitialState = {
  name: '',
  type: 'misc',
  scenarioId: '',
  description: '',
}

const TABS = [
  { id: 'campaigns', label: 'Campañas' },
  { id: 'scenarios', label: 'Escenarios' },
  { id: 'npcs', label: 'NPCs' },
  { id: 'items', label: 'Objetos' },
]

const normalizeTagsInput = (value) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

const formatTagsForInput = (tags) => {
  if (!tags) return ''
  if (Array.isArray(tags)) return tags.join(', ')
  if (typeof tags === 'string') return tags
  return ''
}

const buildScenarioPayload = (form) => {
  const payload = { title: form.title.trim() }

  if (form.summary.trim()) payload.summary = form.summary.trim()
  if (form.objective.trim()) payload.objective = form.objective.trim()

  if (form.environmentTags.trim()) {
    const tags = normalizeTagsInput(form.environmentTags)
    if (tags.length) payload.environmentTags = tags
  }

  return payload
}

const buildNpcPayload = (form) => {
  const payload = {
    name: form.name.trim(),
    disposition: form.disposition,
  }

  if (form.title.trim()) payload.title = form.title.trim()
  if (form.creatureType.trim()) payload.creatureType = form.creatureType.trim()
  if (form.scenarioId) payload.scenarioId = form.scenarioId
  if (form.portraitUrl.trim()) payload.portraitUrl = form.portraitUrl.trim()

  return payload
}

const buildItemPayload = (form) => {
  const payload = {
    name: form.name.trim(),
    type: form.type,
  }

  if (form.scenarioId) payload.scenarioId = form.scenarioId

  const description = form.description.trim()
  if (description) {
    payload.data = { description }
  }

  return payload
}

const DMToolsPage = () => {
  const { campaignId } = useParams()
  const { campaign: activeCampaign, isLoading, error, refetch } = useCampaignSession(campaignId, { role: 'dm' })
  const {
    campaigns,
    isLoading: isLoadingCampaigns,
    error: campaignsError,
    refetch: refetchCampaigns,
  } = useCampaignList()

  const [activeTab, setActiveTab] = useState(TABS[0].id)

  const [campaignForm, setCampaignForm] = useState(campaignInitialState)
  const [campaignError, setCampaignError] = useState(null)
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false)
  const [editingCampaignId, setEditingCampaignId] = useState(null)
  const [campaignEditForm, setCampaignEditForm] = useState(campaignInitialState)
  const [campaignEditError, setCampaignEditError] = useState(null)
  const [isUpdatingCampaign, setIsUpdatingCampaign] = useState(false)

  const [scenarioForm, setScenarioForm] = useState(scenarioInitialState)
  const [scenarioError, setScenarioError] = useState(null)
  const [isCreatingScenario, setIsCreatingScenario] = useState(false)
  const [editingScenarioId, setEditingScenarioId] = useState(null)
  const [scenarioEditForm, setScenarioEditForm] = useState(scenarioInitialState)
  const [scenarioEditError, setScenarioEditError] = useState(null)
  const [isUpdatingScenario, setIsUpdatingScenario] = useState(false)
  const [deletingScenarioId, setDeletingScenarioId] = useState(null)
  const [scenarioDeleteError, setScenarioDeleteError] = useState(null)

  const [npcForm, setNpcForm] = useState(npcInitialState)
  const [npcError, setNpcError] = useState(null)
  const [isCreatingNpc, setIsCreatingNpc] = useState(false)
  const [editingNpcId, setEditingNpcId] = useState(null)
  const [npcEditForm, setNpcEditForm] = useState(npcInitialState)
  const [npcEditError, setNpcEditError] = useState(null)
  const [isUpdatingNpc, setIsUpdatingNpc] = useState(false)
  const [deletingNpcId, setDeletingNpcId] = useState(null)
  const [npcDeleteError, setNpcDeleteError] = useState(null)

  const [items, setItems] = useState([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [itemsError, setItemsError] = useState(null)
  const [itemForm, setItemForm] = useState(itemInitialState)
  const [itemError, setItemError] = useState(null)
  const [isCreatingItem, setIsCreatingItem] = useState(false)
  const [editingItemId, setEditingItemId] = useState(null)
  const [itemEditForm, setItemEditForm] = useState(itemInitialState)
  const [itemEditError, setItemEditError] = useState(null)
  const [isUpdatingItem, setIsUpdatingItem] = useState(false)

  const scenarios = activeCampaign?.scenarios ?? []
  const allNpcs = activeCampaign?.npcs ?? []

  const scenarioLookup = useMemo(() => {
    const entries = scenarios.map((scenario) => [scenario.id, scenario.title])
    return Object.fromEntries(entries)
  }, [scenarios])

  const dmCampaigns = useMemo(() => {
    if (!campaigns?.length) return []
    const dmId = activeCampaign?.dm?.id ?? activeCampaign?.dmId ?? null
    if (!dmId) return campaigns
    return campaigns.filter((campaign) => campaign.dmId === dmId || campaign.dm?.id === dmId)
  }, [campaigns, activeCampaign])

  const loadItems = useCallback(async () => {
    if (!campaignId) return []
    setIsLoadingItems(true)
    setItemsError(null)

    try {
      const data = await getCampaignItems(campaignId)
      setItems(data)
      return data
    } catch (fetchError) {
      setItemsError(fetchError)
      return []
    } finally {
      setIsLoadingItems(false)
    }
  }, [campaignId])

  useEffect(() => {
    if (!campaignId) return
    loadItems()
  }, [campaignId, loadItems])

  const handleCampaignFieldChange = (event) => {
    const { name, value } = event.target
    setCampaignForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleCampaignEditFieldChange = (event) => {
    const { name, value } = event.target
    setCampaignEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreateCampaign = async (event) => {
    event.preventDefault()

    if (!campaignForm.name.trim()) {
      setCampaignError('El nombre de la campaña es obligatorio.')
      return
    }

    setIsCreatingCampaign(true)
    setCampaignError(null)

    try {
      const payload = {
        name: campaignForm.name.trim(),
        status: campaignForm.status,
      }

      if (campaignForm.description.trim()) {
        payload.description = campaignForm.description.trim()
      }

      await createCampaign(payload)
      setCampaignForm(campaignInitialState)
      await refetchCampaigns()
    } catch (creationError) {
      const message =
        creationError.response?.data?.message ??
        creationError.message ??
        'No se pudo crear la campaña.'
      setCampaignError(message)
    } finally {
      setIsCreatingCampaign(false)
    }
  }

  const startEditingCampaign = (campaign) => {
    setEditingCampaignId(campaign.id)
    setCampaignEditForm({
      name: campaign.name ?? '',
      description: campaign.description ?? '',
      status: campaign.status ?? 'draft',
    })
    setCampaignEditError(null)
  }

  const cancelCampaignEdit = () => {
    setEditingCampaignId(null)
    setCampaignEditForm(campaignInitialState)
    setCampaignEditError(null)
  }

  const submitCampaignEdit = async (event) => {
    event.preventDefault()
    if (!editingCampaignId) return

    if (!campaignEditForm.name.trim()) {
      setCampaignEditError('El nombre de la campaña es obligatorio.')
      return
    }

    setIsUpdatingCampaign(true)
    setCampaignEditError(null)

    try {
      const payload = {
        name: campaignEditForm.name.trim(),
        status: campaignEditForm.status,
      }

      if (campaignEditForm.description.trim()) {
        payload.description = campaignEditForm.description.trim()
      } else {
        payload.description = ''
      }

      await updateCampaign(editingCampaignId, payload)
      await refetchCampaigns()
      if (editingCampaignId === activeCampaign?.id) {
        await refetch()
      }
      cancelCampaignEdit()
    } catch (updateError) {
      const message =
        updateError.response?.data?.message ??
        updateError.message ??
        'No se pudo actualizar la campaña.'
      setCampaignEditError(message)
    } finally {
      setIsUpdatingCampaign(false)
    }
  }

  const handleScenarioInputChange = (event) => {
    const { name, value } = event.target
    setScenarioForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleScenarioEditInputChange = (event) => {
    const { name, value } = event.target
    setScenarioEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const submitScenario = async (event) => {
    event.preventDefault()
    if (!activeCampaign) return

    if (!scenarioForm.title.trim()) {
      setScenarioError('El título del escenario es obligatorio.')
      return
    }

    setIsCreatingScenario(true)
    setScenarioError(null)

    try {
      const payload = buildScenarioPayload(scenarioForm)
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

  const startScenarioEdit = (scenario) => {
    setEditingScenarioId(scenario.id)
    setScenarioEditForm({
      title: scenario.title ?? '',
      summary: scenario.summary ?? '',
      objective: scenario.objective ?? '',
      environmentTags: formatTagsForInput(scenario.environmentTags),
    })
    setScenarioEditError(null)
  }

  const cancelScenarioEdit = () => {
    setEditingScenarioId(null)
    setScenarioEditForm(scenarioInitialState)
    setScenarioEditError(null)
  }

  const submitScenarioEdit = async (event) => {
    event.preventDefault()
    if (!activeCampaign || !editingScenarioId) return

    if (!scenarioEditForm.title.trim()) {
      setScenarioEditError('El título del escenario es obligatorio.')
      return
    }

    setIsUpdatingScenario(true)
    setScenarioEditError(null)

    try {
      const payload = buildScenarioPayload(scenarioEditForm)
      await updateScenario(activeCampaign.id, editingScenarioId, payload)
      await refetch()
      cancelScenarioEdit()
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

  const handleDeleteScenario = async (scenarioId) => {
    if (!activeCampaign) return
    setDeletingScenarioId(scenarioId)
    setScenarioDeleteError(null)

    try {
      await deleteScenario(activeCampaign.id, scenarioId)
      await refetch()
    } catch (deleteError) {
      const message =
        deleteError.response?.data?.message ??
        deleteError.message ??
        'No se pudo eliminar el escenario.'
      setScenarioDeleteError(message)
    } finally {
      setDeletingScenarioId(null)
    }
  }

  const handleNpcInputChange = (event) => {
    const { name, value } = event.target
    setNpcForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleNpcEditInputChange = (event) => {
    const { name, value } = event.target
    setNpcEditForm((prev) => ({ ...prev, [name]: value }))
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
      const payload = buildNpcPayload(npcForm)
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
    setNpcEditForm(npcInitialState)
    setNpcEditError(null)
  }

  const submitNpcEdit = async (event) => {
    event.preventDefault()
    if (!activeCampaign || !editingNpcId) return

    if (!npcEditForm.name.trim()) {
      setNpcEditError('El nombre del NPC es obligatorio.')
      return
    }

    setIsUpdatingNpc(true)
    setNpcEditError(null)

    try {
      const payload = buildNpcPayload(npcEditForm)
      await updateNpc(activeCampaign.id, editingNpcId, payload)
      await refetch()
      cancelNpcEdit()
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

  const handleDeleteNpc = async (npcId) => {
    if (!activeCampaign) return
    setDeletingNpcId(npcId)
    setNpcDeleteError(null)

    try {
      await deleteNpc(activeCampaign.id, npcId)
      await refetch()
    } catch (deleteError) {
      const message =
        deleteError.response?.data?.message ??
        deleteError.message ??
        'No se pudo eliminar el NPC.'
      setNpcDeleteError(message)
    } finally {
      setDeletingNpcId(null)
    }
  }

  const handleItemInputChange = (event) => {
    const { name, value } = event.target
    setItemForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleItemEditInputChange = (event) => {
    const { name, value } = event.target
    setItemEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const submitItem = async (event) => {
    event.preventDefault()
    if (!activeCampaign) return

    if (!itemForm.name.trim()) {
      setItemError('El nombre del objeto es obligatorio.')
      return
    }

    setIsCreatingItem(true)
    setItemError(null)

    try {
      const payload = buildItemPayload(itemForm)
      await createItem(activeCampaign.id, payload)
      setItemForm(itemInitialState)
      await loadItems()
      await refetch()
    } catch (creationError) {
      const message =
        creationError.response?.data?.message ??
        creationError.message ??
        'No se pudo crear el objeto.'
      setItemError(message)
    } finally {
      setIsCreatingItem(false)
    }
  }

  const startItemEdit = (item) => {
    setEditingItemId(item.id)
    setItemEditForm({
      name: item.name ?? '',
      type: item.type ?? 'misc',
      scenarioId: item.scenarioId ?? '',
      description:
        (typeof item.data?.description === 'string' && item.data.description) ||
        (typeof item.data?.notes === 'string' && item.data.notes) ||
        '',
    })
    setItemEditError(null)
  }

  const cancelItemEdit = () => {
    setEditingItemId(null)
    setItemEditForm(itemInitialState)
    setItemEditError(null)
  }

  const submitItemEdit = async (event) => {
    event.preventDefault()
    if (!activeCampaign || !editingItemId) return

    if (!itemEditForm.name.trim()) {
      setItemEditError('El nombre del objeto es obligatorio.')
      return
    }

    setIsUpdatingItem(true)
    setItemEditError(null)

    try {
      const payload = buildItemPayload(itemEditForm)
      await updateItem(activeCampaign.id, editingItemId, payload)
      await loadItems()
      await refetch()
      cancelItemEdit()
    } catch (updateError) {
      const message =
        updateError.response?.data?.message ??
        updateError.message ??
        'No se pudo actualizar el objeto.'
      setItemEditError(message)
    } finally {
      setIsUpdatingItem(false)
    }
  }

  const renderCampaignsTab = () => (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold text-parchment">Crear nueva campaña</h2>
        <p className="mt-1 text-sm text-slate-400">
          Define el nombre y estado inicial. Puedes actualizar detalles avanzados más tarde.
        </p>

        <form className="mt-4 space-y-4" onSubmit={handleCreateCampaign}>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="campaign-name">
              Nombre
            </label>
            <input
              id="campaign-name"
              name="name"
              type="text"
              value={campaignForm.name}
              onChange={handleCampaignFieldChange}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              placeholder="Campaña de ejemplo"
              required
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="campaign-description">
              Descripción
            </label>
            <textarea
              id="campaign-description"
              name="description"
              rows={3}
              value={campaignForm.description}
              onChange={handleCampaignFieldChange}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              placeholder="Un resumen rápido de la aventura."
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="campaign-status">
              Estado
            </label>
            <select
              id="campaign-status"
              name="status"
              value={campaignForm.status}
              onChange={handleCampaignFieldChange}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            >
              <option value="draft">Borrador</option>
              <option value="active">Activa</option>
              <option value="archived">Archivada</option>
            </select>
          </div>

          {campaignError && <p className="text-sm text-red-300">{campaignError}</p>}

          <button
            type="submit"
            className="inline-flex rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
            disabled={isCreatingCampaign}
          >
            {isCreatingCampaign ? 'Creando...' : 'Crear campaña'}
          </button>
        </form>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-parchment">Campañas dirigidas</h3>
            <p className="text-sm text-slate-400">
              Administra las campañas bajo tu control. Actualiza sus detalles cuando sea necesario.
            </p>
          </div>
          <button
            type="button"
            onClick={refetchCampaigns}
            className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200"
          >
            Recargar
          </button>
        </header>

        {campaignsError && (
          <p className="rounded-lg border border-red-400/60 bg-red-900/40 px-3 py-2 text-sm text-red-200">
            {campaignsError.message ?? 'No se pudo obtener la lista de campañas.'}
          </p>
        )}

        {isLoadingCampaigns && <p className="text-sm text-slate-400">Cargando campañas...</p>}

        {!isLoadingCampaigns && dmCampaigns.length === 0 && (
          <p className="text-sm text-slate-400">Todavía no tienes campañas asignadas como DM.</p>
        )}

        <div className="space-y-4">
          {dmCampaigns.map((campaign) => (
            <article
              key={campaign.id}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 shadow-lg shadow-slate-950/40"
            >
              {editingCampaignId === campaign.id ? (
                <form className="space-y-4" onSubmit={submitCampaignEdit}>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`campaign-edit-name-${campaign.id}`}>
                      Nombre
                    </label>
                    <input
                      id={`campaign-edit-name-${campaign.id}`}
                      name="name"
                      type="text"
                      value={campaignEditForm.name}
                      onChange={handleCampaignEditFieldChange}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`campaign-edit-description-${campaign.id}`}>
                      Descripción
                    </label>
                    <textarea
                      id={`campaign-edit-description-${campaign.id}`}
                      name="description"
                      rows={3}
                      value={campaignEditForm.description}
                      onChange={handleCampaignEditFieldChange}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`campaign-edit-status-${campaign.id}`}>
                      Estado
                    </label>
                    <select
                      id={`campaign-edit-status-${campaign.id}`}
                      name="status"
                      value={campaignEditForm.status}
                      onChange={handleCampaignEditFieldChange}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    >
                      <option value="draft">Borrador</option>
                      <option value="active">Activa</option>
                      <option value="archived">Archivada</option>
                    </select>
                  </div>

                  {campaignEditError && <p className="text-sm text-red-300">{campaignEditError}</p>}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      className="inline-flex rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                      disabled={isUpdatingCampaign}
                    >
                      {isUpdatingCampaign ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelCampaignEdit}
                      className="inline-flex rounded-full border border-slate-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-semibold text-parchment">{campaign.name}</h4>
                      {campaign.description && <p className="text-sm text-slate-400">{campaign.description}</p>}
                    </div>
                    <span className="rounded-full border border-slate-700 px-3 py-1 text-[10px] uppercase tracking-[0.35em] text-slate-300">
                      {campaign.status ?? 'desconocido'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>{campaign.scenarios?.length ?? 0} escenarios</span>
                    <span>{campaign.npcs?.length ?? 0} NPCs</span>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => startEditingCampaign(campaign)}
                      className="inline-flex rounded-full border border-slate-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200"
                    >
                      Editar campaña
                    </button>
                    {campaign.id === activeCampaign?.id && (
                      <Link
                        to={`/session/${campaign.id}/dm`}
                        className="inline-flex rounded-full border border-emerald-400 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200 transition hover:bg-emerald-400/10"
                      >
                        Ir al tablero en vivo
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  )

  const renderScenariosTab = () => (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h3 className="text-lg font-semibold text-parchment">Nuevo escenario</h3>
        <form className="space-y-4" onSubmit={submitScenario}>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="scenario-title">
              Título
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

      {scenarioDeleteError && (
        <p className="rounded-lg border border-red-400/60 bg-red-900/40 px-3 py-2 text-sm text-red-200">{scenarioDeleteError}</p>
      )}

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h3 className="text-sm font-semibold text-parchment">Escenarios existentes</h3>
        <div className="space-y-3">
          {scenarios.length ? (
            scenarios.map((scenario) => (
              <article
                key={scenario.id}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200"
              >
                {editingScenarioId === scenario.id ? (
                  <form className="space-y-3" onSubmit={submitScenarioEdit}>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`scenario-edit-title-${scenario.id}`}>
                        Título
                      </label>
                      <input
                        id={`scenario-edit-title-${scenario.id}`}
                        name="title"
                        type="text"
                        value={scenarioEditForm.title}
                        onChange={handleScenarioEditInputChange}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`scenario-edit-summary-${scenario.id}`}>
                        Resumen
                      </label>
                      <textarea
                        id={`scenario-edit-summary-${scenario.id}`}
                        name="summary"
                        rows={3}
                        value={scenarioEditForm.summary}
                        onChange={handleScenarioEditInputChange}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`scenario-edit-objective-${scenario.id}`}>
                        Objetivo principal
                      </label>
                      <input
                        id={`scenario-edit-objective-${scenario.id}`}
                        name="objective"
                        type="text"
                        value={scenarioEditForm.objective}
                        onChange={handleScenarioEditInputChange}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`scenario-edit-tags-${scenario.id}`}>
                        Etiquetas
                      </label>
                      <input
                        id={`scenario-edit-tags-${scenario.id}`}
                        name="environmentTags"
                        type="text"
                        value={scenarioEditForm.environmentTags}
                        onChange={handleScenarioEditInputChange}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </div>

                    {scenarioEditError && <p className="text-sm text-red-300">{scenarioEditError}</p>}

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        className="inline-flex rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                        disabled={isUpdatingScenario}
                      >
                        {isUpdatingScenario ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelScenarioEdit}
                        className="inline-flex rounded-full border border-slate-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <h4 className="font-semibold text-parchment">{scenario.title}</h4>
                      <span className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
                        {(scenario.images?.length ?? 0)} imágenes
                      </span>
                    </div>
                    {scenario.summary && <p className="text-xs text-slate-400">{scenario.summary}</p>}
                    {scenario.environmentTags?.length > 0 && (
                      <p className="text-[10px] uppercase tracking-[0.35em] text-emerald-300">
                        Etiquetas: {scenario.environmentTags.join(', ')}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => startScenarioEdit(scenario)}
                        className="inline-flex rounded-full border border-slate-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteScenario(scenario.id)}
                        className="inline-flex rounded-full border border-red-500/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:border-red-500/40 disabled:text-red-300/60"
                        disabled={deletingScenarioId === scenario.id}
                      >
                        {deletingScenarioId === scenario.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))
          ) : (
            <p className="text-xs text-slate-400">Todavía no hay escenarios registrados.</p>
          )}
        </div>
      </section>
    </div>
  )

  const renderNpcsTab = () => (
    <div className="space-y-6">
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
                Rol o título
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
                Disposición
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

      {npcDeleteError && (
        <p className="rounded-lg border border-red-400/60 bg-red-900/40 px-3 py-2 text-sm text-red-200">{npcDeleteError}</p>
      )}

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h3 className="text-sm font-semibold text-parchment">NPCs existentes</h3>
        <div className="space-y-3">
          {allNpcs.length ? (
            allNpcs.map((npc) => (
              <article
                key={npc.id}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200"
              >
                {editingNpcId === npc.id ? (
                  <form className="space-y-3" onSubmit={submitNpcEdit}>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`npc-edit-name-${npc.id}`}>
                        Nombre
                      </label>
                      <input
                        id={`npc-edit-name-${npc.id}`}
                        name="name"
                        type="text"
                        value={npcEditForm.name}
                        onChange={handleNpcEditInputChange}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                        required
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`npc-edit-title-${npc.id}`}>
                          Rol o título
                        </label>
                        <input
                          id={`npc-edit-title-${npc.id}`}
                          name="title"
                          type="text"
                          value={npcEditForm.title}
                          onChange={handleNpcEditInputChange}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`npc-edit-creature-${npc.id}`}>
                          Tipo de criatura
                        </label>
                        <input
                          id={`npc-edit-creature-${npc.id}`}
                          name="creatureType"
                          type="text"
                          value={npcEditForm.creatureType}
                          onChange={handleNpcEditInputChange}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`npc-edit-disposition-${npc.id}`}>
                          Disposición
                        </label>
                        <select
                          id={`npc-edit-disposition-${npc.id}`}
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
                      <div>
                        <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`npc-edit-scenario-${npc.id}`}>
                          Escenario vinculado
                        </label>
                        <select
                          id={`npc-edit-scenario-${npc.id}`}
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
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`npc-edit-portrait-${npc.id}`}>
                        URL del retrato
                      </label>
                      <input
                        id={`npc-edit-portrait-${npc.id}`}
                        name="portraitUrl"
                        type="url"
                        value={npcEditForm.portraitUrl}
                        onChange={handleNpcEditInputChange}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </div>

                    {npcEditError && <p className="text-sm text-red-300">{npcEditError}</p>}

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        className="inline-flex rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                        disabled={isUpdatingNpc}
                      >
                        {isUpdatingNpc ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelNpcEdit}
                        className="inline-flex rounded-full border border-slate-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="font-semibold text-parchment">{npc.name}</h4>
                        {npc.title && <p className="text-xs text-slate-400">{npc.title}</p>}
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.35em] text-slate-500">{npc.disposition}</span>
                    </div>
                    {npc.scenarioId && (
                      <p className="text-[10px] uppercase tracking-[0.35em] text-emerald-300">
                        Escenario: {scenarioLookup[npc.scenarioId] ?? 'Sin coincidencia'}
                      </p>
                    )}
                    {npc.creatureType && <p className="text-xs text-slate-400">Tipo: {npc.creatureType}</p>}
                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => startNpcEdit(npc)}
                        className="inline-flex rounded-full border border-slate-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteNpc(npc.id)}
                        className="inline-flex rounded-full border border-red-500/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:border-red-500/40 disabled:text-red-300/60"
                        disabled={deletingNpcId === npc.id}
                      >
                        {deletingNpcId === npc.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))
          ) : (
            <p className="text-xs text-slate-400">Todavía no hay NPCs registrados.</p>
          )}
        </div>
      </section>
    </div>
  )

  const renderItemsTab = () => (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h3 className="text-lg font-semibold text-parchment">Nuevo objeto</h3>
        <form className="space-y-4" onSubmit={submitItem}>
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="item-name">
              Nombre
            </label>
            <input
              id="item-name"
              name="name"
              type="text"
              value={itemForm.name}
              onChange={handleItemInputChange}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              placeholder="Frasco misterioso"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="item-type">
                Tipo
              </label>
              <select
                id="item-type"
                name="type"
                value={itemForm.type}
                onChange={handleItemInputChange}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              >
                <option value="misc">Misceláneo</option>
                <option value="consumable">Consumible</option>
                <option value="weapon">Arma</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="item-scenario">
                Escenario asociado
              </label>
              <select
                id="item-scenario"
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
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="item-description">
              Descripción
            </label>
            <textarea
              id="item-description"
              name="description"
              rows={3}
              value={itemForm.description}
              onChange={handleItemInputChange}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              placeholder="Notas o efectos especiales del objeto."
            />
          </div>

          {itemError && <p className="text-sm text-red-300">{itemError}</p>}

          <button
            type="submit"
            className="inline-flex rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
            disabled={isCreatingItem}
          >
            {isCreatingItem ? 'Creando...' : 'Agregar objeto'}
          </button>
        </form>
      </section>

      {itemsError && (
        <p className="rounded-lg border border-red-400/60 bg-red-900/40 px-3 py-2 text-sm text-red-200">
          {itemsError.message ?? 'No se pudieron obtener los objetos.'}
        </p>
      )}

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-parchment">Objetos registrados</h3>
          <button
            type="button"
            onClick={loadItems}
            className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200"
          >
            Recargar
          </button>
        </div>

        {isLoadingItems && <p className="text-xs text-slate-400">Cargando objetos...</p>}

        <div className="space-y-3">
          {!isLoadingItems && items.length === 0 ? (
            <p className="text-xs text-slate-400">Todavía no hay objetos registrados.</p>
          ) : (
            items.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200"
              >
                {editingItemId === item.id ? (
                  <form className="space-y-3" onSubmit={submitItemEdit}>
                    <div>
                      <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`item-edit-name-${item.id}`}>
                        Nombre
                      </label>
                      <input
                        id={`item-edit-name-${item.id}`}
                        name="name"
                        type="text"
                        value={itemEditForm.name}
                        onChange={handleItemEditInputChange}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                        required
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`item-edit-type-${item.id}`}>
                          Tipo
                        </label>
                        <select
                          id={`item-edit-type-${item.id}`}
                          name="type"
                          value={itemEditForm.type}
                          onChange={handleItemEditInputChange}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                        >
                          <option value="misc">Misceláneo</option>
                          <option value="consumable">Consumible</option>
                          <option value="weapon">Arma</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`item-edit-scenario-${item.id}`}>
                          Escenario asociado
                        </label>
                        <select
                          id={`item-edit-scenario-${item.id}`}
                          name="scenarioId"
                          value={itemEditForm.scenarioId}
                          onChange={handleItemEditInputChange}
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
                      <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor={`item-edit-description-${item.id}`}>
                        Descripción
                      </label>
                      <textarea
                        id={`item-edit-description-${item.id}`}
                        name="description"
                        rows={3}
                        value={itemEditForm.description}
                        onChange={handleItemEditInputChange}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                      />
                    </div>

                    {itemEditError && <p className="text-sm text-red-300">{itemEditError}</p>}

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        className="inline-flex rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                        disabled={isUpdatingItem}
                      >
                        {isUpdatingItem ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelItemEdit}
                        className="inline-flex rounded-full border border-slate-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="font-semibold text-parchment">{item.name}</h4>
                        <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">{item.type}</p>
                      </div>
                      {item.scenarioId && (
                        <span className="text-[10px] uppercase tracking-[0.35em] text-emerald-300">
                          Escenario: {scenarioLookup[item.scenarioId] ?? 'Sin coincidencia'}
                        </span>
                      )}
                    </div>
                    {item.data?.description && <p className="text-xs text-slate-400">{item.data.description}</p>}
                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => startItemEdit(item)}
                        className="inline-flex rounded-full border border-slate-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  )

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-ember">Dungeon Master Toolkit</p>
          <h1 className="font-display text-4xl text-parchment">Preparación de campaña</h1>
        </div>
        <p className="max-w-3xl text-sm text-slate-300">
          Organiza campañas, escenarios, NPCs y objetos desde un solo lugar antes de reunirte con tu grupo. Cuando estés
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

      {activeCampaign && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2 rounded-full border border-slate-800 bg-slate-900/70 p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition sm:flex-none ${
                  activeTab === tab.id
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-parchment'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'campaigns' && renderCampaignsTab()}
          {activeTab === 'scenarios' && renderScenariosTab()}
          {activeTab === 'npcs' && renderNpcsTab()}
          {activeTab === 'items' && renderItemsTab()}
        </div>
      )}
    </section>
  )
}

export default DMToolsPage
