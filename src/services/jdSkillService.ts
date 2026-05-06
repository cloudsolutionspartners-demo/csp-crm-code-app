import { listRecords, createRecord, updateRecord } from './dataverseService';

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}

export interface JDSkillRecord {
  id: string;
  name: string;
  description: string;
  definedByAI: boolean;
}

function mapFromDataverse(r: any): JDSkillRecord {
  return {
    id: norm(r.csp_jdskillid),
    name: r.csp_jdskillname || '',
    description: r.csp_jdskilldescription || '',
    definedByAI: r.csp_definedbyai === true,
  };
}

const SELECT = 'csp_jdskillid,csp_jdskillname,csp_jdskilldescription,csp_definedbyai,statecode';

export async function fetchJDSkills(): Promise<JDSkillRecord[]> {
  const records = await listRecords('csp_jdskills', SELECT, undefined, 'csp_jdskillname asc');
  return records.map(mapFromDataverse);
}

export async function saveJDSkill(data: Record<string, any>, existingId?: string): Promise<string> {
  const record: any = {};
  if (data.name !== undefined) record.csp_jdskillname = data.name;
  if (data.description !== undefined) record.csp_jdskilldescription = data.description || null;
  if (data.definedByAI !== undefined) record.csp_definedbyai = data.definedByAI === 'Yes' || data.definedByAI === true;
  if (existingId && isGuid(existingId)) {
    await updateRecord('csp_jdskills', existingId, record);
    return existingId;
  }
  return await createRecord('csp_jdskills', record);
}
