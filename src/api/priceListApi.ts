import type { PriceListFilters, PriceListItem, PriceListItemVariant } from '../types/priceList'
import { http, pickArray } from './http'

export async function getPriceListItems(filters: PriceListFilters = {}): Promise<PriceListItem[]> {
  const params: Record<string, string | boolean> = {}
  if (filters.query) params.query = filters.query
  if (filters.category) params.category = filters.category
  if (filters.section) params.section = filters.section
  if (typeof filters.active === 'boolean') params.active = filters.active
  const { data } = await http.get('/price-list-items', { params })
  return pickArray<PriceListItem>(data)
}

export async function searchPriceListItems(query: string): Promise<PriceListItem[]> {
  const { data } = await http.get('/price-list-items/search', { params: { query } })
  return pickArray<PriceListItem>(data)
}

export async function getPriceListItem(id: string | number): Promise<PriceListItem> {
  const { data } = await http.get(`/price-list-items/${id}`)
  return (data?.data || data) as PriceListItem
}

export async function updatePriceListItem(id: string | number, payload: Record<string, unknown>): Promise<PriceListItem> {
  const { data } = await http.put(`/price-list-items/${id}`, payload)
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
