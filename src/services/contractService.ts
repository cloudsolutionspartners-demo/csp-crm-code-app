import { listRecords, createRecord, updateRecord } from './dataverseService';
import type { Contract, ContractType, ContractStatus, BillingType, CurrencyCode, PaymentTerms } from '../types/crm';

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// Reverse maps — FormattedValue annotations are NOT returned
const CONTRACT_TYPE_REVERSE: Record<number, ContractType> = {
  770400000: 'Standard Contracting', 770400001: 'Permanent Employee', 770400002: 'Fixed Price',
};
const CONTRACT_TYPE_FORWARD: Record<string, number> = {
  'Standard Contracting': 770400000, 'Permanent Employee': 770400001, 'Fixed Price': 770400002,
};

const BILLING_TYPE_REVERSE: Record<number, BillingType> = {
  770400000: 'Time & Material', 770400001: 'Fixed Price', 770400002: 'Monthly Salary', 770400003: 'Standard Contracting',
};
const BILLING_TYPE_FORWARD: Record<string, number> = {
  'Time & Material': 770400000, 'Fixed Price': 770400001, 'Monthly Salary': 770400002, 'Standard Contracting': 770400003,
};

const STATUS_REVERSE: Record<number, ContractStatus> = {
  0: 'Active', 1: 'Completed',
};

function mapFromDataverse(r: any): Contract {
  return {
    id: r.csp_contractid,
    contractNumber: r.csp_name || '',   // csp_name IS the contract name/number
    name: r.csp_name || '',
    contractType: CONTRACT_TYPE_REVERSE[r.csp_contracttype] || 'Standard Contracting',
    billingType: BILLING_TYPE_REVERSE[r.csp_billingtype] || 'Time & Material',
    entityId: r._owningbusinessunit_value || '',
    parentAccountId: r._csp_parentaccount_value || '',
    childAccountId: r._csp_childaccount_value || '',
    contactId: r._csp_assignedto_value || '',
    sellRate: r.csp_selldayrateclient ?? 0,
    sellHourlyRate: r.csp_sellhourlyrateclient ?? undefined,
    sellCurrency: 'EUR' as CurrencyCode,
    buyRate: r.csp_buydayratecontractor ?? 0,
    buyHourlyRate: r.csp_buyhourlyratecontractor ?? undefined,
    buyCurrency: 'EUR' as CurrencyCode,
    unitOfMeasure: 'Day',        // not stored in Dataverse
    payTerms: '30 Days' as PaymentTerms, // not stored in Dataverse
    margin: r.csp_margin ?? 0,
    marginPercent: r.csp_marginpercent ?? 0,
    grossValue: r.csp_grossvalue ?? undefined,
    monthlySalary: r.csp_monthlysalary ?? undefined,
    startDate: r.csp_startdate ? r.csp_startdate.split('T')[0] : '',
    endDate: r.csp_enddate ? r.csp_enddate.split('T')[0] : '',
    actualEndDate: r.csp_actualenddate ? r.csp_actualenddate.split('T')[0] : '',
    noticePeriod: '',            // not stored in Dataverse
    hasTimesheet: r.csp_hastimesheet === true,
    hasMilestones: r.csp_hasmilestones === true,
    status: STATUS_REVERSE[r.statecode] || 'Active',
  };
}

// Safe non-negative number — returns null if invalid/negative/empty
function safeNum(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  return (!isNaN(n) && n >= 0) ? n : null;
}

function mapToDataverse(data: Record<string, any>): any {
  // ONLY columns that exist on csp_contract, all decimals validated >= 0
  const record: any = {};
  if (data.name !== undefined) record.csp_name = data.name;
  if (data.contractType !== undefined && CONTRACT_TYPE_FORWARD[data.contractType] !== undefined) {
    record.csp_contracttype = CONTRACT_TYPE_FORWARD[data.contractType];
  }
  if (data.billingType !== undefined && BILLING_TYPE_FORWARD[data.billingType] !== undefined) {
    record.csp_billingtype = BILLING_TYPE_FORWARD[data.billingType];
  }
  if (data.sellRate !== undefined) { const v = safeNum(data.sellRate); if (v !== null) record.csp_selldayrateclient = v; }
  if (data.sellHourlyRate !== undefined) { const v = safeNum(data.sellHourlyRate); if (v !== null) record.csp_sellhourlyrateclient = v; }
  if (data.buyRate !== undefined) { const v = safeNum(data.buyRate); if (v !== null) record.csp_buydayratecontractor = v; }
  if (data.buyHourlyRate !== undefined) { const v = safeNum(data.buyHourlyRate); if (v !== null) record.csp_buyhourlyratecontractor = v; }
  if (data.margin !== undefined) { const v = safeNum(data.margin); if (v !== null) record.csp_margin = v; }
  if (data.marginPercent !== undefined) { const v = safeNum(data.marginPercent); if (v !== null) record.csp_marginpercent = v; }
  if (data.grossValue !== undefined) { const v = safeNum(data.grossValue); if (v !== null) record.csp_grossvalue = v; }
  if (data.monthlySalary !== undefined) { const v = safeNum(data.monthlySalary); if (v !== null) record.csp_monthlysalary = v; }
  if (data.startDate !== undefined) record.csp_startdate = data.startDate || null;
  if (data.endDate !== undefined) record.csp_enddate = data.endDate || null;
  if (data.actualEndDate !== undefined) record.csp_actualenddate = data.actualEndDate || null;
  if (data.hasTimesheet !== undefined) record.csp_hastimesheet = data.hasTimesheet;
  if (data.hasMilestones !== undefined) record.csp_hasmilestones = data.hasMilestones;
  // Lookups — only valid GUIDs
  if (data.parentAccountId && isGuid(data.parentAccountId)) {
    record['csp_parentaccount@odata.bind'] = `/accounts(${data.parentAccountId})`;
  }
  if (data.childAccountId && isGuid(data.childAccountId)) {
    record['csp_childaccount@odata.bind'] = `/accounts(${data.childAccountId})`;
  } else if (data.childAccountId === '') {
    record.csp_childaccount = null;
  }
  if (data.contactId && isGuid(data.contactId)) {
    record['csp_assignedto@odata.bind'] = `/contacts(${data.contactId})`;
  }
  return record;
}

// Only columns that EXIST on csp_contract — no csp_contractnumber, no csp_noticeperiod, no csp_unitofmeasure, no csp_payterms
const SELECT = 'csp_contractid,csp_name,csp_contracttype,csp_billingtype,csp_selldayrateclient,csp_sellhourlyrateclient,csp_buydayratecontractor,csp_buyhourlyratecontractor,csp_margin,csp_marginpercent,csp_grossvalue,csp_monthlysalary,csp_startdate,csp_enddate,csp_actualenddate,csp_hastimesheet,csp_hasmilestones,_csp_parentaccount_value,_csp_childaccount_value,_csp_assignedto_value,statecode,statuscode';

export async function fetchContracts(): Promise<Contract[]> {
  // Entity set name is plural: csp_contracts
  const records = await listRecords('csp_contracts', SELECT, undefined, 'csp_name asc');
  if (records.length > 0) {
    console.log('[Contracts] csp_contracttype values:', records.map((r: any) => r.csp_contracttype));
    console.log('[Contracts] csp_billingtype values:', records.map((r: any) => r.csp_billingtype));
    console.log('[Contracts] statecode values:', records.map((r: any) => r.statecode));
  }
  return records.map(mapFromDataverse);
}

export async function saveContract(data: Record<string, any>, existingId?: string): Promise<string> {
  const mapped = mapToDataverse(data);
  if (existingId && isGuid(existingId)) {
    await updateRecord('csp_contracts', existingId, mapped);
    return existingId;
  }
  return await createRecord('csp_contracts', mapped);
}
