const ScenarioTabs = ({ scenarios = [], activeScenarioId, onSelect }) => {
  if (!scenarios.length) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-950/70 px-4 py-6 text-center text-sm text-slate-400">
        Aun no hay escenarios creados para esta campana.
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-3">
      {scenarios.map((scenario) => {
        const isActive = scenario.id === activeScenarioId
        return (
          <button
            key={scenario.id}
            type="button"
            onClick={() => onSelect?.(scenario.id)}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition ${
              isActive
                ? 'border-emerald-400 bg-emerald-400/20 text-emerald-200 shadow-lg shadow-emerald-500/20'
                : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-emerald-400/60 hover:text-emerald-200'
            }`}
          >
            {scenario.title}
          </button>
        )
      })}
    </div>
  )
}

export default ScenarioTabs
