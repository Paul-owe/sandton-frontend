import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { getPriceListItem, getPriceListItems, updatePriceListItem, updatePriceListItemVariant } from '../api/priceListApi'
import type { PriceListItem } from '../types/priceList'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { formatCurrency } from '../utils/format'

const categoryOptions = [
  { value: '', label: 'All categories' },
  { value: 'TEST', label: 'Tests' },
  { value: 'PROCEDURE', label: 'Procedures' },
  { value: 'PROFILE', label: 'Profiles' },
  { value: 'VARIANT_PARENT', label: 'Variant-based items' },
]

export function PriceListsPage() {
  const { isAdmin } = useAuth()
  const [items, setItems] = useState<PriceListItem[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [loading, setLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [editItem, setEditItem] = useState<PriceListItem | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const load = async () => {
    setLoading(true)
    setPageError('')
    try {
      const active =
        statusFilter === 'all'
          ? undefined
          : statusFilter === 'active'
            ? true
            : false
      setItems(await getPriceListItems({ query: query.trim(), category: category || undefined, active }))
    } catch {
      setPageError('Unable to load the price list right now.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openEdit = async (item: PriceListItem) => {
    setEditError('')
    try {
      setEditItem(await getPriceListItem(item.id))
    } catch {
      setEditError('Unable to load the item for editing.')
    }
  }

  const closeEdit = () => {
    setEditItem(null)
    setEditSaving(false)
    setEditError('')
  }

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editItem) return
    setEditSaving(true)
    setEditError('')
    try {
      await updatePriceListItem(editItem.id, {
        name: editItem.name,
        code: editItem.code,
        category: editItem.category,
        section: editItem.section,
        specimenType: editItem.specimenType,
        basePrice: editItem.basePrice,
        currency: editItem.currency,
        pricingNote: editItem.pricingNote,
        requiresVariant: editItem.requiresVariant,
        active: editItem.active,
        sourceReference: undefined,
        variants: (editItem.variants || []).map((variant) => ({
          name: variant.name,
          displayOrder: variant.displayOrder,
          price: variant.price,
          currency: variant.currency,
          active: variant.active,
        })),
      })

      for (const variant of editItem.variants || []) {
        if (!variant.id) continue
        await updatePriceListItemVariant(editItem.id, variant.id, {
          name: variant.name,
          displayOrder: variant.displayOrder,
          price: variant.price,
          currency: variant.currency,
          active: variant.active,
        })
      }

      await load()
      closeEdit()
    } catch (err: any) {
      setEditError(err?.response?.data?.message || 'Unable to save price changes right now.')
      setEditSaving(false)
    }
  }

  const resultsLabel = useMemo(() => {
    if (loading) return 'Loading prices...'
    return `${items.length} item${items.length === 1 ? '' : 's'} found`
  }, [items.length, loading])

  return (
    <div className="space-y-5">
      <Card className="bg-gradient-to-r from-emerald-700 to-teal-600 text-white">
        <p className="text-xs tracking-[0.2em] text-emerald-100">PRICE CATALOG</p>
        <h1 className="mt-2 text-3xl font-bold">Price Lists</h1>
        <p className="mt-2 max-w-3xl text-sm text-emerald-50">
          Search the imported test, procedure, and profile catalog. Admins can update prices globally, while unresolved pricing rows stay clearly marked for review.
        </p>
      </Card>

      <Card>
        <form
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_180px_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            load()
          }}
        >
          <Input
            placeholder="Search by item name, code, section, or specimen"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </Select>
          <Button type="submit">Search</Button>
        </form>
        <p className="mt-3 text-sm text-slate-500">{resultsLabel}</p>
        {pageError ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{pageError}</p> : null}
      </Card>

      {items.length === 0 && !loading ? (
        <EmptyState
          title="No price list items found"
          description="Try a broader search, switch the status filter, or review the inactive items that still need business confirmation."
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {items.map((item) => (
          <Card key={String(item.id)} className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">{item.name}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                    {item.active ? 'Active' : 'Needs review'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {item.category.replaceAll('_', ' ')}{item.code ? ` | Code: ${item.code}` : ''}{item.section ? ` | Section: ${item.section.replaceAll('_', ' ')}` : ''}
                </p>
              </div>
              {isAdmin ? (
                <Button variant="secondary" onClick={() => openEdit(item)}>
                  Edit item
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <PriceMeta label="Specimen" value={item.specimenType || '--'} />
              <PriceMeta label="Price" value={item.requiresVariant ? variantSummary(item) : formatCurrency(item.basePrice, item.currency)} />
            </div>

            {item.variants && item.variants.length > 0 ? (
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-900">Variants</p>
                <div className="mt-2 space-y-2">
                  {item.variants.map((variant) => (
                    <div key={String(variant.id)} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                      <span className="text-slate-700">{variant.name}</span>
                      <span className="font-medium text-slate-900">{formatCurrency(variant.price, variant.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {item.pricingNote ? (
              <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">{item.pricingNote}</div>
            ) : null}
          </Card>
        ))}
      </div>

      <Modal title="Edit Price List Item" open={Boolean(editItem)} onClose={closeEdit}>
        {editItem ? (
          <form className="grid gap-3 md:grid-cols-2" onSubmit={submitEdit}>
            <Input value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} />
            <Input value={editItem.code || ''} onChange={(e) => setEditItem({ ...editItem, code: e.target.value })} placeholder="Code" />
            <Input value={editItem.section || ''} onChange={(e) => setEditItem({ ...editItem, section: e.target.value })} placeholder="Section" />
            <Input
              value={editItem.specimenType || ''}
              onChange={(e) => setEditItem({ ...editItem, specimenType: e.target.value })}
              placeholder="Specimen type"
            />
            {!editItem.requiresVariant ? (
              <Input
                type="number"
                step="0.01"
                value={editItem.basePrice ?? ''}
                onChange={(e) => setEditItem({ ...editItem, basePrice: Number(e.target.value) })}
                placeholder="Base price"
              />
            ) : null}
            <Select
              value={editItem.active ? 'true' : 'false'}
              onChange={(e) => setEditItem({ ...editItem, active: e.target.value === 'true' })}
            >
              <option value="true">Active</option>
              <option value="false">Inactive / needs review</option>
            </Select>
            <Input
              className="md:col-span-2"
              value={editItem.pricingNote || ''}
              onChange={(e) => setEditItem({ ...editItem, pricingNote: e.target.value })}
              placeholder="Pricing note"
            />

            {editItem.variants?.map((variant, index) => (
              <div key={String(variant.id || index)} className="md:col-span-2 rounded-2xl border border-slate-200 p-3">
                <p className="mb-2 text-sm font-medium text-slate-900">{variant.name}</p>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_180px]">
                  <Input
                    value={variant.name}
                    onChange={(e) =>
                      setEditItem({
                        ...editItem,
                        variants: (editItem.variants || []).map((existing, existingIndex) =>
                          existingIndex === index ? { ...existing, name: e.target.value } : existing,
                        ),
                      })
                    }
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={variant.price}
                    onChange={(e) =>
                      setEditItem({
                        ...editItem,
                        variants: (editItem.variants || []).map((existing, existingIndex) =>
                          existingIndex === index ? { ...existing, price: Number(e.target.value) } : existing,
                        ),
                      })
                    }
                  />
                  <Select
                    value={variant.active ? 'true' : 'false'}
                    onChange={(e) =>
                      setEditItem({
                        ...editItem,
                        variants: (editItem.variants || []).map((existing, existingIndex) =>
                          existingIndex === index ? { ...existing, active: e.target.value === 'true' } : existing,
                        ),
                      })
                    }
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </Select>
                </div>
              </div>
            ))}

            {editError ? <p className="md:col-span-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{editError}</p> : null}
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeEdit} disabled={editSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}

function PriceMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}

function variantSummary(item: PriceListItem) {
  if (!item.variants || item.variants.length === 0) return 'Variant required'
  const activeVariants = item.variants.filter((variant) => variant.active)
  if (activeVariants.length === 0) return 'No active variants'
  const lowest = Math.min(...activeVariants.map((variant) => variant.price))
  return `From ${formatCurrency(lowest, activeVariants[0]?.currency || item.currency)}`
}
