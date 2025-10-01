"use client"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import api from "../../api/client"
import NpcForm from "./components/NpcForm.jsx"

export default function NpcCreate() {
  const navigate = useNavigate()
  const [catalog, setCatalog] = useState({ races: [], classes: [], campaigns: [] })

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
      } catch (error) {
        console.error("Catalog fetch error", error)
      }
    }
    loadCatalog()
  }, [])

  const handleSave = async (payload) => {
    const response = await api.post("/npcs", payload)
    const npcId = response?.data?.id
    window.alert("NPC creado correctamente.")
    if (npcId) {
      navigate(`/dm/npcs/${npcId}`)
    } else {
      navigate("/dm/npcs")
    }
    return response
  }

  return <NpcForm catalog={catalog} onSave={handleSave} onCancel={() => navigate(-1)} />
}
