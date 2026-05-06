import { listRecords, createRecord, updateRecord, deleteRecord } from './dataverseService';
import type { PublicHoliday, Country } from '../types/crm';

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}
function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function mapFromDataverse(r: any): PublicHoliday {
  const dateStr = r.csp_date ? r.csp_date.substring(0, 10) : '';
  const year = dateStr ? new Date(dateStr).getFullYear() : 0;
  return {
    id: norm(r.csp_publicholidayid),
    name: r.csp_name || '',
    date: dateStr,
    country: 'Romania' as Country,
    year,
  };
}

function mapToDataverse(data: Record<string, any>): any {
  const record: any = {};
  if (data.name !== undefined) record.csp_name = data.name;
  if (data.date !== undefined) record.csp_date = data.date || null;
  return record;
}

const SELECT = 'csp_publicholidayid,csp_name,csp_date,statecode,statuscode,createdon';

export async function fetchPublicHolidays(): Promise<PublicHoliday[]> {
  const records = await listRecords('csp_publicholidaies', SELECT, undefined, 'csp_date asc');
  return records.map(mapFromDataverse);
}

export async function savePublicHoliday(data: Record<string, any>, existingId?: string): Promise<string> {
  const mapped = mapToDataverse(data);
  if (existingId && isGuid(existingId)) {
    await updateRecord('csp_publicholidaies', existingId, mapped);
    return existingId;
  }
  return await createRecord('csp_publicholidaies', mapped);
}

export async function removePublicHoliday(id: string): Promise<void> {
  await deleteRecord('csp_publicholidaies', id);
}
