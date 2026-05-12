import type { MobileCaptureSession } from '../types/mobileCapture'
import { http, publicHttp } from './http'
import { prepareDocumentUploadFile } from '../utils/uploadProcessing'

export async function createMobileCaptureSession(): Promise<MobileCaptureSession> {
  const { data } = await http.post('/mobile-capture-sessions')
  return (data?.data || data) as MobileCaptureSession
}

export async function getMobileCaptureSession(id: string | number): Promise<MobileCaptureSession> {
  const { data } = await http.get(`/mobile-capture-sessions/${id}`)
  return (data?.data || data) as MobileCaptureSession
}

export async function downloadMobileCaptureSessionFile(id: string | number): Promise<File> {
  const session = await getMobileCaptureSession(id)
  const { data } = await http.get(`/mobile-capture-sessions/${id}/file`, { responseType: 'blob' })
  const blob = data as Blob
  const extension = extensionForMimeType(session.mimeType || blob.type)
  const fileName = session.originalFileName || `mobile-capture${extension}`
  return new File([blob], fileName, { type: blob.type || session.mimeType || 'image/jpeg', lastModified: Date.now() })
}

export async function consumeMobileCaptureSession(id: string | number): Promise<MobileCaptureSession> {
  const { data } = await http.post(`/mobile-capture-sessions/${id}/consume`)
  return (data?.data || data) as MobileCaptureSession
}

export async function getMobileCaptureSessionByToken(token: string): Promise<MobileCaptureSession> {
  const { data } = await publicHttp.get(`/mobile-capture-sessions/token/${token}`)
  return (data?.data || data) as MobileCaptureSession
}

export async function uploadMobileCaptureSessionFile(token: string, file: File): Promise<MobileCaptureSession> {
  const preparedFile = await prepareDocumentUploadFile(file)
  const formData = new FormData()
  formData.append('file', preparedFile)
  const { data } = await publicHttp.post(`/mobile-capture-sessions/token/${token}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return (data?.data || data) as MobileCaptureSession
}

function extensionForMimeType(mimeType?: string | null) {
  if (mimeType === 'image/png') return '.png'
  if (mimeType === 'image/webp') return '.webp'
  if (mimeType === 'application/pdf') return '.pdf'
  return '.jpg'
}
