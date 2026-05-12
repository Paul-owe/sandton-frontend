import type { PatientAuditTrailEntry } from '../types/audit'
import type { CreatePatientPayload, Patient } from '../types/patient'
import { http, pickArray } from './http'
import { prepareDocumentUploadFile } from '../utils/uploadProcessing'

function normalizePatientPayload(payload: Partial<CreatePatientPayload>): Partial<CreatePatientPayload> {
  return {
    ...payload,
    gender: payload.gender ? String(payload.gender).toUpperCase() : payload.gender,
  }
}

export async function searchPatients(query: string): Promise<Patient[]> {
  const { data } = await http.get('/patients/search', { params: { query } })
  return pickArray<Patient>(data)
}

export async function suggestPatients(query: string): Promise<Patient[]> {
  const { data } = await http.get('/patients/suggest', { params: { query } })
  return pickArray<Patient>(data)
}

export async function getPatientById(id: string): Promise<Patient> {
  const { data } = await http.get(`/patients/${id}`)
  return (data?.data || data) as Patient
}

export async function getPatientAuditTrail(id: string | number): Promise<PatientAuditTrailEntry[]> {
  const { data } = await http.get(`/patients/${id}/audit-trail`)
  return pickArray<PatientAuditTrailEntry>(data)
}

export async function createPatient(payload: CreatePatientPayload): Promise<Patient> {
  const { data } = await http.post('/patients', normalizePatientPayload(payload))
  return (data?.data || data) as Patient
}

export async function registerPatient(
  payload: CreatePatientPayload,
  patientDetailsFile?: File | null,
  patientDetailsNotes?: string,
): Promise<Patient> {
  const formData = new FormData()
  const preparedFile = patientDetailsFile ? await prepareDocumentUploadFile(patientDetailsFile) : null
  formData.append(
    'patient',
    new Blob([JSON.stringify(normalizePatientPayload(payload))], { type: 'application/json' }),
  )
  if (preparedFile) {
    formData.append('patientDetailsFile', preparedFile)
  }
  if (patientDetailsNotes?.trim()) {
    formData.append('patientDetailsNotes', patientDetailsNotes.trim())
  }

  const { data } = await http.post('/patients/register', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return (data?.data || data) as Patient
}

export async function grantPatientDetailsEditOnce(id: string | number): Promise<Patient> {
  const { data } = await http.post(`/patients/${id}/grant-patient-details-edit-once`)
  return (data?.data || data) as Patient
}

export async function frontDeskEditPatientOnce(
  id: string | number,
  payload: CreatePatientPayload,
  patientDetailsFile?: File | null,
  patientDetailsNotes?: string,
): Promise<Patient> {
  const formData = new FormData()
  const preparedFile = patientDetailsFile ? await prepareDocumentUploadFile(patientDetailsFile) : null
  formData.append(
    'patient',
    new Blob([JSON.stringify(normalizePatientPayload(payload))], { type: 'application/json' }),
  )
  if (preparedFile) {
    formData.append('patientDetailsFile', preparedFile)
  }
  if (patientDetailsNotes?.trim()) {
    formData.append('patientDetailsNotes', patientDetailsNotes.trim())
  }

  const { data } = await http.post(`/patients/${id}/frontdesk-edit-once`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return (data?.data || data) as Patient
}

export async function updatePatient(id: string, payload: Partial<CreatePatientPayload>): Promise<Patient> {
  const { data } = await http.put(`/patients/${id}`, normalizePatientPayload(payload))
  return (data?.data || data) as Patient
}
