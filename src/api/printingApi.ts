import axios from 'axios'
import { http } from './http'

export type QzPrintConfig = {
  signingEnabled: boolean
  certificate?: string | null
}

function resolvePrintingApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const responseData = error.response?.data as
      | { data?: { message?: string | null } | null; error?: string | null; message?: string | null }
      | undefined

    const detailedMessage = [
      responseData?.message,
      responseData?.error,
      responseData?.data?.message,
    ].find((value): value is string => typeof value === 'string' && value.trim().length > 0)

    if (detailedMessage) return detailedMessage
    if (status === 401 || status === 403) {
      return 'Your login session expired for QZ Tray signing. Sign in again, then retry printing.'
    }
    if (!error.response) {
      return 'Unable to reach the clinic backend for QZ Tray signing. Confirm the API address in Settings and make sure the backend service is running.'
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

export async function getQzPrintConfig(): Promise<QzPrintConfig> {
  try {
    const { data } = await http.get('/printing/qz/config')
    return (data?.data || data) as QzPrintConfig
  } catch (error) {
    throw new Error(
      resolvePrintingApiErrorMessage(
        error,
        'Unable to load the QZ Tray signing certificate from the clinic backend right now.',
      ),
      { cause: error },
    )
  }
}

export async function signQzPrintRequest(request: string): Promise<string> {
  try {
    const { data } = await http.post('/printing/qz/sign', { request })
    const resolved = (data?.data || data) as { signature?: string | null }
    const signature = String(resolved?.signature || '').trim()

    if (!signature) {
      throw new Error('The clinic backend returned an empty QZ Tray signature.')
    }

    return signature
  } catch (error) {
    throw new Error(
      resolvePrintingApiErrorMessage(
        error,
        'Unable to sign the QZ Tray request with the clinic backend right now.',
      ),
      { cause: error },
    )
  }
}
