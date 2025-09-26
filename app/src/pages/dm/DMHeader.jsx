"use client"

import { NavLink, useNavigate } from "react-router-dom"
import { useSessionStore } from "../../store/useSessionStore"

const linkClasses = (isActive) =>
  `rounded-xl px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.28em] transition-all duration-200 ${
    isActive
      ? "bg-primary/15 text-primary ring-1 ring-primary/45 shadow-[0_14px_32px_rgba(59,130,246,0.35)]"
      : "text-text-muted hover:text-primary hover:bg-surface-interactive hover:ring-1 hover:ring-primary/20"
  }`

const iconClasses = (isActive, disabled) => {
  if (disabled) {
    return "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/30 text-text-muted/60 cursor-not-allowed opacity-50"
  }

  return `inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 ${
    isActive
      ? "border-primary/45 bg-primary/10 text-primary shadow-[0_12px_28px_rgba(59,130,246,0.35)]"
      : "border-border/40 text-text-secondary hover:border-primary/40 hover:text-primary hover:shadow-[0_12px_26px_rgba(59,130,246,0.28)]"
  }`
}

const DMHeader = () => {
  const navigate = useNavigate()
  const session = useSessionStore((s) => s.session)

  const campaigns = session?.campaigns ?? []
  const activeCampaignId = session?.activeCampaignId ?? null

  const goToCampaignPicker = () => navigate("/dm?view=list")

  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId)
  const mesaPath = activeCampaignId ? `/session/${activeCampaignId}/dm` : null

  const navItems = [
    { to: "/dm?view=list", label: "Campanas", end: true },
    { to: "/dm/tools/scenarios", label: "Herramientas DM" },
  ]

  const toolShortcuts = [
    {
      key: "scenarios",
      to: "/dm/tools/scenarios",
      title: "Escenarios",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      key: "characters",
      to: "/dm/tools/characters",
      title: "NPCs",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
          />
        </svg>
      ),
    },
    {
      key: "items",
      to: "/dm/tools/items",
      title: "Objetos",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      ),
    },
  ]

  return (
    <header className="border-b border-border/40 bg-surface backdrop-blur-xl px-6 py-5 shadow-holo">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-surface-interactive px-4 py-3 shadow-[0_16px_36px_rgba(6,12,30,0.45)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z" />
              </svg>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-text-muted">directorio dm</p>
              <h1 className="font-display text-xl font-semibold uppercase tracking-[0.38em] text-text-primary">dungeon hub</h1>
            </div>
          </div>

          <nav className="flex items-center gap-3 text-[0.65rem] font-semibold uppercase tracking-[0.3em]">
            {navItems.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => linkClasses(isActive)}>
                {label}
              </NavLink>
            ))}

            {mesaPath ? (
              <NavLink to={mesaPath} className={({ isActive }) => linkClasses(isActive)}>
                Mesa
              </NavLink>
            ) : (
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-text-muted/60"
                disabled
              >
                Mesa
              </button>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            {toolShortcuts.map(({ key, to, title, icon }) => (
              <NavLink key={key} to={to} className={({ isActive }) => iconClasses(isActive, false)} title={title}>
                {icon}
              </NavLink>
            ))}
          </div>

          <div className="h-8 w-px bg-border/50" />

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Campana activa</span>
            </div>

            <div className="gaming-card flex items-center gap-3 border border-primary/30 px-5 py-3">
              <span className="text-sm font-semibold text-text-primary">
                {activeCampaign?.name || "Sin campana"}
              </span>
              <button
                type="button"
                onClick={goToCampaignPicker}
                className="gaming-button-secondary px-4 py-1.5 text-[0.6rem]"
              >
                Cambiar
              </button>
            </div>
          </div>

          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/40 text-text-muted transition-all duration-200 hover:border-primary/45 hover:text-primary hover:shadow-[0_12px_26px_rgba(59,130,246,0.28)]"
            title="Configuracion"
            type="button"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}

export default DMHeader
