import type { AuthUser } from '../types/auth'

const TOKEN_KEY = 'sfms_token'
const USER_KEY = 'sfms_user'

export function setAuthSession(token: string, user?: AuthUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // Ignore storage failures so unauthenticated public flows such as mobile capture can still render.
  }
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    // Ignore storage failures.
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getUser(): AuthUser | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(USER_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}
