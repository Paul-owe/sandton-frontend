import { useEffect, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import {
  getReceiptPrinterDiagnostics,
  printTestReceiptDirect,
  getReceiptPrinterSupport,
  listAvailableReceiptPrinters,
  type ReceiptPrinterDiagnostics,
} from '../utils/receiptPrinter'
import {
  clearApiBaseUrlOverride,
  clearReceiptPrinterSettings,
  clearPublicAppUrlOverride,
  defaultApiBaseUrl,
  defaultPublicAppUrl,
  getApiBaseUrl,
  getPublicAppBaseUrl,
  getStoredReceiptPrinterPaperWidth,
  getStoredReceiptPrinterProfile,
  getStoredReceiptPrinterName,
  getStoredApiBaseUrlOverride,
  getStoredPublicAppUrlOverride,
  isLikelyLocalOnlyUrl,
  normalizeApiBaseUrl,
  normalizePublicAppUrl,
  setApiBaseUrlOverride,
  setPublicAppUrlOverride,
  setReceiptPrinterPaperWidth,
  setReceiptPrinterProfile,
  setReceiptPrinterName,
  type ReceiptPrinterPaperWidth,
  type ReceiptPrinterProfile,
} from '../utils/runtimeConfig'

export function SettingsPage() {
  const [apiBaseUrl, setApiBaseUrl] = useState(() => getStoredApiBaseUrlOverride() || getApiBaseUrl())
  const [publicAppUrl, setPublicAppUrl] = useState(() => getStoredPublicAppUrlOverride() || getPublicAppBaseUrl())
  const [receiptPrinterProfile, setReceiptPrinterProfileState] = useState<ReceiptPrinterProfile>(() => getStoredReceiptPrinterProfile())
  const [receiptPrinterPaperWidth, setReceiptPrinterPaperWidthState] = useState<ReceiptPrinterPaperWidth>(() => getStoredReceiptPrinterPaperWidth())
  const [receiptPrinterName, setReceiptPrinterNameState] = useState(() => getStoredReceiptPrinterName())
  const [receiptPrinterNotice, setReceiptPrinterNotice] = useState('')
  const [receiptPrinterError, setReceiptPrinterError] = useState('')
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([])
  const [printersLoading, setPrintersLoading] = useState(false)
  const [printerStatusLoading, setPrinterStatusLoading] = useState(false)
  const [testPrintLoading, setTestPrintLoading] = useState(false)
  const [qzSigningEnabled, setQzSigningEnabled] = useState(false)
  const [printerDiagnostics, setPrinterDiagnostics] = useState<ReceiptPrinterDiagnostics | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refreshQzSigningState = async () => {
    return getReceiptPrinterSupport()
      .then((support) => setQzSigningEnabled(support.signingEnabled))
      .catch(() => setQzSigningEnabled(false))
  }

  useEffect(() => {
    void refreshQzSigningState()
  }, [])

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

  const saveReceiptPrinterSettings = () => {
    if (receiptPrinterProfile !== 'browser' && !receiptPrinterName.trim()) {
      setReceiptPrinterError('Enter or select the Windows printer name for the receipt printer before saving direct printing.')
      return
    }

    const normalizedPrinterName = receiptPrinterName.trim()
    setReceiptPrinterProfile(receiptPrinterProfile)
    setReceiptPrinterPaperWidth(receiptPrinterPaperWidth)
    setReceiptPrinterName(normalizedPrinterName)
    setReceiptPrinterNameState(normalizedPrinterName)
    setReceiptPrinterError('')
    setReceiptPrinterNotice(
      receiptPrinterProfile === 'thermal-58mm-escpos'
        ? 'Saved receipt printer settings. 58mm receipts will print through the ESC/POS thermal path first and fall back to the browser print dialog if needed.'
        : 'Saved receipt printer settings. Receipt printing will keep using the browser print dialog.',
    )
    void refreshReceiptPrinterStatus(normalizedPrinterName)
  }

  const resetReceiptPrinterSettings = () => {
    clearReceiptPrinterSettings()
    setReceiptPrinterProfileState('browser')
    setReceiptPrinterPaperWidthState('58mm')
    setReceiptPrinterNameState('')
    setReceiptPrinterError('')
    setReceiptPrinterNotice('Cleared saved receipt printer settings.')
    setAvailablePrinters([])
  }

  const loadInstalledPrinters = async () => {
    setPrintersLoading(true)
    setReceiptPrinterError('')
    try {
      await refreshQzSigningState()
      const printers = await listAvailableReceiptPrinters()
      setAvailablePrinters(printers)
      setReceiptPrinterNotice(
        printers.length > 0
          ? 'Loaded printers from this computer. Choose the receipt printer name exactly as installed in Windows.'
          : 'QZ Tray connected, but no printers were returned from this computer.',
      )
    } catch (err: unknown) {
      setAvailablePrinters([])
      setReceiptPrinterError(
        extractErrorMessage(err) ||
          'Unable to reach QZ Tray on this computer. Install and open QZ Tray first, then try loading printers again.',
      )
    } finally {
      setPrintersLoading(false)
    }
  }

  async function refreshReceiptPrinterStatus(printerName = receiptPrinterName) {
    setPrinterStatusLoading(true)
    try {
      await refreshQzSigningState()
      setPrinterDiagnostics(await getReceiptPrinterDiagnostics(printerName))
    } finally {
      setPrinterStatusLoading(false)
    }
  }

  const runTestReceiptPrint = async () => {
    setTestPrintLoading(true)
    setReceiptPrinterError('')
    try {
      await refreshQzSigningState()
      await printTestReceiptDirect()
      setReceiptPrinterNotice(
        'A sample receipt print was sent to the saved POS printer. This does not create an invoice, receipt record, or payment entry.',
      )
      await refreshReceiptPrinterStatus()
    } catch (err: unknown) {
      setReceiptPrinterError(
        extractErrorMessage(err) || 'Unable to send the sample receipt to the saved printer right now.',
      )
    } finally {
      setTestPrintLoading(false)
    }
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

      <Card className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Receipt Printer Settings</h2>
          <p className="mt-2 text-sm text-slate-500">
            Keep browser receipt printing by default, or enable the dedicated 58mm ESC/POS thermal path through QZ Tray on this computer.
          </p>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Receipt printer profile</span>
          <Select
            value={receiptPrinterProfile}
            onChange={(e) => {
              setReceiptPrinterProfileState(e.target.value === 'thermal-58mm-escpos' ? 'thermal-58mm-escpos' : 'browser')
              setReceiptPrinterError('')
            }}
          >
            <option value="browser">Browser print dialog</option>
            <option value="thermal-58mm-escpos">58mm ESC/POS thermal via QZ Tray</option>
          </Select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Receipt paper width</span>
          <Select
            value={receiptPrinterPaperWidth}
            onChange={(e) => {
              setReceiptPrinterPaperWidthState(e.target.value === '58mm' ? '58mm' : '58mm')
              setReceiptPrinterError('')
            }}
          >
            <option value="58mm">58mm thermal roll</option>
          </Select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Receipt printer name</span>
          <Input
            value={receiptPrinterName}
            onChange={(e) => {
              setReceiptPrinterNameState(e.target.value)
              setReceiptPrinterError('')
            }}
            placeholder="Example: EPSON TM-T20III Receipt"
          />
        </label>

        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          QZ Tray signing status: <span className="font-medium text-slate-900">{qzSigningEnabled ? 'Trusted silent mode ready' : 'Fallback mode only'}</span>
          <p className="mt-2 text-slate-500">
            Thermal direct printing still works without signing, but QZ Tray may show approval warnings until the backend is configured with a certificate and private key.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Live printer status</p>
              <p className="text-sm text-slate-500">
                Check whether QZ Tray is reachable on this computer and whether the saved 58mm thermal printer can be found.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => void refreshReceiptPrinterStatus()} disabled={printerStatusLoading}>
              {printerStatusLoading ? 'Checking...' : 'Check Status'}
            </Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <StatusTile
              label="QZ Tray"
              value={printerDiagnostics?.qzConnected ? 'Connected' : 'Not connected'}
              tone={printerDiagnostics?.qzConnected ? 'green' : 'amber'}
            />
            <StatusTile
              label="Profile"
              value={formatReceiptPrinterProfile(printerDiagnostics?.configuredPrinterProfile || receiptPrinterProfile)}
              tone={(printerDiagnostics?.configuredPrinterProfile || receiptPrinterProfile) === 'browser' ? 'slate' : 'green'}
            />
            <StatusTile
              label="Saved Printer"
              value={
                printerDiagnostics?.configuredPrinterName
                  ? printerDiagnostics.printerFound
                    ? printerDiagnostics.resolvedPrinterName || printerDiagnostics.configuredPrinterName
                    : 'Not found on this PC'
                  : 'Not saved yet'
              }
              tone={
                !printerDiagnostics?.configuredPrinterName
                  ? 'slate'
                  : printerDiagnostics.printerFound
                    ? 'green'
                    : 'amber'
              }
            />
            <StatusTile
              label="Trusted Mode"
              value={printerDiagnostics?.signingEnabled ? 'Enabled' : 'Warnings possible'}
              tone={printerDiagnostics?.signingEnabled ? 'green' : 'slate'}
            />
          </div>

          {printerDiagnostics ? (
            <p className="mt-3 text-sm text-slate-500">
              Installed printers detected from QZ Tray: {printerDiagnostics.availablePrinterCount}. Paper width profile: {printerDiagnostics.paperWidth}.
            </p>
          ) : null}
        </div>

        {availablePrinters.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-medium text-slate-700">Detected printers on this computer</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {availablePrinters.map((printer) => (
                <button
                  key={printer}
                  type="button"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                  onClick={() => setReceiptPrinterNameState(printer)}
                >
                  {printer}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {receiptPrinterError ? <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{receiptPrinterError}</div> : null}
        {receiptPrinterNotice ? <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{receiptPrinterNotice}</div> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={saveReceiptPrinterSettings}>
            Save Receipt Printer Settings
          </Button>
          <Button type="button" variant="secondary" onClick={loadInstalledPrinters} disabled={printersLoading}>
            {printersLoading ? 'Loading Printers...' : 'Load Installed Printers'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void runTestReceiptPrint()}
            disabled={testPrintLoading || receiptPrinterProfile === 'browser'}
          >
            {testPrintLoading ? 'Printing Test Receipt...' : 'Print 58mm Test Receipt'}
          </Button>
          <Button type="button" variant="ghost" onClick={resetReceiptPrinterSettings}>
            Clear Receipt Printer Settings
          </Button>
        </div>
      </Card>
    </div>
  )
}

function formatReceiptPrinterProfile(profile: ReceiptPrinterProfile) {
  return profile === 'thermal-58mm-escpos' ? '58mm ESC/POS thermal' : 'Browser preview only'
}

function extractErrorMessage(error: unknown) {
  if (typeof error !== 'object' || error == null || !('message' in error)) return ''
  return typeof error.message === 'string' ? error.message : ''
}

function StatusTile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'green' | 'amber' | 'slate'
}) {
  const toneClass =
    tone === 'green'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-slate-50 text-slate-700 border-slate-200'

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-xs font-medium uppercase tracking-[0.14em]">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  )
}
