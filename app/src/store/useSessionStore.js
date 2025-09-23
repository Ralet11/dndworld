import { create } from 'zustand'
import { setAuthToken } from '../api/client'

const SESSION_STORAGE_KEY = 'dw_session'
const USERS_STORAGE_KEY = 'dw_users'
const isBrowser = typeof window !== 'undefined'

const safeParse = (value, fallback) => {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch (error) {
    console.warn('Unable to parse stored value', error)
    return fallback
  }
}

const loadStoredSession = () => {
  if (!isBrowser) return null
  return safeParse(window.localStorage.getItem(SESSION_STORAGE_KEY), null)
}

const persistSession = (session) => {
  if (!isBrowser) return
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

const clearPersistedSession = () => {
  if (!isBrowser) return
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
}

const loadStoredUsers = () => {
  if (!isBrowser) return []
  return safeParse(window.localStorage.getItem(USERS_STORAGE_KEY), []) ?? []
}

const persistUsers = (users) => {
  if (!isBrowser) return
  window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
}

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `user-${Date.now()}-${Math.floor(Math.random() * 100000)}`
}

const defaultSession = {
  user: null,
  token: null,
  campaigns: [],
  activeCampaignId: null,
  activeMode: 'dm',
  playerCharacters: [],
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

export const useSessionStore = create((set, get) => ({
  session: { ...initialSession },
  isLoading: false,
  error: null,

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

      return {
        session: nextSession,
        isLoading: false,
        error: null,
      }
    }),

  setCampaigns: (campaigns) =>
    set((state) => {
      const nextSession = {
        ...state.session,
        campaigns,
      }
      persistSession(nextSession)
      return {
        session: nextSession,
        error: null,
      }
    }),

  assignCampaign: (campaign) =>
    set((state) => {
      const campaignExists = state.session.campaigns.some((c) => c.id === campaign.id)
      const campaigns = campaignExists
        ? state.session.campaigns.map((c) => (c.id === campaign.id ? { ...c, ...campaign } : c))
        : [...state.session.campaigns, campaign]

      const nextSession = {
        ...state.session,
        campaigns,
        activeCampaignId: campaign.id,
      }

      persistSession(nextSession)

      return {
        session: nextSession,
        error: null,
      }
    }),

  setActiveCampaign: (campaignId) =>
    set((state) => {
      const nextSession = {
        ...state.session,
        activeCampaignId: campaignId,
      }
      persistSession(nextSession)
      return { session: nextSession }
    }),

  setActiveMode: (mode) =>
    set((state) => {
      if (state.session.activeMode === mode) return state
      const nextSession = {
        ...state.session,
        activeMode: mode,
      }
      persistSession(nextSession)
      return { session: nextSession }
    }),

  addPlayerCharacter: (character) =>
    set((state) => {
      const newCharacter = {
        id: generateId(),
        name: character.name.trim(),
        classType: character.classType.trim(),
        level: Number.parseInt(character.level, 10) || 1,
        race: character.race.trim(),
        background: character.background.trim(),
        alignment: character.alignment.trim(),
        notes: character.notes.trim(),
        createdAt: new Date().toISOString(),
      }

      const playerCharacters = [...state.session.playerCharacters, newCharacter]
      const nextSession = {
        ...state.session,
        playerCharacters,
      }

      persistSession(nextSession)
      return { session: nextSession }
    }),

  removePlayerCharacter: (characterId) =>
    set((state) => {
      const playerCharacters = state.session.playerCharacters.filter(
        (character) => character.id !== characterId,
      )
      const nextSession = {
        ...state.session,
        playerCharacters,
      }
      persistSession(nextSession)
      return { session: nextSession }
    }),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  clearSession: () =>
    set(() => {
      setAuthToken(null)
      clearPersistedSession()
      return {
        session: { ...defaultSession },
        isLoading: false,
        error: null,
      }
    }),

  isAuthenticated: () => Boolean(get().session.token),

  registerUser: ({ name, email, password }) => {
    const normalizedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()

    if (!normalizedEmail || !trimmedPassword) {
      throw new Error('Email y password son obligatorios.')
    }
    if (!name.trim()) {
      throw new Error('El nombre es obligatorio.')
    }

    const users = loadStoredUsers()
    const exists = users.some((user) => user.email === normalizedEmail)
    if (exists) {
      throw new Error('Ese email ya está registrado.')
    }

    const newUser = {
      id: generateId(),
      name: name.trim(),
      email: normalizedEmail,
      password: trimmedPassword,
      createdAt: new Date().toISOString(),
    }

    users.push(newUser)
    persistUsers(users)

    const token = `local-${Date.now()}`
    const session = {
      ...defaultSession,
      user: { id: newUser.id, name: newUser.name, email: newUser.email },
      token,
      activeMode: 'dm',
    }

    setAuthToken(token)
    persistSession(session)

    set({ session, isLoading: false, error: null })
  },

  loginUser: ({ email, password }) => {
    const normalizedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()

    if (!normalizedEmail || !trimmedPassword) {
      throw new Error('Completa email y password.')
    }

    const users = loadStoredUsers()
    const user = users.find(
      (candidate) => candidate.email === normalizedEmail && candidate.password === trimmedPassword,
    )

    if (!user) {
      throw new Error('Credenciales inválidas.')
    }

    const token = `local-${Date.now()}`
    const session = {
      ...defaultSession,
      user: { id: user.id, name: user.name, email: user.email },
      token,
      activeMode: get().session.activeMode ?? 'dm',
      campaigns: get().session.campaigns,
      activeCampaignId: get().session.activeCampaignId,
    }

    setAuthToken(token)
    persistSession(session)

    set({ session, isLoading: false, error: null })
  },

  logout: () => {
    setAuthToken(null)
    clearPersistedSession()
    set({ session: { ...defaultSession } })
  },
}))
