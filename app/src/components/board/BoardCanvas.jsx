const placeholderGrid = Array.from({ length: 6 })

const BoardCanvas = ({ scenario, image, selectedNpc, members = [], items = [], onHighlightNpc }) => {
  const imageUrl = image?.url ?? null
  const scenarioName = scenario?.title ?? 'Escenario sin nombre'
  const summary = scenario?.summary ?? 'Describe la escena para tus jugadores o comparte pistas clave.'
  const objective = scenario?.objective ?? 'Define un objetivo para guiar la narrativa o el combate.'
  const environmentLabel =
    Array.isArray(scenario?.environmentTags) && scenario.environmentTags.length
      ? scenario.environmentTags.join(' / ')
      : 'Sin etiquetas'

  return (
    <div className="relative flex min-h-[420px] flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 shadow-lg">
      <div className="relative flex-1 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={image?.label ?? scenarioName}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900" />
        )}

        <div className="pointer-events-none absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />

        <div className="relative flex h-full w-full flex-col justify-between p-6">
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Escenario activo</p>
              <h3 className="mt-1 text-2xl font-semibold text-parchment">{scenarioName}</h3>
            </div>
            <div className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-200">
              {environmentLabel}
            </div>
          </header>

          <div className="pointer-events-auto rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-lg">
            <p className="text-sm text-slate-200">{summary}</p>
            <div className="mt-3 flex flex-wrap gap-6 text-xs uppercase tracking-widest text-slate-400">
              <span>
                Objetivo:{' '}
                <span className="text-emerald-300">{objective}</span>
              </span>
              <span>NPCs activos: {members.length}</span>
              <span>Recursos: {items.length}</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-800/80 bg-slate-950/85 p-4">
        {selectedNpc ? (
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/50 bg-amber-400/10 text-lg font-semibold text-amber-300">
              {selectedNpc.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-parchment">{selectedNpc.name}</p>
              <p className="text-xs uppercase tracking-widest text-slate-400">
                {selectedNpc.title ?? 'Sin titulo'} - {selectedNpc.disposition}
              </p>
              {selectedNpc.creatureType && (
                <p className="text-xs text-slate-500">Tipo: {selectedNpc.creatureType}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onHighlightNpc?.()}
              className="pointer-events-auto rounded-full border border-emerald-400/50 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!onHighlightNpc}
            >
              Destacar en tablero
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-2">
            {placeholderGrid.map((_, index) => (
              <div key={index} className="aspect-square rounded-xl border border-slate-800/60 bg-slate-900" />
            ))}
          </div>
        )}
      </footer>
    </div>
  )
}

export default BoardCanvas
