const STORAGE_KEYS = {
  apiBaseUrl: 'sfms.runtime.apiBaseUrl',
  publicAppUrl: 'sfms.runtime.publicAppUrl',
} as const

export const defaultApiBaseUrl = `${window.location.protocol}//${window.location.hostname || '127.0.0.1'}:9000/api/v1`
export const defaultPublicAppUrl = normalizeBaseUrl(window.location.origin) || window.location.origin

function readStoredValue(key: string) {
  try {
    return window.localStorage.getItem(key)?.trim() || ''
  } catch {
    return ''
  }
}

function writeStoredValue(key: string, value: string) {
  try {
    if (value) {
      window.localStorage.setItem(key, value)
      return
    }
    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage issues and fall back to env/current-origin defaults.
  }
}

function withProtocol(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `${window.location.protocol}//${trimmed}`
}

function normalizeBaseUrl(value: string) {
  const candidate = withProtocol(value)
  if (!candidate) return ''

  try {
    const parsed = new URL(candidate)
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

export function normalizeApiBaseUrl(value: string) {
  return normalizeBaseUrl(value)
}

export function normalizePublicAppUrl(value: string) {
  return normalizeBaseUrl(value)
}

export function getStoredApiBaseUrlOverride() {
  return normalizeApiBaseUrl(readStoredValue(STORAGE_KEYS.apiBaseUrl))
}

export function getStoredPublicAppUrlOverride() {
  return normalizePublicAppUrl(readStoredValue(STORAGE_KEYS.publicAppUrl))
}

export function getApiBaseUrl() {
  return (
    getStoredApiBaseUrlOverride() ||
    normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL || '') ||
    defaultApiBaseUrl
  )
}

export function getPublicAppBaseUrl() {
  return (
    getStoredPublicAppUrlOverride() ||
    normalizePublicAppUrl(import.meta.env.VITE_PUBLIC_APP_URL || '') ||
    defaultPublicAppUrl
  )
}

export function setApiBaseUrlOverride(value: string) {
  const normalized = normalizeApiBaseUrl(value)
  writeStoredValue(STORAGE_KEYS.apiBaseUrl, normalized)
  return normalized
}

export function setPublicAppUrlOverride(value: string) {
  const normalized = normalizePublicAppUrl(value)
  writeStoredValue(STORAGE_KEYS.publicAppUrl, normalized)
  return normalized
}

export function clearApiBaseUrlOverride() {
  writeStoredValue(STORAGE_KEYS.apiBaseUrl, '')
}

export function clearPublicAppUrlOverride() {
  writeStoredValue(STORAGE_KEYS.publicAppUrl, '')
}

export function buildMobileCaptureUrl(token: string, baseUrl = getPublicAppBaseUrl()) {
  const normalizedBaseUrl = normalizePublicAppUrl(baseUrl) || defaultPublicAppUrl
  return `${normalizedBaseUrl}/mobile-capture/${token}`
}

export function isLikelyLocalOnlyUrl(url: string) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(url)
}
