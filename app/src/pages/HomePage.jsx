import { useNavigate, useOutletContext } from 'react-router-dom'
import { useSessionStore } from '../store/useSessionStore'

const coreFeatures = [
  {
    title: 'Orquestacion del DM',
    description:
      'Disena campanas completas: escenarios, NPCs y recursos visuales listos para desplegar en segundos.',
    accent: 'Planifica cada sesion con tableros vivos y controles de ritmo narrativo.',
    icon: 'DM',
  },
  {
    title: 'Sala Compartida',
    description:
      'Jugadores y DM visualizan el mismo estado de encuentro, con movimientos sincronizados y cambios de escenario instantaneos.',
    accent: 'Olvidate de PDFs sueltos: todo vive en un solo tablero dinamico.',
    icon: 'Board',
  },
  {
    title: 'Biblioteca Viva',
    description:
      'Centraliza NPCs, objetos, imagenes tacticas y seeds listas para arrastrar al tablero durante la sesion.',
    accent: 'Tu mundo siempre a mano, con busquedas, etiquetas y roles personalizados.',
    icon: 'Library',
  },
]

const workflowSteps = [
  {
    title: 'Prepara la campana',
    body: 'Crea campanas, escenarios, mapas e invitaciones en minutos. Colecciona NPCs, tesoros y recursos multimedia en la biblioteca del DM.',
  },
  {
    title: 'Invita y distribuye roles',
    body: 'Comparte enlaces seguros con jugadores, asigna permisos y sincroniza fichas y tableros por rol.',
  },
  {
    title: 'Corre la sesion en vivo',
    body: 'Actualiza el tablero, mueve tokens, lanza iniciativas y comparte handouts con un solo clic. Todos ven la misma historia evolucionar.',
  },
]

const dmHighlights = [
  'Panel maestro para activar escenarios, mapas y musica de ambiente.',
  'Controles de iniciativa y registro de acciones para llevar el ritmo de combate.',
  'Notas privadas por escena, recordatorios y hooks narrativos siempre visibles.',
]

const playerHighlights = [
  'Ficha digital con atributos editables y habilidades personalizadas.',
  'Inventario sincronizado entre tablero y hoja de personaje.',
  'Historial de encuentros e imagenes clave para revivir la aventura.',
]

const DEMO_CAMPAIGN_ID = 'demo-campaign'

const HomePage = () => {
  const navigate = useNavigate()
  const session = useSessionStore((state) => state.session)
  const setActiveMode = useSessionStore((state) => state.setActiveMode)
  const assignCampaign = useSessionStore((state) => state.assignCampaign)
  const outletContext = useOutletContext() || {}
  const openAuthModal = outletContext.openAuthModal
  const isAuthenticated = Boolean(session.user)

  const handlePreviewDemo = () => {
    assignCampaign({
      id: DEMO_CAMPAIGN_ID,
      name: 'Shadows of Aetheria',
      role: 'Player',
    })
    navigate(`/session/${DEMO_CAMPAIGN_ID}/player`)
  }

  const promptLogin = () => {
    if (typeof openAuthModal === 'function') {
      openAuthModal('login')
    }
  }

  const goToProtected = (path) => {
    if (!isAuthenticated) {
      promptLogin()
      return
    }
    navigate(path)
  }

  const handleGoToDm = () => {
    setActiveMode('dm')
    goToProtected('/dm')
  }

  const handleGoToPlayer = () => {
    setActiveMode('player')
    goToProtected('/player')
  }

  const handleOpenRegister = () => {
    if (typeof openAuthModal === 'function') {
      openAuthModal('register')
    }
  }

  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900/95 to-slate-950 p-12 shadow-2xl shadow-amber-500/5">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-amber-200">
              DungeonWorld Suite
            </span>
            <h1 className="font-display text-5xl leading-tight text-parchment drop-shadow-lg lg:text-6xl">
              Control total de la mesa sin perder la magia de la improvisacion
            </h1>
            <p className="max-w-xl text-lg text-slate-300">
              DungeonWorld convierte tus campanas en experiencias interactivas: gestiona tableros tacticos, bibliotecas de NPCs y handouts ilustrados en un solo panel compartido.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={handleGoToDm}
                className="inline-flex items-center justify-center rounded-full bg-ember px-6 py-3 text-sm font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-amber-400"
              >
                Explorar consola del DM
              </button>
              <button
                type="button"
                onClick={handleGoToPlayer}
                className="inline-flex items-center justify-center rounded-full border border-slate-300/40 px-6 py-3 text-sm font-semibold uppercase tracking-widest text-slate-200 transition hover:border-emerald-400 hover:text-emerald-300"
              >
                Entrar como jugador
              </button>
              <button
                type="button"
                onClick={handlePreviewDemo}
                className="inline-flex items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-500/10 px-6 py-3 text-sm font-semibold uppercase tracking-widest text-emerald-300 transition hover:bg-emerald-500/20"
              >
                Ver demo interactiva
              </button>
            </div>
            {!isAuthenticated ? (
              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                <button
                  type="button"
                  onClick={promptLogin}
                  className="underline-offset-4 transition hover:text-emerald-300 hover:underline"
                >
                  Inicia sesion en segundos
                </button>
                <span className="text-slate-600">o</span>
                <button
                  type="button"
                  onClick={handleOpenRegister}
                  className="underline-offset-4 transition hover:text-emerald-300 hover:underline"
                >
                  Crea tu cuenta gratuita
                </button>
              </div>
            ) : null}
          </div>
          <div className="flex flex-1 flex-col gap-4 rounded-2xl border border-slate-700/60 bg-slate-950/70 p-6 text-sm text-slate-200 shadow-lg">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">En vivo</p>
              <h2 className="mt-2 text-xl font-semibold text-parchment">Mesa conectada</h2>
              <p className="mt-2 text-slate-400">
                Cambia escenarios, arrastra tokens y comparte handouts visuales con un click. Tus jugadores ven lo mismo en tiempo real.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Registro de turnos</p>
              <p className="mt-2 text-sm text-slate-200">Iniciativa y acciones quedan guardadas para el recap posterior.</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Biblioteca compartida</p>
              <p className="mt-2 text-sm text-slate-200">NPCs, musica, efectos y mapas, listos para el proximo encuentro.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-6xl flex-col gap-6 rounded-3xl border border-slate-800 bg-slate-950/75 p-8 shadow-lg">
        {isAuthenticated ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Tu espacio</p>
            <p className="text-lg text-parchment">Hola {session.user.name}!</p>
            <p>
              Vuelve a tus campanas, administra escenarios o ajusta tu perfil. Todo queda guardado en tu cuenta local hasta que conectemos el backend.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => goToProtected('/profile')}
                className="rounded-full bg-emerald-500 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-emerald-400"
              >
                Ir a mi perfil
              </button>
              <button
                type="button"
                onClick={handleGoToDm}
                className="rounded-full border border-slate-700 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
              >
                Gestionar campanas
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-[0.35em] text-amber-300">Listo para unirte</p>
            <p className="text-lg text-parchment">Crea una cuenta para guardar tus progresos.</p>
            <p>
              Mantendremos tus datos y campanas en esta maquina hasta que conectes un backend real. Puedes practicar el flujo completo sin esperar al servidor.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleOpenRegister}
                className="rounded-full bg-amber-400 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-amber-300"
              >
                Crear cuenta
              </button>
              <button
                type="button"
                onClick={promptLogin}
                className="rounded-full border border-slate-700 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
              >
                Iniciar sesion
              </button>
            </div>
          </div>
        )}
      </section>

            <section className="grid gap-8 rounded-3xl border border-slate-800 bg-slate-950/70 p-10 shadow-lg">
        <header className="space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Sincroniza la mesa</p>
          <h2 className="font-display text-3xl text-parchment">Disenado para sostener campanas largas con equipos remotos</h2>
          <p className="mx-auto max-w-2xl text-sm text-slate-300">
            Conecta la preparacion del DM con la experiencia de los jugadores. Las herramientas visuales y la administracion de turnos conviven en el mismo tablero.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-3">
          {coreFeatures.map((feature) => (
            <article
              key={feature.title}
              className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-200 shadow-inner"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-400/10 text-sm font-semibold uppercase tracking-[0.35em] text-emerald-200">
                {feature.icon}
              </span>
              <h3 className="mt-4 text-xl font-semibold text-parchment">{feature.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{feature.description}</p>
              <p className="mt-4 text-xs uppercase tracking-widest text-emerald-300">{feature.accent}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[2fr,3fr]">
        <div className="space-y-5 rounded-3xl border border-slate-800 bg-slate-950/70 p-8 shadow-lg">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-300">Workflow</p>
          <h2 className="font-display text-3xl text-parchment">Asi se vive una campana completa</h2>
          <p className="text-sm text-slate-300">
            Cada modulo esta conectado: creas una escena, adjuntas visuales, arrastras NPCs y los jugadores reciben pistas al instante. Gestionar tu mundo nunca fue tan agil.
          </p>
          <ul className="space-y-4 text-sm text-slate-200">
            {workflowSteps.map((step) => (
              <li key={step.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <p className="text-xs uppercase tracking-widest text-emerald-300">{step.title}</p>
                <p className="mt-2 text-slate-300">{step.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <article className="flex h-full flex-col rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900/80 to-slate-950 p-8 shadow-lg">
            <header className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Panel del DM</p>
              <h3 className="text-2xl font-semibold text-parchment">Control narrativo con herramientas a medida</h3>
            </header>
            <ul className="mt-6 space-y-4 text-sm text-slate-300">
              {dmHighlights.map((line) => (
                <li key={line} className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-emerald-400" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-6 text-xs uppercase tracking-widest text-slate-500">
              Disponible en la consola /dm en cuanto inicies sesion.
            </div>
          </article>

          <article className="flex h-full flex-col rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900/60 to-slate-950 p-8 shadow-lg">
            <header className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-amber-300">Experiencia del jugador</p>
              <h3 className="text-2xl font-semibold text-parchment">Todo lo que necesitan para actuar en el mundo</h3>
            </header>
            <ul className="mt-6 space-y-4 text-sm text-slate-300">
              {playerHighlights.map((line) => (
                <li key={line} className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-amber-400" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-6 text-xs uppercase tracking-widest text-slate-500">
              Accede via /player y sincroniza tu ficha en segundos.
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto flex max-w-6xl flex-col gap-8 rounded-3xl border border-slate-800 bg-slate-950/80 p-10 text-center shadow-inner shadow-emerald-500/10">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Listo para la proxima sesion</p>
          <h2 className="font-display text-3xl text-parchment">Comienza gratis. Actualiza cuando tu mesa lo necesite.</h2>
          <p className="mx-auto max-w-2xl text-sm text-slate-300">
            Todo el stack esta preparado para autenticacion, membresias, tableros en tiempo real y seeds completas de demostracion. Ya construimos la base, ahora puedes llevarla a produccion.
          </p>
        </header>
        <div className="flex flex-wrap justify-center gap-4">
          <button
            type="button"
            onClick={handleGoToDm}
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-8 py-3 text-sm font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-emerald-400"
          >
            Crear mi campana
          </button>
          <button
            type="button"
            onClick={handlePreviewDemo}
            className="inline-flex items-center justify-center rounded-full border border-slate-700 px-8 py-3 text-sm font-semibold uppercase tracking-widest text-slate-200 transition hover:border-amber-400 hover:text-amber-300"
          >
            Recorrer demo guiada
          </button>
        </div>
      </section>
    </div>
  )
}

export default HomePage



