export const toDate = (value?: string): string => {
  if (!value) return '--'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString()
}

export const toDateTime = (value?: string): string => {
  if (!value) return '--'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

export const formatCurrency = (value?: number | null, currency = 'USD'): string => {
  if (value == null || Number.isNaN(value)) return '--'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export const patientDisplayName = (name?: string, surname?: string, fullName?: string): string =>
  fullName || [name, surname].filter(Boolean).join(' ') || 'Unknown Patient'
