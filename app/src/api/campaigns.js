import { apiClient } from './client'

export const getCampaigns = async (config = {}) => {
  const response = await apiClient.get('/campaigns', config)
  return response.data.campaigns
}

export const getCampaignById = async (campaignId, config = {}) => {
  if (!campaignId) throw new Error('campaignId is required')
  const response = await apiClient.get(/campaigns/, config)
  return response.data.campaign
}
