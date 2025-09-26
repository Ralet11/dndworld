"use client"

// app/src/pages/dm/DMScenariosPage.jsx
import { useEffect, useMemo, useState } from "react"
import { useSessionStore } from "../../store/useSessionStore"
import { useCampaignSession } from "../../hooks/useCampaignSession"
import { createScenario } from "../../api/campaigns"
import { updateScenario } from "../../api/scenarios"
import ScenarioPreviewCanvas from "./ScenarioPreviewCanvas"

const newScenarioInitial = {
  title: "",
  summary: "",
  objective: "",
  environmentTags: "",
}

const DMScenariosPage = () => {
  const session = useSessionStore((s) => s.session)
  const activeCampaignId = session?.activeCampaignId ?? null
  const { campaign, isLoading, error, refetch } = useCampaignSession(activeCampaignId, { role: "dm" })

  const scenarios = campaign?.scenarios ?? []
  const npcs = campaign?.npcs ?? []
  const items = campaign?.items ?? []

  const [selectedScenarioId, setSelectedScenarioId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")
  const [form, setForm] = useState(newScenarioInitial)
  const [note, setNote] = useState("")

  const [previewMode, setPreviewMode] = useState("constructor") // 'constructor', 'preview', '3d', 'player'
  const [selectedTool, setSelectedTool] = useState("select") // 'select', 'npc', 'object', 'terrain', 'light'
  const [showGrid, setShowGrid] = useState(true)
  const [gridSize, setGridSize] = useState(25)

  const generateLayerId = () =>
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`)

  const createDefaultLayer = (index = 0, overrides = {}) => ({
    id: generateLayerId(),
    name: `Capa ${index + 1}`,
    type: "ambient",
    backgroundImage: null,
    elements: [],
    ...overrides,
  })

  const [currentLayer, setCurrentLayer] = useState(0)
  const [scenarioLayers, setScenarioLayers] = useState([])

  const [scenarioNpcs, setScenarioNpcs] = useState([])
  const [showNpcSelector, setShowNpcSelector] = useState(false)
  const [selectedNpcForPlacement, setSelectedNpcForPlacement] = useState(null)

  const [savingScenario, setSavingScenario] = useState(false)
  const [saveScenarioError, setSaveScenarioError] = useState("")
  const [saveScenarioSuccess, setSaveScenarioSuccess] = useState(false)

  const selectedScenario = useMemo(
    () => scenarios.find((s) => s.id === selectedScenarioId) ?? null,
    [scenarios, selectedScenarioId],
  )

  useEffect(() => {
    if (!selectedScenarioId && scenarios.length) {
      setSelectedScenarioId(scenarios[0].id)
    }
  }, [scenarios, selectedScenarioId])

  useEffect(() => {
    if (!selectedScenario) {
      setScenarioLayers([])
      setScenarioNpcs([])
      setCurrentLayer(0)
      setSelectedNpcForPlacement(null)
      setShowGrid(true)
      setGridSize(25)
      setPreviewMode("constructor")
      setSelectedTool("select")
      setNote("")
      return
    }

    const mapState =
      typeof selectedScenario.tacticalMap === "object" && selectedScenario.tacticalMap !== null
        ? selectedScenario.tacticalMap
        : {}

    const layersSource =
      Array.isArray(mapState.layers) && mapState.layers.length > 0
        ? mapState.layers
        : [createDefaultLayer(0)]

    const normalizedLayers = layersSource.map((layer, index) => ({
      id: layer?.id ?? generateLayerId(),
      name: layer?.name || `Capa ${index + 1}`,
      type: layer?.type || "ambient",
      backgroundImage: layer?.backgroundImage ?? null,
      elements: Array.isArray(layer?.elements) ? layer.elements : [],
    }))

    setScenarioLayers(normalizedLayers)
    const nextLayerIndex =
      typeof mapState.currentLayerIndex === "number" && mapState.currentLayerIndex >= 0
        ? Math.min(mapState.currentLayerIndex, normalizedLayers.length - 1)
        : 0
    setCurrentLayer(nextLayerIndex)
    setScenarioNpcs(Array.isArray(mapState.assignedNpcs) ? mapState.assignedNpcs : [])
    setSelectedNpcForPlacement(null)
    setShowGrid(mapState.grid?.enabled ?? mapState.showGrid ?? true)
    setGridSize(mapState.grid?.size ?? mapState.gridSize ?? 25)
    setPreviewMode(mapState.previewMode ?? "constructor")
    setSelectedTool(mapState.selectedTool ?? "select")
    setNote(mapState.note ?? "")
  }, [selectedScenario])

  useEffect(() => {
    setSaveScenarioError("")
    setSaveScenarioSuccess(false)
  }, [selectedScenarioId])

  useEffect(() => {
    if (!saveScenarioSuccess) return
    const timer = setTimeout(() => setSaveScenarioSuccess(false), 2500)
    return () => clearTimeout(timer)
  }, [saveScenarioSuccess])

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (createError) setCreateError("")
  }

  const createNewScenario = async (e) => {
    e.preventDefault()
    if (!activeCampaignId) return
    if (!form.title.trim()) {
      setCreateError("El titulo es obligatorio.")
      return
    }
    setCreating(true)
    setCreateError("")
    try {
      const payload = { title: form.title.trim() }
      if (form.summary.trim()) payload.summary = form.summary.trim()
      if (form.objective?.trim()) payload.objective = form.objective.trim()
      if (form.environmentTags?.trim()) {
        payload.environmentTags = form.environmentTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      }
      await createScenario(activeCampaignId, payload)
      setForm(newScenarioInitial)
      await refetch()
    } catch (err) {
      setCreateError(err?.response?.data?.message || err?.message || "No se pudo crear el escenario.")
    } finally {
      setCreating(false)
    }
  }

  const saveScenarioLayers = (layers) => setScenarioLayers(layers)

  const addNewLayer = (type = "ambient") => {
    const newLayer = createDefaultLayer(scenarioLayers.length, { type })
    const updatedLayers = [...scenarioLayers, newLayer]
    saveScenarioLayers(updatedLayers)
    setCurrentLayer(updatedLayers.length - 1)
  }

  const deleteLayer = (layerIndex) => {
    if (scenarioLayers.length <= 1) return // No eliminar la ultima capa
    const updatedLayers = scenarioLayers.filter((_, i) => i !== layerIndex)
    saveScenarioLayers(updatedLayers)
    setCurrentLayer(Math.max(0, layerIndex - 1))
  }

  const updateCurrentLayerElements = (elements) => {
    const updatedLayers = [...scenarioLayers]
    if (updatedLayers[currentLayer]) {
      updatedLayers[currentLayer].elements = elements
      saveScenarioLayers(updatedLayers)
    }
  }

  const updateLayerBackground = (layerIndex, imageUrl) => {
    const updatedLayers = [...scenarioLayers]
    if (updatedLayers[layerIndex]) {
      updatedLayers[layerIndex].backgroundImage = imageUrl
      saveScenarioLayers(updatedLayers)
    }
  }

  const saveScenarioNpcs = (npcList) => setScenarioNpcs(npcList)

  const addNpcToScenario = (npc) => {
    const scenarioNpc = {
      id: `${selectedScenario.id}-${npc.id}-${Date.now()}`,
      originalNpcId: npc.id,
      name: npc.name,
      description: npc.description,
      avatar: npc.avatar,
      stats: npc.stats,
      addedAt: new Date().toISOString(),
    }
    const updatedNpcs = [...scenarioNpcs, scenarioNpc]
    saveScenarioNpcs(updatedNpcs)
  }

  const removeNpcFromScenario = (scenarioNpcId) => {
    const updatedNpcs = scenarioNpcs.filter((npc) => npc.id !== scenarioNpcId)
    saveScenarioNpcs(updatedNpcs)
  }

  const handleNpcPlacement = (scenarioNpc) => {
    setSelectedNpcForPlacement(scenarioNpc)
    setSelectedTool("npc")
    setShowNpcSelector(false)
  }

  const handleSaveScenario = async () => {
    if (!selectedScenario) return

    setSavingScenario(true)
    setSaveScenarioError("")
    setSaveScenarioSuccess(false)

    try {
      const normalizedLayers = (scenarioLayers.length ? scenarioLayers : [createDefaultLayer(0)]).map(
        (layer, index) => ({
          id: layer?.id ?? generateLayerId(),
          name: layer?.name || `Capa ${index + 1}`,
          type: layer?.type || "ambient",
          backgroundImage: layer?.backgroundImage ?? null,
          elements: Array.isArray(layer?.elements) ? layer.elements : [],
        }),
      )

      const tacticalMap = {
        version: "1.0",
        updatedAt: new Date().toISOString(),
        previewMode,
        selectedTool,
        grid: {
          enabled: showGrid,
          size: gridSize,
        },
        layers: normalizedLayers,
        assignedNpcs: scenarioNpcs,
        note,
        currentLayerIndex: currentLayer,
      }

      const backgroundRefs = Array.from(
        new Set(
          normalizedLayers
            .map((layer) => (typeof layer.backgroundImage === "string" ? layer.backgroundImage : null))
            .filter((ref) => typeof ref === "string" && ref.trim()),
        ),
      )
      const mediaRefs = backgroundRefs.length ? { backgrounds: backgroundRefs } : null

      const assignedNpcIds = Array.from(
        new Set(
          scenarioNpcs
            .map((npc) => npc.originalNpcId)
            .filter((id) => typeof id === "string" && id.trim().length > 0),
        ),
      )

      await updateScenario(selectedScenario.id, {
        tacticalMap,
        mediaRefs,
        assignedNpcIds,
      })

      await refetch()
      setSaveScenarioSuccess(true)
    } catch (err) {
      setSaveScenarioError(err?.response?.data?.message || err?.message || "No se pudo guardar el escenario.")
    } finally {
      setSavingScenario(false)
    }
  }

  const currentLayerData = scenarioLayers[currentLayer] || null

  return (
    <div className="h-full w-full max-w-[1100px] mx-auto px-6 py-6 flex flex-col gap-5 text-foreground">
      <header className="gaming-card flex flex-col gap-4 border border-border/40 px-5 py-5 shadow-[0_18px_48px_rgba(5,10,26,0.4)]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-accent rounded-full animate-pulse"></div>
            <p className="text-sm uppercase tracking-[0.15em] text-accent font-semibold">Mesa de Juego</p>
          </div>
          <h1 className="font-display text-2xl font-semibold text-text-primary">
            {selectedScenario?.title || "Selecciona un Escenario"}
          </h1>
          <p className="text-xs text-text-secondary max-w-3xl leading-relaxed">
            {selectedScenario?.summary ||
              "Construye escenarios por capas: imagenes de ambiente para narrativa y mapas tacticos para combate. Arrastra imagenes directamente a las capas."}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {selectedScenario && (
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={handleSaveScenario}
                disabled={savingScenario}
                className="gaming-button px-4 py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingScenario ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    Guardar Escenario
                  </>
                )}
              </button>
              {saveScenarioError && (
                <p className="text-xs text-destructive text-right max-w-[18rem]">{saveScenarioError}</p>
              )}
              {saveScenarioSuccess && !saveScenarioError && (
                <p className="text-xs text-secondary text-right">Escenario guardado</p>
              )}
            </div>
          )}

          <div className="gaming-card px-3 py-2 border-primary/15 bg-primary/5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold text-text-primary">{scenarios.length} Escenarios</span>
            </div>
          </div>

          {selectedScenario && (
            <div className="gaming-card flex flex-wrap items-center gap-3 border border-border/35 bg-surface-interactive px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Modo de vista</span>
              <div className="gaming-pill-switch">
                <button
                  type="button"
                  onClick={() => setPreviewMode("constructor")}
                  className={`text-[0.65rem] ${previewMode === "constructor" ? "is-active text-primary-foreground" : ""}`}
                >
                  Constructor
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("preview")}
                  className={`text-[0.65rem] ${previewMode === "preview" ? "is-active text-primary-foreground" : ""}`}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("3d")}
                  className={`text-[0.65rem] ${previewMode === "3d" ? "is-active text-primary-foreground" : ""}`}
                >
                  Vista 3D
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("player")}
                  className={`text-[0.65rem] ${previewMode === "player" ? "is-active text-primary-foreground" : ""}`}
                >
                  Vista jugador
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_260px] min-h-0">
        {/* Aside izquierdo */}
        <aside className="flex flex-col gap-5">
          <div className="gaming-card p-3 flex-1 min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Capas del Escenario</h3>
              <div className="gaming-badge">{scenarioLayers.length}</div>
            </div>

            {selectedScenario ? (
              <div className="flex-1 space-y-2 overflow-auto pr-2 scrollbar-thin scrollbar-track-surface scrollbar-thumb-border">
                {scenarioLayers.map((layer, index) => (
                  <div
                    key={layer.id}
                    className={`p-3 rounded-lg border transition-all duration-300 group ${
                      currentLayer === index
                        ? "border-primary bg-primary/10 shadow-lg gaming-glow"
                        : "border-border bg-surface-elevated hover:border-border-hover hover:bg-surface-interactive"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <button onClick={() => setCurrentLayer(index)} className="flex-1 text-left">
                        <h4
                          className={`font-medium text-sm ${
                            currentLayer === index ? "text-primary text-glow" : "text-text-primary"
                          }`}
                        >
                          {layer.name}
                        </h4>
                      </button>
                      <div className="flex items-center gap-1">
                        <div
                          className={`gaming-badge text-[10px] ${
                            layer.type === "tactical" ? "bg-accent/20 text-accent" : "bg-secondary/20 text-secondary"
                          }`}
                        >
                          {layer.type === "tactical" ? "Tactico" : "Ambiente"}
                        </div>
                        {scenarioLayers.length > 1 && (
                          <button
                            onClick={() => deleteLayer(index)}
                            className="w-5 h-5 rounded text-destructive hover:bg-destructive/20 flex items-center justify-center"
                            title="Eliminar capa"
                          >
                             
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-text-muted">
                      <span>{layer.elements?.length || 0} elementos</span>
                      {layer.backgroundImage && <span className="text-accent">Con imagen</span>}
                    </div>
                  </div>
                ))}

                <div className="flex gap-2 mt-4">
                  <button onClick={() => addNewLayer("ambient")} className="flex-1 gaming-button-secondary text-xs py-2">
                    + Ambiente
                  </button>
                  <button onClick={() => addNewLayer("tactical")} className="flex-1 gaming-button text-xs py-2">
                    + Tactico
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-text-muted">Selecciona un escenario</p>
              </div>
            )}
          </div>

          {selectedScenario && previewMode === "constructor" && currentLayerData && (
            <div className="gaming-card p-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                <p className="text-xs uppercase tracking-[0.15em] text-accent font-semibold">Herramientas de Construccion</p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => setSelectedTool("select")}
                  className={`p-3 rounded-lg border transition-all text-center ${
                    selectedTool === "select" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-border-hover"
                  }`}
                >
                  <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  <span className="text-xs">Seleccionar</span>
                </button>

                <button
                  onClick={() => setSelectedTool("npc")}
                  className={`p-3 rounded-lg border transition-all text-center ${
                    selectedTool === "npc" ? "border-secondary bg-secondary/10 text-secondary" : "border-border hover:border-border-hover"
                  }`}
                >
                  <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-xs">NPCs</span>
                </button>

                <button
                  onClick={() => setSelectedTool("object")}
                  className={`p-3 rounded-lg border transition-all text-center ${
                    selectedTool === "object" ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-border-hover"
                  }`}
                >
                  <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4-5 2zm0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span className="text-xs">Objetos</span>
                </button>

                <button
                  onClick={() => setSelectedTool("terrain")}
                  className={`p-3 rounded-lg border transition-all text-center ${
                    selectedTool === "terrain" ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-border-hover"
                  }`}
                >
                  <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-6 0H8m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span className="text-xs">Terreno</span>
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setCurrentLayer(Math.max(0, currentLayer - 1))}
                      disabled={currentLayer === 0}
                      className="gaming-button disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>

                    <div className="text-center">
                      <h3 className="font-semibold text-text-primary">{currentLayerData?.name}</h3>
                      <p className="text-xs text-text-muted">
                        Capa {currentLayer + 1} de {scenarioLayers.length} - 
                        {currentLayerData?.type === "tactical" ? "Mapa tactico" : "Imagen de ambiente"}
                      </p>
                    </div>

                    <button
                      onClick={() => setCurrentLayer(Math.min(scenarioLayers.length - 1, currentLayer + 1))}
                      disabled={currentLayer === scenarioLayers.length - 1}
                      className="gaming-button disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={currentLayerData?.name ?? ""}
                      onChange={(e) => {
                        const updatedLayers = [...scenarioLayers]
                        if (updatedLayers[currentLayer]) {
                          updatedLayers[currentLayer].name = e.target.value
                          saveScenarioLayers(updatedLayers)
                        }
                      }}
                      className="gaming-input text-sm w-32"
                      placeholder="Nombre de capa"
                    />

                    <select
                      value={currentLayerData?.type ?? "ambient"}
                      onChange={(e) => {
                        const updatedLayers = [...scenarioLayers]
                        if (updatedLayers[currentLayer]) {
                          updatedLayers[currentLayer].type = e.target.value
                          saveScenarioLayers(updatedLayers)
                        }
                      }}
                      className="gaming-input text-sm"
                    >
                      <option value="ambient">Ambiente</option>
                      <option value="tactical">Tactico</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 scenario-viewer gaming-glow min-h-[500px] relative overflow-hidden">
            {selectedScenario && currentLayerData ? (
              <ScenarioPreviewCanvas
                scenario={selectedScenario}
                layer={currentLayerData}
                mode={previewMode}
                selectedTool={selectedTool}
                showGrid={showGrid && currentLayerData.type === "tactical"}
                gridSize={gridSize}
                elements={currentLayerData.elements || []}
                onElementsChange={updateCurrentLayerElements}
                npcs={npcs}
                items={items}
                onBackgroundChange={(imageUrl) => updateLayerBackground(currentLayer, imageUrl)}
                selectedNpcForPlacement={selectedNpcForPlacement}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-surface-interactive flex items-center justify-center">
                    <svg className="w-8 h-8 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-text-secondary font-medium">Selecciona un escenario</p>
                    <p className="text-sm text-text-muted mt-1">para comenzar a construir y visualizar</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {selectedScenario && (
            <div className="flex gap-4">
              <div className="gaming-card p-4 flex-1">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-accent rounded-full"></div>
                    <h3 className="text-sm font-semibold text-text-primary">Mini-mapa en Vivo</h3>
                  </div>
                  <div className="text-xs text-text-muted">{currentLayerData?.elements?.length || 0} elementos</div>
                </div>
                <div className="h-32 bg-surface-elevated rounded-lg border border-border/50 relative overflow-hidden">
                  {currentLayerData && (
                    <ScenarioPreviewCanvas
                      scenario={selectedScenario}
                      layer={currentLayerData}
                      mode="preview"
                      selectedTool="select"
                      showGrid={false}
                      gridSize={gridSize}
                      elements={currentLayerData.elements || []}
                      onElementsChange={() => {}}
                      npcs={npcs}
                      items={items}
                      minimap={true}
                    />
                  )}
                </div>
              </div>

              <div className="gaming-card p-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <h3 className="text-sm font-semibold text-text-primary">Estadisticas</h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Capas:</span>
                    <span className="text-text-primary font-medium">{scenarioLayers.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">NPCs:</span>
                    <span className="text-text-primary font-medium">
                      {currentLayerData?.elements?.filter((e) => e.type === "npc").length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Objetos:</span>
                    <span className="text-text-primary font-medium">
                      {currentLayerData?.elements?.filter((e) => e.type === "object").length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Terreno:</span>
                    <span className="text-text-primary font-medium">
                      {currentLayerData?.elements?.filter((e) => e.type === "terrain").length || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedScenario && (
            <div className="gaming-card p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-accent rounded-full"></div>
                  <h3 className="text-sm font-semibold text-text-primary">Notas del Escenario</h3>
                </div>
                <button
                  onClick={handleSaveScenario}
                  disabled={savingScenario}
                  className="gaming-button text-xs px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingScenario ? "Guardando..." : "Guardar Notas"}
                </button>
              </div>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Pistas secretas, giros de la trama, dialogos importantes, reglas especiales..."
                className="gaming-input resize-none"
              />
            </div>
          )}
        </aside>

        {/* Aside derecho */}
        <aside className="flex flex-col gap-5">
          <div className="gaming-card p-3 flex-1 min-h-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">NPCs del Escenario</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="gaming-badge">{scenarioNpcs.length}</div>
                <button onClick={() => setShowNpcSelector(!showNpcSelector)} className="gaming-button text-xs px-2 py-1">
                  + Agregar
                </button>
              </div>
            </div>

            {selectedScenario ? (
              <div className="flex-1 space-y-2 overflow-auto pr-2 scrollbar-thin scrollbar-track-surface scrollbar-thumb-border">
                {/* Selector de NPCs de la base de datos */}
                {showNpcSelector && (
                  <div className="mb-4 p-3 rounded-lg border border-secondary/30 bg-secondary/5">
                    <h4 className="text-xs font-semibold text-secondary mb-2">NPCs Disponibles</h4>
                    <div className="space-y-1 max-h-32 overflow-auto">
                      {npcs
                        .filter((npc) => !scenarioNpcs.some((sNpc) => sNpc.originalNpcId === npc.id))
                        .map((npc) => (
                          <button
                            key={npc.id}
                            onClick={() => addNpcToScenario(npc)}
                            className="w-full text-left p-2 rounded border border-border hover:border-secondary hover:bg-secondary/10 transition-all"
                          >
                            <div className="flex items-center gap-2">
                              {npc.avatar && (
                                <img
                                  src={npc.avatar || "/placeholder.svg"}
                                  alt={npc.name}
                                  className="w-6 h-6 rounded-full object-cover"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-text-primary truncate">{npc.name}</p>
                                <p className="text-xs text-text-muted truncate">{npc.description}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      {npcs.filter((npc) => !scenarioNpcs.some((sNpc) => sNpc.originalNpcId === npc.id)).length === 0 && (
                        <p className="text-xs text-text-muted text-center py-2">Todos los NPCs ya estan agregados</p>
                      )}
                    </div>
                  </div>
                )}

                {/* NPCs del escenario actual */}
                {scenarioNpcs.map((scenarioNpc) => (
                  <div
                    key={scenarioNpc.id}
                    className="p-3 rounded-lg border border-border bg-surface-elevated hover:border-border-hover hover:bg-surface-interactive transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {scenarioNpc.avatar && (
                          <img
                            src={scenarioNpc.avatar || "/placeholder.svg"}
                            alt={scenarioNpc.name}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm text-text-primary truncate">{scenarioNpc.name}</h4>
                          <p className="text-xs text-text-muted truncate">{scenarioNpc.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleNpcPlacement(scenarioNpc)}
                          className="w-6 h-6 rounded text-secondary hover:bg-secondary/20 flex items-center justify-center"
                          title="Colocar en tablero"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </button>
                        <button
                          onClick={() => removeNpcFromScenario(scenarioNpc.id)}
                          className="w-6 h-6 rounded text-destructive hover:bg-destructive/20 flex items-center justify-center"
                          title="Remover del escenario"
                        >
                           
                        </button>
                      </div>
                    </div>

                    {scenarioNpc.stats && (
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span>HP: {scenarioNpc.stats.hp || "N/A"}</span>
                        <span>AC: {scenarioNpc.stats.ac || "N/A"}</span>
                        <span>CR: {scenarioNpc.stats.challengeRating || "N/A"}</span>
                      </div>
                    )}
                  </div>
                ))}

                {scenarioNpcs.length === 0 && (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface-interactive flex items-center justify-center">
                      <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="text-sm text-text-muted">No hay NPCs en este escenario</p>
                    <p className="text-xs text-text-subtle mt-1">Agrega NPCs de tu base de datos</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-text-muted">Selecciona un escenario</p>
              </div>
            )}
          </div>

          <div className="gaming-card p-3 flex-1 min-h-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Escenarios de la Campana</h3>
              </div>
              <div className="gaming-badge">{scenarios.length}</div>
            </div>

            {selectedScenario ? (
              <div className="flex-1 space-y-2 overflow-auto pr-2 scrollbar-thin scrollbar-track-surface scrollbar-thumb-border">
                {scenarios.map((scenario) => {
                  const persistedLayers = Array.isArray(scenario.tacticalMap?.layers)
                    ? scenario.tacticalMap.layers.length
                    : 0
                  const layerCount =
                    selectedScenarioId === scenario.id ? scenarioLayers.length : persistedLayers
                  const finalCount = layerCount || 0

                  return (
                    <div
                      key={scenario.id}
                      className={`p-3 rounded-lg border transition-all duration-300 cursor-pointer group ${
                        selectedScenarioId === scenario.id
                          ? "border-primary bg-primary/10 shadow-lg gaming-glow"
                          : "border-border bg-surface-elevated hover:border-border-hover hover:bg-surface-interactive"
                      }`}
                      onClick={() => setSelectedScenarioId(scenario.id)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4
                          className={`font-medium text-sm leading-tight ${
                            selectedScenarioId === scenario.id ? "text-primary text-glow" : "text-text-primary"
                          }`}
                        >
                          {scenario.title}
                        </h4>
                        <div className="flex items-center gap-1">
                          {(finalCount > 0) && (
                            <div className="w-2 h-2 bg-accent rounded-full" title="Tiene capas guardadas"></div>
                          )}
                          {(selectedScenarioId === scenario.id ? Boolean(note?.trim()) : Boolean(scenario.tacticalMap?.note)) && (
                            <div className="w-2 h-2 bg-secondary rounded-full" title="Tiene notas"></div>
                          )}
                        </div>
                      </div>

                      {scenario.summary && (
                        <p className="text-xs text-text-muted leading-relaxed line-clamp-2 mb-2">{scenario.summary}</p>
                      )}

                      <div className="flex items-center justify-between text-xs text-text-muted">
                        <span>{`${finalCount} capa${finalCount !== 1 ? "s" : ""}`}</span>
                        <span className="text-accent">
                          {selectedScenarioId === scenario.id ? "Activo" : "Seleccionar"}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface-interactive flex items-center justify-center">
                  <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-sm text-text-muted">No hay escenarios</p>
                <p className="text-xs text-text-subtle mt-1">Crea tu primer escenario abajo</p>
              </div>
            )}
          </div>

          <div className="gaming-card p-4 border-secondary/30 bg-secondary/5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
              <p className="text-xs uppercase tracking-[0.15em] text-secondary font-semibold">Nuevo Escenario</p>
            </div>

            <form className="space-y-3" onSubmit={createNewScenario}>
              <input
                name="title"
                placeholder="Titulo del escenario"
                value={form.title}
                onChange={handleFormChange}
                className="gaming-input"
                required
              />
              <textarea
                name="summary"
                placeholder="Resumen breve"
                rows={2}
                value={form.summary}
                onChange={handleFormChange}
                className="gaming-input resize-none"
              />

              {createError && (
                <div className="p-2 rounded-lg bg-destructive/10 border border-danger/30">
                  <p className="text-xs text-destructive">{createError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={creating}
                className="w-full gaming-button-secondary disabled:opacity-50 disabled:cursor-not-allowed text-sm py-2"
              >
                {creating ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    Creando...
                  </span>
                ) : (
                  "Crear Escenario"
                )}
              </button>
            </form>
          </div>

          {selectedScenario && (
            <div className="gaming-card p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                <p className="text-xs uppercase tracking-[0.15em] text-accent font-semibold">Acciones Rapidas</p>
              </div>

              <div className="flex flex-col gap-3">
                <button className="w-full gaming-button text-xs py-2 flex items-center justify-center gap-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Duplicar Escenario
                </button>

                <button className="w-full gaming-button-secondary text-xs py-2 flex items-center justify-center gap-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Exportar Escenario
                </button>

                <button className="w-full gaming-button-danger text-xs py-2 flex items-center justify-center gap-2">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Eliminar Escenario
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-border/50 bg-surface p-3">
                <p className="text-xs text-text-subtle">
                  Tip: arrastra imagenes sobre las capas para crear fondos de ambiente o mapas tacticos sin salir del modo actual.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

export default DMScenariosPage





