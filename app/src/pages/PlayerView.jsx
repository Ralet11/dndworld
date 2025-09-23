import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import BoardCanvas from '../components/board/BoardCanvas'
import ImageCarousel from '../components/board/ImageCarousel'
import SidebarLeft from '../components/board/SidebarLeft'
import { useCampaignSession } from '../hooks/useCampaignSession'
import { useSocket } from '../hooks/useSocket'

const PlayerView = () => {
  const { campaignId } = useParams()
  const { campaign: activeCampaign, isLoading, error, refetch } = useCampaignSession(campaignId, { role: 'player' })
  const socket = useSocket()

  const [activeScenarioId, setActiveScenarioId] = useState(null)
  const [imageIndexByScenario, setImageIndexByScenario] = useState({})
  const [highlightedNpcId, setHighlightedNpcId] = useState(null)

  const scenarios = activeCampaign?.scenarios ?? []
  const memberships = activeCampaign?.memberships ?? []
  const items = activeCampaign?.items ?? []
  const npcs = activeCampaign?.npcs ?? []

  useEffect(() => {
    if (!socket || !activeCampaign?.id) return
    socket.emit('join:campaign', { campaignId: activeCampaign.id }, (ack) => {
      if (ack?.status !== 'ok') console.warn('Unable to join campaign room', ack)
    })
  }, [socket, activeCampaign?.id])

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

  useEffect(() => {
    if (!socket) return

    const handleScenarioChanged = ({ scenarioId }) => {
      if (!scenarioId) return
      setActiveScenarioId(scenarioId)
      setImageIndexByScenario((prev) => ({
        ...prev,
        [scenarioId]: prev[scenarioId] ?? 0,
      }))
      setHighlightedNpcId(null)
      refetch?.()
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
      setHighlightedNpcId(npcId)
    }

    socket.on('scenario:changed', handleScenarioChanged)
    socket.on('board:image:changed', handleImageChanged)
    socket.on('npc:highlighted', handleNpcHighlighted)

    return () => {
      socket.off('scenario:changed', handleScenarioChanged)
      socket.off('board:image:changed', handleImageChanged)
      socket.off('npc:highlighted', handleNpcHighlighted)
    }
  }, [socket, refetch])

  useEffect(() => {
    if (activeScenarioId || !scenarios.length) return

    const firstScenarioId = scenarios[0].id
    setActiveScenarioId(firstScenarioId)
    setImageIndexByScenario((prev) => ({
      ...prev,
      [firstScenarioId]: prev[firstScenarioId] ?? 0,
    }))
  }, [scenarios, activeScenarioId])

  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === activeScenarioId) ?? null,
    [scenarios, activeScenarioId],
  )

  const activeScenarioImages = activeScenario?.images ?? []
  const currentImageIndex = Math.min(
    imageIndexByScenario[activeScenarioId] ?? 0,
    Math.max(activeScenarioImages.length - 1, 0),
  )

  const highlightedNpc = useMemo(
    () => npcs.find((npc) => npc.id === highlightedNpcId) ?? null,
    [npcs, highlightedNpcId],
  )

  const acceptedMembers = useMemo(
    () => memberships.filter((member) => member.status === 'accepted'),
    [memberships],
  )

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-ember">Portal del jugador</p>
        <h1 className="font-display text-4xl text-parchment">Tablero compartido</h1>
        <p className="max-w-3xl text-sm text-slate-300">
          Mantiene sincronizadas las escenas, imagenes y personajes destacados que comparta el director.
        </p>
      </header>

      {isLoading && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
          Cargando tu campana...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-400/60 bg-red-900/40 px-4 py-3 text-sm text-red-200">
          <p className="font-semibold">No pudimos traer los datos de la campana.</p>
          <p className="mt-1 text-red-100/80">{error.message ?? 'Vuelve a intentarlo.'}</p>
          <button
            type="button"
            onClick={refetch}
            className="mt-3 rounded-full border border-red-300/60 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-100 transition hover:bg-red-300/20"
          >
            Reintentar
          </button>
        </div>
      )}

      {!activeCampaign && !isLoading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400">
          Unete a una campana para ver el tablero compartido.
        </div>
      ) : null}

      {activeCampaign && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-parchment">
            <h2 className="text-lg font-semibold text-parchment">Tu campana</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>
                Actualmente explorando{' '}
                <span className="font-semibold text-ember">{activeCampaign.name}</span>
              </p>
              <p className="text-xs uppercase tracking-widest text-slate-500">ID: {activeCampaign.id}</p>
              {activeCampaign.role && (
                <p>
                  Rol:{' '}
                  <span className="rounded-full border border-ember/40 bg-ember/10 px-3 py-1 text-xs uppercase tracking-wider text-ember">
                    {activeCampaign.role}
                  </span>
                </p>
              )}
              {activeCampaign.dm && (
                <p className="text-xs text-slate-400">
                  Dungeon Master:{' '}
                  <span className="font-semibold text-parchment">
                    {activeCampaign.dm.displayName ?? activeCampaign.dm.username}
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
            <SidebarLeft members={memberships} items={items} activeScenario={activeScenario} />

            <div className="space-y-4">
              <ImageCarousel images={activeScenarioImages} activeIndex={currentImageIndex} />
              <BoardCanvas
                scenario={activeScenario}
                image={activeScenarioImages[currentImageIndex]}
                selectedNpc={highlightedNpc}
                members={acceptedMembers}
                items={items}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default PlayerView
