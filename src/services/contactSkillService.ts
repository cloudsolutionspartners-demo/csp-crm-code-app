import { listRecords, createRecord, deleteRecord } from './dataverseService';

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}
function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export interface ContactSkillPlatform {
  id: string;
  contactId: string;
  skillId: string;
  skillName: string;
  platformId: string;
  platformName: string;
}

const ENTITY_SET = 'csp_contactskillplatforms';

function mapFromDataverse(r: any): ContactSkillPlatform {
  return {
    id: norm(r.csp_contactskillplatformid),
    contactId: norm(r._csp_contact_value),
    skillId: norm(r._csp_skill_value),
    skillName: r['_csp_skill_value@OData.Community.Display.V1.FormattedValue'] || '',
    platformId: norm(r._csp_platform_value),
    platformName: r['_csp_platform_value@OData.Community.Display.V1.FormattedValue'] || '',
  };
}

/**
 * Fetch all skill-platform junction records for a specific contact.
 */
export async function fetchSkillsForContact(contactId: string): Promise<ContactSkillPlatform[]> {
  if (!contactId || !isGuid(contactId)) return [];
  const records = await listRecords(
    ENTITY_SET,
    undefined,
    `_csp_contact_value eq ${contactId}`,
    undefined,
  );
  console.log('[ContactSkill] Fetched', records.length, 'skill(s) for contact', contactId);
  return records.map(mapFromDataverse);
}

/**
 * Fetch all skill-platform junctions across all contacts (for the list view).
 */
export async function fetchAllContactSkills(): Promise<ContactSkillPlatform[]> {
  const records = await listRecords(ENTITY_SET, undefined, undefined, undefined);
  console.log('[ContactSkill] Fetched all junctions:', records.length);
  return records.map(mapFromDataverse);
}

/**
 * Add a skill-platform combination to a contact.
 */
export async function addSkillToContact(contactId: string, skillId: string, platformId: string): Promise<string> {
  if (!isGuid(contactId)) throw new Error('Invalid contact ID');
  if (!isGuid(skillId)) throw new Error('Invalid skill ID');
  // Navigation property SchemaName casing (PascalCase) is required on write
  const record: Record<string, any> = {
    'csp_Contact@odata.bind': `/contacts(${contactId})`,
    'csp_Skill@odata.bind': `/csp_jdskills(${skillId})`,
  };
  if (platformId && isGuid(platformId)) {
    record['csp_Platform@odata.bind'] = `/csp_jdplatforms(${platformId})`;
  }
  console.log('[ContactSkill] Adding:', JSON.stringify(record));
  const newId = await createRecord(ENTITY_SET, record);
  console.log('[ContactSkill] Created:', newId);
  return newId;
}

/**
 * Remove a skill-platform junction record (hard delete).
 */
export async function removeSkillFromContact(recordId: string): Promise<void> {
  if (!isGuid(recordId)) return;
  console.log('[ContactSkill] Removing:', recordId);
  await deleteRecord(ENTITY_SET, recordId);
}
