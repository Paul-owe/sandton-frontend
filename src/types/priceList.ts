export interface PriceListItemVariant {
  id: string | number
  name: string
  displayOrder?: number
  price: number
  currency: string
  active: boolean
  defaultPrice?: number
  defaultCurrency?: string
  defaultActive?: boolean
  branchPricingApplied?: boolean
}

export interface PriceListItem {
  id: string | number
  name: string
  code?: string | null
  category: 'TEST' | 'PROCEDURE' | 'PROFILE' | 'VARIANT_PARENT' | string
  section?: string | null
  specimenType?: string | null
  basePrice?: number | null
  currency: string
  pricingNote?: string | null
  requiresVariant: boolean
  active: boolean
  variants?: PriceListItemVariant[]
  defaultBasePrice?: number | null
  defaultCurrency?: string
  defaultActive?: boolean
  branchPricingApplied?: boolean
  pricingBranchId?: string | number | null
}

export interface PriceListFilters {
  query?: string
  category?: string
  section?: string
  active?: boolean
  branchId?: string | number
  page?: number
  size?: number
}

export interface PriceListPage {
  content: PriceListItem[]
  number: number
  size: number
  totalPages: number
  totalElements: number
  first: boolean
  last: boolean
}
