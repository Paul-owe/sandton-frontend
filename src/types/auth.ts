export type UserRole = 'ADMIN' | 'FRONT_DESK' | string

export interface AuthUser {
  id?: string | number
  fullName?: string
  email?: string
  role?: UserRole
  branchId?: string | number | null
  branchName?: string
  active?: boolean
  [key: string]: unknown
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token?: string
  accessToken?: string
  jwt?: string
  user?: AuthUser
  role?: UserRole
  email?: string
  fullName?: string
  branchId?: string | number | null
  [key: string]: unknown
}
