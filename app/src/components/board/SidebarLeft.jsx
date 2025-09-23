const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join('')
    .slice(0, 2) || 'PC'

const SidebarLeft = ({ members = [], items = [], activeScenario }) => {
  const acceptedMembers = members.filter((member) => member.status === 'accepted')

  return (
    <aside className="flex h-full flex-col gap-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
      <section>
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Escenario</p>
        <h3 className="mt-1 text-lg font-semibold text-parchment">{activeScenario?.title ?? 'Sin escenario'}</h3>
        <p className="mt-2 text-xs text-slate-400">
          {activeScenario?.summary ?? 'Utiliza el tablero para mostrar escenarios, mapas o handouts visuales.'}
        </p>
        {activeScenario?.environmentTags?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeScenario.environmentTags.map((tag) => (
              <span key={tag} className="rounded-full border border-slate-700 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-300">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <header className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-amber-300">
          <span>Personajes</span>
          <span>{acceptedMembers.length}</span>
        </header>
        <div className="space-y-3">
          {acceptedMembers.length ? (
            acceptedMembers.map((member) => (
              <article
                key={member.id}
                className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-400/10 text-sm font-semibold text-emerald-200">
                    {getInitials(member.user?.displayName ?? member.user?.username)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-parchment">
                      {member.user?.displayName ?? member.user?.username ?? 'Integrante'}
                    </p>
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-500">{member.roleInCampaign}</p>
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-[0.35em] text-emerald-300">Listo</span>
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-4 text-center text-xs text-slate-400">
              Invita jugadores para compartir este tablero en vivo.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <header className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-emerald-300">
          <span>Equipo clave</span>
          <span>{items.length}</span>
        </header>
        <div className="grid gap-2">
          {items.length ? (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300"
              >
                <p className="text-sm font-semibold text-parchment">{item.name}</p>
                <p className="text-[10px] uppercase tracking-[0.35em] text-amber-300">{item.type}</p>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-4 text-center text-xs text-slate-400">
              Aun no hay items registrados para esta campana.
            </p>
          )}
        </div>
      </section>
    </aside>
  )
}

export default SidebarLeft
