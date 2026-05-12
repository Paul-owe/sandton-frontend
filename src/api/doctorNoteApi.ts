import type { DoctorNote } from '../types/doctorNote'
import { http, pickArray } from './http'

type CreateDoctorNoteWithDocumentPayload = {
  documentNotes?: string
  note: Partial<DoctorNote>
  file: File
}

export async function getPatientDoctorNotes(patientId: string): Promise<DoctorNote[]> {
  const { data } = await http.get(`/patients/${patientId}/doctor-notes`)
  return pickArray<DoctorNote>(data)
}

export async function createDoctorNote(
  patientId: string,
  payload: Partial<DoctorNote>,
): Promise<DoctorNote> {
  const { data } = await http.post(`/patients/${patientId}/doctor-notes`, payload)
  return (data?.data || data) as DoctorNote
}

export async function createDoctorNoteWithDocument(
  patientId: string,
  payload: CreateDoctorNoteWithDocumentPayload,
): Promise<DoctorNote> {
  const formData = new FormData()
  formData.append(
    'doctorNote',
    new Blob(
      [
        JSON.stringify({
          documentNotes: payload.documentNotes || '',
          note: payload.note,
        }),
      ],
      { type: 'application/json' },
    ),
  )
  formData.append('file', payload.file)

  const { data } = await http.post(`/patients/${patientId}/doctor-notes/with-document`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return (data?.data || data) as DoctorNote
}
