// app/src/components/common/SearchSelect.jsx
import { useMemo, useState } from 'react'

const SearchSelect = ({ options = [], onSelect, placeholder = 'Buscar…' }) => {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return options.slice(0, 20)
    return options.filter((o) => o.label.toLowerCase().includes(s)).slice(0, 20)
  }, [q, options])

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
      />
      <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-800 bg-slate-900/50">
        {filtered.map((opt) => (
          <button
            type="button"
            key={opt.value}
            onClick={() => onSelect?.(opt)}
            className="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800/60"
          >
            {opt.label}
          </button>
        ))}
        {!filtered.length && (
          <div className="px-3 py-2 text-sm text-slate-500">Sin resultados</div>
        )}
      </div>
    </div>
  )
}

export default SearchSelect
