export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOIDED' | string
export type InvoiceLineStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | string
export type ReceiptStatus = 'PARTIAL' | 'FINAL' | 'VOIDED' | string

export interface InvoiceLine {
  id: string | number
  doctorNoteChargeLineId?: string | number | null
  itemName?: string
  variantName?: string | null
  itemCode?: string | null
  category?: string | null
  specimenType?: string | null
  unitPrice?: number
  quantity?: number
  lineTotal?: number
  amountPaid?: number
  balanceAmount?: number
  currency?: string
  status?: InvoiceLineStatus
  notes?: string | null
}

export interface ReceiptAllocation {
  id?: string | number
  invoiceLineId?: string | number
  itemName?: string
  variantName?: string | null
  amountApplied?: number
  currency?: string
}

export interface Receipt {
  id?: string | number
  receiptNumber?: string
  status?: ReceiptStatus
  totalAmount?: number
  currency?: string
  notes?: string | null
  issuedAt?: string
  createdAt?: string
  createdByName?: string | null
  allocations?: ReceiptAllocation[]
}

export interface InvoiceSummary {
  id: string | number
  invoiceNumber?: string
  patientId?: string | number
  patientFileNumber?: string | null
  patientName?: string | null
  branchId?: string | number
  branchName?: string | null
  doctorNoteId?: string | number | null
  status?: InvoiceStatus
  totalAmount?: number
  amountPaid?: number
  balanceAmount?: number
  currency?: string
  lineItemCount?: number
  receiptCount?: number
  issuedAt?: string
  createdAt?: string
}

export interface Invoice extends InvoiceSummary {
  branchAddress?: string | null
  branchPhone?: string | null
  doctorNoteVisitDate?: string | null
  notes?: string | null
  createdByName?: string | null
  lines: InvoiceLine[]
  receipts: Receipt[]
}

export interface InvoiceFilters {
  query?: string
  status?: string
  branchId?: string | number
  page?: number
  size?: number
}

export interface InvoicePage {
  content: InvoiceSummary[]
  number: number
  size: number
  totalPages: number
  totalElements: number
  first: boolean
  last: boolean
}

export interface InvoiceLineUpdateRequest {
  invoiceLineId: string | number
  notes?: string | null
  cancelled?: boolean
}

export interface UpdateInvoiceRequest {
  notes?: string | null
  status?: string | null
  lineUpdates?: InvoiceLineUpdateRequest[]
}

export interface InvoiceLinePaymentRequest {
  invoiceLineId: string | number
  amount: number
}

export interface RecordInvoicePaymentRequest {
  notes?: string | null
  allocations: InvoiceLinePaymentRequest[]
}
