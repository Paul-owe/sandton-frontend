import { Camera, LoaderCircle, QrCode } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  consumeMobileCaptureSession,
  createMobileCaptureSession,
  downloadMobileCaptureSessionFile,
  getMobileCaptureSession,
} from '../../api/mobileCaptureApi'
import type { MobileCaptureSession } from '../../types/mobileCapture'
import { buildScannedPdfFile, defaultScanCrop, type ScanCrop, type ScanPageDraft } from '../../utils/uploadProcessing'
import {
  buildMobileCaptureUrl,
  clearPublicAppUrlOverride,
  getPublicAppBaseUrl,
  getStoredPublicAppUrlOverride,
  isLikelyLocalOnlyUrl,
  normalizePublicAppUrl,
  setPublicAppUrlOverride,
} from '../../utils/runtimeConfig'
import { Button } from './Button'
import { Input } from './Input'
import { Modal } from './Modal'

type DocumentFilePickerProps = {
  file: File | null
  onFileChange: (file: File | null) => void
  className?: string
}

type PickerMode = 'single' | 'scan'
type DragCorner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left'

const MAX_CROP_PERCENT = 35

export function DocumentFilePicker({ file, onFileChange, className = '' }: DocumentFilePickerProps) {
  const [mode, setMode] = useState<PickerMode>('single')
  const [scanPages, setScanPages] = useState<ScanPageDraft[]>([])
  const [selectedPageId, setSelectedPageId] = useState<string>('')
  const [scanBusy, setScanBusy] = useState(false)
  const [scanReady, setScanReady] = useState(false)
  const [scanError, setScanError] = useState('')
  const [captureModalOpen, setCaptureModalOpen] = useState(false)
  const [captureLoading, setCaptureLoading] = useState(false)
  const [captureResolving, setCaptureResolving] = useState(false)
  const [captureError, setCaptureError] = useState('')
  const [captureNotice, setCaptureNotice] = useState('')
  const [captureSession, setCaptureSession] = useState<MobileCaptureSession | null>(null)
  const [captureQrUrl, setCaptureQrUrl] = useState('')
  const [captureLink, setCaptureLink] = useState('')
  const [publicAppUrlDraft, setPublicAppUrlDraft] = useState(() => getPublicAppBaseUrl())
  const [captureAddressError, setCaptureAddressError] = useState('')
  const [captureLinkBusy, setCaptureLinkBusy] = useState(false)
  const [draggingCorner, setDraggingCorner] = useState<DragCorner | null>(null)
  const pagesRef = useRef<ScanPageDraft[]>([])
  const cropEditorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    pagesRef.current = scanPages
  }, [scanPages])

  useEffect(() => {
    return () => {
      pagesRef.current.forEach((page) => URL.revokeObjectURL(page.previewUrl))
    }
  }, [])

  const selectedPageIndex = useMemo(
    () => scanPages.findIndex((page) => page.id === selectedPageId),
    [scanPages, selectedPageId],
  )

  const selectedPage = useMemo(
    () => scanPages.find((page) => page.id === selectedPageId) || scanPages[0] || null,
    [scanPages, selectedPageId],
  )

  const setScanPagesWithCleanup = (nextPages: ScanPageDraft[]) => {
    const removedPages = pagesRef.current.filter((existing) => !nextPages.some((page) => page.id === existing.id))
    removedPages.forEach((page) => URL.revokeObjectURL(page.previewUrl))
    setScanPages(nextPages)
  }

  const markScannerDirty = () => {
    setScanReady(false)
    setScanError('')
    onFileChange(null)
  }

  const chooseSingleFile = (nextFile: File | null) => {
    setMode('single')
    setScanError('')
    setCaptureNotice('')
    onFileChange(nextFile)
  }

  const addScanFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return

    const imageFiles = Array.from(fileList).filter((nextFile) => nextFile.type.startsWith('image/'))
    if (imageFiles.length === 0) {
      setScanError('Only image files can be added to the multi-page scanner.')
      return
    }

    const newPages = imageFiles.map((nextFile, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      file: nextFile,
      previewUrl: URL.createObjectURL(nextFile),
      rotation: 0 as const,
      crop: defaultScanCrop(),
    }))

    const nextPages = [...pagesRef.current, ...newPages]
    setMode('scan')
    setScanPagesWithCleanup(nextPages)
    setSelectedPageId(selectedPageId || newPages[0].id)
    markScannerDirty()
  }

  const updateSelectedPage = (updater: (page: ScanPageDraft) => ScanPageDraft) => {
    if (!selectedPage) return
    const nextPages = pagesRef.current.map((page) => (page.id === selectedPage.id ? updater(page) : page))
    setScanPagesWithCleanup(nextPages)
    markScannerDirty()
  }

  const moveSelectedPage = (offset: -1 | 1) => {
    if (!selectedPage || selectedPageIndex < 0) return
    const targetIndex = selectedPageIndex + offset
    if (targetIndex < 0 || targetIndex >= scanPages.length) return
    const nextPages = moveItem(scanPages, selectedPageIndex, targetIndex)
    setScanPagesWithCleanup(nextPages)
    setSelectedPageId(selectedPage.id)
    markScannerDirty()
  }

  const removeSelectedPage = () => {
    if (!selectedPage) return
    const nextPages = pagesRef.current.filter((page) => page.id !== selectedPage.id)
    setScanPagesWithCleanup(nextPages)
    setSelectedPageId(nextPages[0]?.id || '')
    markScannerDirty()
  }

  const clearScanner = () => {
    setScanPagesWithCleanup([])
    setSelectedPageId('')
    setScanReady(false)
    setScanError('')
    setDraggingCorner(null)
    if (mode === 'scan') {
      onFileChange(null)
    }
  }

  const openDesktopToPhoneCamera = async () => {
    setCaptureModalOpen(true)
    setCaptureLoading(true)
    setCaptureError('')
    setCaptureAddressError('')
    setCaptureNotice('')
    setCaptureSession(null)
    setCaptureQrUrl('')
    setCaptureLink('')
    setPublicAppUrlDraft(getPublicAppBaseUrl())

    try {
      const session = await createMobileCaptureSession()
      setCaptureSession(session)
    } catch (error: any) {
      setCaptureError(error?.response?.data?.message || 'Unable to generate the camera QR code right now.')
    } finally {
      setCaptureLoading(false)
    }
  }

  const closeCaptureModal = () => {
    setCaptureModalOpen(false)
    setCaptureLoading(false)
    setCaptureResolving(false)
    setCaptureError('')
    setCaptureAddressError('')
    setCaptureLinkBusy(false)
  }

  const restoreCurrentScreenAddress = () => {
    setPublicAppUrlDraft(window.location.origin)
    setCaptureAddressError('')
    setCaptureNotice('Using the current browser address for this QR code.')
  }

  const savePhoneAddress = () => {
    const normalized = normalizePublicAppUrl(publicAppUrlDraft)
    if (!normalized) {
      setCaptureAddressError('Enter a valid phone-reachable frontend address, for example 192.168.1.20:5173.')
      return
    }
    setPublicAppUrlDraft(normalized)
    setCaptureAddressError('')
    setPublicAppUrlOverride(normalized)
    setCaptureNotice('Saved this phone address for future captures on this desktop.')
  }

  const clearSavedPhoneAddress = () => {
    clearPublicAppUrlOverride()
    setPublicAppUrlDraft(window.location.origin)
    setCaptureAddressError('')
    setCaptureNotice('Cleared the saved phone address. The app will use the current browser address again.')
  }

  const copyCaptureLink = async () => {
    if (!captureLink) return
    try {
      await navigator.clipboard.writeText(captureLink)
      setCaptureNotice('Phone link copied. You can paste it into WhatsApp or the phone browser.')
    } catch {
      setCaptureError('Unable to copy the phone link automatically. You can still type the address shown below.')
    }
  }

  const regenerateCaptureSession = async () => {
    setCaptureLoading(true)
    setCaptureResolving(false)
    setCaptureError('')
    setCaptureNotice('')
    setCaptureSession(null)
    setCaptureQrUrl('')
    setCaptureLink('')

    try {
      const session = await createMobileCaptureSession()
      setCaptureSession(session)
    } catch (error: any) {
      setCaptureError(error?.response?.data?.message || 'Unable to generate a new phone capture session right now.')
    } finally {
      setCaptureLoading(false)
    }
  }

  const buildScanPdf = async () => {
    if (scanPages.length === 0) {
      setScanError('Add at least one page before building the scanned PDF.')
      return
    }

    setScanBusy(true)
    setScanError('')
    try {
      const pdfFile = await buildScannedPdfFile(scanPages)
      onFileChange(pdfFile)
      setScanReady(true)
    } catch (error: any) {
      setScanReady(false)
      onFileChange(null)
      setScanError(error?.message || 'Unable to build the scanned PDF right now.')
    } finally {
      setScanBusy(false)
    }
  }

  useEffect(() => {
    if (!captureModalOpen || !captureSession?.id || captureResolving) {
      return
    }

    const poll = window.setInterval(async () => {
      try {
        const latestSession = await getMobileCaptureSession(captureSession.id!)
        setCaptureSession(latestSession)

        if (latestSession.status === 'UPLOADED') {
          setCaptureResolving(true)
          const file = await downloadMobileCaptureSessionFile(latestSession.id!)
          onFileChange(file)
          setCaptureNotice(`Photo received from phone: ${file.name}`)
          await consumeMobileCaptureSession(latestSession.id!)
          setCaptureModalOpen(false)
          setCaptureResolving(false)
          return
        }

        if (latestSession.status === 'EXPIRED') {
          setCaptureResolving(false)
          setCaptureError('This phone capture session expired. Generate a new link and scan it again.')
        }
      } catch (error: any) {
        setCaptureError(error?.response?.data?.message || 'Unable to read the mobile capture session.')
      }
    }, 1800)

    return () => window.clearInterval(poll)
  }, [captureModalOpen, captureResolving, captureSession?.id, onFileChange])

  useEffect(() => {
    if (!captureModalOpen || !captureSession?.token) {
      setCaptureLink('')
      setCaptureQrUrl('')
      setCaptureLinkBusy(false)
      return
    }

    const normalizedBaseUrl = normalizePublicAppUrl(publicAppUrlDraft)
    if (!normalizedBaseUrl) {
      setCaptureLink('')
      setCaptureQrUrl('')
      setCaptureLinkBusy(false)
      if (publicAppUrlDraft.trim()) {
        setCaptureAddressError('Enter a full frontend address the phone can open, such as 192.168.1.20:5173.')
      }
      return
    }

    let active = true
    const nextCaptureLink = buildMobileCaptureUrl(captureSession.token, normalizedBaseUrl)
    setCaptureLinkBusy(true)
    setCaptureLink(nextCaptureLink)
    setCaptureAddressError('')

    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(nextCaptureLink, {
          margin: 1,
          width: 280,
        }),
      )
      .then((qrUrl) => {
        if (!active) return
        setCaptureQrUrl(qrUrl)
      })
      .catch(() => {
        if (!active) return
        setCaptureError('Unable to generate the QR code for this phone address.')
      })
      .finally(() => {
        if (active) setCaptureLinkBusy(false)
      })

    return () => {
      active = false
    }
  }, [captureModalOpen, captureSession?.token, publicAppUrlDraft])

  const startCropDrag = (corner: DragCorner, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setDraggingCorner(corner)
    cropEditorRef.current?.setPointerCapture(event.pointerId)
  }

  const handleCropPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingCorner || !selectedPage) return

    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    const normalizedDisplayPoint = {
      x: clampUnit((event.clientX - rect.left) / rect.width),
      y: clampUnit((event.clientY - rect.top) / rect.height),
    }

    const normalizedSourcePoint = toUnrotatedPoint(normalizedDisplayPoint, selectedPage.rotation)
    updateSelectedPage((page) => ({
      ...page,
      crop: applyCropFromHandle(page.crop, draggingCorner, normalizedSourcePoint.x, normalizedSourcePoint.y),
    }))
  }

  const stopCropDrag = (event?: ReactPointerEvent<HTMLDivElement>) => {
    if (event && cropEditorRef.current?.hasPointerCapture(event.pointerId)) {
      cropEditorRef.current.releasePointerCapture(event.pointerId)
    }
    setDraggingCorner(null)
  }

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={mode === 'single' ? 'primary' : 'secondary'} onClick={() => setMode('single')}>
          Single file
        </Button>
        <Button type="button" variant={mode === 'scan' ? 'primary' : 'secondary'} onClick={() => setMode('scan')}>
          Scan multiple pages
        </Button>
      </div>

      {mode === 'single' ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Choose PDF or image</span>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => chooseSingleFile(e.target.files?.[0] || null)}
              />
            </label>
            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Open camera from phone</span>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-brand-300 hover:bg-brand-50"
                onClick={openDesktopToPhoneCamera}
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-2xl bg-brand-50 p-3 text-brand-700">
                    <Camera size={20} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Open phone camera with QR code</p>
                    <p className="text-xs text-slate-500">Scan on the phone, capture the image, and send it back here.</p>
                  </div>
                </div>
                <QrCode size={20} className="text-slate-400" />
              </button>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            Camera or gallery images are optimized first, then attached in a clinic-ready format for easier review and printing.
          </div>
          {isLikelyLocalOnlyUrl(getPublicAppBaseUrl()) ? (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Phone capture is currently pointing to a local-only frontend address. Open the phone camera option below and save the clinic&apos;s current LAN address before staff scan the QR code.
            </div>
          ) : null}
        </>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Add page from gallery</span>
              <Input type="file" accept="image/*" multiple onChange={(e) => addScanFiles(e.target.files)} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Add page from camera</span>
              <Input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={(e) => addScanFiles(e.target.files)}
              />
            </label>
          </div>

          <div className="rounded-xl bg-white p-3 text-sm text-slate-600">
            Add each page, choose a thumbnail, drag the crop corners on the preview, rotate when needed, fix the page order, then build one PDF from all pages.
          </div>

          {scanPages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No scan pages added yet.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {scanPages.map((page, index) => (
                  <button
                    key={page.id}
                    type="button"
                    className={`overflow-hidden rounded-2xl border text-left transition ${
                      selectedPage?.id === page.id
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                    onClick={() => setSelectedPageId(page.id)}
                  >
                    <img src={page.previewUrl} alt={`Scan page ${index + 1}`} className="h-24 w-20 object-cover" />
                    <div className="px-2 py-1 text-xs text-slate-600">Page {index + 1}</div>
                  </button>
                ))}
              </div>

              {selectedPage ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.9fr)]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div
                      ref={cropEditorRef}
                      className="relative h-[22rem] overflow-hidden rounded-2xl bg-slate-100 touch-none"
                      onPointerMove={handleCropPointerMove}
                      onPointerUp={stopCropDrag}
                      onPointerCancel={stopCropDrag}
                    >
                      <img
                        src={selectedPage.previewUrl}
                        alt="Selected scan page"
                        className="absolute inset-0 h-full w-full object-contain pointer-events-none"
                        style={{
                          clipPath: `inset(${selectedPage.crop.top * 100}% ${selectedPage.crop.right * 100}% ${selectedPage.crop.bottom * 100}% ${selectedPage.crop.left * 100}%)`,
                          transform: `rotate(${selectedPage.rotation}deg) scale(0.92)`,
                        }}
                      />
                      <div className="absolute inset-0 bg-slate-900/20" />
                      <div
                        className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.22)]"
                        style={{
                          top: `${selectedPage.crop.top * 100}%`,
                          right: `${selectedPage.crop.right * 100}%`,
                          bottom: `${selectedPage.crop.bottom * 100}%`,
                          left: `${selectedPage.crop.left * 100}%`,
                          transform: `rotate(${selectedPage.rotation}deg) scale(0.92)`,
                        }}
                      >
                        <CropHandle corner="top-left" onPointerDown={startCropDrag} />
                        <CropHandle corner="top-right" onPointerDown={startCropDrag} />
                        <CropHandle corner="bottom-right" onPointerDown={startCropDrag} />
                        <CropHandle corner="bottom-left" onPointerDown={startCropDrag} />
                      </div>
                      <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700">
                        Drag the white corner dots to trim this page
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          updateSelectedPage((page) => ({
                            ...page,
                            rotation: (((page.rotation + 270) % 360) as 0 | 90 | 180 | 270),
                          }))
                        }
                      >
                        Rotate left
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          updateSelectedPage((page) => ({
                            ...page,
                            rotation: (((page.rotation + 90) % 360) as 0 | 90 | 180 | 270),
                          }))
                        }
                      >
                        Rotate right
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => updateSelectedPage((page) => ({ ...page, crop: defaultScanCrop() }))}
                      >
                        Reset crop
                      </Button>
                      <Button type="button" variant="danger" onClick={removeSelectedPage}>
                        Remove page
                      </Button>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                      Page {selectedPageIndex + 1} of {scanPages.length}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => moveSelectedPage(-1)}
                        disabled={selectedPageIndex <= 0}
                      >
                        Move earlier
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => moveSelectedPage(1)}
                        disabled={selectedPageIndex < 0 || selectedPageIndex >= scanPages.length - 1}
                      >
                        Move later
                      </Button>
                    </div>

                    <ScanCropSlider
                      label="Top crop"
                      value={Math.round(selectedPage.crop.top * 100)}
                      onChange={(value) =>
                        updateSelectedPage((page) => ({ ...page, crop: { ...page.crop, top: value / 100 } }))
                      }
                    />
                    <ScanCropSlider
                      label="Right crop"
                      value={Math.round(selectedPage.crop.right * 100)}
                      onChange={(value) =>
                        updateSelectedPage((page) => ({ ...page, crop: { ...page.crop, right: value / 100 } }))
                      }
                    />
                    <ScanCropSlider
                      label="Bottom crop"
                      value={Math.round(selectedPage.crop.bottom * 100)}
                      onChange={(value) =>
                        updateSelectedPage((page) => ({ ...page, crop: { ...page.crop, bottom: value / 100 } }))
                      }
                    />
                    <ScanCropSlider
                      label="Left crop"
                      value={Math.round(selectedPage.crop.left * 100)}
                      onChange={(value) =>
                        updateSelectedPage((page) => ({ ...page, crop: { ...page.crop, left: value / 100 } }))
                      }
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={buildScanPdf} disabled={scanBusy}>
                  {scanBusy ? 'Building PDF...' : 'Build scanned PDF'}
                </Button>
                <Button type="button" variant="ghost" onClick={clearScanner} disabled={scanBusy}>
                  Clear pages
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {scanError ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{scanError}</p> : null}
      {captureNotice ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{captureNotice}</p> : null}
      {file ? (
        <p className="text-sm text-slate-500">
          Selected file: <span className="font-medium text-slate-700">{file.name}</span>
          {mode === 'scan' && scanReady ? ' (built from scanned pages)' : ''}
        </p>
      ) : mode === 'scan' && scanPages.length > 0 ? (
        <p className="text-sm text-amber-700">Build the scanned PDF before saving this upload.</p>
      ) : null}

      <Modal title="Open Camera From Phone" open={captureModalOpen} onClose={closeCaptureModal}>
        <div className="space-y-4">
          {captureLoading ? (
            <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <LoaderCircle className="animate-spin" size={18} />
              Generating QR code...
            </div>
          ) : captureError ? (
            <div className="space-y-3 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
              <p>{captureError}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={regenerateCaptureSession}>
                  Generate new link
                </Button>
                <Button type="button" variant="ghost" onClick={() => setCaptureError('')}>
                  Keep current session open
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                Scan this QR code with the phone, open the capture page, take the photo, and it will come back into this upload form automatically.
              </div>
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Phone-reachable frontend address</p>
                    <p className="text-xs text-slate-500">
                      Update this when the clinic Wi-Fi or desktop LAN IP changes.
                    </p>
                  </div>
                  {getStoredPublicAppUrlOverride() ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Saved</span>
                  ) : null}
                </div>
                <Input
                  value={publicAppUrlDraft}
                  onChange={(e) => {
                    setPublicAppUrlDraft(e.target.value)
                    setCaptureAddressError('')
                  }}
                  placeholder="192.168.1.20:5173"
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={savePhoneAddress}>
                    Save phone address
                  </Button>
                  <Button type="button" variant="ghost" onClick={restoreCurrentScreenAddress}>
                    Use current screen address
                  </Button>
                  {getStoredPublicAppUrlOverride() ? (
                    <Button type="button" variant="ghost" onClick={clearSavedPhoneAddress}>
                      Clear saved address
                    </Button>
                  ) : null}
                </div>
                {captureAddressError ? (
                  <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{captureAddressError}</div>
                ) : null}
              </div>
              {captureQrUrl ? (
                <div className="flex justify-center rounded-3xl border border-slate-200 bg-white p-5">
                  <img src={captureQrUrl} alt="Mobile capture QR code" className="h-64 w-64" />
                </div>
              ) : captureLinkBusy ? (
                <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
                  <LoaderCircle className="mr-2 animate-spin" size={18} />
                  Preparing phone link...
                </div>
              ) : null}
              {captureLink ? (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-medium text-slate-900">Phone link</p>
                  <Input value={captureLink} readOnly />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={copyCaptureLink}>
                      Copy link
                    </Button>
                    <Button type="button" variant="ghost" onClick={regenerateCaptureSession}>
                      Generate fresh session
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-800">
                {captureResolving
                  ? 'Photo received. Finishing the handoff...'
                  : captureSession?.status === 'EXPIRED'
                    ? 'This link expired before the phone uploaded the photo. Generate a fresh session and rescan it.'
                  : captureSession?.status === 'UPLOADED'
                    ? 'Photo uploaded from the phone. Bringing it into this form now.'
                    : 'Waiting for the phone to capture and upload the image.'}
              </div>
              {captureSession?.expiresAt ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  This capture session expires at {new Date(captureSession.expiresAt).toLocaleString()}.
                </div>
              ) : null}
              {isLikelyLocalOnlyUrl(normalizePublicAppUrl(publicAppUrlDraft) || getPublicAppBaseUrl()) ? (
                <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
                  This QR code still uses a local-only address. Replace it with the clinic&apos;s current LAN address before staff scan it.
                </div>
              ) : null}
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}

function CropHandle({
  corner,
  onPointerDown,
}: {
  corner: DragCorner
  onPointerDown: (corner: DragCorner, event: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  const positionClass =
    corner === 'top-left'
      ? '-left-3 -top-3 cursor-nwse-resize'
      : corner === 'top-right'
        ? '-right-3 -top-3 cursor-nesw-resize'
        : corner === 'bottom-right'
          ? '-bottom-3 -right-3 cursor-nwse-resize'
          : '-bottom-3 -left-3 cursor-nesw-resize'

  return (
    <button
      type="button"
      className={`absolute h-6 w-6 rounded-full border-2 border-slate-900 bg-white shadow ${positionClass}`.trim()}
      onPointerDown={(event) => onPointerDown(corner, event)}
      aria-label={`Adjust ${corner.replace('-', ' ')} crop corner`}
    />
  )
}

function ScanCropSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="space-y-2">
      <div className="flex items-center justify-between text-sm text-slate-700">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <input
        type="range"
        min="0"
        max={String(MAX_CROP_PERCENT)}
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--brand-700,#1d4ed8)]"
      />
    </label>
  )
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items]
  const [movedItem] = nextItems.splice(fromIndex, 1)
  nextItems.splice(toIndex, 0, movedItem)
  return nextItems
}

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value))
}

function clampCropFraction(value: number) {
  return Math.min(MAX_CROP_PERCENT / 100, Math.max(0, value))
}

function normalizeCrop(crop: ScanCrop): ScanCrop {
  const nextCrop = {
    top: clampCropFraction(crop.top),
    right: clampCropFraction(crop.right),
    bottom: clampCropFraction(crop.bottom),
    left: clampCropFraction(crop.left),
  }

  const horizontalTotal = nextCrop.left + nextCrop.right
  if (horizontalTotal > 0.8) {
    const scale = 0.8 / horizontalTotal
    nextCrop.left *= scale
    nextCrop.right *= scale
  }

  const verticalTotal = nextCrop.top + nextCrop.bottom
  if (verticalTotal > 0.8) {
    const scale = 0.8 / verticalTotal
    nextCrop.top *= scale
    nextCrop.bottom *= scale
  }

  return nextCrop
}

function applyCropFromHandle(crop: ScanCrop, corner: DragCorner, x: number, y: number): ScanCrop {
  const nextCrop = { ...crop }

  switch (corner) {
    case 'top-left':
      nextCrop.left = x
      nextCrop.top = y
      break
    case 'top-right':
      nextCrop.right = 1 - x
      nextCrop.top = y
      break
    case 'bottom-right':
      nextCrop.right = 1 - x
      nextCrop.bottom = 1 - y
      break
    case 'bottom-left':
      nextCrop.left = x
      nextCrop.bottom = 1 - y
      break
  }

  return normalizeCrop(nextCrop)
}

function toUnrotatedPoint(point: { x: number; y: number }, rotation: 0 | 90 | 180 | 270) {
  switch (rotation) {
    case 90:
      return { x: point.y, y: 1 - point.x }
    case 180:
      return { x: 1 - point.x, y: 1 - point.y }
    case 270:
      return { x: 1 - point.y, y: point.x }
    default:
      return point
  }
}
