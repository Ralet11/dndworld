import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createCampaign } from '../api/campaigns'
import { useCampaignList } from '../hooks/useCampaignList'
import { useSessionStore } from '../store/useSessionStore'

const SessionEntryPage = ({ role }) => {
  const navigate = useNavigate()
  const { campaigns = [], isLoading, error, refetch } = useCampaignList()
  const activeCampaignId = useSessionStore((state) => state.session.activeCampaignId)
  const assignCampaign = useSessionStore((state) => state.assignCampaign)

  const [campaignForm, setCampaignForm] = useState({ name: '', description: '', status: 'draft' })
  const [campaignError, setCampaignError] = useState(null)
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false)

  const buildSessionPath = (id) => `/session/${id}/${role === 'dm' ? 'dm' : 'player'}`

  useEffect(() => {
    if (!activeCampaignId) return
    navigate(buildSessionPath(activeCampaignId), { replace: true })
  }, [activeCampaignId, navigate, role])

  const handleJoin = (campaignId) => {
    navigate(buildSessionPath(campaignId))
  }

  const handleCampaignFieldChange = (event) => {
    const { name, value } = event.target
    setCampaignForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreateCampaign = async (event) => {
    event.preventDefault()
    if (role !== 'dm') return

    if (!campaignForm.name.trim()) {
      setCampaignError('El nombre de la campana es obligatorio.')
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

      const campaign = await createCampaign(payload)
      assignCampaign({ ...campaign, role: 'dm' })
      setCampaignForm({ name: '', description: '', status: 'draft' })
      navigate(buildSessionPath(campaign.id))
    } catch (creationError) {
      const message =
        creationError.response?.data?.message ??
        creationError.message ??
        'No se pudo crear la campana.'
      setCampaignError(message)
    } finally {
      setIsCreatingCampaign(false)
    }
  }

  return (
    <section className='mx-auto flex w-full max-w-4xl flex-col gap-6 py-10'>
      <header className='space-y-2'>
        <p className='text-sm uppercase tracking-[0.3em] text-ember'>
          {role === 'dm' ? 'Dungeon Master Access' : 'Player Access'}
        </p>
        <h1 className='font-display text-4xl text-parchment'>
          {role === 'dm' ? 'Selecciona tu campana' : 'Unete a una campana'}
        </h1>
        <p className='max-w-2xl text-sm text-slate-300'>
          {role === 'dm'
            ? 'Elige la campana que quieres dirigir o crea una nueva para abrir la consola del DM.'
            : 'Selecciona la campana asignada para entrar a la sala compartida.'}
        </p>
      </header>

      {role === 'dm' && (
        <section className='rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-parchment'>
          <h2 className='text-lg font-semibold text-parchment'>Crear nueva campana</h2>
          <p className='mt-1 text-sm text-slate-400'>
            Define el nombre y estado inicial. Puedes actualizar detalles avanzados mas tarde.
          </p>

          <form className='mt-4 space-y-4' onSubmit={handleCreateCampaign}>
            <div>
              <label className='text-xs uppercase tracking-widest text-slate-400' htmlFor='campaign-name'>
                Nombre
              </label>
              <input
                id='campaign-name'
                name='name'
                type='text'
                value={campaignForm.name}
                onChange={handleCampaignFieldChange}
                className='mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40'
                placeholder='Campana de ejemplo'
                required
              />
            </div>

            <div>
              <label className='text-xs uppercase tracking-widest text-slate-400' htmlFor='campaign-description'>
                Descripcion
              </label>
              <textarea
                id='campaign-description'
                name='description'
                rows={3}
                value={campaignForm.description}
                onChange={handleCampaignFieldChange}
                className='mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40'
                placeholder='Un resumen rapido de la aventura.'
              />
            </div>

            <div>
              <label className='text-xs uppercase tracking-widest text-slate-400' htmlFor='campaign-status'>
                Estado
              </label>
              <select
                id='campaign-status'
                name='status'
                value={campaignForm.status}
                onChange={handleCampaignFieldChange}
                className='mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40'
              >
                <option value='draft'>Borrador</option>
                <option value='active'>Activa</option>
                <option value='archived'>Archivada</option>
              </select>
            </div>

            {campaignError && <p className='text-sm text-red-300'>{campaignError}</p>}

            <button
              type='submit'
              className='inline-flex rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50'
              disabled={isCreatingCampaign}
            >
              {isCreatingCampaign ? 'Creando...' : 'Crear campana'}
            </button>
          </form>
        </section>
      )}

      {isLoading && (
        <div className='rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300'>
          Cargando campanas disponibles...
        </div>
      )}

      {error && (
        <div className='rounded-lg border border-red-400/60 bg-red-900/40 px-4 py-3 text-sm text-red-200'>
          <p className='font-semibold'>No pudimos obtener la lista de campanas.</p>
          <p className='mt-1 text-red-100/80'>{error.message ?? 'Intenta nuevamente en unos segundos.'}</p>
          <button
            type='button'
            onClick={refetch}
            className='mt-3 rounded-full border border-red-300/60 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-100 transition hover:bg-red-300/20'
          >
            Reintentar
          </button>
        </div>
      )}

      {!isLoading && !error && campaigns.length === 0 && (
        <div className='rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-6 text-center text-sm text-slate-400'>
          Aun no hay campanas registradas. Crea una desde el panel del DM para comenzar.
        </div>
      )}

      <div className='grid gap-4 md:grid-cols-2'>
        {campaigns.map((campaign) => (
          <article
            key={campaign.id}
            className='flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40'
          >
            <div className='space-y-3'>
              <div>
                <h2 className='font-display text-xl text-parchment'>{campaign.name}</h2>
                <p className='text-xs uppercase tracking-widest text-slate-500'>Estado: {campaign.status}</p>
              </div>
              {campaign.description && (
                <p className='line-clamp-3 text-sm text-slate-300'>{campaign.description}</p>
              )}
              {campaign.dm && (
                <p className='text-xs text-slate-400'>
                  DM:{' '}
                  <span className='font-semibold text-ember'>
                    {campaign.dm.displayName ?? campaign.dm.username}
                  </span>
                </p>
              )}
            </div>
            <button
              type='button'
              onClick={() => handleJoin(campaign.id)}
              className='mt-4 inline-flex items-center justify-center rounded-full bg-ember px-4 py-2 text-sm font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-ember/90'
            >
              {role === 'dm' ? 'Dirigir sesion' : 'Unirme como jugador'}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

export const DMEntryPage = () => <SessionEntryPage role='dm' />
export const PlayerEntryPage = () => <SessionEntryPage role='player' />

export default SessionEntryPage
