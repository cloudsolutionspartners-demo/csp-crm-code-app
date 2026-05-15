import { listRecords, createRecord, updateRecord, deleteRecord } from './dataverseService';
import type { ContactCv } from '../types/crm';

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}

const SELECT = [
  'csp_contactcvid',
  'csp_contactcvprimaryid',
  'csp_document_name',
  'statecode',
  'statuscode',
  'createdon',
  '_csp_contact_value',
].join(',');

function mapFromDataverse(r: any): ContactCv & { contactId: string } {
  return {
    id: norm(r.csp_contactcvid),
    fileName: r.csp_contactcvprimaryid || r.csp_document_name || '',
    label: r.csp_document_name || '',
    uploadedAt: r.createdon ? String(r.createdon).substring(0, 10) : '',
    isPrimary: false,
    contactId: norm(r._csp_contact_value),
  };
}

export async function fetchContactCvs(contactId?: string): Promise<(ContactCv & { contactId: string })[]> {
  const filter = contactId ? `_csp_contact_value eq ${contactId}` : undefined;
  const records = await listRecords('csp_contactcvs', SELECT, filter, 'createdon desc');
  return records.map(mapFromDataverse);
}

export async function saveContactCv(
  data: Partial<ContactCv> & { contactId?: string },
  existingId?: string,
): Promise<string> {
  const record: any = {};
  if (data.contactId !== undefined) {
    record['csp_Contact@odata.bind'] = data.contactId ? `/contacts(${data.contactId})` : null;
  }
  if (data.fileName !== undefined) record.csp_contactcvprimaryid = data.fileName || null;

  if (existingId && isGuid(existingId)) {
    await updateRecord('csp_contactcvs', existingId, record);
    return existingId;
  }
  return await createRecord('csp_contactcvs', record);
}

export async function removeContactCv(id: string): Promise<void> {
  await deleteRecord('csp_contactcvs', id);
}
