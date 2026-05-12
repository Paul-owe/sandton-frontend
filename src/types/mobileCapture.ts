export type MobileCaptureSessionStatus = 'PENDING' | 'UPLOADED' | 'CONSUMED' | 'EXPIRED' | string

export interface MobileCaptureSession {
  id?: string | number
  token?: string | null
  status?: MobileCaptureSessionStatus
  expiresAt?: string
  uploadedAt?: string | null
  originalFileName?: string | null
  mimeType?: string | null
  fileSize?: number | null
}
