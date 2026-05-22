import { listRecords, updateRecord, createRecord } from './dataverseService';
import type {
  CorporateAction,
  CorporateActionStatus,
  CorporateActionPriority,
} from '../types/crm';

// ===== Picklist mappings (per verified Dataverse schema) =====

const PRIORITY_VALUE_TO_LABEL: Record<number, CorporateActionPriority> = {
  725070000: 'Low',
  725070001: 'Medium',
  725070002: 'High',
};

const PRIORITY_LABEL_TO_VALUE: Record<CorporateActionPriority, number> = {
  Low: 725070000,
  Medium: 725070001,
  High: 725070002,
};

// statuscode values per Dataverse live OptionSet (verified via metadata query):
//   1         = New          (statecode 0 Active)
//   725070001 = In Progress  (statecode 0 Active)
//   725070002 = Closed       (statecode 0 Active)   ⚠️ schema design choice — spec wanted Inactive
//   725070003 = Cancelled    (statecode 0 Active)   ⚠️ schema design choice — spec wanted Inactive
const STATUSCODE_TO_LABEL: Record<number, CorporateActionStatus> = {
  1: 'New',
  725070001: 'In Progress',
  725070002: 'Closed',
  725070003: 'Cancelled',
};

const STATUS_LABEL_TO_CODE: Record<CorporateActionStatus, { statuscode: number; statecode: number }> = {
  'New':         { statuscode: 1,         statecode: 0 },
  'In Progress': { statuscode: 725070001, statecode: 0 },
  'Closed':      { statuscode: 725070002, statecode: 0 },
  'Cancelled':   { statuscode: 725070003, statecode: 0 },
};

// ===== Field selection for read =====

const SELECT = [
  'csp_corporateactionid',
  'csp_actionsummarizedtitle',
  'csp_actiondetails',
  'csp_closingcomments',
  'csp_priority',
  'csp_duedate',
  'statuscode',
  'statecode',
  'createdon',
  'modifiedon',
].join(',');

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}

function rowToCorporateAction(r: any): CorporateAction {
  const priority = PRIORITY_VALUE_TO_LABEL[r.csp_priority as number] ?? 'Low';
  const status = STATUSCODE_TO_LABEL[r.statuscode as number] ?? 'New';
  return {
    id: norm(r.csp_corporateactionid),
    actionSummarizedTitle: r.csp_actionsummarizedtitle || '',
    actionDetails: r.csp_actiondetails || '',
    closingComments: r.csp_closingcomments || undefined,
    priority,
    status,
    dueDate: r.csp_duedate || undefined,
    createdAt: r.createdon || '',
    modifiedAt: r.modifiedon || '',
  };
}

// ===== Public API =====

export async function fetchCorporateActions(): Promise<CorporateAction[]> {
  const records = await listRecords('csp_corporateactions', SELECT, undefined, 'modifiedon desc');
  return records.map(rowToCorporateAction);
}

/**
 * Update a corporate action.
 * Accepts partial form data — only fields the user can edit are honored:
 *   - status (changes both statuscode + statecode atomically)
 *   - closingComments
 *
 * Read-only fields (title, details, priority, dueDate) are intentionally NOT
 * writable from the UI. If the spec changes to allow editing those, expand here.
 */
export async function updateCorporateAction(
  id: string,
  data: { status?: CorporateActionStatus; closingComments?: string | null }
): Promise<void> {
  const payload: Record<string, unknown> = {};

  if (data.status !== undefined) {
    const codes = STATUS_LABEL_TO_CODE[data.status];
    if (!codes) throw new Error(`updateCorporateAction: unknown status "${data.status}"`);
    payload.statuscode = codes.statuscode;
    payload.statecode = codes.statecode;
  }

  if (data.closingComments !== undefined) {
    const trimmed = data.closingComments?.trim();
    payload.csp_closingcomments = trimmed ? trimmed : null;
  }

  await updateRecord('csp_corporateactions', id, payload);
}

/**
 * (Optional) Create a corporate action. Primarily for seeding / AI agent emulation.
 * Not wired to UI in the prototype.
 */
export async function createCorporateAction(
  data: Pick<CorporateAction, 'actionSummarizedTitle' | 'actionDetails' | 'priority'> &
    Partial<Pick<CorporateAction, 'dueDate' | 'closingComments'>>
): Promise<string> {
  const payload: Record<string, unknown> = {
    csp_actionsummarizedtitle: data.actionSummarizedTitle,
    csp_actiondetails: data.actionDetails,
    csp_priority: PRIORITY_LABEL_TO_VALUE[data.priority],
    statuscode: 1,  // default New
    statecode: 0,
  };
  if (data.dueDate) payload.csp_duedate = data.dueDate;
  if (data.closingComments) payload.csp_closingcomments = data.closingComments;

  const id = await createRecord('csp_corporateactions', payload);
  return norm(id);
}
