import { listRecords, createRecord, updateRecord, deleteRecord } from './dataverseService';
import { getTeamIdForBU } from './businessUnitService';
import { currencyGuidToCode, currencyCodeToGuid } from './currencyMap';
import type { Invoice, InvoiceStatus, CurrencyCode } from '../types/crm';

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}

// ===== Status mapping =====
// statuscode: 1=Draft, 770400001=Sent, 770400002=Paid, 770400003=Overdue, 770400004=Cancelled, 770400005=Credit Note
const STATUS_REVERSE: Record<number, InvoiceStatus> = {
  1: 'Draft',
  725070001: 'Sent',
  725070002: 'Paid',
  725070003: 'Overdue',
  725070004: 'Cancelled',
  725070005: 'Credit Note',
};
const STATUS_FORWARD: Record<string, number> = {
  'Draft': 1,
  'Sent': 725070001,
  'Paid': 725070002,
  'Overdue': 725070003,
  'Cancelled': 725070004,
  'Credit Note': 725070005,
};

// ===== Mapping =====

function mapFromDataverse(r: any): Invoice {
  return {
    id: norm(r.csp_invoiceid),
    invoiceNumber: r.csp_name || '',
    entityId: norm(r._owningbusinessunit_value),
    accountId: norm(r._csp_account_value),
    parentAccountId: '',
    parentAccountName: '',
    accountName: r['_csp_account_value@OData.Community.Display.V1.FormattedValue'] || '',
    contractId: '',
    currencyCode: (currencyGuidToCode(r._transactioncurrencyid_value) || 'EUR') as CurrencyCode,
    invoiceDate: r.csp_invoicedate ? r.csp_invoicedate.substring(0, 10) : '',
    dueDate: r.csp_duedate ? r.csp_duedate.substring(0, 10) : '',
    subtotal: 0,
    vatRate: r.csp_vatrate ?? 0,
    vatAmount: r.csp_vatamount ?? 0,
    total: r.csp_total ?? 0,
    ronConversionRate: r.csp_ronconversionrate ?? undefined,
    ronTotal: r.csp_rontotalvalue ?? undefined,
    comments: r.csp_comments || '',
    status: STATUS_REVERSE[r.statuscode] || 'Draft',
    paymentReceivedDate: r.csp_paymentdate ? r.csp_paymentdate.substring(0, 10) : undefined,
    periodMonth: 0,
    periodYear: 0,
    lines: [],
  };
}

function mapToDataverse(data: Record<string, any>): any {
  const record: any = {};
  if (data.invoiceNumber !== undefined) record.csp_name = data.invoiceNumber;
  if (data.invoiceDate !== undefined) record.csp_invoicedate = data.invoiceDate || null;
  if (data.dueDate !== undefined) record.csp_duedate = data.dueDate || null;
  if (data.paymentReceivedDate !== undefined) record.csp_paymentdate = data.paymentReceivedDate || null;
  if (data.total !== undefined) record.csp_total = Number(data.total) || null;
  if (data.vatRate !== undefined) record.csp_vatrate = Number(data.vatRate) || null;
  if (data.vatAmount !== undefined) record.csp_vatamount = Number(data.vatAmount) || null;
  if (data.ronConversionRate !== undefined) record.csp_ronconversionrate = Number(data.ronConversionRate) || null;
  if (data.ronTotalValue !== undefined) record.csp_rontotalvalue = Number(data.ronTotalValue) || null;
  if (data.comments !== undefined) record.csp_comments = data.comments || null;
  if (data.status !== undefined) {
    const code = STATUS_FORWARD[data.status];
    if (code !== undefined) {
      record.statecode = 0; // All invoice statuses are under Active statecode
      record.statuscode = code;
    }
  }

  // Lookups — navigation property casing is table-specific and case-sensitive
  // csp_invoice: csp_account (lowercase)
  if (data.accountId && isGuid(data.accountId)) {
    record['csp_account@odata.bind'] = `/accounts(${data.accountId})`;
  }

  if (data.currencyCode) {
    const g = currencyCodeToGuid(data.currencyCode);
    if (g) record['transactioncurrencyid@odata.bind'] = `/transactioncurrencies(${g})`;
  }

  return record;
}

// ===== Public API =====

const SELECT = 'csp_invoiceid,csp_name,_csp_account_value,csp_invoicedate,csp_duedate,csp_paymentdate,csp_total,csp_vatamount,csp_vatrate,csp_ronconversionrate,csp_rontotalvalue,csp_comments,statecode,statuscode,createdon,_owningbusinessunit_value,_transactioncurrencyid_value';

export async function fetchInvoices(): Promise<Invoice[]> {
  const records = await listRecords('csp_invoices', SELECT, undefined, 'createdon desc');
  return records.map(mapFromDataverse);
}

export async function saveInvoice(data: Record<string, any>, existingId?: string): Promise<string> {
  const mapped = mapToDataverse(data);

  // Country = Business Unit. We can't set owningbusinessunit directly; reassign
  // the record to the BU's default owning team via ownerid.
  if (data.entityId && isGuid(data.entityId)) {
    const teamId = getTeamIdForBU(data.entityId);
    if (teamId) {
      mapped['ownerid@odata.bind'] = `/teams(${teamId})`;
    }
  }

  if (existingId && isGuid(existingId)) {
    await updateRecord('csp_invoices', existingId, mapped);
    return existingId;
  }
  return await createRecord('csp_invoices', mapped);
}

export async function removeInvoice(id: string): Promise<void> {
  await deleteRecord('csp_invoices', id);
}
