import { listRecords, createRecord, updateRecord, deleteRecord } from './dataverseService';
import type { ProspectInteraction, InteractionType } from '../types/crm';

function norm(v: any): string {
  return v ? String(v).toLowerCase().replace(/[{}]/g, '') : '';
}

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

const TYPE_REVERSE: Record<number, InteractionType> = {
  725070000: 'Call',
  725070001: 'Email',
  725070002: 'Meeting',
  725070003: 'LinkedIn',
};
const TYPE_FORWARD: Record<string, number> = {
  Call: 725070000,
  Email: 725070001,
  Meeting: 725070002,
  LinkedIn: 725070003,
};

function mapFromDataverse(r: any): ProspectInteraction {
  return {
    id: norm(r.csp_prospectinteractionid),
    prospectId: norm(r._csp_prospect_value),
    type: TYPE_REVERSE[r.csp_type] || 'Call',
    date: r.csp_date ? String(r.csp_date).substring(0, 10) : '',
    summary: r.csp_summary || '',
    createdBy: r['_createdby_value@OData.Community.Display.V1.FormattedValue'] || '',
  };
}

function mapToDataverse(data: Partial<ProspectInteraction>): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  if (data.type !== undefined && TYPE_FORWARD[data.type] !== undefined) record.csp_type = TYPE_FORWARD[data.type];
  if (data.date !== undefined) record.csp_date = data.date || null;
  if (data.summary !== undefined) record.csp_summary = data.summary;
  if (data.prospectId && isGuid(data.prospectId)) {
    record['csp_Prospect@odata.bind'] = `/csp_prospects(${data.prospectId})`;
  }
  return record;
}

const SELECT = 'csp_prospectinteractionid,csp_prospectinteractionprimaryid,_csp_prospect_value,csp_type,csp_date,csp_summary,_createdby_value';

export async function fetchInteractionsByProspect(prospectId: string): Promise<ProspectInteraction[]> {
  if (!isGuid(prospectId)) return [];
  const filter = `_csp_prospect_value eq ${prospectId}`;
  const records = await listRecords('csp_prospectinteractions', SELECT, filter);
  return records.map(mapFromDataverse);
}

export async function fetchAllInteractions(): Promise<ProspectInteraction[]> {
  const records = await listRecords('csp_prospectinteractions', SELECT);
  return records.map(mapFromDataverse);
}

export async function saveInteraction(data: Partial<ProspectInteraction>, id?: string): Promise<string> {
  const mapped = mapToDataverse(data);
  if (id && isGuid(id)) {
    await updateRecord('csp_prospectinteractions', id, mapped);
    return id;
  }
  return await createRecord('csp_prospectinteractions', mapped);
}

export async function removeInteraction(id: string): Promise<void> {
  if (!isGuid(id)) return;
  await deleteRecord('csp_prospectinteractions', id);
}
