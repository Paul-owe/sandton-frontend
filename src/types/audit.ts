export interface PatientAuditTrailEntry {
  id?: string | number
  action?: string
  entityType?: string
  entityId?: string | number
  timestamp?: string
  userId?: string | number
  userFullName?: string
  userEmail?: string
  userRole?: string
  branchId?: string | number
  branchName?: string
}
