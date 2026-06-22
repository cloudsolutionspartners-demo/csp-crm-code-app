import { generateInvoicePdf, type PdfEntity, type PdfAccount, type PdfLine } from './generateInvoicePdf';
import { fetchLinesByInvoiceId } from '../../services/invoiceLineService';
import type { Invoice, InvoiceLine, Account, Contact } from '../../types/crm';

const ENTITY_CONFIG: Record<string, PdfEntity> = {
  Romania: {
    name: 'CLOUD SOLUTIONS PARTNERS S.R.L.',
    country: 'Romania',
    address: 'Str. Victoriei 100, Bucharest, Romania',
    email: 'accounting@csp-romania.com',
    phone: '+40 724 585 060',
    vatNumber: 'RO12345678',
    bankName: 'ING Bank Romania',
    iban: 'RO49AAAA1B31007593840000',
    swift: 'INGBROBU',
  },
  Bulgaria: {
    name: 'CLOUD SOLUTIONS PARTNERS EOOD',
    country: 'Bulgaria',
    address: 'Alexanderovski Boulevard, No. 97, Floor 5, Apartment 28, Ruse, Ruse, 7071, Bulgaria',
    email: 'accounts.svc@cloudsolutionspartners.ro',
    phone: '+359 888 123 456',
    vatNumber: 'BG207996481',
    bankName: 'Revolut',
    iban: 'LT38 3250 0037 2564 8717',
    swift: 'REVOLT21',
    intermediaryBic: 'CHASGB2L',
    ukBankName: 'Revolut UK',
    ukAccountNumber: '12345678',
    ukSortCode: '04-00-75',
    ukIban: 'GB29 REVO 0099 7012 3456 78',
    ukSwift: 'REVOGB21',
    ukIntermediaryBic: 'CHASGB2L',
  },
  US: {
    name: 'CLOUD SOLUTIONS PARTNERS LLC',
    country: 'US',
    address: '100 Main St, New York, NY 10001',
    email: 'accounting@csp-us.com',
    phone: '+1 212 555 0100',
    vatNumber: 'N/A',
    bankName: 'JPMorgan Chase',
    iban: 'N/A',
    swift: 'CHASUS33',
  },
};

export async function downloadInvoicePdf(
  inv: Invoice,
  account: Account | undefined,
  businessUnits: { id: string; name: string }[],
  contacts: Contact[],
): Promise<void> {
  const records = await fetchLinesByInvoiceId(inv.id).catch(() => []);
  const lines: InvoiceLine[] = records.map(r => ({
    id: r.id,
    invoiceId: inv.id,
    name: r.name,
    description: r.description,
    quantity: r.quantity,
    rate: r.quantity > 0 ? r.lineTotal / r.quantity : 0,
    currencyCode: inv.currencyCode,
    amount: r.lineTotal,
    unitOfMeasure: (r.unitOfMeasure || 'Day') as InvoiceLine['unitOfMeasure'],
    contactId: r.consultantId || undefined,
    contractId: r.contractId || undefined,
  }));

  const buName = businessUnits.find(bu => bu.id === inv.entityId)?.name || 'Romania';
  const pdfEntity = ENTITY_CONFIG[buName] || ENTITY_CONFIG.Romania;

  const pdfAccount: PdfAccount = {
    name: account?.name || 'Unknown',
    street1: account?.street1 || '',
    street2: account?.street2 || '',
    street3: account?.street3 || '',
    city: account?.city || '',
    stateProvince: account?.stateProvince || '',
    postalCode: account?.postalCode || '',
    country: account?.country || '',
    vatNumber: account?.vatNumber || '',
    registrationNumber: account?.registrationNumber || '',
    invoiceFooter: account?.invoiceFooter || '',
  };

  const pdfLines: PdfLine[] = lines.map(line => {
    const consultant = line.contactId ? contacts.find(c => c.id === line.contactId) : null;
    const consultantName = consultant ? `${consultant.firstName} ${consultant.lastName}` : undefined;
    const qty = line.quantity || 0;
    const rate = line.rate || (line.amount && qty ? line.amount / qty : 0);
    return {
      description: line.description || line.name || '',
      consultantName,
      quantity: qty,
      unitOfMeasure: line.unitOfMeasure || 'Day',
      rate,
      currencyCode: inv.currencyCode || 'EUR',
      amount: line.amount || 0,
    };
  });

  const pdfBlob = await generateInvoicePdf({ ...inv, lines }, pdfEntity, pdfAccount, pdfLines);

  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${inv.invoiceNumber || 'invoice'}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
