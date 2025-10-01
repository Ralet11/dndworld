"use client"

import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import api from "../../api/client"
import {
  StrengthIcon,
  DexterityIcon,
  ConstitutionIcon,
  IntelligenceIcon,
  WisdomIcon,
  CharismaIcon,
} from "../../icons/attributeIcons"

/* ============================================================
   Filtros / catálogos
   ============================================================ */
const ALIGNMENTS = [
  { value: "", label: "Todos los alineamientos" },
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

const TIERS = [
  { value: "", label: "Todos los rangos" },
  { value: "COMMON", label: "Común" },
  { value: "RARE", label: "Raro" },
  { value: "ELITE", label: "Élite" },
  { value: "LEGENDARY", label: "Legendario" },
]

const defaultFilters = {
  search: "",
  campaignId: "",
  alignment: "",
  raceId: "",
  classId: "",
  tier: "",
}

function buildQuery(filters) {
  const params = {}
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== "all") params[key] = value
  })
  return params
}

/* ============================================================
   CARD — Versión “Arcane Compact” (sin atributos en card)
   ============================================================ */

// Acento por rareza
const TIER_STYLE = {
  COMMON: { ring: "ring-slate-500/60", chip: "border-slate-400/60 text-slate-100", ribbon: "from-slate-700 to-slate-800" },
  RARE: { ring: "ring-sky-400/70", chip: "border-sky-300/70 text-sky-100", ribbon: "from-sky-700 to-sky-800" },
  ELITE: { ring: "ring-violet-400/70", chip: "border-violet-300/70 text-violet-100", ribbon: "from-violet-700 to-violet-800" },
  LEGENDARY: { ring: "ring-amber-400/80", chip: "border-amber-300/80 text-amber-100", ribbon: "from-amber-700 to-amber-800" },
}

// Cinta (permite top/bottom). La usamos en BOTTOM para no tapar el retrato.
function NameRibbon({ children, toneClass, position = "bottom" }) {
  const posCls =
    position === "bottom"
      ? "bottom-1 left-1/2 -translate-x-1/2 w-[90%]"
      : "top-1 left-1/2 -translate-x-1/2 w-[90%]"

  const grad =
    position === "bottom" ? `bg-gradient-to-t ${toneClass}` : `bg-gradient-to-b ${toneClass}`

  return (
    <div className={`pointer-events-none absolute z-20 ${posCls}`}>
      <div className={`rounded-md border border-white/10 ${grad} px-3 py-1 shadow-md shadow-black/50`}>
        <p className="truncate text-center text-[12px] font-bold tracking-wide text-slate-100">
          {children}
        </p>
      </div>
    </div>
  )
}

// Chip minimal
function Chip({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] font-extrabold uppercase ${className}`}>
      {children}
    </span>
  )
}

function NpcCardArcane({ npc, raceName, className: classNameLabel, onDelete }) {
  const navigate = useNavigate()
  const creature = npc?.Creature || {}
  const portrait = creature?.portrait?.meta?.secureUrl || creature?.portrait?.url || null
  const tier = npc?.tier || "COMMON"
  const tone = TIER_STYLE[tier] || TIER_STYLE.COMMON

  const openDetail = () => npc?.id && navigate(`/dm/npcs/${npc.id}`)

  return (
    <article
      role="button" tabIndex={0}
      onClick={openDetail}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openDetail())}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/95 p-3 shadow-xl transition-transform hover:-translate-y-1"
      style={{ minWidth: 220 }}
    >
      {/* Marco principal (retrato 4:5) */}
      <div className={`relative aspect-[4/5] w-full overflow-hidden rounded-xl ring-1 ${tone.ring}`}>
        {/* NOMBRE ABAJO */}
        <NameRibbon toneClass={tone.ribbon} position="bottom">
          {creature?.name || "Sin nombre"}
        </NameRibbon>

        {portrait ? (
          <img src={portrait} alt="Retrato" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">Sin retrato</div>
        )}

        {/* Viñeta suave */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_20%,transparent,rgba(0,0,0,0.55))]" />
      </div>

      {/* Meta: Tier + Nivel */}
      <div className="mt-2 flex items-center justify-between">
        <Chip className={tone.chip}>{tier}</Chip>
        <Chip className="border-cyan-300/60 text-cyan-100">NV {creature?.level ?? 1}</Chip>
      </div>

      {/* Clase · Raza */}
      <div className="mt-1 truncate text-[11px] font-medium text-slate-300">
        {(classNameLabel || "Sin clase")} · {(raceName || "Sin raza")}
      </div>

      {/* CA / HP / VEL */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {[
          { k: "CA", v: creature?.armorClass ?? 10 },
          { k: "HP", v: creature?.maxHp ?? 10 },
          { k: "VEL", v: `${creature?.speedValue ?? 6}m` },
        ].map(({ k, v }) => (
          <div key={k} className="flex flex-col items-center justify-center rounded-md border border-cyan-400/25 bg-slate-950/80 py-1 text-[11px] shadow-inner">
            <span className="text-[10px] font-bold tracking-wide text-cyan-300/80">{k}</span>
            <span className="font-extrabold text-cyan-100">{v}</span>
          </div>
        ))}
      </div>

      {/* Barra inferior compacta con acciones */}
      <div className="mt-3 flex items-center justify-between">
        <span className="truncate text-[10px] text-slate-400">
          {npc?.Campaign ? npc.Campaign.name : "Sin campaña"}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (npc?.id) navigate(`/dm/npcs/${npc.id}/editar`)
            }}
            className="rounded-md border border-indigo-400/50 bg-indigo-600/80 px-2 py-[3px] text-[10px] font-semibold text-white shadow hover:brightness-110"
          >
            Editar
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); openDetail() }}
            className="rounded-md border border-cyan-400/50 bg-cyan-600 px-2 py-[3px] text-[10px] font-bold text-white shadow hover:brightness-110"
          >
            Detalle
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (window.confirm("¿Seguro que desea eliminar este NPC?")) onDelete?.(npc?.id) }}
            className="rounded-md border border-red-500/50 bg-red-800/70 px-2 py-[3px] text-[10px] font-semibold text-red-100 hover:brightness-110"
          >
            Eliminar
          </button>
        </div>
      </div>
    </article>
  )
}

/* ============================================================
   Vista principal NPCs
   ============================================================ */
export default function NPCs() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(defaultFilters)
  const [catalog, setCatalog] = useState({ races: [], classes: [], campaigns: [] })
  const [npcs, setNpcs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchInput, setSearchInput] = useState("")

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const [raceRes, classRes, campaignRes] = await Promise.all([
          api.get("/catalog/races"),
          api.get("/catalog/classes"),
          api.get("/campaigns", { params: { role: "DM" } }),
        ])
        setCatalog({
          races: raceRes.data || [],
          classes: classRes.data || [],
          campaigns: campaignRes.data || [],
        })
      } catch (e) {
        console.error("Catalog fetch error", e)
      }
    }
    loadCatalog()
  }, [])

  useEffect(() => {
    const handler = setTimeout(() => setFilters((prev) => ({ ...prev, search: searchInput })), 300)
    return () => clearTimeout(handler)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const params = buildQuery(filters)
        const { data } = await api.get("/npcs", { params })
        if (!cancelled) setNpcs(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!cancelled) setError("No pudimos cargar los NPCs.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    const timeoutId = setTimeout(run, 250)
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [filters])

  const racesMap = useMemo(() => {
    const map = new Map()
    catalog.races.forEach((race) => map.set(race.id, race.name))
    return map
  }, [catalog.races])

  const classesMap = useMemo(() => {
    const map = new Map()
    catalog.classes.forEach((klass) => map.set(klass.id, klass.name))
    return map
  }, [catalog.classes])

  const handleFilterChange = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))

  const handleDelete = async (id) => {
    if (!window.confirm("Seguro que desea eliminar este NPC?")) return
    await api.delete(`/npcs/${id}`)
    setFilters((prev) => ({ ...prev }))
  }

  const filteredCampaignOptions = [
    { id: "", name: "Todas las campañas" },
    { id: "none", name: "Sin campaña" },
    ...catalog.campaigns,
  ]

  return (
    <div className="min-h-screen space-y-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Encabezado */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-slate-900/80 via-slate-800/60 to-slate-900/80 p-6 shadow-2xl shadow-cyan-900/20">
        <div>
          <h1 className="bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-400 bg-clip-text text-4xl font-black uppercase tracking-tight text-transparent drop-shadow-lg">
            Biblioteca de NPCs
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Gestione y cree nuevos aliados, enemigos o habitantes memorables.
          </p>
        </div>
        <button
          onClick={() => navigate("/dm/npcs/nuevo")}
          className="relative overflow-hidden rounded-lg border border-cyan-400/50 bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-cyan-500/40 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-cyan-500/60"
        >
          <span className="relative z-10">Crear nuevo NPC</span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity hover:opacity-100" />
        </button>
      </header>

      {/* Filtros */}
      <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-6 shadow-xl shadow-cyan-900/20">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Buscar</label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nombre del NPC"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Campaña</label>
            <select
              value={filters.campaignId}
              onChange={(e) => handleFilterChange("campaignId", e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            >
              {filteredCampaignOptions.map((camp) => (
                <option key={camp.id || "all"} value={camp.id}>
                  {camp.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Alineamiento</label>
            <select
              value={filters.alignment}
              onChange={(e) => handleFilterChange("alignment", e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            >
              {ALIGNMENTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Raza</label>
            <select
              value={filters.raceId}
              onChange={(e) => handleFilterChange("raceId", e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            >
              <option value="">Todas las razas</option>
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
              value={filters.classId}
              onChange={(e) => handleFilterChange("classId", e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            >
              <option value="">Todas las clases</option>
              {catalog.classes.map((klass) => (
                <option key={klass.id} value={klass.id}>
                  {klass.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-cyan-300/90">Rango</label>
            <select
              value={filters.tier}
              onChange={(e) => handleFilterChange("tier", e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 shadow-inner transition-all focus:border-cyan-500 focus:shadow-cyan-500/20 focus:outline-none"
            >
              {TIERS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Listado con tarjeta compacta sin atributos */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {error && (
          <div className="col-span-full animate-pulse rounded-lg border border-red-500/50 bg-gradient-to-r from-red-900/30 to-pink-900/30 px-4 py-3 text-sm font-semibold text-red-200 shadow-lg shadow-red-900/30">
            {error}
          </div>
        )}
        {loading && (
          <div className="col-span-full text-center text-sm font-semibold text-cyan-300/80 animate-pulse">
            Cargando NPCs...
          </div>
        )}

        {npcs.map((npc) => (
          <NpcCardArcane
            key={npc.id}
            npc={npc}
            raceName={racesMap.get(npc.Creature?.raceId)}
            className={classesMap.get(npc.Creature?.classId)}
            onDelete={handleDelete}
          />
        ))}
      </section>

      {!loading && npcs.length === 0 && (
        <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/70 to-slate-950/70 px-6 py-8 text-center shadow-xl">
          <p className="text-sm font-medium text-slate-300/80">
            Aún no tiene NPCs registrados. Cree el primero para comenzar su biblioteca.
          </p>
        </div>
      )}
    </div>
  )
}
