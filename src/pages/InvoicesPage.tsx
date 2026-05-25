import { Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBranches } from '../api/branchApi'
import { getInvoices } from '../api/invoiceApi'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { useAuth } from '../contexts/AuthContext'
import type { Branch } from '../types/branch'
import type { InvoiceSummary } from '../types/invoice'
import { formatCurrency, toDate, toDateTime } from '../utils/format'

const invoiceStatusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'ISSUED', label: 'Issued' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'VOIDED', label: 'Voided' },
]

export function InvoicesPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const hasAppliedInitialSearch = useRef(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [items, setItems] = useState<InvoiceSummary[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [pageError, setPageError] = useState('')

  const load = async ({
    page = currentPage,
    size = pageSize,
    queryValue = debouncedQuery,
    statusValue = statusFilter,
    branchIdValue = selectedBranchId,
  }: {
    page?: number
    size?: number
    queryValue?: string
    statusValue?: string
    branchIdValue?: string
  } = {}) => {
    setLoading(true)
    setPageError('')
    try {
      const response = await getInvoices({
        query: queryValue.trim(),
        status: statusValue || undefined,
        branchId: branchIdValue || undefined,
        page,
        size,
      })
      setItems(response.content)
      setCurrentPage(response.number)
      setPageSize(response.size)
      setTotalPages(response.totalPages)
      setTotalItems(response.totalElements)
    } catch {
      setPageError('Unable to load invoices right now.')
      setItems([])
      setTotalPages(0)
      setTotalItems(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load({ page: currentPage, size: pageSize })
  }, [currentPage, pageSize])

  useEffect(() => {
    if (!isAdmin) return
    getBranches()
      .then((loadedBranches) => setBranches(loadedBranches))
      .catch(() => setBranches([]))
  }, [isAdmin])

  useEffect(() => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      setDebouncedQuery('')
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
    if (currentPage !== 0) {
      setCurrentPage(0)
      return
    }
    load({ page: 0, queryValue: debouncedQuery })
  }, [debouncedQuery])

  const resultsLabel = useMemo(() => {
    if (loading) return 'Loading invoices...'
    if (totalItems === 0) return '0 invoices found'
    return `Showing ${items.length} of ${totalItems} invoice${totalItems === 1 ? '' : 's'}`
  }, [items.length, loading, totalItems])

  return (
    <div className="space-y-5">
      <Card className="bg-gradient-to-r from-brand-900 to-brand-700 text-white">
        <p className="text-xs tracking-[0.2em] text-brand-100">INVOICING</p>
        <h1 className="mt-2 text-3xl font-bold">Invoices</h1>
        <p className="mt-2 max-w-3xl text-sm text-brand-100">
          Review all issued invoices, track outstanding balances, and open any invoice to record payments, print it,
          or issue receipts.
        </p>
      </Card>

      <Card>
        <form
          className={`grid gap-3 ${
            isAdmin
              ? 'md:grid-cols-[minmax(0,1fr)_220px_220px_auto]'
              : 'md:grid-cols-[minmax(0,1fr)_220px_auto]'
          }`.trim()}
          onSubmit={(e) => {
            e.preventDefault()
            const immediateQuery = query.trim()
            setDebouncedQuery(immediateQuery)
            if (currentPage === 0) {
              load({ page: 0, queryValue: immediateQuery })
            } else {
              setCurrentPage(0)
            }
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
            <Input
              className="pl-9 pr-3"
              placeholder="Search by invoice number, file number, patient, or accounts reference"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const immediateQuery = query.trim()
                  setDebouncedQuery(immediateQuery)
                  if (currentPage === 0) {
                    load({ page: 0, queryValue: immediateQuery })
                  } else {
                    setCurrentPage(0)
                  }
                }
              }}
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => {
              const nextStatus = e.target.value
              setStatusFilter(nextStatus)
              if (currentPage !== 0) {
                setCurrentPage(0)
                return
              }
              load({ page: 0, statusValue: nextStatus })
            }}
          >
            {invoiceStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          {isAdmin ? (
            <Select
              value={selectedBranchId}
              onChange={(e) => {
                const nextBranchId = e.target.value
                setSelectedBranchId(nextBranchId)
                if (currentPage !== 0) {
                  setCurrentPage(0)
                  return
                }
                load({ page: 0, branchIdValue: nextBranchId })
              }}
            >
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={String(branch.id)} value={String(branch.id)}>
                  {branch.name || `Branch ${branch.id}`}
                </option>
              ))}
            </Select>
          ) : null}
          <Button type="submit">Search</Button>
        </form>
        <p className="mt-3 text-sm text-slate-500">{resultsLabel}</p>
        {pageError ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{pageError}</p> : null}
      </Card>

      {items.length === 0 && !loading ? (
        <EmptyState
          title="No invoices found"
          description="Invoices created from doctor’s notes will appear here and can be opened to manage payments and receipts."
        />
      ) : null}

      {items.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Branch</th>
                  <th className="px-4 py-3 font-medium">Issued</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Balance</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {items.map((invoice) => (
                  <tr
                    key={String(invoice.id)}
                    className="cursor-pointer align-top transition hover:bg-slate-50"
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        navigate(`/invoices/${invoice.id}`)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open invoice ${invoice.invoiceNumber || invoice.id}`}
                  >
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{invoice.invoiceNumber || '--'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Created {toDateTime(invoice.createdAt)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-slate-900">{invoice.patientName || '--'}</p>
                      <p className="mt-1 text-xs text-slate-500">File: {invoice.patientFileNumber || '--'}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{invoice.branchName || '--'}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{toDate(invoice.issuedAt)}</td>
                    <td className="px-4 py-4">{renderInvoiceStatusBadge(invoice.status)}</td>
                    <td className="px-4 py-4 text-sm font-medium text-slate-900">
                      {formatCurrency(invoice.totalAmount, invoice.currency || 'USD')}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {formatCurrency(invoice.amountPaid, invoice.currency || 'USD')}
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-amber-700">
                      {formatCurrency(invoice.balanceAmount, invoice.currency || 'USD')}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {invoice.lineItemCount || 0} line{invoice.lineItemCount === 1 ? '' : 's'} | {invoice.receiptCount || 0} receipt{invoice.receiptCount === 1 ? '' : 's'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600">
              Page <span className="font-medium text-slate-900">{totalPages === 0 ? 0 : currentPage + 1}</span> of{' '}
              <span className="font-medium text-slate-900">{Math.max(totalPages, 1)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span>Rows</span>
                <Select
                  value={String(pageSize)}
                  onChange={(e) => {
                    const nextSize = Number(e.target.value)
                    setPageSize(nextSize)
                    setCurrentPage(0)
                  }}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </Select>
              </label>
              <Button
                variant="secondary"
                onClick={() => setCurrentPage((value) => Math.max(value - 1, 0))}
                disabled={currentPage === 0 || loading}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                onClick={() => setCurrentPage((value) => (totalPages === 0 ? value : Math.min(value + 1, totalPages - 1)))}
                disabled={loading || totalPages === 0 || currentPage >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  )
}

function renderInvoiceStatusBadge(status?: string) {
  const normalized = String(status || '').toUpperCase()
  const classes =
    normalized === 'PAID'
      ? 'bg-emerald-50 text-emerald-700'
      : normalized === 'PARTIALLY_PAID'
        ? 'bg-amber-50 text-amber-800'
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
