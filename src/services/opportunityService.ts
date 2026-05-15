import { listRecords, createRecord, updateRecord, deleteRecord } from './dataverseService';
import type { Opportunity, OpportunitySource, OpportunityStatus } from '../types/crm';

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}

const SOURCE_REVERSE: Record<number, OpportunitySource> = {
  725070000: 'From Existing Client',
  725070001: 'From Prospect',
  725070002: 'From New Client',
  725070003: 'From Existing Consultant',
};
const SOURCE_FORWARD: Record<string, number> = {
  'From Existing Client': 725070000,
  'From Prospect': 725070001,
  'From New Client': 725070002,
  'From Existing Consultant': 725070003,
};

const STATUS_REVERSE: Record<number, OpportunityStatus> = {
  1: 'New',
  725070001: 'Interview Booked',
  725070002: 'Won',
  725070003: 'Lost',
};
const STATUS_FORWARD: Record<string, number> = {
  New: 1,
  'Interview Booked': 725070001,
  Won: 725070002,
  Lost: 725070003,
};

const SELECT = [
  'csp_opportunityid',
  'csp_opportunityprimaryid',
  'csp_source',
  'csp_role',
  'csp_opportunityrate',
  'csp_newclientname',
  'csp_opportunitydetails',
  'csp_outcomecomments',
  'csp_startdate',
  'csp_closingdate',
  'statecode',
  'statuscode',
  'createdon',
  '_csp_account_value',
  '_csp_prospect_value',
  '_csp_contact_value',
  '_csp_opportunitycurrency_value',
  '_csp_opportunityrateunit_value',
].join(',');

function fv(r: any, key: string): string {
  return r[`${key}@OData.Community.Display.V1.FormattedValue`] || '';
}

function mapFromDataverse(r: any): Opportunity {
  const accountId = norm(r._csp_account_value);
  const prospectId = norm(r._csp_prospect_value);
  const contactId = norm(r._csp_contact_value);
  return {
    id: norm(r.csp_opportunityid),
    opportunityNumber: r.csp_opportunityprimaryid || '',
    source: SOURCE_REVERSE[r.csp_source] || 'From New Client',
    clientLinkType: accountId
      ? 'Account'
      : prospectId
        ? 'Prospect'
        : contactId
          ? 'Contact'
          : 'Free Text',
    accountId: accountId || undefined,
    accountName: fv(r, '_csp_account_value'),
    prospectId: prospectId || undefined,
    prospectName: fv(r, '_csp_prospect_value'),
    freeClientName: r.csp_newclientname || undefined,
    sourceContactId: contactId || undefined,
    sourceContactName: fv(r, '_csp_contact_value'),
    role: r.csp_role || '',
    opportunityRate: r.csp_opportunityrate ?? undefined,
    opportunityRateUnit: fv(r, '_csp_opportunityrateunit_value'),
    opportunityCurrency: fv(r, '_csp_opportunitycurrency_value'),
    startDate: r.csp_startdate ? String(r.csp_startdate).substring(0, 10) : '',
    closingDate: r.csp_closingdate ? String(r.csp_closingdate).substring(0, 10) : '',
    details: r.csp_opportunitydetails || '',
    outcomeComments: r.csp_outcomecomments || '',
    status: STATUS_REVERSE[r.statuscode] || 'New',
    createdAt: r.createdon ? String(r.createdon).substring(0, 10) : '',
  };
}

export async function fetchOpportunities(): Promise<Opportunity[]> {
  const records = await listRecords('csp_opportunities', SELECT, undefined, 'createdon desc');
  return records.map(mapFromDataverse);
}

export async function saveOpportunity(data: Partial<Opportunity> & {
  rateUnitId?: string;
  currencyId?: string;
}, existingId?: string): Promise<string> {
  const record: any = {};
  if (data.source !== undefined) record.csp_source = SOURCE_FORWARD[data.source] ?? null;
  if (data.role !== undefined) record.csp_role = data.role || null;
  if (data.opportunityRate !== undefined) {
    const v = Number(data.opportunityRate);
    record.csp_opportunityrate = !isNaN(v) && v >= 0 ? v : null;
  }
  if (data.freeClientName !== undefined) record.csp_newclientname = data.freeClientName || null;
  if (data.details !== undefined) record.csp_opportunitydetails = data.details || null;
  if (data.outcomeComments !== undefined) record.csp_outcomecomments = data.outcomeComments || null;
  if (data.startDate !== undefined) record.csp_startdate = data.startDate || null;
  if (data.closingDate !== undefined) record.csp_closingdate = data.closingDate || null;
  if (data.status !== undefined) {
    const code = STATUS_FORWARD[data.status];
    if (code !== undefined) {
      record.statuscode = code;
      record.statecode = (data.status === 'Lost' || data.status === 'Won') ? 0 : 0;
    }
  }

  if (data.accountId !== undefined) {
    record['csp_Account@odata.bind'] = data.accountId ? `/accounts(${data.accountId})` : null;
  }
  if (data.prospectId !== undefined) {
    record['csp_Prospect@odata.bind'] = data.prospectId ? `/csp_prospects(${data.prospectId})` : null;
  }
  if (data.sourceContactId !== undefined) {
    record['csp_Contact@odata.bind'] = data.sourceContactId ? `/contacts(${data.sourceContactId})` : null;
  }
  if (data.rateUnitId !== undefined) {
    record['csp_OpportunityRateUnit@odata.bind'] = data.rateUnitId ? `/csp_unitofmeasures(${data.rateUnitId})` : null;
  }
  if (data.currencyId !== undefined) {
    record['csp_OpportunityCurrency@odata.bind'] = data.currencyId ? `/transactioncurrencies(${data.currencyId})` : null;
  }

  if (existingId && isGuid(existingId)) {
    await updateRecord('csp_opportunities', existingId, record);
    return existingId;
  }
  return await createRecord('csp_opportunities', record);
}

export async function removeOpportunity(id: string): Promise<void> {
  await deleteRecord('csp_opportunities', id);
}
