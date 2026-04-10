// Dataverse service layer — tries WithOrganization first, falls back to ListRecords

import { MicrosoftDataverseService } from '../generated/services/MicrosoftDataverseService';

// Known environments — keys are env IDs with dashes REMOVED (matches subdomain format)
const ENV_MAP: Record<string, string> = {
  '86b4b5e9f876ef52920a6212c9189404': 'https://orgbc36c435.crm.dynamics.com',   // DEV
  'b66d4c4bb689e7bab992fd27eb058f02': 'https://orga1a2e51e.crm.dynamics.com',   // TEST
};
// Also keep dashed version for URL path matching
const ENV_MAP_DASHED: Record<string, string> = {
  '86b4b5e9-f876-ef52-920a-6212c9189404': 'https://orgbc36c435.crm.dynamics.com',
  'b66d4c4b-b689-e7ba-b992-fd27eb058f02': 'https://orga1a2e51e.crm.dynamics.com',
};

let _orgUrl: string | null = null;

function detectOrgUrl(): string {
  // Strategy 1: Parse env ID from subdomain
  // URL: https://b66d4c4bb689e7bab992fd27eb058f.02.environment.api.powerplatformusercontent.com/...
  // Subdomain first part = env ID without dashes (first 32 hex chars)
  try {
    const hostname = window.location.hostname;
    const subdomain = hostname.split('.')[0]; // "b66d4c4bb689e7bab992fd27eb058f"
    for (const [envKey, orgUrl] of Object.entries(ENV_MAP)) {
      // Subdomain may be truncated — match first 30 chars
      if (subdomain.startsWith(envKey.substring(0, 30))) {
        console.log('[Dataverse] Org URL from subdomain:', orgUrl, 'subdomain:', subdomain);
        return orgUrl;
      }
    }
  } catch (e) {}

  // Strategy 2: Check full URLs for dashed env IDs (e.g. /play/e/{envId}/...)
  try {
    const urls = [window.location.href, document.referrer];
    try { urls.push(window.parent.location.href); } catch (e) {}
    for (const url of urls) {
      if (!url) continue;
      for (const [envId, orgUrl] of Object.entries(ENV_MAP_DASHED)) {
        if (url.includes(envId)) {
          console.log('[Dataverse] Org URL from URL path:', orgUrl, 'envId:', envId);
          return orgUrl;
        }
      }
      // Also check dashless in URLs
      for (const [envKey, orgUrl] of Object.entries(ENV_MAP)) {
        if (url.includes(envKey.substring(0, 30))) {
          console.log('[Dataverse] Org URL from URL dashless:', orgUrl);
          return orgUrl;
        }
      }
    }
  } catch (e) {}

  console.warn('[Dataverse] Could not detect env, defaulting to DEV');
  return 'https://orgbc36c435.crm.dynamics.com';
}

function getOrgUrl(): string {
  if (!_orgUrl) {
    _orgUrl = detectOrgUrl();
    console.log('[Dataverse] Org URL resolved:', _orgUrl);
  }
  return _orgUrl;
}

// Log URL info once at load
try {
  console.log('[Dataverse] hostname:', window.location.hostname);
  console.log('[Dataverse] subdomain:', window.location.hostname.split('.')[0]);
} catch (e) {}

// ===== Fetch with fallback: WithOrganization → ListRecords =====

function isTokenError(result: any): boolean {
  const msg = result?.error?.message || '';
  return msg.includes('Token not found') || msg.includes('token') || msg.includes('organization URL');
}

function findRecords(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data?.value)) return result.data.value;
  if (Array.isArray(result?.value)) return result.value;
  if (Array.isArray(result?.entities)) return result.entities;
  if (Array.isArray(result?.data)) return result.data;
  for (const key of Object.keys(result || {})) {
    if (Array.isArray(result[key]) && result[key].length > 0) return result[key];
  }
  if (result?.data && typeof result.data === 'object') {
    for (const key of Object.keys(result.data)) {
      if (Array.isArray(result.data[key]) && result.data[key].length > 0) return result.data[key];
    }
  }
  return [];
}

export async function listRecords(
  entityName: string,
  select?: string,
  filter?: string,
  orderby?: string,
  top?: number
): Promise<any[]> {
  const $select = select || undefined;
  const $filter = filter || undefined;
  const $orderby = orderby || undefined;
  const $top = (top && top > 0) ? top : undefined;

  // Try 1: WithOrganization (works on DEV)
  try {
    const result = await MicrosoftDataverseService.ListRecordsWithOrganization(
      getOrgUrl(), entityName,
      undefined, undefined, undefined, undefined,
      $select, $filter, $orderby, undefined, undefined, $top,
    ) as any;

    if (result?.success !== false && !result?.error) {
      const records = findRecords(result);
      console.log(`[Dataverse] ${entityName} → ${records.length} records (WithOrg)`);
      return records;
    }

    // If token/org error, fall through to Try 2
    if (isTokenError(result)) {
      console.log(`[Dataverse] ${entityName} WithOrg token error, trying ListRecords...`);
    } else {
      console.error(`[Dataverse] ${entityName} WithOrg error:`, result?.error?.message);
      return [];
    }
  } catch (e: any) {
    console.log(`[Dataverse] ${entityName} WithOrg threw:`, e?.message, '— trying ListRecords...');
  }

  // Try 2: ListRecords without org URL (may work when connector is bound to local env)
  try {
    const result = await MicrosoftDataverseService.ListRecords(
      entityName,
      undefined, undefined, undefined,
      $select, $filter, $orderby, undefined, undefined, $top,
    ) as any;

    if (result?.success !== false && !result?.error) {
      const records = findRecords(result);
      console.log(`[Dataverse] ${entityName} → ${records.length} records (ListRecords)`);
      return records;
    }
    console.error(`[Dataverse] ${entityName} ListRecords error:`, result?.error?.message);
    return [];
  } catch (e: any) {
    console.error(`[Dataverse] ${entityName} ListRecords threw:`, e?.message);
    return [];
  }
}

export async function getRecord(entityName: string, id: string, select?: string): Promise<any> {
  // Try WithOrg first
  try {
    const result = await MicrosoftDataverseService.GetItemWithOrganization(
      'return=representation', 'application/json', getOrgUrl(),
      entityName, id, undefined, undefined, select || undefined,
    ) as any;
    if (result?.success !== false && !result?.error) return result?.data || result || null;
    if (!isTokenError(result)) return null;
  } catch (e) {}

  // Fallback
  try {
    const result = await MicrosoftDataverseService.GetItem(
      'return=representation', 'application/json',
      entityName, id, undefined, select || undefined,
    ) as any;
    if (result?.success !== false) return result?.data || result || null;
  } catch (e: any) {
    console.error(`[Dataverse] GetItem ${entityName} threw:`, e?.message);
  }
  return null;
}

export async function createRecord(entityName: string, data: Record<string, unknown>): Promise<string> {
  // Try WithOrg
  try {
    const result = await MicrosoftDataverseService.CreateRecordWithOrganization(
      'return=representation', 'application/json', getOrgUrl(), entityName, data,
    ) as any;
    if (result?.success !== false && !result?.error) return result?.data?.id || '';
    if (!isTokenError(result)) throw new Error(result?.error?.message || 'Create failed');
  } catch (e: any) {
    if (!e?.message?.includes('Token') && !e?.message?.includes('token')) throw e;
    console.log('[Dataverse] Create WithOrg failed, trying without org...');
  }

  // Fallback
  const result = await MicrosoftDataverseService.CreateRecord(
    'return=representation', 'application/json', entityName, data,
  ) as any;
  if (result?.success === false) throw new Error(result?.error?.message || 'Create failed');
  return result?.data?.id || '';
}

export async function updateRecord(entityName: string, id: string, data: Record<string, unknown>): Promise<void> {
  // Try WithOrg
  try {
    const result = await MicrosoftDataverseService.UpdateRecordWithOrganization(
      'return=representation', 'application/json', getOrgUrl(), entityName, id, data,
    ) as any;
    if (result?.success !== false && !result?.error) return;
    if (!isTokenError(result)) throw new Error(result?.error?.message || 'Update failed');
  } catch (e: any) {
    if (!e?.message?.includes('Token') && !e?.message?.includes('token')) throw e;
    console.log('[Dataverse] Update WithOrg failed, trying without org...');
  }

  // Fallback
  const result = await MicrosoftDataverseService.UpdateRecord(
    'return=representation', 'application/json', entityName, id, data,
  ) as any;
  if (result?.success === false) throw new Error(result?.error?.message || 'Update failed');
}

export async function deleteRecord(entityName: string, id: string): Promise<void> {
  try {
    const result = await MicrosoftDataverseService.DeleteRecordWithOrganization(
      getOrgUrl(), entityName, id,
    ) as any;
    if (result?.success !== false && !result?.error) return;
    if (!isTokenError(result)) throw new Error(result?.error?.message || 'Delete failed');
  } catch (e: any) {
    if (!e?.message?.includes('Token') && !e?.message?.includes('token')) throw e;
  }

  const result = await MicrosoftDataverseService.DeleteRecord(entityName, id) as any;
  if (result?.success === false) throw new Error(result?.error?.message || 'Delete failed');
}

export function setOrgUrl(url: string) {
  _orgUrl = url.replace(/\/$/, '');
}
