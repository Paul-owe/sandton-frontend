import { useEffect, useMemo, useState, type FormEvent, type TextareaHTMLAttributes } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Download, Eye, FileText, Printer, Search } from 'lucide-react'
import { createDoctorNoteWithDocument, getPatientDoctorNotes } from '../api/doctorNoteApi'
import { searchPriceListItems } from '../api/priceListApi'
import {
  downloadPatientDocument,
  getPatientDocumentBlob,
  getPatientDocuments,
  uploadPatientDocument,
} from '../api/documentApi'
import {
  frontDeskEditPatientOnce,
  getPatientAuditTrail,
  getPatientById,
  grantPatientDetailsEditOnce,
  updatePatient,
} from '../api/patientApi'
import type { PatientAuditTrailEntry } from '../types/audit'
import type { DoctorNote, DoctorNoteChargeLine } from '../types/doctorNote'
import type { DocumentType, PatientDocument } from '../types/document'
import type { CreatePatientPayload, Patient } from '../types/patient'
import type { PriceListItem, PriceListItemVariant } from '../types/priceList'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { DocumentFilePicker } from '../components/ui/DocumentFilePicker'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, toDate, toDateTime } from '../utils/format'
import { clearDraft, loadDraft, saveDraft } from '../utils/localDrafts'

type Tab = 'details' | 'documents' | 'notes'
type UploadContext = 'details' | 'documents' | 'notes'

const documentTypes: DocumentType[] = [
  'PATIENT_DETAILS',
  'DOCTORS_NOTES',
  'LAB_RESULT',
  'REFERRAL',
  'MEDICAL_AID',
  'OTHER',
]

const genderOptions = [
  { value: '', label: 'Gender' },
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'UNKNOWN', label: 'Unknown' },
] as const

type UploadChargeLine = DoctorNoteChargeLine & {
  priceListItemId: string | number
  itemName: string
  unitPrice: number
  lineTotal: number
  currency: string
  quantity: number
}

type UploadState = {
  documentType: DocumentType
  notes: string
  file: File | null
  visitDate: string
  attendingDoctorName: string
  presentingComplaintSummary: string
  diagnosisSummary: string
  treatmentSummary: string
  reviewNotes: string
  accountsReferenceNumber: string
  chargeLines: UploadChargeLine[]
}

type UploadDraft = {
  context: UploadContext
  payload: Omit<UploadState, 'file'>
}

function getTodayDateInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function createInitialUploadState(documentType: DocumentType = 'PATIENT_DETAILS'): UploadState {
  return {
    documentType,
    notes: '',
    file: null as File | null,
    visitDate: documentType === 'DOCTORS_NOTES' ? getTodayDateInputValue() : '',
    attendingDoctorName: '',
    presentingComplaintSummary: '',
    diagnosisSummary: '',
    treatmentSummary: '',
    reviewNotes: '',
    accountsReferenceNumber: '',
    chargeLines: [],
  }
}

function createUploadStateFromDraft(
  payload?: Partial<Omit<UploadState, 'file'>>,
  documentType: DocumentType = 'PATIENT_DETAILS',
): UploadState {
  return {
    ...createInitialUploadState(documentType),
    ...payload,
    visitDate: payload?.visitDate || createInitialUploadState(documentType).visitDate,
    file: null,
    chargeLines: Array.isArray(payload?.chargeLines) ? payload.chargeLines : [],
  }
}

function hasMeaningfulUploadDraft(payload: UploadState) {
  return Boolean(
    payload.file ||
      payload.notes.trim() ||
      payload.visitDate.trim() ||
      payload.attendingDoctorName.trim() ||
      payload.presentingComplaintSummary.trim() ||
      payload.diagnosisSummary.trim() ||
      payload.treatmentSummary.trim() ||
      payload.reviewNotes.trim() ||
      payload.accountsReferenceNumber.trim() ||
      payload.chargeLines.length > 0,
  )
}

function createPatientEditForm(patient?: Patient | null): CreatePatientPayload {
  return {
    active: patient?.active ?? true,
    branchId: patient?.branchId || '',
    fileNumber: patient?.fileNumber || '',
    name: patient?.name || '',
    surname: patient?.surname || '',
    gender: patient?.gender || '',
    dateOfBirth: patient?.dateOfBirth || '',
    idNumber: patient?.idNumber || '',
    address: patient?.address || '',
    contact: patient?.contact || '',
    emailAddress: patient?.emailAddress || '',
    profession: patient?.profession || '',
    religionChurch: patient?.religionChurch || '',
    nextOfKinName: patient?.nextOfKinName || '',
    nextOfKinRelationship: patient?.nextOfKinRelationship || '',
    nextOfKinContact: patient?.nextOfKinContact || '',
    dateOfAdmission: patient?.dateOfAdmission || '',
  }
}

export function PatientProfilePage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [documents, setDocuments] = useState<PatientDocument[]>([])
  const [notes, setNotes] = useState<DoctorNote[]>([])
  const [auditTrail, setAuditTrail] = useState<PatientAuditTrailEntry[]>([])
  const [tab, setTab] = useState<Tab>('details')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadContext, setUploadContext] = useState<UploadContext>('documents')
  const [pageError, setPageError] = useState('')
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [payload, setPayload] = useState(createInitialUploadState())
  const [editOpen, setEditOpen] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editForm, setEditForm] = useState<CreatePatientPayload>(createPatientEditForm())
  const [editPatientDetailsFile, setEditPatientDetailsFile] = useState<File | null>(null)
  const [editPatientDetailsNotes, setEditPatientDetailsNotes] = useState('')
  const [previewDocument, setPreviewDocument] = useState<PatientDocument | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [previewDownloadBusy, setPreviewDownloadBusy] = useState(false)
  const [priceSearchQuery, setPriceSearchQuery] = useState('')
  const [priceSearchLoading, setPriceSearchLoading] = useState(false)
  const [priceSearchResults, setPriceSearchResults] = useState<PriceListItem[]>([])
  const [showPriceSuggestions, setShowPriceSuggestions] = useState(false)
  const [variantPickerItem, setVariantPickerItem] = useState<PriceListItem | null>(null)
  const [variantPickerSelection, setVariantPickerSelection] = useState('')
  const [savedUploadDraftContext, setSavedUploadDraftContext] = useState<UploadContext | null>(null)

  const uploadDraftKey = `sfms.patient.${id}.uploadDraft`

  const loadAll = async () => {
    const [loadedPatient, loadedDocuments, loadedNotes, loadedAuditTrail] = await Promise.all([
      getPatientById(id),
      getPatientDocuments(id),
      getPatientDoctorNotes(id),
      isAdmin ? getPatientAuditTrail(id) : Promise.resolve([]),
    ])
    setPatient(loadedPatient)
    setDocuments(loadedDocuments)
    setNotes(loadedNotes)
    setAuditTrail(loadedAuditTrail)
  }

  const refreshSavedUploadDraft = () => {
    const draft = loadDraft<UploadDraft>(uploadDraftKey)
    setSavedUploadDraftContext(draft?.context || null)
  }

  const reloadProfile = async () => {
    setPageLoading(true)
    try {
      await loadAll()
      setPageError('')
    } catch (err: any) {
      setPageError(
        err?.response?.data?.message ||
          'Unable to load the patient profile right now. Check the clinic network settings and try again.',
      )
    } finally {
      setPageLoading(false)
    }
  }

  useEffect(() => {
    reloadProfile()
  }, [id, isAdmin])

  useEffect(() => {
    if (!location.state || !(location.state as { openDoctorNotes?: boolean }).openDoctorNotes) {
      return
    }

    setTab('notes')
    openUploadModal('notes')
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    refreshSavedUploadDraft()
  }, [id])

  useEffect(() => {
    if (!previewDocument?.id) {
      setPreviewUrl(null)
      setPreviewLoading(false)
      setPreviewError('')
      return
    }

    let active = true
    let objectUrl: string | null = null

    setPreviewLoading(true)
    setPreviewError('')

    getPatientDocumentBlob(previewDocument.id, 'content')
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl(objectUrl)
      })
      .catch(() => {
        if (active) {
          setPreviewUrl(null)
          setPreviewError('Unable to preview this document right now.')
        }
      })
      .finally(() => {
        if (active) setPreviewLoading(false)
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [previewDocument?.id])

  useEffect(() => {
    if (!uploadOpen || payload.documentType !== 'DOCTORS_NOTES') {
      setPriceSearchResults([])
      setPriceSearchLoading(false)
      setShowPriceSuggestions(false)
      return
    }

    const trimmedQuery = priceSearchQuery.trim()
    if (trimmedQuery.length < 2) {
      setPriceSearchResults([])
      setPriceSearchLoading(false)
      return
    }

    let active = true
    setPriceSearchLoading(true)
    const timeoutId = window.setTimeout(async () => {
      try {
        const branchId = patient?.branchId ? String(patient.branchId) : undefined
        const matches = await searchPriceListItems(trimmedQuery, branchId)
        if (!active) return
        setPriceSearchResults(matches)
      } catch {
        if (active) setPriceSearchResults([])
      } finally {
        if (active) setPriceSearchLoading(false)
      }
    }, 220)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [patient?.branchId, payload.documentType, priceSearchQuery, uploadOpen])

  useEffect(() => {
    if (!uploadOpen || uploadContext !== 'notes' || payload.documentType === 'DOCTORS_NOTES') return

    setPayload((current) => ({
      ...current,
      documentType: 'DOCTORS_NOTES',
      visitDate: current.visitDate || getTodayDateInputValue(),
    }))
  }, [payload.documentType, uploadContext, uploadOpen])

  const patientDetailDocuments = useMemo(
    () => documents.filter((document) => document.documentType === 'PATIENT_DETAILS'),
    [documents],
  )

  const documentsById = useMemo(() => {
    return new Map(documents.filter((document) => document.id != null).map((document) => [String(document.id), document]))
  }, [documents])

  const patientDetailsLockedForFrontDesk = patientDetailDocuments.length > 0 && !patient?.allowFrontDeskDetailsEditOnce
  const canManagePatientDetails = isAdmin || !patientDetailsLockedForFrontDesk
  const availableDocumentTypes = useMemo(() => {
    const hidePatientDetails = !isAdmin && patientDetailsLockedForFrontDesk
    return documentTypes.filter((documentType) => !(hidePatientDetails && documentType === 'PATIENT_DETAILS'))
  }, [isAdmin, patientDetailsLockedForFrontDesk])
  const canEditPatientRecord = isAdmin || Boolean(patient?.allowFrontDeskDetailsEditOnce)

  useEffect(() => {
    if (!uploadOpen) return

    if (hasMeaningfulUploadDraft(payload)) {
      const { file: _file, ...persistedPayload } = payload
      saveDraft(uploadDraftKey, {
        context: uploadContext,
        payload: persistedPayload,
      } satisfies UploadDraft)
      setSavedUploadDraftContext(uploadContext)
      return
    }

    clearDraft(uploadDraftKey)
    setSavedUploadDraftContext(null)
  }, [payload, uploadContext, uploadOpen, uploadDraftKey])

  const discardUploadDraft = () => {
    clearDraft(uploadDraftKey)
    setSavedUploadDraftContext(null)
    setPayload(createInitialUploadState(uploadContext === 'notes' ? 'DOCTORS_NOTES' : payload.documentType))
    setError('')
  }

  const openUploadModal = (context: UploadContext) => {
    setError('')
    setUploadContext(context)
    const initialDocumentType =
      context === 'notes'
        ? 'DOCTORS_NOTES'
        : context === 'documents'
          ? availableDocumentTypes[0] || 'OTHER'
          : 'PATIENT_DETAILS'

    const draft = loadDraft<UploadDraft>(uploadDraftKey)
    if (draft?.context === context) {
      setPayload(createUploadStateFromDraft(draft.payload, initialDocumentType))
    } else {
      setPayload(createInitialUploadState(initialDocumentType))
    }
    setUploadOpen(true)
  }

  const openEditModal = () => {
    setEditError('')
    setEditSaving(false)
    setEditForm(createPatientEditForm(patient))
    setEditPatientDetailsFile(null)
    setEditPatientDetailsNotes(patientDetailDocuments[0]?.notes || '')
    setEditOpen(true)
  }

  const closeUploadModal = () => {
    setUploadOpen(false)
    setUploadContext('documents')
    setPayload(createInitialUploadState())
    setError('')
    setSaving(false)
    setPriceSearchQuery('')
    setPriceSearchResults([])
    setPriceSearchLoading(false)
    setShowPriceSuggestions(false)
    setVariantPickerItem(null)
    setVariantPickerSelection('')
  }

  const closeEditModal = () => {
    setEditOpen(false)
    setEditError('')
    setEditSaving(false)
    setEditPatientDetailsFile(null)
  }

  const closePreviewModal = () => {
    setPreviewDocument(null)
    setPreviewUrl(null)
    setPreviewError('')
    setPreviewLoading(false)
    setPreviewDownloadBusy(false)
  }

  const grantOneTimeEdit = async () => {
    if (!patient?.id) return
    setPageError('')
    try {
      const updated = await grantPatientDetailsEditOnce(patient.id)
      setPatient(updated)
    } catch (err: any) {
      setPageError(err?.response?.data?.message || 'Unable to open patient details for editing right now.')
    }
  }

  const submitUpload = async (e: FormEvent) => {
    e.preventDefault()
    if (!payload.file) {
      setError('Please choose a photo or document to upload.')
      return
    }

    setError('')
    setSaving(true)

    try {
      if (payload.documentType === 'DOCTORS_NOTES') {
        await createDoctorNoteWithDocument(id, {
          documentNotes: payload.notes,
          file: payload.file,
          note: {
            visitDate: payload.visitDate,
            attendingDoctorName: payload.attendingDoctorName,
            presentingComplaintSummary: payload.presentingComplaintSummary,
            diagnosisSummary: payload.diagnosisSummary,
            treatmentSummary: payload.treatmentSummary,
            reviewNotes: payload.reviewNotes,
            accountsReferenceNumber: payload.accountsReferenceNumber,
            chargeLines: payload.chargeLines.map((line) => ({
              priceListItemId: line.priceListItemId,
              priceListItemVariantId: line.priceListItemVariantId,
              quantity: line.quantity || 1,
              notes: line.notes || '',
            })),
          },
        })
      } else {
        await uploadPatientDocument(id, {
          documentType: payload.documentType,
          notes: payload.notes,
          file: payload.file,
        })
      }

      clearDraft(uploadDraftKey)
      setSavedUploadDraftContext(null)
      await reloadProfile()
      closeUploadModal()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Upload failed.')
      setSaving(false)
    }
  }

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!patient?.id) return

    const normalizedForm = createPatientEditForm(editForm)
    const currentForm = createPatientEditForm(patient)
    const hasFieldChanges = JSON.stringify(normalizedForm) !== JSON.stringify(currentForm)
    const hasFileChange = Boolean(editPatientDetailsFile)
    const hasNotesChange = (editPatientDetailsNotes || '').trim() !== ((patientDetailDocuments[0]?.notes || '').trim())

    if (!hasFieldChanges && !hasFileChange && !hasNotesChange) {
      setEditError('No changes detected.')
      return
    }

    setEditError('')
    setEditSaving(true)

    try {
      let updatedPatient: Patient
      if (isAdmin) {
        updatedPatient = await updatePatient(String(patient.id), normalizedForm)
        if (editPatientDetailsFile) {
          await uploadPatientDocument(String(patient.id), {
            documentType: 'PATIENT_DETAILS',
            notes: editPatientDetailsNotes,
            file: editPatientDetailsFile,
          })
        }
      } else {
        updatedPatient = await frontDeskEditPatientOnce(
          patient.id,
          normalizedForm,
          editPatientDetailsFile,
          editPatientDetailsNotes,
        )
      }

      await reloadProfile()
      setPatient(updatedPatient)
      closeEditModal()
    } catch (err: any) {
      setEditError(err?.response?.data?.message || 'Unable to save patient changes right now.')
      setEditSaving(false)
    }
  }

  const handlePreviewDownload = async () => {
    if (!previewDocument?.id) return
    setPreviewDownloadBusy(true)
    try {
      await downloadPatientDocument(previewDocument.id, previewDocument.originalFileName || 'document')
    } finally {
      setPreviewDownloadBusy(false)
    }
  }

  const handlePreviewPrint = () => {
    if (!previewDocument || !previewUrl) return

    const printWindow = window.open('', '_blank', 'noopener,noreferrer')
    if (!printWindow) return

    const title = previewDocument.originalFileName || 'Document Preview'
    const markup = isPdfDocument(previewDocument)
      ? `
        <iframe
          src="${previewUrl}"
          style="width:100%;height:100vh;border:0;"
          onload="setTimeout(function(){ window.focus(); window.print(); }, 300)"
        ></iframe>
      `
      : `
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;margin:0;">
          <img
            src="${previewUrl}"
            alt="${title}"
            style="max-width:100%;max-height:100vh;object-fit:contain;"
            onload="setTimeout(function(){ window.focus(); window.print(); }, 300)"
          />
        </div>
      `

    printWindow.document.open()
    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            html, body { margin: 0; padding: 0; background: #ffffff; }
            @page { margin: 12mm; }
          </style>
        </head>
        <body>${markup}</body>
      </html>
    `)
    printWindow.document.close()
  }

  const uploadTitle =
    uploadContext === 'notes'
      ? "Add Doctor's Note"
      : uploadContext === 'details'
      ? 'Upload Patient Details Photo'
      : 'Upload Patient Document'
  const patientDisplayName = [patient?.name, patient?.surname].filter(Boolean).join(' ').trim()
  const previewFrameUrl =
    previewUrl && previewDocument && isPdfDocument(previewDocument)
      ? `${previewUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`
      : previewUrl
  const isDoctorNotesUpload = uploadContext === 'notes' || payload.documentType === 'DOCTORS_NOTES'

  const addChargeLine = (item: PriceListItem, variant?: PriceListItemVariant) => {
    const unitPrice = variant ? Number(variant.price) : Number(item.basePrice || 0)
    const currency = variant?.currency || item.currency || 'USD'
    const nextLine: UploadChargeLine = {
      priceListItemId: item.id,
      priceListItemVariantId: variant?.id,
      itemName: item.name,
      variantName: variant?.name,
      itemCode: item.code || undefined,
      specimenType: item.specimenType || undefined,
      category: item.category,
      unitPrice,
      lineTotal: unitPrice,
      currency,
      quantity: 1,
      notes: '',
    }
    setPayload((current) => ({ ...current, chargeLines: [...current.chargeLines, nextLine] }))
    setPriceSearchQuery('')
    setPriceSearchResults([])
    setShowPriceSuggestions(false)
    setVariantPickerItem(null)
    setVariantPickerSelection('')
  }

  const noteChargeTotal = useMemo(
    () => payload.chargeLines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0),
    [payload.chargeLines],
  )
  const showPriceSuggestionPanel =
    showPriceSuggestions &&
    payload.documentType === 'DOCTORS_NOTES' &&
    priceSearchQuery.trim().length >= 2 &&
    (priceSearchLoading || priceSearchResults.length > 0)

  const choosePriceSearchResult = (item: PriceListItem) => {
    setError('')
    if (item.requiresVariant) {
      setVariantPickerItem(item)
      setVariantPickerSelection('')
      setShowPriceSuggestions(false)
      return
    }
    addChargeLine(item)
  }

  return (
    <div className="space-y-5">
      <Card className="bg-gradient-to-r from-brand-800 to-brand-600 text-white">
        <p className="text-xs tracking-[0.2em] text-brand-100">FILE NUMBER</p>
        <p className="text-3xl font-bold">{patient?.fileNumber || '--'}</p>
        <p className="mt-1 text-lg font-medium">
          {patient?.fullName || [patient?.name, patient?.surname].filter(Boolean).join(' ') || 'Patient profile'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-brand-50">
          <StatusPill label={`Branch: ${patient?.branchName || '--'}`} />
          <StatusPill label={`Contact: ${patient?.contact || '--'}`} />
          <StatusPill label={`ID: ${patient?.idNumber || '--'}`} />
          <StatusPill label={`DOB: ${toDate(patient?.dateOfBirth)}`} />
          <StatusPill label={`Admission: ${toDate(patient?.dateOfAdmission)}`} />
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant={tab === 'details' ? 'primary' : 'secondary'} onClick={() => setTab('details')}>
          Patient details
        </Button>
        <Button variant={tab === 'documents' ? 'primary' : 'secondary'} onClick={() => setTab('documents')}>
          Documents
        </Button>
        <Button variant={tab === 'notes' ? 'primary' : 'secondary'} onClick={() => setTab('notes')}>
          Doctor&apos;s Notes
        </Button>
      </div>

      {pageError ? (
        <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p>{pageError}</p>
            <Button variant="secondary" onClick={reloadProfile}>
              Retry Loading
            </Button>
          </div>
        </div>
      ) : null}

      {savedUploadDraftContext ? (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p>
              An unfinished {savedUploadDraftContext === 'notes' ? "doctor's note" : savedUploadDraftContext === 'details' ? 'patient details upload' : 'document upload'} draft was recovered for this patient. Reopen that flow to continue, then reattach the file if needed.
            </p>
            <Button variant="ghost" onClick={discardUploadDraft}>
              Discard Draft
            </Button>
          </div>
        </div>
      ) : null}

      {pageLoading && !patient ? <p className="text-sm text-slate-500">Loading patient profile...</p> : null}

      {tab === 'details' ? (
        <>
          <Card>
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Patient information</h2>
                <p className="text-sm text-slate-500">Front desk can confirm the record before filing scans or photos.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEditPatientRecord ? (
                  <Button variant="secondary" onClick={openEditModal}>
                    {isAdmin ? 'Edit patient record' : 'Use one-time edit'}
                  </Button>
                ) : null}
                {canManagePatientDetails ? (
                  <Button onClick={() => openUploadModal('details')}>Upload patient details photo</Button>
                ) : null}
              </div>
            </div>
            {!isAdmin && patient?.allowFrontDeskDetailsEditOnce ? (
              <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                Patient details can be updated right now.
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ProfileField label="Name" value={patient?.name} />
              <ProfileField label="Surname" value={patient?.surname} />
              <ProfileField label="Gender" value={patient?.gender} />
              <ProfileField label="Date of Birth" value={toDate(patient?.dateOfBirth)} />
              <ProfileField label="File Number" value={patient?.fileNumber} />
              <ProfileField label="ID Number" value={patient?.idNumber} />
              <ProfileField label="Contact" value={patient?.contact} />
              <ProfileField label="Email Address" value={patient?.emailAddress} />
              <ProfileField label="Address" value={patient?.address} />
              <ProfileField label="Profession" value={patient?.profession} />
              <ProfileField label="Religion/Church" value={patient?.religionChurch} />
              <ProfileField label="Admission Date" value={toDate(patient?.dateOfAdmission)} />
              <ProfileField label="Next of Kin" value={patient?.nextOfKinName} />
              <ProfileField label="Relationship" value={patient?.nextOfKinRelationship} />
              <ProfileField label="Next of Kin Contact" value={patient?.nextOfKinContact} />
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Patient details uploads</h2>
                <p className="text-sm text-slate-500">Upload photos or scanned patient-detail forms for the filing team.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isAdmin && patientDetailDocuments.length > 0 && !patient?.allowFrontDeskDetailsEditOnce ? (
                  <Button variant="secondary" onClick={grantOneTimeEdit}>
                    Allow patient details update
                  </Button>
                ) : null}
                {canManagePatientDetails ? (
                  <Button variant="secondary" onClick={() => openUploadModal('details')}>
                    {patientDetailDocuments.length > 0 ? 'Replace patient details file' : 'Add patient details file'}
                  </Button>
                ) : null}
              </div>
            </div>

            {!isAdmin && patientDetailsLockedForFrontDesk ? (
              <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                Patient details are already attached and cannot be changed from this screen right now.
              </div>
            ) : null}

            {isAdmin && patient?.allowFrontDeskDetailsEditOnce ? (
              <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                Patient details can be updated right now.
              </div>
            ) : null}

            {patientDetailDocuments.length === 0 ? (
              <EmptyState
                title="No patient detail uploads yet"
                description="Upload a patient photo, scanned registration sheet, or any patient-details image here."
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {patientDetailDocuments.map((document) => (
                  <DocumentCard
                    key={String(document.id)}
                    document={document}
                    onReview={() => setPreviewDocument(document)}
                  />
                ))}
              </div>
            )}
          </Card>

          {isAdmin ? (
            <Card>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Audit trail</h2>
                <p className="text-sm text-slate-500">
                  Review who granted, used, or changed this patient record during the protected edit workflow.
                </p>
              </div>

              {auditTrail.length === 0 ? (
                <EmptyState
                  title="No audit entries yet"
                  description="Grant and usage history for one-time edits will appear here for admins."
                />
              ) : (
                <div className="space-y-3">
                  {auditTrail.map((entry) => (
                    <div
                      key={String(entry.id || `${entry.action}-${entry.timestamp}`)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <AuditActionBadge action={entry.action} />
                            <p className="text-sm font-semibold text-slate-900">{auditActionLabel(entry.action)}</p>
                          </div>
                          <p className="text-sm text-slate-600">
                            {entry.userFullName || 'Unknown user'}
                            {entry.userRole ? ` (${formatRole(entry.userRole)})` : ''}
                            {entry.branchName ? ` at ${entry.branchName}` : ''}
                          </p>
                          {entry.userEmail ? <p className="text-xs text-slate-500">{entry.userEmail}</p> : null}
                        </div>
                        <p className="text-sm text-slate-500">{toDateTime(entry.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === 'documents' ? (
        <Card>
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">All patient documents</h2>
              <p className="text-sm text-slate-500">Store patient details, doctor note scans, lab results, referrals, and other attachments.</p>
            </div>
            <Button onClick={() => openUploadModal('documents')}>Upload document</Button>
          </div>

          {documents.length === 0 ? (
            <EmptyState
              title="No documents uploaded yet"
              description="Upload the first patient photo or clinic document from this profile."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {documents.map((document) => (
                <DocumentCard
                  key={String(document.id)}
                  document={document}
                  onReview={() => setPreviewDocument(document)}
                />
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'notes' ? (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Doctor&apos;s notes</h2>
                <p className="text-sm text-slate-500">Front desk can keep adding each visit as a separate note with its own photo or scan.</p>
              </div>
              <Button onClick={() => openUploadModal('notes')}>Add doctor&apos;s note</Button>
            </div>
          </Card>

          {notes.length === 0 ? (
            <EmptyState
              title="No doctor&apos;s notes yet"
              description="Every clinic visit can be recorded here with a new doctor-note image or document."
            />
          ) : (
            notes.map((note) => {
              const attachment = note.documentId ? documentsById.get(String(note.documentId)) : undefined

              return (
                <Card key={String(note.id)} className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs tracking-[0.2em] text-slate-500">VISIT</p>
                      <p className="mt-1 text-xl font-semibold text-slate-900">
                        {note.visitDate ? toDate(note.visitDate) : 'Visit date not captured'}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Doctor: {note.attendingDoctorName || '--'} | Added: {toDate(note.createdAt)}
                      </p>
                    </div>
                    {attachment ? (
                      <div className="md:w-80">
                        <DocumentCard document={attachment} compact onReview={() => setPreviewDocument(attachment)} />
                      </div>
                    ) : null}
                  </div>

                  {note.invoiceId ? (
                    <div className="flex justify-end">
                      <Button variant="secondary" onClick={() => navigate(`/invoices/${note.invoiceId}`)}>
                        Open Invoice
                      </Button>
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <ProfileField label="Presenting Complaint" value={note.presentingComplaintSummary} />
                    <ProfileField label="Diagnosis" value={note.diagnosisSummary} />
                    <ProfileField label="Treatment" value={note.treatmentSummary} />
                    <ProfileField label="Review Notes" value={note.reviewNotes} />
                    <ProfileField label="Accounts Reference" value={note.accountsReferenceNumber} />
                  </div>

                  {note.chargeLines && note.chargeLines.length > 0 ? (
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">Tests / Procedures Done</p>
                        <p className="text-sm font-semibold text-brand-800">
                          Total: {formatCurrency(note.totalAmount, note.currency || 'USD')}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {note.chargeLines.map((line, index) => (
                          <div
                            key={String(line.id || `${line.priceListItemId}-${line.priceListItemVariantId || index}`)}
                            className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 md:flex-row md:items-center md:justify-between"
                          >
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {line.itemName}
                                {line.variantName ? ` - ${line.variantName}` : ''}
                              </p>
                              <p className="text-xs text-slate-500">
                                {line.category || '--'}
                                {line.itemCode ? ` | Code: ${line.itemCode}` : ''}
                                {line.specimenType ? ` | Specimen: ${line.specimenType}` : ''}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-slate-900">
                              {formatCurrency(line.lineTotal, line.currency || note.currency || 'USD')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Card>
              )
            })
          )}
        </div>
      ) : null}

      <Modal title={uploadTitle} open={uploadOpen} onClose={closeUploadModal}>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={submitUpload}>
          {savedUploadDraftContext === uploadContext ? (
            <div className="md:col-span-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              This draft was restored on this device. Review the details below, then reattach the file if it is no longer selected.
            </div>
          ) : null}
          {uploadContext === 'documents' ? (
            <Select
              value={payload.documentType}
              onChange={(e) => {
                const nextDocumentType = e.target.value as DocumentType
                setPayload({ ...payload, documentType: nextDocumentType })
              }}
            >
              {availableDocumentTypes.map((documentType) => (
                <option key={documentType} value={documentType}>
                  {labelForDocumentType(documentType)}
                </option>
              ))}
            </Select>
          ) : (
            <div className="md:col-span-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-800">
              {uploadContext === 'details'
                ? 'This upload will be stored under Patient Details for front desk filing.'
                : `This upload will be stored as a Doctor's Note inside the patient's profile and named with ${patientDisplayName || 'the patient'} clearly attached.`}
            </div>
          )}

          <DocumentFilePicker
            className="md:col-span-2"
            file={payload.file}
            onFileChange={(file) => setPayload({ ...payload, file })}
          />
          {!isDoctorNotesUpload ? (
            <Input
              placeholder="Short note about this upload"
              value={payload.notes}
              onChange={(e) => setPayload({ ...payload, notes: e.target.value })}
            />
          ) : null}

          {isDoctorNotesUpload ? (
            <>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Visit Date</span>
                <Input
                  type="date"
                  value={payload.visitDate}
                  onChange={(e) => setPayload({ ...payload, visitDate: e.target.value })}
                />
              </label>
              <div className="hidden">
                <Input
                  value={payload.attendingDoctorName}
                  onChange={(e) => setPayload({ ...payload, attendingDoctorName: e.target.value })}
                />
                <TextAreaField
                  value={payload.presentingComplaintSummary}
                  onChange={(e) => setPayload({ ...payload, presentingComplaintSummary: e.target.value })}
                />
                <TextAreaField
                  value={payload.diagnosisSummary}
                  onChange={(e) => setPayload({ ...payload, diagnosisSummary: e.target.value })}
                />
                <TextAreaField
                  value={payload.treatmentSummary}
                  onChange={(e) => setPayload({ ...payload, treatmentSummary: e.target.value })}
                />
                <TextAreaField
                  value={payload.reviewNotes}
                  onChange={(e) => setPayload({ ...payload, reviewNotes: e.target.value })}
                />
                <Input
                  value={payload.accountsReferenceNumber}
                  onChange={(e) => setPayload({ ...payload, accountsReferenceNumber: e.target.value })}
                />
              </div>

              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Procedures / Tests Done</p>
                    <p className="text-xs text-slate-500">
                      Search the shared price list and add each completed test, profile, or procedure to this note.
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-brand-800">
                    Total: {formatCurrency(noteChargeTotal, payload.chargeLines[0]?.currency || 'USD')}
                  </p>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
                    <Input
                      className="pl-9 pr-3"
                      placeholder="Search price list by name, code, section, or specimen"
                      value={priceSearchQuery}
                      onFocus={() => setShowPriceSuggestions(true)}
                      onBlur={() => window.setTimeout(() => setShowPriceSuggestions(false), 120)}
                      onChange={(e) => {
                        setPriceSearchQuery(e.target.value)
                        setShowPriceSuggestions(true)
                      }}
                    />

                    {showPriceSuggestionPanel ? (
                      <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
                        {priceSearchLoading ? (
                          <div className="px-4 py-3 text-sm text-slate-500">Searching price list...</div>
                        ) : (
                          priceSearchResults.map((item) => (
                            <button
                              key={String(item.id)}
                              type="button"
                              className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                choosePriceSearchResult(item)
                              }}
                            >
                              <div>
                                <p className="text-sm font-medium text-slate-900">{item.name}</p>
                                <p className="text-xs text-slate-500">
                                  {item.category.replaceAll('_', ' ')}
                                  {item.code ? ` | Code: ${item.code}` : ''}
                                  {item.specimenType ? ` | Specimen: ${item.specimenType}` : ''}
                                  {item.section ? ` | Section: ${item.section}` : ''}
                                </p>
                              </div>
                              <p className="text-xs text-slate-400">
                                {item.requiresVariant
                                  ? `Choose option${item.variants?.length ? ` (${item.variants.length})` : ''}`
                                  : formatCurrency(item.basePrice, item.currency)}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                    {priceSearchLoading
                      ? 'Searching price list...'
                      : priceSearchQuery.trim().length < 2
                        ? 'Type at least 2 characters'
                        : `${priceSearchResults.length} result${priceSearchResults.length === 1 ? '' : 's'}`}
                  </div>
                </div>

                {variantPickerItem ? (
                  <div className="mt-3 rounded-2xl border border-brand-200 bg-brand-50 p-3">
                    <p className="text-sm font-semibold text-brand-900">Choose a variant for {variantPickerItem.name}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                      <Select value={variantPickerSelection} onChange={(e) => setVariantPickerSelection(e.target.value)}>
                        <option value="">Select exact option</option>
                        {(variantPickerItem.variants || [])
                          .filter((variant) => variant.active)
                          .map((variant) => (
                            <option key={String(variant.id)} value={String(variant.id)}>
                              {variant.name} - {formatCurrency(variant.price, variant.currency)}
                            </option>
                          ))}
                      </Select>
                      <Button
                        type="button"
                        onClick={() => {
                          const chosenVariant = (variantPickerItem.variants || []).find(
                            (variant) => String(variant.id) === variantPickerSelection,
                          )
                          if (!chosenVariant) {
                            setError('Choose the exact variant before adding this item.')
                            return
                          }
                          setError('')
                          addChargeLine(variantPickerItem, chosenVariant)
                        }}
                      >
                        Add variant
                      </Button>
                    </div>
                  </div>
                ) : null}

                {payload.chargeLines.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {payload.chargeLines.map((line, index) => (
                      <div
                        key={`${String(line.priceListItemId)}-${String(line.priceListItemVariantId || index)}`}
                        className="rounded-2xl border border-slate-200 bg-white p-3"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {line.itemName}
                              {line.variantName ? ` - ${line.variantName}` : ''}
                            </p>
                            <p className="text-xs text-slate-500">
                              {line.category || '--'}
                              {line.itemCode ? ` | Code: ${line.itemCode}` : ''}
                              {line.specimenType ? ` | Specimen: ${line.specimenType}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-sm font-semibold text-slate-900">
                              {formatCurrency(line.lineTotal, line.currency)}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() =>
                                setPayload((current) => ({
                                  ...current,
                                  chargeLines: current.chargeLines.filter((_, lineIndex) => lineIndex !== index),
                                }))
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    No structured priced items added yet. You can still save the note now and update pricing later if needed.
                  </p>
                )}
              </div>
            </>
          ) : null}

          {error ? <p className="md:col-span-2 rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeUploadModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : isDoctorNotesUpload ? "Save Doctor's Note" : 'Upload'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal title={isAdmin ? 'Edit Patient Record' : 'One-Time Patient Edit'} open={editOpen} onClose={closeEditModal}>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={submitEdit}>
          <Input
            placeholder="File Number"
            value={String(editForm.fileNumber || '')}
            onChange={(e) => setEditForm({ ...editForm, fileNumber: e.target.value })}
          />
          <Input
            placeholder="Name"
            value={String(editForm.name || '')}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <Input
            placeholder="Surname"
            value={String(editForm.surname || '')}
            onChange={(e) => setEditForm({ ...editForm, surname: e.target.value })}
          />
          <Select
            value={String(editForm.gender || '')}
            onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as CreatePatientPayload['gender'] })}
          >
            {genderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Date of Birth</span>
            <Input
              type="date"
              value={String(editForm.dateOfBirth || '')}
              onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
            />
          </label>
          <Input
            placeholder="ID Number"
            value={String(editForm.idNumber || '')}
            onChange={(e) => setEditForm({ ...editForm, idNumber: e.target.value })}
          />
          <Input
            placeholder="Contact"
            value={String(editForm.contact || '')}
            onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })}
          />
          <Input
            placeholder="Email Address"
            value={String(editForm.emailAddress || '')}
            onChange={(e) => setEditForm({ ...editForm, emailAddress: e.target.value })}
          />
          <Input
            placeholder="Address"
            value={String(editForm.address || '')}
            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
          />
          <Input
            placeholder="Profession"
            value={String(editForm.profession || '')}
            onChange={(e) => setEditForm({ ...editForm, profession: e.target.value })}
          />
          <Input
            placeholder="Religion/Church"
            value={String(editForm.religionChurch || '')}
            onChange={(e) => setEditForm({ ...editForm, religionChurch: e.target.value })}
          />
          <Input
            placeholder="Next of Kin Name"
            value={String(editForm.nextOfKinName || '')}
            onChange={(e) => setEditForm({ ...editForm, nextOfKinName: e.target.value })}
          />
          <Input
            placeholder="Next of Kin Relationship"
            value={String(editForm.nextOfKinRelationship || '')}
            onChange={(e) => setEditForm({ ...editForm, nextOfKinRelationship: e.target.value })}
          />
          <Input
            placeholder="Next of Kin Contact"
            value={String(editForm.nextOfKinContact || '')}
            onChange={(e) => setEditForm({ ...editForm, nextOfKinContact: e.target.value })}
          />
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Date of Admission</span>
            <Input
              type="date"
              value={String(editForm.dateOfAdmission || '')}
              onChange={(e) => setEditForm({ ...editForm, dateOfAdmission: e.target.value })}
            />
          </label>
          <DocumentFilePicker
            className="md:col-span-2"
            file={editPatientDetailsFile}
            onFileChange={setEditPatientDetailsFile}
          />
          <Input
            className="md:col-span-2"
            placeholder="Patient details file note (optional)"
            value={editPatientDetailsNotes}
            onChange={(e) => setEditPatientDetailsNotes(e.target.value)}
          />
          <div className="md:col-span-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-800">
            {isAdmin
              ? 'You can update the patient record and optionally replace the attached patient details file.'
              : 'You can update the patient record from this screen and optionally replace the attached patient details file.'}
          </div>
          {editError ? <p className="md:col-span-2 rounded-xl bg-rose-50 p-2 text-sm text-rose-700">{editError}</p> : null}
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeEditModal} disabled={editSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={editSaving}>
              {editSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        title={previewDocument?.originalFileName || 'Document Preview'}
        open={Boolean(previewDocument)}
        onClose={closePreviewModal}
        fullScreen
        className="flex h-full min-h-0 flex-col bg-slate-100"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-3 md:gap-4">
          <div className="grid min-h-0 flex-1 gap-2 sm:gap-3 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-4">
            <aside className="flex flex-col gap-2 rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm sm:gap-3 sm:p-4 md:p-5 lg:min-h-0 lg:overflow-y-auto">
              <div className="flex items-start gap-3">
                <div className="inline-flex shrink-0 rounded-2xl bg-brand-50 p-3 text-brand-700">
                  <FileText size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    {labelForDocumentType(previewDocument?.documentType)}
                  </p>
                  <p className="mt-1 text-base font-semibold leading-tight text-slate-900 sm:mt-2 sm:text-lg">
                    {previewDocument?.originalFileName || 'Document Preview'}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-1">
                <PreviewMetaCard label="Uploaded" value={toDate(previewDocument?.uploadedAt)} />
                <PreviewMetaCard
                  label="File Size"
                  value={previewDocument?.fileSize ? formatBytes(previewDocument.fileSize) : '--'}
                />
                <PreviewMetaCard
                  label="Preview Type"
                  value={previewDocument && isPdfDocument(previewDocument) ? 'Embedded PDF' : 'Image preview'}
                />
              </div>

              {previewDocument?.notes ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Notes</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{previewDocument.notes}</p>
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2 lg:mt-auto lg:grid-cols-1">
                <Button
                  type="button"
                  variant="secondary"
                  className="justify-start gap-2 rounded-2xl px-4 py-3"
                  onClick={handlePreviewPrint}
                  disabled={!previewUrl || previewLoading}
                >
                  <Printer size={16} />
                  Print document
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="justify-start gap-2 rounded-2xl px-4 py-3"
                  onClick={handlePreviewDownload}
                  disabled={!previewDocument?.id || previewDownloadBusy}
                >
                  <Download size={16} />
                  {previewDownloadBusy ? 'Preparing download...' : 'Download file'}
                </Button>
              </div>
            </aside>

            <div className="min-h-[60dvh] overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 shadow-soft sm:min-h-[62dvh] lg:min-h-0">
              <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/95 px-3 py-2.5 text-slate-200 sm:px-4 sm:py-3">
                <Eye size={16} />
                <p className="text-xs font-medium uppercase tracking-[0.16em] sm:text-sm sm:normal-case sm:tracking-normal">
                  Document preview
                </p>
              </div>
              <div className="h-[calc(100%-3.25rem)] min-h-0">
                {previewLoading ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-300">Loading preview...</div>
                ) : previewError ? (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-rose-300">{previewError}</div>
                ) : previewUrl && previewDocument ? (
                  isPdfDocument(previewDocument) ? (
                    <iframe
                      title={previewDocument.originalFileName || 'PDF preview'}
                      src={previewFrameUrl || undefined}
                      className="h-full min-h-0 w-full bg-white"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-slate-950 p-6">
                      <img
                        src={previewUrl}
                        alt={previewDocument.originalFileName || 'Document preview'}
                        className="max-h-full max-w-full rounded-2xl object-contain shadow-[0_18px_48px_rgba(15,23,42,0.38)]"
                      />
                    </div>
                  )
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-300">
                    Preview unavailable for this document.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function PreviewMetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}

function DocumentCard({
  document,
  onReview,
  compact = false,
}: {
  document: PatientDocument
  onReview: () => void
  compact?: boolean
}) {
  const imageDocument = isImageDocument(document)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [thumbnailLoading, setThumbnailLoading] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState(false)

  useEffect(() => {
    if (!imageDocument || document.id == null) {
      setThumbnailUrl(null)
      setThumbnailLoading(false)
      return
    }

    let active = true
    let objectUrl: string | null = null
    setThumbnailLoading(true)

    getPatientDocumentBlob(document.id, 'content')
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setThumbnailUrl(objectUrl)
      })
      .catch(() => {
        if (active) setThumbnailUrl(null)
      })
      .finally(() => {
        if (active) setThumbnailLoading(false)
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [document.id, imageDocument])

  const handleDownload = async () => {
    if (document.id == null) return
    setDownloadBusy(true)
    try {
      await downloadPatientDocument(document.id, document.originalFileName || 'document')
    } finally {
      setDownloadBusy(false)
    }
  }

  return (
    <div className={`space-y-3 rounded-2xl border border-slate-200 bg-white p-4 ${compact ? 'text-sm' : ''}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.2em] text-slate-500">{labelForDocumentType(document.documentType)}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {document.originalFileName || document.storedFileName || 'Attachment'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Uploaded {toDate(document.uploadedAt)} {document.fileSize ? `| ${formatBytes(document.fileSize)}` : ''}
          </p>
        </div>
      </div>

      {document.notes ? (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{document.notes}</p>
      ) : null}

      {imageDocument ? (
        thumbnailUrl ? (
          <button
            type="button"
            className="block w-full overflow-hidden rounded-2xl border border-slate-200"
            onClick={onReview}
          >
            <img
              src={thumbnailUrl}
              alt={document.originalFileName || 'Uploaded patient document'}
              className="h-56 w-full object-cover"
            />
          </button>
        ) : thumbnailLoading ? (
          <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
            Loading preview...
          </div>
        ) : (
          <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
            Preview unavailable
          </div>
        )
      ) : (
        <button
          type="button"
          className="flex h-28 w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500 hover:bg-slate-100"
          onClick={onReview}
        >
          PDF document ready to preview
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={onReview}>
          Review
        </Button>
        <Button type="button" variant="secondary" onClick={handleDownload} disabled={downloadBusy}>
          {downloadBusy ? 'Preparing...' : 'Download'}
        </Button>
      </div>
    </div>
  )
}

function AuditActionBadge({ action }: { action?: string }) {
  const classes =
    action === 'PATIENT_FRONTDESK_EDIT_GRANTED'
      ? 'bg-emerald-100 text-emerald-800'
      : action === 'PATIENT_FRONTDESK_EDIT_USED'
        ? 'bg-amber-100 text-amber-800'
        : action === 'PATIENT_FRONTDESK_EDIT_SAVED'
          ? 'bg-brand-100 text-brand-800'
          : 'bg-slate-200 text-slate-700'

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classes}`}>{auditActionShortLabel(action)}</span>
}

function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-slate-900">{value || '--'}</p>
    </div>
  )
}

function StatusPill({ label }: { label: string }) {
  return <span className="rounded-full bg-white/10 px-3 py-1">{label}</span>
}

function TextAreaField({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) {
  return (
    <textarea
      className={`min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-200 transition focus:ring ${className}`.trim()}
      {...props}
    />
  )
}

function isImageDocument(document?: PatientDocument | null) {
  return Boolean(document?.mimeType && document.mimeType.startsWith('image/'))
}

function isPdfDocument(document?: PatientDocument | null) {
  return document?.mimeType === 'application/pdf'
}

function auditActionShortLabel(action?: string) {
  switch (action) {
    case 'PATIENT_FRONTDESK_EDIT_GRANTED':
      return 'Edit opened'
    case 'PATIENT_FRONTDESK_EDIT_SAVED':
      return 'Saved'
    case 'PATIENT_FRONTDESK_EDIT_USED':
      return 'Edit closed'
    case 'PATIENT_UPDATED':
      return 'Updated'
    default:
      return 'Audit'
  }
}

function auditActionLabel(action?: string) {
  switch (action) {
    case 'PATIENT_FRONTDESK_EDIT_GRANTED':
      return 'Patient details were opened for editing'
    case 'PATIENT_FRONTDESK_EDIT_SAVED':
      return 'Patient record changes were saved'
    case 'PATIENT_FRONTDESK_EDIT_USED':
      return 'Patient details edit was completed'
    case 'PATIENT_UPDATED':
      return 'Patient record was updated'
    default:
      return action || 'Audit event'
  }
}

function formatRole(role?: string) {
  if (!role) return ''
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function labelForDocumentType(documentType?: string) {
  switch (documentType) {
    case 'PATIENT_DETAILS':
      return 'Patient Details'
    case 'DOCTORS_NOTES':
      return "Doctor's Notes"
    case 'LAB_RESULT':
      return 'Lab Result'
    case 'REFERRAL':
      return 'Referral'
    case 'MEDICAL_AID':
      return 'Medical Aid'
    case 'OTHER':
      return 'Other'
    default:
      return documentType || 'Document'
  }
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
