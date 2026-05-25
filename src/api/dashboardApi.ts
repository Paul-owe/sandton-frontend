import { http } from './http'

export type DashboardSummary = {
  patientsVisible: number
  documentsUploaded: number
  doctorsNotes: number
  branchAccess: string
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await http.get('/dashboard/summary')
  return (data?.data || data) as DashboardSummary
}
