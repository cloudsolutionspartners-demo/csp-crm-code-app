import { listRecords, createRecord, updateRecord } from './dataverseService';

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}

export interface JDPlatformRecord {
  id: string;
  name: string;
  description: string;
  definedByAI: boolean;
}

function mapFromDataverse(r: any): JDPlatformRecord {
  return {
    id: norm(r.csp_jdplatformid),
    name: r.csp_platformname || '',
    description: r.csp_platformdescription || '',
    definedByAI: r.csp_definedbyai === true,
  };
}

const SELECT = 'csp_jdplatformid,csp_platformname,csp_platformdescription,csp_definedbyai,statecode';

export async function fetchJDPlatforms(): Promise<JDPlatformRecord[]> {
  const records = await listRecords('csp_jdplatforms', SELECT, undefined, 'csp_platformname asc');
  return records.map(mapFromDataverse);
}

export async function saveJDPlatform(data: Record<string, any>, existingId?: string): Promise<string> {
  const record: any = {};
  if (data.name !== undefined) record.csp_platformname = data.name;
  if (data.description !== undefined) record.csp_platformdescription = data.description || null;
  if (data.definedByAI !== undefined) record.csp_definedbyai = data.definedByAI === 'Yes' || data.definedByAI === true;
  if (existingId && isGuid(existingId)) {
    await updateRecord('csp_jdplatforms', existingId, record);
    return existingId;
  }
  return await createRecord('csp_jdplatforms', record);
}
