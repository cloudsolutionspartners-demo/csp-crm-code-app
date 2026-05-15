import { useState, useMemo, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { FormField, SelectField } from '@/components/FormField';
import { AlertTriangle, FileText, Send, X, Users, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import {
  contacts as allContacts, accounts, prospects, onboardingCandidates, getAccountById, getProspectById, getContactById,
} from '@/data/mock-data';
import type { Opportunity, Contact, ContactCv } from '@/types/crm';
import { supabase } from '@/integrations/supabase/client';

const SENDER_NAME = 'CSP Team';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: Opportunity | null;
  /** Called with the saved per-contact CV selections so the parent can persist them on the opportunity. */
  onCvSelectionChange?: (selections: { contactId: string; cvId: string }[]) => void;
  onSent?: () => void;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const dataUrlToBase64 = (dataUrl: string) => {
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
};

interface RowItem {
  kind: 'candidate' | 'contact';
  id: string;
  name: string;
  role: string;
  rateLabel: string;
  cvFileName?: string;
  cvDocument?: string;
  cvMimeType?: string;
}

function pickPrimaryCv(c: Contact): ContactCv | undefined {
  const list = c.cvs || [];
  return list.find(cv => cv.isPrimary) || list[0];
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

interface RecipientPickerProps {
  label: string;
  required?: boolean;
  values: string[];
  onChange: (vals: string[]) => void;
  contactOptions: Contact[];
  multiple?: boolean;
}

function RecipientPicker({ label, required, values, onChange, contactOptions, multiple }: RecipientPickerProps) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);

  const addEmail = (email: string) => {
    const e = email.trim();
    if (!e) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error(`"${e}" is not a valid email`); return; }
    if (values.includes(e)) return;
    onChange(multiple ? [...values, e] : [e]);
    setInput('');
  };
  const remove = (email: string) => onChange(values.filter(v => v !== email));

  return (
    <FormField label={label} required={required}>
      <div className="flex flex-wrap items-center gap-1.5 min-h-9 rounded-md border border-input bg-background px-2 py-1.5">
        {values.map(v => (
          <Badge key={v} variant="secondary" className="gap-1 font-normal">
            {v}
            <button onClick={() => remove(v)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
          </Badge>
        ))}
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail(input); }
            else if (e.key === 'Backspace' && !input && values.length) { remove(values[values.length - 1]); }
          }}
          onBlur={() => input && addEmail(input)}
          placeholder={values.length === 0 ? 'Type email and press Enter…' : ''}
          className="flex-1 min-w-[160px] border-0 h-7 px-1 text-sm focus-visible:ring-0"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <Users className="h-3.5 w-3.5 mr-1" /> Pick contact
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="end">
            <Command>
              <CommandInput placeholder="Search contacts..." />
              <CommandList>
                <CommandEmpty>No contact found.</CommandEmpty>
                <CommandGroup>
                  {contactOptions.map(c => (
                    <CommandItem key={c.id} value={`${c.firstName} ${c.lastName} ${c.email}`}
                      onSelect={() => { addEmail(c.email); setOpen(false); }}>
                      <div className="flex flex-col">
                        <span className="text-sm">{c.firstName} {c.lastName}</span>
                        <span className="text-xs text-muted-foreground">{c.email} · {c.contactType}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </FormField>
  );
}

export function SendOpportunityProfilesDialog({ open, onOpenChange, opportunity, onCvSelectionChange, onSent }: Props) {
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  /** local map of contactId -> cvId chosen for this send */
  const [contactCvMap, setContactCvMap] = useState<Record<string, string>>({});
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const initRef = useRef(false);

  const contactOptions = useMemo(
    () => allContacts.filter(c => !!c.email).sort((a, b) => a.firstName.localeCompare(b.firstName)),
    [],
  );

  // Initialize state when opening
  useEffect(() => {
    if (!open || !opportunity) { initRef.current = false; return; }
    // Pre-fill subject
    setSubject(`CSP — Candidate Profiles for ${opportunity.role || 'Opportunity'} (${opportunity.opportunityNumber})`);
    // Pre-fill To from client
    let suggestedTo: string[] = [];
    if (opportunity.clientLinkType === 'Account' && opportunity.accountId) {
      const acct = getAccountById(opportunity.accountId);
      const primary = allContacts.find(c => c.accountId === opportunity.accountId && c.contactType === 'Client Contact' && !!c.email);
      if (primary) suggestedTo = [primary.email];
      else if (acct?.invoicingEmail) suggestedTo = [acct.invoicingEmail];
      else if (acct?.email) suggestedTo = [acct.email];
    } else if (opportunity.clientLinkType === 'Prospect' && opportunity.prospectId) {
      const p = getProspectById(opportunity.prospectId);
      if (p?.primaryContactEmail) suggestedTo = [p.primaryContactEmail];
    }
    setTo(suggestedTo);
    setCc([]);
    // Pre-fill per-contact CV selection: persisted -> primary -> first
    const map: Record<string, string> = {};
    (opportunity.contactIds || []).forEach(id => {
      const persisted = opportunity.contactCvSelections?.find(s => s.contactId === id)?.cvId;
      const c = getContactById(id);
      const fallback = c ? pickPrimaryCv(c)?.id : undefined;
      const chosen = persisted || fallback;
      if (chosen) map[id] = chosen;
    });
    setContactCvMap(map);
  }, [open, opportunity]);

  // Build the rows shown in the body table (and used for attachments)
  const rows: RowItem[] = useMemo(() => {
    if (!opportunity) return [];
    const out: RowItem[] = [];
    for (const cid of opportunity.candidateIds) {
      const c = onboardingCandidates.find(x => x.id === cid);
      if (!c) continue;
      const candLine = opportunity.candidateRates?.find(r => r.candidateId === cid);
      const candRate = candLine?.rate ?? opportunity.candidateRate;
      const candUnit = candLine?.unit ?? opportunity.candidateRateUnit;
      const candCurrency = candLine?.currency ?? opportunity.currencyCode;
      out.push({
        kind: 'candidate',
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        role: c.candidateRole || opportunity.role,
        rateLabel: candRate != null ? `${candRate} ${candCurrency}/${candUnit.toLowerCase()}` : `€${c.hourlyRateEur}/hour`,
        cvFileName: candLine?.cvOverrideFileName || c.cvFileName,
        cvDocument: candLine?.cvOverrideDocument || c.cvDocument,
        cvMimeType: candLine?.cvOverrideMimeType || c.cvMimeType,
      });
    }
    for (const conId of opportunity.contactIds) {
      const c = getContactById(conId);
      if (!c) continue;
      const cvId = contactCvMap[conId];
      const cv = c.cvs?.find(x => x.id === cvId);
      const line = opportunity.contactRates?.find(r => r.contactId === conId);
      const rateLabel = line?.rate != null
        ? `${line.rate} ${line.currency || opportunity.currencyCode}/${line.unit.toLowerCase()}`
        : '—';
      out.push({
        kind: 'contact',
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        role: c.jobRole || opportunity.role,
        rateLabel,
        cvFileName: cv?.fileName,
        cvDocument: cv?.document,
        cvMimeType: cv?.mimeType,
      });
    }
    return out;
  }, [opportunity, contactCvMap]);

  const buildInitialBodyHtml = () => {
    const greeting = (() => {
      if (to.length === 1) {
        const c = allContacts.find(x => x.email === to[0]);
        if (c) return c.firstName;
      }
      return 'there';
    })();
    return `<p>Hi ${escapeHtml(greeting)},</p>
<p>Following our discussion on <strong>${escapeHtml(opportunity?.role || 'this opportunity')}</strong>, please find below the profiles we'd like to put forward. CVs are attached to this email.</p>
${buildTableHtml(rows)}
<p>Happy to set up an interview at your convenience.</p>
<p>Best Regards,<br/>${escapeHtml(SENDER_NAME)}</p>`;
  };

  const setBodyRef = (node: HTMLDivElement | null) => {
    bodyRef.current = node;
    if (node && !initRef.current && opportunity) {
      node.innerHTML = buildInitialBodyHtml();
      initRef.current = true;
    }
  };

  // Re-render the table region when CV selection changes (rebuilds the whole body, keeps simple)
  useEffect(() => {
    if (!open || !bodyRef.current || !initRef.current) return;
    bodyRef.current.innerHTML = buildInitialBodyHtml();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactCvMap, to]);

  const candidatesMissingCv = rows.filter(r => r.kind === 'candidate' && !r.cvDocument && !r.cvFileName);
  const contactsWithoutCv = rows.filter(r => r.kind === 'contact' && !r.cvFileName);
  const attachmentsCount = rows.filter(r => !!r.cvDocument).length;

  const canSend = to.length > 0 && subject.trim() && !sending && !!opportunity;

  const handleSend = async () => {
    if (!canSend || !opportunity) { toast.error('To and Subject are required'); return; }
    const innerHtml = bodyRef.current?.innerHTML?.trim() || '';
    if (!innerHtml) { toast.error('Body is required'); return; }
    setSending(true);
    try {
      const bodyHtml = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.5;">${innerHtml}</div>`;
      const attachments = rows
        .filter(r => !!r.cvDocument)
        .map(r => ({
          name: r.cvFileName || `${r.name}-CV.pdf`,
          contentBytes: dataUrlToBase64(r.cvDocument as string),
          contentType: r.cvMimeType || 'application/pdf',
        }));

      const { data, error } = await supabase.functions.invoke('send-outlook-email', {
        body: { to: to[0], cc, subject, htmlBody: bodyHtml, attachments },
      });
      if (error || (data && (data as any).success === false)) {
        throw new Error(error?.message || (data as any)?.error || 'Send failed');
      }

      // Persist the chosen per-contact CV selection back onto the opportunity
      const selections = Object.entries(contactCvMap).map(([contactId, cvId]) => ({ contactId, cvId }));
      onCvSelectionChange?.(selections);

      toast.success(`Email sent to ${to[0]}${cc.length ? ` (cc ${cc.length})` : ''} · ${attachmentsCount} CV${attachmentsCount === 1 ? '' : 's'} attached`);
      onOpenChange(false);
      onSent?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  if (!opportunity) return null;

  const clientLabel = (() => {
    if (opportunity.clientLinkType === 'Account') return getAccountById(opportunity.accountId || '')?.name || '—';
    if (opportunity.clientLinkType === 'Prospect') return getProspectById(opportunity.prospectId || '')?.companyName || '—';
    return opportunity.freeClientName || '—';
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Send Profiles · <span className="font-mono text-sm text-muted-foreground">{opportunity.opportunityNumber}</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            For <strong>{opportunity.role || 'opportunity'}</strong> at <strong>{clientLabel}</strong>. Sent through Outlook so it appears in your sent items.
          </p>
        </DialogHeader>

        <div className="space-y-5">
          {/* Profiles + CV selection */}
          <div>
            <h3 className="text-sm font-semibold text-primary mb-2 border-b pb-1">
              Profiles to apply ({rows.length})
            </h3>
            <div className="space-y-1.5">
              {rows.map(r => (
                <div key={`${r.kind}-${r.id}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded border bg-muted/20 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium truncate">{r.name}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">{r.kind}</Badge>
                    <span className="text-muted-foreground truncate">· {r.role || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.kind === 'contact' ? (() => {
                      const c = getContactById(r.id)!;
                      const cvs = c.cvs || [];
                      if (cvs.length === 0) {
                        return <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" /> No CV on file</Badge>;
                      }
                      if (cvs.length === 1) {
                        return <Badge variant="secondary" className="text-xs gap-1"><Paperclip className="h-3 w-3" />{cvs[0].fileName}</Badge>;
                      }
                      return (
                        <div className="w-[260px]">
                          <SelectField label="" value={contactCvMap[r.id] || ''}
                            onChange={(v) => setContactCvMap(prev => ({ ...prev, [r.id]: v }))}
                            options={cvs.map(cv => ({ value: cv.id, label: `${cv.fileName}${cv.label ? ' — ' + cv.label : ''}${cv.isPrimary ? ' ★' : ''}` }))}
                          />
                        </div>
                      );
                    })() : (
                      r.cvFileName ? (
                        <Badge variant="secondary" className="text-xs gap-1"><Paperclip className="h-3 w-3" />{r.cvFileName}</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" /> No CV</Badge>
                      )
                    )}
                  </div>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="text-sm text-muted-foreground italic">This opportunity has no candidates or contacts attached yet.</div>
              )}
            </div>

            {(candidatesMissingCv.length > 0 || contactsWithoutCv.length > 0) && (
              <div className="mt-2 flex items-start gap-2 p-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  {candidatesMissingCv.length + contactsWithoutCv.length} profile{(candidatesMissingCv.length + contactsWithoutCv.length) > 1 ? 's' : ''} have no CV attached. They will appear in the body table but no CV will be sent for them. Add a CV on the Contact / Candidate record to fix this.
                </span>
              </div>
            )}
          </div>

          <RecipientPicker label="To" required values={to} onChange={setTo} contactOptions={contactOptions} />
          <RecipientPicker label="CC (optional)" values={cc} onChange={setCc} contactOptions={contactOptions} multiple />

          <FormField label="Subject" required>
            <Input value={subject} onChange={e => setSubject(e.target.value)} className="h-9 text-sm" />
          </FormField>

          <FormField label="Body" required>
            <div
              ref={setBodyRef}
              contentEditable
              suppressContentEditableWarning
              className="min-h-[280px] rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_table]:my-3 [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_p]:my-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              The profiles table is inserted into the body — click any cell (including Rate) to edit it directly. Switching a Contact's CV above re-renders the table.
            </p>
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={!canSend}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending…' : `Send via Outlook (${attachmentsCount} CV${attachmentsCount === 1 ? '' : 's'})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
