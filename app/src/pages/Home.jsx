import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api/client'
import NewsCard from '../components/NewsCard.jsx'

const CATEGORY_META = {
  news: { label: 'Noticias', badge: 'Nuevo', tone: 'bg-gradient-to-r from-green-500 to-emerald-500' },
  campaign: { label: 'Campanas', badge: 'En Vivo', tone: 'bg-gradient-to-r from-red-500 to-pink-500' },
  story: { label: 'Historias', badge: 'Historia', tone: 'bg-gradient-to-r from-blue-500 to-cyan-500' },
  comic: { label: 'Comics', badge: 'Comic', tone: 'bg-gradient-to-r from-yellow-500 to-orange-500' },
  note: { label: 'Guias', badge: 'Guia', tone: 'bg-gradient-to-r from-purple-500 to-violet-500' },
  reflection: { label: 'Reflexiones', badge: 'Reflexion', tone: 'bg-gradient-to-r from-indigo-500 to-purple-500' },
}

const TAG_TO_CATEGORY = {
  campaign: 'campaign',
  campanas: 'campaign',
  historia: 'story',
  story: 'story',
  comic: 'comic',
  comics: 'comic',
  guia: 'note',
  guide: 'note',
  reflexion: 'reflection',
  reflection: 'reflection',
  noticia: 'news',
  news: 'news',
}

const KIND_TO_CATEGORY = {
  QUEST_COMPLETED: 'campaign',
  BOSS_DEFEATED: 'news',
  MONSTER_SIGHTING: 'news',
  DISCOVERY: 'story',
}

function formatRelativeTime(date) {
  if (!date) return ''
  const value = new Date(date).getTime()
  if (Number.isNaN(value)) return ''
  const now = Date.now()
  const diff = now - value
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'Hace instantes'
  if (diff < hour) {
    const count = Math.floor(diff / minute)
    return `Hace ${count} minuto${count === 1 ? '' : 's'}`
  }
  if (diff < day) {
    const count = Math.floor(diff / hour)
    return `Hace ${count} hora${count === 1 ? '' : 's'}`
  }
  if (diff < day * 7) {
    const count = Math.floor(diff / day)
    return `Hace ${count} dia${count === 1 ? '' : 's'}`
  }
  const weeks = Math.floor(diff / (day * 7))
  return `Hace ${weeks} semana${weeks === 1 ? '' : 's'}`
}

function pickCategory(item) {
  const tags = (item.tags || []).map((tag) => tag.toLowerCase())
  for (const tag of tags) {
    if (TAG_TO_CATEGORY[tag]) return TAG_TO_CATEGORY[tag]
  }
  if (item.kind && KIND_TO_CATEGORY[item.kind]) return KIND_TO_CATEGORY[item.kind]
  return 'news'
}

function buildExcerpt(item) {
  if (item.summary) return item.summary
  if (item.body) {
    const trimmed = item.body.trim()
    return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed
  }
  return null
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('all')
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchNews = useCallback(() => {
    setLoading(true)
    setError(null)
    api
      .get('/news?limit=24')
      .then((response) => {
        const rows = Array.isArray(response.data) ? response.data : []
        setNews(rows)
      })
      .catch(() => {
        setError('No pudimos cargar las noticias del mundo.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchNews()
  }, [fetchNews])

  const decoratedNews = useMemo(() => {
    return news.map((item) => {
      const categoryId = pickCategory(item)
      const meta = CATEGORY_META[categoryId] || CATEGORY_META.news
      const image = item.images?.[0]?.url || null
      return {
        ...item,
        image,
        excerpt: buildExcerpt(item),
        categoryId,
        categoryLabel: meta.label,
        badge: meta.badge,
        badgeTone: meta.tone,
        relativeDate: formatRelativeTime(item.createdAt),
      }
    })
  }, [news])

  const categoryTabs = useMemo(() => {
    const set = new Set(decoratedNews.map((item) => item.categoryId))
    const order = ['news', 'campaign', 'story', 'comic', 'note', 'reflection']
    return order
      .filter((id) => set.has(id))
      .map((id) => ({ id, label: CATEGORY_META[id].label }))
  }, [decoratedNews])

  const tabs = useMemo(() => [{ id: 'all', label: 'Todo' }, ...categoryTabs], [categoryTabs])

  const filteredNews = useMemo(() => {
    if (activeTab === 'all') return decoratedNews
    return decoratedNews.filter((item) => item.categoryId === activeTab)
  }, [decoratedNews, activeTab])

  return (
    <div className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 px-6 py-12 shadow-xl shadow-purple-900/40">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 h-96 w-96 rounded-full bg-purple-600/10 blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl animate-[pulse_4s_ease-in-out_infinite]" />
        <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/5 blur-3xl animate-[pulse_6s_ease-in-out_infinite]" />
      </div>

      <div className="relative z-10 space-y-10">
        <section className="relative overflow-hidden rounded-2xl border-2 border-purple-500/30 bg-gradient-to-br from-purple-900/40 via-indigo-900/30 to-slate-900/40 p-12 backdrop-blur-xl">
          <div className="absolute -top-1 -left-1 h-12 w-12 rounded-tl-2xl border-l-2 border-t-2 border-purple-400" />
          <div className="absolute -top-1 -right-1 h-12 w-12 rounded-tr-2xl border-r-2 border-t-2 border-purple-400" />
          <div className="absolute -bottom-1 -left-1 h-12 w-12 rounded-bl-2xl border-b-2 border-l-2 border-purple-400" />
          <div className="absolute -bottom-1 -right-1 h-12 w-12 rounded-br-2xl border-b-2 border-r-2 border-purple-400" />

          <div className="relative z-10 space-y-6">
            <h2 className="text-5xl font-bold tracking-wide text-white">Bienvenido, Aventurero</h2>
            <p className="max-w-2xl text-lg leading-relaxed text-purple-200">
              Explora mundos infinitos, descubre historias epicas y unite a campanas legendarias. Tu proxima aventura comienza aqui.
            </p>
            <div className="flex flex-wrap gap-4">
              <button className="rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg shadow-purple-500/30 transition-all hover:scale-105 hover:shadow-purple-500/50">
                Explorar Campanas
              </button>
              <button className="rounded-lg border border-purple-500/30 bg-slate-800/50 px-6 py-3 font-semibold text-purple-300 transition-all hover:bg-slate-700/50">
                Ver Guias
              </button>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <section className="flex gap-3 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap rounded-lg px-6 py-2.5 font-semibold transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'scale-105 bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-lg shadow-purple-500/30'
                    : 'border border-purple-500/20 bg-slate-800/50 text-purple-300 hover:bg-slate-700/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </section>

          {error && (
            <div className="rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
          )}

          {loading && !error && <div className="text-sm text-slate-400">Cargando noticias...</div>}

          {!loading && !error && filteredNews.length === 0 && (
            <div className="text-sm text-slate-400">
              Aun no hay noticias publicadas. Cuando termines una sesion o completes una mision mayor, publica una cronica para compartirla con todos.
            </div>
          )}

          <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredNews.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </section>

          <div className="text-center">
            <button
              onClick={fetchNews}
              disabled={loading}
              className="mt-8 rounded-lg border border-purple-500/30 bg-slate-800/50 px-8 py-3 font-semibold text-purple-300 transition-all hover:border-purple-500/50 hover:bg-slate-700/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Actualizando...' : 'Cargar mas contenido'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
