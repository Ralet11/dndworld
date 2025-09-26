// app/src/api/scenarios.js
import { apiClient } from './client'

// images: [{ url, label?, sortOrder }]
export async function addScenarioImages(scenarioId, images) {
  const { data } = await apiClient.post(`/scenarios/${scenarioId}/images`, { images })
  return data
}

export async function updateScenario(scenarioId, payload, config = {}) {
  if (!scenarioId) throw new Error('scenarioId is required')
  const { data } = await apiClient.put(`/scenarios/${scenarioId}`, payload, config)
  return data.scenario
}
