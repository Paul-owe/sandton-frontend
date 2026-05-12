import type { UserRole } from './auth'

export interface User {
  id?: string | number
  fullName?: string
  email?: string
  role?: UserRole
  branchId?: string | number
  branchName?: string
  active?: boolean
  [key: string]: unknown
}
