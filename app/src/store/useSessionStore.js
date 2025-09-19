import { create } from 'zustand'

const defaultSession = {
  user: null,
  campaigns: [],
  activeCampaignId: null,
}

export const useSessionStore = create((set) => ({
  session: { ...defaultSession },
  setSession: (session) => set({ session: { ...defaultSession, ...session } }),
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
      }
    }),
  clearSession: () => set({ session: { ...defaultSession } }),
}))
