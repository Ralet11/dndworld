"use client"

import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import api from "../../api/client"
import NpcForm, { NPC_FORM_TEMPLATE, RESOURCE_OPTIONS } from "./components/NpcForm.jsx"

const ensureNumber = (value, fallback) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const mapNpcToFormValues = (npc) => {
  if (!npc) return { ...NPC_FORM_TEMPLATE }
  const creature = npc.Creature || {}
  const attributes = { ...NPC_FORM_TEMPLATE.attributes }
  const sourceAttributes = creature.CreatureAttribute || {}
  for (const key of Object.keys(attributes)) {
    attributes[key] = ensureNumber(sourceAttributes[key], attributes[key])
  }

  const resources = Array.isArray(creature.CreatureResources)
    ? creature.CreatureResources.map((res) => ({
        resource: res.resource || RESOURCE_OPTIONS[0],
        current: ensureNumber(res.current, 0),
        max: ensureNumber(res.max, 0),
      }))
    : []

  const portraitTransform = {
    ...NPC_FORM_TEMPLATE.portraitTransform,
    ...(npc.portraitTransform || creature.portraitTransform || {}),
  }

  return {
    ...NPC_FORM_TEMPLATE,
    name: creature.name || "",
    tier: npc.tier || NPC_FORM_TEMPLATE.tier,
    level: ensureNumber(creature.level, NPC_FORM_TEMPLATE.level),
    alignment: creature.alignment || "",
    raceId: creature.raceId || "",
    classId: creature.classId || "",
    campaignId: npc.campaignId || "",
    portraitAssetId: creature.portrait?.id || npc.portraitAssetId || "",
    portraitUrl: "",
    portraitFile: null,
    portraitPreview: creature.portrait?.meta?.secureUrl || creature.portrait?.url || "",
    portraitTransform,
    armorClass: ensureNumber(creature.armorClass, NPC_FORM_TEMPLATE.armorClass),
    maxHp: ensureNumber(creature.maxHp, NPC_FORM_TEMPLATE.maxHp),
    speedValue: ensureNumber(creature.speedValue, NPC_FORM_TEMPLATE.speedValue),
    background: creature.background || "",
    behaviorNotes: npc.behaviorNotes || "",
    fears: creature.fears || "",
    goalsShort: creature.goalsShort || "",
    goalsLong: creature.goalsLong || "",
    attributes,
    resources,
  }
}

export default function NpcEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState({ races: [], classes: [], campaigns: [] })
  const [initialValues, setInitialValues] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
      } catch (catalogError) {
        console.error("Catalog fetch error", catalogError)
      }
    }
    loadCatalog()
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadNpc = async () => {
      if (!id) return
      setLoading(true)
      setError(null)
      try {
        const { data } = await api.get(`/npcs/${id}`)
        if (!cancelled) {
          setInitialValues(mapNpcToFormValues(data))
        }
      } catch (fetchError) {
        console.error(fetchError)
        if (!cancelled) {
          setError("No pudimos cargar este NPC.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    loadNpc()
    return () => {
      cancelled = true
    }
  }, [id])

  const handleSave = async (payload) => {
    const response = await api.patch(`/npcs/${id}`, payload)
    window.alert("NPC actualizado correctamente.")
    navigate(`/dm/npcs/${id}`)
    return response
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 text-sm font-semibold text-cyan-200">
        Cargando NPC...
      </div>
    )
  }

  if (error || !initialValues) {
    return (
      <div className="min-h-screen space-y-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-md transition-all duration-200 hover:scale-105 hover:border-cyan-400/60 hover:shadow-lg hover:shadow-cyan-500/30"
        >
          ← Volver
        </button>
        <div className="rounded-lg border border-red-500/50 bg-gradient-to-r from-red-900/30 to-pink-900/30 px-4 py-3 text-sm font-semibold text-red-200 shadow-lg shadow-red-900/30">
          {error || "No encontramos la información de este NPC."}
        </div>
      </div>
    )
  }

  return <NpcForm mode="edit" initialValues={initialValues} catalog={catalog} onSave={handleSave} onCancel={() => navigate(-1)} />
}
