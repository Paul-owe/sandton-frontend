declare const __SFMS_NETWORK_PUBLIC_APP_URLS__: string[]

const STORAGE_KEYS = {
  apiBaseUrl: 'sfms.runtime.apiBaseUrl',
  publicAppUrl: 'sfms.runtime.publicAppUrl',
} as const

export const defaultApiBaseUrl = `${window.location.protocol}//${window.location.hostname || '127.0.0.1'}:18081/api/v1`
export const defaultPublicAppUrl = normalizeBaseUrl(window.location.origin) || window.location.origin
const LOCAL_ONLY_HOST_PATTERN = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|::1|\[::1\])$/i
const PRIVATE_IPV4_PATTERN =
  /^(10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/
let detectedPublicAppBaseUrl = ''
let detectedPublicAppBaseUrlPromise: Promise<string> | null = null
let transientApiBaseUrlOverride = ''

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

function isLocalOnlyHostname(hostname: string) {
  return LOCAL_ONLY_HOST_PATTERN.test(hostname.trim())
}

function getCurrentFrontendPort() {
  if (window.location.port) return window.location.port
  return window.location.protocol === 'https:' ? '443' : '80'
}

function buildUrl(protocol: string, hostname: string, port?: string) {
  const normalizedProtocol = protocol || window.location.protocol
  const portSegment =
    port && !((normalizedProtocol === 'https:' && port === '443') || (normalizedProtocol === 'http:' && port === '80'))
      ? `:${port}`
      : ''
  return `${normalizedProtocol}//${hostname}${portSegment}`
}

function parseUrl(value: string) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function pathWithoutTrailingSlash(pathname: string) {
  return pathname.replace(/\/$/, '')
}

function isPrivateIpv4Address(value: string) {
  return PRIVATE_IPV4_PATTERN.test(value.trim())
}

function extractIpv4Candidate(candidate: string) {
  const match = candidate.match(/(\d{1,3}(?:\.\d{1,3}){3})/)
  if (!match) return ''
  const ip = match[1]
  return isLocalOnlyHostname(ip) ? '' : ip
}

function firstReachablePublicAppUrl() {
  const candidates = [
    getStoredPublicAppUrlOverride(),
    normalizePublicAppUrl(import.meta.env.VITE_PUBLIC_APP_URL || ''),
    ...(__SFMS_NETWORK_PUBLIC_APP_URLS__ || []).map((candidate) => normalizePublicAppUrl(candidate)),
    normalizePublicAppUrl(window.location.origin),
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    const parsed = parseUrl(candidate)
    if (parsed && !isLocalOnlyHostname(parsed.hostname)) {
      return candidate
    }
  }

  return ''
}

function derivePublicAppUrlFromApiBase() {
  const configuredApiBaseUrl =
    getStoredApiBaseUrlOverride() ||
    normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL || '') ||
    defaultApiBaseUrl

  const parsedApiUrl = parseUrl(configuredApiBaseUrl)
  if (!parsedApiUrl || isLocalOnlyHostname(parsedApiUrl.hostname)) {
    return ''
  }

  return normalizePublicAppUrl(buildUrl(window.location.protocol, parsedApiUrl.hostname, getCurrentFrontendPort()))
}

function firstReachableApiBaseUrl() {
  const candidates = [
    getStoredApiBaseUrlOverride(),
    normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL || ''),
    normalizeApiBaseUrl(defaultApiBaseUrl),
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    const parsed = parseUrl(candidate)
    if (parsed && !isLocalOnlyHostname(parsed.hostname)) {
      return candidate
    }
  }

  return ''
}

function deriveApiBaseUrlFromPublicAppBase(publicAppBaseUrl = getPublicAppBaseUrl()) {
  const parsedPublicAppUrl = parseUrl(publicAppBaseUrl)
  if (!parsedPublicAppUrl || isLocalOnlyHostname(parsedPublicAppUrl.hostname)) {
    return ''
  }

  const configuredApiBaseUrl =
    getStoredApiBaseUrlOverride() ||
    normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL || '') ||
    normalizeApiBaseUrl(defaultApiBaseUrl)

  const parsedApiBaseUrl = parseUrl(configuredApiBaseUrl)
  const apiPath = pathWithoutTrailingSlash(parsedApiBaseUrl?.pathname || '/api/v1') || '/api/v1'
  const apiPort = parsedApiBaseUrl?.port || '18081'
  return normalizeApiBaseUrl(`${buildUrl(parsedPublicAppUrl.protocol, parsedPublicAppUrl.hostname, apiPort)}${apiPath}`)
}

export function getApiBaseUrl() {
  return (
    transientApiBaseUrlOverride ||
    firstReachableApiBaseUrl() ||
    deriveApiBaseUrlFromPublicAppBase() ||
    getStoredApiBaseUrlOverride() ||
    normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL || '') ||
    defaultApiBaseUrl
  )
}

export function getPublicAppBaseUrl() {
  return (
    detectedPublicAppBaseUrl ||
    firstReachablePublicAppUrl() ||
    derivePublicAppUrlFromApiBase() ||
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

export function setTransientApiBaseUrlOverride(value: string) {
  transientApiBaseUrlOverride = normalizeApiBaseUrl(value)
  return transientApiBaseUrlOverride
}

export function setPublicAppUrlOverride(value: string) {
  const normalized = normalizePublicAppUrl(value)
  writeStoredValue(STORAGE_KEYS.publicAppUrl, normalized)
  return normalized
}

export function clearApiBaseUrlOverride() {
  writeStoredValue(STORAGE_KEYS.apiBaseUrl, '')
}

export function clearTransientApiBaseUrlOverride() {
  transientApiBaseUrlOverride = ''
}

export function clearPublicAppUrlOverride() {
  writeStoredValue(STORAGE_KEYS.publicAppUrl, '')
}

export function buildMobileCaptureUrl(token: string, baseUrl = getPublicAppBaseUrl()) {
  const normalizedBaseUrl = normalizePublicAppUrl(baseUrl) || defaultPublicAppUrl
  const resolvedApiBaseUrl = deriveApiBaseUrlFromPublicAppBase(normalizedBaseUrl) || getApiBaseUrl()
  const url = new URL(`${normalizedBaseUrl}/mobile-capture/${token}`)
  if (resolvedApiBaseUrl) {
    url.searchParams.set('api', resolvedApiBaseUrl)
  }
  return url.toString()
}

async function detectLanHostnameFromBrowser() {
  if (typeof window === 'undefined') return ''

  const RtcPeerConnection =
    window.RTCPeerConnection ||
    (window as Window & typeof globalThis & { webkitRTCPeerConnection?: typeof RTCPeerConnection })
      .webkitRTCPeerConnection

  if (!RtcPeerConnection) {
    return ''
  }

  return new Promise<string>((resolve) => {
    const discoveredCandidates = new Set<string>()
    let settled = false

    const finish = (value: string) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      connection.onicecandidate = null
      connection.close()
      resolve(value)
    }

    const registerCandidate = (candidateText?: string | null) => {
      if (!candidateText) return
      const candidateIp = extractIpv4Candidate(candidateText)
      if (!candidateIp) return
      discoveredCandidates.add(candidateIp)
      if (isPrivateIpv4Address(candidateIp)) {
        finish(candidateIp)
      }
    }

    const connection = new RtcPeerConnection({ iceServers: [] })
    const timeoutId = window.setTimeout(() => {
      const bestCandidate = Array.from(discoveredCandidates).find((candidate) => isPrivateIpv4Address(candidate)) ||
        Array.from(discoveredCandidates)[0] ||
        ''
      finish(bestCandidate)
    }, 1800)

    connection.createDataChannel('sfms-lan-detect')
    connection.onicecandidate = (event) => {
      registerCandidate(event.candidate?.candidate)
      if (!event.candidate) {
        const bestCandidate =
          Array.from(discoveredCandidates).find((candidate) => isPrivateIpv4Address(candidate)) ||
          Array.from(discoveredCandidates)[0] ||
          ''
        finish(bestCandidate)
      }
    }

    connection
      .createOffer()
      .then((offer) => connection.setLocalDescription(offer))
      .catch(() => finish(''))
  })
}

export async function detectPublicAppBaseUrl() {
  const immediatelyAvailable = firstReachablePublicAppUrl() || derivePublicAppUrlFromApiBase()
  if (immediatelyAvailable && !isLikelyLocalOnlyUrl(immediatelyAvailable)) {
    detectedPublicAppBaseUrl = immediatelyAvailable
    return immediatelyAvailable
  }

  if (!detectedPublicAppBaseUrlPromise) {
    detectedPublicAppBaseUrlPromise = detectLanHostnameFromBrowser()
      .then((hostname) => {
        if (!hostname) return ''
        const detectedUrl = normalizePublicAppUrl(buildUrl(window.location.protocol, hostname, getCurrentFrontendPort()))
        detectedPublicAppBaseUrl = detectedUrl || ''
        return detectedPublicAppBaseUrl
      })
      .finally(() => {
        detectedPublicAppBaseUrlPromise = null
      })
  }

  const detectedUrl = await detectedPublicAppBaseUrlPromise
  return detectedUrl || getPublicAppBaseUrl()
}

export function isLikelyLocalOnlyUrl(url: string) {
  const parsed = parseUrl(url)
  if (parsed) {
    return isLocalOnlyHostname(parsed.hostname)
  }
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|::1/i.test(url)
}
