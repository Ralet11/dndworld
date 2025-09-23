import { apiClient } from './client'

export const getCampaigns = async (config = {}) => {
  const response = await apiClient.get('/campaigns', config)
  return response.data.campaigns
}

export const getCampaignById = async (campaignId, config = {}) => {
  if (!campaignId) throw new Error('campaignId is required')
  const response = await apiClient.get(`/campaigns/${campaignId}`, config)
  return response.data.campaign
}

export const createCampaign = async (payload, config = {}) => {
  const response = await apiClient.post('/campaigns', payload, config)
  return response.data.campaign
}

export const createScenario = async (campaignId, payload, config = {}) => {
  if (!campaignId) throw new Error('campaignId is required')
  const response = await apiClient.post(`/campaigns/${campaignId}/scenarios`, payload, config)
  return response.data.scenario
}

export const createNpc = async (campaignId, payload, config = {}) => {
  if (!campaignId) throw new Error('campaignId is required')
  const response = await apiClient.post(`/campaigns/${campaignId}/npcs`, payload, config)
  return response.data.npc
}

export const getCampaignNpcs = async (campaignId, params = {}, config = {}) => {
  if (!campaignId) throw new Error('campaignId is required')
  const response = await apiClient.get(`/campaigns/${campaignId}/npcs`, {
    params,
    ...config,
  })
  return response.data.npcs
}

export const getCampaignItems = async (campaignId, params = {}, config = {}) => {
  if (!campaignId) throw new Error('campaignId is required')
  const response = await apiClient.get(`/campaigns/${campaignId}/items`, {
    params,
    ...config,
  })
  return response.data.items
}

export const createItem = async (campaignId, payload, config = {}) => {
  if (!campaignId) throw new Error('campaignId is required')
  const response = await apiClient.post(`/campaigns/${campaignId}/items`, payload, config)
  return response.data.item
}

export const updateItem = async (campaignId, itemId, payload, config = {}) => {
  if (!campaignId) throw new Error('campaignId is required')
  if (!itemId) throw new Error('itemId is required')
  const response = await apiClient.put(`/campaigns/${campaignId}/items/${itemId}`, payload, config)
  return response.data.item
}
