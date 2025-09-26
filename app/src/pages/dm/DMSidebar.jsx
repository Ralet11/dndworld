"use client"

import { NavLink, useNavigate } from "react-router-dom"
import { useSessionStore } from "../../store/useSessionStore"

const DMSidebar = () => {
  const navigate = useNavigate()
  const session = useSessionStore((s) => s.session)

  const campaigns = session?.campaigns ?? []
  const activeCampaignId = session?.activeCampaignId ?? null
  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId)

  const goToCampaignPicker = () => navigate("/dm?view=list")

  return (
    <div className="flex h-full flex-col gap-6 border-r border-border/40 bg-surface/90 p-6 text-foreground backdrop-blur-xl">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Campana activa</p>
        </div>
        <div className="gaming-card space-y-3 border border-primary/25 bg-primary/5 p-5">
          <h2 className="font-display text-lg font-semibold text-text-primary">
            {activeCampaign?.name || "Sin campana"}
          </h2>
          <button
            type="button"
            onClick={goToCampaignPicker}
            className="gaming-button-secondary w-full px-4 py-2 text-[0.65rem]"
          >
            Cambiar campana
          </button>
        </div>
      </div>

      <nav className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-text-muted">Herramientas DM</p>
        </div>

        <NavLink to="/dm?view=list" className={({ isActive }) => `gaming-nav-item ${isActive ? "active" : ""}`} end>
          <div className="flex items-center gap-3">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            Campanas
          </div>
        </NavLink>

        <NavLink to="/dm/tools/scenarios" className={({ isActive }) => `gaming-nav-item ${isActive ? "active" : ""}`}>
          <div className="flex items-center gap-3">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Escenarios
          </div>
        </NavLink>

        <NavLink to="/dm/tools/characters" className={({ isActive }) => `gaming-nav-item ${isActive ? "active" : ""}`}>
          <div className="flex items-center gap-3">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
              />
            </svg>
            NPCs
          </div>
        </NavLink>

        <NavLink to="/dm/tools/items" className={({ isActive }) => `gaming-nav-item ${isActive ? "active" : ""}`}>
          <div className="flex items-center gap-3">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4-5 2zm0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            Objetos
          </div>
        </NavLink>
      </nav>

      <div className="mt-auto">
        <div className="gaming-card space-y-2 border border-accent/25 bg-accent/5 p-5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">Estado del sistema</p>
          </div>
          <p className="text-xs text-text-muted">Todas las herramientas operativas.</p>
        </div>
      </div>
    </div>
  )
}

export default DMSidebar
