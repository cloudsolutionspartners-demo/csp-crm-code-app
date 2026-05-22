import { listRecords, updateRecord } from './dataverseService';

export interface BusinessUnit {
  id: string;
  name: string;
  isRoot: boolean;
  teamId: string;
  raw: Record<string, any>;
}

let _buTeamMap: Record<string, string> = {};

export function getTeamIdForBU(buId: string): string | undefined {
  return _buTeamMap[buId];
}

const CUSTOM_FIELDS = [
  'csp_bglegalname','csp_bgaddress','csp_bgvatnumber','csp_bgemail','csp_bgphone','csp_bgaccountantemail','csp_bginvoicefooter',
  'csp_bgeubankname','csp_bgeuiban','csp_bgeuswiftbic',
  'csp_bgukbankname','csp_bgukaccountnumber','csp_bguksortcode','csp_bgukiban','csp_bgukswiftbic','csp_bgukintermediarybic',
  'csp_rolegalname','csp_roaddress','csp_rovatnumber','csp_roemail','csp_rophone','csp_roaccountantemail','csp_roinvoicefooter',
  'csp_robankname','csp_roiban','csp_roswiftbic',
  'csp_uslegalname','csp_usaddress','csp_usvatnumber','csp_usemail','csp_usphone','csp_usaccountantemail','csp_usinvoicefooter',
  'csp_usbankname','csp_usaccountnumber','csp_usachroutingnumber','csp_uswireroutingnumber',
].join(',');

export async function fetchBusinessUnits(): Promise<BusinessUnit[]> {
  const buRecords = await listRecords('businessunits', `businessunitid,name,${CUSTOM_FIELDS}`, undefined, 'name asc');

  const teamRecords = await listRecords('teams', 'teamid,name,_businessunitid_value', 'teamtype eq 0 and isdefault eq true');

  const teamByBu: Record<string, string> = {};
  teamRecords.forEach(t => {
    const buId = norm(t._businessunitid_value);
    const teamId = norm(t.teamid);
    if (buId && teamId) teamByBu[buId] = teamId;
  });
  _buTeamMap = teamByBu;

  const orgPattern = /^org[a-f0-9]{8,}/i;

  return buRecords.map(r => {
    const id = norm(r.businessunitid);
    return {
      id,
      name: r.name || '',
      isRoot: orgPattern.test(r.name || ''),
      teamId: teamByBu[id] || '',
      raw: r,
    };
  });
}

export async function updateBusinessUnit(id: string, data: Record<string, unknown>): Promise<void> {
  await updateRecord('businessunits', id, data);
}

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}
