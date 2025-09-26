// app/src/api/campaigns.js
import { apiClient } from './client'

// LISTAR CAMPAÑAS
export const getCampaigns = async (config = {}) => {
  const { data } = await apiClient.get('/campaigns', config)
  // backend: { campaigns: [...] }
  return data.campaigns
}

// OBTENER CAMPAÑA POR ID
export const getCampaignById = async (campaignId, config = {}) => {
  if (!campaignId) throw new Error('campaignId is required')
  const { data } = await apiClient.get(`/campaigns/${campaignId}`, config)
  // backend: { campaign: {...} }
  return data.campaign
}

// CREAR CAMPAÑA
export const createCampaign = async (payload, config = {}) => {
  const { data } = await apiClient.post('/campaigns', payload, config)
  // backend: { campaign: {...} }
  return data.campaign
}

// ESCENARIOS
export const createScenario = async (campaignId, payload, config = {}) => {
  if (!campaignId) throw new Error('campaignId is required')
  const { data } = await apiClient.post(`/campaigns/${campaignId}/scenarios`, payload, config)
  // backend: { scenario: {...} }
  return data.scenario
}

// NPCs
export const createNpc = async (campaignId, payload, config = {}) => {
  if (!campaignId) throw new Error('campaignId is required')
  const { data } = await apiClient.post(`/campaigns/${campaignId}/npcs`, payload, config)
  // backend: { npc: {...} }
  return data.npc
}

export const getCampaignNpcs = async (campaignId, params = {}, config = {}) => {
  if (!campaignId) throw new Error('campaignId is required')
  const { data } = await apiClient.get(`/campaigns/${campaignId}/npcs`, {
    params,
    ...config,
  })
  // backend: { npcs: [...] }
  return data.npcs
}

// ÍTEMS
export const getCampaignItems = async (campaignId, params = {}, config = {}) => {
  if (!campaignId) throw new Error('campaignId is required')
  const { data } = await apiClient.get(`/campaigns/${campaignId}/items`, {
    params,
    ...config,
  })
  // backend: { items: [...] }
  return data.items
}

export const createItem = async (campaignId, payload, config = {}) => {
  if (!campaignId) throw new Error('campaignId is required')
  const { data } = await apiClient.post(`/campaigns/${campaignId}/items`, payload, config)
  // backend: { item: {...} }
  return data.item
}
