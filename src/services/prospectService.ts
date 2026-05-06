import { listRecords, createRecord, updateRecord, deleteRecord } from './dataverseService';
import { currencyGuidToCode, currencyCodeToGuid } from './currencyMap';
import type { Prospect, ProspectStatus, ProspectSource, CurrencyCode } from '../types/crm';

function norm(v: any): string {
  return v ? String(v).toLowerCase().replace(/[{}]/g, '') : '';
}

const STATUS_REVERSE: Record<number, ProspectStatus> = {
  1: 'New',
  725070001: 'Contacted',
  725070002: 'Discussing',
  725070003: 'Proposal',
  725070004: 'Won',
  725070005: 'Lost',
};
const STATUS_FORWARD: Record<string, number> = {
  New: 1,
  Contacted: 725070001,
  Discussing: 725070002,
  Proposal: 725070003,
  Won: 725070004,
  Lost: 725070005,
};

const SOURCE_REVERSE: Record<number, ProspectSource> = {
  725070000: 'Phone',
  725070001: 'Email',
  725070002: 'Internal Referral',
  725070003: 'LinkedIn',
};
const SOURCE_FORWARD: Record<string, number> = {
  Phone: 725070000,
  Email: 725070001,
  'Internal Referral': 725070002,
  LinkedIn: 725070003,
};

function mapFromDataverse(r: any): Prospect {
  return {
    id: norm(r.csp_prospectid),
    prospectNumber: r.csp_prospectprimaryid || '',
    companyName: r.csp_companyname || '',
    country: r.csp_country || '',
    industry: r.csp_industry || '',
    website: r.csp_website || '',
    companySize: r.csp_companysize || '',
    ownerContactId: norm(r._csp_linkedcontact_value),
    source: SOURCE_REVERSE[r.csp_source] || 'Phone',
    referredByContactId: norm(r._csp_referredby_value),
    primaryContactName: r.csp_prospectingcontactname || '',
    primaryContactEmail: r.csp_prospectingcontactemail || '',
    primaryContactPhone: r.csp_prospectingcontactphone || '',
    primaryContactRole: r.csp_prospectingcontactrole || '',
    needDescription: r.csp_needdescription || '',
    servicesDiscussed: r.csp_servicesdiscussed || '',
    estimatedValue: r.csp_estimatedvalue ?? undefined,
    currencyCode: (currencyGuidToCode(r._csp_currency_value) || 'EUR') as CurrencyCode,
    expectedCloseDate: r.csp_expectedclosedate ? String(r.csp_expectedclosedate).substring(0, 10) : '',
    status: STATUS_REVERSE[r.statuscode] || 'New',
    firstContactDate: r.csp_firstcontactdate ? String(r.csp_firstcontactdate).substring(0, 10) : '',
    lastActivityDate: r.modifiedon ? String(r.modifiedon).substring(0, 10) : '',
    convertedAccountId: norm(r._csp_linkedaccount_value),
    convertedDate: r.csp_conversiondate ? String(r.csp_conversiondate).substring(0, 10) : '',
  };
}

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function mapToDataverse(data: Partial<Prospect>): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  if (data.companyName !== undefined) record.csp_companyname = data.companyName;
  if (data.country !== undefined) record.csp_country = data.country;
  if (data.industry !== undefined) record.csp_industry = data.industry;
  if (data.website !== undefined) record.csp_website = data.website;
  if (data.companySize !== undefined) record.csp_companysize = data.companySize;
  if (data.source !== undefined && SOURCE_FORWARD[data.source] !== undefined) record.csp_source = SOURCE_FORWARD[data.source];
  if (data.primaryContactName !== undefined) record.csp_prospectingcontactname = data.primaryContactName;
  if (data.primaryContactEmail !== undefined) record.csp_prospectingcontactemail = data.primaryContactEmail;
  if (data.primaryContactPhone !== undefined) record.csp_prospectingcontactphone = data.primaryContactPhone;
  if (data.primaryContactRole !== undefined) record.csp_prospectingcontactrole = data.primaryContactRole;
  if (data.needDescription !== undefined) record.csp_needdescription = data.needDescription;
  if (data.servicesDiscussed !== undefined) record.csp_servicesdiscussed = data.servicesDiscussed;
  if (data.estimatedValue !== undefined) record.csp_estimatedvalue = data.estimatedValue;
  if (data.expectedCloseDate !== undefined) record.csp_expectedclosedate = data.expectedCloseDate || null;
  if (data.firstContactDate !== undefined) record.csp_firstcontactdate = data.firstContactDate || null;
  if (data.ownerContactId && data.ownerContactId.length > 5) record['csp_LinkedContact@odata.bind'] = `/contacts(${data.ownerContactId})`;
  if (data.referredByContactId && data.referredByContactId.length > 5) record['csp_ReferredBy@odata.bind'] = `/contacts(${data.referredByContactId})`;
  if (data.convertedAccountId && data.convertedAccountId.length > 5) record['csp_LinkedAccount@odata.bind'] = `/accounts(${data.convertedAccountId})`;
  if (data.currencyCode) {
    const g = currencyCodeToGuid(data.currencyCode);
    if (g && g.length > 5) record['csp_Currency@odata.bind'] = `/transactioncurrencies(${g})`;
  }
  if (data.status !== undefined) {
    const code = STATUS_FORWARD[data.status];
    if (code !== undefined) {
      record.statecode = 0;
      record.statuscode = code;
    }
  }
  return record;
}

const SELECT = 'csp_prospectid,csp_prospectprimaryid,csp_companyname,csp_country,csp_industry,csp_website,csp_companysize,csp_source,csp_prospectingcontactname,csp_prospectingcontactemail,csp_prospectingcontactphone,csp_prospectingcontactrole,csp_needdescription,csp_servicesdiscussed,csp_estimatedvalue,csp_expectedclosedate,csp_firstcontactdate,csp_conversiondate,csp_converted,statecode,statuscode,modifiedon,_csp_linkedcontact_value,_csp_referredby_value,_csp_linkedaccount_value,_csp_currency_value,_owningbusinessunit_value';

export async function fetchProspects(): Promise<Prospect[]> {
  const records = await listRecords('csp_prospects', SELECT);
  return records.map(mapFromDataverse);
}

export async function saveProspect(data: Partial<Prospect>, id?: string): Promise<string> {
  const mapped = mapToDataverse(data);
  console.log('[Prospect] Save payload:', JSON.stringify(mapped).substring(0, 500));
  if (id && isGuid(id)) {
    await updateRecord('csp_prospects', id, mapped);
    return id;
  }
  return await createRecord('csp_prospects', mapped);
}

export async function removeProspect(id: string): Promise<void> {
  if (!isGuid(id)) return;
  await deleteRecord('csp_prospects', id);
}
