import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice } from '../../types/crm';
import { formatDate } from '../../lib/utils';

export interface PdfEntity {
  name: string;
  country: string;
  address: string;
  email: string;
  phone: string;
  vatNumber: string;
  bankName: string;
  iban: string;
  swift: string;
  intermediaryBic?: string;
  ukBankName?: string;
  ukAccountNumber?: string;
  ukSortCode?: string;
  ukIban?: string;
  ukSwift?: string;
  ukIntermediaryBic?: string;
  usAccountNumber?: string;
  usAchRoutingNumber?: string;
  usWireRoutingNumber?: string;
}

export interface PdfAccount {
  name: string;
  street1?: string;
  street2?: string;
  street3?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  vatNumber?: string;
  registrationNumber?: string;
  invoiceFooter?: string;
}

export interface PdfLine {
  description: string;
  consultantName?: string;
  quantity: number;
  unitOfMeasure: string;
  rate: number;
  currencyCode: string;
  amount: number;
}

const HEADER_COLOR: [number, number, number] = [47, 84, 150];
const CURRENCY_LABELS: Record<string, string> = { EUR: 'Euro', USD: 'US Dollar', GBP: 'British Pound', RON: 'Romanian Leu' };

function getPaymentLines(entity: PdfEntity, invoiceCurrency?: string): Array<{ heading?: string; lines: [string, string][] }> {
  const sections: Array<{ heading?: string; lines: [string, string][] }> = [];

  if (entity.country === 'Bulgaria') {
    const useUk = invoiceCurrency === 'GBP' && entity.ukBankName;
    if (useUk) {
      const ukLines: [string, string][] = [];
      if (entity.ukBankName) ukLines.push(['BANK', entity.ukBankName]);
      if (entity.ukAccountNumber) ukLines.push(['ACCOUNT NO', entity.ukAccountNumber]);
      if (entity.ukSortCode) ukLines.push(['SORT CODE', entity.ukSortCode]);
      if (entity.ukIban) ukLines.push(['IBAN', entity.ukIban]);
      if (entity.ukSwift) ukLines.push(['BIC', entity.ukSwift]);
      if (entity.ukIntermediaryBic) ukLines.push(['INTERMEDIARY BIC', entity.ukIntermediaryBic]);
      sections.push({ heading: 'UK Bank', lines: ukLines });
    } else {
      const euLines: [string, string][] = [
        ['BANK', entity.bankName],
        ['IBAN', entity.iban],
        ['BIC', entity.swift],
      ];
      if (entity.intermediaryBic) euLines.push(['INTERMEDIARY BIC', entity.intermediaryBic]);
      sections.push({ heading: 'EU Bank', lines: euLines });
    }
  } else if (entity.country === 'US') {
    const usLines: [string, string][] = [
      ['BANK', entity.bankName],
    ];
    if (entity.usAccountNumber) usLines.push(['ACCOUNT NO', entity.usAccountNumber]);
    if (entity.usAchRoutingNumber) usLines.push(['ACH ROUTING', entity.usAchRoutingNumber]);
    if (entity.usWireRoutingNumber) usLines.push(['WIRE ROUTING', entity.usWireRoutingNumber]);
    if (entity.swift && entity.swift !== 'N/A') usLines.push(['SWIFT', entity.swift]);
    sections.push({ lines: usLines });
  } else {
    const defaultLines: [string, string][] = [
      ['BANK', entity.bankName],
      ['IBAN', entity.iban],
      ['BIC', entity.swift],
    ];
    if (entity.intermediaryBic) defaultLines.push(['INTERMEDIARY BIC', entity.intermediaryBic]);
    sections.push({ lines: defaultLines });
  }

  return sections;
}

export async function generateInvoicePdf(
  invoice: Invoice,
  entity: PdfEntity,
  account: PdfAccount,
  lines: PdfLine[],
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // Entity details (top right)
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  const ENTITY_BLOCK_WIDTH = 75;
  const entityRightX = pageW - 14;
  let entityY = 14;
  const lineH = 4.2;

  const writeRight = (text: string) => {
    const wrapped = doc.splitTextToSize(text, ENTITY_BLOCK_WIDTH) as string[];
    wrapped.forEach((w) => {
      doc.text(w, entityRightX, entityY, { align: 'right' });
      entityY += lineH;
    });
  };

  writeRight(entity.address);
  if (entity.email) writeRight(entity.email);
  if (entity.phone) writeRight(entity.phone);
  writeRight(`VAT NO: ${entity.vatNumber}`);

  // Company name + Invoice title
  let y = Math.max(42, entityY + 4);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(HEADER_COLOR[0], HEADER_COLOR[1], HEADER_COLOR[2]);
  const titleWidth = doc.getTextWidth('Invoice') + 4;
  const companyMax = pageW - 14 - 14 - titleWidth - 10;
  const companyLines = doc.splitTextToSize(entity.name, companyMax) as string[];
  companyLines.forEach((cl, i) => doc.text(cl, 14, y + i * 8));
  doc.setFontSize(28);
  doc.text('Invoice', pageW - 14, y, { align: 'right' });
  y += (companyLines.length - 1) * 8;

  // Separator
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageW - 14, y);

  // Bill To + Invoice details
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Bill To', 14, y);

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(account.name, 42, y);

  // Invoice metadata (right side)
  let metaY = y;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Invoice No', pageW - 70, metaY);
  doc.setTextColor(0, 0, 0);
  doc.text(invoice.invoiceNumber, pageW - 14, metaY, { align: 'right' });
  metaY += 6;
  doc.setTextColor(100, 100, 100);
  doc.text('Invoice Date', pageW - 70, metaY);
  doc.setTextColor(0, 0, 0);
  doc.text(formatDate(invoice.invoiceDate), pageW - 14, metaY, { align: 'right' });
  metaY += 6;
  doc.setTextColor(100, 100, 100);
  doc.text('Due Date', pageW - 70, metaY);
  doc.setTextColor(0, 0, 0);
  doc.text(formatDate(invoice.dueDate), pageW - 14, metaY, { align: 'right' });

  // Account address lines (structured fields → multi-line)
  let billY = y + 6;
  const cityLine = [
    [account.postalCode, account.city].filter(Boolean).join(' '),
    account.stateProvince
  ].filter(Boolean).join(', ');
  const addrLines = [
    account.street1,
    account.street2,
    account.street3,
    cityLine,
    account.country,
  ].filter((l): l is string => !!l && l.trim().length > 0);
  if (addrLines.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    addrLines.forEach((l) => {
      doc.text(l, 42, billY);
      billY += 5;
    });
  }

  y = Math.max(billY, metaY) + 2;

  // VAT Number
  if (account.vatNumber) {
    y += 6;
    doc.setTextColor(100, 100, 100);
    doc.text('VAT Number', 14, y);
    doc.setTextColor(0, 0, 0);
    doc.text(account.vatNumber, 42, y);
  }

  // Registration Number
  if (account.registrationNumber) {
    y += 6;
    doc.setTextColor(100, 100, 100);
    doc.text('REG. Number', 14, y);
    doc.setTextColor(0, 0, 0);
    doc.text(account.registrationNumber, 42, y);
  }

  // Lines table
  y += 10;
  const tableBody = lines.map(line => {
    const desc = line.consultantName
      ? `${line.consultantName} - ${line.description}`
      : line.description;
    return [
      desc,
      line.quantity.toString(),
      line.unitOfMeasure + 's',
      line.rate.toFixed(2),
      CURRENCY_LABELS[line.currencyCode] || line.currencyCode,
      line.amount.toLocaleString('en-US', { minimumFractionDigits: 2 }),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Quantity', 'Unit of Measure', 'Rate', 'Currency', 'Amount']],
    body: tableBody,
    foot: [['Total', '', '', '', '', invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2 })]],
    headStyles: { fillColor: HEADER_COLOR, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    footStyles: { fillColor: HEADER_COLOR, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 70 }, 5: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 40;
  let afterTableY = finalY + 6;

  // RON Exchange
  if (invoice.ronConversionRate || invoice.ronTotal) {
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const labelX = pageW - 70;
    const valueX = pageW - 14;
    if (invoice.ronConversionRate) {
      doc.setFont('helvetica', 'bold');
      doc.text('RON Conversion Rate', labelX, afterTableY);
      doc.setFont('helvetica', 'normal');
      doc.text(invoice.ronConversionRate.toFixed(4), valueX, afterTableY, { align: 'right' });
      afterTableY += 5;
    }
    if (invoice.ronTotal) {
      doc.setFont('helvetica', 'bold');
      doc.text('RON Total', labelX, afterTableY);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `${invoice.ronTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} RON`,
        valueX, afterTableY, { align: 'right' }
      );
      afterTableY += 5;
    }
    afterTableY += 4;
  }

  // Payment Details + (optional) Comments
  let bottomY = afterTableY + 18;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Payment Details', 14, bottomY);

  const hasComments = !!(invoice.comments && invoice.comments.trim());
  if (hasComments) {
    doc.text('Comments', pageW / 2 + 10, bottomY);
  }

  let payY = bottomY + 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('By bank transfer:', 14, payY);

  if (hasComments) {
    const commentLines = doc.splitTextToSize(invoice.comments!.trim(), 80) as string[];
    commentLines.forEach((cl, i) => {
      doc.text(cl, pageW / 2 + 10, payY + i * 5);
    });
  }

  payY += 5;
  doc.setFont('helvetica', 'bold');
  doc.text(entity.name, 14, payY);
  payY += 5;
  doc.setFont('helvetica', 'normal');

  const invoiceCurrency = lines.length > 0 ? lines[0].currencyCode : undefined;
  const paymentSections = getPaymentLines(entity, invoiceCurrency);

  paymentSections.forEach((section) => {
    if (section.heading) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(section.heading, 14, payY);
      payY += 4;
    }
    doc.setFontSize(9);
    section.lines.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(label, 14, payY);
      doc.setFont('helvetica', 'normal');
      const valueLines = doc.splitTextToSize(value, 80) as string[];
      valueLines.forEach((vl, i) => doc.text(vl, 50, payY + i * 5));
      payY += 5 * Math.max(1, valueLines.length);
    });
    payY += 2;
  });

  // Account-level Notes (formerly "Invoice Footer" — per-account text rendered on every invoice for that account)
  const noteText = (account.invoiceFooter || '').trim();
  if (noteText) {
    // Find the lower of the two columns (Payment Details on left, Comments on right) to anchor below both.
    // payY is the running Y of the left column after all payment sections.
    // For the right column, compute how far comments extended down from `bottomY + 6` (the initial value of payY).
    let rightColumnBottomY = bottomY + 6;
    if (hasComments) {
      const commentLines = doc.splitTextToSize(invoice.comments!.trim(), 80) as string[];
      rightColumnBottomY = bottomY + 6 + commentLines.length * 5;
    }
    let notesY = Math.max(payY, rightColumnBottomY) + 10;

    // Heading
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Notes', 14, notesY);
    notesY += 6;

    // Body
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(noteText, pageW - 28) as string[];
    noteLines.forEach((ln, i) => {
      doc.text(ln, 14, notesY + i * 5);
    });
  }

  return doc.output('blob');
}
