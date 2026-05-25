import type { PriceListFilters, PriceListItem, PriceListItemVariant, PriceListPage } from '../types/priceList'
import { http, pickArray } from './http'

export async function getPriceListItems(filters: PriceListFilters = {}): Promise<PriceListPage> {
  const params: Record<string, string | boolean | number> = {}
  if (filters.query) params.query = filters.query
  if (filters.category) params.category = filters.category
  if (filters.section) params.section = filters.section
  if (typeof filters.active === 'boolean') params.active = filters.active
  if (filters.branchId != null && `${filters.branchId}`.trim()) params.branchId = String(filters.branchId)
  params.page = typeof filters.page === 'number' ? filters.page : 0
  params.size = typeof filters.size === 'number' ? filters.size : 25
  const { data } = await http.get('/price-list-items', { params })
  const pageData = (data?.data || data) as Partial<PriceListPage>
  return {
    content: Array.isArray(pageData?.content) ? pageData.content : pickArray<PriceListItem>(data),
    number: typeof pageData?.number === 'number' ? pageData.number : 0,
    size: typeof pageData?.size === 'number' ? pageData.size : Number(params.size),
    totalPages: typeof pageData?.totalPages === 'number' ? pageData.totalPages : 0,
    totalElements: typeof pageData?.totalElements === 'number' ? pageData.totalElements : 0,
    first: Boolean(pageData?.first ?? true),
    last: Boolean(pageData?.last ?? true),
  }
}

export async function searchPriceListItems(query: string, branchId?: string | number): Promise<PriceListItem[]> {
  const params: Record<string, string> = { query }
  if (branchId != null && `${branchId}`.trim()) params.branchId = String(branchId)
  const { data } = await http.get('/price-list-items/search', { params })
  return pickArray<PriceListItem>(data)
}

export async function getPriceListItem(id: string | number, branchId?: string | number): Promise<PriceListItem> {
  const params: Record<string, string> = {}
  if (branchId != null && `${branchId}`.trim()) params.branchId = String(branchId)
  const { data } = await http.get(`/price-list-items/${id}`, { params })
  return (data?.data || data) as PriceListItem
}

export async function createPriceListItem(payload: Record<string, unknown>): Promise<PriceListItem> {
  const { data } = await http.post('/price-list-items', payload)
  return (data?.data || data) as PriceListItem
}

export async function updatePriceListItem(id: string | number, payload: Record<string, unknown>): Promise<PriceListItem> {
  const { data } = await http.put(`/price-list-items/${id}`, payload)
  return (data?.data || data) as PriceListItem
}

export async function updateBranchPriceListItem(
  itemId: string | number,
  branchId: string | number,
  payload: Record<string, unknown>,
): Promise<PriceListItem> {
  const { data } = await http.put(`/price-list-items/${itemId}/branch-pricing/${branchId}`, payload)
  return (data?.data || data) as PriceListItem
}

export async function updatePriceListItemVariant(
  itemId: string | number,
  variantId: string | number,
  payload: Partial<PriceListItemVariant>,
): Promise<PriceListItemVariant> {
  const { data } = await http.put(`/price-list-items/${itemId}/variants/${variantId}`, payload)
  return (data?.data || data) as PriceListItemVariant
}
