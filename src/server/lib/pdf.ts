import PDFDocument from 'pdfkit';
import type { Decimal } from '@prisma/client/runtime/library';

// ---------------------------------------------------------------------------
// Types matching the shape returned by billingService.getInvoice()
// ---------------------------------------------------------------------------

interface InvoiceCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

interface InvoiceLineItem {
  deliveryDate: Date;
  quantity: Decimal;
  unitPrice: Decimal;
  lineTotal: Decimal;
  productVariant: {
    id: string;
    unitType: string;
    quantityPerUnit: Decimal;
    product: { name: string };
  };
}

interface InvoiceAdjustment {
  adjustmentType: string;
  amount: Decimal;
  reason: string;
  createdAt: Date;
}

interface InvoiceDiscount {
  discountType: string;
  value: Decimal;
  amount: Decimal;
  description: string | null;
  createdAt: Date;
}

interface InvoicePayment {
  amount: Decimal;
  paymentMethod: string;
  paymentDate: Date;
}

export interface InvoiceData {
  id: string;
  customerId: string;
  billingCycleStart: Date;
  billingCycleEnd: Date;
  version: number;
  openingBalance: Decimal;
  totalCharges: Decimal;
  totalDiscounts: Decimal;
  totalAdjustments: Decimal;
  totalPayments: Decimal;
  closingBalance: Decimal;
  paymentStatus: string;
  isCurrent: boolean;
  generatedAt: Date;
  customer: InvoiceCustomer;
  lineItems: InvoiceLineItem[];
  adjustments: InvoiceAdjustment[];
  discounts: InvoiceDiscount[];
  payments: InvoicePayment[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(v: Decimal | number): number {
  return typeof v === 'number' ? v : Number(v);
}

function currency(v: Decimal | number): string {
  return `₹${num(v).toFixed(2)}`;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------

export function generateInvoicePdf(invoice: InvoiceData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const leftMargin = 50;
  const pageWidth = 595.28 - 2 * leftMargin; // A4 width minus margins

  // ── Header ──────────────────────────────────────────────────────────────
  doc.fontSize(20).text('INVOICE', { align: 'center' });
  doc.moveDown(0.5);

  doc.fontSize(10);
  doc.text(`Invoice #: ${invoice.id.slice(0, 8).toUpperCase()}`, leftMargin);
  doc.text(`Version: ${invoice.version}`);
  doc.text(`Generated: ${fmtDate(invoice.generatedAt)}`);
  doc.text(`Status: ${invoice.paymentStatus.toUpperCase()}`);
  doc.moveDown();

  // ── Customer details ────────────────────────────────────────────────────
  doc.fontSize(12).text('Customer Details', leftMargin);
  doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
  doc.fontSize(10);
  doc.text(`Name: ${invoice.customer.name}`);
  doc.text(`Phone: ${invoice.customer.phone}`);
  if (invoice.customer.email) {
    doc.text(`Email: ${invoice.customer.email}`);
  }
  doc.moveDown();

  // ── Billing period ──────────────────────────────────────────────────────
  doc.fontSize(12).text('Billing Period', leftMargin);
  doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
  doc.fontSize(10);
  doc.text(`From: ${fmtDate(invoice.billingCycleStart)}  To: ${fmtDate(invoice.billingCycleEnd)}`);
  doc.moveDown();

  // ── Line items table ────────────────────────────────────────────────────
  doc.fontSize(12).text('Deliveries', leftMargin);
  doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
  doc.fontSize(9);

  // Table header
  const colDate = leftMargin;
  const colProduct = leftMargin + 75;
  const colQty = leftMargin + 270;
  const colPrice = leftMargin + 330;
  const colTotal = leftMargin + 410;

  doc.font('Helvetica-Bold');
  doc.text('Date', colDate, doc.y, { continued: false });
  const headerY = doc.y - doc.currentLineHeight();
  doc.text('Product', colProduct, headerY);
  doc.text('Qty', colQty, headerY);
  doc.text('Unit Price', colPrice, headerY);
  doc.text('Total', colTotal, headerY);
  doc.font('Helvetica');
  doc.moveDown(0.3);

  for (const item of invoice.lineItems) {
    const y = doc.y;
    if (y > 720) {
      doc.addPage();
    }
    const rowY = doc.y;
    const productName = `${item.productVariant.product.name} (${num(item.productVariant.quantityPerUnit)} ${item.productVariant.unitType})`;
    doc.text(fmtDate(item.deliveryDate), colDate, rowY);
    doc.text(productName, colProduct, rowY, { width: 190 });
    doc.text(num(item.quantity).toString(), colQty, rowY);
    doc.text(currency(item.unitPrice), colPrice, rowY);
    doc.text(currency(item.lineTotal), colTotal, rowY);
    doc.moveDown(0.2);
  }

  doc.moveDown();

  // ── Adjustments ─────────────────────────────────────────────────────────
  if (invoice.adjustments.length > 0) {
    doc.fontSize(12).text('Adjustments', leftMargin);
    doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
    doc.fontSize(9);
    doc.font('Helvetica-Bold');
    const adjY = doc.y;
    doc.text('Date', colDate, adjY);
    doc.text('Type', colProduct, adjY);
    doc.text('Reason', colQty, adjY);
    doc.text('Amount', colTotal, adjY);
    doc.font('Helvetica');
    doc.moveDown(0.3);

    for (const adj of invoice.adjustments) {
      if (doc.y > 720) doc.addPage();
      const rowY = doc.y;
      doc.text(fmtDate(adj.createdAt), colDate, rowY);
      doc.text(adj.adjustmentType, colProduct, rowY);
      doc.text(adj.reason, colQty, rowY, { width: 140 });
      doc.text(currency(adj.amount), colTotal, rowY);
      doc.moveDown(0.2);
    }
    doc.moveDown();
  }

  // ── Discounts ───────────────────────────────────────────────────────────
  if (invoice.discounts.length > 0) {
    doc.fontSize(12).text('Discounts', leftMargin);
    doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
    doc.fontSize(9);
    doc.font('Helvetica-Bold');
    const discY = doc.y;
    doc.text('Date', colDate, discY);
    doc.text('Type', colProduct, discY);
    doc.text('Description', colQty, discY);
    doc.text('Amount', colTotal, discY);
    doc.font('Helvetica');
    doc.moveDown(0.3);

    for (const disc of invoice.discounts) {
      if (doc.y > 720) doc.addPage();
      const rowY = doc.y;
      doc.text(fmtDate(disc.createdAt), colDate, rowY);
      doc.text(`${disc.discountType} (${num(disc.value)})`, colProduct, rowY);
      doc.text(disc.description ?? '', colQty, rowY, { width: 140 });
      doc.text(currency(disc.amount), colTotal, rowY);
      doc.moveDown(0.2);
    }
    doc.moveDown();
  }

  // ── Payments ────────────────────────────────────────────────────────────
  if (invoice.payments.length > 0) {
    doc.fontSize(12).text('Payments', leftMargin);
    doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
    doc.fontSize(9);
    doc.font('Helvetica-Bold');
    const payY = doc.y;
    doc.text('Date', colDate, payY);
    doc.text('Method', colProduct, payY);
    doc.text('Amount', colTotal, payY);
    doc.font('Helvetica');
    doc.moveDown(0.3);

    for (const pay of invoice.payments) {
      if (doc.y > 720) doc.addPage();
      const rowY = doc.y;
      doc.text(fmtDate(pay.paymentDate), colDate, rowY);
      doc.text(pay.paymentMethod, colProduct, rowY);
      doc.text(currency(pay.amount), colTotal, rowY);
      doc.moveDown(0.2);
    }
    doc.moveDown();
  }

  // ── Balance summary ─────────────────────────────────────────────────────
  doc.fontSize(12).text('Balance Summary', leftMargin);
  doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
  doc.fontSize(10);

  const summaryLabelX = leftMargin + 250;
  const summaryValueX = leftMargin + 400;

  const summaryRows: [string, string][] = [
    ['Opening Balance', currency(invoice.openingBalance)],
    ['Total Charges', currency(invoice.totalCharges)],
    ['Total Discounts', `- ${currency(invoice.totalDiscounts)}`],
    ['Total Adjustments', currency(invoice.totalAdjustments)],
    ['Total Payments', `- ${currency(invoice.totalPayments)}`],
  ];

  for (const [label, value] of summaryRows) {
    const rowY = doc.y;
    doc.text(label, summaryLabelX, rowY);
    doc.text(value, summaryValueX, rowY);
    doc.moveDown(0.2);
  }

  doc.moveDown(0.3);
  doc.font('Helvetica-Bold');
  const closingY = doc.y;
  doc.text('Closing Balance', summaryLabelX, closingY);
  doc.text(currency(invoice.closingBalance), summaryValueX, closingY);
  doc.font('Helvetica');

  // Finalize
  doc.end();
  return doc;
}

// ---------------------------------------------------------------------------
// Ledger PDF types and generation (Req 21.4, 21.5)
// ---------------------------------------------------------------------------

interface LedgerCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

interface LedgerEntryRow {
  entryDate: Date;
  transactionType: string;
  description: string | null;
  debitAmount: Decimal;
  creditAmount: Decimal;
  runningBalance: Decimal;
}

export interface LedgerPdfData {
  customer: LedgerCustomer;
  entries: LedgerEntryRow[];
  startDate: string;
  endDate: string;
}

export function generateLedgerPdf(data: LedgerPdfData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const leftMargin = 50;
  const pageWidth = 595.28 - 2 * leftMargin;

  // Header
  doc.fontSize(20).text('CUSTOMER LEDGER', { align: 'center' });
  doc.moveDown(0.5);

  doc.fontSize(10);
  doc.text(`Customer: ${data.customer.name}`, leftMargin);
  doc.text(`Phone: ${data.customer.phone}`);
  if (data.customer.email) doc.text(`Email: ${data.customer.email}`);
  doc.text(`Period: ${data.startDate} to ${data.endDate}`);
  doc.moveDown();

  // Table header
  doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();
  doc.fontSize(9).font('Helvetica-Bold');

  const colDate = leftMargin;
  const colType = leftMargin + 70;
  const colDesc = leftMargin + 145;
  const colDebit = leftMargin + 290;
  const colCredit = leftMargin + 360;
  const colBalance = leftMargin + 430;

  const headerY = doc.y;
  doc.text('Date', colDate, headerY);
  doc.text('Type', colType, headerY);
  doc.text('Description', colDesc, headerY);
  doc.text('Debit', colDebit, headerY);
  doc.text('Credit', colCredit, headerY);
  doc.text('Balance', colBalance, headerY);
  doc.font('Helvetica');
  doc.moveDown(0.5);

  // Rows
  for (const entry of data.entries) {
    if (doc.y > 720) doc.addPage();
    const rowY = doc.y;
    doc.text(fmtDate(entry.entryDate), colDate, rowY);
    doc.text(entry.transactionType, colType, rowY);
    doc.text(entry.description ?? '', colDesc, rowY, { width: 140 });
    doc.text(currency(entry.debitAmount), colDebit, rowY);
    doc.text(currency(entry.creditAmount), colCredit, rowY);
    doc.text(currency(entry.runningBalance), colBalance, rowY);
    doc.moveDown(0.2);
  }

  doc.moveDown();
  doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + pageWidth, doc.y).stroke();

  // Final balance
  if (data.entries.length > 0) {
    const last = data.entries[data.entries.length - 1];
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(`Closing Balance: ${currency(last.runningBalance)}`, leftMargin);
    doc.font('Helvetica');
  }

  doc.end();
  return doc;
}
