import sandtonLogoUrl from '../assets/sandton-logo.svg'
import type { Invoice, InvoiceLine, Receipt } from '../types/invoice'

const CLINIC_EMAIL = 'Sandton24clinic@gmail.com'
const DEFAULT_CONTACT_NUMBER = '+0000000001'
const PRIMARY_NAVY = '#061B2E'
const MEDICAL_BLUE = '#0B70C9'
const DIVIDER_BLUE = '#D7E8F8'
const MUTED_TEXT = '#667085'
const SOFT_TEXT = '#344054'
const PAGE_BACKGROUND = '#F4F8FC'
const A4_LOGO_PUBLIC_PATH = '/brand/sandton24-logo.png'

export function buildInvoiceDocumentHtml(invoice: Invoice, autoPrint = false) {
  return buildDocumentHtml({
    autoPrint,
    body: buildA4InvoiceTemplate(invoice),
    layout: 'a4',
    title: `Invoice ${invoice.invoiceNumber || invoice.id}`,
  })
}

export function buildReceiptDocumentHtml(invoice: Invoice, receipt: Receipt | null, autoPrint = false) {
  if (!receipt) return ''

  return buildDocumentHtml({
    autoPrint,
    body: buildReceipt80mmTemplate(invoice, receipt),
    layout: 'receipt',
    title: `Receipt ${receipt.receiptNumber || invoice.invoiceNumber || receipt.id || invoice.id}`,
  })
}

function buildA4InvoiceTemplate(invoice: Invoice) {
  const generatedAt = formatPrintTimestamp(new Date())
  const invoiceNumber = escapeHtml(resolveInvoiceNumber(invoice))
  const issuedAt = escapeHtml(formatDocumentDateTime(invoice.issuedAt))
  const patientLine = escapeHtml(buildPatientLine(invoice))
  const status = escapeHtml(formatStatusLabel(invoice.status))
  const visitDate = escapeHtml(formatDocumentDate(invoice.doctorNoteVisitDate))
  const footerReference = escapeHtml(buildFooterReference(invoice))

  return `
    <div class="invoice-a4-page">
      <div class="invoice-a4-inner">
        <header class="invoice-a4-topbar">
          <div class="invoice-a4-topbar__left">${escapeHtml(generatedAt)}</div>
          <div class="invoice-a4-topbar__center">Invoice No: ${invoiceNumber}</div>
          <div class="invoice-a4-topbar__right">${buildHeartbeatAccent('a4')}</div>
        </header>

        <section class="invoice-a4-header">
          <div class="invoice-a4-brand">
            ${buildA4LogoImage()}
          </div>
          <div class="invoice-a4-contact">
            <p class="invoice-a4-contact__branch">${escapeHtml(invoice.branchName || 'Sandton Main Branch')}</p>
            <p>${escapeHtml(invoice.branchPhone || DEFAULT_CONTACT_NUMBER)}</p>
            <p>${escapeHtml(CLINIC_EMAIL)}</p>
            <p>${escapeHtml(resolveBranchLocation(invoice))}</p>
          </div>
        </section>

        <section class="invoice-a4-title">
          <h1>Invoice</h1>
        </section>

        <section class="invoice-a4-meta">
          <p><span>Invoice No:</span> ${invoiceNumber}</p>
          <p><span>Issued:</span> ${issuedAt}</p>
          <p><span>Patient:</span> ${patientLine}</p>
        </section>

        <section class="invoice-a4-status">
          <p><span>Status:</span> <strong class="${getStatusClass(invoice.status)}">${status}</strong></p>
          <p><span>Visit Date:</span> ${visitDate}</p>
        </section>

        <section class="invoice-a4-table-wrap">
          <table class="invoice-a4-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${(invoice.lines || []).map((line) => buildA4LineRow(line, invoice.currency)).join('')}
            </tbody>
          </table>
        </section>

        <section class="invoice-a4-totals">
          <div class="invoice-a4-totals__panel">
            <p><span>Invoice Total</span><strong>${escapeHtml(formatDocumentCurrency(invoice.totalAmount, invoice.currency))}</strong></p>
            <p><span>Amount Paid</span><strong>${escapeHtml(formatDocumentCurrency(invoice.amountPaid, invoice.currency))}</strong></p>
            <p class="invoice-a4-totals__balance"><span>Outstanding Balance</span><strong>${escapeHtml(formatDocumentCurrency(invoice.balanceAmount, invoice.currency))}</strong></p>
          </div>
        </section>

        <footer class="invoice-a4-footer">
          <div class="invoice-a4-footer__line">
            <span>${footerReference}</span>
            <span>${buildHeartbeatAccent('footer')}</span>
          </div>
          <div class="invoice-a4-footer__bottom">
            <span>${escapeHtml('Sandton 24 Clinic Billing System')}</span>
            <span>1/1</span>
          </div>
        </footer>
      </div>
    </div>
  `
}

function buildReceipt80mmTemplate(invoice: Invoice, receipt: Receipt) {
  const receiptNumber = escapeHtml(receipt.receiptNumber || resolveInvoiceNumber(invoice))
  const issuedAt = escapeHtml(formatDocumentDateTime(receipt.issuedAt || invoice.issuedAt))
  const patientName = escapeHtml(invoice.patientName || '--')
  const fileNumber = escapeHtml(invoice.patientFileNumber || '--')
  const status = escapeHtml(formatStatusLabel(receipt.status || invoice.status))

  return `
    <div class="receipt-80mm-page">
      <div class="receipt-80mm-inner">
        <div class="receipt-80mm-logo">
          ${buildSandtonClinicLogo('receipt')}
        </div>

        <div class="receipt-80mm-divider receipt-80mm-divider--dashed"></div>

        <section class="receipt-80mm-contact">
          <p class="receipt-80mm-contact__branch">${escapeHtml(invoice.branchName || 'Sandton Main Branch')}</p>
          <p>${escapeHtml(invoice.branchPhone || DEFAULT_CONTACT_NUMBER)}</p>
          <p class="receipt-80mm-break">${escapeHtml(CLINIC_EMAIL)}</p>
        </section>

        <div class="receipt-80mm-divider"></div>

        <section class="receipt-80mm-title">
          <h1>RECEIPT</h1>
          <p class="receipt-80mm-number">${receiptNumber}</p>
        </section>

        <section class="receipt-80mm-meta">
          ${buildReceiptMetaRow('Date', issuedAt)}
          ${buildReceiptMetaRow('Patient', patientName)}
          ${buildReceiptMetaRow('File No', fileNumber)}
          ${buildReceiptMetaRow('Status', `<span class="${getStatusClass(receipt.status || invoice.status)}">${status}</span>`)}
        </section>

        <div class="receipt-80mm-divider receipt-80mm-divider--dashed"></div>

        <section class="receipt-80mm-items">
          <div class="receipt-80mm-items__head">
            <span>Item</span>
            <span>Qty</span>
            <span>Price</span>
          </div>
          ${(invoice.lines || []).map((line) => buildReceiptLineRow(line, invoice.currency)).join('')}
        </section>

        <div class="receipt-80mm-divider"></div>

        <section class="receipt-80mm-totals">
          ${buildReceiptTotalRow('Total', formatDocumentCurrency(invoice.totalAmount, invoice.currency))}
          ${buildReceiptTotalRow('Paid', formatDocumentCurrency(invoice.amountPaid, invoice.currency))}
          ${buildReceiptTotalRow('Balance', formatDocumentCurrency(invoice.balanceAmount, invoice.currency), true)}
        </section>

        <div class="receipt-80mm-divider"></div>

        <section class="receipt-80mm-thanks">
          <p class="receipt-80mm-thanks__headline">Thank you for choosing Sandton 24 Clinic.</p>
          <p>Your health is our priority.</p>
          <p>We appreciate your trust in us.</p>
        </section>

        <div class="receipt-80mm-divider receipt-80mm-divider--dashed"></div>

        <footer class="receipt-80mm-footer">
          <p>Compassionate care. Personalized for you.</p>
          <p>1/1</p>
        </footer>
      </div>
    </div>
  `
}

function buildA4LineRow(line: InvoiceLine, invoiceCurrency?: string | null) {
  return `
    <tr>
      <td>${escapeHtml(buildInvoiceLineLabel(line))}</td>
      <td>${escapeHtml(String(line.quantity || 1))}</td>
      <td><span class="${getStatusClass(line.status)}">${escapeHtml(formatStatusLabel(line.status))}</span></td>
      <td>${escapeHtml(formatDocumentCurrency(line.lineTotal, line.currency || invoiceCurrency))}</td>
    </tr>
  `
}

function buildReceiptLineRow(line: InvoiceLine, invoiceCurrency?: string | null) {
  return `
    <div class="receipt-80mm-item">
      <div class="receipt-80mm-item__main">
        <p class="receipt-80mm-item__name">${escapeHtml(line.itemName || '--')}</p>
        <p class="receipt-80mm-item__code">${escapeHtml(buildItemCodeLabel(line))}</p>
      </div>
      <div class="receipt-80mm-item__qty">${escapeHtml(String(line.quantity || 1))}</div>
      <div class="receipt-80mm-item__price">${escapeHtml(formatDocumentCurrency(line.lineTotal, line.currency || invoiceCurrency))}</div>
    </div>
  `
}

function buildReceiptMetaRow(label: string, value: string) {
  return `
    <div class="receipt-80mm-meta__row">
      <span>${escapeHtml(label)}:</span>
      <span>${value}</span>
    </div>
  `
}

function buildReceiptTotalRow(label: string, value: string, balance = false) {
  return `
    <div class="receipt-80mm-total${balance ? ' receipt-80mm-total--balance' : ''}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `
}

function buildA4LogoImage() {
  return `
    <img
      src="${escapeHtml(resolveDocumentAssetUrl(A4_LOGO_PUBLIC_PATH))}"
      alt="Sandton 24 Clinic"
      class="invoice-a4-logo"
    />
  `
}

function buildSandtonClinicLogo(size: 'a4' | 'receipt') {
  const logoWidthClass = size === 'a4' ? 'sandton-logo--a4' : 'sandton-logo--receipt'
  return `
    <div class="sandton-logo ${logoWidthClass}">
      <img src="${escapeHtml(sandtonLogoUrl)}" alt="Sandton 24 Clinic symbol" class="sandton-logo__icon" />
      <div class="sandton-logo__wordmark">SANDTON 24</div>
      <div class="sandton-logo__clinic">
        <span class="sandton-logo__line"></span>
        <span>CLINIC</span>
        <span class="sandton-logo__line"></span>
      </div>
      <div class="sandton-logo__tagline">Compassionate &amp; Personalized Care</div>
    </div>
  `
}

function buildDocumentHtml({
  autoPrint,
  body,
  layout,
  title,
}: {
  autoPrint: boolean
  body: string
  layout: 'a4' | 'receipt'
  title: string
}) {
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <base href="${escapeHtml(resolveDocumentBaseUrl())}" />
      <title>${escapeHtml(title)}</title>
      <style>${buildDocumentStyles(layout)}</style>
    </head>
    <body class="${layout === 'a4' ? 'document-body document-body--a4' : 'document-body document-body--receipt'}">
      ${body}
      <script>
        window.onload = function () {
          window.focus();
          ${autoPrint ? 'window.print();' : ''}
        };
      </script>
    </body>
  </html>`
}

function buildDocumentStyles(layout: 'a4' | 'receipt') {
  const pageRule = layout === 'a4'
    ? '@page { size: A4 portrait; margin: 0; }'
    : '@page { size: 58mm auto; margin: 0; }'

  return `
    :root {
      --primary-navy: ${PRIMARY_NAVY};
      --medical-blue: ${MEDICAL_BLUE};
      --divider-blue: ${DIVIDER_BLUE};
      --muted-text: ${MUTED_TEXT};
      --soft-text: ${SOFT_TEXT};
      --page-background: ${PAGE_BACKGROUND};
      --white: #FFFFFF;
    }

    ${pageRule}

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    html, body {
      margin: 0;
      padding: 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      color: var(--primary-navy);
      background: var(--page-background);
    }

    .document-body--a4 {
      margin: 0;
      padding: 0;
    }

    .document-body--receipt {
      padding: 16px 0;
      display: flex;
      justify-content: center;
    }

    .invoice-print-wrapper {
      margin: 0;
      padding: 0;
    }

    .invoice-a4-page {
      width: 210mm;
      height: 297mm;
      min-height: 297mm;
      max-height: 297mm;
      margin: 0 auto;
      padding: 8mm 12mm 7mm;
      position: relative;
      overflow: hidden;
      background: var(--white);
    }

    .invoice-a4-inner {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: var(--white);
      padding-bottom: 18mm;
    }

    .invoice-a4-page * {
      box-sizing: border-box;
    }

    .invoice-a4-inner > *:last-child {
      margin-bottom: 0;
    }

    .invoice-a4-topbar {
      height: 8mm;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 6mm;
      padding-bottom: 2mm;
      border-bottom: 0.45mm solid var(--medical-blue);
      font-size: 8px;
      color: var(--soft-text);
    }

    .invoice-a4-topbar__left,
    .invoice-a4-topbar__center {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .invoice-a4-topbar__center {
      justify-self: center;
      text-align: center;
      font-weight: 500;
    }

    .invoice-a4-topbar__right {
      justify-self: end;
    }

    .invoice-a4-header {
      height: 46mm;
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
      gap: 12mm;
      align-items: center;
      padding: 6mm 0 5mm;
    }

    .invoice-a4-brand {
      height: 100%;
      padding-right: 10mm;
      border-right: 0.45mm solid var(--divider-blue);
      display: flex;
      align-items: center;
    }

    .invoice-a4-logo {
      width: 78mm;
      max-width: 100%;
      max-height: 34mm;
      height: auto;
      object-fit: contain;
      object-position: left center;
      display: block;
    }

    .invoice-a4-contact {
      display: flex;
      flex-direction: column;
      gap: 2.6mm;
      padding-left: 0;
      font-size: 11px;
      line-height: 1.45;
      color: var(--soft-text);
      overflow-wrap: anywhere;
    }

    .invoice-a4-contact p,
    .invoice-a4-meta p,
    .invoice-a4-status p {
      margin: 0;
    }

    .invoice-a4-contact__branch {
      font-size: 11px;
      font-weight: 700;
      color: var(--primary-navy);
    }

    .invoice-a4-title {
      height: 16mm;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border-bottom: 0.45mm solid var(--divider-blue);
    }

    .invoice-a4-title h1 {
      margin: 0;
      font-size: 32px;
      line-height: 1;
      color: var(--primary-navy);
      letter-spacing: -0.04em;
    }

    .invoice-a4-meta {
      padding: 5mm 0 4mm;
      border-bottom: 0.4mm dashed var(--divider-blue);
      display: flex;
      flex-direction: column;
      gap: 3mm;
      font-size: 11px;
      line-height: 1.35;
      color: var(--soft-text);
    }

    .invoice-a4-meta span,
    .invoice-a4-status span {
      font-weight: 700;
      color: var(--primary-navy);
    }

    .invoice-a4-status {
      display: flex;
      flex-direction: column;
      gap: 3mm;
      padding: 4mm 0 5mm;
      font-size: 11px;
      color: var(--soft-text);
    }

    .invoice-a4-table-wrap {
      margin-top: 1mm;
      border: 0.35mm solid var(--divider-blue);
      border-radius: 4mm;
      overflow: hidden;
    }

    .invoice-a4-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      table-layout: fixed;
      font-size: 10.5px;
    }

    .invoice-a4-table th {
      height: 10mm;
      padding: 0 4mm;
      background: var(--primary-navy);
      color: var(--white);
      text-align: left;
      vertical-align: middle;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .invoice-a4-table td {
      min-height: 12mm;
      padding: 4mm;
      text-align: left;
      vertical-align: top;
      font-size: 10.5px;
      line-height: 1.35;
    }

    .invoice-a4-table th:nth-child(1),
    .invoice-a4-table td:nth-child(1) {
      width: 58%;
    }

    .invoice-a4-table th:nth-child(2),
    .invoice-a4-table td:nth-child(2) {
      width: 10%;
      text-align: center;
    }

    .invoice-a4-table th:nth-child(3),
    .invoice-a4-table td:nth-child(3) {
      width: 15%;
      text-align: center;
    }

    .invoice-a4-table th:nth-child(4),
    .invoice-a4-table td:nth-child(4) {
      width: 17%;
      text-align: right;
    }

    .invoice-a4-table tbody tr + tr td {
      border-top: 0.3mm solid var(--divider-blue);
    }

    .invoice-a4-table td:first-child {
      overflow-wrap: anywhere;
      color: var(--soft-text);
    }

    .invoice-a4-totals {
      display: flex;
      justify-content: flex-end;
      padding-top: 6mm;
    }

    .invoice-a4-totals__panel {
      width: 76mm;
      border-left: 0.45mm solid #B7D7F5;
      padding-left: 5mm;
    }

    .invoice-a4-totals__panel p {
      margin: 0;
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 5mm;
      padding: 0 0 3mm;
      font-size: 11px;
      color: var(--soft-text);
    }

    .invoice-a4-totals__panel strong {
      font-size: 11px;
      color: var(--primary-navy);
    }

    .invoice-a4-totals__balance {
      margin-top: 1mm !important;
      padding-top: 4mm !important;
      border-top: 0.35mm solid var(--divider-blue);
      font-weight: 700;
      color: var(--primary-navy) !important;
    }

    .invoice-a4-totals__balance strong {
      font-size: 18px;
      color: var(--medical-blue);
    }

    .invoice-a4-footer {
      position: absolute;
      left: 12mm;
      right: 12mm;
      bottom: 7mm;
      height: 10mm;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    }

    .invoice-a4-footer__line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6mm;
      border-top: 0.45mm solid var(--medical-blue);
      padding-top: 1.8mm;
      font-size: 8px;
      color: var(--medical-blue);
    }

    .invoice-a4-footer__bottom {
      display: flex;
      justify-content: space-between;
      gap: 4mm;
      padding-top: 1.2mm;
      font-size: 8px;
      color: var(--soft-text);
    }

    .receipt-80mm-page {
      width: 58mm;
      background: var(--white);
      box-sizing: border-box;
      padding: 5mm;
    }

    .receipt-80mm-inner {
      width: 48mm;
      margin: 0 auto;
      color: var(--primary-navy);
      font-size: 10.5px;
      line-height: 1.35;
    }

    .receipt-80mm-logo {
      display: flex;
      justify-content: center;
      margin-bottom: 3mm;
    }

    .receipt-80mm-contact,
    .receipt-80mm-title,
    .receipt-80mm-thanks,
    .receipt-80mm-footer {
      text-align: center;
    }

    .receipt-80mm-contact p,
    .receipt-80mm-title h1,
    .receipt-80mm-title p,
    .receipt-80mm-thanks p,
    .receipt-80mm-footer p {
      margin: 0;
    }

    .receipt-80mm-contact {
      display: flex;
      flex-direction: column;
      gap: 1mm;
      color: var(--soft-text);
    }

    .receipt-80mm-contact__branch {
      font-size: 11.5px;
      font-weight: 700;
      color: var(--primary-navy);
    }

    .receipt-80mm-break {
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .receipt-80mm-title {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5mm;
      padding: 2.4mm 0;
    }

    .receipt-80mm-title h1 {
      font-size: 17px;
      line-height: 1.1;
      letter-spacing: 0.04em;
      color: var(--medical-blue);
    }

    .receipt-80mm-number {
      width: 100%;
      margin: 0;
      padding: 1.8mm 2mm;
      border-radius: 2.5mm;
      background: var(--primary-navy);
      color: var(--white);
      font-size: 10.5px;
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .receipt-80mm-meta {
      display: flex;
      flex-direction: column;
      gap: 1.2mm;
      padding: 1.8mm 0;
    }

    .receipt-80mm-meta__row,
    .receipt-80mm-total {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1.6mm;
      align-items: start;
    }

    .receipt-80mm-meta__row span:first-child,
    .receipt-80mm-total span:first-child {
      font-weight: 700;
      color: var(--primary-navy);
    }

    .receipt-80mm-meta__row span:last-child {
      text-align: right;
      color: var(--soft-text);
      overflow-wrap: anywhere;
    }

    .receipt-80mm-items {
      padding-top: 1.4mm;
    }

    .receipt-80mm-items__head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 7mm 13mm;
      gap: 1.4mm;
      padding-bottom: 1.5mm;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--medical-blue);
      border-bottom: 0.45mm solid var(--medical-blue);
    }

    .receipt-80mm-items__head span:last-child {
      text-align: right;
    }

    .receipt-80mm-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 7mm 13mm;
      gap: 1.4mm;
      padding: 2.4mm 0;
      border-bottom: 0.3mm solid var(--divider-blue);
      align-items: start;
    }

    .receipt-80mm-item__name,
    .receipt-80mm-item__code {
      margin: 0;
    }

    .receipt-80mm-item__name {
      font-size: 10.5px;
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    .receipt-80mm-item__code {
      margin-top: 0.5mm;
      font-size: 9px;
      color: var(--muted-text);
      overflow-wrap: anywhere;
    }

    .receipt-80mm-item__qty {
      text-align: center;
      font-size: 10px;
    }

    .receipt-80mm-item__price {
      text-align: right;
      font-size: 10px;
    }

    .receipt-80mm-totals {
      display: flex;
      flex-direction: column;
      gap: 1.2mm;
      padding: 2.2mm 0;
    }

    .receipt-80mm-total strong {
      color: var(--primary-navy);
      font-size: 11px;
    }

    .receipt-80mm-total--balance span,
    .receipt-80mm-total--balance strong {
      font-weight: 800;
      color: var(--medical-blue);
      font-size: 12.5px;
    }

    .receipt-80mm-thanks {
      display: flex;
      flex-direction: column;
      gap: 1mm;
      padding: 2.4mm 1mm;
      color: var(--soft-text);
    }

    .receipt-80mm-thanks__headline {
      font-size: 10.5px;
      font-weight: 700;
      color: var(--medical-blue);
    }

    .receipt-80mm-footer {
      display: flex;
      flex-direction: column;
      gap: 1mm;
      padding: 2mm 0 0.4mm;
      font-size: 9px;
      color: var(--soft-text);
    }

    .receipt-80mm-footer p:first-child {
      color: var(--medical-blue);
      font-style: italic;
    }

    .receipt-80mm-divider {
      border-top: 0.3mm solid var(--divider-blue);
      margin: 2mm 0;
    }

    .receipt-80mm-divider--dashed {
      border-top-style: dashed;
      border-top-color: #7FB3E7;
    }

    .sandton-logo {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      color: var(--primary-navy);
    }

    .sandton-logo--a4 {
      width: 90mm;
    }

    .sandton-logo--receipt {
      width: 38mm;
    }

    .sandton-logo__icon {
      width: 100%;
      height: auto;
      display: block;
    }

    .sandton-logo__wordmark {
      margin-top: 1.8mm;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-align: center;
    }

    .sandton-logo--a4 .sandton-logo__wordmark {
      font-size: 25px;
    }

    .sandton-logo--receipt .sandton-logo__wordmark {
      font-size: 14px;
      letter-spacing: 0.04em;
    }

    .sandton-logo__clinic {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 2.2mm;
      margin-top: 0.8mm;
      font-size: 14px;
      letter-spacing: 0.38em;
      justify-content: center;
    }

    .sandton-logo--a4 .sandton-logo__clinic {
      font-size: 16px;
      letter-spacing: 0.44em;
    }

    .sandton-logo--receipt .sandton-logo__clinic {
      gap: 1.2mm;
      font-size: 9px;
      letter-spacing: 0.2em;
    }

    .sandton-logo__clinic span:nth-child(2) {
      white-space: nowrap;
    }

    .sandton-logo__line {
      height: 0.45mm;
      flex: 1 1 auto;
      max-width: 19mm;
      background: var(--primary-navy);
      opacity: 0.9;
    }

    .sandton-logo__tagline {
      margin-top: 1.4mm;
      color: #2E74D1;
      text-align: center;
      font-size: 11px;
      letter-spacing: 0.03em;
    }

    .sandton-logo--a4 .sandton-logo__tagline {
      font-size: 14px;
    }

    .sandton-logo--receipt .sandton-logo__tagline {
      font-size: 7.5px;
      letter-spacing: 0.01em;
    }

    .status-paid {
      color: var(--medical-blue);
      font-weight: 700;
    }

    .status-other {
      color: var(--primary-navy);
      font-weight: 700;
    }

    .heartbeat-accent {
      width: 26mm;
      height: 7mm;
      display: block;
    }

    .heartbeat-accent--footer {
      width: 18mm;
      height: 6mm;
    }

    @media print {
      html, body {
        background: var(--white);
      }

      .document-body--a4,
      .document-body--receipt {
        padding: 0;
      }

      .invoice-a4-page,
      .receipt-80mm-page {
        margin: 0;
      }
    }
  `
}

function buildHeartbeatAccent(size: 'a4' | 'footer') {
  return `
    <svg viewBox="0 0 120 24" aria-hidden="true" class="heartbeat-accent${size === 'footer' ? ' heartbeat-accent--footer' : ''}">
      <path d="M1 12 H82 L89 12 L94 2 L99 22 L104 8 L108 12 H119" fill="none" stroke="${MEDICAL_BLUE}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `
}

function resolveInvoiceNumber(invoice: Invoice) {
  return invoice.invoiceNumber || String(invoice.id || '--')
}

function buildPatientLine(invoice: Invoice) {
  const patientName = invoice.patientName || '--'
  const fileNumber = invoice.patientFileNumber || '--'
  return `${patientName} | File Number: ${fileNumber}`
}

function resolveDocumentBaseUrl() {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return '/'
  }

  return `${window.location.origin}/`
}

function resolveDocumentAssetUrl(path: string) {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return path
  }

  return new URL(path, resolveDocumentBaseUrl()).toString()
}

function buildFooterReference(invoice: Invoice) {
  return invoice.branchName ? `${invoice.branchName} invoice record` : 'Sandton 24 Clinic invoice record'
}

function resolveBranchLocation(invoice: Invoice) {
  const branchAddress = String(invoice.branchAddress || '').trim()
  if (branchAddress) return branchAddress

  const branchName = String(invoice.branchName || '').trim()
  if (!branchName) return 'Sandton Main'
  return branchName.replace(/\s+Branch$/i, '') || branchName
}

function buildInvoiceLineLabel(line: InvoiceLine) {
  const parts = [line.itemName || '--']
  if (line.itemCode) parts.push(`Code: ${line.itemCode}`)
  return parts.join(' | ')
}

function buildItemCodeLabel(line: InvoiceLine) {
  return line.itemCode ? `Code: ${line.itemCode}` : 'Code: --'
}

function formatDocumentDate(value?: string | null) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US')
}

function formatDocumentDateTime(value?: string | null) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US')
}

function formatPrintTimestamp(value: Date) {
  return value.toLocaleString('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'numeric',
    year: '2-digit',
  })
}

function formatDocumentCurrency(value?: number | null, currency?: string | null) {
  if (value == null || Number.isNaN(value)) return '--'
  const resolvedCurrency = currency || 'USD'
  return new Intl.NumberFormat('en-US', {
    currency: resolvedCurrency,
    currencyDisplay: 'symbol',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value)
}

function formatStatusLabel(status?: string | null) {
  const normalized = String(status || '').trim().toUpperCase()
  if (!normalized) return '--'
  return normalized.replaceAll('_', ' ')
}

function getStatusClass(status?: string | null) {
  return String(status || '').trim().toUpperCase() === 'PAID' ? 'status-paid' : 'status-other'
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
