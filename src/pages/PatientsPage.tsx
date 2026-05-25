import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { getBranches } from '../api/branchApi'
import { listVisiblePatients, registerPatient, searchPatients, suggestPatients } from '../api/patientApi'
import type { Branch } from '../types/branch'
import type { CreatePatientPayload, Gender, Patient } from '../types/patient'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { DocumentFilePicker } from '../components/ui/DocumentFilePicker'
import { useAuth } from '../contexts/AuthContext'
import { EmptyState } from '../components/ui/EmptyState'
import { patientDisplayName, toDate } from '../utils/format'
import { clearDraft, loadDraft, saveDraft } from '../utils/localDrafts'

const initialForm: CreatePatientPayload = {
  active: true,
  branchId: '',
  fileNumber: '',
  name: '',
  surname: '',
  gender: '',
  dateOfBirth: '',
  idNumber: '',
  address: '',
  contact: '',
  emailAddress: '',
  profession: '',
  religionChurch: '',
  nextOfKinName: '',
  nextOfKinRelationship: '',
  nextOfKinContact: '',
  dateOfAdmission: '',
}

const genderOptions: Array<{ value: Gender; label: string }> = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'UNKNOWN', label: 'Unknown' },
]

const REGISTRATION_DRAFT_KEY = 'sfms.patients.registrationDraft'

type RegistrationDraft = {
  form: CreatePatientPayload
  patientDetailsNotes: string
}

function hasMeaningfulRegistrationDraft(form: CreatePatientPayload, patientDetailsNotes: string) {
  return (
    Object.entries(form).some(([key, value]) => key !== 'active' && String(value ?? '').trim() !== '') ||
    patientDetailsNotes.trim() !== ''
  )
}

export function PatientsPage() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const hasAppliedInitialSearch = useRef(false)
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [form, setForm] = useState<CreatePatientPayload>(initialForm)
  const [patientDetailsFile, setPatientDetailsFile] = useState<File | null>(null)
  const [patientDetailsNotes, setPatientDetailsNotes] = useState('')
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<Patient[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [registerSaving, setRegisterSaving] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [registrationDraftRecovered, setRegistrationDraftRecovered] = useState(false)
  const doctorNotesIntent = searchParams.get('intent') === 'doctor-notes'

  const resetRegistrationForm = () => {
    setRegisterOpen(false)
    setForm(initialForm)
    setPatientDetailsFile(null)
    setPatientDetailsNotes('')
    setError('')
    setRegistrationDraftRecovered(false)
    clearDraft(REGISTRATION_DRAFT_KEY)
  }

  const discardRegistrationDraft = () => {
    setForm(initialForm)
    setPatientDetailsFile(null)
    setPatientDetailsNotes('')
    setError('')
    setRegistrationDraftRecovered(false)
    clearDraft(REGISTRATION_DRAFT_KEY)
  }

  const runSearch = async (term = query) => {
    const trimmedTerm = term.trim()
    if (!trimmedTerm) {
      setLoading(true)
      setSearchError('')
      try {
        setPatients(await listVisiblePatients())
      } catch (err: any) {
        setSearchError(err?.response?.data?.message || 'Unable to load patients right now. Check the clinic network settings and try again.')
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)
    setSearchError('')
    try {
      setPatients(await searchPatients(trimmedTerm))
    } catch (err: any) {
      setSearchError(err?.response?.data?.message || 'Unable to search patients right now. Check the clinic network settings and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const draft = loadDraft<RegistrationDraft>(REGISTRATION_DRAFT_KEY)
    if (!draft) return
    setForm({ ...initialForm, ...draft.form })
    setPatientDetailsNotes(draft.patientDetailsNotes || '')
    setRegistrationDraftRecovered(true)
  }, [])

  useEffect(() => {
    runSearch('')
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    getBranches().then(setBranches).catch(() => setBranches([]))
  }, [isAdmin])

  useEffect(() => {
    if (!hasMeaningfulRegistrationDraft(form, patientDetailsNotes)) {
      clearDraft(REGISTRATION_DRAFT_KEY)
      return
    }

    saveDraft(REGISTRATION_DRAFT_KEY, {
      form,
      patientDetailsNotes,
    } satisfies RegistrationDraft)
  }, [form, patientDetailsNotes])

  useEffect(() => {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 2) {
      setSuggestions([])
      setSuggestionsLoading(false)
      return
    }

      let active = true
    setSuggestionsLoading(true)
    const timeoutId = window.setTimeout(async () => {
      try {
        const matches = await suggestPatients(trimmedQuery)
        if (!active) return
        setSuggestions(matches.slice(0, 6))
      } catch {
        if (active) setSuggestions([])
      } finally {
        if (active) setSuggestionsLoading(false)
      }
    }, 220)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [query])

  useEffect(() => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      setDebouncedQuery('')
      return
    }

    if (trimmedQuery.length < 2) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(trimmedQuery)
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [query])

  useEffect(() => {
    if (!hasAppliedInitialSearch.current) {
      hasAppliedInitialSearch.current = true
      return
    }
    runSearch(debouncedQuery)
  }, [debouncedQuery])

  const onCreatePatient = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const fileNumber = String(form.fileNumber || '').trim()
    if (!fileNumber) {
      setError('File number is required.')
      return
    }
    if (isAdmin && !form.branchId) {
      setError('Select a branch before saving the patient.')
      return
    }
    if (!isAdmin && !patientDetailsFile) {
      setError('Attach the patient details PDF or photo before saving.')
      return
    }
    setRegisterSaving(true)
    try {
      await registerPatient(
        {
          ...form,
          active: form.active ?? true,
          branchId: form.branchId ? Number(form.branchId) : undefined,
          fileNumber,
        },
        patientDetailsFile,
        patientDetailsNotes,
      )
      resetRegistrationForm()
      runSearch(query)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to register patient. Check required fields.')
    } finally {
      setRegisterSaving(false)
    }
  }

  const openPatient = (patient: Patient) => {
    if (!patient.id) return
    navigate(`/patients/${patient.id}`, {
      state: doctorNotesIntent ? { openDoctorNotes: true } : undefined,
    })
  }

  const chooseSuggestion = async (patient: Patient) => {
    if (doctorNotesIntent) {
      openPatient(patient)
      return
    }
    const nextQuery = patient.fileNumber || patientDisplayName(patient.name, patient.surname, patient.fullName)
    setQuery(String(nextQuery || ''))
    setShowSuggestions(false)
    await runSearch(String(nextQuery || ''))
  }

  const hasResults = useMemo(() => patients.length > 0, [patients])
  const showSuggestionPanel = showSuggestions && (suggestionsLoading || suggestions.length > 0)

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
            <Input
              className="pl-9 pr-3"
              placeholder="Search by file number, name, surname, ID number, or contact number"
              value={query}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
              onChange={(e) => {
                setQuery(e.target.value)
                setShowSuggestions(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  setShowSuggestions(false)
                  setDebouncedQuery(query.trim())
                  runSearch(query)
                }
              }}
            />

            {showSuggestionPanel ? (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
                {suggestionsLoading ? (
                  <div className="px-4 py-3 text-sm text-slate-500">Searching suggestions...</div>
                ) : (
                  suggestions.map((patient) => (
                    <button
                      key={String(patient.id || patient.fileNumber)}
                      type="button"
                      className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        chooseSuggestion(patient)
                      }}
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {patientDisplayName(patient.name, patient.surname, patient.fullName)}
                        </p>
                        <p className="text-xs text-slate-500">
                          File: {patient.fileNumber || '--'} | ID: {patient.idNumber || '--'}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400">{patient.contact || patient.branchName || ''}</p>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <Button onClick={() => {
            setShowSuggestions(false)
            setDebouncedQuery(query.trim())
            runSearch()
          }}>
            Search
          </Button>
          <Button variant="secondary" onClick={() => setRegisterOpen(true)}>
            Register Patient
          </Button>
        </div>
      </Card>

      {doctorNotesIntent ? (
        <Card className="border-brand-200 bg-brand-50">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-brand-900">Upload Doctor&apos;s Notes</p>
            <p className="text-sm text-brand-800">
              Enter the patient&apos;s name or file number. Matching patients will appear as you type. Select the correct patient to continue straight into the Doctor&apos;s Notes upload form.
            </p>
          </div>
        </Card>
      ) : null}

      {searchError ? (
        <Card className="border-rose-200 bg-rose-50">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-rose-700">{searchError}</p>
            <Button variant="secondary" onClick={() => runSearch()}>
              Retry Search
            </Button>
          </div>
        </Card>
      ) : null}

      {registrationDraftRecovered ? (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-amber-800">
              An unfinished patient registration draft was recovered on this device. Open registration to continue, then reattach the photo or PDF before saving.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setRegisterOpen(true)}>
                Continue Draft
              </Button>
              <Button variant="ghost" onClick={discardRegistrationDraft}>
                Discard Draft
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {loading ? <p className="text-sm text-slate-500">Searching patients...</p> : null}
      {!loading && !hasResults ? (
        <EmptyState
          title="No patients found"
          description="Try another search term or register a new patient to generate a file record."
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {patients.map((p) => (
          <Card key={String(p.id || p.fileNumber)}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-xs tracking-[0.2em] text-slate-500">FILE NUMBER</p>
                <p className="text-2xl font-bold text-brand-800">{p.fileNumber || 'Pending assignment'}</p>
                <p className="text-sm font-medium text-slate-900">
                  {patientDisplayName(p.name, p.surname, p.fullName)}
                </p>
                <p className="text-sm text-slate-500">ID: {p.idNumber || '--'} | Contact: {p.contact || '--'}</p>
                <p className="text-sm text-slate-500">
                  Branch: {p.branchName || '--'} | Admission: {toDate(p.dateOfAdmission)}
                </p>
              </div>
              <Link
                to={`/patients/${p.id}`}
                state={doctorNotesIntent ? { openDoctorNotes: true } : undefined}
              >
                <Button>{doctorNotesIntent ? "Open Doctor's Notes" : 'View profile'}</Button>
              </Link>
              {doctorNotesIntent ? (
                <Button type="button" variant="secondary" onClick={() => openPatient(p)}>
                  Select Patient
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <Modal title="Register Patient" open={registerOpen} onClose={resetRegistrationForm}>
        <form onSubmit={onCreatePatient} className="grid gap-3 md:grid-cols-2">
          {registrationDraftRecovered ? (
            <div className="md:col-span-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              This draft was restored after an unfinished registration. Check the fields, then reattach the patient details file before saving.
            </div>
          ) : null}
          {isAdmin ? (
            <Select value={String(form.branchId || '')} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select branch</option>
              {branches.map((branch) => (
                <option key={String(branch.id)} value={String(branch.id || '')}>
                  {branch.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Input
            placeholder="File Number"
            value={String(form.fileNumber || '')}
            onChange={(e) => setForm({ ...form, fileNumber: e.target.value })}
          />
          <Input placeholder="Name" value={String(form.name || '')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Surname" value={String(form.surname || '')} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
          <Select
            value={String(form.gender || '')}
            onChange={(e) => setForm({ ...form, gender: e.target.value as CreatePatientPayload['gender'] })}
          >
            <option value="">Gender</option>
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
              value={String(form.dateOfBirth || '')}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            />
          </label>
          <Input placeholder="ID Number" value={String(form.idNumber || '')} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
          <Input placeholder="Contact" value={String(form.contact || '')} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          <Input placeholder="Email Address" value={String(form.emailAddress || '')} onChange={(e) => setForm({ ...form, emailAddress: e.target.value })} />
          <Input placeholder="Address" value={String(form.address || '')} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input placeholder="Profession" value={String(form.profession || '')} onChange={(e) => setForm({ ...form, profession: e.target.value })} />
          <Input placeholder="Religion/Church" value={String(form.religionChurch || '')} onChange={(e) => setForm({ ...form, religionChurch: e.target.value })} />
          <Input placeholder="Next of Kin Name" value={String(form.nextOfKinName || '')} onChange={(e) => setForm({ ...form, nextOfKinName: e.target.value })} />
          <Input placeholder="Next of Kin Relationship" value={String(form.nextOfKinRelationship || '')} onChange={(e) => setForm({ ...form, nextOfKinRelationship: e.target.value })} />
          <Input placeholder="Next of Kin Contact" value={String(form.nextOfKinContact || '')} onChange={(e) => setForm({ ...form, nextOfKinContact: e.target.value })} />
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Date of Admission</span>
            <Input
              type="date"
              value={String(form.dateOfAdmission || '')}
              onChange={(e) => setForm({ ...form, dateOfAdmission: e.target.value })}
            />
          </label>
          <DocumentFilePicker
            className="md:col-span-2"
            file={patientDetailsFile}
            onFileChange={setPatientDetailsFile}
          />
          <Input
            className="md:col-span-2"
            placeholder="Patient details file note (optional)"
            value={patientDetailsNotes}
            onChange={(e) => setPatientDetailsNotes(e.target.value)}
          />
          <div className="md:col-span-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-800">
            Enter the branch and file number exactly as they should appear on the patient record. Front desk should attach the patient details file during registration because later changes are locked by default. Photos captured on a phone will be optimized first and then attached in a review-friendly format.
          </div>
          {error ? <p className="md:col-span-2 rounded-xl bg-rose-50 p-2 text-sm text-rose-700">{error}</p> : null}
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={resetRegistrationForm} disabled={registerSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={registerSaving}>
              {registerSaving ? 'Saving Patient...' : 'Save Patient'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
