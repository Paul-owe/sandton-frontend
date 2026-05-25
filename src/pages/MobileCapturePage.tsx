import { Camera, CheckCircle2, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getMobileCaptureSessionByToken, uploadMobileCaptureSessionFile } from '../api/mobileCaptureApi'
import type { MobileCaptureSession } from '../types/mobileCapture'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import {
  clearTransientApiBaseUrlOverride,
  normalizeApiBaseUrl,
  setTransientApiBaseUrlOverride,
} from '../utils/runtimeConfig'

export function MobileCapturePage() {
  const { token = '' } = useParams()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [session, setSession] = useState<MobileCaptureSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const apiBaseUrlFromLink = normalizeApiBaseUrl(new URLSearchParams(window.location.search).get('api') || '')

  useEffect(() => {
    if (!apiBaseUrlFromLink) return
    setTransientApiBaseUrlOverride(apiBaseUrlFromLink)
    return () => clearTransientApiBaseUrlOverride()
  }, [apiBaseUrlFromLink])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError('This mobile capture link is invalid.')
      return
    }

    getMobileCaptureSessionByToken(token)
      .then((response) => {
        setSession(response)
        setError('')
      })
      .catch((err: any) => {
        setError(err?.response?.data?.message || 'This mobile capture link is unavailable.')
      })
      .finally(() => setLoading(false))
  }, [token])

  const openCamera = () => {
    inputRef.current?.click()
  }

  const onFileSelected = async (file: File | null) => {
    if (!file || !token) return
    setUploading(true)
    setError('')
    try {
      const uploadedSession = await uploadMobileCaptureSessionFile(token, file)
      setSession(uploadedSession)
      setSuccess(true)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to upload the captured image right now.')
      setSuccess(false)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_40%,_#e2e8f0_100%)] px-4 py-8">
      <div className="mx-auto max-w-md">
        <Card className="space-y-5 border-white/70 bg-white/95 backdrop-blur">
          <div className="space-y-2 text-center">
            <p className="text-xs tracking-[0.25em] text-brand-700">MOBILE CAPTURE</p>
            <h1 className="text-2xl font-semibold text-slate-900">Capture and send photo</h1>
            <p className="text-sm text-slate-500">
              Take the document photo on this phone and send it straight back to the desktop upload form.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">
              <LoaderCircle className="animate-spin" size={18} />
              Validating capture session...
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
          ) : success ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-emerald-50 p-5 text-center text-emerald-800">
                <CheckCircle2 className="mx-auto mb-3" size={34} />
                <p className="text-base font-semibold">Photo sent successfully</p>
                <p className="mt-1 text-sm">The desktop upload form can now continue. You can close this page.</p>
              </div>
              <Button type="button" variant="secondary" className="w-full" onClick={openCamera} disabled={uploading}>
                Capture another photo
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                Session expires: {session?.expiresAt ? new Date(session.expiresAt).toLocaleTimeString() : '--'}
              </div>
              <Button type="button" className="w-full gap-2 py-3 text-base" onClick={openCamera} disabled={uploading}>
                {uploading ? <LoaderCircle className="animate-spin" size={18} /> : <Camera size={18} />}
                {uploading ? 'Uploading...' : 'Open camera on this phone'}
              </Button>
              <p className="text-center text-xs text-slate-500">
                The camera opens from a hidden capture field. No visible file chooser is shown on this page.
              </p>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onFileSelected(e.target.files?.[0] || null)}
          />
        </Card>
      </div>
    </div>
  )
}
