import { http, pickArray } from './http'
import type { PatientDocument, UploadDocumentPayload } from '../types/document'
import { prepareDocumentUploadFile } from '../utils/uploadProcessing'
import { getApiBaseUrl } from '../utils/runtimeConfig'

export async function getPatientDocuments(patientId: string): Promise<PatientDocument[]> {
  const { data } = await http.get(`/patients/${patientId}/documents`)
  return pickArray<PatientDocument>(data)
}

export async function uploadPatientDocument(
  patientId: string,
  payload: UploadDocumentPayload,
): Promise<PatientDocument> {
  const preparedFile = await prepareDocumentUploadFile(payload.file)
  const formData = new FormData()
  formData.append('documentType', payload.documentType)
  if (payload.notes) formData.append('notes', payload.notes)
  formData.append('file', preparedFile)
  const { data } = await http.post(`/patients/${patientId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return (data?.data || data) as PatientDocument
}

export function getDocumentDownloadUrl(documentId: string | number): string {
  return `${getApiBaseUrl()}/documents/${documentId}/download`
}

export function getDocumentContentUrl(documentId: string | number): string {
  return `${getApiBaseUrl()}/documents/${documentId}/content`
}

export async function getPatientDocumentBlob(
  documentId: string | number,
  mode: 'download' | 'content' = 'content',
): Promise<Blob> {
  const { data } = await http.get(`/documents/${documentId}/${mode}`, { responseType: 'blob' })
  return data as Blob
}

export async function downloadPatientDocument(
  documentId: string | number,
  fileName = 'document',
): Promise<void> {
  const blob = await getPatientDocumentBlob(documentId, 'download')
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
