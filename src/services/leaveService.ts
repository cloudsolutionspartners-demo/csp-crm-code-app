import { listRecords, createRecord, updateRecord, deleteRecord } from './dataverseService';
import type { LeaveRequest } from '../types/crm';

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}
function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function mapFromDataverse(r: any): LeaveRequest {
  return {
    id: norm(r.csp_leaverequestid),
    name: r.csp_name || '',
    contactId: norm(r._csp_contact_value),
    leaveType: 'Annual Leave',
    startDate: r.csp_startdate ? r.csp_startdate.substring(0, 10) : '',
    endDate: r.csp_enddate ? r.csp_enddate.substring(0, 10) : '',
    totalDays: r.csp_totaldays ?? 0,
    status: r.statecode === 0 ? 'Pending' : 'Approved',
    clientNotified: !!r.csp_clientnotified,
  };
}

function mapToDataverse(data: Record<string, any>): any {
  const record: any = {};
  if (data.name !== undefined) record.csp_name = data.name;
  if (data.startDate !== undefined) record.csp_startdate = data.startDate || null;
  if (data.endDate !== undefined) record.csp_enddate = data.endDate || null;
  if (data.totalDays !== undefined) record.csp_totaldays = Number(data.totalDays) || 0;
  if (data.clientNotified !== undefined) record.csp_clientnotified = !!data.clientNotified;
  if (data.contactId && isGuid(data.contactId)) {
    record['csp_contact@odata.bind'] = `/contacts(${data.contactId})`;
  }
  // Status
  if (data.status === 'Approved') { record.statecode = 0; record.statuscode = 1; }
  else if (data.status === 'Rejected') { record.statecode = 1; record.statuscode = 2; }
  return record;
}

const SELECT = 'csp_leaverequestid,csp_name,_csp_contact_value,csp_startdate,csp_enddate,csp_totaldays,csp_clientnotified,statecode,statuscode,createdon';

export async function fetchLeaveRequests(): Promise<LeaveRequest[]> {
  const records = await listRecords('csp_leaverequests', SELECT, undefined, 'createdon desc');
  return records.map(mapFromDataverse);
}

export async function saveLeaveRequest(data: Record<string, any>, existingId?: string): Promise<string> {
  const mapped = mapToDataverse(data);
  if (existingId && isGuid(existingId)) {
    await updateRecord('csp_leaverequests', existingId, mapped);
    return existingId;
  }
  return await createRecord('csp_leaverequests', mapped);
}

export async function removeLeaveRequest(id: string): Promise<void> {
  await deleteRecord('csp_leaverequests', id);
}
