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

function mapFromDataverse(r: any): Contact {
  return {
    id: r.contactid,
    firstName: r.firstname || '',
    lastName: r.lastname || '',
    email: r.emailaddress1 || '',
    phone: r.telephone1 || '',
    contactType: CONTACT_TYPE_REVERSE[r.csp_contacttype] || 'Consultant',
    nationality: r.csp_nationality || '',
    country: r.address1_country || '',
    accountId: r._parentcustomerid_value || '',
    company: r['_parentcustomerid_value@OData.Community.Display.V1.FormattedValue'] || '',
    available: r.csp_currentavailability === true,
    isInterviewer: false, // UI-only, not in Dataverse
    jobRole: r.jobtitle || '',
    skillset: [],          // UI-only, not in Dataverse
    summary: '',           // UI-only, not in Dataverse
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
  if (data.available !== undefined) record.csp_currentavailability = data.available || false;
  if (data.contactType && CONTACT_TYPE_FORWARD[data.contactType] !== undefined) {
    record.csp_contacttype = CONTACT_TYPE_FORWARD[data.contactType];
  }
  // Lookup — only if valid GUID
  if (data.accountId && isGuid(data.accountId)) {
    record['parentcustomerid_account@odata.bind'] = `/accounts(${data.accountId})`;
  }
  return record;
}

const SELECT = 'contactid,firstname,lastname,emailaddress1,telephone1,jobtitle,csp_contacttype,csp_nationality,csp_currentavailability,address1_country,_parentcustomerid_value,statecode,statuscode';

export async function fetchContacts(): Promise<Contact[]> {
  const records = await listRecords('contacts', SELECT, undefined, 'lastname asc');
  return records.map(mapFromDataverse);
}

export async function saveContact(data: Record<string, any>, existingId?: string): Promise<string> {
  const mapped = mapToDataverse(data);
  if (existingId && isGuid(existingId)) {
    await updateRecord('contacts', existingId, mapped);
    return existingId;
  }
  return await createRecord('contacts', mapped);
}
