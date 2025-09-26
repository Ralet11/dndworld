"use client"

// app/src/layouts/DMShell.jsx
import { Outlet, useNavigate } from "react-router-dom"
import { useEffect } from "react"
import { useSessionStore } from "../store/useSessionStore"
import DMHeader from "../pages/dm/DMHeader"

const DMShell = () => {
  const navigate = useNavigate()
  const session = useSessionStore((s) => s.session)

  // si no hay campaña activa, podés redirigir a /dm o mostrar aviso:
  useEffect(() => {
    if (!session?.activeCampaignId) {
      // navigate("/dm");  // opcional
    }
  }, [session?.activeCampaignId, navigate])

  return (
    <div className="min-h-screen flex flex-col text-foreground">
      <DMHeader />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}

export default DMShell
