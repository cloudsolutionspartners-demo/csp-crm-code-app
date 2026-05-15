import { MicrosoftDataverseService } from '../generated/services/MicrosoftDataverseService';
import { getOrgUrl } from './dataverseService';

/**
 * Low-level "fetch CV bytes from one record, upload them to another" primitive.
 * Currently unused — the opportunity model uses reference semantics:
 * the applicant's csp_document is empty unless the user explicitly clicks
 * Replace to upload an override. This helper stays in case we add an
 * explicit "snapshot CV" action later.
 */
export async function copyCvFile(args: {
  fromEntitySet: string;
  fromRecordId: string;
  fromColumn: string;
  toEntitySet: string;
  toRecordId: string;
  toColumn: string;
  fileName: string;
  contentType?: string;
}): Promise<string | null> {
  const {
    fromEntitySet, fromRecordId, fromColumn,
    toEntitySet, toRecordId, toColumn,
    fileName, contentType = 'application/pdf',
  } = args;
  try {
    const orgUrl = getOrgUrl();
    const result = await MicrosoftDataverseService.GetEntityFileImageFieldContentWithOrganization(
      'bytes=0-', orgUrl, fromEntitySet, fromRecordId, fromColumn,
    ) as any;
    const raw = result?.data ?? result;
    if (typeof raw !== 'string' || !raw) return null;
    await MicrosoftDataverseService.UpdateEntityFileImageFieldContentWithOrganization(
      contentType, orgUrl, toEntitySet, toRecordId, toColumn, raw, fileName,
    );
    return fileName;
  } catch (err) {
    console.error('[cvCopy] failed:', err);
    return null;
  }
}
