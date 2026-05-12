export interface DoctorNoteChargeLine {
  id?: string | number
  priceListItemId?: string | number
  priceListItemVariantId?: string | number
  itemName?: string
  variantName?: string
  itemCode?: string
  category?: string
  specimenType?: string
  unitPrice?: number
  quantity?: number
  lineTotal?: number
  currency?: string
  notes?: string
}

export interface DoctorNote {
  id?: string | number
  patientId?: string | number
  documentId?: string | number
  visitDate?: string
  attendingDoctorName?: string
  presentingComplaintSummary?: string
  diagnosisSummary?: string
  treatmentSummary?: string
  reviewNotes?: string
  accountsReferenceNumber?: string
  chargeLines?: DoctorNoteChargeLine[]
  totalAmount?: number
  currency?: string
  createdAt?: string
  [key: string]: unknown
}
