import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { getBranches } from '../api/branchApi'
import {
  createPriceListItem,
  getPriceListItem,
  getPriceListItems,
  searchPriceListItems,
  updateBranchPriceListItem,
  updatePriceListItem,
  updatePriceListItemVariant,
} from '../api/priceListApi'
import type { Branch } from '../types/branch'
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

const itemCategoryOptions = categoryOptions.filter((option) => option.value)

type PriceListVariantDraft = {
  id?: string | number
  name: string
  displayOrder: string
  price: string
  currency: string
  active: boolean
}

type PriceListItemDraft = {
  id?: string | number
  name: string
  code: string
  category: string
  section: string
  specimenType: string
  basePrice: string
  currency: string
  pricingNote: string
  requiresVariant: boolean
  active: boolean
  sourceReference: string
  variants: PriceListVariantDraft[]
}

export function PriceListsPage() {
  const { isAdmin, user } = useAuth()
  const hasAppliedInitialSearch = useRef(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [items, setItems] = useState<PriceListItem[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [category, setCategory] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [suggestions, setSuggestions] = useState<PriceListItem[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createItem, setCreateItem] = useState<PriceListItemDraft>(createEmptyPriceListItemDraft())
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState('')
  const [editItem, setEditItem] = useState<PriceListItem | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const load = async ({
    page = currentPage,
    size = pageSize,
    queryValue = debouncedQuery,
    categoryValue = category,
    statusValue = statusFilter,
    branchIdValue = selectedBranchId,
  }: {
    page?: number
    size?: number
    queryValue?: string
    categoryValue?: string
    statusValue?: 'all' | 'active' | 'inactive'
    branchIdValue?: string
  } = {}) => {
    setLoading(true)
    setPageError('')
    try {
      const active =
        statusValue === 'all'
          ? undefined
          : statusValue === 'active'
            ? true
            : false
      const response = await getPriceListItems({
        query: queryValue.trim(),
        category: categoryValue || undefined,
        active,
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
      setPageError('Unable to load the price list right now.')
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
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      setDebouncedQuery('')
      setSuggestions([])
      setSuggestionsLoading(false)
      return
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(trimmedQuery)
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [query])

  useEffect(() => {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 2) {
      setSuggestions([])
      setSuggestionsLoading(false)
      return
    }

    let active = true
    setSuggestionsLoading(true)
    const timeoutId = window.setTimeout(async () => {
      try {
        const matches = await searchPriceListItems(trimmedQuery, selectedBranchId || undefined)
        if (!active) return
        setSuggestions(matches.slice(0, 8))
      } catch {
        if (active) setSuggestions([])
      } finally {
        if (active) setSuggestionsLoading(false)
      }
    }, 220)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [query, selectedBranchId])

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

  useEffect(() => {
    if (!isAdmin) return
    getBranches()
      .then((loadedBranches) => setBranches(loadedBranches))
      .catch(() => setBranches([]))
  }, [isAdmin])

  const openEdit = async (item: PriceListItem) => {
    setEditError('')
    try {
      setEditItem(await getPriceListItem(item.id, selectedBranchId || undefined))
    } catch {
      setEditError('Unable to load the item for editing.')
    }
  }

  const closeEdit = () => {
    setEditItem(null)
    setEditSaving(false)
    setEditError('')
  }

  const openCreate = () => {
    setCreateError('')
    setCreateSaving(false)
    setCreateItem(createEmptyPriceListItemDraft())
    setCreateOpen(true)
  }

  const closeCreate = () => {
    setCreateOpen(false)
    setCreateSaving(false)
    setCreateError('')
    setCreateItem(createEmptyPriceListItemDraft())
  }

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault()

    if (!createItem.name.trim()) {
      setCreateError('Enter the item name before saving.')
      return
    }

    if (!createItem.category) {
      setCreateError('Choose the item category.')
      return
    }

    if (createItem.requiresVariant) {
      if (createItem.variants.length === 0) {
        setCreateError('Add at least one price option before saving this item.')
        return
      }
      if (createItem.variants.some((variant) => !variant.name.trim() || !variant.price.trim())) {
        setCreateError('Complete each price option with a name and price.')
        return
      }
    } else if (!createItem.basePrice.trim()) {
      setCreateError('Enter the item price before saving.')
      return
    }

    setCreateSaving(true)
    setCreateError('')
    try {
      await createPriceListItem(buildPriceListPayload(createItem))
      await load()
      closeCreate()
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || 'Unable to add the new price item right now.')
      setCreateSaving(false)
    }
  }

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editItem) return
    setEditSaving(true)
    setEditError('')
    try {
      if (isAdmin && selectedBranchId) {
        await updatePriceListItem(editItem.id, buildSharedItemPayloadFromBranchScopedItem(editItem))
        await updateBranchPriceListItem(editItem.id, selectedBranchId, {
          active: editItem.active,
          basePrice: editItem.requiresVariant ? undefined : editItem.basePrice,
          currency: editItem.currency,
          variants: (editItem.variants || []).map((variant) => ({
            variantId: variant.id,
            price: variant.price,
            currency: variant.currency,
            active: variant.active,
          })),
        })
      } else {
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
      }

      await load()
      closeEdit()
    } catch (err: any) {
      setEditError(err?.response?.data?.message || 'Unable to save price changes right now.')
      setEditSaving(false)
    }
  }

  const selectedBranch = useMemo(
    () => branches.find((branch) => String(branch.id || '') === selectedBranchId) || null,
    [branches, selectedBranchId],
  )
  const branchPricingMode = isAdmin && Boolean(selectedBranchId)
  const scopeLabel = branchPricingMode
    ? `${selectedBranch?.name || 'Selected Branch'} prices`
    : isAdmin
      ? 'Shared default prices'
      : `${String(user?.branchName || 'Branch')} prices`

  const editModalTitle = branchPricingMode
    ? `Manage ${selectedBranch?.name || 'Branch'} Item`
    : 'Edit Price List Item'

  const resultsLabel = useMemo(() => {
    if (loading) return 'Loading prices...'
    if (totalItems === 0) return `0 items found in ${scopeLabel.toLowerCase()}`
    return `Showing ${items.length} of ${totalItems} item${totalItems === 1 ? '' : 's'} in ${scopeLabel.toLowerCase()}`
  }, [items.length, loading, scopeLabel, totalItems])

  const showSuggestionPanel = showSuggestions && query.trim().length >= 2 && (suggestionsLoading || suggestions.length > 0)

  const chooseSuggestion = async (item: PriceListItem) => {
    const nextQuery = String(item.code || item.name || '')
    setQuery(nextQuery)
    setDebouncedQuery(nextQuery)
    setShowSuggestions(false)
    if (currentPage !== 0) {
      setCurrentPage(0)
      return
    }
    await load({ page: 0, queryValue: nextQuery })
  }

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
          className={`grid gap-3 ${
            isAdmin
              ? 'md:grid-cols-[minmax(0,1fr)_220px_180px_220px_auto]'
              : 'md:grid-cols-[minmax(0,1fr)_220px_180px_auto]'
          }`.trim()}
          onSubmit={(e) => {
            e.preventDefault()
            const immediateQuery = query.trim()
            setDebouncedQuery(immediateQuery)
            setShowSuggestions(false)
            if (currentPage === 0) {
              load({ page: 0, size: pageSize, queryValue: immediateQuery })
            } else {
              setCurrentPage(0)
            }
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
            <Input
              className="pl-9 pr-3"
              placeholder="Search by item name, code, section, or specimen"
              value={query}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
              onChange={(e) => {
                setQuery(e.target.value)
                setShowSuggestions(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const immediateQuery = query.trim()
                  setDebouncedQuery(immediateQuery)
                  setShowSuggestions(false)
                  if (currentPage !== 0) {
                    setCurrentPage(0)
                    return
                  }
                  load({ page: 0, queryValue: immediateQuery })
                }
              }}
            />

            {showSuggestionPanel ? (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
                {suggestionsLoading ? (
                  <div className="px-4 py-3 text-sm text-slate-500">Searching items...</div>
                ) : (
                  suggestions.map((item) => (
                    <button
                      key={String(item.id)}
                      type="button"
                      className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        chooseSuggestion(item)
                      }}
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">
                          Code: {item.code || '--'} | Section: {item.section || '--'} | Specimen: {item.specimenType || '--'}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400">
                        {item.requiresVariant ? variantSummary(item) : formatCurrency(item.basePrice, item.currency)}
                      </p>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          <Select
            value={category}
            onChange={(e) => {
              const nextCategory = e.target.value
              setCategory(nextCategory)
              if (currentPage !== 0) {
                setCurrentPage(0)
                return
              }
              load({ page: 0, categoryValue: nextCategory })
            }}
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => {
              const nextStatus = e.target.value as typeof statusFilter
              setStatusFilter(nextStatus)
              if (currentPage !== 0) {
                setCurrentPage(0)
                return
              }
              load({ page: 0, statusValue: nextStatus })
            }}
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </Select>
          {isAdmin ? (
            <Select
              value={selectedBranchId}
              onChange={(e) => {
                const nextBranchId = e.target.value
                setSelectedBranchId(nextBranchId)
                setSuggestions([])
                if (currentPage !== 0) {
                  setCurrentPage(0)
                  return
                }
                load({ page: 0, branchIdValue: nextBranchId })
              }}
            >
              <option value="">Shared default prices</option>
              {branches.map((branch) => (
                <option key={String(branch.id)} value={String(branch.id)}>
                  {branch.name || `Branch ${branch.id}`}
                </option>
              ))}
            </Select>
          ) : null}
          <Button type="submit">Search</Button>
        </form>
        {isAdmin ? (
          <div className="mt-4 flex justify-end">
            <Button onClick={openCreate}>Add Price Item</Button>
          </div>
        ) : null}
        <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
          Viewing: <span className="font-medium text-slate-900">{scopeLabel}</span>
          {branchPricingMode ? ' Branch users will see these prices in search and doctor notes.' : ' These are the shared default prices used when a branch has no custom override.'}
        </div>
        <p className="mt-3 text-sm text-slate-500">{resultsLabel}</p>
        {pageError ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{pageError}</p> : null}
      </Card>

      {items.length === 0 && !loading ? (
        <EmptyState
          title="No price list items found"
          description="Try a broader search, switch the status filter, or review the inactive items that still need business confirmation."
        />
      ) : null}

      {items.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Section</th>
                  <th className="px-4 py-3 font-medium">Specimen</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">{branchPricingMode ? 'Branch Price' : 'Price'}</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium min-w-[9rem]">Pricing Source</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                  {isAdmin ? <th className="px-4 py-3 font-medium text-right">Action</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {items.map((item) => (
                  <tr
                    key={String(item.id)}
                    className={`align-top ${isAdmin ? 'cursor-pointer transition hover:bg-slate-50' : ''}`.trim()}
                    onClick={isAdmin ? () => openEdit(item) : undefined}
                    onKeyDown={
                      isAdmin
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              openEdit(item)
                            }
                          }
                        : undefined
                    }
                    tabIndex={isAdmin ? 0 : undefined}
                    role={isAdmin ? 'button' : undefined}
                    aria-label={isAdmin ? `Open ${item.name} pricing details` : undefined}
                  >
                    <td className="px-4 py-4">
                      <div className="min-w-[14rem]">
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.code ? `Code: ${item.code}` : 'No code'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{item.category.replaceAll('_', ' ')}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{item.section || '--'}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{item.specimenType || '--'}</td>
                    <td className="px-4 py-4 w-[11rem]">
                      {item.requiresVariant ? (
                        <div className="min-w-[11rem] space-y-1 text-sm">
                          <p className="font-medium text-slate-900">{variantSummary(item)}</p>
                          {item.variants?.slice(0, 3).map((variant) => (
                            <div key={String(variant.id)} className="flex items-center justify-between gap-3 text-slate-600">
                              <span>{variant.name}</span>
                              <span>{formatCurrency(variant.price, variant.currency)}</span>
                            </div>
                          ))}
                          {(item.variants?.length || 0) > 3 ? (
                            <p className="text-xs text-slate-500">More options available inside the editor.</p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-slate-900">
                          {formatCurrency(item.basePrice, item.currency)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          item.active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {item.active ? 'Active' : 'Needs review'}
                      </span>
                    </td>
                    <td className="px-4 py-4 min-w-[9rem] whitespace-nowrap">
                      {branchPricingMode ? (
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.branchPricingApplied ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.branchPricingApplied ? 'Current Branch' : 'Default'}
                        </span>
                      ) : (
                        <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          Default
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      <div className="max-w-[18rem] whitespace-pre-wrap">
                        {item.pricingNote || '--'}
                      </div>
                    </td>
                    {isAdmin ? (
                      <td className="px-4 py-4 text-right">
                        <Button
                          variant="secondary"
                          onClick={(event) => {
                            event.stopPropagation()
                            openEdit(item)
                          }}
                        >
                          {branchPricingMode ? 'Manage branch price' : 'Edit item'}
                        </Button>
                      </td>
                    ) : null}
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
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 0))}
                disabled={loading || currentPage <= 0}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                onClick={() => setCurrentPage((page) => page + 1)}
                disabled={loading || totalPages === 0 || currentPage >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Modal title={editModalTitle} open={Boolean(editItem)} onClose={closeEdit}>
        {editItem ? (
          branchPricingMode ? (
            <form className="space-y-4" onSubmit={submitEdit}>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                You can update the shared item details here and also set what <span className="font-medium text-slate-900">{selectedBranch?.name || 'this branch'}</span> should charge.
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Shared Item Details</p>
                  <p className="text-xs text-slate-500">These changes affect the item across all branches.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldBlock label="Item Name">
                    <Input value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} />
                  </FieldBlock>
                  <FieldBlock label="Category">
                    <Select
                      value={editItem.category}
                      onChange={(e) => setEditItem({ ...editItem, category: e.target.value })}
                    >
                      {itemCategoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FieldBlock>
                  <FieldBlock label="Code">
                    <Input
                      value={editItem.code || ''}
                      onChange={(e) => setEditItem({ ...editItem, code: e.target.value })}
                      placeholder="Code"
                    />
                  </FieldBlock>
                  <FieldBlock label="Section">
                    <Input
                      value={editItem.section || ''}
                      onChange={(e) => setEditItem({ ...editItem, section: e.target.value })}
                      placeholder="Section"
                    />
                  </FieldBlock>
                  <FieldBlock label="Specimen">
                    <Input
                      value={editItem.specimenType || ''}
                      onChange={(e) => setEditItem({ ...editItem, specimenType: e.target.value })}
                      placeholder="Specimen type"
                    />
                  </FieldBlock>
                  <FieldBlock label="Shared Status">
                    <Select
                      value={(editItem.defaultActive ?? true) ? 'true' : 'false'}
                      onChange={(e) => setEditItem({ ...editItem, defaultActive: e.target.value === 'true' })}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive / needs review</option>
                    </Select>
                  </FieldBlock>
                  {!editItem.requiresVariant ? (
                    <FieldBlock
                      label="Shared Default Price"
                      helper="Fallback price used when a branch has no custom override."
                    >
                      <Input
                        type="number"
                        step="0.01"
                        value={editItem.defaultBasePrice ?? ''}
                        onChange={(e) => setEditItem({ ...editItem, defaultBasePrice: Number(e.target.value) })}
                        placeholder="0.00"
                      />
                    </FieldBlock>
                  ) : null}
                  <FieldBlock label="Shared Currency">
                    <Input
                      value={editItem.defaultCurrency || editItem.currency}
                      onChange={(e) => setEditItem({ ...editItem, defaultCurrency: e.target.value.toUpperCase() })}
                      placeholder="USD"
                    />
                  </FieldBlock>
                  <FieldBlock label="Pricing Note" className="md:col-span-2">
                    <Input
                      value={editItem.pricingNote || ''}
                      onChange={(e) => setEditItem({ ...editItem, pricingNote: e.target.value })}
                      placeholder="Pricing note"
                    />
                  </FieldBlock>
                </div>
              </div>

              {!editItem.requiresVariant ? (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Current Branch Pricing</p>
                    <p className="text-xs text-slate-500">These settings apply only to {selectedBranch?.name || 'this branch'}.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <PriceMeta
                      label="Shared Default Price"
                      value={formatCurrency(editItem.defaultBasePrice ?? editItem.basePrice, editItem.defaultCurrency || editItem.currency)}
                    />
                    <FieldBlock
                      label="Branch Price"
                      helper="Enter the amount this branch should charge for this item."
                    >
                      <Input
                        type="number"
                        step="0.01"
                        value={editItem.basePrice ?? ''}
                        onChange={(e) => setEditItem({ ...editItem, basePrice: Number(e.target.value) })}
                        placeholder="0.00"
                      />
                    </FieldBlock>
                    <FieldBlock
                      label="Branch Availability"
                      helper="Choose whether this branch can use this item."
                    >
                      <Select
                        value={editItem.active ? 'true' : 'false'}
                        onChange={(e) => setEditItem({ ...editItem, active: e.target.value === 'true' })}
                      >
                        <option value="true">Ready to use</option>
                        <option value="false">Keep inactive</option>
                      </Select>
                    </FieldBlock>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Current Branch Pricing</p>
                    <p className="text-xs text-slate-500">These price options apply only to {selectedBranch?.name || 'this branch'}.</p>
                  </div>
                  <div className="rounded-2xl bg-brand-50 p-3 text-sm text-brand-800">
                    Set the branch price for each option below.
                  </div>
                  {(editItem.variants || []).map((variant, index) => (
                    <div key={String(variant.id || index)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-900">{variant.name}</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <PriceMeta
                          label="Shared Default"
                          value={formatCurrency(variant.defaultPrice ?? variant.price, variant.defaultCurrency || variant.currency)}
                        />
                        <FieldBlock label="Branch Price">
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
                            placeholder="0.00"
                          />
                        </FieldBlock>
                        <FieldBlock label="Availability">
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
                            <option value="true">Ready to use</option>
                            <option value="false">Keep inactive</option>
                          </Select>
                        </FieldBlock>
                      </div>
                    </div>
                  ))}
                  <FieldBlock
                    label="Item Availability"
                    helper="Use this if the whole item should be hidden or available for this branch."
                  >
                    <Select
                      value={editItem.active ? 'true' : 'false'}
                      onChange={(e) => setEditItem({ ...editItem, active: e.target.value === 'true' })}
                    >
                      <option value="true">Ready to use</option>
                      <option value="false">Keep inactive</option>
                    </Select>
                  </FieldBlock>
                </div>
              )}

              {editError ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{editError}</p> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeEdit} disabled={editSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editSaving}>
                  {editSaving ? 'Saving...' : 'Save item and branch pricing'}
                </Button>
              </div>
            </form>
          ) : (
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
          )
        ) : null}
      </Modal>

      <Modal title="Add Price List Item" open={createOpen} onClose={closeCreate}>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={submitCreate}>
          <div className="md:col-span-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            Add the item name first, choose how it should be priced, then finish the extra details that help staff find
            it later.
          </div>

          <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
            <FieldBlock label="Item Name" helper="Use the clinic-facing name staff should recognize immediately.">
              <Input
                value={createItem.name}
                onChange={(e) => setCreateItem({ ...createItem, name: e.target.value })}
                placeholder="e.g. Full Blood Count"
              />
            </FieldBlock>
            <FieldBlock label="Short Code" helper="Optional code used for billing sheets or printed price lists.">
              <Input
                value={createItem.code}
                onChange={(e) => setCreateItem({ ...createItem, code: e.target.value })}
                placeholder="e.g. FBC"
              />
            </FieldBlock>
            <FieldBlock label="Category" helper="Choose the closest group for this item.">
              <Select
                value={createItem.requiresVariant ? 'VARIANT_PARENT' : createItem.category}
                onChange={(e) => setCreateItem({ ...createItem, category: e.target.value })}
                disabled={createItem.requiresVariant}
              >
                {itemCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FieldBlock>
            <FieldBlock label="Section" helper="Optional department or service area such as Laboratory or Theatre.">
              <Input
                value={createItem.section}
                onChange={(e) => setCreateItem({ ...createItem, section: e.target.value })}
                placeholder="e.g. Laboratory"
              />
            </FieldBlock>
            <FieldBlock
              label="Specimen Type"
              helper="Optional sample type such as blood, urine, swab, or stool."
            >
              <Input
                value={createItem.specimenType}
                onChange={(e) => setCreateItem({ ...createItem, specimenType: e.target.value })}
                placeholder="e.g. Blood"
              />
            </FieldBlock>
            <FieldBlock label="Currency" helper="Default currency for this item.">
              <Input
                value={createItem.currency}
                onChange={(e) => setCreateItem({ ...createItem, currency: e.target.value.toUpperCase() })}
                placeholder="USD"
              />
            </FieldBlock>
          </div>

          <div className="md:col-span-2 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
            <FieldBlock label="Pricing Style" helper="Choose whether the item has one price or multiple price options.">
              <Select
                value={createItem.requiresVariant ? 'variant' : 'single'}
                onChange={(e) =>
                  setCreateItem({
                    ...createItem,
                    requiresVariant: e.target.value === 'variant',
                    category: e.target.value === 'variant' ? 'VARIANT_PARENT' : createItem.category || 'TEST',
                    basePrice: e.target.value === 'variant' ? '' : createItem.basePrice,
                    variants:
                      e.target.value === 'variant'
                        ? createItem.variants.length > 0
                          ? createItem.variants
                          : [createEmptyVariantDraft()]
                        : [],
                  })
                }
              >
                <option value="single">One price</option>
                <option value="variant">Multiple price options</option>
              </Select>
            </FieldBlock>
            <FieldBlock label="Availability" helper="Set whether staff can use this item immediately.">
              <Select
                value={createItem.active ? 'true' : 'false'}
                onChange={(e) => setCreateItem({ ...createItem, active: e.target.value === 'true' })}
              >
                <option value="true">Ready to use</option>
                <option value="false">Keep inactive for now</option>
              </Select>
            </FieldBlock>

            {!createItem.requiresVariant ? (
              <FieldBlock
                label="Price"
                helper="Enter the amount staff should charge for this item."
                className="md:col-span-2"
              >
                <Input
                  type="number"
                  step="0.01"
                  value={createItem.basePrice}
                  onChange={(e) => setCreateItem({ ...createItem, basePrice: e.target.value })}
                  placeholder="0.00"
                />
              </FieldBlock>
            ) : (
              <div className="md:col-span-2 rounded-2xl bg-brand-50 p-3 text-sm text-brand-800">
                This item will be saved with multiple price options. Add each option below.
              </div>
            )}
          </div>

          <FieldBlock
            label="Source Reference"
            helper="Optional source note such as supplier sheet, approved tariff, or memo."
            className={createItem.requiresVariant ? '' : 'md:col-span-2'}
          >
            <Input
              value={createItem.sourceReference}
              onChange={(e) => setCreateItem({ ...createItem, sourceReference: e.target.value })}
              placeholder="Optional"
            />
          </FieldBlock>
          <FieldBlock
            label="Pricing Note"
            helper="Optional reminder for staff, such as packaging rules or what is included."
            className="md:col-span-2"
          >
            <Input
              value={createItem.pricingNote}
              onChange={(e) => setCreateItem({ ...createItem, pricingNote: e.target.value })}
              placeholder="Optional"
            />
          </FieldBlock>

          {createItem.requiresVariant ? (
            <div className="md:col-span-2 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">Price options</p>
                  <p className="text-xs text-slate-500">Add each option name, display order, and price.</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setCreateItem({
                      ...createItem,
                      variants: [...createItem.variants, createEmptyVariantDraft(createItem.variants.length)],
                    })
                  }
                >
                  Add price option
                </Button>
              </div>

              {createItem.variants.map((variant, index) => (
                <div key={`${variant.name}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">Option {index + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setCreateItem({
                          ...createItem,
                          variants: createItem.variants.filter((_, existingIndex) => existingIndex !== index),
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <FieldBlock label="Option Name" className="xl:col-span-1">
                      <Input
                        value={variant.name}
                        onChange={(e) =>
                          setCreateItem({
                            ...createItem,
                            variants: createItem.variants.map((existing, existingIndex) =>
                              existingIndex === index ? { ...existing, name: e.target.value } : existing,
                            ),
                          })
                        }
                        placeholder="e.g. Adult"
                      />
                    </FieldBlock>
                    <FieldBlock label="Display Order">
                      <Input
                        type="number"
                        step="1"
                        value={variant.displayOrder}
                        onChange={(e) =>
                          setCreateItem({
                            ...createItem,
                            variants: createItem.variants.map((existing, existingIndex) =>
                              existingIndex === index ? { ...existing, displayOrder: e.target.value } : existing,
                            ),
                          })
                        }
                        placeholder="0"
                      />
                    </FieldBlock>
                    <FieldBlock label="Price">
                      <Input
                        type="number"
                        step="0.01"
                        value={variant.price}
                        onChange={(e) =>
                          setCreateItem({
                            ...createItem,
                            variants: createItem.variants.map((existing, existingIndex) =>
                              existingIndex === index ? { ...existing, price: e.target.value } : existing,
                            ),
                          })
                        }
                        placeholder="0.00"
                      />
                    </FieldBlock>
                    <FieldBlock label="Availability">
                      <Select
                        value={variant.active ? 'true' : 'false'}
                        onChange={(e) =>
                          setCreateItem({
                            ...createItem,
                            variants: createItem.variants.map((existing, existingIndex) =>
                              existingIndex === index ? { ...existing, active: e.target.value === 'true' } : existing,
                            ),
                          })
                        }
                      >
                        <option value="true">Ready to use</option>
                        <option value="false">Keep inactive</option>
                      </Select>
                    </FieldBlock>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {createError ? <p className="md:col-span-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{createError}</p> : null}
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeCreate} disabled={createSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={createSaving}>
              {createSaving ? 'Saving...' : 'Add item'}
            </Button>
          </div>
        </form>
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

function FieldBlock({
  label,
  helper,
  className = '',
  children,
}: {
  label: string
  helper?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={`space-y-2 ${className}`.trim()}>
      <div className="space-y-1">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {helper ? <p className="text-xs text-slate-500">{helper}</p> : null}
      </div>
      {children}
    </label>
  )
}

function variantSummary(item: PriceListItem) {
  if (!item.variants || item.variants.length === 0) return 'Variant required'
  const activeVariants = item.variants.filter((variant) => variant.active)
  if (activeVariants.length === 0) return 'No active variants'
  const lowest = Math.min(...activeVariants.map((variant) => variant.price))
  return `From ${formatCurrency(lowest, activeVariants[0]?.currency || item.currency)}`
}

function createEmptyPriceListItemDraft(): PriceListItemDraft {
  return {
    name: '',
    code: '',
    category: 'TEST',
    section: '',
    specimenType: '',
    basePrice: '',
    currency: 'USD',
    pricingNote: '',
    requiresVariant: false,
    active: true,
    sourceReference: '',
    variants: [],
  }
}

function createEmptyVariantDraft(displayOrder = 0): PriceListVariantDraft {
  return {
    name: '',
    displayOrder: String(displayOrder),
    price: '',
    currency: 'USD',
    active: true,
  }
}

function buildPriceListPayload(item: PriceListItemDraft) {
  return {
    name: item.name.trim(),
    code: normalizeOptional(item.code),
    category: item.category,
    section: normalizeOptional(item.section),
    specimenType: normalizeOptional(item.specimenType),
    basePrice: item.requiresVariant ? undefined : toOptionalNumber(item.basePrice),
    currency: normalizeOptional(item.currency) || 'USD',
    pricingNote: normalizeOptional(item.pricingNote),
    requiresVariant: item.requiresVariant,
    active: item.active,
    sourceReference: normalizeOptional(item.sourceReference),
    variants: item.requiresVariant
      ? item.variants.map((variant, index) => ({
          name: variant.name.trim(),
          displayOrder: toOptionalInteger(variant.displayOrder) ?? index,
          price: toOptionalNumber(variant.price),
          currency: normalizeOptional(variant.currency) || normalizeOptional(item.currency) || 'USD',
          active: variant.active,
        }))
      : [],
  }
}

function buildSharedItemPayloadFromBranchScopedItem(item: PriceListItem) {
  return {
    name: item.name,
    code: item.code,
    category: item.category,
    section: item.section,
    specimenType: item.specimenType,
    basePrice: item.requiresVariant ? undefined : item.defaultBasePrice ?? item.basePrice,
    currency: item.defaultCurrency || item.currency,
    pricingNote: item.pricingNote,
    requiresVariant: item.requiresVariant,
    active: item.defaultActive ?? true,
    sourceReference: undefined,
    variants: (item.variants || []).map((variant) => ({
      name: variant.name,
      displayOrder: variant.displayOrder,
      price: variant.defaultPrice ?? variant.price,
      currency: variant.defaultCurrency || variant.currency,
      active: variant.defaultActive ?? variant.active,
    })),
  }
}

function normalizeOptional(value: string) {
  const normalized = value.trim()
  return normalized ? normalized : undefined
}

function toOptionalNumber(value: string) {
  const normalized = value.trim()
  if (!normalized) return undefined
  return Number(normalized)
}

function toOptionalInteger(value: string) {
  const normalized = value.trim()
  if (!normalized) return undefined
  return Number.parseInt(normalized, 10)
}
