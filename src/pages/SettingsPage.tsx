import { useState } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import {
  clearApiBaseUrlOverride,
  clearPublicAppUrlOverride,
  defaultApiBaseUrl,
  defaultPublicAppUrl,
  getApiBaseUrl,
  getPublicAppBaseUrl,
  getStoredApiBaseUrlOverride,
  getStoredPublicAppUrlOverride,
  isLikelyLocalOnlyUrl,
  normalizeApiBaseUrl,
  normalizePublicAppUrl,
  setApiBaseUrlOverride,
  setPublicAppUrlOverride,
} from '../utils/runtimeConfig'

export function SettingsPage() {
  const [apiBaseUrl, setApiBaseUrl] = useState(() => getStoredApiBaseUrlOverride() || getApiBaseUrl())
  const [publicAppUrl, setPublicAppUrl] = useState(() => getStoredPublicAppUrlOverride() || getPublicAppBaseUrl())
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const saveNetworkSettings = () => {
    const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl)
    const normalizedPublicAppUrl = normalizePublicAppUrl(publicAppUrl)

    if (!normalizedApiBaseUrl) {
      setError('Enter a valid clinic API address, for example 192.168.1.20:9000/api/v1.')
      return
    }

    if (!normalizedPublicAppUrl) {
      setError('Enter a valid frontend address that staff phones can open, for example 192.168.1.20:5173.')
      return
    }

    setApiBaseUrlOverride(normalizedApiBaseUrl)
    setPublicAppUrlOverride(normalizedPublicAppUrl)
    setApiBaseUrl(normalizedApiBaseUrl)
    setPublicAppUrl(normalizedPublicAppUrl)
    setError('')
    setNotice('Saved network settings. New uploads and phone capture sessions will use these addresses immediately.')
  }

  const resetNetworkSettings = () => {
    clearApiBaseUrlOverride()
    clearPublicAppUrlOverride()
    setApiBaseUrl(defaultApiBaseUrl)
    setPublicAppUrl(defaultPublicAppUrl)
    setError('')
    setNotice('Cleared saved overrides. The app is back to auto-detected addresses.')
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Network Settings</h2>
          <p className="mt-2 text-sm text-slate-500">
            Save the clinic&apos;s current API and frontend addresses here so patient-registration and doctor-note phone uploads keep working when the LAN IP changes.
          </p>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Clinic API base URL</span>
          <Input
            value={apiBaseUrl}
            onChange={(e) => {
              setApiBaseUrl(e.target.value)
              setError('')
            }}
            placeholder="192.168.1.20:9000/api/v1"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Phone-reachable frontend URL</span>
          <Input
            value={publicAppUrl}
            onChange={(e) => {
              setPublicAppUrl(e.target.value)
              setError('')
            }}
            placeholder="192.168.1.20:5173"
          />
        </label>

        {isLikelyLocalOnlyUrl(publicAppUrl) ? (
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            The frontend address currently points to a local-only host. Staff phones will not open QR code capture links until this is changed to the clinic&apos;s LAN IP or hostname.
          </div>
        ) : null}

        {error ? <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={saveNetworkSettings}>
            Save Network Settings
          </Button>
          <Button type="button" variant="ghost" onClick={resetNetworkSettings}>
            Clear Saved Overrides
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Resolved Addresses</h3>
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          API base URL: <code>{getApiBaseUrl()}</code>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          Frontend URL for phone capture: <code>{getPublicAppBaseUrl()}</code>
        </div>
        <p className="text-sm text-slate-500">
          If the clinic router assigns a different IP address, update these two values once and the shared phone camera flow will keep using the corrected addresses.
        </p>
      </Card>
    </div>
  )
}
