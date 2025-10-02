'use client'

import { useRef, useState } from "react"

export const isBlobUrl = (value) => typeof value === "string" && value.startsWith("blob:")

const DEFAULT_TRANSFORM = { x: 0, y: 0, scale: 1 }

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

const gridClassFor = (items) => {
  if (items <= 1) return "grid-cols-1"
  if (items === 2) return "grid-cols-2"
  if (items === 3) return "grid-cols-3"
  return "grid-cols-2"
}

export function PortraitUploaderCard({
  form,
  onChange,
  raceName,
  classLabel,
  alignmentLabel,
  titlePlaceholder = "NPC sin nombre",
  summaryBadges,
  bottomMetrics,
  footerNote = "La ficha se guarda cuando presione Guardar NPC.",
}) {
  const safeForm = form || {}
  const transform = safeForm.portraitTransform || DEFAULT_TRANSFORM
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const naturalSizeRef = useRef({ w: 0, h: 0 })

  const mergeTransform = (patch) => {
    const current = safeForm.portraitTransform || DEFAULT_TRANSFORM
    const next = { ...current, ...patch }
    onChange?.({ portraitTransform: next })
  }
  const resetTransform = () => mergeTransform({ x: 0, y: 0, scale: 1 })
  const centerTransform = () => mergeTransform({ x: 0, y: 0 })

  const onImageLoad = () => {
    const img = imgRef.current
    if (!img) return
    naturalSizeRef.current = { w: img.naturalWidth || 0, h: img.naturalHeight || 0 }
    resetTransform()
    clampAndApply()
  }

  const calcBounds = () => {
    const cont = containerRef.current
    const { w: nw, h: nh } = naturalSizeRef.current
    if (!cont || !nw || !nh) return { maxX: 0, maxY: 0 }

    const C = cont.clientWidth
    const baseScale = Math.max(C / nw, C / nh)
    const scale = typeof transform.scale === "number" ? transform.scale : 1
    const totalScale = baseScale * scale

    const displayedW = nw * totalScale
    const displayedH = nh * totalScale

    const maxX = Math.max(0, (displayedW - C) / 2)
    const maxY = Math.max(0, (displayedH - C) / 2)
    return { maxX, maxY }
  }

  const clampAndApply = () => {
    const { maxX, maxY } = calcBounds()
    const x = Math.min(maxX, Math.max(-maxX, transform.x || 0))
    const y = Math.min(maxY, Math.max(-maxY, transform.y || 0))
    if (x !== transform.x || y !== transform.y) {
      mergeTransform({ x, y })
    }
  }

  const dragState = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 })

  const onPointerDown = (clientX, clientY) => {
    dragState.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      baseX: transform.x || 0,
      baseY: transform.y || 0,
    }
  }
  const onPointerMove = (clientX, clientY) => {
    if (!dragState.current.active) return
    const dx = clientX - dragState.current.startX
    const dy = clientY - dragState.current.startY
    mergeTransform({ x: dragState.current.baseX + dx, y: dragState.current.baseY + dy })
  }
  const onPointerUp = () => {
    dragState.current.active = false
    clampAndApply()
  }

  const onMouseDown = (e) => {
    e.preventDefault()
    onPointerDown(e.clientX, e.clientY)
  }
  const onMouseMove = (e) => onPointerMove(e.clientX, e.clientY)
  const onMouseUp = () => onPointerUp()

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

  const onWheel = (e) => {
    if (!containerRef.current) return
    e.preventDefault()
    const delta = -e.deltaY
    const step = 0.05
    const currentScale = typeof transform.scale === "number" ? transform.scale : 1
    const next = Math.min(3, Math.max(1, currentScale + (delta > 0 ? step : -step)))
    mergeTransform({ scale: next })
    requestAnimationFrame(clampAndApply)
  }

  const releasePreview = () => {
    if (isBlobUrl(safeForm.portraitPreview)) {
      URL.revokeObjectURL(safeForm.portraitPreview)
    }
  }
  const openPicker = () => inputRef.current?.click()
  const handleFile = (file) => {
    if (!file) return
    releasePreview()
    const preview = URL.createObjectURL(file)
    onChange?.({ portraitFile: file, portraitPreview: preview, portraitUrl: "", portraitAssetId: "" })
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
    onChange?.({ portraitUrl: value, portraitFile: null, portraitPreview: value || "", portraitAssetId: "" })
  }
  const clearImage = () => {
    releasePreview()
    onChange?.({
      portraitFile: null,
      portraitPreview: "",
      portraitUrl: "",
      portraitAssetId: "",
      portraitTransform: { ...DEFAULT_TRANSFORM },
    })
  }

  const computedSummary = summaryBadges ?? [
    { label: "Nivel", value: Number(safeForm.level) || 1 },
    { label: "Raza", value: raceName || "-" },
    { label: "Clase", value: classLabel || "-" },
    { label: "Aline.", value: alignmentLabel || "-" },
  ]

  const computedMetrics = bottomMetrics ?? [
    { label: "CA", value: safeForm.armorClass },
    { label: "PV", value: safeForm.maxHp },
    { label: "Vel", value: safeForm.speedValue },
  ]

  const summaryGrid = gridClassFor(computedSummary.length)
  const metricsGrid = gridClassFor(computedMetrics.length)
  const displayScale = typeof transform.scale === "number" ? transform.scale : 1

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`relative rounded-2xl border-2 border-dashed p-5 transition-all duration-300 ${dragOver ? "border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/30" : "border-slate-700 bg-slate-900/60 hover:border-slate-600"}`}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-cyan-500/30 bg-gradient-to-br from-slate-950/90 to-slate-900/70 shadow-inner">
              <IconImagePlus className="h-8 w-8 text-cyan-300/90" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">Arrastra una imagen o usa los botones</p>
              <p className="text-xs text-slate-400">JPG/PNG/WebP - Sugerido 1:1 (>=512px)</p>
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
                value={safeForm.portraitUrl || ""}
                onChange={onPasteUrl}
                placeholder="https://..."
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Asset ID (opcional)</label>
              <input
                value={safeForm.portraitAssetId || ""}
                onChange={(e) => onChange?.({ portraitAssetId: e.target.value })}
                placeholder="UUID del asset"
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/60 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Zoom</label>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={displayScale}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  mergeTransform({ scale: Number.isNaN(next) ? 1 : next })
                  requestAnimationFrame(clampAndApply)
                }}
                className="mt-2 w-full accent-cyan-400"
              />
              <div className="mt-1 text-xs text-slate-400">
                Escala: <span className="font-semibold text-cyan-300">{displayScale.toFixed(2)}x</span>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={centerTransform}
                className="flex-1 rounded-lg border border-slate-600/50 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500"
              >
                Centrar
              </button>
              <button
                type="button"
                onClick={resetTransform}
                className="flex-1 rounded-lg border border-cyan-500/50 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-cyan-200 hover:border-cyan-400"
              >
                Reiniciar
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Arrastra la imagen para moverla. Usa la rueda del mouse o el control deslizante para acercar o alejar.
          </p>
        </div>
      </div>

      <div className="md:sticky md:top-4">
        <div className="group relative overflow-hidden rounded-2xl border-2 border-cyan-500/40 bg-gradient-to-br from-slate-900/90 to-slate-950/90 shadow-2xl shadow-cyan-900/30 transition-all duration-300 hover:border-cyan-400/60 hover:shadow-cyan-500/40">
          <div className="pointer-events-none absolute left-0 top-0 z-20 h-12 w-12 border-l-2 border-t-2 border-cyan-300/60" />
          <div className="pointer-events-none absolute bottom-0 right-0 z-20 h-12 w-12 border-b-2 border-r-2 border-cyan-300/60" />

          <div
            ref={containerRef}
            className="relative aspect-square w-full select-none overflow-hidden bg-slate-950/90"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseUp}
            onMouseUp={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onWheel={onWheel}
          >
            {safeForm.portraitPreview ? (
              <img
                ref={imgRef}
                src={safeForm.portraitPreview || "/placeholder.svg"}
                alt="Retrato"
                className="h-full w-full object-contain will-change-transform"
                style={{
                  transform: `translate(${transform.x || 0}px, ${transform.y || 0}px) scale(${displayScale})`,
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
              {safeForm.name || titlePlaceholder}
            </h3>
            <div className={`mt-3 grid gap-2 text-xs ${summaryGrid}`}>
              {computedSummary.map((item) => (
                <div key={item.label} className="rounded-lg border border-cyan-500/20 bg-slate-900/60 px-3 py-2 shadow-inner">
                  <span className="text-slate-400">{item.label}:</span>{" "}
                  <span className="ml-1 font-bold text-cyan-300">{item.value ?? "-"}</span>
                </div>
              ))}
            </div>
            {computedMetrics.length > 0 && (
              <div className={`mt-4 grid gap-2 text-xs ${metricsGrid}`}>
                {computedMetrics.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-purple-500/30 bg-gradient-to-br from-purple-900/30 to-slate-900/60 px-3 py-2 text-center shadow-md"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-purple-300">{item.label}</div>
                    <div className="mt-1 text-lg font-bold text-purple-100">{item.value ?? "-"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {footerNote && <p className="mt-3 text-center text-[11px] text-slate-500">{footerNote}</p>}
      </div>
    </div>
  )
}
