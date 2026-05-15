import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TextField, TextAreaField, DateField, SelectField, LookupField } from '@/components/FormField';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Sparkles, Building2, UserPlus, Briefcase, ArrowLeft, ArrowRight, X, CircleDot, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { accounts, prospects, contacts, onboardingCandidates, addOpportunity, nextOpportunityNumber, getAccountById, getContactById } from '@/data/mock-data';
import type { Opportunity, OpportunitySource, OpportunityStatus, RateUnit, CurrencyCode, ContactRateLine } from '@/types/crm';
import { toast } from 'sonner';

type WizardSeed = Partial<Opportunity> & { startStep?: number };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seed?: WizardSeed;
  onCreated?: (o: Opportunity) => void;
}

const STATUSES: OpportunityStatus[] = ['New', 'Interview Booked', 'Won', 'Lost'];
const RATE_UNITS: RateUnit[] = ['Hour', 'Day'];
const CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'RON'];

const SOURCE_INFO: Record<OpportunitySource, { icon: any; title: string; blurb: string }> = {
  'From Prospect': {
    icon: Sparkles,
    title: 'From Prospect',
    blurb: 'The client is already qualified in your pipeline. The opportunity links to a Prospect — useful for forecasting and tracking against the prospect record.',
  },
  'From Existing Client': {
    icon: Building2,
    title: 'From Existing Client',
    blurb: 'The client is already an Account. The opportunity links to that Account so all activity stays under one roof.',
  },
  'From New Client': {
    icon: UserPlus,
    title: 'From New Client',
    blurb: 'The client is brand-new and not yet in the system. We keep their name as free text for now — you can convert to a Prospect/Account later.',
  },
  'From Existing Consultant': {
    icon: Users,
    title: 'From Existing Consultant',
    blurb: 'The opportunity was referred by one of our existing consultants. Link it to that Contact so we can attribute the lead.',
  },
};

function MultiPicker({
  label, values, onChange, options, placeholder,
}: { label: string; values: string[]; onChange: (v: string[]) => void; options: { value: string; label: string; sub?: string }[]; placeholder?: string }) {
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
            <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
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
    </div>
  );
}

function StepHeader({ step, totalSteps, title, subtitle }: { step: number; totalSteps: number; title: string; subtitle?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={cn('h-1.5 flex-1 rounded-full', i < step ? 'bg-primary' : i === step ? 'bg-primary/60' : 'bg-muted')} />
        ))}
      </div>
      <div>
        <h3 className="text-base font-semibold">Step {step + 1} of {totalSteps} — {title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function rateToHour(v: number | undefined, unit: RateUnit): number | undefined {
  if (v == null || isNaN(v)) return undefined;
  return unit === 'Hour' ? v : v / 8;
}
function rateToDay(v: number | undefined, unit: RateUnit): number | undefined {
  if (v == null || isNaN(v)) return undefined;
  return unit === 'Day' ? v : v * 8;
}
export function computeMargin(oppRate?: number, oppUnit: RateUnit = 'Hour', candRate?: number, candUnit: RateUnit = 'Hour') {
  const oH = rateToHour(oppRate, oppUnit), cH = rateToHour(candRate, candUnit);
  if (oH == null || cH == null) return { hour: null as number | null, day: null as number | null };
  return { hour: oH - cH, day: (oH - cH) * 8 };
}

const TOTAL_STEPS = 6;

export function AddOpportunityWizard({ open, onOpenChange, seed, onCreated }: Props) {
  const [step, setStep] = useState(seed?.startStep ?? 0);
  const [source, setSource] = useState<OpportunitySource | undefined>(seed?.source);
  const [accountId, setAccountId] = useState<string>(seed?.accountId || '');
  const [prospectId, setProspectId] = useState<string>(seed?.prospectId || '');
  const [freeClientName, setFreeClientName] = useState<string>(seed?.freeClientName || '');
  const [sourceContactId, setSourceContactId] = useState<string>(seed?.sourceContactId || '');
  const [candidateIds, setCandidateIds] = useState<string[]>(seed?.candidateIds || []);
  const [contactIds, setContactIds] = useState<string[]>(seed?.contactIds || []);
  const [role, setRole] = useState<string>(seed?.role || '');
  const [oppRate, setOppRate] = useState<string>(seed?.opportunityRate?.toString() || '');
  const [oppUnit, setOppUnit] = useState<RateUnit>(seed?.opportunityRateUnit || 'Day');
  const [currency, setCurrency] = useState<CurrencyCode>(seed?.currencyCode || 'EUR');
  const [candRate, setCandRate] = useState<string>(seed?.candidateRate?.toString() || '');
  const [candUnit, setCandUnit] = useState<RateUnit>(seed?.candidateRateUnit || 'Hour');
  const [details, setDetails] = useState<string>(seed?.details || '');
  const [startDate, setStartDate] = useState<string>(seed?.startDate || '');
  const [closingDate, setClosingDate] = useState<string>(seed?.closingDate || '');
  const [status, setStatus] = useState<OpportunityStatus>(seed?.status || 'New');
  const [contactRates, setContactRates] = useState<ContactRateLine[]>(seed?.contactRates || []);

  // re-seed when reopened with new seed
  useEffect(() => {
    if (open) {
      setStep(seed?.startStep ?? 0);
      setSource(seed?.source);
      setAccountId(seed?.accountId || '');
      setProspectId(seed?.prospectId || '');
      setFreeClientName(seed?.freeClientName || '');
      setSourceContactId(seed?.sourceContactId || '');
      setCandidateIds(seed?.candidateIds || []);
      setContactIds(seed?.contactIds || []);
      setRole(seed?.role || '');
      setOppRate(seed?.opportunityRate?.toString() || '');
      setOppUnit(seed?.opportunityRateUnit || 'Day');
      setCurrency(seed?.currencyCode || 'EUR');
      setCandRate(seed?.candidateRate?.toString() || '');
      setCandUnit(seed?.candidateRateUnit || 'Hour');
      setDetails(seed?.details || '');
      setStartDate(seed?.startDate || '');
      setClosingDate(seed?.closingDate || '');
      setStatus(seed?.status || 'New');
      setContactRates(seed?.contactRates || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-sync candidate rate when single candidate chosen
  useEffect(() => {
    if (candidateIds.length === 1 && !candRate) {
      const c = onboardingCandidates.find(x => x.id === candidateIds[0]);
      if (c) {
        setCandRate(String(c.hourlyRateEur));
        setCandUnit('Hour');
        if (!role) setRole(c.candidateRole || '');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateIds]);

  // Keep contactRates rows in sync with selected contactIds (preserve any entered values)
  useEffect(() => {
    setContactRates(prev => {
      const map = new Map(prev.map(r => [r.contactId, r]));
      return contactIds.map(id => map.get(id) || { contactId: id, rate: undefined, unit: 'Hour' as RateUnit, currency });
    });
  }, [contactIds, currency]);

  const updateContactRate = (id: string, patch: Partial<ContactRateLine>) =>
    setContactRates(prev => prev.map(r => r.contactId === id ? { ...r, ...patch } : r));

  const accountOptions = useMemo(() => accounts.map(a => ({ value: a.id, label: a.name })), []);
  const prospectOptions = useMemo(() => prospects.map(p => ({ value: p.id, label: `${p.prospectNumber} — ${p.companyName}` })), []);
  const candidateOptions = useMemo(() => onboardingCandidates.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}`, sub: `${c.candidateRole || '—'} · €${c.hourlyRateEur}/h` })), []);
  const contactOptions = useMemo(() => contacts
    .filter(c => c.contactType === 'Consultant')
    .map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}`, sub: `Consultant${c.jobRole ? ' · ' + c.jobRole : ''}${c.email ? ' · ' + c.email : ''}` })), []);

  const margin = computeMargin(Number(oppRate) || undefined, oppUnit, Number(candRate) || undefined, candUnit);

  const canNext = (() => {
    switch (step) {
      case 0: return !!source;
      case 1:
        if (source === 'From Prospect') return !!prospectId;
        if (source === 'From Existing Client') return !!accountId;
        if (source === 'From New Client') return !!freeClientName.trim();
        if (source === 'From Existing Consultant') return !!sourceContactId;
        return false;
      case 2: return candidateIds.length + contactIds.length > 0;
      case 3: return !!role.trim() && !!oppRate;
      case 4: return true;
      default: return true;
    }
  })();

  const next = () => setStep(s => Math.min(TOTAL_STEPS - 1, s + 1));
  const back = () => setStep(s => Math.max(0, s - 1));

  const handleCreate = () => {
    if (!source) return;
    const opp: Opportunity = {
      id: `opp-${Date.now()}`,
      opportunityNumber: nextOpportunityNumber(),
      source,
      clientLinkType: source === 'From Prospect' ? 'Prospect' : source === 'From Existing Client' ? 'Account' : source === 'From Existing Consultant' ? 'Contact' : 'Free Text',
      accountId: source === 'From Existing Client' ? accountId : undefined,
      prospectId: source === 'From Prospect' ? prospectId : undefined,
      freeClientName: source === 'From New Client' ? freeClientName.trim() : undefined,
      sourceContactId: source === 'From Existing Consultant' ? sourceContactId : undefined,
      candidateIds, contactIds, role: role.trim(),
      opportunityRate: oppRate ? Number(oppRate) : undefined,
      opportunityRateUnit: oppUnit,
      currencyCode: currency,
      candidateRate: candRate ? Number(candRate) : undefined,
      candidateRateUnit: candUnit,
      contactRates: contactRates.length > 0 ? contactRates : undefined,
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

  const clientLabel = source === 'From Prospect'
    ? prospects.find(p => p.id === prospectId)?.companyName || '—'
    : source === 'From Existing Client'
      ? getAccountById(accountId)?.name || '—'
      : source === 'From Existing Consultant'
        ? (() => { const c = getContactById(sourceContactId); return c ? `${c.firstName} ${c.lastName}` : '—'; })()
        : freeClientName || '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Add New Opportunity
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <StepHeader
            step={step}
            totalSteps={TOTAL_STEPS}
            title={['Source', 'Client', 'People', 'Role & Rates', 'Dates & Details', 'Review'][step]}
            subtitle={[
              'Where does this opportunity come from? This drives how it links to the rest of your data.',
              'Pick or describe the client this opportunity is for.',
              'Who from CSP will be put forward? Add candidates, contacts, or both.',
              'Confirm the role and the commercial position. Margin is computed automatically.',
              'When do you expect this to start and close? Add any extra context.',
              'Review everything before creating the opportunity.',
            ][step]}
          />

          {step === 0 && (
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(SOURCE_INFO) as OpportunitySource[]).map(s => {
                const info = SOURCE_INFO[s];
                const Icon = info.icon;
                const active = source === s;
                return (
                  <button key={s} type="button" onClick={() => setSource(s)}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-4 text-left transition',
                      active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50',
                    )}>
                    <div className={cn('rounded-md p-2', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{info.title}</span>
                        {active && <CircleDot className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{info.blurb}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 1 && source === 'From Prospect' && (
            <div className="space-y-2">
              <LookupField label="Prospect" value={prospectId} onChange={setProspectId} options={prospectOptions} required
                placeholder="Pick a prospect…" />
              <p className="text-xs text-muted-foreground">The opportunity will appear inside this prospect's record and contribute to its forecast.</p>
            </div>
          )}
          {step === 1 && source === 'From Existing Client' && (
            <div className="space-y-2">
              <LookupField label="Account" value={accountId} onChange={setAccountId} options={accountOptions} required
                placeholder="Pick an account…" />
              <p className="text-xs text-muted-foreground">All opportunity activity rolls up under this account.</p>
            </div>
          )}
          {step === 1 && source === 'From New Client' && (
            <div className="space-y-2">
              <TextField label="Client Name" value={freeClientName} onChange={setFreeClientName} required placeholder="e.g. Acme Health (new)" />
              <p className="text-xs text-muted-foreground">We'll keep this as plain text for now. You can convert this client into a Prospect or Account later from the Opportunity record.</p>
            </div>
          )}
          {step === 1 && source === 'From Existing Consultant' && (
            <div className="space-y-2">
              <LookupField label="Contact" value={sourceContactId} onChange={setSourceContactId}
                options={contacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}${c.jobRole ? ' — ' + c.jobRole : ''}` }))}
                required placeholder="Pick the consultant who referred this opportunity…" />
              <p className="text-xs text-muted-foreground">The lead came through one of our existing consultants. We'll attribute the opportunity to them.</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <MultiPicker label="Candidates" values={candidateIds} onChange={setCandidateIds} options={candidateOptions} placeholder="Pick onboarding candidates…" />
              <MultiPicker label="CSP Consultants" values={contactIds} onChange={setContactIds} options={contactOptions} placeholder="Pick our consultants to put forward…" />
              <p className="text-xs text-muted-foreground">You can add either or both. If you add exactly one candidate, their hourly rate will pre-fill the candidate rate on the next step.</p>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Role" value={role} onChange={setRole} required className="col-span-2" placeholder="e.g. Senior .NET Developer" />
              <TextField label="Opportunity Rate" type="number" value={oppRate} onChange={setOppRate} required />
              <SelectField label="Rate Unit" value={oppUnit} onChange={(v) => setOppUnit(v as RateUnit)}
                options={RATE_UNITS.map(u => ({ value: u, label: `Per ${u}` }))} />
              <SelectField label="Currency" value={currency} onChange={(v) => setCurrency(v as CurrencyCode)}
                options={CURRENCIES.map(c => ({ value: c, label: c }))} />
              <div />
              <TextField label="Candidate Rate" type="number" value={candRate} onChange={setCandRate} />
              <SelectField label="Candidate Rate Unit" value={candUnit} onChange={(v) => setCandUnit(v as RateUnit)}
                options={RATE_UNITS.map(u => ({ value: u, label: `Per ${u}` }))} />
              <div className="col-span-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Profit margin</span>
                <div className="mt-1 flex items-center gap-4">
                  <span><strong className={margin.hour != null && margin.hour < 0 ? 'text-destructive' : 'text-emerald-600'}>{margin.hour != null ? margin.hour.toFixed(2) : '—'}</strong> {currency}/hour</span>
                  <span><strong className={margin.day != null && margin.day < 0 ? 'text-destructive' : 'text-emerald-600'}>{margin.day != null ? margin.day.toFixed(2) : '—'}</strong> {currency}/day</span>
                </div>
              </div>

              {contactRates.length > 0 && (
                <div className="col-span-2 space-y-2 rounded-md border p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">Contact rates &amp; per-contact margin</span>
                    <span className="text-[11px] text-muted-foreground">Cost rate you pay each contact — margin is computed against the opportunity rate.</span>
                  </div>
                  {contactRates.map(line => {
                    const c = contacts.find(x => x.id === line.contactId);
                    const lineCurrency = line.currency || currency;
                    const sameCurrency = lineCurrency === currency;
                    const m = sameCurrency ? computeMargin(Number(oppRate) || undefined, oppUnit, line.rate, line.unit) : { hour: null, day: null };
                    return (
                      <div key={line.contactId} className="grid grid-cols-12 gap-2 items-end">
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
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="grid grid-cols-2 gap-4">
              <DateField label="Start Date" value={startDate} onChange={setStartDate} />
              <DateField label="Closing Date" value={closingDate} onChange={setClosingDate} />
              <SelectField label="Status" value={status} onChange={(v) => setStatus(v as OpportunityStatus)}
                options={STATUSES.map(s => ({ value: s, label: s }))} className="col-span-2" />
              <TextAreaField label="Opportunity Details" value={details} onChange={setDetails} rows={5} className="col-span-2"
                placeholder="What does the client need? Any context that helps the team move this forward." />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border p-3 grid grid-cols-2 gap-y-2 gap-x-4">
                <div className="text-muted-foreground text-xs uppercase">Source</div><div>{source}</div>
                <div className="text-muted-foreground text-xs uppercase">Client</div><div>{clientLabel}</div>
                <div className="text-muted-foreground text-xs uppercase">Role</div><div>{role || '—'}</div>
                <div className="text-muted-foreground text-xs uppercase">Status</div><div>{status}</div>
                <div className="text-muted-foreground text-xs uppercase">Opportunity Rate</div><div>{oppRate ? `${oppRate} ${currency}/${oppUnit.toLowerCase()}` : '—'}</div>
                <div className="text-muted-foreground text-xs uppercase">Candidate Rate</div><div>{candRate ? `${candRate} ${currency}/${candUnit.toLowerCase()}` : '—'}</div>
                <div className="text-muted-foreground text-xs uppercase">Margin</div><div>{margin.hour != null ? `${margin.hour.toFixed(2)} ${currency}/h · ${margin.day!.toFixed(2)} ${currency}/d` : '—'}</div>
                <div className="text-muted-foreground text-xs uppercase">Start → Close</div><div>{startDate || '—'} → {closingDate || '—'}</div>
                <div className="text-muted-foreground text-xs uppercase">Candidates</div>
                <div className="flex flex-wrap gap-1">{candidateIds.length === 0 ? '—' : candidateIds.map(id => {
                  const c = onboardingCandidates.find(x => x.id === id); return c ? <Badge key={id} variant="secondary">{c.firstName} {c.lastName}</Badge> : null;
                })}</div>
                <div className="text-muted-foreground text-xs uppercase">Contacts</div>
                <div className="flex flex-wrap gap-1">{contactIds.length === 0 ? '—' : contactIds.map(id => {
                  const c = getContactById(id); return c ? <Badge key={id} variant="secondary">{c.firstName} {c.lastName}</Badge> : null;
                })}</div>
              </div>
              {contactRates.some(r => r.rate != null) && (
                <div className="rounded-lg border p-3">
                  <div className="text-xs uppercase text-muted-foreground mb-2">Contact rates &amp; margin</div>
                  <div className="space-y-1">
                    {contactRates.map(line => {
                      const c = contacts.find(x => x.id === line.contactId);
                      const m = computeMargin(Number(oppRate) || undefined, oppUnit, line.rate, line.unit);
                      return (
                        <div key={line.contactId} className="flex items-center justify-between text-sm">
                          <span className="truncate">{c ? `${c.firstName} ${c.lastName}` : line.contactId}</span>
                          <span className="text-xs text-muted-foreground">
                            {line.rate != null ? `${line.rate} ${line.currency || currency}/${line.unit.toLowerCase()}` : '—'}
                            {m.hour != null && <span className={`ml-2 ${m.hour < 0 ? 'text-destructive' : 'text-emerald-600'}`}>· {m.hour.toFixed(2)}/h · {m.day!.toFixed(2)}/d</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {details && <div className="rounded-lg border p-3"><div className="text-xs uppercase text-muted-foreground mb-1">Details</div>{details}</div>}
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={back} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {step < TOTAL_STEPS - 1 ? (
              <Button onClick={next} disabled={!canNext}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleCreate}>Create Opportunity</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
