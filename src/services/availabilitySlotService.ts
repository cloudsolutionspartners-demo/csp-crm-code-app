import { listRecords, createRecord, updateRecord } from './dataverseService';

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}

// Standard statecode: 0=Active, 1=Inactive
const STATUS_REVERSE: Record<number, string> = {
  0: 'Active', 1: 'Inactive',
};

// statuscode values (Dataverse Option Set)
export const SLOT_STATUS_PENDING = 1;
export const SLOT_STATUS_BOOKED = 725070001;
export const SLOT_STATUS_CANCELLED = 725070002;
export const SLOT_STATUS_COMPLETED = 725070003;

export interface SlotRecord {
  id: string;
  slotId: string;
  dateTime: string;
  teamsLink: string;
  candidateId: string;
  candidateName: string;
  interviewerId: string;
  interviewerName: string;
  status: string;
  statusCode: number;
}

function mapFromDataverse(r: any): SlotRecord {
  return {
    id: norm(r.csp_availabilityslotsid),
    slotId: r.csp_availabilityslotsprimaryid || '',
    dateTime: r.csp_daytime ? String(r.csp_daytime).substring(0, 16) : '',
    teamsLink: r.csp_teamslink || '',
    candidateId: norm(r._csp_candidate_value),
    candidateName: r['_csp_candidate_value@OData.Community.Display.V1.FormattedValue'] || '',
    interviewerId: norm(r._csp_interviewer_value),
    interviewerName: r['_csp_interviewer_value@OData.Community.Display.V1.FormattedValue'] || '',
    status: STATUS_REVERSE[r.statecode] || 'Active',
    statusCode: typeof r.statuscode === 'number' ? r.statuscode : Number(r.statuscode) || 0,
  };
}

const SELECT = 'csp_availabilityslotsid,csp_availabilityslotsprimaryid,csp_daytime,csp_teamslink,_csp_candidate_value,_csp_interviewer_value,statecode,statuscode,createdon';

export async function fetchSlots(): Promise<SlotRecord[]> {
  const records = await listRecords('csp_availabilityslotses', SELECT, undefined, 'csp_daytime desc');
  return records.map(mapFromDataverse);
}

export async function setSlotStatus(slotId: string, statuscode: number): Promise<void> {
  if (!isGuid(slotId)) throw new Error('Invalid slot ID');
  await updateRecord('csp_availabilityslotses', slotId, { statuscode });
}

export async function confirmSlot(slotId: string): Promise<void> {
  await setSlotStatus(slotId, SLOT_STATUS_BOOKED);
}

export async function cancelSlot(slotId: string): Promise<void> {
  await setSlotStatus(slotId, SLOT_STATUS_CANCELLED);
}

export async function saveSlot(data: Record<string, any>, existingId?: string): Promise<string> {
  console.log('[Slot] === SAVE ===', existingId ? 'UPDATE ' + existingId : 'CREATE');
  const record: any = {};
  if (data.dateTime !== undefined) record.csp_daytime = data.dateTime || null;
  if (data.teamsLink !== undefined) record.csp_teamslink = data.teamsLink || null;
  if (data.candidateId && isGuid(data.candidateId)) {
    record['csp_Candidate@odata.bind'] = `/csp_candidates(${data.candidateId})`;
  } else if (data.candidateId) {
    console.warn('[Slot] candidateId is not a valid GUID:', data.candidateId);
  }
  if (data.interviewerId && isGuid(data.interviewerId)) {
    record['csp_Interviewer@odata.bind'] = `/contacts(${data.interviewerId})`;
  }
  console.log('[Slot] Payload:', JSON.stringify(record, null, 2));
  if (existingId && isGuid(existingId)) {
    await updateRecord('csp_availabilityslotses', existingId, record);
    return existingId;
  }
  const newId = await createRecord('csp_availabilityslotses', record);
  console.log('[Slot] Created:', newId);
  return newId;
}
