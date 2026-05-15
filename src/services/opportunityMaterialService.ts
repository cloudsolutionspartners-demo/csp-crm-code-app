import { listRecords, createRecord, updateRecord, deleteRecord } from './dataverseService';
import type { OpportunityMaterial } from '../types/crm';

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}

const SELECT = [
  'csp_opportunitymaterialid',
  'csp_opportunitymaterialprimaryid',
  'csp_filename',
  'csp_shareddate',
  'csp_description',
  'csp_document_name',
  'statecode',
  'statuscode',
  'createdon',
  '_csp_opportunity_value',
].join(',');

function mapFromDataverse(r: any): OpportunityMaterial {
  return {
    id: norm(r.csp_opportunitymaterialid),
    opportunityId: norm(r._csp_opportunity_value),
    fileName: r.csp_filename || r.csp_opportunitymaterialprimaryid || '',
    sharedDate: r.csp_shareddate ? String(r.csp_shareddate).substring(0, 10) : '',
    description: r.csp_description || '',
    documentFileName: r.csp_document_name || undefined,
  };
}

export async function fetchOpportunityMaterials(opportunityId?: string): Promise<OpportunityMaterial[]> {
  const filter = opportunityId ? `_csp_opportunity_value eq ${opportunityId}` : undefined;
  const records = await listRecords('csp_opportunitymaterials', SELECT, filter, 'createdon desc');
  return records.map(mapFromDataverse);
}

export async function saveOpportunityMaterial(
  data: Partial<OpportunityMaterial>,
  existingId?: string,
): Promise<string> {
  const record: any = {};
  if (data.opportunityId !== undefined) {
    record['csp_Opportunity@odata.bind'] = data.opportunityId ? `/csp_opportunities(${data.opportunityId})` : null;
  }
  if (data.fileName !== undefined) record.csp_filename = data.fileName || null;
  if (data.sharedDate !== undefined) record.csp_shareddate = data.sharedDate || null;
  if (data.description !== undefined) record.csp_description = data.description || null;

  if (existingId && isGuid(existingId)) {
    await updateRecord('csp_opportunitymaterials', existingId, record);
    return existingId;
  }
  return await createRecord('csp_opportunitymaterials', record);
}

export async function removeOpportunityMaterial(id: string): Promise<void> {
  await deleteRecord('csp_opportunitymaterials', id);
}
