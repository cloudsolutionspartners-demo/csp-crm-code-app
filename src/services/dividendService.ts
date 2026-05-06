import { listRecords, createRecord, updateRecord, deleteRecord, uploadFileField, downloadFileField } from './dataverseService';
import { getTeamIdForBU } from './businessUnitService';
import { currencyGuidToCode, currencyCodeToGuid } from './currencyMap';
import type { Dividend } from '../types/crm';

const ENTITY_SET = 'csp_dividends';
const ENTITY_LOGICAL = 'csp_dividend';
const FILE_FIELD = 'csp_document';

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}
function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function mapFromDataverse(r: any): Dividend {
  const amount = r.csp_amount ?? 0;
  const tax = r.csp_tax ?? 0;
  const currencyGuid = norm(r._transactioncurrencyid_value);
  // FormattedValue for transactioncurrencyid is the currency *name* ("Euro") not the ISO code,
  // so resolve via the currency map first and only fall back to the annotation if the map
  // hasn't loaded yet.
  const currencyCode = currencyGuidToCode(currencyGuid)
    || r['_transactioncurrencyid_value@OData.Community.Display.V1.FormattedValue']
    || 'EUR';
  return {
    id: norm(r.csp_dividendid),
    name: r.csp_name || '',
    entityId: norm(r._owningbusinessunit_value),
    amount,
    currencyCode: currencyCode as any,
    paymentDate: r.csp_date ? String(r.csp_date).substring(0, 10) : '',
    taxWithheld: tax,
    netAmount: amount - tax,
    fileName: r.csp_document_name || '',
  };
}

function mapToDataverse(data: Record<string, any>, isNew: boolean): any {
  const record: any = {};
  // Only send fields that exist on csp_dividend:
  // csp_name (primary name, auto if unset), csp_amount, csp_tax, csp_date,
  // transactioncurrencyid@odata.bind, ownerid@odata.bind (on create only)
  if (isNew) {
    record.csp_name = `DIV-${data.paymentDate || new Date().toISOString().substring(0, 10)}`;
  }
  if (data.amount !== undefined && data.amount !== '') record.csp_amount = Number(data.amount);
  if (data.taxWithheld !== undefined && data.taxWithheld !== '') record.csp_tax = Number(data.taxWithheld);
  if (data.paymentDate !== undefined) record.csp_date = data.paymentDate || null;
  // Currency — resolve code → GUID via cached currency map
  if (data.currencyCode) {
    const guid = currencyCodeToGuid(data.currencyCode);
    if (guid) {
      record['transactioncurrencyid@odata.bind'] = `/transactioncurrencies(${guid})`;
    }
  }
  // BU assignment via team ownership (create or update)
  if (data.entityId && isGuid(data.entityId)) {
    const teamId = getTeamIdForBU(data.entityId);
    if (teamId) {
      record['ownerid@odata.bind'] = `/teams(${teamId})`;
    }
  }
  return record;
}

export async function fetchDividends(): Promise<Dividend[]> {
  const records = await listRecords(ENTITY_SET, undefined, undefined, 'createdon desc');
  console.log('[Dividend] Fetched:', records.length, 'records');
  return records.map(mapFromDataverse);
}

export async function saveDividend(data: Record<string, any>, existingId?: string): Promise<string> {
  const isNew = !existingId || !isGuid(existingId);
  const mapped = mapToDataverse(data, isNew);
  console.log('[Dividend]', isNew ? 'CREATE' : 'UPDATE', existingId || '(new)', JSON.stringify(mapped));
  if (!isNew) {
    await updateRecord(ENTITY_SET, existingId!, mapped);
    return existingId!;
  }
  const newId = await createRecord(ENTITY_SET, mapped);
  console.log('[Dividend] Created:', newId);
  return newId;
}

export async function removeDividend(id: string): Promise<void> {
  await deleteRecord(ENTITY_SET, id);
}

export async function uploadDividendFile(recordId: string, file: File): Promise<void> {
  if (!isGuid(recordId)) throw new Error('Invalid dividend ID for upload');
  await uploadFileField(ENTITY_SET, recordId, FILE_FIELD, file);
}

export async function downloadDividendFile(recordId: string, fileName: string): Promise<void> {
  if (!isGuid(recordId)) throw new Error('Invalid dividend ID for download');
  await downloadFileField(ENTITY_SET, recordId, FILE_FIELD, fileName);
}
