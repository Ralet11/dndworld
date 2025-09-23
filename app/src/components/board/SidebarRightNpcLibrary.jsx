import { useMemo } from 'react'

const SidebarRightNpcLibrary = ({
  npcs = [],
  searchTerm = '',
  onSearch,
  selectedNpcId,
  onSelectNpc,
}) => {
  const groupedNpcs = useMemo(() => {
    if (!npcs.length) return []
    return npcs.reduce((groups, npc) => {
      const key = npc.disposition ?? 'unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(npc)
      return groups
    }, {})
  }, [npcs])

  const dispositions = Object.keys(groupedNpcs)

  return (
    <aside className="flex h-full flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-amber-300">Biblioteca de NPCs</p>
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => onSearch?.(event.target.value)}
          placeholder="Buscar por nombre o titulo..."
          className="w-full rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm text-slate-200 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
        />
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {dispositions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-4 text-center text-xs text-slate-400">
            No se encontraron NPCs. Crea algunos desde el panel de gestion inferior.
          </p>
        ) : (
          dispositions.map((disposition) => (
            <section key={disposition} className="space-y-3">
              <h3 className="text-xs uppercase tracking-[0.35em] text-emerald-300">{disposition}</h3>
              <div className="space-y-2">
                {groupedNpcs[disposition].map((npc) => {
                  const isActive = npc.id === selectedNpcId
                  return (
                    <button
                      type="button"
                      key={npc.id}
                      onClick={() => onSelectNpc?.(npc.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        isActive
                          ? 'border-emerald-400 bg-emerald-400/15 text-emerald-200 shadow-lg shadow-emerald-500/20'
                          : 'border-slate-800 bg-slate-900/60 text-slate-200 hover:border-emerald-300/60 hover:text-emerald-200'
                      }`}
                    >
                      <p className="text-sm font-semibold">{npc.name}</p>
                      <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{npc.title ?? 'Sin titulo'}</p>
                      {npc.scenarioId && (
                        <p className="mt-1 text-[10px] uppercase tracking-[0.35em] text-slate-500">
                          Vinculado a escenario
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </aside>
  )
}

export default SidebarRightNpcLibrary
