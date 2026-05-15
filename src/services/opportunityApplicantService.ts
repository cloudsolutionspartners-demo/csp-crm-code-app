import { listRecords, createRecord, updateRecord, deleteRecord } from './dataverseService';
import type { OpportunityApplicant, ApplicantStatus } from '../types/crm';

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}
function fv(r: any, key: string): string {
  return r[`${key}@OData.Community.Display.V1.FormattedValue`] || '';
}

const STATUS_REVERSE: Record<number, ApplicantStatus> = {
  1: 'Drafted',
  725070003: 'Sent',
  725070001: 'Accepted',
  725070002: 'Rejected',
};
const STATUS_FORWARD: Record<string, number> = {
  Drafted: 1,
  Sent: 725070003,
  Accepted: 725070001,
  Rejected: 725070002,
};

const SELECT = [
  'csp_opportunityapplicantid',
  'csp_opportunityapplicantprimaryid',
  'csp_rate',
  'csp_document_name',
  'statecode',
  'statuscode',
  'createdon',
  '_csp_opportunity_value',
  '_csp_candidate_value',
  '_csp_contact_value',
  '_csp_rateunit_value',
  '_csp_ratecurrency_value',
].join(',');

function mapFromDataverse(r: any): OpportunityApplicant {
  return {
    id: norm(r.csp_opportunityapplicantid),
    opportunityId: norm(r._csp_opportunity_value),
    candidateId: norm(r._csp_candidate_value) || undefined,
    contactId: norm(r._csp_contact_value) || undefined,
    rate: r.csp_rate ?? undefined,
    rateUnit: fv(r, '_csp_rateunit_value'),
    rateCurrency: fv(r, '_csp_ratecurrency_value'),
    status: STATUS_REVERSE[r.statuscode] || 'Drafted',
    documentFileName: r.csp_document_name || undefined,
  };
}

export async function fetchOpportunityApplicants(opportunityId?: string): Promise<OpportunityApplicant[]> {
  const filter = opportunityId ? `_csp_opportunity_value eq ${opportunityId}` : undefined;
  const records = await listRecords('csp_opportunityapplicants', SELECT, filter, 'createdon desc');
  return records.map(mapFromDataverse);
}

export async function saveOpportunityApplicant(
  data: Partial<OpportunityApplicant> & { rateUnitId?: string; currencyId?: string },
  existingId?: string,
): Promise<string> {
  const record: any = {};
  if (data.opportunityId !== undefined) {
    record['csp_Opportunity@odata.bind'] = data.opportunityId ? `/csp_opportunities(${data.opportunityId})` : null;
  }
  if (data.candidateId !== undefined) {
    record['csp_Candidate@odata.bind'] = data.candidateId ? `/csp_candidates(${data.candidateId})` : null;
  }
  if (data.contactId !== undefined) {
    record['csp_Contact@odata.bind'] = data.contactId ? `/contacts(${data.contactId})` : null;
  }
  if (data.rate !== undefined) {
    const v = Number(data.rate);
    record.csp_rate = !isNaN(v) && v >= 0 ? v : null;
  }
  if (data.rateUnitId !== undefined) {
    record['csp_RateUnit@odata.bind'] = data.rateUnitId ? `/csp_unitofmeasures(${data.rateUnitId})` : null;
  }
  if (data.currencyId !== undefined) {
    record['csp_RateCurrency@odata.bind'] = data.currencyId ? `/transactioncurrencies(${data.currencyId})` : null;
  }
  if (data.status !== undefined) {
    const code = STATUS_FORWARD[data.status];
    if (code !== undefined) {
      record.statuscode = code;
      record.statecode = 0;
    }
  }

  if (existingId && isGuid(existingId)) {
    await updateRecord('csp_opportunityapplicants', existingId, record);
    return existingId;
  }
  return await createRecord('csp_opportunityapplicants', record);
}

export async function removeOpportunityApplicant(id: string): Promise<void> {
  await deleteRecord('csp_opportunityapplicants', id);
}
