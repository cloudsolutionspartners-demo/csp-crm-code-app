import { listRecords, createRecord, updateRecord } from './dataverseService';
import { getTeamIdForBU } from './businessUnitService';
import type { Account, AccountType, AccountStatus, PaymentTerms } from '../types/crm';

// GUID helpers
function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
// Strip braces and lowercase — Dataverse sometimes returns {GUID} or uppercase
function normalizeGuid(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}

// ===== Reverse maps (int→string) — FormattedValue annotations are NOT returned =====

const ACCOUNT_TYPE_REVERSE: Record<number, AccountType> = {
  770400000: 'Direct Customer', 770400001: 'Recruiter Client', 770400002: 'Recruiter Agency',
  770400003: 'Partner B2B', 770400004: 'Contractor', 770400005: 'Supplier', 770400006: 'Legal Taxes',
};
const ACCOUNT_TYPE_FORWARD: Record<string, number> = {
  'Direct Customer': 770400000, 'Recruiter Client': 770400001, 'Recruiter Agency': 770400002,
  'Partner B2B': 770400003, 'Contractor': 770400004, 'Supplier': 770400005, 'Legal Taxes': 770400006,
};

const PAYMENT_TERMS_REVERSE: Record<number, PaymentTerms> = {
  1: '15 Days', 2: '30 Days', 3: '45 Days', 4: '60 Days',
};
const PAYMENT_TERMS_FORWARD: Record<string, number> = {
  '15 Days': 1, '30 Days': 2, '45 Days': 3, '60 Days': 4,
};

const STATUS_REVERSE: Record<number, AccountStatus> = {
  0: 'Active', 1: 'Inactive',
};

// ===== Mapping =====

function mapFromDataverse(r: any): Account {
  return {
    id: normalizeGuid(r.accountid),
    accountNumber: r.accountnumber || '',
    name: r.name || '',
    accountType: ACCOUNT_TYPE_REVERSE[r.csp_accounttype] || 'Direct Customer',
    entityId: normalizeGuid(r._owningbusinessunit_value),
    primaryContactId: normalizeGuid(r._primarycontactid_value),
    parentAccountId: normalizeGuid(r._parentaccountid_value),
    country: r.address1_country || '',
    vatNumber: r.csp_vatnumber || '',
    registrationNumber: r.csp_registrationnumber || '',
    paymentTerms: PAYMENT_TERMS_REVERSE[r.paymenttermscode] || '30 Days',
    invoiceComments: r.csp_invoicecomments || '',
    invoiceFooter: r.csp_invoicefooter || '',
    invoicingEmail: r.csp_invoicingemail || '',
    address: '', // deprecated — use individual fields below
    street1: r.address1_line1 || '',
    street2: r.address1_line2 || '',
    street3: r.address1_line3 || '',
    city: r.address1_city || '',
    stateProvince: r.address1_stateorprovince || '',
    postalCode: r.address1_postalcode || '',
    phone: r.telephone1 || '',
    email: r.emailaddress1 || '',
    website: r.websiteurl || '',
    status: STATUS_REVERSE[r.statecode] || 'Active',
    activeContracts: 0,
  };
}

function mapToDataverse(data: Record<string, any>): any {
  const record: any = {};
  if (data.name !== undefined) record.name = data.name;
  if (data.accountType !== undefined) record.csp_accounttype = ACCOUNT_TYPE_FORWARD[data.accountType] ?? null;
  if (data.street1 !== undefined) record.address1_line1 = data.street1;
  if (data.street2 !== undefined) record.address1_line2 = data.street2;
  if (data.street3 !== undefined) record.address1_line3 = data.street3;
  if (data.city !== undefined) record.address1_city = data.city;
  if (data.stateProvince !== undefined) record.address1_stateorprovince = data.stateProvince;
  if (data.postalCode !== undefined) record.address1_postalcode = data.postalCode;
  if (data.addressCountry !== undefined) record.address1_country = data.addressCountry;
  // Business Unit: owningbusinessunit is READ-ONLY — cannot be changed via PATCH
  // Must be changed by admin via Assign action or team membership
  if (data.vatNumber !== undefined) record.csp_vatnumber = data.vatNumber;
  if (data.registrationNumber !== undefined) record.csp_registrationnumber = data.registrationNumber;
  if (data.paymentTerms !== undefined) record.paymenttermscode = PAYMENT_TERMS_FORWARD[data.paymentTerms] ?? null;
  if (data.email !== undefined) record.emailaddress1 = data.email;
  if (data.invoicingEmail !== undefined) record.csp_invoicingemail = data.invoicingEmail;
  if (data.phone !== undefined) record.telephone1 = data.phone;
  // address1_composite is read-only — removed
  if (data.website !== undefined) record.websiteurl = data.website;
  if (data.invoiceComments !== undefined) record.csp_invoicecomments = data.invoiceComments;
  if (data.invoiceFooter !== undefined) record.csp_invoicefooter = data.invoiceFooter;
  // Primary Contact lookup
  if (data.primaryContactId && isGuid(data.primaryContactId)) {
    record['primarycontactid@odata.bind'] = `/contacts(${data.primaryContactId})`;
  }
  // Parent Account lookup
  if (data.parentAccountId && isGuid(data.parentAccountId)) {
    record['parentaccountid@odata.bind'] = `/accounts(${data.parentAccountId})`;
  }
  // Status
  if (data.status === 'Active') { record.statecode = 0; record.statuscode = 1; }
  else if (data.status === 'Inactive') { record.statecode = 1; record.statuscode = 2; }
  return record;
}

// ===== Public API =====

const SELECT = 'accountid,name,statecode,statuscode,csp_accounttype,address1_line1,address1_line2,address1_line3,address1_city,address1_stateorprovince,address1_postalcode,address1_country,paymenttermscode,emailaddress1,telephone1,websiteurl,csp_vatnumber,csp_registrationnumber,csp_invoicingemail,csp_invoicecomments,csp_invoicefooter,_owningbusinessunit_value,_primarycontactid_value,_parentaccountid_value';

export async function fetchAccounts(): Promise<Account[]> {
  const records = await listRecords('accounts', SELECT, undefined, 'name asc');
  return records.map(mapFromDataverse);
}

export async function saveAccount(data: Record<string, any>, existingId?: string, originalEntityId?: string): Promise<string> {
  const mapped = mapToDataverse(data);

  // If BU changed, set ownerid to the default team of the new BU
  const newBuId = data.entityId;
  if (newBuId && isGuid(newBuId) && newBuId !== originalEntityId) {
    const teamId = getTeamIdForBU(newBuId);
    if (teamId) {
      mapped['ownerid@odata.bind'] = `/teams(${teamId})`;
    }
  }

  if (existingId && isGuid(existingId)) {
    await updateRecord('accounts', existingId, mapped);
    return existingId;
  }
  return await createRecord('accounts', mapped);
}
