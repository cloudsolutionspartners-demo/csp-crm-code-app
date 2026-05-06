import { listRecords, createRecord, updateRecord, deleteRecord } from './dataverseService';
import type { ProspectMaterial } from '../types/crm';

function norm(v: any): string {
  return v ? String(v).toLowerCase().replace(/[{}]/g, '') : '';
}

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function mapFromDataverse(r: any): ProspectMaterial {
  return {
    id: norm(r.csp_prospectmaterialid),
    prospectId: norm(r._csp_prospect_value),
    fileName: r.csp_document_name || r.csp_prospectmaterialprimaryid || '',
    sharedDate: r.csp_shareddate ? String(r.csp_shareddate).substring(0, 10) : '',
    description: r.csp_description || '',
  };
}

function mapToDataverse(data: Partial<ProspectMaterial>): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  if (data.sharedDate !== undefined) record.csp_shareddate = data.sharedDate || null;
  if (data.description !== undefined) record.csp_description = data.description;
  if (data.prospectId && isGuid(data.prospectId)) {
    record['csp_Prospect@odata.bind'] = `/csp_prospects(${data.prospectId})`;
  }
  return record;
}

const SELECT = 'csp_prospectmaterialid,csp_prospectmaterialprimaryid,csp_document_name,_csp_prospect_value,csp_shareddate,csp_description';

export async function fetchMaterialsByProspect(prospectId: string): Promise<ProspectMaterial[]> {
  if (!isGuid(prospectId)) return [];
  const filter = `_csp_prospect_value eq ${prospectId}`;
  const records = await listRecords('csp_prospectmaterials', SELECT, filter);
  return records.map(mapFromDataverse);
}

export async function fetchAllMaterials(): Promise<ProspectMaterial[]> {
  const records = await listRecords('csp_prospectmaterials', SELECT);
  return records.map(mapFromDataverse);
}

export async function saveMaterial(data: Partial<ProspectMaterial>, id?: string): Promise<string> {
  const mapped = mapToDataverse(data);
  if (id && isGuid(id)) {
    await updateRecord('csp_prospectmaterials', id, mapped);
    return id;
  }
  return await createRecord('csp_prospectmaterials', mapped);
}

export async function removeMaterial(id: string): Promise<void> {
  if (!isGuid(id)) return;
  await deleteRecord('csp_prospectmaterials', id);
}
