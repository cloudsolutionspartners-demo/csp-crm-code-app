import { listRecords, createRecord, updateRecord } from './dataverseService';
import { currencyGuidToCode, currencyCodeToGuid } from './currencyMap';

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}

const STATUS_REVERSE: Record<number, string> = {
  1: 'Pending',
  725070001: 'Pending',
  725070002: 'Invoiced',
  725070003: 'Paid',
  2: 'Inactive',
};

const STATUS_FORWARD: Record<string, number> = {
  'Pending': 725070001,
  'Invoiced': 725070002,
  'Paid': 725070003,
};

export interface MilestoneRecord {
  id: string;
  milestoneId: string;
  contractId: string;
  description: string;
  value: number;
  currencyCode: string;
  startDate: string;
  endDate: string;
  status: string;
}

function mapFromDataverse(r: any): MilestoneRecord {
  return {
    id: norm(r.csp_contractmilestoneid),
    milestoneId: r.csp_milestoneid || '',
    contractId: norm(r._csp_contract_value),
    description: r.csp_milestonedescription || '',
    value: r.csp_milestonevalue ?? 0,
    currencyCode: currencyGuidToCode(r._csp_milestonecurrency_value),
    startDate: r.csp_startdate ? r.csp_startdate.split('T')[0] : '',
    endDate: r.csp_enddate ? r.csp_enddate.split('T')[0] : '',
    status: STATUS_REVERSE[r.statuscode] || 'Pending',
  };
}

const SELECT = 'csp_contractmilestoneid,csp_milestoneid,csp_milestonedescription,csp_milestonevalue,csp_startdate,csp_enddate,_csp_contract_value,_csp_milestonecurrency_value,statecode,statuscode';

export async function fetchMilestones(): Promise<MilestoneRecord[]> {
  const records = await listRecords('csp_contractmilestones', SELECT, undefined, 'csp_startdate desc');
  return records.map(mapFromDataverse);
}

function safeNum(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  return (!isNaN(n) && n >= 0) ? n : null;
}

export async function saveMilestone(data: Record<string, any>, existingId?: string): Promise<string> {
  const record: any = {};
  if (data.milestoneId !== undefined) record.csp_milestoneid = data.milestoneId;
  if (data.description !== undefined) record.csp_milestonedescription = data.description;
  if (data.value !== undefined) { const v = safeNum(data.value); if (v !== null) record.csp_milestonevalue = v; }
  if (data.startDate !== undefined) record.csp_startdate = data.startDate || null;
  if (data.endDate !== undefined) record.csp_enddate = data.endDate || null;
  if (data.contractId && isGuid(data.contractId)) {
    record['csp_Contract@odata.bind'] = `/csp_contracts(${data.contractId})`;
  }
  if (data.currencyCode) {
    const currGuid = currencyCodeToGuid(data.currencyCode);
    if (currGuid) {
      record['csp_MilestoneCurrency@odata.bind'] = `/transactioncurrencies(${currGuid})`;
    }
  }
  if (data.status !== undefined) {
    const code = STATUS_FORWARD[data.status];
    if (code !== undefined) {
      record.statecode = 0;
      record.statuscode = code;
    }
  }
  if (existingId && isGuid(existingId)) {
    await updateRecord('csp_contractmilestones', existingId, record);
    return existingId;
  }
  return await createRecord('csp_contractmilestones', record);
}
