export interface PriceListItemVariant {
  id: string | number
  name: string
  displayOrder?: number
  price: number
  currency: string
  active: boolean
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
}

export interface PriceListFilters {
  query?: string
  category?: string
  section?: string
  active?: boolean
}
