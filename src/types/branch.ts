export interface Branch {
  id?: string | number
  name?: string
  address?: string
  phone?: string
  active?: boolean
  [key: string]: unknown
}
