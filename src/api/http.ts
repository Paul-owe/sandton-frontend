import axios from 'axios'
import { clearAuthSession, getToken } from '../utils/authStorage'
import { defaultApiBaseUrl, getApiBaseUrl } from '../utils/runtimeConfig'

export const API_BASE_URL = getApiBaseUrl()

export const http = axios.create({
  baseURL: defaultApiBaseUrl,
})

export const publicHttp = axios.create({
  baseURL: defaultApiBaseUrl,
})

http.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl()
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

publicHttp.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl()
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearAuthSession()
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export const pickArray = <T>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[]
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>
    if (Array.isArray(d.items)) return d.items as T[]
    if (Array.isArray(d.data)) return d.data as T[]
    if (Array.isArray(d.content)) return d.content as T[]
  }
  return []
}
