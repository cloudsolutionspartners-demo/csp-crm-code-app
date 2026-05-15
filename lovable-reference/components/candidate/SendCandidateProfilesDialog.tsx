import { useState, useMemo, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { FormField } from '@/components/FormField';
import { AlertTriangle, FileText, Send, X, Users, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { contacts, accounts, prospects, addOpportunity, nextOpportunityNumber } from '@/data/mock-data';
import type { OnboardingCandidate, Contact, Opportunity } from '@/types/crm';
import { supabase } from '@/integrations/supabase/client';

const SENDER_NAME = 'CSP Team';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: OnboardingCandidate[];
  onSent?: () => void;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const dataUrlToBase64 = (dataUrl: string) => {
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
};

const buildTableHtml = (cands: OnboardingCandidate[]) => {
  const rows = cands
    .map(
      c => `<tr>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;">${escapeHtml(`${c.firstName} ${c.lastName}`)}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;">${escapeHtml(c.candidateRole || '—')}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;"></td>
      </tr>`,
    )
    .join('');
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;margin:12px 0;">
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Candidate Name</th>
        <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Role</th>
        <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left;">Rate</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
};

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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      toast.error(`"${e}" is not a valid email`);
      return;
    }
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
            <button onClick={() => remove(v)} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addEmail(input);
            } else if (e.key === 'Backspace' && !input && values.length) {
              remove(values[values.length - 1]);
            }
          }}
          onBlur={() => input && addEmail(input)}
          placeholder={values.length === 0 ? 'Type email and press Enter…' : ''}
          className="flex-1 min-w-[160px] border-0 h-7 px-1 text-sm focus-visible:ring-0"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <Users className="h-3.5 w-3.5 mr-1" />
              Pick contact
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="end">
            <Command>
              <CommandInput placeholder="Search contacts..." />
              <CommandList>
                <CommandEmpty>No contact found.</CommandEmpty>
                <CommandGroup>
                  {contactOptions.map(c => (
                    <CommandItem
                      key={c.id}
                      value={`${c.firstName} ${c.lastName} ${c.email}`}
                      onSelect={() => {
                        addEmail(c.email);
                        setOpen(false);
                      }}
                    >
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

export function SendCandidateProfilesDialog({ open, onOpenChange, candidates, onSent }: Props) {
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [subject, setSubject] = useState('CSP - Candidate Profiles Request');
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);

  const contactOptions = useMemo(
    () => contacts.filter(c => !!c.email).sort((a, b) => a.firstName.localeCompare(b.firstName)),
    [],
  );

  const buildInitialBodyHtml = (greetingTarget: string, cands: OnboardingCandidate[]) => {
    return `<p>Hi ${escapeHtml(greetingTarget)},</p>
<p>Please find below the candidate profiles for your review. CVs are attached to this email.</p>
${buildTableHtml(cands)}
<p>Let me know your feedback.</p>
<p>Best Regards,<br/>${escapeHtml(SENDER_NAME)}</p>`;
  };

  // Reset init flag when dialog closes
  useEffect(() => {
    if (!open) initializedRef.current = false;
  }, [open]);

  // Callback ref: initialize innerHTML the moment the editable div mounts
  const setBodyRef = (node: HTMLDivElement | null) => {
    bodyRef.current = node;
    if (node && !initializedRef.current) {
      const greetingTarget = to.length === 1
        ? (contacts.find(c => c.email === to[0])?.firstName || 'there')
        : 'there';
      node.innerHTML = buildInitialBodyHtml(greetingTarget, candidates);
      initializedRef.current = true;
    }
  };

  // Refresh greeting when To changes — only update the first <p>Hi X,</p>
  useEffect(() => {
    if (!open || !bodyRef.current || !initializedRef.current) return;
    const target = to.length === 1
      ? (contacts.find(c => c.email === to[0])?.firstName || 'there')
      : 'there';
    const html = bodyRef.current.innerHTML;
    const updated = html.replace(/^(\s*<p>)Hi [^,<]+,/, `$1Hi ${escapeHtml(target)},`);
    if (updated !== html) bodyRef.current.innerHTML = updated;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);

  const missingCv = candidates.filter(c => !c.cvDocument && !c.cvFileName);
  const withCv = candidates.filter(c => c.cvDocument || c.cvFileName);

  const canSend = to.length > 0 && subject.trim() && !sending;

  const handleSend = async () => {
    if (!canSend) {
      toast.error('To and Subject are required');
      return;
    }
    const innerHtml = bodyRef.current?.innerHTML?.trim() || '';
    if (!innerHtml) {
      toast.error('Body is required');
      return;
    }
    setSending(true);
    try {
      const bodyHtml = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.5;">${innerHtml}</div>`;

      const attachments = withCv
        .filter(c => !!c.cvDocument)
        .map(c => ({
          name: c.cvFileName || `${c.firstName}-${c.lastName}-CV.pdf`,
          contentBytes: dataUrlToBase64(c.cvDocument as string),
          contentType: c.cvMimeType || 'application/pdf',
        }));

      const { data, error } = await supabase.functions.invoke('send-outlook-email', {
        body: {
          to: to[0],
          cc: cc,
          subject,
          htmlBody: bodyHtml,
          attachments,
        },
      });

      if (error || (data && (data as any).success === false)) {
        throw new Error(error?.message || (data as any)?.error || 'Send failed');
      }

      // Auto-create one opportunity per candidate sent (links to client based on To address)
      const toEmail = to[0].toLowerCase();
      const matchedAccountContact = contacts.find(c => c.email?.toLowerCase() === toEmail && c.accountId);
      const matchedAccount = matchedAccountContact ? accounts.find(a => a.id === matchedAccountContact.accountId) : undefined;
      const matchedProspect = !matchedAccount ? prospects.find(p => p.primaryContactEmail?.toLowerCase() === toEmail) : undefined;
      const createdOpps: Opportunity[] = candidates.map(c => {
        const opp: Opportunity = {
          id: `opp-${Date.now()}-${c.id}`,
          opportunityNumber: nextOpportunityNumber(),
          source: matchedAccount ? 'From Existing Client' : matchedProspect ? 'From Prospect' : 'From New Client',
          clientLinkType: matchedAccount ? 'Account' : matchedProspect ? 'Prospect' : 'Free Text',
          accountId: matchedAccount?.id,
          prospectId: matchedProspect?.id,
          freeClientName: !matchedAccount && !matchedProspect ? to[0] : undefined,
          candidateIds: [c.id],
          contactIds: [],
          role: c.candidateRole || '',
          candidateRate: c.hourlyRateEur,
          candidateRateUnit: 'Hour',
          currencyCode: 'EUR',
          opportunityRateUnit: 'Hour',
          status: 'New',
          details: `Auto-created when candidate profile was sent to ${to[0]} on ${new Date().toLocaleDateString()}.`,
          createdAt: new Date().toISOString().split('T')[0],
        };
        addOpportunity(opp);
        return opp;
      });

      toast.success(`Email sent to ${to[0]}${cc.length ? ` (cc ${cc.length})` : ''} · ${createdOpps.length} opportunit${createdOpps.length === 1 ? 'y' : 'ies'} created`);
      onOpenChange(false);
      onSent?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Candidate Profiles</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Selected candidates summary */}
          <div>
            <h3 className="text-sm font-semibold text-primary mb-2 border-b pb-1">
              Selected Candidates ({candidates.length})
            </h3>
            <div className="space-y-1.5">
              {candidates.map(c => {
                const hasCv = !!(c.cvDocument || c.cvFileName);
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded border bg-muted/20 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">{c.firstName} {c.lastName}</span>
                      <span className="text-muted-foreground truncate">· {c.candidateRole || '—'}</span>
                    </div>
                    {hasCv ? (
                      <Badge variant="secondary" className="text-xs">CV attached</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <AlertTriangle className="h-3 w-3" /> No CV
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
            {missingCv.length > 0 && (
              <div className="mt-2 flex items-start gap-2 p-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  {missingCv.length} candidate{missingCv.length > 1 ? 's are' : ' is'} missing a CV ({missingCv.map(c => `${c.firstName} ${c.lastName}`).join(', ')}). They will appear in the email body table but no CV will be attached for them.
                </span>
              </div>
            )}
          </div>

          <RecipientPicker
            label="To"
            required
            values={to}
            onChange={setTo}
            contactOptions={contactOptions}
          />

          <RecipientPicker
            label="CC (optional)"
            values={cc}
            onChange={setCc}
            contactOptions={contactOptions}
            multiple
          />

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
              The candidate table is inserted into the body — click any cell (including Rate) to edit it directly.
            </p>
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={!canSend}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending…' : 'Send Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
