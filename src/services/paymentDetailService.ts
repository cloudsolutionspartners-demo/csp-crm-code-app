import { listRecords, createRecord, updateRecord } from './dataverseService';

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}

export interface PaymentDetailRecord {
  id: string;
  name: string;
  bankName: string;
  iban: string;
  swift: string;
  isPrimary: boolean;
  accountId: string;
  currency: string;
}

const ENTITY_SET = 'csp_paymentdetails';

function mapFromDataverse(r: any): PaymentDetailRecord {
  return {
    id: norm(r.csp_paymentdetailid),
    name: r.csp_name || '',
    bankName: r.csp_bankname || '',
    iban: r.csp_iban || '',
    swift: r.csp_swift || '',
    isPrimary: r.csp_isprimary === true || r.csp_isprimary === 1,
    accountId: norm(r._csp_account_value),
    currency: 'EUR',
  };
}

export async function fetchAllPaymentDetails(): Promise<PaymentDetailRecord[]> {
  const records = await listRecords(ENTITY_SET, undefined, undefined, 'csp_name asc');
  console.log('[PaymentDetail] Fetched:', records.length, 'records');
  return records.map(mapFromDataverse);
}

export async function fetchPaymentDetailsByAccount(accountId: string): Promise<PaymentDetailRecord[]> {
  if (!accountId || !isGuid(accountId)) return [];
  console.log('[PaymentDetail] Fetching for account:', accountId);
  // Use no $select for account filter — avoids column issues
  const records = await listRecords(ENTITY_SET, undefined, `_csp_account_value eq ${accountId}`, 'csp_name asc');
  console.log('[PaymentDetail] Fetched for account:', records.length, 'records');
  return records.map(mapFromDataverse);
}

function buildPayload(data: Record<string, any>): any {
  const record: any = {};
  if (data.name !== undefined) record.csp_name = data.name || data.iban || '';
  if (data.bankName !== undefined) record.csp_bankname = data.bankName || null;
  if (data.iban !== undefined) record.csp_iban = data.iban;
  if (data.swift !== undefined) record.csp_swift = data.swift;
  if (data.isPrimary !== undefined) record.csp_isprimary = !!data.isPrimary;
  return record;
}

export async function savePaymentDetail(data: Record<string, any>, existingId?: string): Promise<string> {
  const record = buildPayload(data);
  console.log('[PaymentDetail]', existingId ? 'UPDATE ' + existingId : 'CREATE', JSON.stringify(record));
  if (existingId && isGuid(existingId)) {
    await updateRecord(ENTITY_SET, existingId, record);
    return existingId;
  }
  const newId = await createRecord(ENTITY_SET, record);
  console.log('[PaymentDetail] Created:', newId);
  return newId;
}

export async function createPaymentDetailForAccount(data: Record<string, any>, accountId: string): Promise<string> {
  const record = buildPayload(data);
  // Try setting account lookup directly on the PD
  if (accountId && isGuid(accountId)) {
    record['csp_Account@odata.bind'] = `/accounts(${accountId})`;
  }
  console.log('[PaymentDetail] Creating for account:', accountId, JSON.stringify(record));
  let newId: string;
  try {
    newId = await createRecord(ENTITY_SET, record);
    console.log('[PaymentDetail] Created with account link:', newId);
  } catch (createErr: any) {
    // If csp_Account lookup doesn't exist on PD, retry without it
    console.warn('[PaymentDetail] Create with account link failed, retrying without:', createErr?.message);
    delete record['csp_Account@odata.bind'];
    newId = await createRecord(ENTITY_SET, record);
    console.log('[PaymentDetail] Created without account link:', newId);
    // Try linking from the Account side instead
    if (newId && isGuid(newId)) {
      try {
        await updateRecord('accounts', accountId, {
          'csp_PaymentDetails@odata.bind': `/${ENTITY_SET}(${newId})`,
        });
        console.log('[PaymentDetail] Linked via Account side');
      } catch (linkErr: any) {
        console.error('[PaymentDetail] Account-side link also failed:', linkErr?.message);
      }
    }
  }
  return newId;
}
