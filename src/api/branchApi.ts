import type { Branch } from '../types/branch'
import { http, pickArray } from './http'

export async function getBranches(): Promise<Branch[]> {
  const { data } = await http.get('/branches')
  return pickArray<Branch>(data)
}

export async function createBranch(payload: Partial<Branch>): Promise<Branch> {
  const { data } = await http.post('/branches', payload)
  return (data?.data || data) as Branch
}

export async function updateBranch(id: string | number, payload: Partial<Branch>): Promise<Branch> {
  const { data } = await http.put(`/branches/${id}`, payload)
  return (data?.data || data) as Branch
}
