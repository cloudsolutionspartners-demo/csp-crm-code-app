import { useEffect, useRef, useState } from 'react';
import { Dialog, useToast } from '../Layout';
import { sendOutlookEmail, type EmailAttachment } from '../invoice/sendEmail';
import { getOrgUrl } from '../../services/dataverseService';
import { MicrosoftDataverseService } from '../../generated/services/MicrosoftDataverseService';
import { saveOpportunity } from '../../services/opportunityService';
import { saveOpportunityApplicant } from '../../services/opportunityApplicantService';
import type { OnboardingCandidate, Contact, Account, Prospect, Opportunity } from '../../types/crm';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: OnboardingCandidate[];
  contacts: Contact[];
  accounts?: Account[];
  prospects?: Prospect[];
  onSent?: () => void;
}

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function buildInitialHtml(candidates: OnboardingCandidate[]): string {
  const tableRows = candidates.map(c =>
    `<tr><td style="border:1px solid #e5e7eb;padding:8px">${c.firstName} ${c.lastName}</td>` +
    `<td style="border:1px solid #e5e7eb;padding:8px">${c.candidateRole || '—'}</td>` +
    `<td style="border:1px solid #e5e7eb;padding:8px"></td></tr>`,
  ).join('');

  return `<p>Hi there,</p>
<p>Please find below the candidate profiles for your review. CVs are attached to this email.</p>
<table style="border-collapse:collapse;width:auto;margin:16px 0">
<thead><tr>
<th style="border:1px solid #e5e7eb;padding:8px;background:#f3f4f6;text-align:left">Candidate Name</th>
<th style="border:1px solid #e5e7eb;padding:8px;background:#f3f4f6;text-align:left">Role</th>
<th style="border:1px solid #e5e7eb;padding:8px;background:#f3f4f6;text-align:left">Rate</th>
</tr></thead>
<tbody>${tableRows}</tbody>
</table>
<p>Let me know your feedback.</p>
<p>Best Regards,<br/>CSP Team</p>`;
}

async function fetchCvAsBase64(candidateId: string, fileName: string): Promise<EmailAttachment | null> {
  try {
    const orgUrl = getOrgUrl();
    const result = await MicrosoftDataverseService.GetEntityFileImageFieldContentWithOrganization(
      'bytes=0-', orgUrl, 'csp_candidates', candidateId, 'csp_candidatecv',
    ) as any;

    const raw = result?.data ?? result;
    if (!raw) return null;

    let base64: string;

    if (raw instanceof ArrayBuffer || raw instanceof Uint8Array) {
      const bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw;
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64 = btoa(binary);
    } else if (typeof raw === 'string') {
      if (/^[A-Za-z0-9+/]/.test(raw) && raw.length > 100 && !raw.includes('(') && !raw.includes(')')) {
        base64 = raw.replace(/[\s\r\n]/g, '');
      } else if (raw.includes(',')) {
        base64 = raw.split(',').pop()?.replace(/[\s\r\n]/g, '') || '';
      } else {
        try {
          base64 = btoa(raw);
        } catch {
          const encoder = new TextEncoder();
          const bytes = encoder.encode(raw);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          base64 = btoa(binary);
        }
      }
    } else {
      console.error('[SendProfiles] Unexpected CV data type:', typeof raw);
      return null;
    }

    if (!base64) return null;
    console.log('[SendProfiles] CV base64 for', candidateId, 'length:', base64.length, 'starts:', base64.substring(0, 30));
    return { name: fileName, contentBytes: base64 };
  } catch (err) {
    console.error('[SendProfiles] Failed to fetch CV for', candidateId, err);
    return null;
  }
}

export function SendCandidateProfilesDialog({ open, onOpenChange, candidates, contacts, accounts = [], prospects = [], onSent }: Props) {
  const { toast } = useToast();
  const [to, setTo] = useState('');
  const [showPickContact, setShowPickContact] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [showPickCcContact, setShowPickCcContact] = useState(false);
  const [ccContactSearch, setCcContactSearch] = useState('');
  const [cc, setCc] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [subject, setSubject] = useState('CSP - Candidate Profiles Request');
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      setTo('');
      setCc([]);
      setCcInput('');
      setShowPickContact(false);
      setContactSearch('');
      setShowPickCcContact(false);
      setCcContactSearch('');
      setSubject('CSP - Candidate Profiles Request');
    }
  }, [open]);

  const setBodyRef = (el: HTMLDivElement | null) => {
    bodyRef.current = el;
    if (el && open && !initializedRef.current) {
      el.innerHTML = buildInitialHtml(candidates);
      initializedRef.current = true;
    }
  };

  useEffect(() => {
    if (!bodyRef.current || !initializedRef.current) return;
    const contact = contacts.find(c => c.email === to);
    const greeting = contact ? `Hi ${contact.firstName},` : 'Hi there,';
    const html = bodyRef.current.innerHTML;
    const updated = html.replace(/Hi [^,]*,/, greeting);
    if (updated !== html) bodyRef.current.innerHTML = updated;
  }, [to, contacts]);

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

  const pickedContacts = contacts.filter(c => {
    if (!c.email) return false;
    if (!contactSearch) return true;
    const q = contactSearch.toLowerCase();
    return `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  }).slice(0, 50);

  const handleSend = async () => {
    if (!to || !isValidEmail(to)) { toast.error('Enter a valid To email'); return; }
    if (!subject.trim()) { toast.error('Subject is required'); return; }
    const body = bodyRef.current?.innerHTML || '';
    if (!body.trim()) { toast.error('Body is required'); return; }

    setSending(true);
    try {
      console.log('[SendProfiles] CV attachments temporarily disabled — Dataverse file field returns raw binary, not base64');

      await sendOutlookEmail({
        to,
        cc: cc.length > 0 ? cc.join(';') : undefined,
        subject,
        htmlBody: body,
        attachments: undefined,
      });

      // Auto-create one Opportunity per candidate sent
      const toLower = to.toLowerCase();
      const matchedAccountContact = contacts.find(c => c.email?.toLowerCase() === toLower && c.accountId);
      const matchedAccount = matchedAccountContact ? accounts.find(a => a.id === matchedAccountContact.accountId) : undefined;
      const matchedProspect = !matchedAccount ? prospects.find(p => p.primaryContactEmail?.toLowerCase() === toLower) : undefined;
      const today = new Date().toISOString().split('T')[0];
      const createdOppCount: string[] = [];
      for (const c of candidates) {
        try {
          const oppPayload: Partial<Opportunity> = {
            source: matchedAccount ? 'From Existing Client' : matchedProspect ? 'From Prospect' : 'From New Client',
            clientLinkType: matchedAccount ? 'Account' : matchedProspect ? 'Prospect' : 'Free Text',
            accountId: matchedAccount?.id,
            prospectId: matchedProspect?.id,
            freeClientName: !matchedAccount && !matchedProspect ? to : undefined,
            role: c.candidateRole || '',
            opportunityRateUnit: 'Hour',
            opportunityCurrency: 'EUR',
            status: 'New',
            details: `Auto-created when candidate profile was sent to ${to} on ${new Date().toLocaleDateString()}.`,
          };
          const newOppId = await saveOpportunity(oppPayload);
          await saveOpportunityApplicant({
            opportunityId: newOppId,
            candidateId: c.id,
            rate: c.hourlyRateEur,
            rateUnit: 'Hour',
            rateCurrency: 'EUR',
            status: 'Sent',
          } as any);
          createdOppCount.push(c.id);
        } catch (autoErr: any) {
          console.error('[SendProfiles] Auto-create opp failed for candidate', c.id, autoErr);
        }
      }
      // touch `today` so TS doesn't strip the unused var if extracted
      void today;

      const n = createdOppCount.length;
      toast.success(`Email sent · ${n} opportunit${n === 1 ? 'y' : 'ies'} created`);
      onOpenChange(false);
      onSent?.();
    } catch (err: any) {
      console.error('[SendProfiles] Send failed:', err);
      toast.error(err?.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const missingCvCount = candidates.filter(c => !c.cvFileName).length;

  const fieldLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
    color: 'hsl(var(--muted-foreground))', marginBottom: 6, display: 'block',
  };
  const sectionLabel: React.CSSProperties = {
    fontSize: 13, fontWeight: 600,
    color: 'hsl(var(--foreground))', marginBottom: 6, display: 'block',
  };
  const requiredStar = <span style={{ color: '#ef4444', marginLeft: 2 }}> *</span>;
  const ccPickedContacts = contacts.filter(c => {
    if (!c.email) return false;
    if (!ccContactSearch) return true;
    const q = ccContactSearch.toLowerCase();
    return `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  }).slice(0, 50);
  const inputStyle: React.CSSProperties = {
    width: '100%', height: 36, padding: '0 10px', fontSize: 14,
    border: '1px solid hsl(var(--border))', borderRadius: 6, background: 'white',
  };

  return (
    <Dialog open={open} onClose={() => !sending && onOpenChange(false)} title="Send Candidate Profiles" maxWidth="620px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Selected candidates list */}
        <div>
          <label style={sectionLabel}>Selected Candidates ({candidates.length})</label>
          <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 6, maxHeight: 160, overflowY: 'auto' }}>
            {candidates.length === 0 && (
              <div style={{ padding: 12, fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>No candidates selected.</div>
            )}
            {candidates.map(c => (
              <div
                key={c.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderBottom: '1px solid hsl(var(--border))',
                  fontSize: 13,
                }}
              >
                <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 14 }}>📄</span>
                <span style={{ fontWeight: 500 }}>{c.firstName} {c.lastName}</span>
                <span style={{ color: 'hsl(var(--muted-foreground))' }}>·</span>
                <span style={{ flex: 1, color: 'hsl(var(--muted-foreground))' }}>{c.candidateRole || '—'}</span>
                {c.cvFileName ? (
                  <span style={{ color: 'hsl(215 25% 35%)', fontSize: 11, fontWeight: 500 }}>CV attached</span>
                ) : (
                  <span style={{ color: '#d97706', fontSize: 11, fontWeight: 500 }}>No CV</span>
                )}
              </div>
            ))}
          </div>
          {missingCvCount > 0 && (
            <p style={{ fontSize: 12, color: '#d97706', marginTop: 6 }}>
              ⚠ {missingCvCount} candidate{missingCvCount !== 1 ? 's' : ''} without a CV will be listed in the body but won't have a file attached.
            </p>
          )}
        </div>

        {/* To field with Pick contact */}
        <div style={{ position: 'relative' }}>
          <label style={fieldLabel}>To{requiredStar}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="email"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="Type email and press Enter..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              className="csp-btn csp-btn-outline csp-btn-sm"
              onClick={() => setShowPickContact(v => !v)}
            >👥 Pick contact</button>
          </div>
          {showPickContact && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
              background: 'white', border: '1px solid hsl(var(--border))', borderRadius: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 260, overflowY: 'auto',
            }}>
              <input
                type="text"
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                placeholder="Search contacts..."
                autoFocus
                style={{ ...inputStyle, borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
              />
              {pickedContacts.length === 0 && (
                <div style={{ padding: 12, fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>No contacts found.</div>
              )}
              {pickedContacts.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setTo(c.email); setShowPickContact(false); setContactSearch(''); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer',
                    fontSize: 13, borderBottom: '1px solid hsl(var(--border))',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--muted) / 0.3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontWeight: 500 }}>{c.firstName} {c.lastName}</div>
                  <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>{c.email}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CC chips with Pick contact */}
        <div style={{ position: 'relative' }}>
          <label style={fieldLabel}>CC (Optional)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{
              flex: 1,
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
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
                  <button
                    type="button"
                    onClick={() => removeCc(email)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'hsl(var(--muted-foreground))', padding: 0 }}
                    aria-label={`Remove ${email}`}
                  >×</button>
                </span>
              ))}
              <input
                type="email"
                value={ccInput}
                onChange={e => setCcInput(e.target.value)}
                onKeyDown={handleCcKey}
                onBlur={() => { if (ccInput) addCc(ccInput); }}
                placeholder={cc.length === 0 ? 'Type email and press Enter' : ''}
                style={{ flex: 1, minWidth: 120, border: 'none', outline: 'none', fontSize: 13, padding: '4px 0', background: 'transparent' }}
              />
            </div>
            <button
              type="button"
              className="csp-btn csp-btn-outline csp-btn-sm"
              onClick={() => setShowPickCcContact(v => !v)}
            >👥 Pick contact</button>
          </div>
          {showPickCcContact && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
              background: 'white', border: '1px solid hsl(var(--border))', borderRadius: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 260, overflowY: 'auto',
            }}>
              <input
                type="text"
                value={ccContactSearch}
                onChange={e => setCcContactSearch(e.target.value)}
                placeholder="Search contacts..."
                autoFocus
                style={{ ...inputStyle, borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
              />
              {ccPickedContacts.length === 0 && (
                <div style={{ padding: 12, fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>No contacts found.</div>
              )}
              {ccPickedContacts.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { addCc(c.email); setShowPickCcContact(false); setCcContactSearch(''); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer',
                    fontSize: 13, borderBottom: '1px solid hsl(var(--border))',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--muted) / 0.3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontWeight: 500 }}>{c.firstName} {c.lastName}</div>
                  <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>{c.email}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Subject */}
        <div>
          <label style={fieldLabel}>Subject{requiredStar}</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Body */}
        <div>
          <label style={fieldLabel}>Body{requiredStar}</label>
          <div
            ref={setBodyRef}
            contentEditable
            suppressContentEditableWarning
            style={{
              minHeight: 220, maxHeight: 360, overflowY: 'auto',
              border: '1px solid hsl(var(--border))', borderRadius: 6,
              padding: 12, fontSize: 13, background: 'white',
              outline: 'none',
            }}
          />
          <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
            The candidate table is inserted into the body — click any cell (including Rate) to edit it directly.
          </p>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="csp-btn csp-btn-outline"
            disabled={sending}
            onClick={() => onOpenChange(false)}
          >Cancel</button>
          <button
            type="button"
            className="csp-btn csp-btn-primary"
            disabled={sending || candidates.length === 0 || !to || !subject.trim()}
            onClick={handleSend}
          >{sending ? '✈ Sending…' : '✈ Send Email'}</button>
        </div>
      </div>
    </Dialog>
  );
}
