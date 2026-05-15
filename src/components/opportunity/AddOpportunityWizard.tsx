import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Sparkles, UserPlus, Users, X, Check, ChevronLeft, ChevronRight } from '../Icons';
import { saveOpportunity } from '../../services/opportunityService';
import { saveOpportunityApplicant } from '../../services/opportunityApplicantService';
import { resolveUomId, resolveCurrencyId } from '../../lib/dataverseHelpers';
import { Picker } from './Picker';
import type {
  Opportunity, OpportunityApplicant, OpportunitySource, OpportunityStatus, RateUnit,
  ContactRateLine, CandidateRateLine,
} from '../../types/crm';

// ── Reference-data shapes the parent passes in ─────────────────────────
type AccountOpt = { id: string; name: string };
type ProspectOpt = { id: string; prospectNumber?: string; companyName: string };
type ContactOpt = { id: string; firstName: string; lastName: string; contactType?: string; jobRole?: string; email?: string };
type CandidateOpt = { id: string; firstName: string; lastName: string; candidateRole?: string; hourlyRateEur?: number; cvFileName?: string };
type UomOpt = { id: string; name: string };
type CurrencyOpt = { id: string; code: string };

type WizardSeed = Partial<Opportunity> & {
  startStep?: number;
  candidateIds?: string[];
  contactIds?: string[];
  contactRates?: ContactRateLine[];
  candidateRates?: CandidateRateLine[];
};

export interface AddOpportunityWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (opp: Opportunity, applicants: OpportunityApplicant[]) => void;
  seed?: WizardSeed;
  accounts: AccountOpt[];
  prospects: ProspectOpt[];
  contacts: ContactOpt[];
  candidates: CandidateOpt[];
  uoms: UomOpt[];
  currencies: CurrencyOpt[];
}

// ── computeMargin helper (exported for reuse) ──────────────────────────
function rateToHour(v: number | undefined, unit: RateUnit): number | undefined {
  if (v == null || !isFinite(v)) return undefined;
  return unit === 'Hour' ? v : v / 8;
}

export function computeMargin(
  opportunityRate: number | undefined,
  opportunityRateUnit: RateUnit,
  applicantRate: number | undefined,
  applicantRateUnit: RateUnit,
): { hourlyMargin: number; dailyMargin: number; marginPercent: number } {
  const oH = rateToHour(opportunityRate, opportunityRateUnit);
  const cH = rateToHour(applicantRate, applicantRateUnit);
  if (oH == null || cH == null) {
    return { hourlyMargin: 0, dailyMargin: 0, marginPercent: 0 };
  }
  const hourly = oH - cH;
  return {
    hourlyMargin: hourly,
    dailyMargin: hourly * 8,
    marginPercent: oH > 0 ? (hourly / oH) * 100 : 0,
  };
}

const TOTAL_STEPS = 6;
const STATUSES: OpportunityStatus[] = ['New', 'Interview Booked', 'Won', 'Lost'];
const RATE_UNITS: RateUnit[] = ['Hour', 'Day'];

const SOURCE_INFO: Record<OpportunitySource, { icon: React.ComponentType<any>; title: string; blurb: string }> = {
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

// ── Inline styles ──────────────────────────────────────────────────────
const backdropStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 24,
  width: 720, maxWidth: '92vw', maxHeight: '90vh', overflow: 'auto',
  boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
  display: 'flex', flexDirection: 'column', gap: 16,
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
  color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 10px', fontSize: 14,
  border: '1px solid hsl(var(--border))', borderRadius: 6, background: 'white',
  boxSizing: 'border-box',
};
const textareaStyle: React.CSSProperties = {
  width: '100%', padding: 10, fontSize: 14,
  border: '1px solid hsl(var(--border))', borderRadius: 6, background: 'white',
  boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
};

// ── Simple searchable single-select ────────────────────────────────────
function SearchableSelect({
  value, onChange, options, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; sub?: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find(o => o.value === value);
  const filtered = useMemo(() => {
    if (!q) return options;
    const s = q.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(s) || (o.sub || '').toLowerCase().includes(s));
  }, [q, options]);
  // Close on outside-click + Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          ...inputStyle, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          textAlign: 'left', cursor: 'pointer',
        }}
      >
        <span style={{ color: selected ? 'inherit' : 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : (placeholder || 'Pick one…')}
        </span>
        <span style={{ marginLeft: 8, color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
          background: 'white', border: '1px solid hsl(var(--border))', borderRadius: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 280, overflowY: 'auto',
        }}>
          <input
            type="text" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search…" autoFocus
            style={{ ...inputStyle, borderRadius: 0, border: 'none', borderBottom: '1px solid hsl(var(--border))' }}
          />
          {filtered.length === 0 && (
            <div style={{ padding: 12, fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>No results.</div>
          )}
          {filtered.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 13, borderBottom: '1px solid hsl(var(--border))',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--muted) / 0.3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                {value === o.value && <Check className="csp-icon-sm" />}
                {o.label}
              </div>
              {o.sub && <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginLeft: value === o.value ? 22 : 0 }}>{o.sub}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Simple multi-select with chips ─────────────────────────────────────
function MultiPicker({
  values, onChange, options, placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string; sub?: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selected = options.filter(o => values.includes(o.value));
  const filtered = useMemo(() => {
    if (!q) return options;
    const s = q.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(s) || (o.sub || '').toLowerCase().includes(s));
  }, [q, options]);
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          ...inputStyle, minHeight: 36, height: 'auto', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer', padding: '4px 10px',
          flexWrap: 'wrap', gap: 4,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
          {selected.length === 0 && (
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>{placeholder || 'Pick…'}</span>
          )}
          {selected.map(s => (
            <span
              key={s.value}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'hsl(var(--muted) / 0.4)', padding: '2px 8px',
                borderRadius: 9999, fontSize: 12, fontWeight: 500,
              }}
            >
              {s.label}
              <span
                onClick={e => { e.stopPropagation(); toggle(s.value); }}
                style={{ cursor: 'pointer', color: 'hsl(var(--muted-foreground))', display: 'inline-flex' }}
                aria-label={`Remove ${s.label}`}
              ><X className="csp-icon-sm" /></span>
            </span>
          ))}
        </div>
        <span style={{ marginLeft: 8, color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
          background: 'white', border: '1px solid hsl(var(--border))', borderRadius: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 280, overflowY: 'auto',
        }}>
          <input
            type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" autoFocus
            style={{ ...inputStyle, borderRadius: 0, border: 'none', borderBottom: '1px solid hsl(var(--border))' }}
          />
          {filtered.length === 0 && (
            <div style={{ padding: 12, fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>No results.</div>
          )}
          {filtered.map(o => {
            const checked = values.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { toggle(o.value); setOpen(false); setQ(''); }}
                style={{
                  display: 'flex', width: '100%', textAlign: 'left', alignItems: 'flex-start', gap: 8,
                  padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: 13, borderBottom: '1px solid hsl(var(--border))',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--muted) / 0.3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center', marginTop: 2 }}>
                  {checked && <Check className="csp-icon-sm" />}
                </span>
                <span style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{o.label}</div>
                  {o.sub && <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}>{o.sub}</div>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Picker is now imported from './Picker' (shared between wizard + slide-over).

// ── Step indicator bar ─────────────────────────────────────────────────
function StepBar({ step, total, title, subtitle }: { step: number; total: number; title: string; subtitle?: string }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1, height: 4, borderRadius: 9999,
              background: i < step ? 'hsl(var(--primary))' : i === step ? 'hsl(var(--primary) / 0.6)' : 'hsl(var(--muted))',
            }}
          />
        ))}
      </div>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Step {step + 1} of {total} — {title}</h3>
      {subtitle && <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 4, marginBottom: 0 }}>{subtitle}</p>}
    </div>
  );
}

// ── Main wizard ────────────────────────────────────────────────────────
export function AddOpportunityWizard({
  open, onClose, onCreated, seed,
  accounts, prospects, contacts, candidates, uoms, currencies,
}: AddOpportunityWizardProps) {
  const [step, setStep] = useState(seed?.startStep ?? 0);
  const [source, setSource] = useState<OpportunitySource | undefined>(seed?.source);
  const [accountId, setAccountId] = useState(seed?.accountId || '');
  const [prospectId, setProspectId] = useState(seed?.prospectId || '');
  const [freeClientName, setFreeClientName] = useState(seed?.freeClientName || '');
  const [sourceContactId, setSourceContactId] = useState(seed?.sourceContactId || '');
  const [candidateIds, setCandidateIds] = useState<string[]>(seed?.candidateIds || []);
  const [contactIds, setContactIds] = useState<string[]>(seed?.contactIds || []);
  const [role, setRole] = useState(seed?.role || '');
  const [oppRate, setOppRate] = useState(seed?.opportunityRate?.toString() || '');
  const [oppUnit, setOppUnit] = useState<RateUnit>((seed?.opportunityRateUnit as RateUnit) || 'Day');
  // Bound the seeded currency to an ISO-code shape. If `seed.opportunityCurrency`
  // is a localised display name (e.g. "leu românesc" in a Romanian environment),
  // it would otherwise poison the per-applicant default currency in Step 4.
  const [currency, setCurrency] = useState(() => {
    const c = seed?.opportunityCurrency?.trim();
    return c && /^[A-Z]{3}$/.test(c) ? c : 'EUR';
  });
  const [details, setDetails] = useState(seed?.details || '');
  const [startDate, setStartDate] = useState(seed?.startDate || '');
  const [closingDate, setClosingDate] = useState(seed?.closingDate || '');
  const [status, setStatus] = useState<OpportunityStatus>(seed?.status || 'New');
  const [contactRates, setContactRates] = useState<ContactRateLine[]>(seed?.contactRates || []);
  const [candidateRates, setCandidateRates] = useState<CandidateRateLine[]>(seed?.candidateRates || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Re-seed when reopened
  useEffect(() => {
    if (!open) return;
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
    setOppUnit((seed?.opportunityRateUnit as RateUnit) || 'Day');
    setCurrency(() => {
      const c = seed?.opportunityCurrency?.trim();
      return c && /^[A-Z]{3}$/.test(c) ? c : 'EUR';
    });
    setDetails(seed?.details || '');
    setStartDate(seed?.startDate || '');
    setClosingDate(seed?.closingDate || '');
    setStatus(seed?.status || 'New');
    setContactRates(seed?.contactRates || []);
    setCandidateRates(seed?.candidateRates || []);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep contactRates in sync with selected contactIds (preserve entered values)
  useEffect(() => {
    setContactRates(prev => {
      const map = new Map(prev.map(r => [r.contactId, r]));
      return contactIds.map(id => map.get(id) || { contactId: id, rate: undefined, unit: 'Hour' as RateUnit, currency: currency as any });
    });
  }, [contactIds, currency]);

  // Keep candidateRates in sync with selected candidateIds (preserve + default from candidate)
  useEffect(() => {
    setCandidateRates(prev => {
      const map = new Map(prev.map(r => [r.candidateId, r]));
      return candidateIds.map(id => {
        const existing = map.get(id);
        if (existing) return existing;
        const c = candidates.find(x => x.id === id);
        return {
          candidateId: id,
          rate: c?.hourlyRateEur,
          unit: 'Hour' as RateUnit,
          currency: currency as any,
        };
      });
    });
    // Role auto-fill removed: previously read candidate.candidateRole and could
    // surface short / placeholder values (e.g. "tete") that look like the first
    // name. User now always types the role explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateIds, currency]);

  const updateContactRate = (id: string, patch: Partial<ContactRateLine>) =>
    setContactRates(prev => prev.map(r => r.contactId === id ? { ...r, ...patch } : r));
  const updateCandidateRate = (id: string, patch: Partial<CandidateRateLine>) =>
    setCandidateRates(prev => prev.map(r => r.candidateId === id ? { ...r, ...patch } : r));

  // ── Options for pickers ──────────────────────────────────────────────
  const accountOptions = useMemo(() => accounts.map(a => ({ value: a.id, label: a.name })), [accounts]);
  const prospectOptions = useMemo(() => prospects.map(p => ({ value: p.id, label: p.prospectNumber ? `${p.prospectNumber} — ${p.companyName}` : p.companyName })), [prospects]);
  const allContactOptions = useMemo(() => contacts.map(c => ({
    value: c.id,
    label: `${c.firstName} ${c.lastName}${c.jobRole ? ' — ' + c.jobRole : ''}`,
  })), [contacts]);
  const consultantOptions = useMemo(() => contacts
    .filter(c => c.contactType === 'Consultant')
    .map(c => ({
      value: c.id,
      label: `${c.firstName} ${c.lastName}`,
      sub: `Consultant${c.jobRole ? ' · ' + c.jobRole : ''}${c.email ? ' · ' + c.email : ''}`,
    })), [contacts]);
  const candidateOptions = useMemo(() => candidates.map(c => ({
    value: c.id,
    label: `${c.firstName} ${c.lastName}`,
    sub: `${c.candidateRole || '—'} · €${c.hourlyRateEur ?? 0}/h`,
  })), [candidates]);

  // Close modal on Escape (backdrop click intentionally does NOT close —
  // protects half-filled wizard state from accidental dismissal).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Filter uoms to the supported Rate Units only — avoids stray seed rows
  // (e.g. "tere", "tete") polluting the Per/<X> dropdowns.
  const validUoms = useMemo(
    () => uoms.filter(u => RATE_UNITS.includes(u.name as RateUnit)),
    [uoms],
  );

  // ── Margin for opportunity-level vs single-candidate baseline ────────
  const baselineRate = candidateRates[0]?.rate ?? contactRates[0]?.rate;
  const baselineUnit: RateUnit = (candidateRates[0]?.unit ?? contactRates[0]?.unit ?? 'Hour') as RateUnit;
  const margin = computeMargin(
    oppRate ? Number(oppRate) : undefined, oppUnit,
    baselineRate, baselineUnit,
  );
  const hasMargin = oppRate && baselineRate != null;

  // ── Step gating ──────────────────────────────────────────────────────
  // Inline validation: closing date must be on/after start date
  const dateError = (() => {
    if (!startDate || !closingDate) return null;
    if (new Date(closingDate) < new Date(startDate)) {
      return 'Closing date must be on or after start date';
    }
    return null;
  })();

  const canNext = (() => {
    switch (step) {
      case 0: return !!source;
      case 1:
        if (source === 'From Prospect') return !!prospectId;
        if (source === 'From Existing Client') return !!accountId;
        if (source === 'From New Client') return !!freeClientName.trim();
        if (source === 'From Existing Consultant') return !!sourceContactId;
        return false;
      case 2: return true; // applicants optional (with warning)
      case 3: return !!role.trim() && !!oppRate;
      case 4: return !dateError;
      default: return true;
    }
  })();

  const next = () => setStep(s => Math.min(TOTAL_STEPS - 1, s + 1));
  const back = () => setStep(s => Math.max(0, s - 1));

  // ── Save flow ────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!source) { setError('Source is required'); return; }
    setSaving(true);
    setError('');
    try {
      // === RESOLVE LOOKUPS FIRST — fail fast if seed data is missing ===
      let oppRateUnitId: string;
      let oppCurrencyId: string;
      try {
        oppRateUnitId = resolveUomId(uoms, oppUnit);
        oppCurrencyId = resolveCurrencyId(currencies, currency);
      } catch (lookupErr: any) {
        setError(lookupErr.message);
        setSaving(false);
        return;
      }

      const today = new Date().toISOString().substring(0, 10);
      const oppPayload: Partial<Opportunity> & { rateUnitId?: string; currencyId?: string } = {
        source,
        clientLinkType:
          source === 'From Existing Client' ? 'Account'
          : source === 'From Prospect' ? 'Prospect'
          : source === 'From Existing Consultant' ? 'Contact'
          : 'Free Text',
        accountId: source === 'From Existing Client' ? accountId : undefined,
        prospectId: source === 'From Prospect' ? prospectId : undefined,
        sourceContactId: source === 'From Existing Consultant' ? sourceContactId : undefined,
        freeClientName: source === 'From New Client' ? freeClientName.trim() : undefined,
        role: role.trim(),
        opportunityRate: oppRate ? Number(oppRate) : undefined,
        opportunityRateUnit: oppUnit,
        opportunityCurrency: currency,
        rateUnitId: oppRateUnitId,
        currencyId: oppCurrencyId,
        startDate: startDate || undefined,
        closingDate: closingDate || undefined,
        details: details.trim() || undefined,
        status,
      };

      console.log('[Wizard] saveOpportunity payload:', JSON.stringify(oppPayload, null, 2));
      const newId = await saveOpportunity(oppPayload);
      console.log('[Wizard] saveOpportunity response id:', newId);

      // CV upload deferred — handled later in OpportunitiesPage slide-over (Phase 2C).
      // Persist all applicant rows BEFORE calling onCreated so the parent can
      // hydrate its slide-over state directly without a race against re-fetch.
      const savedApplicants: OpportunityApplicant[] = [];
      const failedApplicants: { kind: string; id: string; error: string }[] = [];

      for (const cr of candidateRates) {
        try {
          // Resolve lookups defensively per applicant — fall back to opp-level
          // GUIDs when the per-row unit/currency match the opp defaults.
          const apRateUnitId = resolveUomId(uoms, cr.unit || oppUnit);
          const apCurrencyId = resolveCurrencyId(currencies, (cr.currency as any) || currency);
          const apPayload = {
            opportunityId: newId,
            candidateId: cr.candidateId,
            rate: cr.rate,
            rateUnit: cr.unit,
            rateCurrency: cr.currency,
            rateUnitId: apRateUnitId,
            currencyId: apCurrencyId,
            status: 'Drafted' as const,
          };
          console.log('[Wizard] saveOpportunityApplicant payload (candidate ' + cr.candidateId + '):', JSON.stringify(apPayload, null, 2));
          const apId = await saveOpportunityApplicant(apPayload as any);
          console.log('[Wizard] saveOpportunityApplicant response id:', apId);
          if (apId) {
            // Reference model: applicant.csp_document stays empty; Send Profiles
            // falls back to candidate.csp_candidatecv. User can Replace per-applicant later.
            savedApplicants.push({
              id: apId,
              opportunityId: newId,
              candidateId: cr.candidateId,
              rate: cr.rate,
              rateUnit: cr.unit,
              rateCurrency: cr.currency,
              status: 'Drafted',
            });
          } else {
            failedApplicants.push({ kind: 'candidate', id: cr.candidateId, error: 'No ID returned' });
          }
        } catch (err: any) {
          console.error('[Wizard] save candidate applicant failed:', cr.candidateId, err);
          failedApplicants.push({ kind: 'candidate', id: cr.candidateId, error: err?.message || 'unknown' });
        }
      }
      for (const cr of contactRates) {
        try {
          const apRateUnitId = resolveUomId(uoms, cr.unit || oppUnit);
          const apCurrencyId = resolveCurrencyId(currencies, (cr.currency as any) || currency);
          const apPayload = {
            opportunityId: newId,
            contactId: cr.contactId,
            rate: cr.rate,
            rateUnit: cr.unit,
            rateCurrency: cr.currency,
            rateUnitId: apRateUnitId,
            currencyId: apCurrencyId,
            status: 'Drafted' as const,
          };
          console.log('[Wizard] saveOpportunityApplicant payload (contact ' + cr.contactId + '):', JSON.stringify(apPayload, null, 2));
          const apId = await saveOpportunityApplicant(apPayload as any);
          console.log('[Wizard] saveOpportunityApplicant response id:', apId);
          if (apId) {
            // Reference model: applicant.csp_document stays empty; Send Profiles
            // falls back to contact's primary csp_contactcv. User can Replace later.
            savedApplicants.push({
              id: apId,
              opportunityId: newId,
              contactId: cr.contactId,
              rate: cr.rate,
              rateUnit: cr.unit,
              rateCurrency: cr.currency,
              status: 'Drafted',
            });
          } else {
            failedApplicants.push({ kind: 'contact', id: cr.contactId, error: 'No ID returned' });
          }
        } catch (err: any) {
          console.error('[Wizard] save contact applicant failed:', cr.contactId, err);
          failedApplicants.push({ kind: 'contact', id: cr.contactId, error: err?.message || 'unknown' });
        }
      }

      if (failedApplicants.length > 0) {
        const detail = failedApplicants.map(f => `${f.kind} ${f.id}: ${f.error}`).join('; ');
        console.warn('[Wizard] Some applicants failed to save:', detail);
      }

      const created: Opportunity = {
        id: newId,
        opportunityNumber: '', // server-generated; parent re-fetches list to get the real number
        source,
        clientLinkType: oppPayload.clientLinkType!,
        accountId: oppPayload.accountId,
        prospectId: oppPayload.prospectId,
        sourceContactId: oppPayload.sourceContactId,
        freeClientName: oppPayload.freeClientName,
        role: role.trim(),
        opportunityRate: oppPayload.opportunityRate,
        opportunityRateUnit: oppUnit,
        opportunityCurrency: currency,
        startDate: oppPayload.startDate,
        closingDate: oppPayload.closingDate,
        details: oppPayload.details,
        status,
        createdAt: today,
      };
      onCreated?.(created, savedApplicants);
      onClose();
    } catch (err: any) {
      console.error('[AddOpportunityWizard] create failed:', err);
      setError(err?.message || 'Failed to create opportunity');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  // ── Client label for review ──────────────────────────────────────────
  const clientLabel =
    source === 'From Prospect' ? (prospects.find(p => p.id === prospectId)?.companyName || '—')
    : source === 'From Existing Client' ? (accounts.find(a => a.id === accountId)?.name || '—')
    : source === 'From Existing Consultant' ? (() => {
        const c = contacts.find(x => x.id === sourceContactId);
        return c ? `${c.firstName} ${c.lastName}` : '—';
      })()
    : (freeClientName || '—');

  const STEP_TITLES = ['Source', 'Client', 'People', 'Role & Rates', 'Dates & Details', 'Review'];
  const STEP_SUBS = [
    'Where does this opportunity come from? This drives how it links to the rest of your data.',
    'Pick or describe the client this opportunity is for.',
    'Who from CSP will be put forward? Add candidates, contacts, or both.',
    'Confirm the role and the commercial position. Margin is computed automatically.',
    'When do you expect this to start and close? Add any extra context.',
    'Review everything before creating the opportunity.',
  ];

  return (
    <div style={backdropStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Add New Opportunity</h2>
          <button
            type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'hsl(var(--muted-foreground))' }}
          ><X className="csp-icon-md" /></button>
        </div>

        <StepBar step={step} total={TOTAL_STEPS} title={STEP_TITLES[step]} subtitle={STEP_SUBS[step]} />

        {/* Step 0: Source */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(Object.keys(SOURCE_INFO) as OpportunitySource[]).map(s => {
              const info = SOURCE_INFO[s];
              const Icon = info.icon;
              const active = source === s;
              return (
                <button
                  key={s} type="button" onClick={() => setSource(s)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, textAlign: 'left',
                    border: active ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                    borderRadius: 8, cursor: 'pointer',
                    background: active ? 'hsl(var(--primary) / 0.05)' : 'white',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: active ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                    color: active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                  }}>
                    <Icon className="csp-icon-sm" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{info.title}</span>
                      {active && <Check className="csp-icon-sm" />}
                    </div>
                    <p style={{ margin: 0, marginTop: 4, fontSize: 12, color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>{info.blurb}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 1: Client */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {source === 'From Prospect' && (
              <>
                <label style={labelStyle}>Prospect</label>
                <SearchableSelect value={prospectId} onChange={setProspectId} options={prospectOptions} placeholder="Pick a prospect…" />
                <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', margin: 0 }}>The opportunity will appear inside this prospect's record and contribute to its forecast.</p>
              </>
            )}
            {source === 'From Existing Client' && (
              <>
                <label style={labelStyle}>Account</label>
                <SearchableSelect value={accountId} onChange={setAccountId} options={accountOptions} placeholder="Pick an account…" />
                <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', margin: 0 }}>All opportunity activity rolls up under this account.</p>
              </>
            )}
            {source === 'From New Client' && (
              <>
                <label style={labelStyle}>Client Name</label>
                <input
                  type="text" value={freeClientName} onChange={e => setFreeClientName(e.target.value)}
                  placeholder="e.g. Acme Health (new)" style={inputStyle}
                />
                <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', margin: 0 }}>We'll keep this as plain text for now. You can convert this client into a Prospect or Account later from the Opportunity record.</p>
              </>
            )}
            {source === 'From Existing Consultant' && (
              <>
                <label style={labelStyle}>Contact</label>
                <SearchableSelect value={sourceContactId} onChange={setSourceContactId} options={allContactOptions} placeholder="Pick the consultant who referred this opportunity…" />
                <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', margin: 0 }}>The lead came through one of our existing consultants. We'll attribute the opportunity to them.</p>
              </>
            )}
          </div>
        )}

        {/* Step 2: People */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Candidates</label>
              <MultiPicker values={candidateIds} onChange={setCandidateIds} options={candidateOptions} placeholder="Pick onboarding candidates…" />
            </div>
            <div>
              <label style={labelStyle}>CSP Consultants</label>
              <MultiPicker values={contactIds} onChange={setContactIds} options={consultantOptions} placeholder="Pick our consultants to put forward…" />
            </div>
            <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', margin: 0 }}>
              You can add either, both, or skip and add applicants later.
            </p>
            {candidateIds.length + contactIds.length === 0 && (
              <div style={{
                background: '#fef3c7', border: '1px solid #f59e0b',
                borderRadius: 6, padding: 12, marginTop: 4,
                color: '#92400e', fontSize: 13,
              }}>
                ⚠ No applicants selected — you can add them later from the Opportunity record.
              </div>
            )}
          </div>
        )}

        {/* Step 3: Role & Rates */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Role <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text" value={role} onChange={e => setRole(e.target.value)}
                placeholder="e.g. Senior .NET Developer" style={inputStyle}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <label style={labelStyle}>Opportunity Rate <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="number" value={oppRate} onChange={e => setOppRate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Rate Unit</label>
                <Picker
                  value={oppUnit}
                  onChange={(v) => setOppUnit(v as RateUnit)}
                  options={validUoms.length > 0
                    ? validUoms.map(u => ({ value: u.name, label: `Per ${u.name}` }))
                    : RATE_UNITS.map(u => ({ value: u, label: `Per ${u}` }))}
                  placeholder="Pick rate unit…"
                />
              </div>
              <div>
                <label style={labelStyle}>Currency</label>
                <Picker
                  value={currency}
                  onChange={setCurrency}
                  options={currencies.length > 0
                    ? currencies.map(c => ({ value: c.code, label: c.code }))
                    : [{ value: 'EUR', label: 'EUR' }]}
                  placeholder="Pick currency…"
                />
              </div>
            </div>

            {/* Per-applicant rate lines */}
            {(candidateRates.length > 0 || contactRates.length > 0) && (
              <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={labelStyle}>Per-applicant rates &amp; margin</span>
                  <button
                    type="button"
                    onClick={() => {
                      const v = oppRate ? Number(oppRate) : undefined;
                      setCandidateRates(prev => prev.map(r => ({ ...r, rate: v, unit: oppUnit, currency: currency as any })));
                      setContactRates(prev => prev.map(r => ({ ...r, rate: v, unit: oppUnit, currency: currency as any })));
                    }}
                    className="csp-btn csp-btn-outline csp-btn-sm"
                    style={{ fontSize: 11 }}
                  >Apply opportunity rate to all</button>
                </div>
                {candidateRates.map(line => {
                  const c = candidates.find(x => x.id === line.candidateId);
                  const m = computeMargin(oppRate ? Number(oppRate) : undefined, oppUnit, line.rate, line.unit);
                  const valid = oppRate && line.rate != null;
                  return (
                    <div key={`cand-${line.candidateId}`} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 90px 80px 1fr', gap: 8, alignItems: 'end' }}>
                      <div style={{ paddingBottom: 6, fontSize: 13 }}>
                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c ? `${c.firstName} ${c.lastName}` : line.candidateId}
                        </div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                          Candidate{c?.cvFileName ? ` · CV: ${c.cvFileName}` : ''}
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Rate</label>
                        <input
                          type="number" style={inputStyle}
                          value={line.rate ?? ''}
                          onChange={e => updateCandidateRate(line.candidateId, { rate: e.target.value ? Number(e.target.value) : undefined })}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Unit</label>
                        <Picker
                          value={line.unit}
                          onChange={(v) => updateCandidateRate(line.candidateId, { unit: v as RateUnit })}
                          options={validUoms.length > 0
                            ? validUoms.map(u => ({ value: u.name, label: `/${u.name.toLowerCase()}` }))
                            : RATE_UNITS.map(u => ({ value: u, label: `/${u.toLowerCase()}` }))}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Curr.</label>
                        <Picker
                          value={(line.currency as any) || currency}
                          onChange={(v) => updateCandidateRate(line.candidateId, { currency: v as any })}
                          options={currencies.length > 0
                            ? currencies.map(cc => ({ value: cc.code, label: cc.code }))
                            : [{ value: 'EUR', label: 'EUR' }]}
                        />
                      </div>
                      <div style={{ paddingBottom: 6, fontSize: 12 }}>
                        <div style={labelStyle}>Margin</div>
                        {valid ? (
                          <div style={{ lineHeight: 1.3 }}>
                            <div style={{ color: m.hourlyMargin < 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>{m.hourlyMargin.toFixed(2)} {currency}/h</div>
                            <div style={{ color: m.dailyMargin < 0 ? '#dc2626' : '#059669' }}>{m.dailyMargin.toFixed(2)} {currency}/d</div>
                          </div>
                        ) : <div style={{ color: 'hsl(var(--muted-foreground))' }}>—</div>}
                      </div>
                    </div>
                  );
                })}
                {contactRates.map(line => {
                  const c = contacts.find(x => x.id === line.contactId);
                  const m = computeMargin(oppRate ? Number(oppRate) : undefined, oppUnit, line.rate, line.unit);
                  const valid = oppRate && line.rate != null;
                  return (
                    <div key={`con-${line.contactId}`} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 90px 80px 1fr', gap: 8, alignItems: 'end' }}>
                      <div style={{ paddingBottom: 6, fontSize: 13 }}>
                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c ? `${c.firstName} ${c.lastName}` : line.contactId}
                        </div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                          {c?.contactType || 'Contact'}
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Rate</label>
                        <input
                          type="number" style={inputStyle}
                          value={line.rate ?? ''}
                          onChange={e => updateContactRate(line.contactId, { rate: e.target.value ? Number(e.target.value) : undefined })}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Unit</label>
                        <Picker
                          value={line.unit}
                          onChange={(v) => updateContactRate(line.contactId, { unit: v as RateUnit })}
                          options={validUoms.length > 0
                            ? validUoms.map(u => ({ value: u.name, label: `/${u.name.toLowerCase()}` }))
                            : RATE_UNITS.map(u => ({ value: u, label: `/${u.toLowerCase()}` }))}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Curr.</label>
                        <Picker
                          value={(line.currency as any) || currency}
                          onChange={(v) => updateContactRate(line.contactId, { currency: v as any })}
                          options={currencies.length > 0
                            ? currencies.map(cc => ({ value: cc.code, label: cc.code }))
                            : [{ value: 'EUR', label: 'EUR' }]}
                        />
                      </div>
                      <div style={{ paddingBottom: 6, fontSize: 12 }}>
                        <div style={labelStyle}>Margin</div>
                        {valid ? (
                          <div style={{ lineHeight: 1.3 }}>
                            <div style={{ color: m.hourlyMargin < 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>{m.hourlyMargin.toFixed(2)} {currency}/h</div>
                            <div style={{ color: m.dailyMargin < 0 ? '#dc2626' : '#059669' }}>{m.dailyMargin.toFixed(2)} {currency}/d</div>
                          </div>
                        ) : <div style={{ color: 'hsl(var(--muted-foreground))' }}>—</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Opportunity-level margin summary */}
            <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, background: 'hsl(var(--muted) / 0.3)', padding: '8px 12px' }}>
              <span style={labelStyle}>Profit margin (first applicant)</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, fontSize: 14 }}>
                <span>
                  <strong style={{ color: hasMargin ? (margin.hourlyMargin < 0 ? '#dc2626' : '#059669') : 'hsl(var(--muted-foreground))' }}>
                    {hasMargin ? margin.hourlyMargin.toFixed(2) : '—'}
                  </strong> {currency}/hour
                </span>
                <span>
                  <strong style={{ color: hasMargin ? (margin.dailyMargin < 0 ? '#dc2626' : '#059669') : 'hsl(var(--muted-foreground))' }}>
                    {hasMargin ? margin.dailyMargin.toFixed(2) : '—'}
                  </strong> {currency}/day
                </span>
                <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Margin: {hasMargin ? margin.marginPercent.toFixed(1) + '%' : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Dates & Details */}
        {step === 4 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Closing Date</label>
              <input type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)} style={inputStyle} />
            </div>
            {dateError && (
              <div style={{ gridColumn: '1 / -1', color: '#dc2626', fontSize: 12, marginTop: -4 }}>{dateError}</div>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Status</label>
              <Picker
                value={status}
                onChange={(v) => setStatus(v as OpportunityStatus)}
                options={STATUSES.map(s => ({ value: s, label: s }))}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Opportunity Details</label>
              <textarea
                value={details} onChange={e => setDetails(e.target.value)} rows={5}
                placeholder="What does the client need? Any context that helps the team move this forward."
                style={textareaStyle}
              />
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 12, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px' }}>
              <div style={labelStyle}>Source</div><div>{source}</div>
              <div style={labelStyle}>Client</div><div>{clientLabel}</div>
              <div style={labelStyle}>Role</div><div>{role || '—'}</div>
              <div style={labelStyle}>Status</div><div>{status}</div>
              <div style={labelStyle}>Opportunity Rate</div><div>{oppRate ? `${oppRate} ${currency}/${oppUnit.toLowerCase()}` : '—'}</div>
              <div style={labelStyle}>Start → Close</div><div>{(startDate || '—')} → {(closingDate || '—')}</div>
              <div style={labelStyle}>Candidates</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {candidateIds.length === 0 ? '—' : candidateIds.map(id => {
                  const c = candidates.find(x => x.id === id);
                  return c ? <span key={id} style={{ background: 'hsl(var(--muted) / 0.4)', padding: '2px 8px', borderRadius: 9999, fontSize: 12 }}>{c.firstName} {c.lastName}</span> : null;
                })}
              </div>
              <div style={labelStyle}>Contacts</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {contactIds.length === 0 ? '—' : contactIds.map(id => {
                  const c = contacts.find(x => x.id === id);
                  return c ? <span key={id} style={{ background: 'hsl(var(--muted) / 0.4)', padding: '2px 8px', borderRadius: 9999, fontSize: 12 }}>{c.firstName} {c.lastName}</span> : null;
                })}
              </div>
            </div>
            {(candidateRates.some(r => r.rate != null) || contactRates.some(r => r.rate != null)) && (
              <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 12 }}>
                <div style={{ ...labelStyle, marginBottom: 6 }}>Applicant rates &amp; margin</div>
                {candidateRates.map(line => {
                  const c = candidates.find(x => x.id === line.candidateId);
                  const m = computeMargin(oppRate ? Number(oppRate) : undefined, oppUnit, line.rate, line.unit);
                  const valid = oppRate && line.rate != null;
                  return (
                    <div key={`r-cand-${line.candidateId}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                      <span>{c ? `${c.firstName} ${c.lastName}` : line.candidateId} <span style={{ color: 'hsl(var(--muted-foreground))' }}>(Candidate)</span></span>
                      <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                        {line.rate != null ? `${line.rate} ${line.currency || currency}/${line.unit.toLowerCase()}` : '—'}
                        {valid && <span style={{ marginLeft: 8, color: m.hourlyMargin < 0 ? '#dc2626' : '#059669' }}>· {m.hourlyMargin.toFixed(2)}/h · {m.dailyMargin.toFixed(2)}/d</span>}
                      </span>
                    </div>
                  );
                })}
                {contactRates.map(line => {
                  const c = contacts.find(x => x.id === line.contactId);
                  const m = computeMargin(oppRate ? Number(oppRate) : undefined, oppUnit, line.rate, line.unit);
                  const valid = oppRate && line.rate != null;
                  return (
                    <div key={`r-con-${line.contactId}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                      <span>{c ? `${c.firstName} ${c.lastName}` : line.contactId} <span style={{ color: 'hsl(var(--muted-foreground))' }}>(Consultant)</span></span>
                      <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                        {line.rate != null ? `${line.rate} ${line.currency || currency}/${line.unit.toLowerCase()}` : '—'}
                        {valid && <span style={{ marginLeft: 8, color: m.hourlyMargin < 0 ? '#dc2626' : '#059669' }}>· {m.hourlyMargin.toFixed(2)}/h · {m.dailyMargin.toFixed(2)}/d</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {details && (
              <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 12 }}>
                <div style={{ ...labelStyle, marginBottom: 4 }}>Details</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{details}</div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: 'hsl(0 65% 96%)', border: '1px solid hsl(0 65% 85%)', color: 'hsl(0 65% 35%)', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
          <button type="button" className="csp-btn csp-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button" className="csp-btn csp-btn-outline"
              onClick={back} disabled={step === 0 || saving}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <ChevronLeft className="csp-icon-sm" /> Back
            </button>
            {step < TOTAL_STEPS - 1 ? (
              <button
                type="button" className="csp-btn csp-btn-primary"
                onClick={next} disabled={!canNext || saving}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {step === 2 && candidateIds.length + contactIds.length === 0 ? 'Skip — no applicants yet' : 'Next'}
                <ChevronRight className="csp-icon-sm" />
              </button>
            ) : (
              <button
                type="button" className="csp-btn csp-btn-primary"
                onClick={handleCreate} disabled={saving}
              >{saving ? 'Creating…' : 'Create Opportunity'}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
