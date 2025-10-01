"use client"

import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import api from "../../api/client"
import {
  StrengthIcon,
  DexterityIcon,
  ConstitutionIcon,
  IntelligenceIcon,
  WisdomIcon,
  CharismaIcon,
} from "../../icons/attributeIcons"

const ALIGNMENT_LABELS = {
  LAWFUL_GOOD: "Legal Bueno",
  NEUTRAL_GOOD: "Neutral Bueno",
  CHAOTIC_GOOD: "Caótico Bueno",
  LAWFUL_NEUTRAL: "Legal Neutral",
  TRUE_NEUTRAL: "Neutral",
  CHAOTIC_NEUTRAL: "Caótico Neutral",
  LAWFUL_EVIL: "Legal Malvado",
  NEUTRAL_EVIL: "Neutral Malvado",
  CHAOTIC_EVIL: "Caótico Malvado",
}

const TIER_LABELS = {
  COMMON: "Común",
  RARE: "Raro",
  ELITE: "Élite",
  LEGENDARY: "Legendario",
}

const TIER_GRADIENT = {
  COMMON: "from-slate-700/80 to-slate-900/90 border-slate-500/60 shadow-slate-500/30",
  RARE: "from-blue-600/50 to-slate-900/90 border-blue-400/60 shadow-blue-500/40",
  ELITE: "from-purple-600/50 to-slate-900/90 border-purple-400/60 shadow-purple-500/40",
  LEGENDARY: "from-amber-500/50 to-slate-900/90 border-amber-400/70 shadow-amber-500/50",
}

const RESOURCE_LABELS = {
  MANA: "Maná",
  ENERGY: "Energía",
  SPIRIT: "Espíritu",
  SOUL: "Alma",
  FOCUS: "Concentración",
  RAGE: "Ira",
}

const ATTRIBUTE_CONFIG = [
  { key: "str", label: "Fuerza", Icon: StrengthIcon },
  { key: "dex", label: "Destreza", Icon: DexterityIcon },
  { key: "con", label: "Constitución", Icon: ConstitutionIcon },
  { key: "int", label: "Inteligencia", Icon: IntelligenceIcon },
  { key: "wis", label: "Sabiduría", Icon: WisdomIcon },
  { key: "cha", label: "Carisma", Icon: CharismaIcon },
]

function AttributeGrid({ attributes }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ATTRIBUTE_CONFIG.map(({ key, label, Icon }) => {
        const raw = attributes?.[key]
        const numericValue =
          typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : null
        const displayValue = Number.isFinite(numericValue) ? numericValue : "—"
        return (
          <div
            key={key}
            className="group flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-slate-950/80 to-slate-900/60 px-4 py-3 shadow-md transition-all duration-200 hover:scale-105 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/30"
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 shadow-inner transition-all group-hover:bg-cyan-500/30">
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] font-bold uppercase tracking-wide text-cyan-300/80">{label}</span>
              <span className="text-xl font-bold text-slate-50">{displayValue}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatBadge({ label, value }) {
  return (
    <div className="flex flex-col rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-900/20 to-slate-950/80 px-4 py-3 text-center shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/30">
      <span className="text-[10px] font-bold uppercase tracking-wide text-cyan-300/80">{label}</span>
      <span className="mt-1 text-2xl font-bold text-cyan-100">{value}</span>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-slate-950/70 px-3 py-2 shadow-inner transition-all hover:border-cyan-400/30">
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-sm font-bold text-cyan-100">{value ?? "—"}</span>
    </div>
  )
}

function TextSection({ title, value }) {
  const content = typeof value === "string" ? value.trim() : ""
  const paragraphs = content ? content.split(/\n+/).filter(Boolean) : []
  return (
    <section className="group relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-6 shadow-xl shadow-cyan-900/20 transition-all duration-300 hover:border-cyan-400/50 hover:shadow-2xl hover:shadow-cyan-500/30">
      {/* Corner decorations */}
      <div className="pointer-events-none absolute left-0 top-0 h-12 w-12 border-l-2 border-t-2 border-cyan-400/40 opacity-60 transition-opacity group-hover:opacity-100" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-12 w-12 border-b-2 border-r-2 border-cyan-400/40 opacity-60 transition-opacity group-hover:opacity-100" />

      <header className="relative z-10">
        <h2 className="bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-lg font-bold uppercase tracking-wide text-transparent">
          {title}
        </h2>
      </header>
      {paragraphs.length > 0 ? (
        <div className="relative z-10 mt-4 space-y-3 text-sm leading-relaxed text-slate-200">
          {paragraphs.map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </div>
      ) : (
        <p className="relative z-10 mt-4 text-sm italic text-slate-400">Sin información registrada.</p>
      )}
    </section>
  )
}

function ResourceList({ resources }) {
  if (!Array.isArray(resources) || resources.length === 0) {
    return <div className="text-sm italic text-slate-400">Sin recursos especiales.</div>
  }

  const sorted = [...resources].sort((a, b) => {
    const nameA = a.resource || ""
    const nameB = b.resource || ""
    return nameA.localeCompare(nameB)
  })

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {sorted.map((item) => {
        const label = RESOURCE_LABELS[item.resource] || item.resource
        const currentValue =
          typeof item.current === "number"
            ? item.current
            : typeof item.current === "string" && item.current.trim() !== ""
              ? Number(item.current)
              : Number.NaN
        const maxValue =
          typeof item.max === "number"
            ? item.max
            : typeof item.max === "string" && item.max.trim() !== ""
              ? Number(item.max)
              : Number.NaN
        const current = Number.isFinite(currentValue) ? currentValue : "—"
        const max = Number.isFinite(maxValue) ? maxValue : "—"
        return (
          <div
            key={item.id || item.resource}
            className="flex flex-col rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-slate-950/80 px-4 py-3 shadow-md transition-all duration-200 hover:scale-105 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/30"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-purple-300">{label}</span>
            <span className="mt-1 text-base font-bold text-purple-100">
              {current} / {max}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function NpcDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [npc, setNpc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [catalog, setCatalog] = useState({ races: [], classes: [] })

  useEffect(() => {
    let cancelled = false
    async function fetchNpc() {
      setLoading(true)
      setError(null)
      try {
        const { data } = await api.get(`/npcs/${id}`)
        if (!cancelled) setNpc(data)
      } catch (e) {
        if (!cancelled) setError("No pudimos cargar la ficha de este NPC.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchNpc()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let ignore = false
    async function fetchCatalog() {
      try {
        const [raceRes, classRes] = await Promise.all([api.get("/catalog/races"), api.get("/catalog/classes")])
        if (!ignore) {
          setCatalog({ races: raceRes.data || [], classes: classRes.data || [] })
        }
      } catch (e) {
        console.error("Catalog fetch error", e)
      }
    }
    fetchCatalog()
    return () => {
      ignore = true
    }
  }, [])

  const creature = npc?.Creature || {}
  const attributes = creature.CreatureAttribute || {}
  const resources = creature.CreatureResources || []
  const portraitUrl = creature.portrait?.meta?.secureUrl || creature.portrait?.url || null
  const tierClass = TIER_GRADIENT[npc?.tier] || TIER_GRADIENT.COMMON
  const alignmentLabel = creature.alignment ? ALIGNMENT_LABELS[creature.alignment] || creature.alignment : "—"
  const tierLabel = npc?.tier ? TIER_LABELS[npc.tier] || npc.tier : "Sin rango"

  const raceName = useMemo(() => {
    if (!creature.raceId) return "Sin raza"
    const entry = catalog.races.find((race) => race.id === creature.raceId)
    return entry?.name || "Sin raza"
  }, [catalog.races, creature.raceId])

  const className = useMemo(() => {
    if (!creature.classId) return "Sin clase"
    const entry = catalog.classes.find((klass) => klass.id === creature.classId)
    return entry?.name || "Sin clase"
  }, [catalog.classes, creature.classId])

  const stats = [
    { label: "Clase de Armadura", value: creature.armorClass ?? 10 },
    { label: "Puntos de Golpe", value: creature.maxHp ?? 10 },
    { label: "Velocidad", value: `${creature.speedValue ?? 6} m` },
    { label: "Nivel", value: creature.level ?? 1 },
  ]

  return (
    <div className="min-h-screen space-y-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <button
        type="button"
        onClick={() => navigate("/dm/npcs")}
        className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-md transition-all duration-200 hover:scale-105 hover:border-cyan-400/60 hover:shadow-lg hover:shadow-cyan-500/30"
      >
        ← Volver
      </button>

      {loading && (
        <div className="text-center text-sm font-semibold text-cyan-300/80 animate-pulse">
          Cargando ficha del NPC...
        </div>
      )}
      {error && (
        <div className="animate-pulse rounded-lg border border-red-500/50 bg-gradient-to-r from-red-900/30 to-pink-900/30 px-4 py-3 text-sm font-semibold text-red-200 shadow-lg shadow-red-900/30">
          {error}
        </div>
      )}

      {!loading && npc && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
            <aside className="space-y-4">
              <div
                className={`group relative overflow-hidden rounded-3xl border-2 bg-gradient-to-br ${tierClass} shadow-2xl transition-all duration-300 hover:scale-[1.02]`}
              >
                {/* Corner decorations */}
                <div className="pointer-events-none absolute left-0 top-0 z-20 h-16 w-16 border-l-2 border-t-2 border-white/50 opacity-70 transition-opacity group-hover:opacity-100" />
                <div className="pointer-events-none absolute bottom-0 right-0 z-20 h-16 w-16 border-b-2 border-r-2 border-white/50 opacity-70 transition-opacity group-hover:opacity-100" />

                {portraitUrl ? (
                  <img
                    src={portraitUrl || "/placeholder.svg"}
                    alt={`Retrato de ${creature.name || "NPC"}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="flex aspect-[3/4] w-full items-center justify-center bg-slate-950/80 text-sm text-slate-500">
                    Sin retrato disponible
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/50" />
              </div>

              <div className="space-y-2 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-5 shadow-xl shadow-cyan-900/20">
                <InfoRow label="Nivel" value={creature.level ?? "—"} />
                <InfoRow label="Clase" value={className} />
                <InfoRow label="Raza" value={raceName} />
                <InfoRow label="Alineamiento" value={alignmentLabel} />
                <InfoRow label="Campaña" value={npc.Campaign?.name || "Sin asignar"} />
              </div>

              <div className="space-y-3 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-5 shadow-xl shadow-purple-900/20">
                <h2 className="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-base font-bold uppercase tracking-wide text-transparent">
                  Recursos
                </h2>
                <ResourceList resources={resources} />
              </div>
            </aside>

            <section className="space-y-6">
              <header className="group relative overflow-hidden rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-6 shadow-2xl shadow-cyan-900/30">
                {/* Corner decorations */}
                <div className="pointer-events-none absolute left-0 top-0 h-14 w-14 border-l-2 border-t-2 border-cyan-400/50 opacity-70 transition-opacity group-hover:opacity-100" />
                <div className="pointer-events-none absolute bottom-0 right-0 h-14 w-14 border-b-2 border-r-2 border-cyan-400/50 opacity-70 transition-opacity group-hover:opacity-100" />

                <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-4xl font-black uppercase tracking-tight text-transparent drop-shadow-lg">
                      {creature.name || "NPC sin nombre"}
                    </h1>
                    <p className="mt-1 text-sm font-semibold text-cyan-300/90">
                      {className} · {raceName}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-200 shadow-md">
                      {tierLabel}
                    </span>
                    <span className="rounded-full border border-slate-600/50 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-slate-200 shadow-md">
                      {alignmentLabel}
                    </span>
                  </div>
                </div>

                <div className="relative z-10 mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {stats.map((stat) => (
                    <StatBadge key={stat.label} label={stat.label} value={stat.value} />
                  ))}
                </div>
              </header>

              <div className="group relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-6 shadow-xl shadow-cyan-900/20">
                {/* Corner decorations */}
                <div className="pointer-events-none absolute left-0 top-0 h-12 w-12 border-l-2 border-t-2 border-cyan-400/40 opacity-60 transition-opacity group-hover:opacity-100" />
                <div className="pointer-events-none absolute bottom-0 right-0 h-12 w-12 border-b-2 border-r-2 border-cyan-400/40 opacity-60 transition-opacity group-hover:opacity-100" />

                <h2 className="relative z-10 mb-5 bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-lg font-bold uppercase tracking-wide text-transparent">
                  Atributos
                </h2>
                <div className="relative z-10">
                  <AttributeGrid attributes={attributes} />
                </div>
              </div>

              <TextSection title="Descripción" value={creature.background} />
              <TextSection title="Notas de comportamiento" value={npc.behaviorNotes} />
              <TextSection title="Miedos" value={creature.fears} />
              <TextSection title="Metas a corto plazo" value={creature.goalsShort} />
              <TextSection title="Metas a largo plazo" value={creature.goalsLong} />
            </section>
          </div>
        </div>
      )}

      {!loading && !npc && !error && (
        <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/70 to-slate-950/70 px-6 py-8 text-center shadow-xl">
          <p className="text-sm font-medium text-slate-300/80">No encontramos la ficha solicitada.</p>
        </div>
      )}
    </div>
  )
}
