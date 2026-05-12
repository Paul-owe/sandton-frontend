import type { User } from '../types/user'
import { http, pickArray } from './http'

export async function getUsers(): Promise<User[]> {
  const { data } = await http.get('/users')
  return pickArray<User>(data)
}

export async function createUser(payload: Partial<User> & { password?: string }): Promise<User> {
  const { data } = await http.post('/users', payload)
  return (data?.data || data) as User
}
