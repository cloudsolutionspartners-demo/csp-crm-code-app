import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { TextField, TextAreaField, DateField, SelectField, LookupField } from '@/components/FormField';
import {
  Briefcase, Building2, Sparkles, UserPlus, Users, Mail, Phone, Check, ChevronsUpDown, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  accounts, prospects, contacts as allContacts, onboardingCandidates,
  addOpportunity, nextOpportunityNumber, getAccountById,
} from '@/data/mock-data';
import type {
  Account, Prospect, Contact, OnboardingCandidate,
  Opportunity, OpportunityStatus, OpportunitySource, OpportunityClientLinkType,
  RateUnit, CurrencyCode, ContactRateLine, ContactCvSelection,
} from '@/types/crm';
import { computeMargin } from './AddOpportunityWizard';
import { toast } from 'sonner';

const STATUSES: OpportunityStatus[] = ['New', 'Interview Booked', 'Won', 'Lost'];
const RATE_UNITS: RateUnit[] = ['Hour', 'Day'];
const CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'RON'];

export type RaiseOrigin =
  | { kind: 'account'; record: Account }
  | { kind: 'prospect'; record: Prospect }
  | { kind: 'contact'; record: Contact }
  | { kind: 'candidate'; record: OnboardingCandidate };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origin: RaiseOrigin | null;
  onCreated?: (o: Opportunity) => void;
}

function MultiPicker({
  label, values, onChange, options, placeholder, hint,
}: {
  label: string; values: string[]; onChange: (v: string[]) => void;
  options: { value: string; label: string; sub?: string }[];
  placeholder?: string; hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.filter(o => values.includes(o.value));
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full h-auto min-h-9 justify-between text-sm font-normal py-1.5">
            <div className="flex flex-wrap gap-1 items-center">
              {selected.length === 0 && <span className="text-muted-foreground">{placeholder || `Select ${label.toLowerCase()}…`}</span>}
                {selected.map(s => (
                <Badge key={s.value} variant="secondary" className="gap-1 font-normal">
                  {s.label}
                  <span
                    role="button"
                    aria-label={`Remove ${s.label}`}
                    className="inline-flex items-center justify-center rounded-sm hover:bg-muted-foreground/20 cursor-pointer"
                    onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(s.value); }}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))}
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search…`} />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>
                {options.map(o => (
                  <CommandItem key={o.value} value={`${o.label} ${o.sub || ''}`} onSelect={() => toggle(o.value)}>
                    <Check className={cn('mr-2 h-4 w-4', values.includes(o.value) ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex flex-col">
                      <span className="text-sm">{o.label}</span>
                      {o.sub && <span className="text-xs text-muted-foreground">{o.sub}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="border-b pb-1.5 mb-3">
      <h4 className="text-sm font-semibold">{children}</h4>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function MarginPanel({ oppRate, oppUnit, candRate, candUnit, currency }: {
  oppRate?: number; oppUnit: RateUnit; candRate?: number; candUnit: RateUnit; currency: CurrencyCode;
}) {
  const m = computeMargin(oppRate, oppUnit, candRate, candUnit);
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">Profit margin</span>
      <div className="mt-1 flex items-center gap-4">
        <span><strong className={m.hour != null && m.hour < 0 ? 'text-destructive' : 'text-emerald-600'}>{m.hour != null ? m.hour.toFixed(2) : '—'}</strong> {currency}/hour</span>
        <span><strong className={m.day != null && m.day < 0 ? 'text-destructive' : 'text-emerald-600'}>{m.day != null ? m.day.toFixed(2) : '—'}</strong> {currency}/day</span>
      </div>
    </div>
  );
}

export function RaiseOpportunityForm({ open, onOpenChange, origin, onCreated }: Props) {
  const [role, setRole] = useState('');
  const [oppRate, setOppRate] = useState<string>('');
  const [oppUnit, setOppUnit] = useState<RateUnit>('Day');
  const [currency, setCurrency] = useState<CurrencyCode>('EUR');
  const [candRate, setCandRate] = useState<string>('');
  const [candUnit, setCandUnit] = useState<RateUnit>('Hour');
  const [candidateIds, setCandidateIds] = useState<string[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [contactRates, setContactRates] = useState<ContactRateLine[]>([]);
  const [contactCvSelections, setContactCvSelections] = useState<ContactCvSelection[]>([]);
  const [details, setDetails] = useState('');
  const [startDate, setStartDate] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [status, setStatus] = useState<OpportunityStatus>('New');

  const [clientMode, setClientMode] = useState<'account' | 'prospect' | 'free'>('account');
  const [accountId, setAccountId] = useState('');
  const [prospectId, setProspectId] = useState('');
  const [freeClientName, setFreeClientName] = useState('');

  useEffect(() => {
    if (!open) return;
    setRole('');
    setOppRate('');
    setOppUnit('Day');
    setCurrency('EUR');
    setCandRate('');
    setCandUnit('Hour');
    setCandidateIds([]);
    setContactIds([]);
    setContactRates([]);
    setContactCvSelections([]);
    setDetails('');
    setStartDate('');
    setClosingDate('');
    setStatus('New');
    setClientMode('account');
    setAccountId('');
    setProspectId('');
    setFreeClientName('');

    if (!origin) return;
    if (origin.kind === 'account') {
      setAccountId(origin.record.id);
      setClientMode('account');
    } else if (origin.kind === 'prospect') {
      setProspectId(origin.record.id);
      setClientMode('prospect');
    } else if (origin.kind === 'contact') {
      const c = origin.record;
      setContactIds([c.id]);
      if (c.accountId) {
        setAccountId(c.accountId);
        setClientMode('account');
      } else if (c.company) {
        setFreeClientName(c.company);
        setClientMode('free');
      }
    } else if (origin.kind === 'candidate') {
      const cd = origin.record;
      setCandidateIds([cd.id]);
      setRole(cd.candidateRole || '');
      setCandRate(String(cd.hourlyRateEur));
      setCandUnit('Hour');
    }
  }, [open, origin]);

  useEffect(() => {
    setContactRates(prev => {
      const map = new Map(prev.map(r => [r.contactId, r]));
      return contactIds.map(id => map.get(id) || { contactId: id, rate: undefined, unit: 'Hour' as RateUnit, currency });
    });
    setContactCvSelections(prev => {
      const map = new Map(prev.map(s => [s.contactId, s]));
      return contactIds
        .map(id => {
          if (map.has(id)) return map.get(id)!;
          const c = allContacts.find(x => x.id === id);
          const cvs = c?.cvs || [];
          const def = cvs.find(cv => cv.isPrimary)?.id || cvs[0]?.id;
          return def ? { contactId: id, cvId: def } : null;
        })
        .filter((s): s is ContactCvSelection => s !== null);
    });
  }, [contactIds, currency]);

  const updateContactRate = (id: string, patch: Partial<ContactRateLine>) =>
    setContactRates(prev => prev.map(r => r.contactId === id ? { ...r, ...patch } : r));
  const updateContactCv = (contactId: string, cvId: string) =>
    setContactCvSelections(prev => {
      if (prev.some(s => s.contactId === contactId)) {
        return prev.map(s => s.contactId === contactId ? { ...s, cvId } : s);
      }
      return [...prev, { contactId, cvId }];
    });

  const accountOptions = useMemo(() => accounts.map(a => ({ value: a.id, label: a.name })), []);
  const prospectOptions = useMemo(() => prospects.map(p => ({ value: p.id, label: `${p.prospectNumber} — ${p.companyName}` })), []);
  const candidateOptions = useMemo(() => onboardingCandidates.map(c => ({
    value: c.id, label: `${c.firstName} ${c.lastName}`, sub: `${c.candidateRole || '—'} · €${c.hourlyRateEur}/h`,
  })), []);
  const allContactOptions = useMemo(() => allContacts
    .filter(c => c.contactType === 'Consultant')
    .map(c => ({
      value: c.id, label: `${c.firstName} ${c.lastName}`,
      sub: `Consultant${c.jobRole ? ' · ' + c.jobRole : ''}${c.email ? ' · ' + c.email : ''}`,
    })), []);
  // For account origin, we still surface the same CSP consultant pool — these are *our* people
  // we put forward, not customer-side contacts at the account.
  const accountContactOptions = allContactOptions;

  const resolved = (() => {
    let source: OpportunitySource = 'From New Client';
    let clientLinkType: OpportunityClientLinkType = 'Free Text';
    let resAccountId: string | undefined;
    let resProspectId: string | undefined;
    let resFreeName: string | undefined;
    if (origin?.kind === 'account') {
      source = 'From Existing Client'; clientLinkType = 'Account'; resAccountId = origin.record.id;
    } else if (origin?.kind === 'prospect') {
      source = 'From Prospect'; clientLinkType = 'Prospect'; resProspectId = origin.record.id;
    } else {
      if (clientMode === 'account' && accountId) { source = 'From Existing Client'; clientLinkType = 'Account'; resAccountId = accountId; }
      else if (clientMode === 'prospect' && prospectId) { source = 'From Prospect'; clientLinkType = 'Prospect'; resProspectId = prospectId; }
      else if (clientMode === 'free' && freeClientName.trim()) { source = 'From New Client'; clientLinkType = 'Free Text'; resFreeName = freeClientName.trim(); }
    }
    return { source, clientLinkType, resAccountId, resProspectId, resFreeName };
  })();

  const clientChosen =
    origin?.kind === 'account' || origin?.kind === 'prospect' ||
    (clientMode === 'account' && !!accountId) ||
    (clientMode === 'prospect' && !!prospectId) ||
    (clientMode === 'free' && !!freeClientName.trim());

  const canSubmit = !!origin && !!role.trim() && !!oppRate && clientChosen;

  const handleCreate = () => {
    if (!origin || !canSubmit) return;
    const opp: Opportunity = {
      id: `opp-${Date.now()}`,
      opportunityNumber: nextOpportunityNumber(),
      source: resolved.source,
      clientLinkType: resolved.clientLinkType,
      accountId: resolved.resAccountId,
      prospectId: resolved.resProspectId,
      freeClientName: resolved.resFreeName,
      candidateIds, contactIds,
      role: role.trim(),
      opportunityRate: oppRate ? Number(oppRate) : undefined,
      opportunityRateUnit: oppUnit,
      currencyCode: currency,
      candidateRate: candRate ? Number(candRate) : undefined,
      candidateRateUnit: candUnit,
      contactRates: contactRates.length > 0 ? contactRates : undefined,
      contactCvSelections: contactCvSelections.length > 0 ? contactCvSelections : undefined,
      details: details.trim() || undefined,
      startDate: startDate || undefined,
      closingDate: closingDate || undefined,
      status,
      createdAt: new Date().toISOString().split('T')[0],
    };
    addOpportunity(opp);
    toast.success(`Opportunity ${opp.opportunityNumber} created`);
    onCreated?.(opp);
    onOpenChange(false);
  };

  if (!origin) return null;

  const framing = (() => {
    switch (origin.kind) {
      case 'account': {
        const a = origin.record;
        return {
          icon: Building2,
          title: `New Opportunity — ${a.name}`,
          subtitle: 'Existing client. The opportunity rolls up under this account; no client lookup needed.',
          tag: <Badge variant="secondary" className="gap-1"><Building2 className="h-3 w-3" />Account · {a.name}</Badge>,
        };
      }
      case 'prospect': {
        const p = origin.record;
        return {
          icon: Sparkles,
          title: `New Opportunity — ${p.companyName}`,
          subtitle: `Tied to prospect ${p.prospectNumber}. This opportunity will appear inside the prospect record and contribute to its pipeline value.`,
          tag: <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" />Prospect · {p.prospectNumber}</Badge>,
        };
      }
      case 'contact': {
        const c = origin.record;
        return {
          icon: Users,
          title: `Raise Opportunity with ${c.firstName} ${c.lastName}`,
          subtitle: 'Contact-led opportunity. Confirm which client this is for, then describe the role.',
          tag: <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" />Contact · {c.contactType}</Badge>,
        };
      }
      case 'candidate': {
        const cd = origin.record;
        return {
          icon: UserPlus,
          title: `Place ${cd.firstName} ${cd.lastName}${cd.candidateRole ? ` — ${cd.candidateRole}` : ''}`,
          subtitle: 'Candidate-led opportunity. Choose where you are placing them; rates are pre-filled from the candidate record.',
          tag: <Badge variant="secondary" className="gap-1"><UserPlus className="h-3 w-3" />Candidate · €{cd.hourlyRateEur}/h</Badge>,
        };
      }
    }
  })();
  const Icon = framing.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <span className="truncate">{framing.title}</span>
          </DialogTitle>
          <div className="flex items-center gap-2 pt-1">
            {framing.tag}
            <p className="text-xs text-muted-foreground">{framing.subtitle}</p>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {origin.kind === 'account' && (
            <>
              <section>
                <SectionTitle hint={`Pick people from CSP and the account contact pool. Adding a candidate pre-fills their rate below.`}>
                  Who do we put forward?
                </SectionTitle>
                <div className="grid grid-cols-1 gap-3">
                  <MultiPicker label="Candidates" values={candidateIds} onChange={(v) => {
                    setCandidateIds(v);
                    if (v.length === 1 && !candRate) {
                      const c = onboardingCandidates.find(x => x.id === v[0]);
                      if (c) { setCandRate(String(c.hourlyRateEur)); setCandUnit('Hour'); if (!role) setRole(c.candidateRole || ''); }
                    }
                  }} options={candidateOptions} placeholder="Pick onboarding candidates…" />
                  <MultiPicker label="CSP Consultants" values={contactIds} onChange={setContactIds}
                    options={allContactOptions}
                    hint="These are our consultants (Contacts of type Consultant) — the people we put forward to the client. Not customer-side contacts at the account." />
                </div>
              </section>

              <RoleAndRatesSection
                role={role} setRole={setRole}
                oppRate={oppRate} setOppRate={setOppRate} oppUnit={oppUnit} setOppUnit={setOppUnit}
                currency={currency} setCurrency={setCurrency}
                candRate={candRate} setCandRate={setCandRate} candUnit={candUnit} setCandUnit={setCandUnit}
                contactIds={contactIds} contactRates={contactRates} updateContactRate={updateContactRate} contactCvSelections={contactCvSelections} updateContactCv={updateContactCv}
              />
              <TimelineAndDetailsSection {...{ startDate, setStartDate, closingDate, setClosingDate, status, setStatus, details, setDetails }} />
            </>
          )}

          {origin.kind === 'prospect' && (
            <>
              <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                Linked to <strong>{origin.record.companyName}</strong> ({origin.record.prospectNumber}). Winning this opportunity will count toward the prospect's converted value.
              </div>
              <section>
                <SectionTitle hint="Add the candidate(s) you intend to put forward to this prospect.">
                  Candidate line-up
                </SectionTitle>
                <MultiPicker label="Candidates" values={candidateIds} onChange={(v) => {
                  setCandidateIds(v);
                  if (v.length === 1 && !candRate) {
                    const c = onboardingCandidates.find(x => x.id === v[0]);
                    if (c) { setCandRate(String(c.hourlyRateEur)); setCandUnit('Hour'); if (!role) setRole(c.candidateRole || ''); }
                  }
                }} options={candidateOptions} placeholder="Pick onboarding candidates…" />
                <div className="mt-3">
                  <MultiPicker label="CSP Consultants (optional)" values={contactIds} onChange={setContactIds}
                    options={allContactOptions} placeholder="Add our consultants to put forward…"
                    hint="Our internal consultants (Contacts of type Consultant)." />
                </div>
              </section>

              <RoleAndRatesSection
                role={role} setRole={setRole}
                oppRate={oppRate} setOppRate={setOppRate} oppUnit={oppUnit} setOppUnit={setOppUnit}
                currency={currency} setCurrency={setCurrency}
                candRate={candRate} setCandRate={setCandRate} candUnit={candUnit} setCandUnit={setCandUnit}
                contactIds={contactIds} contactRates={contactRates} updateContactRate={updateContactRate} contactCvSelections={contactCvSelections} updateContactCv={updateContactCv}
              />
              <TimelineAndDetailsSection {...{ startDate, setStartDate, closingDate, setClosingDate, status, setStatus, details, setDetails }} />
            </>
          )}

          {origin.kind === 'contact' && (
            <>
              <ContactCard contact={origin.record} />

              <section>
                <SectionTitle hint="Where is this opportunity going? We pre-selected the most likely option based on the contact's record.">
                  Confirm the client
                </SectionTitle>
                <ClientChooser
                  mode={clientMode} setMode={setClientMode}
                  accountId={accountId} setAccountId={setAccountId}
                  prospectId={prospectId} setProspectId={setProspectId}
                  freeClientName={freeClientName} setFreeClientName={setFreeClientName}
                  accountOptions={accountOptions} prospectOptions={prospectOptions}
                />
              </section>

              <section>
                <SectionTitle hint="Blend onboarding candidates with our CSP consultants. The originating contact is included by default — you can remove them if needed.">
                  Who do we put forward?
                </SectionTitle>
                <div className="grid grid-cols-1 gap-3">
                  <MultiPicker label="Candidates" values={candidateIds} onChange={(v) => {
                    setCandidateIds(v);
                    if (v.length === 1 && !candRate) {
                      const c = onboardingCandidates.find(x => x.id === v[0]);
                      if (c) { setCandRate(String(c.hourlyRateEur)); setCandUnit('Hour'); if (!role) setRole(c.candidateRole || ''); }
                    }
                  }} options={candidateOptions} placeholder="Pick onboarding candidates…" />
                  <MultiPicker label="CSP Consultants" values={contactIds} onChange={setContactIds}
                    options={allContactOptions}
                    hint="Our internal consultants (Contacts of type Consultant). The originating contact is preselected." />
                </div>
              </section>

              <RoleAndRatesSection
                role={role} setRole={setRole}
                oppRate={oppRate} setOppRate={setOppRate} oppUnit={oppUnit} setOppUnit={setOppUnit}
                currency={currency} setCurrency={setCurrency}
                candRate={candRate} setCandRate={setCandRate} candUnit={candUnit} setCandUnit={setCandUnit}
                contactIds={contactIds} contactRates={contactRates} updateContactRate={updateContactRate} contactCvSelections={contactCvSelections} updateContactCv={updateContactCv}
              />
              <TimelineAndDetailsSection {...{ startDate, setStartDate, closingDate, setClosingDate, status, setStatus, details, setDetails }} />
            </>
          )}

          {origin.kind === 'candidate' && (
            <>
              <CandidateCard candidate={origin.record} />

              <section>
                <SectionTitle hint="Pick where you are placing this candidate. The choice drives how the opportunity is filed and forecast.">
                  Where are you placing them?
                </SectionTitle>
                <ClientChooser
                  mode={clientMode} setMode={setClientMode}
                  accountId={accountId} setAccountId={setAccountId}
                  prospectId={prospectId} setProspectId={setProspectId}
                  freeClientName={freeClientName} setFreeClientName={setFreeClientName}
                  accountOptions={accountOptions} prospectOptions={prospectOptions}
                />
              </section>

              <section>
                <SectionTitle hint="Optionally include other CSP consultants you want to put forward alongside this candidate.">Additional CSP Consultants (optional)</SectionTitle>
                <MultiPicker label="CSP Consultants" values={contactIds} onChange={setContactIds} options={allContactOptions} hint="Our consultants only (Contacts of type Consultant)." />
              </section>

              <RoleAndRatesSection
                role={role} setRole={setRole}
                oppRate={oppRate} setOppRate={setOppRate} oppUnit={oppUnit} setOppUnit={setOppUnit}
                currency={currency} setCurrency={setCurrency}
                candRate={candRate} setCandRate={setCandRate} candUnit={candUnit} setCandUnit={setCandUnit}
                contactIds={contactIds} contactRates={contactRates} updateContactRate={updateContactRate} contactCvSelections={contactCvSelections} updateContactCv={updateContactCv}
                candidateRatePrefilled
              />
              <TimelineAndDetailsSection {...{ startDate, setStartDate, closingDate, setClosingDate, status, setStatus, details, setDetails }} />
            </>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2 mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            <Briefcase className="h-4 w-4 mr-2" /> Create Opportunity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleAndRatesSection(props: {
  role: string; setRole: (s: string) => void;
  oppRate: string; setOppRate: (s: string) => void; oppUnit: RateUnit; setOppUnit: (u: RateUnit) => void;
  currency: CurrencyCode; setCurrency: (c: CurrencyCode) => void;
  candRate: string; setCandRate: (s: string) => void; candUnit: RateUnit; setCandUnit: (u: RateUnit) => void;
  contactIds: string[]; contactRates: ContactRateLine[]; updateContactRate: (id: string, patch: Partial<ContactRateLine>) => void;
  contactCvSelections?: ContactCvSelection[]; updateContactCv?: (id: string, cvId: string) => void;
  candidateRatePrefilled?: boolean;
}) {
  const {
    role, setRole, oppRate, setOppRate, oppUnit, setOppUnit, currency, setCurrency,
    candRate, setCandRate, candUnit, setCandUnit, contactIds, contactRates, updateContactRate,
    contactCvSelections = [], updateContactCv,
    candidateRatePrefilled,
  } = props;
  return (
    <section>
      <SectionTitle hint="Confirm the role and the commercial position. Margin is computed automatically.">
        Role &amp; commercials
      </SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Role" value={role} onChange={setRole} required className="col-span-2" placeholder="e.g. Senior .NET Developer" />
        <TextField label="Opportunity Rate" type="number" value={oppRate} onChange={setOppRate} required />
        <SelectField label="Rate Unit" value={oppUnit} onChange={(v) => setOppUnit(v as RateUnit)}
          options={RATE_UNITS.map(u => ({ value: u, label: `Per ${u}` }))} />
        <SelectField label="Currency" value={currency} onChange={(v) => setCurrency(v as CurrencyCode)}
          options={CURRENCIES.map(c => ({ value: c, label: c }))} />
        <div />
        <TextField label={candidateRatePrefilled ? 'Candidate Rate (prefilled)' : 'Candidate Rate'} type="number" value={candRate} onChange={setCandRate} />
        <SelectField label="Candidate Rate Unit" value={candUnit} onChange={(v) => setCandUnit(v as RateUnit)}
          options={RATE_UNITS.map(u => ({ value: u, label: `Per ${u}` }))} />
        <div className="col-span-2">
          <MarginPanel oppRate={Number(oppRate) || undefined} oppUnit={oppUnit} candRate={Number(candRate) || undefined} candUnit={candUnit} currency={currency} />
        </div>
        {contactIds.length > 0 && (
          <div className="col-span-2 rounded-md border p-3 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Contact rates, CVs &amp; per-contact margin</span>
              <span className="text-[11px] text-muted-foreground">Pick the CV that will be sent when applying with each contact.</span>
            </div>
            {contactRates.map(line => {
              const c = allContacts.find(x => x.id === line.contactId);
              const lineCurrency = line.currency || currency;
              const sameCurrency = lineCurrency === currency;
              const m = sameCurrency ? computeMargin(Number(oppRate) || undefined, oppUnit, line.rate, line.unit) : { hour: null, day: null };
              const cvs = c?.cvs || [];
              const currentCvId = contactCvSelections.find(s => s.contactId === line.contactId)?.cvId
                || cvs.find(cv => cv.isPrimary)?.id || cvs[0]?.id || '';
              return (
                <div key={line.contactId} className="space-y-2 border-b last:border-b-0 pb-2 last:pb-0">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3 text-sm pb-2">
                      <div className="font-medium truncate">{c ? `${c.firstName} ${c.lastName}` : line.contactId}</div>
                      {c && <div className="text-xs text-muted-foreground truncate">{c.contactType}</div>}
                    </div>
                    <div className="col-span-2">
                      <TextField label="Rate" type="number" value={line.rate?.toString() || ''}
                        onChange={(v) => updateContactRate(line.contactId, { rate: v ? Number(v) : undefined })} />
                    </div>
                    <div className="col-span-2">
                      <SelectField label="Unit" value={line.unit}
                        onChange={(v) => updateContactRate(line.contactId, { unit: v as RateUnit })}
                        options={RATE_UNITS.map(u => ({ value: u, label: `/${u.toLowerCase()}` }))} />
                    </div>
                    <div className="col-span-2">
                      <SelectField label="Curr." value={lineCurrency}
                        onChange={(v) => updateContactRate(line.contactId, { currency: v as CurrencyCode })}
                        options={CURRENCIES.map(c => ({ value: c, label: c }))} />
                    </div>
                    <div className="col-span-3 text-xs pb-2">
                      <div className="text-muted-foreground uppercase tracking-wider text-[10px]">Margin</div>
                      {m.hour != null ? (
                        <div className="leading-tight">
                          <div className={m.hour < 0 ? 'text-destructive' : 'text-emerald-600'}><strong>{m.hour.toFixed(2)}</strong> {currency}/h</div>
                          <div className={m.day! < 0 ? 'text-destructive' : 'text-emerald-600'}><strong>{m.day!.toFixed(2)}</strong> {currency}/d</div>
                        </div>
                      ) : !sameCurrency && line.rate != null ? (
                        <div className="text-muted-foreground" title={`Cost in ${lineCurrency} · Sell in ${currency}`}>— (FX)</div>
                      ) : <div className="text-muted-foreground">—</div>}
                    </div>
                  </div>
                  {updateContactCv && (
                    cvs.length === 0 ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">No CV on file for this contact — add one on the Contact's record so it can be sent.</p>
                    ) : (
                      <SelectField label="CV to apply with" value={currentCvId}
                        onChange={(v) => updateContactCv(line.contactId, v)}
                        options={cvs.map(cv => ({ value: cv.id, label: `${cv.fileName}${cv.label ? ' — ' + cv.label : ''}${cv.isPrimary ? ' ★' : ''}` }))} />
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function TimelineAndDetailsSection({ startDate, setStartDate, closingDate, setClosingDate, status, setStatus, details, setDetails }: {
  startDate: string; setStartDate: (s: string) => void;
  closingDate: string; setClosingDate: (s: string) => void;
  status: OpportunityStatus; setStatus: (s: OpportunityStatus) => void;
  details: string; setDetails: (s: string) => void;
}) {
  return (
    <section>
      <SectionTitle>Timeline &amp; details</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <DateField label="Start Date" value={startDate} onChange={setStartDate} />
        <DateField label="Closing Date" value={closingDate} onChange={setClosingDate} />
        <SelectField label="Status" value={status} onChange={(v) => setStatus(v as OpportunityStatus)}
          options={STATUSES.map(s => ({ value: s, label: s }))} className="col-span-2" />
        <TextAreaField label="Opportunity Details" value={details} onChange={setDetails} rows={4} className="col-span-2"
          placeholder="What does the client need? Any context that helps the team move this forward." />
      </div>
    </section>
  );
}

function ClientChooser({
  mode, setMode, accountId, setAccountId, prospectId, setProspectId, freeClientName, setFreeClientName,
  accountOptions, prospectOptions,
}: {
  mode: 'account' | 'prospect' | 'free'; setMode: (m: 'account' | 'prospect' | 'free') => void;
  accountId: string; setAccountId: (s: string) => void;
  prospectId: string; setProspectId: (s: string) => void;
  freeClientName: string; setFreeClientName: (s: string) => void;
  accountOptions: { value: string; label: string }[]; prospectOptions: { value: string; label: string }[];
}) {
  const cards: { id: 'account' | 'prospect' | 'free'; icon: any; title: string; blurb: string }[] = [
    { id: 'account', icon: Building2, title: 'Existing Client', blurb: 'Files under an Account. Best for repeat business.' },
    { id: 'prospect', icon: Sparkles, title: 'Prospect', blurb: 'Files under a qualified Prospect. Counts toward pipeline value.' },
    { id: 'free', icon: UserPlus, title: 'New Client (free text)', blurb: 'Plain client name. You can convert later.' },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {cards.map(c => {
          const I = c.icon;
          const active = mode === c.id;
          return (
            <button key={c.id} type="button" onClick={() => setMode(c.id)}
              className={cn('rounded-md border p-2.5 text-left transition', active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50')}>
              <div className="flex items-center gap-1.5 text-sm font-medium"><I className="h-3.5 w-3.5" />{c.title}</div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{c.blurb}</p>
            </button>
          );
        })}
      </div>
      {mode === 'account' && (
        <LookupField label="Account" value={accountId} onChange={setAccountId} options={accountOptions} required placeholder="Pick an account…" />
      )}
      {mode === 'prospect' && (
        <LookupField label="Prospect" value={prospectId} onChange={setProspectId} options={prospectOptions} required placeholder="Pick a prospect…" />
      )}
      {mode === 'free' && (
        <TextField label="Client Name" value={freeClientName} onChange={setFreeClientName} required placeholder="e.g. Acme Health (new)" />
      )}
    </div>
  );
}

function ContactCard({ contact }: { contact: Contact }) {
  const account = contact.accountId ? getAccountById(contact.accountId) : undefined;
  return (
    <div className="rounded-md border p-3 bg-muted/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-sm">{contact.firstName} {contact.lastName}</div>
          <div className="text-xs text-muted-foreground">{contact.contactType}{account ? ` · ${account.name}` : contact.company ? ` · ${contact.company}` : ''}</div>
        </div>
        <div className="text-xs text-right text-muted-foreground space-y-0.5">
          {contact.email && <div className="flex items-center gap-1 justify-end"><Mail className="h-3 w-3" />{contact.email}</div>}
          {contact.phone && <div className="flex items-center gap-1 justify-end"><Phone className="h-3 w-3" />{contact.phone}</div>}
        </div>
      </div>
    </div>
  );
}

function CandidateCard({ candidate }: { candidate: OnboardingCandidate }) {
  return (
    <div className="rounded-md border p-3 bg-muted/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-sm">{candidate.firstName} {candidate.lastName}</div>
          <div className="text-xs text-muted-foreground">{candidate.candidateRole || '—'}</div>
        </div>
        <div className="text-xs text-right">
          <div>€{candidate.hourlyRateEur}/h cost</div>
          <div className="text-muted-foreground">{candidate.path}</div>
        </div>
      </div>
    </div>
  );
}
