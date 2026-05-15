// Dataverse service layer — tries WithOrganization first, falls back to ListRecords

import { MicrosoftDataverseService } from '../generated/services/MicrosoftDataverseService';

// Known environments — keys are env IDs with dashes REMOVED (matches subdomain format)
const ENV_MAP: Record<string, string> = {
  '86b4b5e9f876ef52920a6212c9189404': 'https://orgbc36c435.crm.dynamics.com',   // OLD DEV
  'b66d4c4bb689e7bab992fd27eb058f02': 'https://orga1a2e51e.crm.dynamics.com',   // OLD TEST
  '971f1ff8c4ffee219ef904cfb6802004': 'https://org3006bc14.crm4.dynamics.com',  // NEW DEV
  '4e7439c6a960e34683f2187042b54f04': 'https://org26dacb9b.crm4.dynamics.com',  // NEW UAT
  '7026ca2c0785ea98810d1c2bce33ea48': 'https://org2ee69a7d.crm4.dynamics.com',  // PROD
};
// Also keep dashed version for URL path matching
const ENV_MAP_DASHED: Record<string, string> = {
  '86b4b5e9-f876-ef52-920a-6212c9189404': 'https://orgbc36c435.crm.dynamics.com',
  'b66d4c4b-b689-e7ba-b992-fd27eb058f02': 'https://orga1a2e51e.crm.dynamics.com',
  '971f1ff8-c4ff-ee21-9ef9-04cfb6802004': 'https://org3006bc14.crm4.dynamics.com',
  '4e7439c6-a960-e346-83f2-187042b54f04': 'https://org26dacb9b.crm4.dynamics.com',
  '7026ca2c-0785-ea98-810d-1c2bce33ea48': 'https://org2ee69a7d.crm4.dynamics.com', // PROD
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

  // Request FormattedValue annotations on lookup fields (e.g., contact names on _csp_X_value)
  const PREFER = 'odata.include-annotations="*"';

  // Try 1: WithOrganization (works on DEV)
  try {
    const result = await MicrosoftDataverseService.ListRecordsWithOrganization(
      getOrgUrl(), entityName,
      PREFER, undefined, undefined, undefined,
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
      PREFER, undefined, undefined,
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

// Convert a Dataverse entity SET name (e.g. "csp_opportunities") to its
// logical/singular name used in the row's primary-key field (e.g. "csp_opportunity").
// Handles the English plural rule `ies → y` that bit us in production: previously
// "csp_opportunities".slice(0, -1) yielded "csp_opportunitie" → "csp_opportunitieid"
// which doesn't exist on the row, so the new GUID was silently dropped from the
// response → empty string returned to caller → orphaned child records.
function entityLogicalName(setName: string): string {
  if (/ies$/i.test(setName)) return setName.slice(0, -3) + 'y';
  if (/sses$|ses$/i.test(setName)) return setName.slice(0, -2);
  if (/s$/i.test(setName)) return setName.slice(0, -1);
  return setName;
}

function extractCreatedId(data: any, entityName: string): string {
  if (!data) return '';
  if (typeof data === 'string') return data;
  const guessed = entityLogicalName(entityName) + 'id';
  // Primary strategies in order of likelihood
  const direct = data.id || data.itemId || data[guessed];
  if (direct) return String(direct);
  // Defensive scan: pick any GUID-looking property whose key ends in 'id'
  for (const k of Object.keys(data)) {
    if (/id$/i.test(k) && typeof data[k] === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data[k])) {
      return data[k];
    }
  }
  return '';
}

export async function createRecord(entityName: string, data: Record<string, unknown>): Promise<string> {
  console.log(`[Dataverse] CreateRecord("${entityName}")`, JSON.stringify(data).substring(0, 500));
  // Try WithOrg
  try {
    const result = await MicrosoftDataverseService.CreateRecordWithOrganization(
      'return=representation', 'application/json', getOrgUrl(), entityName, data,
    ) as any;
    console.log(`[Dataverse] CreateRecord("${entityName}") result:`, result?.success, result?.error?.message || 'no error');
    if (result?.success !== false && !result?.error) {
      console.log(`[Dataverse] CreateRecord("${entityName}") success, full data:`, JSON.stringify(result?.data).substring(0, 500));
      const id = extractCreatedId(result?.data, entityName);
      console.log(`[Dataverse] CreateRecord("${entityName}") resolved id:`, id);
      if (!id) {
        console.error(`[Dataverse] CreateRecord("${entityName}") COULD NOT EXTRACT ID. Response keys:`, Object.keys(result?.data || {}));
      }
      return id;
    }
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
  const id = extractCreatedId(result?.data, entityName);
  if (!id) {
    console.error(`[Dataverse] CreateRecord fallback("${entityName}") COULD NOT EXTRACT ID. Response keys:`, Object.keys(result?.data || {}));
  }
  return id;
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

export { getOrgUrl };

export function setOrgUrl(url: string) {
  _orgUrl = url.replace(/\/$/, '');
}

// ===== File upload / download for File-type columns =====

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function uploadFileField(
  entityName: string,
  recordId: string,
  fieldName: string,
  file: File,
): Promise<void> {
  const base64 = await fileToBase64(file);
  const contentType = file.type || 'application/octet-stream';

  console.log('[FileUpload] Uploading:', {
    entityName, recordId, fieldName,
    fileName: file.name,
    contentType,
    base64Length: base64.length,
  });

  // Dataverse file field expects item with top-level "value" property containing base64
  const item = JSON.stringify({ value: base64 });

  // content_type must describe the `item` payload (which is JSON), not the file.
  const result = await MicrosoftDataverseService.UpdateEntityFileImageFieldContentWithOrganization(
    'application/json', getOrgUrl(), entityName, recordId, fieldName, item, file.name,
  ) as any;

  console.log('[FileUpload] Result:', JSON.stringify(result).substring(0, 500));

  if (result?.success === false || result?.error) {
    throw new Error(result?.error?.message || 'File upload failed');
  }
}

/**
 * Upload a file to a Dataverse file column via the Dataverse Web API directly.
 * Bypasses the Power Platform connector's UpdateEntityFileImageFieldContent
 * which has been silently failing on csp_invoicedocument uploads.
 */
export async function uploadFileFieldDirect(
  entitySetName: string,
  recordId: string,
  fieldName: string,
  fileName: string,
  fileContent: Uint8Array,
  contentType: string = 'application/octet-stream',
): Promise<void> {
  const orgUrl = getOrgUrl();
  if (!orgUrl) throw new Error('Org URL not resolved');

  const url = `${orgUrl}/api/data/v9.2/${entitySetName}(${recordId})/${fieldName}?x-ms-file-name=${encodeURIComponent(fileName)}`;

  console.log('[FileUploadDirect] Uploading:', { url, fileName, contentType, size: fileContent.length });

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': contentType,
      'x-ms-file-name': fileName,
    },
    body: new Blob([fileContent.buffer.slice(fileContent.byteOffset, fileContent.byteOffset + fileContent.byteLength) as ArrayBuffer], { type: contentType }),
  });

  console.log('[FileUploadDirect] Response:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[FileUploadDirect] Error:', errorText);
    throw new Error(`File upload failed: ${response.status} ${response.statusText}`);
  }
}

export async function downloadFileField(
  entityName: string,
  recordId: string,
  fieldName: string,
  fileName: string,
): Promise<void> {
  console.log('[FileDownload] Parameters:', { org: getOrgUrl(), entityName, recordId, fieldName, fileName });
  const result = await MicrosoftDataverseService.GetEntityFileImageFieldContentWithOrganization(
    'bytes=0-', getOrgUrl(), entityName, recordId, fieldName,
  ) as any;
  const base64 = result?.data ?? result;
  if (typeof base64 !== 'string' || !base64) {
    throw new Error(result?.error?.message || 'File download failed');
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'download';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
