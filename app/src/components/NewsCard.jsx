function formatDate(value) {
  try {
    return new Date(value).toLocaleString('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  } catch (err) {
    return value
  }
}

export default function NewsCard({ item }) {
  const mainImage = item.image
  const hasExtra = (item.characters?.length || 0) + (item.npcs?.length || 0) > 0
  const badgeTone = item.badgeTone || 'bg-gradient-to-r from-purple-500 to-violet-500'

  return (
    <article className="group relative backdrop-blur-xl bg-gradient-to-br from-slate-900/60 via-purple-900/20 to-slate-900/60 border border-purple-500/20 rounded-xl overflow-hidden transition-all duration-300 hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-500/20">
      <div className="relative h-48 overflow-hidden">
        {mainImage ? (
          <img
            src={mainImage}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
            <span className="text-sm font-semibold text-purple-200/70">Sin imagen</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
        {item.badge && (
          <div
            className={`absolute top-3 right-3 px-3 py-1 rounded-full text-white text-xs font-bold shadow-lg ${badgeTone}`}
          >
            {item.badge}
          </div>
        )}
      </div>

      <div className="p-6 space-y-4">
        <header className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-300/80">
            {item.campaign?.name || item.categoryLabel || 'Cronicas del mundo'}
          </div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-white leading-tight group-hover:text-purple-300 transition-colors line-clamp-2">
              {item.title}
            </h3>
            <span className="text-xs text-slate-400">{item.relativeDate || formatDate(item.createdAt)}</span>
          </div>
        </header>

        {item.excerpt && <p className="text-purple-200/80 text-sm leading-relaxed line-clamp-3">{item.excerpt}</p>}

        {item.body && !item.excerpt && (
          <p className="text-sm text-slate-300/70 whitespace-pre-line line-clamp-4">{item.body}</p>
        )}

        {hasExtra && (
          <div className="space-y-1 text-xs text-slate-400">
            {item.characters?.length > 0 && (
              <div>
                <span className="font-semibold text-slate-200">Personajes:</span>{' '}
                {item.characters.map((char) => char.name || 'Desconocido').join(', ')}
              </div>
            )}
            {item.npcs?.length > 0 && (
              <div>
                <span className="font-semibold text-slate-200">NPCs:</span>{' '}
                {item.npcs.map((npc) => npc.name || 'Desconocido').join(', ')}
              </div>
            )}
          </div>
        )}

        {item.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-slate-300/80">
            {item.tags.map((tag) => (
              <span key={tag} className="rounded bg-slate-800/70 px-2 py-1">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button className="text-purple-400 hover:text-purple-300 text-sm font-semibold flex items-center gap-1 transition-all group-hover:gap-2">
            Leer mas <span>?</span>
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 right-0 w-16 h-16 border-r-2 border-b-2 border-purple-500/20 group-hover:border-purple-400/40 transition-colors" />
    </article>
  )
}
