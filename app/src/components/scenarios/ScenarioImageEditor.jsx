// app/src/components/scenarios/ScenarioImageEditor.jsx
import { useEffect, useRef, useState } from 'react'
import { addScenarioImages } from '../../api/scenarios'

const Row = ({ img, index, onDragStart, onDragOver, onDrop, onRemove, onLabel }) => (
  <li
    draggable
    onDragStart={(e) => onDragStart(e, index)}
    onDragOver={(e) => onDragOver(e, index)}
    onDrop={(e) => onDrop(e, index)}
    className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-2"
  >
    <span className="cursor-grab select-none text-slate-500">⠿</span>
    <img
      src={img.url}
      alt={img.label || `img-${index}`}
      className="h-10 w-16 rounded object-cover ring-1 ring-slate-700"
    />
    <div className="flex-1">
      <input
        value={img.label ?? ''}
        onChange={(e) => onLabel(index, e.target.value)}
        placeholder="Etiqueta (opcional)"
        className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
      />
      <p className="mt-1 truncate text-[10px] text-slate-500">{img.url}</p>
    </div>
    <button
      onClick={() => onRemove(index)}
      className="rounded-md border border-red-400/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-red-200 transition hover:bg-red-400/10"
    >
      Quitar
    </button>
  </li>
)

const ScenarioImageEditor = ({ scenario, onChanged }) => {
  const [rows, setRows] = useState([])
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const dragIndex = useRef(-1)

  useEffect(() => {
    const initial = (scenario.images ?? [])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((img) => ({ url: img.url, label: img.label ?? '', sortOrder: img.sortOrder ?? 0 }))
    setRows(initial)
  }, [scenario])

  const addRow = () => {
    if (!url.trim()) return
    setRows((r) => [...r, { url: url.trim(), label: label.trim(), sortOrder: r.length }])
    setUrl('')
    setLabel('')
  }

  const removeRow = (idx) => {
    setRows((r) => r.filter((_, i) => i !== idx))
  }

  const setLabelAt = (idx, value) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, label: value } : row)))
  }

  const onDragStart = (_e, idx) => {
    dragIndex.current = idx
  }
  const onDragOver = (e, idx) => {
    e.preventDefault()
    // simple highlight? opcional
  }
  const onDrop = (_e, idx) => {
    const from = dragIndex.current
    if (from === -1 || from === idx) return
    setRows((r) => {
      const copy = r.slice()
      const [moved] = copy.splice(from, 1)
      copy.splice(idx, 0, moved)
      return copy
    })
    dragIndex.current = -1
  }

  const save = async () => {
    // recalcula sortOrder según posición
    const images = rows.map((r, i) => ({ ...r, sortOrder: i }))
    setSaving(true)
    try {
      await addScenarioImages(scenario.id, images)
      onChanged?.()
    } catch (e) {
      alert(e?.response?.data?.message || e.message || 'No se pudo guardar las imágenes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-3 grid grid-cols-5 gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://imagen..."
          className="col-span-3 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Etiqueta"
          className="col-span-2 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
        />
        <button
          onClick={addRow}
          className="col-span-5 mt-2 rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-emerald-400"
        >
          Agregar imagen
        </button>
      </div>

      <ul className="space-y-2">
        {rows.map((img, i) => (
          <Row
            key={`${img.url}-${i}`}
            img={img}
            index={i}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onRemove={removeRow}
            onLabel={setLabelAt}
          />
        ))}
        {!rows.length && (
          <li className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
            Aún no hay imágenes.
          </li>
        )}
      </ul>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar orden y etiquetas'}
        </button>
      </div>
    </div>
  )
}

export default ScenarioImageEditor
