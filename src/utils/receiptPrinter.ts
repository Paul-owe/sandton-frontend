import { getQzPrintConfig, signQzPrintRequest, type QzPrintConfig } from '../api/printingApi'
import type { Invoice, InvoiceLine, Receipt, ReceiptAllocation } from '../types/invoice'
import { formatCurrency, toDateTime } from './format'
import {
  getStoredReceiptPrinterName,
  getStoredReceiptPrinterPaperWidth,
  getStoredReceiptPrinterProfile,
  type ReceiptPrinterPaperWidth,
  type ReceiptPrinterProfile,
} from './runtimeConfig'

type QzTrayModule = {
  websocket: {
    connect: (options?: Record<string, unknown>) => Promise<void>
    disconnect: () => Promise<void>
    isActive?: () => boolean | Promise<boolean>
  }
  printers: {
    find: (query?: string) => Promise<string[] | string>
  }
  configs: {
    create: (printer: string, options?: Record<string, unknown>) => unknown
  }
  print: (config: unknown, data: Array<Record<string, unknown> | string>) => Promise<void>
  security?: {
    setCertificatePromise?: (fn: () => Promise<string> | string) => void
    setSignaturePromise?: (fn: (request: string) => Promise<string>) => void
    setSignatureAlgorithm?: (algorithm: string) => void
  }
}

type ThermalReceiptRow = {
  amount: string
  label: string
}

const THERMAL_58MM_COLUMNS = 32
const THERMAL_58MM_ITEM_LABEL_COLUMNS = 21
const THERMAL_58MM_ITEM_AMOUNT_COLUMNS = THERMAL_58MM_COLUMNS - THERMAL_58MM_ITEM_LABEL_COLUMNS
const ESC = '\x1B'
const GS = '\x1D'
const LF = '\n'
const QZ_CONFIG_CACHE_TTL_MS = 15_000

let cachedQzConfig: { expiresAt: number; value: QzPrintConfig } | null = null

async function loadQzTray(): Promise<QzTrayModule> {
  const qzModule = await import('qz-tray')
  return (qzModule.default || qzModule) as QzTrayModule
}

function resetCachedQzPrintConfig() {
  cachedQzConfig = null
}

async function getCachedQzPrintConfig(options?: { forceRefresh?: boolean }) {
  const forceRefresh = Boolean(options?.forceRefresh)
  if (!forceRefresh && cachedQzConfig && cachedQzConfig.expiresAt > Date.now()) {
    return cachedQzConfig.value
  }

  try {
    const config = await getQzPrintConfig()
    cachedQzConfig = {
      expiresAt: Date.now() + QZ_CONFIG_CACHE_TTL_MS,
      value: config,
    }
    return config
  } catch {
    resetCachedQzPrintConfig()
    return { signingEnabled: false, certificate: null }
  }
}

async function configureQzSecurity(qz: QzTrayModule) {
  const config = await getCachedQzPrintConfig({ forceRefresh: true })
  if (!config.signingEnabled || !config.certificate || !qz.security) return

  qz.security.setCertificatePromise?.(() => Promise.resolve(config.certificate || ''))
  qz.security.setSignatureAlgorithm?.('SHA512')
  qz.security.setSignaturePromise?.(async (request) => {
    try {
      return await signQzPrintRequest(request)
    } catch (error) {
      resetCachedQzPrintConfig()
      throw error
    }
  })
}

async function withQzConnection<T>(run: (qz: QzTrayModule) => Promise<T>) {
  const qz = await loadQzTray()
  await configureQzSecurity(qz)

  const alreadyActive = Boolean(await Promise.resolve(qz.websocket.isActive?.() || false))
  if (!alreadyActive) {
    await qz.websocket.connect({ retries: 2, delay: 1 })
  }

  try {
    return await run(qz)
  } finally {
    if (!alreadyActive) {
      await qz.websocket.disconnect().catch(() => undefined)
    }
  }
}

function normalizePrinterList(value: string[] | string) {
  if (Array.isArray(value)) return value.map((entry) => String(entry || '').trim()).filter(Boolean)
  const single = String(value || '').trim()
  return single ? [single] : []
}

function isDirectReceiptPrinterProfile(profile: ReceiptPrinterProfile) {
  return profile === 'thermal-58mm-escpos'
}

function resolveStoredDirectPrinterProfile() {
  return getStoredReceiptPrinterProfile()
}

export async function listAvailableReceiptPrinters(): Promise<string[]> {
  return withQzConnection(async (qz) => {
    const printers = await qz.printers.find()
    return normalizePrinterList(printers)
  })
}

export async function getReceiptPrinterSupport() {
  const config = await getCachedQzPrintConfig({ forceRefresh: true })
  return {
    signingEnabled: Boolean(config.signingEnabled && config.certificate),
  }
}

export type ReceiptPrinterDiagnostics = {
  qzConnected: boolean
  signingEnabled: boolean
  configuredPrinterName: string
  configuredPrinterProfile: ReceiptPrinterProfile
  paperWidth: ReceiptPrinterPaperWidth
  printerFound: boolean
  resolvedPrinterName: string
  availablePrinterCount: number
}

export async function getReceiptPrinterDiagnostics(printerName = getStoredReceiptPrinterName()): Promise<ReceiptPrinterDiagnostics> {
  const support = await getReceiptPrinterSupport()
  const configuredPrinterName = String(printerName || '').trim()
  const configuredPrinterProfile = resolveStoredDirectPrinterProfile()
  const paperWidth = getStoredReceiptPrinterPaperWidth()

  try {
    return await withQzConnection(async (qz) => {
      const availablePrinters = normalizePrinterList(await qz.printers.find())
      const resolvedMatch = configuredPrinterName
        ? availablePrinters.find((entry) => entry.toLowerCase() === configuredPrinterName.toLowerCase()) ||
          availablePrinters.find((entry) => entry.toLowerCase().includes(configuredPrinterName.toLowerCase()))
        : ''

      return {
        qzConnected: true,
        signingEnabled: support.signingEnabled,
        configuredPrinterName,
        configuredPrinterProfile,
        paperWidth,
        printerFound: Boolean(resolvedMatch),
        resolvedPrinterName: resolvedMatch || '',
        availablePrinterCount: availablePrinters.length,
      }
    })
  } catch {
    return {
      qzConnected: false,
      signingEnabled: support.signingEnabled,
      configuredPrinterName,
      configuredPrinterProfile,
      paperWidth,
      printerFound: false,
      resolvedPrinterName: '',
      availablePrinterCount: 0,
    }
  }
}

export function shouldUseDirectReceiptPrinting() {
  return isDirectReceiptPrinterProfile(resolveStoredDirectPrinterProfile())
}

export async function printReceiptDirect(invoice: Invoice, receipt: Receipt) {
  const printerName = getStoredReceiptPrinterName()
  const printerProfile = resolveStoredDirectPrinterProfile()
  if (!printerName) {
    throw new Error('Select and save a receipt printer in Settings before using direct POS printing.')
  }
  if (!isDirectReceiptPrinterProfile(printerProfile)) {
    throw new Error('Direct receipt printing is disabled. Enable the 58mm thermal profile in Settings first.')
  }

  return printReceiptRawDirect(
    buildEscPosReceiptDocument(invoice, receipt),
    printerName,
    `Receipt ${receipt.receiptNumber || invoice.invoiceNumber || receipt.id || invoice.id || 'print'}`,
  )
}

export async function printTestReceiptDirect() {
  const printerName = getStoredReceiptPrinterName()
  const printerProfile = resolveStoredDirectPrinterProfile()
  if (!printerName) {
    throw new Error('Select and save a receipt printer in Settings before printing a test receipt.')
  }
  if (!isDirectReceiptPrinterProfile(printerProfile)) {
    throw new Error('Enable the 58mm thermal printer profile in Settings before printing a test receipt.')
  }

  const { invoice, receipt } = buildTestReceiptFixture()
  return printReceiptRawDirect(
    buildEscPosReceiptDocument(invoice, receipt),
    printerName,
    `Receipt Test ${receipt.receiptNumber || 'print'}`,
  )
}

async function printReceiptRawDirect(data: string, printerName: string, jobName: string) {
  return withQzConnection(async (qz) => {
    const resolvedPrinter = await qz.printers.find(printerName)
    const printer = normalizePrinterList(resolvedPrinter)[0] || printerName
    const config = qz.configs.create(printer, {
      encoding: 'CP437',
      jobName,
    })

    await qz.print(config, [data])
  })
}

function buildEscPosReceiptDocument(invoice: Invoice, receipt: Receipt) {
  let output = ''
  const contactLines = [
    invoice.branchName || 'Sandton Main Branch',
    invoice.branchPhone || '+0000000001',
    'Sandton24clinic@gmail.com',
  ].filter(Boolean)
  const receiptNumber = receipt.receiptNumber || invoice.invoiceNumber || String(receipt.id || invoice.id || '--')
  const invoiceNumber = invoice.invoiceNumber || String(invoice.id || '--')
  const statusLabel = formatStatusLabel(receipt.status || invoice.status)
  const printedAt = toDateTime(receipt.issuedAt || invoice.issuedAt)
  const currency = receipt.currency || invoice.currency || 'USD'
  const detailRows = buildThermalReceiptRows(invoice, receipt)
  const noteLines = wrapTextForWidth(receipt.notes || '', THERMAL_58MM_COLUMNS)

  const appendCommand = (...commands: string[]) => {
    output += commands.join('')
  }
  const appendLines = (...lines: string[]) => {
    output += `${lines.join(LF)}${LF}`
  }

  appendCommand(initializePrinter(), selectCodePage(), setAlignCenter(), setBold(true))
  appendLines(...contactLines.map((line) => renderCenteredLine(line)))
  appendCommand(setBold(false))
  appendLines(renderDivider())
  appendCommand(setBold(true))
  appendLines(renderCenteredLine('RECEIPT'))
  appendCommand(setBold(false))
  appendLines(renderCenteredLine(receiptNumber), renderDivider())
  appendCommand(setAlignLeft())
  appendLines(...renderLabelValueLines('Date', printedAt))
  appendLines(...renderLabelValueLines('Receipt No', receiptNumber))
  appendLines(...renderLabelValueLines('Invoice No', invoiceNumber))
  appendLines(...renderLabelValueLines('Patient', invoice.patientName || '--'))
  appendLines(...renderLabelValueLines('File No', invoice.patientFileNumber || '--'))
  appendLines(...renderLabelValueLines('Status', statusLabel))
  if (receipt.createdByName) {
    appendLines(...renderLabelValueLines('Cashier', receipt.createdByName))
  }
  appendLines(renderDivider(), renderColumnsHeader('Item', 'Amount'), renderDivider())
  appendLines(...detailRows.flatMap((row) => renderAmountRow(row.label, row.amount)))
  appendLines(renderDivider())
  appendLines(...renderSummaryRow('Total Received', formatCurrency(receipt.totalAmount, currency)))
  appendLines(...renderSummaryRow('Invoice Total', formatCurrency(invoice.totalAmount, invoice.currency || currency)))
  appendLines(...renderSummaryRow('Amount Paid', formatCurrency(invoice.amountPaid, invoice.currency || currency)))
  appendLines(...renderSummaryRow('Balance', formatCurrency(invoice.balanceAmount, invoice.currency || currency)))
  if (noteLines.length > 0) {
    appendLines(renderDivider())
    appendCommand(setBold(true))
    appendLines('Notes')
    appendCommand(setBold(false))
    appendLines(...noteLines)
  }
  appendLines(renderDivider())
  appendCommand(setAlignCenter(), setBold(true))
  appendLines(renderCenteredLine('Thank you for choosing'), renderCenteredLine('Sandton 24 Clinic.'))
  appendCommand(setBold(false))
  appendLines(
    renderCenteredLine('Your health is our priority.'),
    renderCenteredLine('Compassionate care.'),
    renderCenteredLine('Personalized for you.'),
  )
  appendCommand(feedPaper(4), cutPaper())

  return output
}

function buildThermalReceiptRows(invoice: Invoice, receipt: Receipt): ThermalReceiptRow[] {
  const allocationRows = (receipt.allocations || [])
    .map((allocation) => buildAllocationRow(allocation, receipt.currency || invoice.currency || 'USD'))
    .filter((row): row is ThermalReceiptRow => Boolean(row))

  if (allocationRows.length > 0) {
    return allocationRows
  }

  return (invoice.lines || []).map((line) => buildInvoiceLineRow(line, invoice.currency || 'USD'))
}

function buildAllocationRow(allocation: ReceiptAllocation, currency: string): ThermalReceiptRow | null {
  const labelParts = [allocation.itemName || 'Payment']
  if (allocation.variantName) {
    labelParts.push(allocation.variantName)
  }

  const amount = formatCurrency(allocation.amountApplied, allocation.currency || currency)
  return {
    amount,
    label: labelParts.join(' - '),
  }
}

function buildInvoiceLineRow(line: InvoiceLine, currency: string): ThermalReceiptRow {
  const labelParts = [line.itemName || '--']
  if (line.variantName) {
    labelParts.push(line.variantName)
  }
  if (line.itemCode) {
    labelParts.push(`Code: ${line.itemCode}`)
  }
  if ((line.quantity || 1) > 1) {
    labelParts.push(`Qty ${line.quantity || 1}`)
  }

  return {
    amount: formatCurrency(line.lineTotal, line.currency || currency),
    label: labelParts.join(' | '),
  }
}

function initializePrinter() {
  return `${ESC}@`
}

function selectCodePage() {
  return `${ESC}t${String.fromCharCode(0)}${ESC}M${String.fromCharCode(0)}`
}

function setAlignLeft() {
  return `${ESC}a${String.fromCharCode(0)}`
}

function setAlignCenter() {
  return `${ESC}a${String.fromCharCode(1)}`
}

function setBold(enabled: boolean) {
  return `${ESC}E${String.fromCharCode(enabled ? 1 : 0)}`
}

function feedPaper(lines: number) {
  return LF.repeat(Math.max(0, lines))
}

function cutPaper() {
  return `${GS}V${String.fromCharCode(0)}`
}

function renderDivider() {
  return '-'.repeat(THERMAL_58MM_COLUMNS)
}

function renderCenteredLine(value: string) {
  return centerText(sanitizeForEscPos(value), THERMAL_58MM_COLUMNS)
}

function renderColumnsHeader(left: string, right: string) {
  return `${padRight(sanitizeForEscPos(left), THERMAL_58MM_ITEM_LABEL_COLUMNS)}${padLeft(
    sanitizeForEscPos(right),
    THERMAL_58MM_ITEM_AMOUNT_COLUMNS,
  )}`
}

function renderAmountRow(label: string, amount: string) {
  const safeAmount = sanitizeForEscPos(amount)
  const safeLabelLines = wrapTextForWidth(label, THERMAL_58MM_ITEM_LABEL_COLUMNS)

  return safeLabelLines.map((entry, index) => {
    const amountColumn = index === 0 ? padLeft(safeAmount, THERMAL_58MM_ITEM_AMOUNT_COLUMNS) : ' '.repeat(THERMAL_58MM_ITEM_AMOUNT_COLUMNS)
    return `${padRight(entry, THERMAL_58MM_ITEM_LABEL_COLUMNS)}${amountColumn}`
  })
}

function renderSummaryRow(label: string, value: string) {
  return renderLabelValueLines(label, value)
}

function renderLabelValueLines(label: string, value: string) {
  const safeLabel = sanitizeForEscPos(label)
  const safeValue = sanitizeForEscPos(value || '--')
  const basePrefix = `${safeLabel}: `
  const maxInlineValueWidth = THERMAL_58MM_COLUMNS - basePrefix.length

  if (safeValue.length <= maxInlineValueWidth) {
    return [`${basePrefix}${safeValue}`]
  }

  const firstLine = safeValue.slice(0, maxInlineValueWidth).trimEnd()
  const remainder = safeValue.slice(firstLine.length).trim()
  const wrappedRemainder = wrapTextForWidth(remainder, THERMAL_58MM_COLUMNS)
  return [`${basePrefix}${firstLine}`].concat(wrappedRemainder)
}

function wrapTextForWidth(value: string, width: number) {
  const safeValue = sanitizeForEscPos(value)
  if (!safeValue) return []
  const words = safeValue.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if (word.length > width) {
      if (currentLine) {
        lines.push(currentLine)
        currentLine = ''
      }
      splitLongWord(word, width).forEach((segment) => lines.push(segment))
      continue
    }

    const candidate = currentLine ? `${currentLine} ${word}` : word
    if (candidate.length <= width) {
      currentLine = candidate
      continue
    }

    if (currentLine) {
      lines.push(currentLine)
    }
    currentLine = word
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

function splitLongWord(value: string, width: number) {
  const segments: string[] = []
  for (let index = 0; index < value.length; index += width) {
    segments.push(value.slice(index, index + width))
  }
  return segments
}

function centerText(value: string, width: number) {
  if (value.length >= width) return value.slice(0, width)
  const totalPadding = width - value.length
  const leftPadding = Math.floor(totalPadding / 2)
  const rightPadding = totalPadding - leftPadding
  return `${' '.repeat(leftPadding)}${value}${' '.repeat(rightPadding)}`
}

function padLeft(value: string, width: number) {
  if (value.length >= width) return value.slice(0, width)
  return `${' '.repeat(width - value.length)}${value}`
}

function padRight(value: string, width: number) {
  if (value.length >= width) return value.slice(0, width)
  return `${value}${' '.repeat(width - value.length)}`
}

function sanitizeForEscPos(value: string) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
}

function formatStatusLabel(status?: string | null) {
  const normalized = String(status || '').trim().toUpperCase()
  if (!normalized) return '--'
  return normalized.replaceAll('_', ' ')
}

function buildTestReceiptFixture(): { invoice: Invoice; receipt: Receipt } {
  const issuedAt = new Date().toISOString()
  const invoice: Invoice = {
    id: 'test-receipt',
    invoiceNumber: 'TEST-INV-001',
    patientName: 'Printer Test',
    patientFileNumber: 'TEST-001',
    branchName: 'Sandton Main Branch',
    branchPhone: '+0000000001',
    currency: 'USD',
    status: 'PAID',
    totalAmount: 12.5,
    amountPaid: 12.5,
    balanceAmount: 0,
    issuedAt,
    createdAt: issuedAt,
    lines: [
      {
        id: 'line-1',
        itemName: 'Receipt Printer Test',
        itemCode: 'TEST',
        quantity: 1,
        lineTotal: 12.5,
        currency: 'USD',
        status: 'PAID',
      },
    ],
    receipts: [],
  }

  const receipt: Receipt = {
    id: 'test-receipt-001',
    receiptNumber: 'TEST-RCP-001',
    status: 'FINAL',
    totalAmount: 12.5,
    currency: 'USD',
    issuedAt,
    createdAt: issuedAt,
    createdByName: 'System Test',
    allocations: [
      {
        id: 'alloc-1',
        invoiceLineId: 'line-1',
        itemName: 'Receipt Printer Test',
        amountApplied: 12.5,
        currency: 'USD',
      },
    ],
  }

  invoice.receipts = [receipt]
  return { invoice, receipt }
}
