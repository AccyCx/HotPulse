import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 15000 })

api.interceptors.response.use(
  res => res.data,
  err => Promise.reject(err.response?.data?.error || err.message)
)

export const keywordsApi = {
  getAll: () => api.get('/keywords'),
  add: keyword => api.post('/keywords', { keyword }),
  toggle: (id, enabled) => api.patch(`/keywords/${id}`, { enabled }),
  remove: id => api.delete(`/keywords/${id}`),
  getAlerts: (id, params) => api.get(`/keywords/${id}/alerts`, { params }),
  checkNow: () => api.post('/keywords/check-now'),
}

export const domainsApi = {
  getAll: () => api.get('/domains'),
  add: (name, description) => api.post('/domains', { name, description }),
  toggle: (id, enabled) => api.patch(`/domains/${id}`, { enabled }),
  remove: id => api.delete(`/domains/${id}`),
  refresh: () => api.post('/domains/refresh'),
}

export const topicsApi = {
  getAll: params => api.get('/topics', { params }),
  getStats: () => api.get('/topics/stats'),
}

export const alertsApi = {
  getAll: params => api.get('/alerts', { params }),
  getStats: () => api.get('/alerts/stats'),
  markRead: id => api.patch(`/alerts/${id}/read`),
  markAllRead: () => api.post('/alerts/read-all'),
  clearAll: () => api.delete('/alerts'),
}

export const settingsApi = {
  get: () => api.get('/settings'),
  save: data => api.post('/settings', data),
  testEmail: () => api.post('/settings/test-email'),
  testAI: () => api.post('/settings/test-ai'),
}

export default api
