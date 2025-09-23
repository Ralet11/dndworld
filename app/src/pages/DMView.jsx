// app/src/pages/DMView.jsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import BoardCanvas from '../components/board/BoardCanvas'
import ImageCarousel from '../components/board/ImageCarousel'
import ScenarioTabs from '../components/board/ScenarioTabs'
import SidebarLeft from '../components/board/SidebarLeft'
import SidebarRightNpcLibrary from '../components/board/SidebarRightNpcLibrary'
import { useCampaignSession } from '../hooks/useCampaignSession'
import { useSocket } from '../hooks/useSocket'

const DMView = () => {
  const { campaignId } = useParams()
  const { campaign: activeCampaign, isLoading, error, refetch } = useCampaignSession(campaignId, { role: 'dm' })
  const socket = useSocket()

  const [activeScenarioId, setActiveScenarioId] = useState(null)
  const [imageIndexByScenario, setImageIndexByScenario] = useState({})
  const [npcSearch, setNpcSearch] = useState('')
  const [selectedNpcId, setSelectedNpcId] = useState(null)

  const scenarios = activeCampaign?.scenarios ?? []
  const items = activeCampaign?.items ?? []
  const memberships = activeCampaign?.memberships ?? []
  const allNpcs = activeCampaign?.npcs ?? []

  // Unirse al room de la campana
  useEffect(() => {
    if (!socket || !activeCampaign?.id) return
    socket.emit('join:campaign', { campaignId: activeCampaign.id }, (ack) => {
      if (ack?.status !== 'ok') console.warn('Unable to join campaign room', ack)
    })
  }, [socket, activeCampaign?.id])

  // Unirse al room del board (por ahora usamos campaignId como boardId)
  useEffect(() => {
    if (!socket || !activeCampaign?.id) return
    socket.emit(
      'join:board',
      { campaignId: activeCampaign.id, boardId: activeCampaign.id },
      (ack) => {
        if (ack?.status !== 'ok') console.warn('Unable to join board room', ack)
      },
    )
  }, [socket, activeCampaign?.id])

  // Escuchar cambios de escenario enviados por tiempo real
  useEffect(() => {
    if (!socket) return

    const handleScenarioChanged = ({ scenarioId }) => {
      if (!scenarioId) return
      setActiveScenarioId((prev) => (prev === scenarioId ? prev : scenarioId))
      setImageIndexByScenario((prev) => ({
        ...prev,
        [scenarioId]: prev[scenarioId] ?? 0,
      }))
    }

    const handleImageChanged = ({ scenarioId, imageIndex }) => {
      if (!scenarioId) return
      const nextIndex = Number(imageIndex)
      if (!Number.isInteger(nextIndex) || nextIndex < 0) return
      setActiveScenarioId((prev) => (prev === scenarioId ? prev : scenarioId))
      setImageIndexByScenario((prev) => ({
        ...prev,
        [scenarioId]: nextIndex,
      }))
    }

    const handleNpcHighlighted = ({ npcId }) => {
      if (!npcId) return
      setSelectedNpcId((prev) => (prev === npcId ? prev : npcId))
    }

    socket.on('scenario:changed', handleScenarioChanged)
    socket.on('board:image:changed', handleImageChanged)
    socket.on('npc:highlighted', handleNpcHighlighted)

    return () => {
      socket.off('scenario:changed', handleScenarioChanged)
      socket.off('board:image:changed', handleImageChanged)
      socket.off('npc:highlighted', handleNpcHighlighted)
    }
  }, [socket])

  // Setear primer escenario activo por defecto
  useEffect(() => {
    if (!scenarios.length || activeScenarioId) return

    const defaultScenario = scenarios[0]
    setActiveScenarioId(defaultScenario.id)
    setImageIndexByScenario((prev) => ({
      ...prev,
      [defaultScenario.id]: prev[defaultScenario.id] ?? 0,
    }))

    if (socket && activeCampaign?.id) {
      socket.emit('scenario:set', {
        campaignId: activeCampaign.id,
        scenarioId: defaultScenario.id,
      })
    }
  }, [scenarios, activeScenarioId, socket, activeCampaign?.id])

  const activeScenario = useMemo(
    () => scenarios.find((s) => s.id === activeScenarioId) ?? null,
    [scenarios, activeScenarioId],
  )

  const activeScenarioImages = activeScenario?.images ?? []
  const currentImageIndex = Math.min(
    imageIndexByScenario[activeScenarioId] ?? 0,
    Math.max(activeScenarioImages.length - 1, 0),
  )

  const filteredNpcs = useMemo(() => {
    if (!npcSearch.trim()) return allNpcs
    const term = npcSearch.trim().toLowerCase()
    return allNpcs.filter((npc) => {
      const name = npc.name?.toLowerCase() ?? ''
      const title = npc.title?.toLowerCase() ?? ''
      return name.includes(term) || title.includes(term)
    })
  }, [allNpcs, npcSearch])

  useEffect(() => {
    if (filteredNpcs.length === 0) {
      setSelectedNpcId(null)
      return
    }
    if (!selectedNpcId || !filteredNpcs.some((npc) => npc.id === selectedNpcId)) {
      setSelectedNpcId(filteredNpcs[0].id)
    }
  }, [filteredNpcs, selectedNpcId])

  const selectedNpc = useMemo(
    () => filteredNpcs.find((npc) => npc.id === selectedNpcId) ?? null,
    [filteredNpcs, selectedNpcId],
  )

  const handleImageChange = (scenarioId, nextIndex) => {
    setImageIndexByScenario((prev) => ({ ...prev, [scenarioId]: nextIndex }))

    if (socket && activeCampaign?.id && scenarioId) {
      socket.emit('board:image:set', {
        campaignId: activeCampaign.id,
        boardId: activeCampaign.id,
        scenarioId,
        imageIndex: nextIndex,
      })
    }
  }

  const highlightNpcOnBoard = useCallback(() => {
    if (!socket || !activeCampaign?.id || !selectedNpcId) return

    socket.emit('npc:highlight', {
      campaignId: activeCampaign.id,
      boardId: activeCampaign.id,
      npcId: selectedNpcId,
    })
  }, [socket, activeCampaign?.id, selectedNpcId])

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-ember">Dungeon Master Console</p>
        <h1 className="font-display text-4xl text-parchment">Sesion en vivo</h1>
        <p className="max-w-3xl text-sm text-slate-300">
          Coordina el tablero compartido con tu grupo, controla la escena activa y comparte recursos en tiempo real
          durante la sesion.
        </p>
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
          <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
            <SidebarLeft members={memberships} items={items} activeScenario={activeScenario} />

            <div className="space-y-4">
              <ScenarioTabs
                scenarios={scenarios}
                activeScenarioId={activeScenarioId}
                onSelect={(id) => {
                  setActiveScenarioId(id)
                  setImageIndexByScenario((prev) => ({ ...prev, [id]: prev[id] ?? 0 }))

                  if (socket && activeCampaign?.id) {
                    socket.emit('scenario:set', {
                      campaignId: activeCampaign.id,
                      scenarioId: id,
                    })
                  }
                }}
              />

              <ImageCarousel
                images={activeScenarioImages}
                activeIndex={currentImageIndex}
                onChange={(nextIndex) => handleImageChange(activeScenarioId, nextIndex)}
              />

              <BoardCanvas
                scenario={activeScenario}
                image={activeScenarioImages[currentImageIndex]}
                selectedNpc={selectedNpc}
                onHighlightNpc={highlightNpcOnBoard}
                members={memberships.filter((m) => m.status === 'accepted')}
                items={items}
              />
            </div>

            <SidebarRightNpcLibrary
              npcs={filteredNpcs}
              searchTerm={npcSearch}
              onSearch={setNpcSearch}
              selectedNpcId={selectedNpcId}
              onSelectNpc={setSelectedNpcId}
            />
          </div>
        </div>
      )}
    </section>
  )
}

export default DMView
