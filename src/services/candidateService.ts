import { listRecords, createRecord, updateRecord } from './dataverseService';
import { currencyGuidToCode, currencyCodeToGuid } from './currencyMap';
import type { CandidateSource } from '../types/crm';

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}

// Picklist maps
const PATH_REVERSE: Record<number, string> = { 725070000: 'B2B seeking Contracts', 725070001: 'CIM to B2B' };
const PATH_FORWARD: Record<string, number> = { 'B2B seeking Contracts': 725070000, 'CIM to B2B': 725070001 };

const AI_DECISION_REVERSE: Record<number, string> = {
  725070000: 'Fit for JD', 725070001: 'Unfit for JD', 725070002: 'Needs Human Technical Assessment',
};

const STATUS_REVERSE: Record<number, string> = {
  1: 'Fit', 725070001: 'Not Fit', 725070002: 'Applied', 725070003: 'Scheduled', 2: 'Inactive',
};
const STATUS_FORWARD: Record<string, number> = {
  Fit: 1, 'Not Fit': 725070001, Applied: 725070002, Scheduled: 725070003, Inactive: 2,
};

const SOURCE_REVERSE: Record<number, CandidateSource> = {
  725070000: 'Website', 725070001: 'Recruiter', 725070002: 'Referral',
};
const SOURCE_FORWARD: Record<string, number> = {
  Website: 725070000, Recruiter: 725070001, Referral: 725070002,
};

export interface CandidateRecord {
  id: string;
  candidateIdNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  path: string;
  candidateRole: string;
  cvFileName: string;
  hourlyRateEur: number;
  b2bEntityName: string;
  aiDecision: string;
  aiSummary: string;
  aiSuggestedRate: number;
  currencyCode: string;
  status: string;
  appliedDate: string;
  source: CandidateSource;
}

function mapFromDataverse(r: any): CandidateRecord {
  return {
    id: norm(r.csp_candidateid),
    candidateIdNumber: r.csp_candidateidnumber || '',
    firstName: r.csp_firstname || '',
    lastName: r.csp_lastname || '',
    email: r.csp_email || '',
    phone: r.csp_phone || '',
    path: PATH_REVERSE[r.csp_path] || 'B2B seeking Contracts',
    candidateRole: r.csp_candidaterole || '',
    cvFileName: r.csp_candidatecv_name || '',
    hourlyRateEur: r.csp_candidatehourlyrate ?? 0,
    b2bEntityName: r.csp_b2bentityname || '',
    aiDecision: AI_DECISION_REVERSE[r.csp_aitechnicaldecission] || '',
    aiSummary: r.csp_aitechnicalsummary || '',
    aiSuggestedRate: r.csp_aisuggestedhourlyrate ?? 0,
    currencyCode: currencyGuidToCode(r._csp_candidatecurrency_value),
    status: STATUS_REVERSE[r.statuscode] || 'Applied',
    appliedDate: r.createdon ? r.createdon.split('T')[0] : '',
    source: SOURCE_REVERSE[r.csp_source] || 'Website',
  };
}

const SELECT = 'csp_candidateid,csp_candidateidnumber,csp_firstname,csp_lastname,csp_email,csp_phone,csp_path,csp_candidaterole,csp_candidatecv_name,csp_candidatehourlyrate,csp_b2bentityname,csp_aitechnicaldecission,csp_aitechnicalsummary,csp_aisuggestedhourlyrate,_csp_candidatecurrency_value,csp_source,statecode,statuscode,createdon';

export async function fetchCandidates(): Promise<CandidateRecord[]> {
  const records = await listRecords('csp_candidates', SELECT, undefined, 'createdon desc');
  return records.map(mapFromDataverse);
}

export async function saveCandidate(data: Record<string, any>, existingId?: string): Promise<string> {
  const record: any = {};
  if (data.firstName !== undefined) record.csp_firstname = data.firstName;
  if (data.lastName !== undefined) record.csp_lastname = data.lastName;
  if (data.email !== undefined) record.csp_email = data.email;
  if (data.phone !== undefined) record.csp_phone = data.phone || null;
  if (data.path !== undefined && PATH_FORWARD[data.path] !== undefined) {
    record.csp_path = PATH_FORWARD[data.path];
  }
  if (data.candidateRole !== undefined) record.csp_candidaterole = data.candidateRole || null;
  if (data.hourlyRateEur !== undefined) {
    const v = Number(data.hourlyRateEur);
    if (!isNaN(v) && v >= 0) record.csp_candidatehourlyrate = v;
  }
  if (data.b2bEntityName !== undefined) record.csp_b2bentityname = data.b2bEntityName || null;
  if (data.source !== undefined) record.csp_source = SOURCE_FORWARD[data.source] ?? null;
  // Currency lookup
  if (data.currencyCode) {
    const guid = currencyCodeToGuid(data.currencyCode);
    if (guid) record['csp_CandidateCurrency@odata.bind'] = `/transactioncurrencies(${guid})`;
  }
  // Status
  if (data.status !== undefined) {
    const code = STATUS_FORWARD[data.status];
    if (code !== undefined) {
      record.statuscode = code;
      record.statecode = (data.status === 'Not Fit') ? 1 : 0;
    }
  }
  if (existingId && isGuid(existingId)) {
    await updateRecord('csp_candidates', existingId, record);
    return existingId;
  }
  return await createRecord('csp_candidates', record);
}
