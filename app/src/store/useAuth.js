import { create } from 'zustand'
import api from '../api/client'

const useAuth = create((set, get) => ({
  user: null, token: localStorage.getItem('token') || null, loading: false,
  isAuthed: !!localStorage.getItem('token'),
  async signup(payload){ set({loading:true}); try{
    const { data } = await api.post('/auth/signup', payload)
    localStorage.setItem('token', data.token); set({ user: data.user, token: data.token, isAuthed: true })
  } finally { set({loading:false}) }},
  async login(payload){ set({loading:true}); try{
    const { data } = await api.post('/auth/login', payload)
    localStorage.setItem('token', data.token); set({ user: data.user, token: data.token, isAuthed: true })
  } finally { set({loading:false}) }},
  async me(){ if (!get().token) return; const { data } = await api.get('/auth/me'); set({ user: data.user, isAuthed: true }) },
  logout(){ localStorage.removeItem('token'); set({ user:null, token:null, isAuthed:false }) }
}))
export default useAuth
