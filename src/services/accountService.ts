import { listRecords, createRecord, updateRecord } from './dataverseService';
import type { Account, AccountType, AccountStatus, PaymentTerms } from '../types/crm';

// GUID validator — mock IDs like "acc-2" must not be sent in @odata.bind
function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
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
    id: r.accountid,
    accountNumber: r.accountnumber || '',
    name: r.name || '',
    accountType: ACCOUNT_TYPE_REVERSE[r.csp_accounttype] || 'Direct Customer',
    entityId: r._owningbusinessunit_value || '',
    country: r.address1_country || '',
    vatNumber: r.csp_vatnumber || '',
    registrationNumber: r.csp_registrationnumber || '',
    paymentTerms: PAYMENT_TERMS_REVERSE[r.paymenttermscode] || '30 Days',
    invoiceComments: r.csp_invoicecomments || '',
    invoicingEmail: r.csp_invoicingemail || '',
    address: r.address1_composite || '',
    addressStreet: r.address1_line1 || '',
    addressCity: r.address1_city || '',
    addressState: r.address1_stateorprovince || '',
    addressPostalCode: r.address1_postalcode || '',
    addressCountry: r.address1_country || '',
    phone: r.telephone1 || '',
    email: r.emailaddress1 || '',
    website: r.websiteurl || '',
    invoiceFooter: r.csp_invoicefooter || '',
    paymentDetails: r.csp_paymentdetails || '',
    status: STATUS_REVERSE[r.statecode] || 'Active',
    activeContracts: 0,
  };
}

function mapToDataverse(data: Record<string, any>): any {
  const record: any = {};
  if (data.name !== undefined) record.name = data.name;
  if (data.accountType !== undefined) record.csp_accounttype = ACCOUNT_TYPE_FORWARD[data.accountType] ?? null;
  if (data.vatNumber !== undefined) record.csp_vatnumber = data.vatNumber;
  if (data.registrationNumber !== undefined) record.csp_registrationnumber = data.registrationNumber;
  if (data.paymentTerms !== undefined) record.paymenttermscode = PAYMENT_TERMS_FORWARD[data.paymentTerms] ?? null;
  if (data.email !== undefined) record.emailaddress1 = data.email;
  if (data.invoicingEmail !== undefined) record.csp_invoicingemail = data.invoicingEmail;
  if (data.phone !== undefined) record.telephone1 = data.phone;
  if (data.website !== undefined) record.websiteurl = data.website;
  if (data.invoiceComments !== undefined) record.csp_invoicecomments = data.invoiceComments;
  if (data.addressStreet !== undefined) record.address1_line1 = data.addressStreet;
  if (data.addressCity !== undefined) record.address1_city = data.addressCity;
  if (data.addressState !== undefined) record.address1_stateorprovince = data.addressState;
  if (data.addressPostalCode !== undefined) record.address1_postalcode = data.addressPostalCode;
  if (data.addressCountry !== undefined) record.address1_country = data.addressCountry;
  if (data.invoiceFooter !== undefined) record.csp_invoicefooter = data.invoiceFooter;
  if (data.paymentDetails !== undefined) record.csp_paymentdetails = data.paymentDetails;
  return record;
}

// ===== Public API =====

const SELECT = 'accountid,name,statecode,statuscode,csp_accounttype,address1_country,paymenttermscode,emailaddress1,telephone1,websiteurl,csp_vatnumber,csp_registrationnumber,csp_invoicingemail,csp_invoicecomments,address1_composite,_owningbusinessunit_value,address1_line1,address1_city,address1_stateorprovince,address1_postalcode,csp_invoicefooter,csp_paymentdetails';

export async function fetchAccounts(): Promise<Account[]> {
  const records = await listRecords('accounts', SELECT, undefined, 'name asc');
  return records.map(mapFromDataverse);
}

export async function saveAccount(data: Record<string, any>, existingId?: string): Promise<string> {
  const mapped = mapToDataverse(data);
  if (existingId && isGuid(existingId)) {
    await updateRecord('accounts', existingId, mapped);
    return existingId;
  }
  return await createRecord('accounts', mapped);
}
