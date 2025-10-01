"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import api from "../../api/client"

/* ================== ICONOS SVG ================== */
function IconImagePlus(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="1em" height="1em" {...props}>
      <path d="M21 15V5a2 2 0 0 0-2-2H7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="7" width="14" height="14" rx="2" ry="2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 13l-3 3 2 2 6-6 4 4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 3v4M5 5h4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconUpload(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="1em" height="1em" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 10l5-5 5 5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 15V5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconTrash(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="1em" height="1em" {...props}>
      <path d="M3 6h18" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ================== DATOS ================== */
const ALIGNMENTS = [
  { value: "", label: "Selecciona alineamiento" },
  { value: "LAWFUL_GOOD", label: "Legal Bueno" },
  { value: "NEUTRAL_GOOD", label: "Neutral Bueno" },
  { value: "CHAOTIC_GOOD", label: "Caotico Bueno" },
  { value: "LAWFUL_NEUTRAL", label: "Legal Neutral" },
  { value: "TRUE_NEUTRAL", label: "Neutral" },
  { value: "CHAOTIC_NEUTRAL", label: "Caotico Neutral" },
  { value: "LAWFUL_EVIL", label: "Legal Malvado" },
  { value: "NEUTRAL_EVIL", label: "Neutral Malvado" },
  { value: "CHAOTIC_EVIL", label: "Caotico Malvado" },
]

const TIERS = [
  { value: "COMMON", label: "Comun" },
  { value: "RARE", label: "Raro" },
  { value: "ELITE", label: "Elite" },
  { value: "LEGENDARY", label: "Legendario" },
]

const RESOURCE_OPTIONS = ["MANA", "ENERGY", "SPIRIT", "SOUL", "FOCUS", "RAGE"]

const INITIAL_ATTRIBUTES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

const initialForm = {
  name: "",
  tier: "COMMON",
  level: 1,
  alignment: "",
  raceId: "",
  classId: "",
  campaignId: "",
  portraitAssetId: "",
  portraitUrl: "",
  portraitFile: null,
  portraitPreview: "",
  // ← Transform guardado
  portraitTransform: { x: 0, y: 0, scale: 1 },
  armorClass: 10,
  maxHp: 10,
  speedValue: 6,
  background: "",
  behaviorNotes: "",
  fears: "",
  goalsShort: "",
  goalsLong: "",
  attributes: { ...INITIAL_ATTRIBUTES },
  resources: [],
}

/* ================== UI HELPERS ================== */
function Section({ title, children, description }) {
  return (
    <section className="group relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/90 p-6 shadow-xl shadow-cyan-900/20 transition-all duration-300 hover:border-cyan-400/50 hover:shadow-2xl hover:shadow-cyan-500/30">
      <div className="pointer-events-none absolute left-0 top-0 h-16 w-16 border-l-2 border-t-2 border-cyan-400/40 opacity-60 transition-opacity group-hover:opacity-100" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-16 w-16 border-b-2 border-r-2 border-cyan-400/40 opacity-60 transition-opacity group-hover:opacity-100" />
      <div className="relative z-10 mb-5">
        <h2 className="bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-xl font-bold uppercase tracking-wide text-transparent">
          {title}
        </h2>
        {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
      </div>
      <div className="relative z-10">{children}</div>
    </section>
  )
}

/* ================== Uploader + Ficha con PAN & ZOOM ================== */
function PortraitUploaderCard({ form, onChange, raceName, classLabel, alignmentLabel }) {
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  // Guardamos dimensiones naturales de la imagen para calcular límites.
  const naturalSizeRef = useRef({ w: 0, h: 0 })

  // Helpers de estado
  const setTransform = (patch) => {
    const next = { ...form.portraitTransform, ...patch }
    onChange({ portraitTransform: next })
  }
  const resetTransform = () => setTransform({ x: 0, y: 0, scale: 1 })
  const centerTransform = () => setTransform({ x: 0, y: 0 }) // centrado lógico

  // Al cargar imagen, registramos dimensiones
  const onImageLoad = () => {
    const img = imgRef.current
    if (!img) return
    naturalSizeRef.current = { w: img.naturalWidth || 0, h: img.naturalHeight || 0 }
    // Reiniciamos transform al cambiar imagen
    resetTransform()
    // Clamp inmediato por si dimensiones son extremas
    clampAndApply()
  }

  // Cálculo de límites para evitar bordes vacíos
  const calcBounds = () => {
    const cont = containerRef.current
    const { w: nw, h: nh } = naturalSizeRef.current
    if (!cont || !nw || !nh) return { maxX: 0, maxY: 0 }

    const C = cont.clientWidth // contenedor cuadrado (aspect-square)
    // Escala base por "cover" para llenar el cuadrado
    const baseScale = Math.max(C / nw, C / nh)
    // Escala total = base * zoom del usuario
    const totalScale = baseScale * (form.portraitTransform.scale || 1)

    const displayedW = nw * totalScale
    const displayedH = nh * totalScale

    const maxX = Math.max(0, (displayedW - C) / 2)
    const maxY = Math.max(0, (displayedH - C) / 2)
    return { maxX, maxY }
  }

  const clampAndApply = () => {
    const { maxX, maxY } = calcBounds()
    const x = Math.min(maxX, Math.max(-maxX, form.portraitTransform.x || 0))
    const y = Math.min(maxY, Math.max(-maxY, form.portraitTransform.y || 0))
    if (x !== form.portraitTransform.x || y !== form.portraitTransform.y) {
      setTransform({ x, y })
    }
  }

  /* -------- Drag: mouse + touch -------- */
  const dragState = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 })

  const onPointerDown = (clientX, clientY) => {
    dragState.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      baseX: form.portraitTransform.x || 0,
      baseY: form.portraitTransform.y || 0,
    }
  }
  const onPointerMove = (clientX, clientY) => {
    if (!dragState.current.active) return
    const dx = clientX - dragState.current.startX
    const dy = clientY - dragState.current.startY
    setTransform({ x: dragState.current.baseX + dx, y: dragState.current.baseY + dy })
  }
  const onPointerUp = () => {
    dragState.current.active = false
    clampAndApply()
  }

  // Mouse
  const onMouseDown = (e) => {
    e.preventDefault()
    onPointerDown(e.clientX, e.clientY)
  }
  const onMouseMove = (e) => onPointerMove(e.clientX, e.clientY)
  const onMouseUp = () => onPointerUp()

  // Touch
  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    onPointerDown(t.clientX, t.clientY)
  }
  const onTouchMove = (e) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    onPointerMove(t.clientX, t.clientY)
  }
  const onTouchEnd = () => onPointerUp()

  // Zoom con rueda
  const onWheel = (e) => {
    if (!containerRef.current) return
    e.preventDefault()
    const delta = -e.deltaY // rueda hacia arriba = zoom in
    const step = 0.05
    const next = Math.min(3, Math.max(1, (form.portraitTransform.scale || 1) + (delta > 0 ? step : -step)))
    setTransform({ scale: next })
    // Ajustamos límites tras el zoom
    requestAnimationFrame(clampAndApply)
  }

  // Manejo de archivo / URL
  const releasePreview = () => {
    if (form.portraitPreview && form.portraitPreview.startsWith("blob:")) {
      URL.revokeObjectURL(form.portraitPreview)
    }
  }
  const openPicker = () => inputRef.current?.click()
  const handleFile = (file) => {
    if (!file) return
    releasePreview()
    const preview = URL.createObjectURL(file)
    onChange({ portraitFile: file, portraitPreview: preview, portraitUrl: "", portraitAssetId: "" })
    // transform reseteado en onImageLoad
  }
  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith("image/")) handleFile(file)
  }
  const onPasteUrl = (e) => {
    releasePreview()
    const value = e.target.value
    onChange({ portraitUrl: value, portraitFile: null, portraitPreview: value || "", portraitAssetId: "" })
    // transform reseteado en onImageLoad
  }
  const clearImage = () => {
    releasePreview()
    onChange({ portraitFile: null, portraitPreview: "", portraitUrl: "", portraitAssetId: "", portraitTransform: { x: 0, y: 0, scale: 1 } })
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`relative rounded-2xl border-2 border-dashed p-5 transition-all duration-300 ${dragOver ? "border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/30" : "border-slate-700 bg-slate-900/60 hover:border-slate-600"}`}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-cyan-500/30 bg-gradient-to-br from-slate-950/90 to-slate-900/70 shadow-inner">
              <IconImagePlus className="h-8 w-8 text-cyan-300/90" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">Arrastre una imagen o use los botones</p>
              <p className="text-xs text-slate-400">JPG/PNG/WebP · Recomendado 1:1 (≥512px)</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openPicker}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-md transition-all duration-200 hover:scale-105 hover:border-cyan-400/60 hover:shadow-lg hover:shadow-cyan-500/30"
            >
              <IconUpload className="h-4 w-4" />
              Subir archivo
            </button>
            <button
              type="button"
              onClick={clearImage}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-gradient-to-r from-red-600/20 to-pink-600/20 px-4 py-2 text-sm font-semibold text-red-200 shadow-md transition-all duration-200 hover:scale-105 hover:border-red-400/60 hover:shadow-lg hover:shadow-red-500/30"
            >
              <IconTrash className="h-4 w-4" />
              Quitar
            </button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">URL de imagen</label>
              <input
                value={form.portraitUrl}
                onChange={onPasteUrl}
                placeholder="https://..."
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Asset ID (opcional)</label>
              <input
                value={form.portraitAssetId}
                onChange={(e) => onChange({ portraitAssetId: e.target.value })}
                placeholder="UUID del asset"
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Controles de Zoom y Posición */}
        <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/60 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Zoom</label>
              <input
                type="range"
                min="1" max="3" step="0.01"
                value={form.portraitTransform.scale}
                onChange={(e) => { setTransform({ scale: Number(e.target.value) }); requestAnimationFrame(clampAndApply) }}
                className="mt-2 w-full accent-cyan-400"
              />
              <div className="mt-1 text-xs text-slate-400">Escala: <span className="font-semibold text-cyan-300">{form.portraitTransform.scale.toFixed(2)}×</span></div>
            </div>
            <div className="flex items-end gap-2">
              <button type="button" onClick={centerTransform} className="flex-1 rounded-lg border border-slate-600/50 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500">
                Centrar
              </button>
              <button type="button" onClick={resetTransform} className="flex-1 rounded-lg border border-cyan-500/50 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-cyan-200 hover:border-cyan-400">
                Reiniciar
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Arrastre la imagen para moverla. Use la rueda del mouse o el slider para acercar/alejar.</p>
        </div>
      </div>

      {/* Vista previa a la derecha con PAN & ZOOM */}
      <div className="md:sticky md:top-4">
        <div className="group relative overflow-hidden rounded-2xl border-2 border-cyan-500/40 bg-gradient-to-br from-slate-900/90 to-slate-950/90 shadow-2xl shadow-cyan-900/30 transition-all duration-300 hover:border-cyan-400/60 hover:shadow-cyan-500/40">
          <div className="pointer-events-none absolute left-0 top-0 z-20 h-12 w-12 border-l-2 border-t-2 border-cyan-300/60" />
          <div className="pointer-events-none absolute bottom-0 right-0 z-20 h-12 w-12 border-b-2 border-r-2 border-cyan-300/60" />

          <div
            ref={containerRef}
            className="relative aspect-square w-full overflow-hidden bg-slate-950/90 select-none"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseUp}
            onMouseUp={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onWheel={onWheel}
          >
            {form.portraitPreview ? (
              <img
                ref={imgRef}
                src={form.portraitPreview || "/placeholder.svg"}
                alt="Retrato"
                className="h-full w-full object-contain will-change-transform"
                style={{
                  transform: `translate(${form.portraitTransform.x || 0}px, ${form.portraitTransform.y || 0}px) scale(${form.portraitTransform.scale || 1})`,
                  transformOrigin: "center center",
                }}
                draggable={false}
                onLoad={onImageLoad}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-600">
                <IconImagePlus className="h-12 w-12 animate-pulse" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
          </div>

          <div className="relative z-10 border-t border-cyan-500/30 bg-gradient-to-b from-slate-900/95 to-slate-950/95 p-5">
            <h3 className="bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-2xl font-bold text-transparent">
              {form.name || "NPC sin nombre"}
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-cyan-500/20 bg-slate-900/60 px-3 py-2 shadow-inner">
                <span className="text-slate-400">Nivel:</span>{" "}
                <span className="ml-1 font-bold text-cyan-300">{Number(form.level) || 1}</span>
              </div>
              <div className="rounded-lg border border-cyan-500/20 bg-slate-900/60 px-3 py-2 shadow-inner">
                <span className="text-slate-400">Raza:</span>{" "}
                <span className="ml-1 font-bold text-cyan-300">{raceName || "-"}</span>
              </div>
              <div className="rounded-lg border border-cyan-500/20 bg-slate-900/60 px-3 py-2 shadow-inner">
                <span className="text-slate-400">Clase:</span>{" "}
                <span className="ml-1 font-bold text-cyan-300">{classLabel || "-"}</span>
              </div>
              <div className="rounded-lg border border-cyan-500/20 bg-slate-900/60 px-3 py-2 shadow-inner">
                <span className="text-slate-400">Aline.:</span>{" "}
                <span className="ml-1 font-bold text-cyan-300">{alignmentLabel || "-"}</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-purple-500/30 bg-gradient-to-br from-purple-900/30 to-slate-900/60 px-3 py-2 text-center shadow-md">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-purple-300">CA</div>
                <div className="mt-1 text-lg font-bold text-purple-100">{form.armorClass}</div>
              </div>
              <div className="rounded-lg border border-red-500/30 bg-gradient-to-br from-red-900/30 to-slate-900/60 px-3 py-2 text-center shadow-md">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-red-300">PV</div>
                <div className="mt-1 text-lg font-bold text-red-100">{form.maxHp}</div>
              </div>
              <div className="rounded-lg border border-green-500/30 bg-gradient-to-br from-green-900/30 to-slate-900/60 px-3 py-2 text-center shadow-md">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-green-300">Vel</div>
                <div className="mt-1 text-lg font-bold text-green-100">{form.speedValue}</div>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-slate-500">
          La ficha se guarda cuando presione <span className="font-bold text-cyan-300">Guardar NPC</span>.
        </p>
      </div>
    </div>
  )
}

/* ================== Componente principal ================== */
export default function NpcCreate() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [catalog, setCatalog] = useState({ races: [], classes: [], campaigns: [] })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const [raceRes, classRes, campaignRes] = await Promise.all([
          api.get("/catalog/races"),
          api.get("/catalog/classes"),
          api.get("/campaigns", { params: { role: "DM" } }),
        ])
        setCatalog({ races: raceRes.data || [], classes: classRes.data || [], campaigns: campaignRes.data || [] })
      } catch (e) {
        console.error("Catalog fetch error", e)
      }
    }
    loadCatalog()
  }, [])

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  const handlePortraitChange = (patch) => setForm((prev) => ({ ...prev, ...patch }))
  const handleAttributeChange = (key, value) => {
    const numeric = Number(value)
    setForm((prev) => ({
      ...prev,
      attributes: { ...prev.attributes, [key]: Number.isNaN(numeric) ? prev.attributes[key] : numeric },
    }))
  }
  const handleResourceChange = (index, key, value) => {
    setForm((prev) => {
      const next = prev.resources.map((item, idx) => {
        if (idx !== index) return item
        if (key === "current" || key === "max") {
          const numeric = Number(value)
          return { ...item, [key]: Number.isNaN(numeric) ? item[key] : numeric }
        }
        return { ...item, [key]: value }
      })
      return { ...prev, resources: next }
    })
  }
  const addResource = () =>
    setForm((prev) => ({ ...prev, resources: [...prev.resources, { resource: RESOURCE_OPTIONS[0], current: 0, max: 0 }] }))
  const removeResource = (index) =>
    setForm((prev) => ({ ...prev, resources: prev.resources.filter((_, idx) => idx !== index) }))
  const resetForm = () => {
    if (form.portraitPreview && form.portraitPreview.startsWith("blob:")) {
      URL.revokeObjectURL(form.portraitPreview)
    }
    setForm(initialForm)
    setError(null)
  }

  const campaignOptions = useMemo(() => [{ id: "", name: "Sin campana" }, ...catalog.campaigns], [catalog.campaigns])
  const alignmentLabel = useMemo(() => ALIGNMENTS.find((a) => a.value === form.alignment)?.label || "", [form.alignment])
  const raceName = useMemo(() => catalog.races.find((r) => r.id === form.raceId)?.name || "", [catalog.races, form.raceId])
  const classLabel = useMemo(() => catalog.classes.find((c) => c.id === form.classId)?.name || "", [catalog.classes, form.classId])

  const submit = async (evt) => {
    evt.preventDefault()
    if (!form.name.trim()) {
      setError("El nombre es obligatorio.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      let portraitAssetId = form.portraitAssetId?.trim() || null
      const portraitUrl = form.portraitUrl?.trim() || null

      if (!portraitAssetId && form.portraitFile) {
        const fd = new FormData()
        fd.append("kind", "image")
        fd.append("file", form.portraitFile)
        const media = await api.post("/media", fd, { headers: { "Content-Type": "multipart/form-data" } })
        portraitAssetId = media?.data?.id || portraitAssetId
      }

      if (!portraitAssetId && portraitUrl) {
        const media = await api.post("/media", { kind: "image", url: portraitUrl })
        portraitAssetId = media?.data?.id || portraitAssetId
      }

      const payload = {
        name: form.name.trim(),
        tier: form.tier,
        level: Number(form.level) || 1,
        alignment: form.alignment || null,
        raceId: form.raceId || null,
        classId: form.classId || null,
        campaignId: form.campaignId || null,
        portraitAssetId: portraitAssetId || null,
        armorClass: Number(form.armorClass) || 10,
        maxHp: Number(form.maxHp) || 10,
        speedValue: Number(form.speedValue) || 6,
        background: form.background || null,
        behaviorNotes: form.behaviorNotes || null,
        fears: form.fears || null,
        goalsShort: form.goalsShort || null,
        goalsLong: form.goalsLong || null,
        attributes: form.attributes,
        resources: form.resources
          .filter((res) => res.resource && RESOURCE_OPTIONS.includes(res.resource))
          .map((res) => ({ resource: res.resource, current: Number(res.current) || 0, max: Number(res.max) || 0 })),
        // ← Persistimos el transform
        portraitTransform: form.portraitTransform || { x: 0, y: 0, scale: 1 },
      }

      await api.post("/npcs", payload)
      resetForm()
      navigate("/dm/npcs")
    } catch (e) {
      console.error(e)
      const message = e?.response?.data?.error || "No pudimos crear el NPC."
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="min-h-screen space-y-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-slate-900/80 via-slate-800/60 to-slate-900/80 p-6 shadow-2xl shadow-cyan-900/20">
        <div>
          <h1 className="bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-400 bg-clip-text text-4xl font-black uppercase tracking-tight text-transparent drop-shadow-lg">
            Crear NPC
          </h1>
          <p className="mt-1 text-sm text-slate-400">Complete la ficha para registrar un nuevo personaje.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-600/50 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-300 shadow-md transition-all duration-200 hover:scale-105 hover:border-slate-500 hover:bg-slate-800/70 hover:text-white"
          >
            Volver
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="relative overflow-hidden rounded-lg border border-cyan-400/50 bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-cyan-500/40 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/60 disabled:opacity-60 disabled:hover:scale-100"
          >
            <span className="relative z-10">{submitting ? "Guardando..." : "Guardar NPC"}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity hover:opacity-100" />
          </button>
        </div>
      </header>

      {error && (
        <div className="animate-pulse rounded-lg border border-red-500/50 bg-gradient-to-r from-red-900/30 to-pink-900/30 px-4 py-3 text-sm font-semibold text-red-200 shadow-lg shadow-red-900/30">
          {error}
        </div>
      )}

      <Section title="Identidad">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Nombre</label>
            <input
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Nombre del NPC"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Rango</label>
            <select
              value={form.tier}
              onChange={(e) => handleChange("tier", e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            >
              {TIERS.map((tier) => (
                <option key={tier.value} value={tier.value}>
                  {tier.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Nivel</label>
            <input
              type="number"
              min="1"
              value={form.level}
              onChange={(e) => handleChange("level", Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Alineamiento</label>
            <select
              value={form.alignment}
              onChange={(e) => handleChange("alignment", e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            >
              {ALIGNMENTS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Raza</label>
            <select
              value={form.raceId}
              onChange={(e) => handleChange("raceId", e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            >
              <option value="">Sin raza definida</option>
              {catalog.races.map((race) => (
                <option key={race.id} value={race.id}>
                  {race.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Clase</label>
            <select
              value={form.classId}
              onChange={(e) => handleChange("classId", e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            >
              <option value="">Sin clase definida</option>
              {catalog.classes.map((klass) => (
                <option key={klass.id} value={klass.id}>
                  {klass.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Campana</label>
            <select
              value={form.campaignId}
              onChange={(e) => handleChange("campaignId", e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            >
              {campaignOptions.map((camp) => (
                <option key={camp.id || "none"} value={camp.id}>
                  {camp.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Historia y notas">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Historia</label>
            <textarea
              value={form.background}
              onChange={(e) => handleChange("background", e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Notas de comportamiento</label>
            <textarea
              value={form.behaviorNotes}
              onChange={(e) => handleChange("behaviorNotes", e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Temores</label>
            <textarea
              value={form.fears}
              onChange={(e) => handleChange("fears", e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Objetivos a corto plazo</label>
            <textarea
              value={form.goalsShort}
              onChange={(e) => handleChange("goalsShort", e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Objetivos a largo plazo</label>
            <textarea
              value={form.goalsLong}
              onChange={(e) => handleChange("goalsLong", e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            />
          </div>
        </div>
      </Section>

      <Section title="Atributos y combate">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Clase de armadura</label>
            <input
              type="number"
              value={form.armorClass}
              onChange={(e) => handleChange("armorClass", Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Puntos de golpe</label>
            <input
              type="number"
              value={form.maxHp}
              onChange={(e) => handleChange("maxHp", Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Velocidad</label>
            <input
              type="number"
              value={form.speedValue}
              onChange={(e) => handleChange("speedValue", Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-6">
          {Object.keys(form.attributes).map((key) => (
            <div key={key} className="group relative overflow-hidden rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-slate-900/60 px-3 py-3 shadow-md transition-all duration-200 hover:scale-105 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/30">
              <label className="text-xs font-bold uppercase tracking-wider text-purple-300">{key}</label>
              <input
                type="number"
                value={form.attributes[key]}
                onChange={(e) => handleAttributeChange(key, e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/90 px-2 py-1 text-center text-lg font-bold text-purple-100 shadow-inner transition-all focus:border-purple-500 focus:shadow-purple-500/30 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Recursos">
        <div className="space-y-3">
          {form.resources.map((res, index) => (
            <div key={`${res.resource}-${index}`} className="grid gap-3 rounded-xl border border-cyan-500/30 bg-slate-900/60 px-4 py-3 shadow-md md:grid-cols-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Tipo</label>
                <select
                  value={res.resource}
                  onChange={(e) => handleResourceChange(index, "resource", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/90 px-2 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
                >
                  {RESOURCE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Actual</label>
                <input
                  type="number"
                  value={res.current}
                  onChange={(e) => handleResourceChange(index, "current", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/90 px-2 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Maximo</label>
                <input
                  type="number"
                  value={res.max}
                  onChange={(e) => handleResourceChange(index, "max", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/90 px-2 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
                />
              </div>
              <div className="flex items-end justify-end">
                <button
                  type="button"
                  onClick={() => removeResource(index)}
                  className="rounded-lg border border-red-500/50 bg-red-900/30 px-3 py-2 text-xs font-semibold text-red-200 shadow-md transition-all duration-200 hover:scale-105 hover:bg-red-900/50 hover:shadow-red-500/30"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, resources: [...prev.resources, { resource: RESOURCE_OPTIONS[0], current: 0, max: 0 }] }))}
            className="rounded-lg border border-cyan-500/40 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 px-4 py-2 text-sm font-semibold text-cyan-200 shadow-md transition-all duration-200 hover:scale-105 hover:border-cyan-400/60 hover:shadow-lg hover:shadow-cyan-500/30"
          >
            Agregar recurso
          </button>
        </div>
      </Section>

      <Section title="Imagen y ficha" description="Suba o pegue una imagen. Puede arrastrar para mover y hacer zoom para centrar.">
        <PortraitUploaderCard
          form={form}
          onChange={handlePortraitChange}
          raceName={raceName}
          classLabel={classLabel}
          alignmentLabel={alignmentLabel}
        />
      </Section>
    </form>
  )
}
