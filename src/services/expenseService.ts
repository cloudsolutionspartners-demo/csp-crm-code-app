import { listRecords, createRecord, updateRecord, deleteRecord } from './dataverseService';
import { getTeamIdForBU } from './businessUnitService';
import { currencyGuidToCode, currencyCodeToGuid } from './currencyMap';
import type { Expense, ExpenseType, ExpenseStatus } from '../types/crm';

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}
function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

const EXPENSE_TYPE_REVERSE: Record<number, ExpenseType> = {
  770400000: 'Contractor Payment', 770400001: 'Supplier Invoice', 770400002: 'Tax',
  770400003: 'Permanent Employee', 770400004: 'Operating Cost', 770400006: 'Software Subscription',
};
const EXPENSE_TYPE_FORWARD: Record<string, number> = {
  'Contractor Payment': 770400000, 'Supplier Invoice': 770400001, 'Tax': 770400002,
  'Permanent Employee': 770400003, 'Operating Cost': 770400004, 'Software Subscription': 770400006,
};

const STATUS_REVERSE: Record<number, ExpenseStatus> = {
  1: 'Pending', 770400002: 'Paid', 770400003: 'Rejected',
};
const STATUS_FORWARD: Record<string, number> = {
  Pending: 1, Approved: 1, Paid: 770400002, Rejected: 770400003,
};

function mapFromDataverse(r: any): Expense {
  const total = r.csp_totalamount ?? 0;
  const vat = r.csp_vat ?? 0;
  return {
    id: norm(r.csp_expenseid),
    reference: r.csp_name || '',
    entityId: norm(r._owningbusinessunit_value),
    accountId: norm(r._csp_account_value),
    expenseType: EXPENSE_TYPE_REVERSE[r.csp_expensetype] || 'Operating Cost',
    contractId: norm(r._csp_contract_value),
    currencyCode: (currencyGuidToCode(r._transactioncurrencyid_value) || 'EUR') as any,
    totalAmount: total,
    vatAmount: vat,
    netAmount: total - vat,
    dateIssued: r.csp_dateissued ? r.csp_dateissued.substring(0, 10) : '',
    dueDate: r.csp_duedate ? r.csp_duedate.substring(0, 10) : '',
    paymentDate: r.csp_paymentdate ? r.csp_paymentdate.substring(0, 10) : undefined,
    vendorInvoiceNumber: r.csp_vendorinvoicenumber || '',
    status: STATUS_REVERSE[r.statuscode] || 'Pending',
    periodMonth: r.csp_periodmonth || 0,
    periodYear: r.csp_periodyear || 0,
    documentName: r.csp_document_name || '',
  } as Expense & { documentName: string };
}

function mapToDataverse(data: Record<string, any>): any {
  const record: any = {};
  if (data.reference !== undefined) record.csp_name = data.reference;
  if (data.expenseType !== undefined) record.csp_expensetype = EXPENSE_TYPE_FORWARD[data.expenseType] ?? null;
  if (data.dateIssued !== undefined) record.csp_dateissued = data.dateIssued || null;
  if (data.dueDate !== undefined) record.csp_duedate = data.dueDate || null;
  if (data.paymentDate !== undefined) record.csp_paymentdate = data.paymentDate || null;
  if (data.totalAmount !== undefined) {
    console.log('[Expense] totalAmount raw:', data.totalAmount, 'type:', typeof data.totalAmount);
    console.log('[Expense] totalAmount Number():', Number(data.totalAmount));
    record.csp_totalamount = Number(data.totalAmount) || null;
    console.log('[Expense] csp_totalamount saved as:', record.csp_totalamount);
  }
  if (data.vatAmount !== undefined) record.csp_vat = Number(data.vatAmount) || null;
  if (data.vendorInvoiceNumber !== undefined) record.csp_vendorinvoicenumber = data.vendorInvoiceNumber || null;
  if (data.status !== undefined) {
    const code = STATUS_FORWARD[data.status];
    if (code !== undefined) {
      record.statecode = 0;
      record.statuscode = code;
    }
  }
  if (data.accountId && isGuid(data.accountId)) {
    record['csp_account@odata.bind'] = `/accounts(${data.accountId})`;
  }
  if (data.contractId && isGuid(data.contractId)) {
    record['csp_contract@odata.bind'] = `/csp_contracts(${data.contractId})`;
  }
  if (data.periodMonth !== undefined && data.periodMonth !== '' && data.periodMonth !== 0) {
    const v = Number(data.periodMonth);
    if (!isNaN(v) && v >= 1 && v <= 12) record.csp_periodmonth = v;
  }
  if (data.periodYear !== undefined && data.periodYear !== '' && data.periodYear !== 0) {
    const v = Number(data.periodYear);
    if (!isNaN(v) && v >= 2000 && v <= 2100) record.csp_periodyear = v;
  }
  if (data.currencyCode) {
    const guid = currencyCodeToGuid(data.currencyCode);
    if (guid) {
      record['transactioncurrencyid@odata.bind'] = `/transactioncurrencies(${guid})`;
    }
  }
  return record;
}

const SELECT = 'csp_expenseid,csp_name,_csp_account_value,_csp_contract_value,csp_expensetype,csp_dateissued,csp_duedate,csp_paymentdate,csp_totalamount,csp_vat,csp_vendorinvoicenumber,csp_periodmonth,csp_periodyear,statecode,statuscode,createdon,_owningbusinessunit_value,csp_document_name,_transactioncurrencyid_value';

export async function fetchExpenses(): Promise<Expense[]> {
  const records = await listRecords('csp_expenses', SELECT, undefined, 'createdon desc');
  return records.map(mapFromDataverse);
}

export async function saveExpense(data: Record<string, any>, existingId?: string, originalEntityId?: string): Promise<string> {
  const mapped = mapToDataverse(data);
  // Country = Business Unit. Reassign ownership to the BU's default team when changed.
  const newBuId = data.entityId;
  if (newBuId && isGuid(newBuId) && newBuId !== originalEntityId) {
    const teamId = getTeamIdForBU(newBuId);
    if (teamId) {
      mapped['ownerid@odata.bind'] = `/teams(${teamId})`;
    }
  }
  if (existingId && isGuid(existingId)) {
    await updateRecord('csp_expenses', existingId, mapped);
    return existingId;
  }
  return await createRecord('csp_expenses', mapped);
}

export async function removeExpense(id: string): Promise<void> {
  await deleteRecord('csp_expenses', id);
}
