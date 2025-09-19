import { create } from 'zustand'

const defaultSession = {
  user: null,
  campaigns: [],
  activeCampaignId: null,
}

export const useSessionStore = create((set) => ({
  session: { ...defaultSession },
  isLoading: false,
  error: null,
  setSession: (session) =>
    set({
      session: { ...defaultSession, ...session },
      isLoading: false,
      error: null,
    }),
  setCampaigns: (campaigns) =>
    set((state) => ({
      session: {
        ...state.session,
        campaigns,
      },
      error: null,
    })),
  assignCampaign: (campaign) =>
    set((state) => {
      const campaignExists = state.session.campaigns.some((c) => c.id === campaign.id)
      const campaigns = campaignExists
        ? state.session.campaigns.map((c) => (c.id === campaign.id ? { ...c, ...campaign } : c))
        : [...state.session.campaigns, campaign]

      return {
        session: {
          ...state.session,
          campaigns,
          activeCampaignId: campaign.id,
        },
        error: null,
      }
    }),
  setActiveCampaign: (campaignId) =>
    set((state) => ({
      session: {
        ...state.session,
        activeCampaignId: campaignId,
      },
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearSession: () =>
    set({
      session: { ...defaultSession },
      isLoading: false,
      error: null,
    }),
}))
