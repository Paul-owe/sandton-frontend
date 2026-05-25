import type {
  Invoice,
  InvoiceFilters,
  InvoicePage,
  InvoiceSummary,
  RecordInvoicePaymentRequest,
  UpdateInvoiceRequest,
} from '../types/invoice'
import { http, pickArray } from './http'

export async function getInvoices(filters: InvoiceFilters = {}): Promise<InvoicePage> {
  const params: Record<string, string | number> = {}
  if (filters.query) params.query = filters.query
  if (filters.status) params.status = filters.status
  if (filters.branchId != null && `${filters.branchId}`.trim()) params.branchId = String(filters.branchId)
  params.page = typeof filters.page === 'number' ? filters.page : 0
  params.size = typeof filters.size === 'number' ? filters.size : 25

  const { data } = await http.get('/invoices', { params })
  const pageData = (data?.data || data) as Partial<InvoicePage>
  return {
    content: Array.isArray(pageData?.content) ? pageData.content : pickArray<InvoiceSummary>(data),
    number: typeof pageData?.number === 'number' ? pageData.number : 0,
    size: typeof pageData?.size === 'number' ? pageData.size : Number(params.size),
    totalPages: typeof pageData?.totalPages === 'number' ? pageData.totalPages : 0,
    totalElements: typeof pageData?.totalElements === 'number' ? pageData.totalElements : 0,
    first: Boolean(pageData?.first ?? true),
    last: Boolean(pageData?.last ?? true),
  }
}

export async function getInvoice(invoiceId: string | number): Promise<Invoice> {
  const { data } = await http.get(`/invoices/${invoiceId}`)
  return (data?.data || data) as Invoice
}

export async function updateInvoice(invoiceId: string | number, payload: UpdateInvoiceRequest): Promise<Invoice> {
  const { data } = await http.put(`/invoices/${invoiceId}`, payload)
  return (data?.data || data) as Invoice
}

export async function recordInvoicePayment(invoiceId: string | number, payload: RecordInvoicePaymentRequest): Promise<Invoice> {
  const { data } = await http.post(`/invoices/${invoiceId}/payments`, payload)
  return (data?.data || data) as Invoice
}
