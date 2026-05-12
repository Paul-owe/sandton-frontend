export type DocumentType =
  | 'PATIENT_DETAILS'
  | 'DOCTORS_NOTES'
  | 'LAB_RESULT'
  | 'REFERRAL'
  | 'MEDICAL_AID'
  | 'OTHER'
  | string

export interface PatientDocument {
  id?: string | number
  patientId?: string | number
  documentType?: DocumentType
  originalFileName?: string
  storedFileName?: string
  mimeType?: string
  fileSize?: number
  notes?: string
  uploadedBy?: string
  uploadedAt?: string
  [key: string]: unknown
}

export interface UploadDocumentPayload {
  documentType: DocumentType
  notes?: string
  file: File
}
