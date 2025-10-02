import { useMemo, useRef, useState } from 'react'

function normalizeImprovements(improvements) {
  if (!improvements) return []
  if (Array.isArray(improvements)) {
    return improvements
      .map((entry) => {
        if (!entry) return null
        if (typeof entry === 'string') return entry.trim()
        if (typeof entry === 'object') {
          if (entry.name && entry.description) {
            return `${entry.name}: ${entry.description}`
          }
          if (entry.name) return entry.name
          if (entry.description) return entry.description
        }
        return null
      })
      .filter(Boolean)
  }
  if (typeof improvements === 'string') {
    return improvements
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  }
  if (typeof improvements === 'object') {
    return Object.values(improvements)
      .map((value) => (typeof value === 'string' ? value.trim() : null))
      .filter(Boolean)
  }
  return []
}

export default function SelectionCard({
  title,
  description,
  improvements,
  iconAssetId,
  selected,
  onSelect,
}) {
  const [showDetails, setShowDetails] = useState(false)
  const [holdActive, setHoldActive] = useState(false)
  const holdTimeoutRef = useRef(null)
  const didHoldRef = useRef(false)

  const improvementList = useMemo(
    () => normalizeImprovements(improvements),
    [improvements]
  )

  const clearHoldTimeout = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
  }

  const handleHoldStart = () => {
    didHoldRef.current = false
    clearHoldTimeout()
    holdTimeoutRef.current = setTimeout(() => {
      didHoldRef.current = true
      setHoldActive(true)
      setShowDetails(true)
    }, 400)
  }

  const handleHoldEnd = () => {
    clearHoldTimeout()
    if (holdActive) {
      setShowDetails(false)
      setHoldActive(false)
    }
    setTimeout(() => {
      didHoldRef.current = false
    }, 0)
  }

  const handleClick = () => {
    if (didHoldRef.current) {
      didHoldRef.current = false
      return
    }
    onSelect?.()
  }

  const closeDetails = () => {
    setShowDetails(false)
    setHoldActive(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handleHoldStart}
        onPointerUp={handleHoldEnd}
        onPointerLeave={handleHoldEnd}
        onPointerCancel={handleHoldEnd}
        onTouchStart={handleHoldStart}
        onTouchEnd={handleHoldEnd}
        className={`relative flex h-full w-full flex-col rounded-xl border p-4 text-left transition shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-0 sm:p-5 ${
          selected
            ? 'border-cyan-400 bg-cyan-400/10 text-white'
            : 'border-slate-700/60 bg-slate-800/60 text-slate-100 hover:border-cyan-300/70 hover:bg-slate-800'
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/60 text-xs uppercase tracking-tight text-slate-300">
            {iconAssetId ? (
              <span className="text-[10px] leading-tight">
                {iconAssetId.split('-')[0]}
              </span>
            ) : (
              <span className="text-xs">Sin icono</span>
            )}
          </div>
          <div className="space-y-2">
            <div>
              <h3 className="text-base font-semibold text-white">{title}</h3>
              {description ? (
                <p className="mt-1 text-sm text-slate-300 line-clamp-3">
                  {description}
                </p>
              ) : (
                <p className="mt-1 text-sm italic text-slate-400">
                  Sin descripción disponible
                </p>
              )}
            </div>
            {improvementList.length > 0 && (
              <ul className="space-y-1 text-sm text-slate-300">
                {improvementList.slice(0, 2).map((entry, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-400" />
                    <span className="leading-snug line-clamp-2">{entry}</span>
                  </li>
                ))}
                {improvementList.length > 2 && (
                  <li className="text-xs italic text-slate-400">
                    Mantén presionado para ver más
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <span>{selected ? 'Seleccionado' : 'Tocar para elegir'}</span>
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] uppercase tracking-wider text-slate-300">
            Hold para detalles
          </span>
        </div>
      </button>
      {showDetails && (
        <div
          className={`fixed inset-0 z-40 flex items-center justify-center px-4 py-8 ${
            holdActive ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-cyan-500/40 bg-slate-900/95 p-6 text-left shadow-2xl">
            {!holdActive && (
              <button
                type="button"
                onClick={closeDetails}
                className="absolute right-4 top-4 rounded-full border border-slate-700/80 bg-slate-800/80 px-2 py-1 text-xs uppercase tracking-wider text-slate-300 hover:border-cyan-400 hover:text-white"
              >
                Cerrar
              </button>
            )}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                {iconAssetId && (
                  <p className="mt-1 text-xs uppercase tracking-widest text-cyan-300/80">
                    Icono: {iconAssetId}
                  </p>
                )}
              </div>
              {description && (
                <p className="text-sm leading-relaxed text-slate-200">{description}</p>
              )}
              {improvementList.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-cyan-300/90">
                    Mejoras
                  </h4>
                  <ul className="mt-2 space-y-2 text-sm text-slate-200">
                    {improvementList.map((entry, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-400" />
                        <span className="leading-snug">{entry}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {improvementList.length === 0 && (
                <p className="text-sm italic text-slate-400">
                  Sin mejoras registradas
                </p>
              )}
              {!description && improvementList.length === 0 && (
                <p className="text-sm italic text-slate-500">
                  No hay detalles adicionales para esta opción.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
