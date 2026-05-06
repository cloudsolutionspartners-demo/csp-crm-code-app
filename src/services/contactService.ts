import { listRecords, createRecord, updateRecord } from './dataverseService';
import type { Contact, ContactType } from '../types/crm';

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// Reverse maps — FormattedValue annotations are NOT returned
const CONTACT_TYPE_REVERSE: Record<number, ContactType> = {
  770400000: 'Consultant', 770400001: 'Client Contact', 770400002: 'Middleman Contact',
  770400003: 'Finance Contact', 770400004: 'Permanent Employee',
};
const CONTACT_TYPE_FORWARD: Record<string, number> = {
  'Consultant': 770400000, 'Client Contact': 770400001, 'Middleman Contact': 770400002,
  'Finance Contact': 770400003, 'Permanent Employee': 770400004,
};

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}

function toBool(val: any): boolean {
  if (val === true || val === 1 || val === '1' || val === 'true') return true;
  return false;
}

function mapFromDataverse(r: any): Contact {
  return {
    id: norm(r.contactid),
    firstName: r.firstname || '',
    lastName: r.lastname || '',
    email: r.emailaddress1 || '',
    phone: r.telephone1 || '',
    contactType: CONTACT_TYPE_REVERSE[r.csp_contacttype] || 'Consultant',
    nationality: r.csp_nationality || '',
    country: r.address1_country || '',
    accountId: norm(r._parentcustomerid_value),
    company: r['_parentcustomerid_value@OData.Community.Display.V1.FormattedValue'] || '',
    isInterviewer: toBool(r.csp_interviewer),
    available: toBool(r.csp_assigned),
    availableForWork: toBool(r.csp_currentavailability),
    jobRole: r.jobtitle || '',
    skillset: [],
    summary: '',
    status: r.statecode === 0 ? 'Active' : 'Inactive',
  };
}

function mapToDataverse(data: Record<string, any>): any {
  // ONLY columns that exist in Dataverse
  const record: any = {};
  if (data.firstName !== undefined) record.firstname = data.firstName;
  if (data.lastName !== undefined) record.lastname = data.lastName;
  if (data.email !== undefined) record.emailaddress1 = data.email;
  if (data.phone !== undefined) record.telephone1 = data.phone || null;
  if (data.jobRole !== undefined) record.jobtitle = data.jobRole || null;
  if (data.nationality !== undefined) record.csp_nationality = data.nationality || null;
  if (data.country !== undefined) record.address1_country = data.country || null;
  // Toggles — each has its own Dataverse column
  if (data.isInterviewer !== undefined) record.csp_interviewer = !!data.isInterviewer;
  if (data.available !== undefined) record.csp_assigned = !!data.available;
  if (data.availableForWork !== undefined) record.csp_currentavailability = !!data.availableForWork;
  if (data.contactType && CONTACT_TYPE_FORWARD[data.contactType] !== undefined) {
    record.csp_contacttype = CONTACT_TYPE_FORWARD[data.contactType];
  }
  // Lookup — only if valid GUID
  if (data.accountId && isGuid(data.accountId)) {
    record['parentcustomerid_account@odata.bind'] = `/accounts(${data.accountId})`;
  }
  // Status
  if (data.status === 'Active') { record.statecode = 0; record.statuscode = 1; }
  else if (data.status === 'Inactive') { record.statecode = 1; record.statuscode = 2; }
  return record;
}

const SELECT = 'contactid,firstname,lastname,emailaddress1,telephone1,jobtitle,csp_contacttype,csp_nationality,csp_interviewer,csp_assigned,csp_currentavailability,address1_country,_parentcustomerid_value,statecode,statuscode';

export async function fetchContacts(): Promise<Contact[]> {
  const records = await listRecords('contacts', SELECT, undefined, 'lastname asc');
  return records.map(mapFromDataverse);
}

export async function saveContact(data: Record<string, any>, existingId?: string): Promise<string> {
  const mapped = mapToDataverse(data);
  console.log('[Contact] === SAVE ===', existingId ? 'UPDATE ' + existingId : 'CREATE');
  console.log('[Contact] Input data:', JSON.stringify({ isInterviewer: data.isInterviewer, available: data.available, availableForWork: data.availableForWork, jobRole: data.jobRole, contactType: data.contactType }));
  console.log('[Contact] Payload:', JSON.stringify(mapped, null, 2));
  if (existingId && isGuid(existingId)) {
    await updateRecord('contacts', existingId, mapped);
    return existingId;
  }
  return await createRecord('contacts', mapped);
}
