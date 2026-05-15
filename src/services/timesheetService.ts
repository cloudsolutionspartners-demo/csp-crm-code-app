import { listRecords, createRecord, updateRecord, deleteRecord } from './dataverseService';
import type { Timesheet, TimesheetEntry, TimesheetStatus } from '../types/crm';

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}
function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

const STATUS_REVERSE: Record<number, TimesheetStatus> = {
  1: 'Draft', 725070001: 'Approved',
};
const STATUS_FORWARD: Record<string, number> = {
  Draft: 1, Approved: 725070001,
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

function mapFromDataverse(r: any): Timesheet {
  const entries: TimesheetEntry[] = DAYS.map((day, idx) => {
    const hours = r[`csp_${day}`] ?? 0;
    const comment = r[`csp_${day}comment`] || '';
    const weekStart = r.csp_weekstartdate ? String(r.csp_weekstartdate).substring(0, 10) : '';
    let date = weekStart;
    if (weekStart) {
      try {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + idx);
        date = d.toISOString().substring(0, 10);
      } catch { /* keep weekStart */ }
    }
    return { date, hours, description: comment };
  });

  const totalHours = entries.reduce((s, e) => s + e.hours, 0);

  return {
    id: norm(r.csp_timesheetid),
    reference: r.csp_timesheetreference || r.csp_name || '',
    contactId: norm(r._csp_contact_value),
    contractId: norm(r._csp_contract_value),
    weekStart: r.csp_weekstartdate ? String(r.csp_weekstartdate).substring(0, 10) : '',
    weekEnd: r.csp_weekenddate ? String(r.csp_weekenddate).substring(0, 10) : '',
    totalHours,
    status: STATUS_REVERSE[r.statuscode] || 'Draft',
    entries,
  } as Timesheet & { weekEnd: string };
}

function mapToDataverse(data: Record<string, any>): any {
  const record: any = {};
  if (data.reference !== undefined) record.csp_timesheetreference = data.reference;
  if (data.weekStart !== undefined) record.csp_weekstartdate = data.weekStart || null;
  if (data.weekEnd !== undefined) record.csp_weekenddate = data.weekEnd || null;
  if (data.weekStart && !data.weekEnd) {
    const d = new Date(data.weekStart);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 6);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      record.csp_weekenddate = `${y}-${m}-${day}`;
    }
  }

  // Day hours
  if (data.entries && Array.isArray(data.entries)) {
    const entries = data.entries as TimesheetEntry[];
    DAYS.forEach((day, idx) => {
      if (entries[idx]) {
        record[`csp_${day}`] = entries[idx].hours ?? 0;
        if (entries[idx].description) record[`csp_${day}comment`] = entries[idx].description;
      }
    });
  }

  // Individual day overrides (for generate flow)
  DAYS.forEach(day => {
    if (data[day] !== undefined) record[`csp_${day}`] = data[day];
    if (data[`${day}Comment`] !== undefined) record[`csp_${day}comment`] = data[`${day}Comment`];
  });

  if (data.status !== undefined) {
    const code = STATUS_FORWARD[data.status];
    if (code !== undefined) {
      record.statecode = 0;
      record.statuscode = code;
    }
  }

  // Lookups
  if (data.contactId && isGuid(data.contactId)) {
    record['csp_contact@odata.bind'] = `/contacts(${data.contactId})`;
  }
  if (data.contractId && isGuid(data.contractId)) {
    record['csp_contract@odata.bind'] = `/csp_contracts(${data.contractId})`;
  }
  if (data.accountId && isGuid(data.accountId)) {
    record['csp_account@odata.bind'] = `/accounts(${data.accountId})`;
  }

  return record;
}

export async function fetchTimesheets(): Promise<Timesheet[]> {
  // Fetch without $select — safest approach, avoids 400 errors from invalid column names
  const records = await listRecords('csp_timesheets', undefined, undefined, 'csp_weekstartdate desc');
  console.log('[Timesheet] Fetched:', records.length, 'records');
  return records.map(mapFromDataverse);
}

export async function saveTimesheet(data: Record<string, any>, existingId?: string): Promise<string> {
  const mapped = mapToDataverse(data);
  console.log('[Timesheet]', existingId ? 'UPDATE ' + existingId : 'CREATE', JSON.stringify(mapped).substring(0, 300));
  if (existingId && isGuid(existingId)) {
    await updateRecord('csp_timesheets', existingId, mapped);
    return existingId;
  }
  return await createRecord('csp_timesheets', mapped);
}

export async function removeTimesheet(id: string): Promise<void> {
  await deleteRecord('csp_timesheets', id);
}
