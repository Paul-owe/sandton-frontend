import { ArrowLeft, Download, Eye, Printer } from 'lucide-react'
import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getInvoice, recordInvoicePayment, updateInvoice } from '../api/invoiceApi'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import type {
  Invoice,
  InvoiceLineUpdateRequest,
  Receipt,
} from '../types/invoice'
import { buildInvoiceDocumentHtml, buildReceiptDocumentHtml } from '../utils/invoicePrint'
import { formatCurrency, toDate, toDateTime } from '../utils/format'

type UpdateLineDraft = {
  invoiceLineId: string | number
  notes: string
  cancelled: boolean
}

type PreviewState =
  | { kind: 'invoice' }
  | { kind: 'receipt'; receiptId: string | number }

export function InvoiceDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [updateOpen, setUpdateOpen] = useState(false)
  const [updateNotes, setUpdateNotes] = useState('')
  const [updateStatus, setUpdateStatus] = useState('')
  const [updateLines, setUpdateLines] = useState<UpdateLineDraft[]>([])
  const [updateSaving, setUpdateSaving] = useState(false)
  const [updateError, setUpdateError] = useState('')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentValues, setPaymentValues] = useState<Record<string, string>>({})
  const [selectedPaymentLineId, setSelectedPaymentLineId] = useState<string>('')
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)

  const loadInvoice = useEffectEvent(async () => {
    setLoading(true)
    setPageError('')
    try {
      const loadedInvoice = await getInvoice(id)
      setInvoice(loadedInvoice)
    } catch (err: unknown) {
      setPageError(extractErrorMessage(err, 'Unable to load this invoice right now.'))
    } finally {
      setLoading(false)
    }
  })

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadInvoice()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [id])

  const openUpdateModal = () => {
    if (!invoice) return
    setUpdateNotes(invoice.notes || '')
    setUpdateStatus('')
    setUpdateLines(
      (invoice.lines || []).map((line) => ({
        invoiceLineId: line.id,
        notes: line.notes || '',
        cancelled: String(line.status || '').toUpperCase() === 'CANCELLED',
      })),
    )
    setUpdateError('')
    setUpdateSaving(false)
    setUpdateOpen(true)
  }

  const openPaymentModal = (lineId?: string | number) => {
    if (!invoice) return
    const nextValues: Record<string, string> = {}
    for (const line of invoice.lines || []) {
      nextValues[String(line.id)] = ''
    }
    setPaymentValues(nextValues)
    setPaymentNotes('')
    setPaymentError('')
    setPaymentSaving(false)
    setSelectedPaymentLineId(lineId == null ? '' : String(lineId))
    setPaymentOpen(true)
  }

  const outstandingLines = useMemo(
    () =>
      (invoice?.lines || []).filter(
        (line) =>
          String(line.status || '').toUpperCase() !== 'CANCELLED' && Number(line.balanceAmount || 0) > 0,
      ),
    [invoice?.lines],
  )

  const paymentTotal = useMemo(
    () =>
      Object.values(paymentValues).reduce((sum, value) => {
        const amount = Number(value || 0)
        return Number.isFinite(amount) ? sum + amount : sum
      }, 0),
    [paymentValues],
  )

  const previewReceipt = useMemo(() => {
    if (!invoice || !previewState || previewState.kind !== 'receipt') return null
    return (invoice.receipts || []).find((receipt) => String(receipt.id) === String(previewState.receiptId)) || null
  }, [invoice, previewState])

  const submitUpdate = async () => {
    if (!invoice) return
    setUpdateSaving(true)
    setUpdateError('')
    try {
      const changedLineUpdates = updateLines.reduce<InvoiceLineUpdateRequest[]>((updates, draft) => {
        const currentLine = (invoice.lines || []).find((line) => String(line.id) === String(draft.invoiceLineId))
        if (!currentLine) return updates
        const currentCancelled = String(currentLine.status || '').toUpperCase() === 'CANCELLED'
        const currentNotes = currentLine.notes || ''
        if (draft.cancelled !== currentCancelled || draft.notes !== currentNotes) {
          updates.push({
            invoiceLineId: draft.invoiceLineId,
            notes: draft.notes,
            cancelled: draft.cancelled,
          })
        }
        return updates
      }, [])

      const updated = await updateInvoice(invoice.id, {
        notes: updateNotes,
        status: updateStatus || undefined,
        lineUpdates: changedLineUpdates,
      })
      setInvoice(updated)
      setUpdateOpen(false)
    } catch (err: unknown) {
      setUpdateError(extractErrorMessage(err, 'Unable to save invoice changes right now.'))
      setUpdateSaving(false)
    }
  }

  const submitPayment = async () => {
    if (!invoice) return

    const allocations = outstandingLines.reduce<Array<{ invoiceLineId: string | number; amount: number }>>((list, line) => {
      const rawValue = paymentValues[String(line.id)] || ''
      const amount = Number(rawValue)
      if (Number.isFinite(amount) && amount > 0) {
        list.push({ invoiceLineId: line.id, amount })
      }
      return list
    }, [])

    if (allocations.length === 0) {
      setPaymentError('Enter at least one payment amount before saving the receipt.')
      return
    }

    for (const allocation of allocations) {
      const line = outstandingLines.find((entry) => String(entry.id) === String(allocation.invoiceLineId))
      if (!line) continue
      if (allocation.amount > Number(line.balanceAmount || 0)) {
        setPaymentError(`Payment for ${line.itemName || 'a line item'} cannot be greater than its remaining balance.`)
        return
      }
    }

    setPaymentSaving(true)
    setPaymentError('')
    try {
      const updated = await recordInvoicePayment(invoice.id, {
        notes: paymentNotes,
        allocations,
      })
      setInvoice(updated)
      setPaymentOpen(false)
    } catch (err: unknown) {
      setPaymentError(extractErrorMessage(err, 'Unable to record this payment right now.'))
      setPaymentSaving(false)
    }
  }

  const printPreview = () => {
    if (!invoice || !previewState) return

    const html =
      previewState.kind === 'invoice'
        ? buildInvoiceDocumentHtml(invoice, true)
        : buildReceiptDocumentHtml(invoice, previewReceipt, true)
    if (!html) return
    openDocumentWindow(html)
  }

  const downloadInvoicePdf = async () => {
    if (!invoice) return
    try {
      setPageError('')
      const bytes = await buildInvoicePdf(invoice)
      downloadPdfFile(bytes, buildInvoicePdfFileName(invoice))
    } catch (err: unknown) {
      setPageError(extractErrorMessage(err, 'Unable to download this invoice PDF right now.'))
    }
  }

  const downloadReceiptPdf = async (receipt: Receipt | null) => {
    if (!invoice || !receipt) return
    try {
      setPageError('')
      const bytes = await buildReceiptPdf(invoice, receipt)
      downloadPdfFile(bytes, buildReceiptPdfFileName(receipt, invoice))
    } catch (err: unknown) {
      setPageError(extractErrorMessage(err, 'Unable to download this receipt PDF right now.'))
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading invoice...</p>
  }

  if (!invoice) {
    return (
      <EmptyState
        title="Invoice not found"
        description={pageError || 'This invoice could not be loaded from the current branch scope.'}
      />
    )
  }

  return (
    <div className="space-y-5">
      <Card className="bg-gradient-to-r from-brand-900 to-brand-700 text-white">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs tracking-[0.2em] text-brand-100">INVOICE</p>
            <h1 className="mt-2 text-3xl font-bold">{invoice.invoiceNumber || '--'}</h1>
            <p className="mt-2 text-sm text-brand-100">
              Patient: {invoice.patientName || '--'} | File: {invoice.patientFileNumber || '--'} | Branch: {invoice.branchName || '--'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate('/invoices')}>
              <ArrowLeft size={16} />
              <span className="ml-2">Back to Invoices</span>
            </Button>
            <Button variant="secondary" onClick={() => setPreviewState({ kind: 'invoice' })}>
              <Eye size={16} />
              <span className="ml-2">Preview Invoice</span>
            </Button>
            <Button variant="secondary" onClick={downloadInvoicePdf}>
              <Download size={16} />
              <span className="ml-2">Save as PDF</span>
            </Button>
            <Button variant="secondary" onClick={openUpdateModal}>
              Update Invoice
            </Button>
            {Number(invoice.balanceAmount || 0) > 0 ? <Button onClick={() => openPaymentModal()}>Record Payment</Button> : null}
          </div>
        </div>
      </Card>

      {pageError ? <Card className="border-rose-200 bg-rose-50"><p className="text-sm text-rose-700">{pageError}</p></Card> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Status" value={formatStatusLabel(invoice.status)} />
        <SummaryCard label="Total" value={formatCurrency(invoice.totalAmount, invoice.currency || 'USD')} />
        <SummaryCard label="Paid" value={formatCurrency(invoice.amountPaid, invoice.currency || 'USD')} />
        <SummaryCard label="Balance" value={formatCurrency(invoice.balanceAmount, invoice.currency || 'USD')} />
      </div>

      <Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ProfileField label="Issued" value={toDateTime(invoice.issuedAt)} />
          <ProfileField label="Doctor Note Visit" value={toDate(invoice.doctorNoteVisitDate || undefined)} />
          <ProfileField label="Created By" value={invoice.createdByName} />
          <ProfileField label="Patient" value={invoice.patientName} />
          <ProfileField label="File Number" value={invoice.patientFileNumber} />
          <ProfileField label="Notes" value={invoice.notes} />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Invoice Line Items</h2>
            <p className="text-sm text-slate-500">Track what has been paid, what is still outstanding, and what has been cancelled.</p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Line Total</th>
                <th className="px-4 py-3 font-medium">Paid</th>
                <th className="px-4 py-3 font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {(invoice.lines || []).map((line) => {
                const canRecordPayment =
                  String(line.status || '').toUpperCase() !== 'CANCELLED' && Number(line.balanceAmount || 0) > 0
                return (
                <tr
                  key={String(line.id)}
                  className={`align-top ${canRecordPayment ? 'cursor-pointer transition hover:bg-brand-50 focus-within:bg-brand-50' : ''}`}
                  onClick={canRecordPayment ? () => openPaymentModal(line.id) : undefined}
                  onKeyDown={
                    canRecordPayment
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            openPaymentModal(line.id)
                          }
                        }
                      : undefined
                  }
                  tabIndex={canRecordPayment ? 0 : undefined}
                  aria-label={canRecordPayment ? `Record payment for ${line.itemName || 'invoice line item'}` : undefined}
                >
                  <td className="px-4 py-4">
                    <p className="font-medium text-slate-900">
                      {line.itemName}
                      {line.variantName ? ` - ${line.variantName}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {line.category || '--'}
                      {line.itemCode ? ` | Code: ${line.itemCode}` : ''}
                      {line.specimenType ? ` | Specimen: ${line.specimenType}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-4">{renderLineStatusBadge(line.status)}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{line.quantity || 1}</td>
                  <td className="px-4 py-4 text-sm font-medium text-slate-900">{formatCurrency(line.lineTotal, resolveCurrency(line.currency, invoice.currency))}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{formatCurrency(line.amountPaid, resolveCurrency(line.currency, invoice.currency))}</td>
                  <td className="px-4 py-4 text-sm font-medium text-amber-700">{formatCurrency(line.balanceAmount, resolveCurrency(line.currency, invoice.currency))}</td>
                  <td className="px-4 py-4 text-sm text-slate-600">
                    <div className="space-y-1">
                      <p>{line.notes || '--'}</p>
                      {canRecordPayment ? <p className="text-xs text-brand-700">Click row to record payment</p> : null}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Receipts</h2>
            <p className="text-sm text-slate-500">Each recorded payment produces a receipt that can be previewed and printed.</p>
          </div>
        </div>

        {(invoice.receipts || []).length === 0 ? (
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No receipts have been issued for this invoice yet.</div>
        ) : (
          <div className="mt-4 space-y-3">
            {(invoice.receipts || []).map((receipt) => (
              <div key={String(receipt.id)} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{receipt.receiptNumber || '--'}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {toDateTime(receipt.issuedAt)} | {formatCurrency(receipt.totalAmount, resolveCurrency(receipt.currency, invoice.currency))}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {renderReceiptStatusBadge(receipt.status)}
                    <Button variant="secondary" onClick={() => setPreviewState({ kind: 'receipt', receiptId: receipt.id || '' })}>
                      <Eye size={16} />
                      <span className="ml-2">Preview Receipt</span>
                    </Button>
                    <Button variant="secondary" onClick={() => downloadReceiptPdf(receipt)}>
                      <Download size={16} />
                      <span className="ml-2">Save as PDF</span>
                    </Button>
                    <Button variant="secondary" onClick={() => {
                      setPreviewState({ kind: 'receipt', receiptId: receipt.id || '' })
                      window.setTimeout(() => printPreview(), 0)
                    }}>
                      <Printer size={16} />
                      <span className="ml-2">Print Receipt</span>
                    </Button>
                  </div>
                </div>
                {(receipt.allocations || []).length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {(receipt.allocations || []).map((allocation) => (
                      <div key={String(allocation.id || allocation.invoiceLineId)} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                        <span className="text-slate-700">
                          {allocation.itemName}
                          {allocation.variantName ? ` - ${allocation.variantName}` : ''}
                        </span>
                        <span className="font-medium text-slate-900">{formatCurrency(allocation.amountApplied, resolveCurrency(allocation.currency, invoice.currency))}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal title="Update Invoice" open={updateOpen} onClose={() => setUpdateOpen(false)}>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <FieldBlock
              label="Invoice Status"
              helper={
                isPaymentManagedStatus(invoice.status)
                  ? `Current status is ${formatStatusLabel(invoice.status)}. Payment statuses are updated automatically when receipts are recorded.`
                  : 'Leave the current status as-is unless the invoice should no longer be billed.'
              }
            >
              <Select value={updateStatus} onChange={(e) => setUpdateStatus(e.target.value)}>
                <option value="">Keep current status</option>
                <option value="ISSUED">Issued</option>
                <option value="VOIDED">Voided</option>
              </Select>
            </FieldBlock>
            <FieldBlock label="Invoice Notes" helper="Optional billing note shown for staff reference.">
              <Input value={updateNotes} onChange={(e) => setUpdateNotes(e.target.value)} placeholder="Optional note" />
            </FieldBlock>
          </div>

          <div className="space-y-3">
            {updateLines.map((lineDraft, index) => {
              const currentLine = (invoice.lines || []).find((line) => String(line.id) === String(lineDraft.invoiceLineId))
              if (!currentLine) return null
              const linePaid = Number(currentLine.amountPaid || 0) > 0
              return (
                <div key={String(lineDraft.invoiceLineId)} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-slate-900">
                        {currentLine.itemName}
                        {currentLine.variantName ? ` - ${currentLine.variantName}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Balance: {formatCurrency(currentLine.balanceAmount, resolveCurrency(currentLine.currency, invoice.currency))}
                      </p>
                    </div>
                    <Select
                      value={lineDraft.cancelled ? 'cancelled' : 'active'}
                      onChange={(e) =>
                        setUpdateLines((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, cancelled: e.target.value === 'cancelled' } : entry,
                          ),
                        )
                      }
                      disabled={linePaid}
                    >
                      <option value="active">Ready for payment</option>
                      <option value="cancelled">Cancelled</option>
                    </Select>
                  </div>
                  <div className="mt-3">
                    <Input
                      value={lineDraft.notes}
                      onChange={(e) =>
                        setUpdateLines((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, notes: e.target.value } : entry,
                          ),
                        )
                      }
                      placeholder="Optional line note"
                    />
                  </div>
                  {linePaid ? (
                    <p className="mt-2 text-xs text-amber-700">Lines that already have payments cannot be cancelled.</p>
                  ) : null}
                </div>
              )
            })}
          </div>

          {updateError ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{updateError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setUpdateOpen(false)} disabled={updateSaving}>
              Cancel
            </Button>
            <Button onClick={submitUpdate} disabled={updateSaving}>
              {updateSaving ? 'Saving...' : 'Save Invoice'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal title="Record Payment" open={paymentOpen} onClose={() => setPaymentOpen(false)}>
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            Enter only the amounts received right now. The system will issue a partial receipt until the full invoice is paid.
          </div>

          <div className="space-y-3">
            {outstandingLines.map((line) => (
              <div
                key={String(line.id)}
                className={`rounded-2xl border p-3 ${
                  String(line.id) === selectedPaymentLineId ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">
                      {line.itemName}
                      {line.variantName ? ` - ${line.variantName}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Outstanding: {formatCurrency(line.balanceAmount, resolveCurrency(line.currency, invoice.currency))}
                    </p>
                  </div>
                  <div className="md:w-52">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={String(line.balanceAmount || 0)}
                      value={paymentValues[String(line.id)] || ''}
                      autoFocus={String(line.id) === selectedPaymentLineId}
                      onChange={(e) =>
                        setPaymentValues((current) => ({
                          ...current,
                          [String(line.id)]: e.target.value,
                        }))
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <FieldBlock label="Receipt Notes" helper="Optional note for this payment.">
            <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Optional note" />
          </FieldBlock>

          <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-800">
            Receipt total: <span className="font-semibold">{formatCurrency(paymentTotal, invoice.currency || 'USD')}</span>
          </div>

          {paymentError ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{paymentError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPaymentOpen(false)} disabled={paymentSaving}>
              Cancel
            </Button>
            <Button onClick={submitPayment} disabled={paymentSaving}>
              {paymentSaving ? 'Saving...' : 'Create Receipt'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title={previewState?.kind === 'invoice' ? 'Invoice Preview' : 'Receipt Preview'}
        open={Boolean(previewState)}
        onClose={() => setPreviewState(null)}
      >
        {previewState?.kind === 'invoice' ? (
          <PrintPreview>
            <InvoicePreview invoice={invoice} />
          </PrintPreview>
        ) : previewReceipt ? (
          <PrintPreview>
            <ReceiptPreview invoice={invoice} receipt={previewReceipt} />
          </PrintPreview>
        ) : (
          <p className="text-sm text-slate-500">Receipt preview is not available right now.</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setPreviewState(null)}>
            Close
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              previewState?.kind === 'invoice' ? downloadInvoicePdf() : downloadReceiptPdf(previewReceipt)
            }
          >
            <Download size={16} />
            <span className="ml-2">Save as PDF</span>
          </Button>
          <Button onClick={printPreview}>
            <Printer size={16} />
            <span className="ml-2">Print</span>
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </Card>
  )
}

function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value || '--'}</p>
    </div>
  )
}

function FieldBlock({
  label,
  helper,
  children,
}: {
  label: string
  helper?: string
  children: ReactNode
}) {
  return (
    <label className="space-y-2">
      <div className="space-y-1">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {helper ? <p className="text-xs text-slate-500">{helper}</p> : null}
      </div>
      {children}
    </label>
  )
}

function renderLineStatusBadge(status?: string) {
  const normalized = String(status || '').toUpperCase()
  const classes =
    normalized === 'PAID'
      ? 'bg-emerald-50 text-emerald-700'
      : normalized === 'PARTIALLY_PAID'
        ? 'bg-amber-50 text-amber-800'
        : normalized === 'CANCELLED'
          ? 'bg-rose-50 text-rose-700'
          : 'bg-slate-100 text-slate-700'

  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>{formatStatusLabel(normalized)}</span>
}

function renderReceiptStatusBadge(status?: string) {
  const normalized = String(status || '').toUpperCase()
  const classes =
    normalized === 'FINAL'
      ? 'bg-emerald-50 text-emerald-700'
      : normalized === 'VOIDED'
        ? 'bg-rose-50 text-rose-700'
        : 'bg-brand-50 text-brand-700'

  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>{formatStatusLabel(normalized)}</span>
}

function formatStatusLabel(status?: string) {
  const normalized = String(status || '').toUpperCase()
  if (!normalized) return '--'
  return normalized.replaceAll('_', ' ')
}

function isPaymentManagedStatus(status?: string) {
  const normalized = String(status || '').toUpperCase()
  return normalized === 'PAID' || normalized === 'PARTIALLY_PAID'
}

function PrintPreview({ children }: { children: ReactNode }) {
  return <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6">{children}</div>
}

function DocumentHtmlPreview({ html }: { html: string }) {
  return (
    <iframe
      title="Document preview"
      srcDoc={html}
      className="h-[70vh] w-full rounded-2xl border border-slate-200 bg-white"
    />
  )
}

function InvoicePreview({ invoice }: { invoice: Invoice }) {
  return <DocumentHtmlPreview html={buildInvoiceDocumentHtml(invoice)} />
}

function ReceiptPreview({ invoice, receipt }: { invoice: Invoice; receipt: Receipt }) {
  return <DocumentHtmlPreview html={buildReceiptDocumentHtml(invoice, receipt)} />
}

function resolveCurrency(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(value && String(value).trim())) || 'USD'
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== 'object' || error == null) return fallback

  const response = 'response' in error ? error.response : undefined
  if (typeof response === 'object' && response != null && 'data' in response) {
    const data = response.data
    if (typeof data === 'object' && data != null && 'message' in data && typeof data.message === 'string') {
      return data.message
    }
  }

  return fallback
}

/* Legacy PDF-specific renderer kept only for reference while the shared HTML preview/print path takes over.
async function buildInvoicePdf(invoice: Invoice) {
  const pdfDoc = await PDFDocument.create()
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const logoImage = await embedDocumentLogo(pdfDoc)
  const state = createPdfState(pdfDoc, regularFont, boldFont)

  state.y = drawPdfDocumentHeader(state, invoice, 'INVOICE', invoice.invoiceNumber || '--', invoice.issuedAt, logoImage)
  state.y = drawPdfMetaLine(state, `Status: ${formatStatusLabel(invoice.status)}   Visit Date: ${toDate(invoice.doctorNoteVisitDate || undefined)}`)
  if (invoice.notes) {
    state.y -= 12
    state.y = drawPdfLabelValue(state, 'Invoice Notes', invoice.notes)
  }

  state.y -= 18
  state.y = drawPdfSummaryRow(state, [
    ['Total', formatCurrency(invoice.totalAmount, invoice.currency || 'USD')],
    ['Paid', formatCurrency(invoice.amountPaid, invoice.currency || 'USD')],
    ['Balance', formatCurrency(invoice.balanceAmount, invoice.currency || 'USD')],
  ])

  state.y -= 20
  state.y = drawPdfTableHeader(state, ['Item', 'Qty', 'Status', 'Total'], [270, 50, 110, 85])
  for (const line of invoice.lines || []) {
    state.y = ensurePdfSpace(state, 28)
    drawPdfTableRow(
      state,
      [
        buildInvoiceLineLabel(line),
        String(line.quantity || 1),
        formatStatusLabel(line.status),
        formatCurrency(line.lineTotal, line.currency || invoice.currency || 'USD'),
      ],
      [270, 50, 110, 85],
    )
  }

  state.y -= 14
  drawPdfTotalsBlock(state, [
    ['Invoice Total', formatCurrency(invoice.totalAmount, invoice.currency || 'USD')],
    ['Amount Paid', formatCurrency(invoice.amountPaid, invoice.currency || 'USD')],
    ['Outstanding Balance', formatCurrency(invoice.balanceAmount, invoice.currency || 'USD')],
  ])

  return pdfDoc.save()
}

async function buildReceiptPdf(invoice: Invoice, receipt: Receipt) {
  const pdfDoc = await PDFDocument.create()
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const logoImage = await embedDocumentLogo(pdfDoc)
  const state = createPdfState(pdfDoc, regularFont, boldFont)

  state.y = drawPdfDocumentHeader(state, invoice, 'RECEIPT', receipt.receiptNumber || '--', receipt.issuedAt, logoImage)
  state.y = drawPdfMetaLine(state, `Receipt Type: ${formatStatusLabel(receipt.status)}   Recorded By: ${receipt.createdByName || '--'}`)
  if (receipt.notes) {
    state.y -= 12
    state.y = drawPdfLabelValue(state, 'Receipt Notes', receipt.notes)
  }

  state.y -= 20
  state.y = drawPdfTableHeader(state, ['Applied To', 'Amount'], [430, 85])
  for (const allocation of receipt.allocations || []) {
    state.y = ensurePdfSpace(state, 28)
    drawPdfTableRow(
      state,
      [
        buildReceiptAllocationLabel(allocation),
        formatCurrency(allocation.amountApplied, allocation.currency || invoice.currency || 'USD'),
      ],
      [430, 85],
    )
  }

  state.y -= 16
  drawPdfTotalsBlock(state, [['Total Received', formatCurrency(receipt.totalAmount, receipt.currency || invoice.currency || 'USD')]])

  return pdfDoc.save()
}

async function embedDocumentLogo(pdfDoc: PDFDocument) {
  const response = await fetch(sandtonLockupUrl)
  const bytes = await response.arrayBuffer()
  return pdfDoc.embedPng(bytes)
}

function createPdfState(pdfDoc: PDFDocument, regularFont: any, boldFont: any) {
  const pageSize: [number, number] = [595.28, 841.89]
  const margin = 40
  const page = pdfDoc.addPage(pageSize)
  return {
    pdfDoc,
    page,
    regularFont,
    boldFont,
    width: pageSize[0],
    height: pageSize[1],
    margin,
    y: pageSize[1] - margin,
  }
}

function ensurePdfSpace(state: ReturnType<typeof createPdfState>, requiredHeight: number) {
  if (state.y >= state.margin + requiredHeight) {
    return state.y
  }
  state.page = state.pdfDoc.addPage([state.width, state.height])
  state.y = state.height - state.margin
  return state.y
}

function drawPdfDocumentHeader(
  state: ReturnType<typeof createPdfState>,
  invoice: Invoice,
  label: string,
  number: string,
  issuedAt: string | undefined,
  logoImage: any,
) {
  ensurePdfSpace(state, 170)
  const leftBlockX = state.margin
  const leftBlockWidth = 250
  const logoWidth = 225
  const logoHeight = 170
  const logoX = leftBlockX + (leftBlockWidth - logoWidth) / 2
  state.page.drawImage(logoImage, {
    x: logoX,
    y: state.y - logoHeight + 8,
    width: logoWidth,
    height: logoHeight,
  })

  const branchBoxWidth = 225
  const branchBoxX = state.width - state.margin - branchBoxWidth
  const branchBoxY = state.y - 80
  state.page.drawRectangle({
    x: branchBoxX,
    y: branchBoxY,
    width: branchBoxWidth,
    height: 88,
    color: rgb(0.22, 0.51, 0.83),
  })
  state.page.drawSvgPath('M 0 0 L 26 88 L 26 0 Z', {
    x: branchBoxX - 26,
    y: branchBoxY,
    color: rgb(0.35, 0.67, 0.91),
    borderWidth: 0,
  })
  const branchLines = buildDocumentContactLines(invoice)
  let branchLineY = branchBoxY + 64
  for (const [index, line] of branchLines.slice(0, 4).entries()) {
    const wrappedLines = index === 3 ? wrapPdfText(line, 28) : [line]
    for (const wrappedLine of wrappedLines) {
      state.page.drawText(sanitizePdfText(wrappedLine), {
        x: branchBoxX + 16,
        y: branchLineY,
        size: index === 0 ? 10 : 9.5,
        font: index === 0 ? state.boldFont : state.regularFont,
        color: rgb(1, 1, 1),
      })
      branchLineY -= 14
    }
  }

  const titleY = state.y - 148
  state.page.drawLine({
    start: { x: state.margin, y: titleY + 16 },
    end: { x: state.width - state.margin, y: titleY + 16 },
    thickness: 1,
    color: rgb(0.89, 0.91, 0.96),
  })
  state.page.drawText(`${label} ${sanitizePdfText(number)}`, {
    x: state.margin,
    y: titleY,
    size: 22,
    font: state.boldFont,
    color: rgb(0.06, 0.09, 0.16),
  })
  state.page.drawText(`Issued: ${sanitizePdfText(toDateTime(issuedAt))}`, {
    x: state.margin,
    y: titleY - 18,
    size: 10,
    font: state.regularFont,
    color: rgb(0.33, 0.39, 0.49),
  })
  state.page.drawText(`Patient: ${sanitizePdfText(invoice.patientName || '--')}   File Number: ${sanitizePdfText(invoice.patientFileNumber || '--')}`, {
    x: state.margin,
    y: titleY - 34,
    size: 10,
    font: state.regularFont,
    color: rgb(0.15, 0.23, 0.33),
  })
  state.page.drawText(`Branch: ${sanitizePdfText(invoice.branchName || 'Clinic Branch')}`, {
    x: state.width - state.margin - 180,
    y: titleY - 18,
    size: 10,
    font: state.regularFont,
    color: rgb(0.15, 0.23, 0.33),
  })

  state.y = titleY - 54
  return state.y
}

function drawPdfMetaLine(state: ReturnType<typeof createPdfState>, value: string) {
  ensurePdfSpace(state, 16)
  state.page.drawText(sanitizePdfText(value), {
    x: state.margin,
    y: state.y,
    size: 10,
    font: state.regularFont,
    color: rgb(0.15, 0.23, 0.33),
  })
  return state.y - 16
}

function drawPdfLabelValue(state: ReturnType<typeof createPdfState>, label: string, value: string) {
  ensurePdfSpace(state, 38)
  state.page.drawText(sanitizePdfText(label), {
    x: state.margin,
    y: state.y,
    size: 10,
    font: state.boldFont,
    color: rgb(0.06, 0.09, 0.16),
  })
  const lines = wrapPdfText(value, 78)
  let lineY = state.y - 14
  for (const line of lines.slice(0, 4)) {
    state.page.drawText(sanitizePdfText(line), {
      x: state.margin,
      y: lineY,
      size: 10,
      font: state.regularFont,
      color: rgb(0.15, 0.23, 0.33),
    })
    lineY -= 12
  }
  return lineY - 4
}

function drawPdfSummaryRow(state: ReturnType<typeof createPdfState>, entries: Array<[string, string]>) {
  const boxWidth = 160
  const boxHeight = 44
  const gap = 12
  ensurePdfSpace(state, boxHeight + 8)
  entries.forEach(([label, value], index) => {
    const x = state.margin + index * (boxWidth + gap)
    state.page.drawRectangle({
      x,
      y: state.y - boxHeight,
      width: boxWidth,
      height: boxHeight,
      color: rgb(0.97, 0.98, 1),
    })
    state.page.drawText(sanitizePdfText(label), {
      x: x + 12,
      y: state.y - 16,
      size: 9,
      font: state.regularFont,
      color: rgb(0.33, 0.39, 0.49),
    })
    state.page.drawText(sanitizePdfText(value), {
      x: x + 12,
      y: state.y - 32,
      size: 11,
      font: state.boldFont,
      color: rgb(0.06, 0.09, 0.16),
    })
  })
  return state.y - boxHeight
}

function drawPdfTableHeader(state: ReturnType<typeof createPdfState>, labels: string[], widths: number[]) {
  const headerHeight = 24
  ensurePdfSpace(state, headerHeight + 8)
  state.page.drawRectangle({
    x: state.margin,
    y: state.y - headerHeight,
    width: widths.reduce((sum, width) => sum + width, 0),
    height: headerHeight,
    color: rgb(0.97, 0.98, 1),
  })
  let currentX = state.margin + 8
  labels.forEach((label, index) => {
    state.page.drawText(sanitizePdfText(label), {
      x: currentX,
      y: state.y - 16,
      size: 9,
      font: state.boldFont,
      color: rgb(0.33, 0.39, 0.49),
    })
    currentX += widths[index]
  })
  return state.y - headerHeight - 6
}

function drawPdfTableRow(state: ReturnType<typeof createPdfState>, values: string[], widths: number[]) {
  const rowHeight = 22
  let currentX = state.margin + 8
  values.forEach((value, index) => {
    state.page.drawText(sanitizePdfText(truncatePdfCell(value, widths[index])), {
      x: currentX,
      y: state.y - 14,
      size: 10,
      font: state.regularFont,
      color: rgb(0.15, 0.23, 0.33),
    })
    currentX += widths[index]
  })
  state.page.drawLine({
    start: { x: state.margin, y: state.y - rowHeight },
    end: { x: state.margin + widths.reduce((sum, width) => sum + width, 0), y: state.y - rowHeight },
    thickness: 0.6,
    color: rgb(0.89, 0.91, 0.96),
  })
  state.y -= rowHeight
}

function drawPdfTotalsBlock(state: ReturnType<typeof createPdfState>, totals: Array<[string, string]>) {
  const blockWidth = 220
  const blockX = state.width - state.margin - blockWidth
  const blockHeight = 20 + totals.length * 18
  ensurePdfSpace(state, blockHeight + 8)
  state.page.drawRectangle({
    x: blockX,
    y: state.y - blockHeight,
    width: blockWidth,
    height: blockHeight,
    color: rgb(0.97, 0.98, 1),
  })
  let lineY = state.y - 16
  totals.forEach(([label, value], index) => {
    const font = index === totals.length - 1 ? state.boldFont : state.regularFont
    state.page.drawText(sanitizePdfText(label), {
      x: blockX + 12,
      y: lineY,
      size: 10,
      font,
      color: rgb(0.15, 0.23, 0.33),
    })
    state.page.drawText(sanitizePdfText(value), {
      x: blockX + 120,
      y: lineY,
      size: 10,
      font,
      color: rgb(0.06, 0.09, 0.16),
    })
    lineY -= 18
  })
}

*/

async function buildInvoicePdf(invoice: Invoice) {
  const pdf = await import('pdf-lib')
  const pdfDoc = await pdf.PDFDocument.create()
  const regularFont = await pdfDoc.embedFont(pdf.StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(pdf.StandardFonts.HelveticaBold)
  const logoImage = await embedDocumentLogo(pdfDoc)
  const state = createPdfState(pdf, pdfDoc, regularFont, boldFont)

  drawPdfInvoiceTopBar(state, invoice)
  drawPdfInvoiceHeader(state, invoice, logoImage)
  drawPdfInvoiceTitle(state)
  drawPdfInvoiceMeta(state, invoice)
  drawPdfInvoiceStatus(state, invoice)
  drawPdfInvoiceTable(state, invoice)
  drawPdfInvoiceTotals(state, invoice)
  drawPdfInvoiceFooter(state, invoice)

  return pdfDoc.save()
}

async function buildReceiptPdf(invoice: Invoice, receipt: Receipt) {
  const pdf = await import('pdf-lib')
  const pdfDoc = await pdf.PDFDocument.create()
  const regularFont = await pdfDoc.embedFont(pdf.StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(pdf.StandardFonts.HelveticaBold)
  const logoImage = await embedDocumentLogo(pdfDoc)
  const state = createPdfState(pdf, pdfDoc, regularFont, boldFont, [226.77, 520], 16, 20)

  drawPdfReceipt(state, invoice, receipt, logoImage)

  return pdfDoc.save()
}

async function embedDocumentLogo(pdfDoc: any) {
  const response = await fetch('/brand/sandton24-logo.png')
  if (!response.ok) {
    throw new Error('Unable to load the clinic logo for PDF export.')
  }
  const bytes = await response.arrayBuffer()
  return pdfDoc.embedPng(bytes)
}

type PdfLibModule = typeof import('pdf-lib')

type PdfState = {
  pdf: PdfLibModule
  pdfDoc: any
  page: any
  regularFont: any
  boldFont: any
  width: number
  height: number
  margin: number
  footerReserve: number
  y: number
}

function createPdfState(
  pdf: PdfLibModule,
  pdfDoc: any,
  regularFont: any,
  boldFont: any,
  pageSize: [number, number] = [595.28, 841.89],
  margin = 34,
  footerReserve = 34,
): PdfState {
  const page = pdfDoc.addPage(pageSize)
  return {
    pdf,
    pdfDoc,
    page,
    regularFont,
    boldFont,
    width: pageSize[0],
    height: pageSize[1],
    margin,
    footerReserve,
    y: pageSize[1] - margin,
  }
}

function ensurePdfSpace(state: PdfState, requiredHeight: number) {
  if (state.y - requiredHeight >= state.margin + state.footerReserve) {
    return state.y
  }

  state.page = state.pdfDoc.addPage([state.width, state.height])
  state.y = state.height - state.margin
  return state.y
}

function drawPdfInvoiceTopBar(state: PdfState, invoice: Invoice) {
  const { rgb } = state.pdf
  const generatedAt = toDateTime(new Date().toISOString())
  const invoiceNumber = invoice.invoiceNumber || '--'
  const topY = state.y

  state.page.drawText(sanitizePdfText(generatedAt), {
    x: state.margin,
    y: topY,
    size: 8,
    font: state.regularFont,
    color: rgb(0.2, 0.25, 0.33),
  })
  state.page.drawText(`Invoice No: ${sanitizePdfText(invoiceNumber)}`, {
    x: state.width / 2 - 92,
    y: topY,
    size: 8,
    font: state.regularFont,
    color: rgb(0.2, 0.25, 0.33),
  })
  state.page.drawLine({
    start: { x: state.margin, y: topY - 10 },
    end: { x: state.width - state.margin, y: topY - 10 },
    thickness: 1,
    color: rgb(0.04, 0.44, 0.79),
  })
  drawPdfHeartbeat(state, state.width - state.margin - 56, topY - 15, 54, 10)
  state.y = topY - 30
}

function drawPdfInvoiceHeader(state: PdfState, invoice: Invoice, logoImage: any) {
  const { rgb } = state.pdf
  const headerHeight = 98
  ensurePdfSpace(state, headerHeight)

  const topY = state.y
  const logoBounds = fitPdfImage(logoImage, 190, 82)
  const logoX = state.margin + 8
  const logoY = topY - 10 - logoBounds.height
  state.page.drawImage(logoImage, {
    x: logoX,
    y: logoY,
    width: logoBounds.width,
    height: logoBounds.height,
  })

  const dividerX = state.margin + 240
  state.page.drawLine({
    start: { x: dividerX, y: topY - 4 },
    end: { x: dividerX, y: topY - 88 },
    thickness: 0.8,
    color: rgb(0.84, 0.91, 0.97),
  })

  let contactY = topY - 22
  buildDocumentContactLines(invoice).forEach((line, index) => {
    state.page.drawText(sanitizePdfText(line), {
      x: dividerX + 18,
      y: contactY,
      size: index === 0 ? 12 : 10.5,
      font: index === 0 ? state.boldFont : state.regularFont,
      color: rgb(0.06, 0.11, 0.18),
    })
    contactY -= 18
  })

  state.y = topY - headerHeight
}

function drawPdfInvoiceTitle(state: PdfState) {
  const { rgb } = state.pdf
  ensurePdfSpace(state, 38)
  const titleY = state.y - 24
  state.page.drawText('Invoice', {
    x: state.width / 2 - 52,
    y: titleY,
    size: 28,
    font: state.boldFont,
    color: rgb(0.02, 0.11, 0.18),
  })
  state.page.drawLine({
    start: { x: state.margin, y: titleY - 12 },
    end: { x: state.width - state.margin, y: titleY - 12 },
    thickness: 0.8,
    color: rgb(0.84, 0.91, 0.97),
  })
  state.y = titleY - 26
}

function drawPdfInvoiceMeta(state: PdfState, invoice: Invoice) {
  const { rgb } = state.pdf
  const rows = [
    ['Invoice No', invoice.invoiceNumber || '--'],
    ['Issued', toDateTime(invoice.issuedAt)],
    ['Patient', `${invoice.patientName || '--'} | File Number: ${invoice.patientFileNumber || '--'}`],
  ]

  ensurePdfSpace(state, 64)
  let rowY = state.y - 6
  rows.forEach(([label, value]) => {
    const keyLabel = `${sanitizePdfText(label)}:`
    state.page.drawText(keyLabel, {
      x: state.margin,
      y: rowY,
      size: 11,
      font: state.boldFont,
      color: rgb(0.02, 0.11, 0.18),
    })
    const labelWidth = state.boldFont.widthOfTextAtSize(keyLabel, 11)
    state.page.drawText(sanitizePdfText(value), {
      x: state.margin + labelWidth + 6,
      y: rowY,
      size: 11,
      font: state.regularFont,
      color: rgb(0.2, 0.25, 0.33),
    })
    rowY -= 20
  })
  state.page.drawLine({
    start: { x: state.margin, y: rowY + 6 },
    end: { x: state.width - state.margin, y: rowY + 6 },
    thickness: 0.8,
    color: rgb(0.84, 0.91, 0.97),
    dashArray: [3, 3],
  })
  state.y = rowY - 10
}

function drawPdfInvoiceStatus(state: PdfState, invoice: Invoice) {
  const { rgb } = state.pdf
  ensurePdfSpace(state, 34)
  const rows = [
    ['Status', formatStatusLabel(invoice.status)],
    ['Visit Date', toDate(invoice.doctorNoteVisitDate || undefined)],
  ]

  let rowY = state.y
  rows.forEach(([label, value], index) => {
    const keyLabel = `${sanitizePdfText(label)}:`
    state.page.drawText(keyLabel, {
      x: state.margin,
      y: rowY,
      size: 11,
      font: state.boldFont,
      color: rgb(0.02, 0.11, 0.18),
    })
    const labelWidth = state.boldFont.widthOfTextAtSize(keyLabel, 11)
    state.page.drawText(sanitizePdfText(value), {
      x: state.margin + labelWidth + 6,
      y: rowY,
      size: 11,
      font: state.regularFont,
      color: index === 0 ? rgb(0.04, 0.44, 0.79) : rgb(0.2, 0.25, 0.33),
    })
    rowY -= 18
  })
  state.y = rowY - 8
}

function drawPdfInvoiceTable(state: PdfState, invoice: Invoice) {
  const { rgb } = state.pdf
  const tableX = state.margin
  const tableWidth = state.width - state.margin * 2
  const columnWidths = [tableWidth * 0.58, tableWidth * 0.1, tableWidth * 0.15, tableWidth * 0.17]
  const headerHeight = 24

  ensurePdfSpace(state, headerHeight + 24 + (invoice.lines || []).length * 26)
  state.page.drawRectangle({
    x: tableX,
    y: state.y - headerHeight,
    width: tableWidth,
    height: headerHeight,
    color: rgb(0.02, 0.11, 0.18),
    borderRadius: 4,
  })

  let headerX = tableX + 8
  ;['ITEM', 'QTY', 'STATUS', 'TOTAL'].forEach((label, index) => {
    state.page.drawText(label, {
      x: headerX,
      y: state.y - 16,
      size: 10,
      font: state.boldFont,
      color: rgb(1, 1, 1),
    })
    headerX += columnWidths[index]
  })

  let rowTop = state.y - headerHeight
  for (const line of invoice.lines || []) {
    const label = buildInvoiceLinePdfLabel(line)
    const itemLines = wrapPdfTextByWidth(state.regularFont, label, 10.5, columnWidths[0] - 14)
    const rowHeight = Math.max(24, itemLines.length * 12 + 10)

    state.page.drawLine({
      start: { x: tableX, y: rowTop - rowHeight },
      end: { x: tableX + tableWidth, y: rowTop - rowHeight },
      thickness: 0.7,
      color: rgb(0.84, 0.91, 0.97),
    })

    let itemY = rowTop - 16
    itemLines.forEach((entry) => {
      state.page.drawText(sanitizePdfText(entry), {
        x: tableX + 8,
        y: itemY,
        size: 10.5,
        font: state.regularFont,
        color: rgb(0.2, 0.25, 0.33),
      })
      itemY -= 12
    })

    const qtyX = tableX + columnWidths[0]
    const statusX = qtyX + columnWidths[1]
    const totalX = statusX + columnWidths[2]
    state.page.drawText(String(line.quantity || 1), {
      x: qtyX + columnWidths[1] / 2 - 3,
      y: rowTop - 16,
      size: 10.5,
      font: state.regularFont,
      color: rgb(0.06, 0.11, 0.18),
    })
    state.page.drawText(formatStatusLabel(line.status), {
      x: statusX + 12,
      y: rowTop - 16,
      size: 10.5,
      font: state.boldFont,
      color: String(line.status || '').toUpperCase() === 'PAID' ? rgb(0.04, 0.44, 0.79) : rgb(0.06, 0.11, 0.18),
    })
    const totalLabel = formatCurrency(line.lineTotal, resolveCurrency(line.currency, invoice.currency))
    const totalWidth = state.regularFont.widthOfTextAtSize(totalLabel, 10.5)
    state.page.drawText(totalLabel, {
      x: totalX + columnWidths[3] - totalWidth - 8,
      y: rowTop - 16,
      size: 10.5,
      font: state.regularFont,
      color: rgb(0.06, 0.11, 0.18),
    })

    rowTop -= rowHeight
  }

  state.y = rowTop - 16
}

function drawPdfInvoiceTotals(state: PdfState, invoice: Invoice) {
  const { rgb } = state.pdf
  const blockWidth = 200
  const blockX = state.width - state.margin - blockWidth
  const rows: Array<[string, string, boolean]> = [
    ['Invoice Total', formatCurrency(invoice.totalAmount, resolveCurrency(invoice.currency)), false],
    ['Amount Paid', formatCurrency(invoice.amountPaid, resolveCurrency(invoice.currency)), false],
    ['Outstanding Balance', formatCurrency(invoice.balanceAmount, resolveCurrency(invoice.currency)), true],
  ]

  let rowY = state.y
  rows.forEach(([label, value, emphasis]) => {
    if (emphasis) {
      state.page.drawLine({
        start: { x: blockX, y: rowY + 6 },
        end: { x: blockX + blockWidth, y: rowY + 6 },
        thickness: 0.8,
        color: rgb(0.84, 0.91, 0.97),
      })
      rowY -= 12
    }

    state.page.drawText(label, {
      x: blockX,
      y: rowY,
      size: emphasis ? 11.5 : 11,
      font: emphasis ? state.boldFont : state.regularFont,
      color: rgb(0.06, 0.11, 0.18),
    })
    const valueSize = emphasis ? 17 : 11
    const valueWidth = state.boldFont.widthOfTextAtSize(value, valueSize)
    state.page.drawText(value, {
      x: blockX + blockWidth - valueWidth,
      y: rowY - (emphasis ? 2 : 0),
      size: valueSize,
      font: state.boldFont,
      color: emphasis ? rgb(0.04, 0.44, 0.79) : rgb(0.06, 0.11, 0.18),
    })
    rowY -= emphasis ? 20 : 18
  })
}

function drawPdfInvoiceFooter(state: PdfState, invoice: Invoice) {
  const { rgb } = state.pdf
  const lineY = state.margin + 22
  state.page.drawLine({
    start: { x: state.margin, y: lineY },
    end: { x: state.width - state.margin, y: lineY },
    thickness: 1,
    color: rgb(0.04, 0.44, 0.79),
  })
  state.page.drawText(sanitizePdfText(buildPdfFooterReference(invoice)), {
    x: state.margin,
    y: lineY - 16,
    size: 8,
    font: state.regularFont,
    color: rgb(0.04, 0.44, 0.79),
  })
  drawPdfHeartbeat(state, state.width - state.margin - 44, lineY - 4, 42, 8)
  state.page.drawText('Sandton 24 Clinic Billing System', {
    x: state.margin,
    y: state.margin + 2,
    size: 8,
    font: state.regularFont,
    color: rgb(0.2, 0.25, 0.33),
  })
  state.page.drawText('1/1', {
    x: state.width - state.margin - 14,
    y: state.margin + 2,
    size: 8,
    font: state.regularFont,
    color: rgb(0.2, 0.25, 0.33),
  })
}

function drawPdfReceipt(state: PdfState, invoice: Invoice, receipt: Receipt, logoImage: any) {
  const { rgb } = state.pdf
  const logoBounds = fitPdfImage(logoImage, 150, 70)
  const centerX = state.width / 2

  state.page.drawImage(logoImage, {
    x: centerX - logoBounds.width / 2,
    y: state.y - logoBounds.height,
    width: logoBounds.width,
    height: logoBounds.height,
  })
  state.y -= logoBounds.height + 12

  drawReceiptDivider(state)
  state.y -= 10

  buildDocumentContactLines(invoice).slice(0, 3).forEach((line, index) => {
    const size = index === 0 ? 10.5 : 9
    const font = index === 0 ? state.boldFont : state.regularFont
    const textWidth = font.widthOfTextAtSize(line, size)
    state.page.drawText(line, {
      x: centerX - textWidth / 2,
      y: state.y,
      size,
      font,
      color: rgb(0.06, 0.11, 0.18),
    })
    state.y -= 13
  })

  drawReceiptDivider(state)
  state.y -= 18

  const titleWidth = state.boldFont.widthOfTextAtSize('INVOICE', 18)
  state.page.drawText('INVOICE', {
    x: centerX - titleWidth / 2,
    y: state.y,
    size: 18,
    font: state.boldFont,
    color: rgb(0.04, 0.44, 0.79),
  })
  state.y -= 18

  const numberBoxY = state.y - 16
  state.page.drawRectangle({
    x: state.margin,
    y: numberBoxY,
    width: state.width - state.margin * 2,
    height: 20,
    color: rgb(0.02, 0.11, 0.18),
    borderRadius: 4,
  })
  const invoiceNumber = sanitizePdfText(invoice.invoiceNumber || '--')
  const numberTextWidth = state.boldFont.widthOfTextAtSize(invoiceNumber, 10)
  state.page.drawText(invoiceNumber, {
    x: Math.max(state.margin + 6, centerX - numberTextWidth / 2),
    y: numberBoxY + 6,
    size: 10,
    font: state.boldFont,
    color: rgb(1, 1, 1),
  })
  state.y = numberBoxY - 18

  const receiptMetaRows: Array<[string, string]> = [
    ['Date', toDateTime(receipt.issuedAt || invoice.issuedAt)],
    ['Patient', invoice.patientName || '--'],
    ['File No', invoice.patientFileNumber || '--'],
    ['Status', formatStatusLabel(invoice.status)],
  ]
  receiptMetaRows.forEach(([label, value], index) => {
    state.page.drawText(`${label}:`, {
      x: state.margin,
      y: state.y,
      size: 9.5,
      font: state.boldFont,
      color: rgb(0.06, 0.11, 0.18),
    })
    const lines = wrapPdfTextByWidth(state.regularFont, value, 9.5, state.width - state.margin * 2 - 52)
    state.page.drawText(lines[0] || '--', {
      x: state.margin + 48,
      y: state.y,
      size: 9.5,
      font: state.regularFont,
      color: index === 3 ? rgb(0.04, 0.44, 0.79) : rgb(0.2, 0.25, 0.33),
    })
    state.y -= 13
  })

  drawReceiptDivider(state)
  state.y -= 12

  state.page.drawText('ITEM', { x: state.margin, y: state.y, size: 9, font: state.boldFont, color: rgb(0.04, 0.44, 0.79) })
  state.page.drawText('QTY', { x: state.width - state.margin - 62, y: state.y, size: 9, font: state.boldFont, color: rgb(0.04, 0.44, 0.79) })
  state.page.drawText('PRICE', { x: state.width - state.margin - 30, y: state.y, size: 9, font: state.boldFont, color: rgb(0.04, 0.44, 0.79) })
  state.y -= 10

  for (const line of invoice.lines || []) {
    const itemLines = wrapPdfTextByWidth(state.boldFont, line.itemName || '--', 9.5, state.width - state.margin * 2 - 74)
    const codeText = `Code: ${line.itemCode || '--'}`

    state.page.drawText(itemLines[0] || '--', {
      x: state.margin,
      y: state.y,
      size: 9.5,
      font: state.boldFont,
      color: rgb(0.06, 0.11, 0.18),
    })
    if (itemLines[1]) {
      state.y -= 10
      state.page.drawText(itemLines[1], {
        x: state.margin,
        y: state.y,
        size: 9.5,
        font: state.boldFont,
        color: rgb(0.06, 0.11, 0.18),
      })
    }
    state.y -= 10
    state.page.drawText(codeText, {
      x: state.margin,
      y: state.y,
      size: 8.5,
      font: state.regularFont,
      color: rgb(0.4, 0.47, 0.56),
    })
    state.page.drawText(String(line.quantity || 1), {
      x: state.width - state.margin - 54,
      y: state.y + 10,
      size: 9.5,
      font: state.regularFont,
      color: rgb(0.06, 0.11, 0.18),
    })
    const priceLabel = formatCurrency(line.lineTotal, resolveCurrency(line.currency, invoice.currency))
    const priceWidth = state.regularFont.widthOfTextAtSize(priceLabel, 9.5)
    state.page.drawText(priceLabel, {
      x: state.width - state.margin - priceWidth,
      y: state.y + 10,
      size: 9.5,
      font: state.regularFont,
      color: rgb(0.06, 0.11, 0.18),
    })
    state.y -= 12
    drawReceiptDivider(state)
    state.y -= 10
  }

  const totalRows: Array<[string, string, boolean]> = [
    ['Total', formatCurrency(invoice.totalAmount, resolveCurrency(invoice.currency)), false],
    ['Paid', formatCurrency(invoice.amountPaid, resolveCurrency(invoice.currency)), false],
    ['Balance', formatCurrency(invoice.balanceAmount, resolveCurrency(invoice.currency)), true],
  ]
  totalRows.forEach(([label, value, emphasis]) => {
    state.page.drawText(label, {
      x: state.margin + 70,
      y: state.y,
      size: emphasis ? 10.5 : 9.5,
      font: emphasis ? state.boldFont : state.regularFont,
      color: emphasis ? rgb(0.04, 0.44, 0.79) : rgb(0.06, 0.11, 0.18),
    })
    const valueSize = emphasis ? 12 : 9.5
    const valueWidth = state.boldFont.widthOfTextAtSize(value, valueSize)
    state.page.drawText(value, {
      x: state.width - state.margin - valueWidth,
      y: state.y,
      size: valueSize,
      font: state.boldFont,
      color: emphasis ? rgb(0.04, 0.44, 0.79) : rgb(0.06, 0.11, 0.18),
    })
    state.y -= 14
  })

  drawReceiptDivider(state)
  state.y -= 14

  ;[
    'Thank you for choosing Sandton 24 Clinic.',
    'Your health is our priority.',
    'We appreciate your trust in us.',
  ].forEach((line, index) => {
    const font = index === 0 ? state.boldFont : state.regularFont
    const size = index === 0 ? 9.5 : 9
    const color = index === 0 ? rgb(0.04, 0.44, 0.79) : rgb(0.2, 0.25, 0.33)
    const width = font.widthOfTextAtSize(line, size)
    state.page.drawText(line, {
      x: centerX - width / 2,
      y: state.y,
      size,
      font,
      color,
    })
    state.y -= 12
  })

  drawReceiptDivider(state)
  state.y -= 12

  const motto = 'Compassionate care. Personalized for you.'
  const mottoWidth = state.regularFont.widthOfTextAtSize(motto, 8.5)
  state.page.drawText(motto, {
    x: centerX - mottoWidth / 2,
    y: state.y,
    size: 8.5,
    font: state.regularFont,
    color: rgb(0.04, 0.44, 0.79),
  })
  const pageLabelWidth = state.regularFont.widthOfTextAtSize('1/1', 8.5)
  state.page.drawText('1/1', {
    x: centerX - pageLabelWidth / 2,
    y: state.y - 12,
    size: 8.5,
    font: state.regularFont,
    color: rgb(0.2, 0.25, 0.33),
  })
}

function fitPdfImage(image: any, maxWidth: number, maxHeight: number) {
  const widthScale = maxWidth / image.width
  const heightScale = maxHeight / image.height
  const scale = Math.min(widthScale, heightScale)
  return {
    width: image.width * scale,
    height: image.height * scale,
  }
}

function drawPdfHeartbeat(state: PdfState, x: number, y: number, width: number, height: number) {
  const { rgb } = state.pdf
  const points = [
    { x, y: y + height / 2 },
    { x: x + width * 0.6, y: y + height / 2 },
    { x: x + width * 0.72, y: y + height / 2 },
    { x: x + width * 0.78, y: y + height },
    { x: x + width * 0.84, y },
    { x: x + width * 0.9, y: y + height * 0.7 },
    { x: x + width * 0.95, y: y + height / 2 },
    { x: x + width, y: y + height / 2 },
  ]

  for (let index = 0; index < points.length - 1; index += 1) {
    state.page.drawLine({
      start: points[index],
      end: points[index + 1],
      thickness: 1.2,
      color: rgb(0.04, 0.44, 0.79),
    })
  }
}

function drawReceiptDivider(state: PdfState) {
  const { rgb } = state.pdf
  state.page.drawLine({
    start: { x: state.margin, y: state.y },
    end: { x: state.width - state.margin, y: state.y },
    thickness: 0.8,
    color: rgb(0.5, 0.7, 0.91),
    dashArray: [3, 3],
  })
}

function buildDocumentContactLines(invoice: Invoice) {
  return [
    invoice.branchName || 'Sandton Main Branch',
    invoice.branchPhone || '+0000000001',
    'Sandton24clinic@gmail.com',
    invoice.branchName?.replace(/ Branch$/i, '') || 'Sandton Main',
  ]
}

function buildInvoiceLinePdfLabel(line: Invoice['lines'][number]) {
  return `${line.itemName || '--'} | Code: ${line.itemCode || '--'}`
}

function wrapPdfTextByWidth(font: any, value: string, size: number, maxWidth: number) {
  const text = sanitizePdfText(value)
  if (!text) return ['--']

  const words = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      currentLine = candidate
      continue
    }

    if (currentLine) {
      lines.push(currentLine)
      currentLine = word
      continue
    }

    let sliced = word
    while (font.widthOfTextAtSize(sliced, size) > maxWidth && sliced.length > 1) {
      sliced = sliced.slice(0, -1)
    }
    lines.push(sliced)
    currentLine = word.slice(sliced.length).trim()
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

function sanitizePdfText(value: string) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function buildPdfFooterReference(invoice: Invoice) {
  const branchName = invoice.branchName || 'Sandton Main Branch'
  return `${branchName} invoice record`
}

function buildInvoicePdfFileName(invoice: Invoice) {
  return `${sanitizeFileName(invoice.invoiceNumber || `invoice-${invoice.id || 'document'}`)}.pdf`
}

function buildReceiptPdfFileName(receipt: Receipt, invoice: Invoice) {
  return `${sanitizeFileName(receipt.receiptNumber || invoice.invoiceNumber || `receipt-${receipt.id || 'document'}`)}.pdf`
}

function sanitizeFileName(value: string) {
  return String(value || 'document')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
}

function downloadPdfFile(bytes: Uint8Array, fileName: string) {
  const pdfBytes = new Uint8Array(bytes)
  const blob = new Blob([pdfBytes.buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function openDocumentWindow(html: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const popup = window.open(url, '_blank', 'width=960,height=900')
  if (!popup) {
    URL.revokeObjectURL(url)
    return
  }

  const revokeUrl = () => {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  revokeUrl()
  popup.focus()
}
