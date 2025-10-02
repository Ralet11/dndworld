"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import api from "../../../api/client"
import { PortraitUploaderCard, isBlobUrl } from "../../../components/PortraitUploaderCard"

/* ================== CATÁLOGOS / CONSTANTES ================== */
export const ALIGNMENTS = [
  { value: "", label: "Selecciona alineamiento" },
  { value: "LAWFUL_GOOD", label: "Legal Bueno" },
  { value: "NEUTRAL_GOOD", label: "Neutral Bueno" },
  { value: "CHAOTIC_GOOD", label: "Caótico Bueno" },
  { value: "LAWFUL_NEUTRAL", label: "Legal Neutral" },
  { value: "TRUE_NEUTRAL", label: "Neutral" },
  { value: "CHAOTIC_NEUTRAL", label: "Caótico Neutral" },
  { value: "LAWFUL_EVIL", label: "Legal Malvado" },
  { value: "NEUTRAL_EVIL", label: "Neutral Malvado" },
  { value: "CHAOTIC_EVIL", label: "Caótico Malvado" },
]

export const TIERS = [
  { value: "COMMON", label: "Común" },
  { value: "RARE", label: "Raro" },
  { value: "ELITE", label: "Élite" },
  { value: "LEGENDARY", label: "Legendario" },
]

const INITIAL_ATTRIBUTES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

export const RESOURCE_OPTIONS = ["MANA", "ENERGY", "SPIRIT", "SOUL", "FOCUS", "RAGE"]

export const NPC_FORM_TEMPLATE = {
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

function buildInitialForm(initialValues = {}) {
  const base = {
    ...NPC_FORM_TEMPLATE,
    ...initialValues,
    portraitTransform: {
      ...NPC_FORM_TEMPLATE.portraitTransform,
      ...(initialValues?.portraitTransform || {}),
    },
    attributes: {
      ...NPC_FORM_TEMPLATE.attributes,
      ...(initialValues?.attributes || {}),
    },
  }

  const resources = Array.isArray(initialValues?.resources)
    ? initialValues.resources.map((res) => ({
        resource: res.resource ?? RESOURCE_OPTIONS[0],
        current: Number.isFinite(res.current) ? res.current : Number(res.current) || 0,
        max: Number.isFinite(res.max) ? res.max : Number(res.max) || 0,
      }))
    : []

  return { ...base, resources }
}

/* ================== Formulario principal ================== */
export default function NpcForm({
  mode = "create",
  initialValues = {},
  catalog = { races: [], classes: [], campaigns: [] },
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState(() => buildInitialForm(initialValues))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    setForm((prev) => {
      if (isBlobUrl(prev.portraitPreview)) {
        URL.revokeObjectURL(prev.portraitPreview)
      }
      return buildInitialForm(initialValues)
    })
  }, [initialValues])

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (isBlobUrl(form.portraitPreview)) {
        URL.revokeObjectURL(form.portraitPreview)
      }
    }
  }, [form.portraitPreview])

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  const handlePortraitChange = (patch) => setForm((prev) => ({ ...prev, ...patch }))
  const handleAttributeChange = (key, value) => {
    const numeric = Number(value)
    setForm((prev) => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [key]: Number.isNaN(numeric) ? prev.attributes[key] : numeric,
      },
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
    setForm((prev) => ({
      ...prev,
      resources: [...prev.resources, { resource: RESOURCE_OPTIONS[0], current: 0, max: 0 }],
    }))
  const removeResource = (index) =>
    setForm((prev) => ({
      ...prev,
      resources: prev.resources.filter((_, idx) => idx !== index),
    }))

  const campaignOptions = useMemo(
    () => [{ id: "", name: "Sin campaña" }, ...(catalog.campaigns || [])],
    [catalog.campaigns],
  )
  const resourceOptions = useMemo(() => {
    const extras = form.resources
      .map((res) => res.resource)
      .filter((res) => res && !RESOURCE_OPTIONS.includes(res))
    const uniqueExtras = Array.from(new Set(extras))
    return [...RESOURCE_OPTIONS, ...uniqueExtras]
  }, [form.resources])
  const alignmentLabel = useMemo(
    () => ALIGNMENTS.find((a) => a.value === form.alignment)?.label || "",
    [form.alignment],
  )
  const raceName = useMemo(
    () => (catalog.races || []).find((r) => r.id === form.raceId)?.name || "",
    [catalog.races, form.raceId],
  )
  const classLabel = useMemo(
    () => (catalog.classes || []).find((c) => c.id === form.classId)?.name || "",
    [catalog.classes, form.classId],
  )

  const handleSubmit = async (evt) => {
    evt.preventDefault()
    if (!form.name.trim()) {
      setError("El nombre es obligatorio.")
      return
    }
    if (mountedRef.current) {
      setSubmitting(true)
      setError(null)
    }
    try {
      let portraitAssetId = form.portraitAssetId?.trim() || null
      const portraitUrl = form.portraitUrl?.trim() || null

      if (!portraitAssetId && form.portraitFile) {
        const fd = new FormData()
        fd.append("kind", "image")
        fd.append("file", form.portraitFile)
        const media = await api.post("/media", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        })
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
          .filter((res) => res.resource)
          .map((res) => ({
            resource: res.resource,
            current: Number(res.current) || 0,
            max: Number(res.max) || 0,
          })),
        portraitTransform: form.portraitTransform || { x: 0, y: 0, scale: 1 },
      }

      if (typeof onSave === "function") {
        await onSave(payload)
      }
    } catch (e) {
      console.error(e)
      const message = e?.response?.data?.error || "No pudimos guardar el NPC."
      if (mountedRef.current) {
        setError(message)
      }
      return
    } finally {
      if (mountedRef.current) {
        setSubmitting(false)
      }
    }
  }

  const title = mode === "edit" ? "Editar NPC" : "Crear NPC"
  const submitLabel = submitting ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Guardar NPC"

  return (
    <form onSubmit={handleSubmit} className="min-h-screen space-y-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-slate-900/80 via-slate-800/60 to-slate-900/80 p-6 shadow-2xl shadow-cyan-900/20">
        <div>
          <h1 className="bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-400 bg-clip-text text-4xl font-black uppercase tracking-tight text-transparent drop-shadow-lg">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-400">Complete la ficha para registrar la información del personaje.</p>
        </div>
        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-600/50 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-300 shadow-md transition-all duration-200 hover:scale-105 hover:border-slate-500 hover:bg-slate-800/70 hover:text-white"
            >
              Volver
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="relative overflow-hidden rounded-lg border border-cyan-400/50 bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-cyan-500/40 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/60 disabled:opacity-60 disabled:hover:scale-100"
          >
            <span className="relative z-10">{submitLabel}</span>
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
              {ALIGNMENTS.map((alignment) => (
                <option key={alignment.value} value={alignment.value}>
                  {alignment.label}
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
              <option value="">Sin raza</option>
              {(catalog.races || []).map((race) => (
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
              <option value="">Sin clase</option>
              {(catalog.classes || []).map((klass) => (
                <option key={klass.id} value={klass.id}>
                  {klass.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Campaña</label>
            <select
              value={form.campaignId}
              onChange={(e) => handleChange("campaignId", e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            >
              {campaignOptions.map((campaign, index) => (
                <option key={campaign.id || `none-${index}`} value={campaign.id}>
                  {campaign.name || "Sin campaña"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Retrato" description="Suba un retrato cuadrado y ajuste la posición para generar la ficha visual.">
        <PortraitUploaderCard
          form={form}
          onChange={handlePortraitChange}
          raceName={raceName}
          classLabel={classLabel}
          alignmentLabel={alignmentLabel}
        />
      </Section>

      <Section title="Historia y notas">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Antecedentes</label>
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
            <div
              key={key}
              className="group relative overflow-hidden rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-slate-900/60 px-3 py-3 shadow-md transition-all duration-200 hover:scale-105 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/30"
            >
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
            <div
              key={`${res.resource}-${index}`}
              className="grid gap-3 rounded-xl border border-cyan-500/30 bg-slate-900/60 px-4 py-3 shadow-md md:grid-cols-4"
            >
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Tipo</label>
                <select
                  value={res.resource}
                  onChange={(e) => handleResourceChange(index, "resource", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/90 px-2 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
                >
                  {resourceOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
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
                <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Máximo</label>
                <input
                  type="number"
                  value={res.max}
                  onChange={(e) => handleResourceChange(index, "max", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/90 px-2 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => removeResource(index)}
                  className="w-full rounded-lg border border-red-500/40 bg-gradient-to-r from-red-600/20 to-pink-600/20 px-3 py-2 text-sm font-semibold text-red-200 shadow-md transition-all duration-200 hover:scale-105 hover:border-red-400/60 hover:shadow-lg hover:shadow-red-500/30"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addResource}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-md transition-all duration-200 hover:scale-105 hover:border-cyan-400/60 hover:shadow-lg hover:shadow-cyan-500/30"
        >
          Añadir recurso
        </button>
      </Section>
    </form>
  )
}





