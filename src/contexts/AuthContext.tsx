import { createContext, useContext, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { login as loginApi } from '../api/authApi'
import type { AuthUser } from '../types/auth'
import { clearAuthSession, getToken, getUser, setAuthSession } from '../utils/authStorage'

type AuthContextState = {
  token: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: AuthUser) => void
}

const AuthContext = createContext<AuthContextState | undefined>(undefined)

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(getToken())
  const [user, setUserState] = useState<AuthUser | null>(getUser())

  const login = async (email: string, password: string) => {
    const { token: jwt, user } = await loginApi({ email, password })
    setAuthSession(jwt, user)
    setToken(jwt)
    setUserState(user)
  }

  const logout = () => {
    clearAuthSession()
    setToken(null)
    setUserState(null)
  }

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      isAdmin: (user?.role || '').toString().toUpperCase().includes('ADMIN'),
      login,
      logout,
      setUser: setUserState,
    }),
    [token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
