import { listRecords, createRecord, updateRecord, deleteRecord, uploadFileField, downloadFileField } from './dataverseService';
import type { CompanyDocument, DocumentType } from '../types/crm';

const ENTITY_SET = 'csp_companydocuments';
const ENTITY_LOGICAL = 'csp_companydocument';
const FILE_FIELD = 'csp_maindocument';

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}
function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

const DOC_TYPE_REVERSE: Record<number, DocumentType> = {
  770400000: 'Certificate', 770400003: 'Contract', 770400006: 'Other',
  770400001: 'Invoice' as DocumentType, 770400002: 'Policy' as DocumentType,
  770400004: 'Report' as DocumentType, 770400005: 'Other',
};
const DOC_TYPE_FORWARD: Record<string, number> = {
  Certificate: 770400000, Contract: 770400003, Invoice: 770400001,
  Policy: 770400002, Report: 770400004, Other: 770400006,
};

function mapFromDataverse(r: any): CompanyDocument {
  return {
    id: norm(r.csp_companydocumentid),
    documentName: r.csp_name || '',
    documentType: DOC_TYPE_REVERSE[r.csp_documenttype] || 'Other',
    relatedAccountId: norm(r._csp_account_value),
    issuedDate: r.csp_issueddate ? r.csp_issueddate.substring(0, 10) : undefined,
    expirationDate: r.csp_expirationdate ? r.csp_expirationdate.substring(0, 10) : undefined,
    description: r.csp_description || '',
    instructions: r.csp_instructions || '',
    fileName: r.csp_maindocument_name || '',
  };
}

function mapToDataverse(data: Record<string, any>): any {
  const record: any = {};
  if (data.documentName !== undefined) record.csp_name = data.documentName;
  if (data.documentType !== undefined) record.csp_documenttype = DOC_TYPE_FORWARD[data.documentType] ?? null;
  if (data.issuedDate !== undefined) record.csp_issueddate = data.issuedDate || null;
  if (data.expirationDate !== undefined) record.csp_expirationdate = data.expirationDate || null;
  if (data.description !== undefined) record.csp_description = data.description || null;
  if (data.instructions !== undefined) record.csp_instructions = data.instructions || null;
  if (data.relatedAccountId && isGuid(data.relatedAccountId)) {
    record['csp_account@odata.bind'] = `/accounts(${data.relatedAccountId})`;
  }
  return record;
}

const SELECT = 'csp_companydocumentid,csp_name,_csp_account_value,csp_documenttype,csp_issueddate,csp_expirationdate,csp_description,csp_instructions,csp_maindocument_name,statecode,statuscode,createdon';

export async function fetchDocuments(): Promise<CompanyDocument[]> {
  const records = await listRecords(ENTITY_SET, SELECT, undefined, 'createdon desc');
  return records.map(mapFromDataverse);
}

export async function saveDocument(data: Record<string, any>, existingId?: string): Promise<string> {
  const mapped = mapToDataverse(data);
  if (existingId && isGuid(existingId)) {
    await updateRecord(ENTITY_SET, existingId, mapped);
    return existingId;
  }
  return await createRecord(ENTITY_SET, mapped);
}

export async function removeDocument(id: string): Promise<void> {
  await deleteRecord(ENTITY_SET, id);
}

export async function uploadDocumentFile(recordId: string, file: File): Promise<void> {
  if (!isGuid(recordId)) throw new Error('Invalid document ID for upload');
  await uploadFileField(ENTITY_SET, recordId, FILE_FIELD, file);
}

export async function downloadDocumentFile(recordId: string, fileName: string): Promise<void> {
  if (!isGuid(recordId)) throw new Error('Invalid document ID for download');
  await downloadFileField(ENTITY_SET, recordId, FILE_FIELD, fileName);
}
