import { listRecords, createRecord, updateRecord, deleteRecord } from './dataverseService';
import { fetchUnitsOfMeasure } from './unitOfMeasureService';

const ENTITY_SET = 'csp_invoicelines';

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}
function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export interface InvoiceLineRecord {
  id: string;
  name: string;
  description: string;
  quantity: number;
  lineTotal: number;
  invoiceId: string;
  consultantId: string;
  unitOfMeasureId: string;
  unitOfMeasure: string;
  contractId: string;
  contractNumber: string;
}

let uomCache: Record<string, string> = {};

export function setUomCache(map: Record<string, string>): void {
  uomCache = map;
}

async function ensureUomCache(): Promise<void> {
  if (Object.keys(uomCache).length > 0) return;
  try {
    const uoms = await fetchUnitsOfMeasure();
    uoms.forEach(u => { if (u.id && u.name) uomCache[u.id] = u.name; });
  } catch { /* ignore */ }
}

export interface InvoiceLineFormData {
  name?: string;
  description?: string;
  quantity?: number;
  lineTotal?: number;
  invoiceId?: string;
  consultantId?: string;
  unitOfMeasureId?: string;
  contractId?: string;
}

function mapFromDataverse(r: any): InvoiceLineRecord {
  const uomId = norm(r._csp_unitofmeasure_value);
  return {
    id: norm(r.csp_invoicelineid),
    name: r.csp_name || '',
    description: r.csp_description || '',
    quantity: r.csp_quantity ?? 0,
    lineTotal: r.csp_linetotal ?? 0,
    invoiceId: norm(r._csp_invoice_value),
    consultantId: norm(r._csp_consultant_value),
    unitOfMeasureId: uomId,
    unitOfMeasure: uomCache[uomId] || 'Day',
    contractId: norm(r._csp_contract_value),
    contractNumber: r['_csp_contract_value@OData.Community.Display.V1.FormattedValue'] || '',
  };
}

function buildPayload(data: InvoiceLineFormData): any {
  const record: any = {};
  if (data.name !== undefined) record.csp_name = data.name;
  if (data.description !== undefined) record.csp_description = data.description;
  if (data.quantity !== undefined) record.csp_quantity = Number(data.quantity);
  if (data.lineTotal !== undefined) record.csp_linetotal = Number(data.lineTotal);
  // Lookups — only if valid GUID
  if (data.invoiceId && isGuid(data.invoiceId)) {
    record['csp_invoice@odata.bind'] = `/csp_invoices(${data.invoiceId})`;
  }
  if (data.unitOfMeasureId && isGuid(data.unitOfMeasureId)) {
    record['csp_unitofmeasure@odata.bind'] = `/csp_unitofmeasures(${data.unitOfMeasureId})`;
  }
  if (data.consultantId && isGuid(data.consultantId)) {
    record['csp_consultant@odata.bind'] = `/contacts(${data.consultantId})`;
  }
  // csp_invoiceline → contract: nav property is csp_Contract (capital C).
  if (data.contractId && isGuid(data.contractId)) {
    record['csp_Contract@odata.bind'] = `/csp_contracts(${data.contractId})`;
  }
  return record;
}

/**
 * Fetch all invoice lines for a specific invoice.
 */
export async function fetchLinesByInvoiceId(invoiceId: string): Promise<InvoiceLineRecord[]> {
  if (!invoiceId || !isGuid(invoiceId)) return [];
  await ensureUomCache();
  const records = await listRecords(
    ENTITY_SET,
    undefined,
    `_csp_invoice_value eq ${invoiceId}`,
    'csp_name asc',
  );
  console.log('[InvoiceLine] Fetched for invoice', invoiceId, ':', records.length, 'lines');
  return records.map(mapFromDataverse);
}

/**
 * Create a new invoice line. Returns the new ID.
 */
export async function createInvoiceLine(data: InvoiceLineFormData): Promise<string> {
  const record = buildPayload(data);
  console.log('[InvoiceLine] Creating:', JSON.stringify(record));
  const newId = await createRecord(ENTITY_SET, record);
  console.log('[InvoiceLine] Created:', newId);
  return newId;
}

/**
 * Update an existing invoice line.
 */
export async function updateInvoiceLine(lineId: string, data: InvoiceLineFormData): Promise<void> {
  if (!isGuid(lineId)) throw new Error('Invalid line ID');
  const record = buildPayload(data);
  console.log('[InvoiceLine] Updating', lineId, ':', JSON.stringify(record));
  await updateRecord(ENTITY_SET, lineId, record);
}

/**
 * Delete an invoice line.
 */
export async function deleteInvoiceLine(lineId: string): Promise<void> {
  if (!isGuid(lineId)) return;
  console.log('[InvoiceLine] Deleting:', lineId);
  await deleteRecord(ENTITY_SET, lineId);
}
