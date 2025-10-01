import api from './client'

export async function equipItem(inventoryId, equipped) {
  return api.patch(`/characters/inventory/${inventoryId}`, { equipped })
}
