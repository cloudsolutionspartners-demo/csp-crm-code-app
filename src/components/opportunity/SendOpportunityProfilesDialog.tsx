import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, useToast } from '../Layout';
import { formatOppNumber } from '../../lib/utils';
import { sendOutlookEmail, type EmailAttachment } from '../invoice/sendEmail';
import { getOrgUrl } from '../../services/dataverseService';
import { MicrosoftDataverseService } from '../../generated/services/MicrosoftDataverseService';
import { saveOpportunityApplicant } from '../../services/opportunityApplicantService';
import { fetchContactCvs } from '../../services/contactCvService';
import type { Opportunity, OpportunityApplicant, Account, Prospect, Contact, OnboardingCandidate } from '../../types/crm';

const SENDER_NAME = 'CSP Team';

export interface SendOpportunityProfilesDialogProps {
  open: boolean;
  onClose: () => void;
  opportunity: Opportunity | null;
  applicants: OpportunityApplicant[];
  candidates: OnboardingCandidate[];
  contacts: Contact[];
  accounts: Account[];
  prospects: Prospect[];
  /** contactId → that contact's CV rows. Used to surface the source-CV filename
   * on each applicant row so the UI doesn't falsely show "No CV" when the
   * contact has CVs but the applicant has no override. */
  contactCvIndex?: Record<string, (import('../../types/crm').ContactCv & { contactId?: string })[]>;
  onSent: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────
const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface RowItem {
  applicantId: string;
  kind: 'candidate' | 'contact';
  name: string;
  role: string;
  rateLabel: string;
  documentFileName?: string;     // applicant override (csp_opportunityapplicants.csp_document_name)
  cvFileName?: string;           // resolved display name via fallback chain (override → candidate → contact primary)
  cvIsOverride?: boolean;
  status: OpportunityApplicant['status'];
}

function buildTableHtml(rows: RowItem[]) {
  const trs = rows.map(r => `<tr>
    <td style="padding:8px 12px;border:1px solid #e2e8f0;">${escapeHtml(r.name)}</td>
    <td style="padding:8px 12px;border:1px solid #e2e8f0;">${escapeHtml(r.role || '—')}</td>
    <td style="padding:8px 12px;border:1px solid #e2e8f0;">${escapeHtml(r.rateLabel)}</td>
  </tr>`).join('');
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;margin:12px 0;">
    <thead><tr style="background:#f1f5f9;">
      <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Profile</th>
      <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Role</th>
      <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Rate</th>
    </tr></thead>
    <tbody>${trs}</tbody>
  </table>`;
}

// Encode a Latin-1 "binary string" (where each char is a byte, code 0-255) to
// base64. btoa accepts these directly; chunked for very large files to avoid
// argument-length limits in some engines.
function latin1BinaryStringToBase64(binaryString: string): string {
  try {
    return btoa(binaryString);
  } catch (err) {
    console.warn('[SendOppProfiles] btoa direct failed, using chunked approach:', err);
    let result = '';
    const chunkSize = 0x8000; // 32KB
    for (let i = 0; i < binaryString.length; i += chunkSize) {
      result += btoa(binaryString.substring(i, i + chunkSize));
    }
    return result;
  }
}

// Normalise an SDK file-fetch response → base64 string.
// Important: the connector returns the file as a Latin-1 binary STRING
// (charCode = byte value), NOT base64. The old "looks like base64" heuristic
// false-positived on binary PDFs that happen to contain commas, so the result
// was sent unencoded → Outlook rejected with "not a valid Base-64 string".
function normaliseToBase64(raw: any): string | null {
  if (!raw) return null;
  if (raw instanceof ArrayBuffer || raw instanceof Uint8Array) {
    const bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw;
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return latin1BinaryStringToBase64(binary);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    // 1. Already-valid base64 (strict regex, length divisible by 4)
    if (trimmed.length > 0 && trimmed.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(trimmed)) {
      return trimmed;
    }
    // 2. Data URL — strip "data:<mime>;base64,"
    if (raw.startsWith('data:')) {
      const idx = raw.indexOf(',');
      if (idx > -1) return raw.substring(idx + 1).replace(/[\s\r\n]/g, '');
    }
    // 3. Latin-1 binary string (default for csp_*.csp_document fetches)
    return latin1BinaryStringToBase64(raw);
  }
  return null;
}

async function fetchFileAsBase64(entitySet: string, recordId: string, column: string, fileName: string): Promise<EmailAttachment | null> {
  console.log('[SendOppProfiles] fetch source CV:', { entitySet, recordId, column, fileName });
  try {
    const orgUrl = getOrgUrl();
    const result = await MicrosoftDataverseService.GetEntityFileImageFieldContentWithOrganization(
      'bytes=0-', orgUrl, entitySet, recordId, column,
    ) as any;
    console.log('[SendOppProfiles] raw fetch result:', result);
    console.log('[SendOppProfiles] result keys:', result && typeof result === 'object' ? Object.keys(result) : 'n/a');
    console.log('[SendOppProfiles] result.success:', result?.success, 'result.error:', result?.error);
    if (result?.success === false) {
      console.warn('[SendOppProfiles] SDK reported failure:', result?.error);
      return null;
    }
    const raw = result?.data ?? result;
    console.log('[SendOppProfiles] raw type:', typeof raw,
      'isArrayBuffer:', raw instanceof ArrayBuffer,
      'isUint8Array:', raw instanceof Uint8Array,
      'length:', typeof raw === 'string' ? raw.length : (raw?.byteLength ?? 'n/a'));
    if (typeof raw === 'string') {
      console.log('[SendOppProfiles] raw first 80 chars (JSON):', JSON.stringify(raw.substring(0, 80)));
      console.log('[SendOppProfiles] raw charCodes 0-20:',
        Array.from(raw.substring(0, 20)).map(c => (c as string).charCodeAt(0)).join(','));
      const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
      console.log('[SendOppProfiles] looks like pure base64:', base64Pattern.test(raw.trim()));
    }
    const base64 = normaliseToBase64(raw);
    if (!base64) {
      console.warn('[SendOppProfiles] no bytes returned for', { entitySet, recordId, column });
      return null;
    }
    console.log('[SendOppProfiles] CV ready:', { entitySet, recordId, fileName, base64Length: base64.length, first30: base64.substring(0, 30) });
    return { name: fileName, contentBytes: base64 };
  } catch (err) {
    console.error('[SendOppProfiles] fetch failed for', { entitySet, recordId, column }, err);
    return null;
  }
}

/**
 * Branching CV resolver — Reference model:
 *  1. If applicant has own csp_document (Replace override) → use it
 *  2. Candidate applicant → fetch csp_candidates.csp_candidatecv
 *  3. Contact applicant → fetch primary/first csp_contactcvs.csp_document
 */
async function fetchCvForApplicant(
  applicant: OpportunityApplicant,
  candidates: OnboardingCandidate[],
  contacts: Contact[],
): Promise<EmailAttachment | null> {
  console.log('[SendOppProfiles] fetchCvForApplicant START:', {
    applicantId: applicant.id,
    documentFileName: applicant.documentFileName,
    candidateId: applicant.candidateId,
    contactId: applicant.contactId,
  });
  // Override path
  if (applicant.documentFileName) {
    console.log('[SendOppProfiles] BRANCH 1: applicant has override document');
    const override = await fetchFileAsBase64('csp_opportunityapplicants', applicant.id, 'csp_document', applicant.documentFileName);
    if (override) return override;
    console.warn('[SendOppProfiles] override fetch failed, falling back to source CV');
  } else {
    console.log('[SendOppProfiles] no applicant override, fetching from source');
  }

  if (applicant.candidateId) {
    console.log('[SendOppProfiles] BRANCH 2: candidate source');
    const cand = candidates.find(c => c.id === applicant.candidateId);
    console.log('[SendOppProfiles] candidate found:', !!cand, 'cvFileName:', cand?.cvFileName);
    const fileName = cand?.cvFileName || `${cand ? cand.firstName + '_' + cand.lastName : applicant.candidateId}_CV.pdf`;
    if (!cand?.cvFileName) console.warn('[SendOppProfiles] candidate has no cvFileName recorded — attempting fetch anyway');
    return await fetchFileAsBase64('csp_candidates', applicant.candidateId, 'csp_candidatecv', fileName);
  }

  if (applicant.contactId) {
    console.log('[SendOppProfiles] BRANCH 3: contact source — fetching contact CVs');
    const cvs = await fetchContactCvs(applicant.contactId);
    console.log('[SendOppProfiles] contact CV count:', cvs.length);
    if (cvs.length === 0) {
      console.warn('[SendOppProfiles] contact has no CVs:', applicant.contactId);
      return null;
    }
    const cv = cvs.find(c => c.isPrimary) || cvs[0];
    const contact = contacts.find(c => c.id === applicant.contactId);
    const fileName = cv.fileName || (contact ? `${contact.firstName}_${contact.lastName}_CV.pdf` : `Contact_CV_${cv.id}.pdf`);
    console.log('[SendOppProfiles] picked contact CV:', { cvId: cv.id, fileName });
    return await fetchFileAsBase64('csp_contactcvs', cv.id, 'csp_document', fileName);
  }

  console.warn('[SendOppProfiles] applicant has neither candidateId nor contactId:', applicant.id);
  return null;
}

// ── Styles ─────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
  color: 'hsl(var(--muted-foreground))', marginBottom: 4, display: 'block',
};
const inputStyle: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 10px', fontSize: 14,
  border: '1px solid hsl(var(--border))', borderRadius: 6, background: 'white',
  boxSizing: 'border-box',
};

// ── Main dialog ────────────────────────────────────────────────────────
export function SendOpportunityProfilesDialog({
  open, onClose, opportunity, applicants, candidates, contacts, accounts, prospects, contactCvIndex, onSent,
}: SendOpportunityProfilesDialogProps) {
  const { toast } = useToast();
  const [to, setTo] = useState('');
  const [showPickContact, setShowPickContact] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [cc, setCc] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [showPickCcContact, setShowPickCcContact] = useState(false);
  const [ccContactSearch, setCcContactSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);

  // ── Build rows (one per applicant) ─────────────────────────────────
  const rows: RowItem[] = useMemo(() => {
    if (!opportunity) return [];
    return applicants
      .filter(a => a.opportunityId === opportunity.id)
      .map(a => {
        let name = '—';
        let role = opportunity.role;
        let sourceCvName: string | undefined;
        if (a.candidateId) {
          const c = candidates.find(x => x.id === a.candidateId);
          if (c) {
            name = `${c.firstName} ${c.lastName}`;
            if (c.candidateRole) role = c.candidateRole;
            sourceCvName = c.cvFileName || undefined;
          }
        } else if (a.contactId) {
          const c = contacts.find(x => x.id === a.contactId);
          if (c) { name = `${c.firstName} ${c.lastName}`; if (c.jobRole) role = c.jobRole; }
          const cvs = (contactCvIndex && contactCvIndex[a.contactId]) || [];
          const cv = cvs.find(x => x.isPrimary) || cvs[0];
          sourceCvName = cv?.fileName || undefined;
        }
        const rateLabel = a.rate != null
          ? `${a.rate} ${a.rateCurrency || opportunity.opportunityCurrency || ''}/${(a.rateUnit || 'Hour').toLowerCase()}`.trim()
          : '—';
        // Fallback chain: applicant override → candidate.cvFileName → contact's primary CV
        const cvFileName = a.documentFileName || sourceCvName || undefined;
        const cvIsOverride = !!a.documentFileName;
        return {
          applicantId: a.id,
          kind: a.candidateId ? 'candidate' as const : 'contact' as const,
          name, role, rateLabel,
          documentFileName: a.documentFileName,
          cvFileName, cvIsOverride,
          status: a.status,
        };
      });
  }, [opportunity, applicants, candidates, contacts, contactCvIndex]);

  const eligibleRows = rows.filter(r => r.status === 'Drafted');
  const ineligibleRows = rows.filter(r => r.status !== 'Drafted');

  // ── Reset state when reopened ──────────────────────────────────────
  useEffect(() => {
    if (!open || !opportunity) {
      initializedRef.current = false;
      return;
    }
    // Subject
    setSubject(`CSP - Opportunity Profiles - ${formatOppNumber(opportunity.opportunityNumber)} - ${opportunity.role || ''}`.replace(/ - $/, ''));
    // Pre-seed To from client
    let preseed = '';
    if (opportunity.source === 'From Existing Client' && opportunity.accountId) {
      const acct = accounts.find(a => a.id === opportunity.accountId);
      const primary = contacts.find(c => c.accountId === opportunity.accountId && c.contactType === 'Client Contact' && !!c.email);
      if (primary?.email) preseed = primary.email;
      else if (acct?.invoicingEmail) preseed = acct.invoicingEmail;
      else if (acct?.email) preseed = acct.email;
    } else if (opportunity.source === 'From Prospect' && opportunity.prospectId) {
      const p = prospects.find(x => x.id === opportunity.prospectId);
      if (p?.primaryContactEmail) preseed = p.primaryContactEmail;
    } else if (opportunity.source === 'From Existing Consultant' && opportunity.sourceContactId) {
      const c = contacts.find(x => x.id === opportunity.sourceContactId);
      if (c?.email) preseed = c.email;
    }
    setTo(preseed);
    setCc([]);
    setCcInput('');
    setShowPickContact(false);
    setShowPickCcContact(false);
    setContactSearch('');
    setCcContactSearch('');
    setError('');
    // Select all eligible by default
    setSelectedIds(new Set(applicants.filter(a => a.opportunityId === opportunity.id && a.status === 'Drafted').map(a => a.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, opportunity?.id]);

  // ── Body initial HTML ──────────────────────────────────────────────
  const buildInitialBodyHtml = (): string => {
    const greeting = (() => {
      if (to && isValidEmail(to)) {
        const c = contacts.find(x => x.email === to);
        if (c) return c.firstName;
      }
      return 'there';
    })();
    const selectedRows = eligibleRows.filter(r => selectedIds.has(r.applicantId));
    return `<p>Hi ${escapeHtml(greeting)},</p>
<p>Please find below the profiles for the <strong>${escapeHtml(opportunity?.role || 'opportunity')}</strong> opportunity. CVs are attached to this email.</p>
${buildTableHtml(selectedRows)}
<p>Happy to set up an interview at your convenience.</p>
<p>Best Regards,<br/>${escapeHtml(SENDER_NAME)}</p>`;
  };

  const setBodyRef = (node: HTMLDivElement | null) => {
    bodyRef.current = node;
    if (node && open && !initializedRef.current && opportunity) {
      node.innerHTML = buildInitialBodyHtml();
      initializedRef.current = true;
    }
  };

  // Re-render body when selection or To changes (after init)
  useEffect(() => {
    if (!open || !opportunity || !bodyRef.current || !initializedRef.current) return;
    bodyRef.current.innerHTML = buildInitialBodyHtml();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, to, opportunity?.id]);

  // ── Selection helpers ──────────────────────────────────────────────
  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };
  const allEligibleIds = eligibleRows.map(r => r.applicantId);
  const allSelected = allEligibleIds.length > 0 && allEligibleIds.every(id => selectedIds.has(id));
  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(allEligibleIds) : new Set());
  };

  // ── CC chip input ──────────────────────────────────────────────────
  const addCc = (raw: string) => {
    const email = raw.trim().replace(/[,;]$/, '');
    if (!email) return;
    if (!isValidEmail(email)) { toast.error(`Invalid email: ${email}`); return; }
    if (cc.includes(email) || email === to) return;
    setCc([...cc, email]);
    setCcInput('');
  };
  const removeCc = (email: string) => setCc(cc.filter(c => c !== email));
  const handleCcKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault();
      addCc(ccInput);
    } else if (e.key === 'Backspace' && !ccInput && cc.length > 0) {
      setCc(cc.slice(0, -1));
    }
  };

  // ── Contact pickers ────────────────────────────────────────────────
  const pickedContacts = contacts.filter(c => {
    if (!c.email) return false;
    if (!contactSearch) return true;
    const q = contactSearch.toLowerCase();
    return `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  }).slice(0, 50);
  const ccPickedContacts = contacts.filter(c => {
    if (!c.email) return false;
    if (!ccContactSearch) return true;
    const q = ccContactSearch.toLowerCase();
    return `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  }).slice(0, 50);

  // ── Send ───────────────────────────────────────────────────────────
  const selectedRows = eligibleRows.filter(r => selectedIds.has(r.applicantId));
  const eligibleCount = selectedRows.length;

  const canSend = !!opportunity && !!to && isValidEmail(to) && !!subject.trim() && eligibleCount > 0 && !sending;

  const handleSend = async () => {
    if (!opportunity) return;
    if (!canSend) {
      if (!to || !isValidEmail(to)) setError('Enter a valid To email');
      else if (!subject.trim()) setError('Subject is required');
      else if (eligibleCount === 0) setError('Select at least one Drafted applicant');
      return;
    }
    const body = bodyRef.current?.innerHTML || '';
    if (!body.replace(/<[^>]+>/g, '').trim()) { setError('Body is required'); return; }

    setSending(true);
    setError('');
    try {
      // Fetch CVs for each selected applicant via the reference-model resolver:
      // override → candidate.csp_candidatecv → contact's primary csp_contactcv
      console.log('[SendOppProfiles] selectedRows about to fetch CVs for:',
        selectedRows.map(r => ({ id: r.applicantId, name: r.name, documentFileName: r.documentFileName })));
      const attachments: EmailAttachment[] = [];
      let missing = 0;
      for (const r of selectedRows) {
        const applicant = applicants.find(a => a.id === r.applicantId);
        if (!applicant) { missing++; continue; }
        console.log('[SendOppProfiles] processing applicant for attachment:', {
          id: applicant.id, name: r.name,
          override: !!applicant.documentFileName,
          candidateId: applicant.candidateId, contactId: applicant.contactId,
        });
        const att = await fetchCvForApplicant(applicant, candidates, contacts);
        if (att) {
          attachments.push(att);
          console.log('[SendOppProfiles] attachment added:', att.name);
        } else {
          missing++;
          console.warn('[SendOppProfiles] no attachment built for', r.applicantId);
        }
      }
      console.log('[SendOppProfiles] final attachments count:', attachments.length,
        'names:', attachments.map(a => a.name));
      if (missing > 0) {
        console.warn(`[SendOppProfiles] ${missing} applicant(s) had no CV — sending without them`);
      }

      const wrappedBody = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.5;">${body}</div>`;

      await sendOutlookEmail({
        to,
        cc: cc.length > 0 ? cc.join(';') : undefined,
        subject,
        htmlBody: wrappedBody,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      // Flip selected applicants Drafted → Sent
      for (const r of selectedRows) {
        try {
          await saveOpportunityApplicant({ status: 'Sent' }, r.applicantId);
        } catch (err) {
          console.error('[SendOppProfiles] Failed to flip applicant', r.applicantId, 'to Sent:', err);
        }
      }

      toast.success(`Email sent · ${attachments.length} CV${attachments.length !== 1 ? 's' : ''} attached · ${selectedRows.length} applicant${selectedRows.length !== 1 ? 's' : ''} marked Sent`);
      onSent();
      onClose();
    } catch (err: any) {
      console.error('[SendOppProfiles] Send failed:', err);
      setError(err?.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  if (!opportunity) return null;

  // ── Client label ───────────────────────────────────────────────────
  const clientLabel = (() => {
    if (opportunity.clientLinkType === 'Account')
      return accounts.find(a => a.id === opportunity.accountId)?.name || opportunity.accountName || '—';
    if (opportunity.clientLinkType === 'Prospect')
      return prospects.find(p => p.id === opportunity.prospectId)?.companyName || opportunity.prospectName || '—';
    if (opportunity.clientLinkType === 'Contact') {
      const c = contacts.find(x => x.id === opportunity.sourceContactId);
      return c ? `${c.firstName} ${c.lastName}` : opportunity.sourceContactName || '—';
    }
    return opportunity.freeClientName || '—';
  })();

  return (
    <Dialog open={open} onClose={() => !sending && onClose()} title={`Send Opportunity Profiles — ${formatOppNumber(opportunity.opportunityNumber)}`} maxWidth="720px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Client context */}
        <div style={{ background: 'hsl(var(--muted) / 0.3)', border: '1px solid hsl(var(--border))', borderRadius: 6, padding: 10, fontSize: 13 }}>
          For <strong>{opportunity.role || 'opportunity'}</strong> at <strong>{clientLabel}</strong>
          {opportunity.opportunityRate ? <> · {opportunity.opportunityRate} {opportunity.opportunityCurrency || ''}/{(opportunity.opportunityRateUnit || 'Hour').toLowerCase()}</> : null}
        </div>

        {/* Applicants section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Applicants ({eligibleRows.length} eligible)</label>
            {eligibleRows.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'hsl(var(--muted-foreground))', cursor: 'pointer' }}>
                <input type="checkbox" checked={allSelected} onChange={e => toggleAll(e.target.checked)} />
                Select all
              </label>
            )}
          </div>
          <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 6, maxHeight: 200, overflowY: 'auto' }}>
            {rows.length === 0 && (
              <div style={{ padding: 12, fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>No applicants on this opportunity yet.</div>
            )}
            {eligibleRows.map(r => (
              <div
                key={r.applicantId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderBottom: '1px solid hsl(var(--border))', fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(r.applicantId)}
                  onChange={e => toggleOne(r.applicantId, e.target.checked)}
                />
                <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 14 }}>📄</span>
                <span style={{ fontWeight: 500 }}>{r.name}</span>
                <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>· {r.kind}</span>
                <span style={{ flex: 1, color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {r.role || '—'}</span>
                {r.cvFileName ? (
                  <span
                    style={{
                      color: 'hsl(215 25% 35%)', fontSize: 11, fontWeight: 500,
                      maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                    title={r.cvIsOverride ? `Override: ${r.cvFileName}` : r.cvFileName}
                  >📎 {r.cvFileName}{r.cvIsOverride ? ' (override)' : ''}</span>
                ) : (
                  <span style={{ color: '#d97706', fontSize: 11, fontWeight: 500 }}>⚠ No CV</span>
                )}
              </div>
            ))}
            {ineligibleRows.map(r => (
              <div
                key={r.applicantId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderBottom: '1px solid hsl(var(--border))',
                  fontSize: 13, opacity: 0.5,
                }}
                title={`Already ${r.status}`}
              >
                <input type="checkbox" disabled checked={false} />
                <span style={{ fontSize: 14 }}>📄</span>
                <span style={{ fontWeight: 500 }}>{r.name}</span>
                <span style={{ flex: 1, color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {r.role || '—'}</span>
                <span style={{
                  background: 'hsl(var(--muted) / 0.6)', color: 'hsl(var(--foreground))',
                  padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 500,
                }}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* To with Pick contact */}
        <div style={{ position: 'relative' }}>
          <label style={labelStyle}>To <span style={{ color: '#ef4444' }}>*</span></label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="email" value={to} onChange={e => setTo(e.target.value)}
              placeholder="recipient@example.com" style={{ ...inputStyle, flex: 1 }}
            />
            <button type="button" className="csp-btn csp-btn-outline csp-btn-sm"
              onClick={() => setShowPickContact(v => !v)}>👥 Pick contact</button>
          </div>
          {showPickContact && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
              background: 'white', border: '1px solid hsl(var(--border))', borderRadius: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 260, overflowY: 'auto',
            }}>
              <input
                type="text" value={contactSearch} onChange={e => setContactSearch(e.target.value)}
                placeholder="Search contacts..." autoFocus
                style={{ ...inputStyle, borderRadius: 0, border: 'none', borderBottom: '1px solid hsl(var(--border))' }}
              />
              {pickedContacts.length === 0 && (
                <div style={{ padding: 12, fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>No contacts found.</div>
              )}
              {pickedContacts.map(c => (
                <button key={c.id} type="button"
                  onClick={() => { setTo(c.email); setShowPickContact(false); setContactSearch(''); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer',
                    fontSize: 13, borderBottom: '1px solid hsl(var(--border))',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--muted) / 0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontWeight: 500 }}>{c.firstName} {c.lastName}</div>
                  <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>{c.email} · {c.contactType}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CC chips with Pick contact */}
        <div style={{ position: 'relative' }}>
          <label style={labelStyle}>CC (Optional)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{
              flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
              minHeight: 36, padding: '4px 8px',
              border: '1px solid hsl(var(--border))', borderRadius: 6, background: 'white',
            }}>
              {cc.map(email => (
                <span key={email} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'hsl(var(--muted) / 0.4)', color: 'hsl(var(--foreground))',
                  padding: '2px 8px', borderRadius: 9999, fontSize: 12,
                }}>
                  {email}
                  <button type="button" onClick={() => removeCc(email)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'hsl(var(--muted-foreground))', padding: 0 }}
                    aria-label={`Remove ${email}`}>×</button>
                </span>
              ))}
              <input
                type="email" value={ccInput}
                onChange={e => setCcInput(e.target.value)} onKeyDown={handleCcKey}
                onBlur={() => { if (ccInput) addCc(ccInput); }}
                placeholder={cc.length === 0 ? 'Type email and press Enter' : ''}
                style={{ flex: 1, minWidth: 120, border: 'none', outline: 'none', fontSize: 13, padding: '4px 0', background: 'transparent' }}
              />
            </div>
            <button type="button" className="csp-btn csp-btn-outline csp-btn-sm"
              onClick={() => setShowPickCcContact(v => !v)}>👥 Pick contact</button>
          </div>
          {showPickCcContact && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
              background: 'white', border: '1px solid hsl(var(--border))', borderRadius: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 260, overflowY: 'auto',
            }}>
              <input
                type="text" value={ccContactSearch} onChange={e => setCcContactSearch(e.target.value)}
                placeholder="Search contacts..." autoFocus
                style={{ ...inputStyle, borderRadius: 0, border: 'none', borderBottom: '1px solid hsl(var(--border))' }}
              />
              {ccPickedContacts.length === 0 && (
                <div style={{ padding: 12, fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>No contacts found.</div>
              )}
              {ccPickedContacts.map(c => (
                <button key={c.id} type="button"
                  onClick={() => { addCc(c.email); setShowPickCcContact(false); setCcContactSearch(''); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer',
                    fontSize: 13, borderBottom: '1px solid hsl(var(--border))',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--muted) / 0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontWeight: 500 }}>{c.firstName} {c.lastName}</div>
                  <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>{c.email} · {c.contactType}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Subject */}
        <div>
          <label style={labelStyle}>Subject <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle} />
        </div>

        {/* Body */}
        <div>
          <label style={labelStyle}>Body <span style={{ color: '#ef4444' }}>*</span></label>
          <div
            ref={setBodyRef}
            contentEditable
            suppressContentEditableWarning
            style={{
              minHeight: 220, maxHeight: 360, overflowY: 'auto',
              border: '1px solid hsl(var(--border))', borderRadius: 6,
              padding: 12, fontSize: 13, background: 'white', outline: 'none',
            }}
          />
          <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
            The applicants table is inserted into the body — click any cell (including Rate) to edit it directly. Toggling the checklist above re-renders the table.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'hsl(0 65% 96%)', border: '1px solid hsl(0 65% 85%)', color: 'hsl(0 65% 35%)', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" className="csp-btn csp-btn-outline" onClick={onClose} disabled={sending}>Cancel</button>
          <button type="button" className="csp-btn csp-btn-primary" onClick={handleSend} disabled={!canSend}>
            {sending ? '✈ Sending…' : `✈ Send via Outlook (${eligibleCount} CV${eligibleCount === 1 ? '' : 's'})`}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
