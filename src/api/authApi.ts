import { http } from './http'
import type { AuthUser, LoginRequest, LoginResponse } from '../types/auth'

const resolveToken = (payload: LoginResponse): string | null =>
  payload.token || payload.accessToken || payload.jwt || null

const resolveUser = (payload: LoginResponse): AuthUser => {
  if (payload.user) return payload.user
  return {
    fullName: payload.fullName as string | undefined,
    email: payload.email as string | undefined,
    role: payload.role as string | undefined,
    branchId: payload.branchId,
  }
}

export async function login(payload: LoginRequest): Promise<{ token: string; user: AuthUser }> {
  const { data } = await http.post<LoginResponse>('/auth/login', payload)
  const token = resolveToken(data)
  if (!token) throw new Error('No token returned by the server.')
  return { token, user: resolveUser(data) }
}
