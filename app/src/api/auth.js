// api/auth.js
import { apiClient } from './client'

export async function apiRegister({ name, email, password }) {
  const { data } = await apiClient.post('/auth/register', { name, email, password })
  return data // { user, token }
}

export async function apiLogin({ email, password }) {
  const { data } = await apiClient.post('/auth/login', { email, password })
  return data // { user, token }
}

export async function apiMe() {
  const { data } = await apiClient.get('/auth/me')
  return data // { user }
}
