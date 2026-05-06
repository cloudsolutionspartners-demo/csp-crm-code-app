import { listRecords, createRecord, updateRecord, deleteRecord } from './dataverseService';

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}
function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export interface UomRecord {
  id: string;
  name: string;
}

function mapFromDataverse(r: any): UomRecord {
  return {
    id: norm(r.csp_unitofmeasureid),
    name: r.csp_name || '',
  };
}

const SELECT = 'csp_unitofmeasureid,csp_name,statecode,statuscode,createdon';

export async function fetchUnitsOfMeasure(): Promise<UomRecord[]> {
  const records = await listRecords('csp_unitofmeasures', SELECT, undefined, 'csp_name asc');
  return records.map(mapFromDataverse);
}

export async function saveUnitOfMeasure(data: Record<string, any>, existingId?: string): Promise<string> {
  const record: any = {};
  if (data.name !== undefined) record.csp_name = data.name;
  if (existingId && isGuid(existingId)) {
    await updateRecord('csp_unitofmeasures', existingId, record);
    return existingId;
  }
  return await createRecord('csp_unitofmeasures', record);
}

export async function removeUnitOfMeasure(id: string): Promise<void> {
  await deleteRecord('csp_unitofmeasures', id);
}
