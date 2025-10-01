import { create } from 'zustand'
import api from '../api/client'
import { getSocket } from '../api/socket'

const useSession = create((set, get) => ({
  ctx: null, map: null, tokens: [], layers: [], participants: [], dmMessage: '',
  async bootstrap(sessionId){
    const { data } = await api.get(`/sessions/${sessionId}/me`)
    set({ ctx: data })
    await get().loadMap(data.activeMapId)
    try { const l = await api.get(`/sessions/${sessionId}/layers`); set({ layers: l.data }) } catch {}
    try { const p = await api.get(`/sessions/${sessionId}/participants`); set({ participants: p.data }) } catch {}
    try { const m = await api.get(`/sessions/${sessionId}/dm-message`); set({ dmMessage: m.data?.text || '' }) } catch {}
    // sockets
    const s = getSocket(); if (!s) return
    s.emit('session:join', { sessionId })
    s.on('session:layer-changed', ({ mapId })=> get().loadMap(mapId))
    s.on('token:moved', ({ tokenId, x, y })=> set({ tokens: get().tokens.map(t=> t.id===tokenId? {...t, x, y}: t ) }))
    s.on('dm:message', ({ text })=> set({ dmMessage: text }))
  },
  async loadMap(mapId){
    if (!mapId) return set({ map:null, tokens:[] })
    const m = await api.get(`/scenarios/maps/${mapId}`)
    const t = await api.get(`/scenarios/maps/${mapId}/tokens`)
    set({ map: m.data, tokens: t.data })
  },
  async changeLayer(sessionId, layerId){
    await api.post(`/sessions/${sessionId}/change-layer`, { layerId })
    const { data } = await api.get(`/sessions/${sessionId}/me`)
    await get().loadMap(data.activeMapId)
    const s = getSocket(); if (s) s.emit('session:layer-changed', { sessionId, mapId: data.activeMapId })
  },
  async moveToken(tokenId, x, y){
    await api.patch(`/scenarios/tokens/${tokenId}`, { x, y })
    set({ tokens: get().tokens.map(t=> t.id===tokenId? {...t, x, y}: t ) })
    const s = getSocket(); if (s) s.emit('token:moved', { tokenId, x, y })
  },
  async sendDmMessage(sessionId, text){
    await api.post(`/sessions/${sessionId}/dm-message`, { text })
    set({ dmMessage: text })
    const s = getSocket(); if (s) s.emit('dm:message', { sessionId, text })
  }
}))

export default useSession
