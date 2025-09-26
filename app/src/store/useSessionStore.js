// store/useSessionStore.js
import { create } from 'zustand'
import { setAuthToken } from '../api/client'
import { apiLogin, apiRegister } from '../api/auth'

const SESSION_STORAGE_KEY = 'dw_session'

const defaultSession = {
  user: null,
  token: null,
  campaigns: [],
  activeCampaignId: null,
  activeMode: 'dm',
  playerCharacters: [],
}

const safeParse = (v, fb) => {
  if (!v) return fb
  try { return JSON.parse(v) } catch { return fb }
}

const loadStoredSession = () => {
  if (typeof window === 'undefined') return null
  return safeParse(window.localStorage.getItem(SESSION_STORAGE_KEY), null)
}

const persistSession = (session) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

const clearPersistedSession = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
}

const initialSession = (() => {
  const stored = loadStoredSession()
  if (!stored) return { ...defaultSession }
  return {
    ...defaultSession,
    ...stored,
    campaigns: Array.isArray(stored.campaigns) ? stored.campaigns : [],
    activeCampaignId: stored.activeCampaignId ?? null,
    activeMode: stored.activeMode ?? defaultSession.activeMode,
  }
})()

// hidrata axios en el arranque
setAuthToken(initialSession.token ?? null)

export const useSessionStore = create((set, get) => ({
  session: { ...initialSession },
  isLoading: false,
  error: null,

  // ---------- helpers de estado global ----------
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  setSession: (session) =>
    set(() => {
      const nextSession = {
        ...defaultSession,
        ...session,
        campaigns: Array.isArray(session?.campaigns) ? session.campaigns : [],
        activeCampaignId: session?.activeCampaignId ?? null,
        activeMode: session?.activeMode ?? defaultSession.activeMode,
      }
      setAuthToken(nextSession.token ?? null)
      persistSession(nextSession)
      return { session: nextSession, isLoading: false, error: null }
    }),

  setActiveMode: (mode) =>
    set((state) => {
      if (state.session.activeMode === mode) return state
      const session = { ...state.session, activeMode: mode }
      persistSession(session)
      return { session }
    }),

  // ---------- campañas (lo que tus pantallas esperan) ----------
  setCampaigns: (campaigns) =>
    set((state) => {
      const session = { ...state.session, campaigns }
      persistSession(session)
      return { session, error: null }
    }),

  assignCampaign: (campaign) =>
    set((state) => {
      const exists = state.session.campaigns.some((c) => c.id === campaign.id)
      const campaigns = exists
        ? state.session.campaigns.map((c) => (c.id === campaign.id ? { ...c, ...campaign } : c))
        : [...state.session.campaigns, campaign]
      const session = { ...state.session, campaigns, activeCampaignId: campaign.id }
      persistSession(session)
      return { session, error: null }
    }),

  setActiveCampaign: (campaignId) =>
    set((state) => {
      const session = { ...state.session, activeCampaignId: campaignId }
      persistSession(session)
      return { session }
    }),

  // ---------- auth con API real ----------
  registerUser: async ({ name, email, password }) => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiRegister({ name, email, password })
      // normaliza nombre del token por si tu API usa accessToken/jwt
      const token = data.token || data.accessToken || data.jwt
      if (!token) throw new Error('No se recibió token del servidor')
      const user = data.user
      const next = {
        ...defaultSession,
        user,
        token,
        activeMode: 'dm',
        campaigns: get().session.campaigns,
        activeCampaignId: get().session.activeCampaignId,
      }
      setAuthToken(token)
      persistSession(next)
      set({ session: next, isLoading: false, error: null })
    } catch (e) {
      set({ isLoading: false, error: e?.message || 'No se pudo registrar' })
      throw e
    }
  },

  loginUser: async ({ email, password }) => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiLogin({ email, password })
      const token = data.token || data.accessToken || data.jwt
      if (!token) throw new Error('No se recibió token del servidor')
      const user = data.user
      const next = {
        ...defaultSession,
        user,
        token,
        activeMode: get().session.activeMode ?? 'dm',
        campaigns: get().session.campaigns,
        activeCampaignId: get().session.activeCampaignId,
      }
      setAuthToken(token)
      persistSession(next)
      set({ session: next, isLoading: false, error: null })
    } catch (e) {
      set({ isLoading: false, error: e?.message || 'Credenciales inválidas' })
      throw e
    }
  },

  logout: () => {
    setAuthToken(null)
    clearPersistedSession()
    set({ session: { ...defaultSession } })
  },

  isAuthenticated: () => {
    const s = get().session
    return Boolean(s?.user && s?.token)
  },
}))
