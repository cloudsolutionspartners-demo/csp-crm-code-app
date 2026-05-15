import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Sparkles, UserPlus, Users, X, Check, FileText } from '../Icons';
import { saveOpportunity } from '../../services/opportunityService';
import { saveOpportunityApplicant } from '../../services/opportunityApplicantService';
import { computeMargin } from './AddOpportunityWizard';
import { resolveUomId, resolveCurrencyId } from '../../lib/dataverseHelpers';
import type {
  Opportunity, OpportunityStatus, OpportunitySource, OpportunityClientLinkType,
  RateUnit, Account, Prospect, Contact, OnboardingCandidate,
  ContactRateLine, CandidateRateLine,
} from '../../types/crm';

// ── Reference-data shapes ──────────────────────────────────────────────
type UomOpt = { id: string; name: string };
type CurrencyOpt = { id: string; code: string };

export type RaiseOrigin =
  | { kind: 'account'; record: Account }
  | { kind: 'prospect'; record: Prospect }
  | { kind: 'contact'; record: Contact }
  | { kind: 'candidate'; record: OnboardingCandidate };

export interface RaiseOpportunityFormProps {
  open: boolean;
  onClose: () => void;
  origin: RaiseOrigin | null;
  onCreated?: (opp: Opportunity) => void;
  accounts: Account[];
  prospects: Prospect[];
  contacts: Contact[];
  candidates: OnboardingCandidate[];
  uoms: UomOpt[];
  currencies: CurrencyOpt[];
}

const STATUSES: OpportunityStatus[] = ['New', 'Interview Booked', 'Won', 'Lost'];
const RATE_UNITS: RateUnit[] = ['Hour', 'Day'];

// ── Styles ─────────────────────────────────────────────────────────────
const backdropStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 24,
  width: 640, maxWidth: '92vw', maxHeight: '90vh', overflow: 'auto',
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
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))',
  borderBottom: '1px solid hsl(var(--border))', paddingBottom: 4, marginBottom: 10,
};

// ── Searchable single-select ───────────────────────────────────────────
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
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
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
          ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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

// ── Multi-select chips picker ──────────────────────────────────────────
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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
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

// ─── Main form ────────────────────────────────────────────────────────
export function RaiseOpportunityForm({
  open, onClose, origin, onCreated,
  accounts, prospects, contacts, candidates, uoms, currencies,
}: RaiseOpportunityFormProps) {
  const [role, setRole] = useState('');
  const [oppRate, setOppRate] = useState('');
  const [oppUnit, setOppUnit] = useState<RateUnit>('Day');
  const [currency, setCurrency] = useState('EUR');
  const [details, setDetails] = useState('');
  const [startDate, setStartDate] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [status, setStatus] = useState<OpportunityStatus>('New');

  const [candidateIds, setCandidateIds] = useState<string[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [contactRates, setContactRates] = useState<ContactRateLine[]>([]);
  const [candidateRates, setCandidateRates] = useState<CandidateRateLine[]>([]);

  // Client mode (for candidate/contact origins — user picks where to place)
  const [clientMode, setClientMode] = useState<'account' | 'prospect' | 'free'>('account');
  const [accountId, setAccountId] = useState('');
  const [prospectId, setProspectId] = useState('');
  const [freeClientName, setFreeClientName] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Close on Escape (backdrop click intentionally ignored to protect form state).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // ── Reset/preseed on open ─────────────────────────────────────────
  useEffect(() => {
    if (!open || !origin) return;
    setRole('');
    setOppRate('');
    setOppUnit('Day');
    setCurrency('EUR');
    setDetails('');
    setStartDate('');
    setClosingDate('');
    setStatus('New');
    setCandidateIds([]);
    setContactIds([]);
    setContactRates([]);
    setCandidateRates([]);
    setClientMode('account');
    setAccountId('');
    setProspectId('');
    setFreeClientName('');
    setError('');

    if (origin.kind === 'account') {
      setAccountId(origin.record.id);
      setClientMode('account');
    } else if (origin.kind === 'prospect') {
      setProspectId(origin.record.id);
      setClientMode('prospect');
    } else if (origin.kind === 'contact') {
      const c = origin.record;
      setContactIds([c.id]);
      if (c.accountId) { setAccountId(c.accountId); setClientMode('account'); }
      else if (c.company) { setFreeClientName(c.company); setClientMode('free'); }
    } else if (origin.kind === 'candidate') {
      const cd = origin.record;
      setCandidateIds([cd.id]);
      setRole(cd.candidateRole || '');
      setClientMode('free');
    }
  }, [open, origin]);

  // Keep contactRates aligned with selected contactIds
  useEffect(() => {
    setContactRates(prev => {
      const map = new Map(prev.map(r => [r.contactId, r]));
      return contactIds.map(id => map.get(id) || { contactId: id, rate: undefined, unit: 'Hour' as RateUnit, currency: currency as any });
    });
  }, [contactIds, currency]);

  // Keep candidateRates aligned, prefill rate from candidate.hourlyRateEur
  useEffect(() => {
    setCandidateRates(prev => {
      const map = new Map(prev.map(r => [r.candidateId, r]));
      return candidateIds.map(id => {
        const existing = map.get(id);
        if (existing) return existing;
        const c = candidates.find(x => x.id === id);
        return { candidateId: id, rate: c?.hourlyRateEur, unit: 'Hour' as RateUnit, currency: currency as any };
      });
    });
    // Role auto-fill from candidate removed (see AddOpportunityWizard).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateIds, currency]);

  // ── Picker options ────────────────────────────────────────────────
  const accountOptions = useMemo(() => accounts.map(a => ({ value: a.id, label: a.name })), [accounts]);
  const prospectOptions = useMemo(() => prospects.map(p => ({ value: p.id, label: p.prospectNumber ? `${p.prospectNumber} — ${p.companyName}` : p.companyName })), [prospects]);
  const candidateOptions = useMemo(() => candidates.map(c => ({
    value: c.id, label: `${c.firstName} ${c.lastName}`,
    sub: `${c.candidateRole || '—'} · €${c.hourlyRateEur ?? 0}/h`,
  })), [candidates]);
  const consultantOptions = useMemo(() => contacts
    .filter(c => c.contactType === 'Consultant')
    .map(c => ({
      value: c.id, label: `${c.firstName} ${c.lastName}`,
      sub: `Consultant${c.jobRole ? ' · ' + c.jobRole : ''}${c.email ? ' · ' + c.email : ''}`,
    })), [contacts]);

  // ── Resolve source/client based on origin + chooser ───────────────
  const resolved = useMemo(() => {
    let source: OpportunitySource = 'From New Client';
    let clientLinkType: OpportunityClientLinkType = 'Free Text';
    let resAccountId: string | undefined;
    let resProspectId: string | undefined;
    let resFreeName: string | undefined;
    let resSourceContactId: string | undefined;

    if (origin?.kind === 'account') {
      source = 'From Existing Client'; clientLinkType = 'Account'; resAccountId = origin.record.id;
    } else if (origin?.kind === 'prospect') {
      source = 'From Prospect'; clientLinkType = 'Prospect'; resProspectId = origin.record.id;
    } else if (origin?.kind === 'contact') {
      // Contact origin uses contact as referrer + user picks client
      source = 'From Existing Consultant'; clientLinkType = 'Contact'; resSourceContactId = origin.record.id;
      // Still allow account/free name override via chooser
      if (clientMode === 'account' && accountId) { source = 'From Existing Client'; clientLinkType = 'Account'; resAccountId = accountId; resSourceContactId = undefined; }
      else if (clientMode === 'prospect' && prospectId) { source = 'From Prospect'; clientLinkType = 'Prospect'; resProspectId = prospectId; resSourceContactId = undefined; }
      else if (clientMode === 'free' && freeClientName.trim()) { source = 'From New Client'; clientLinkType = 'Free Text'; resFreeName = freeClientName.trim(); resSourceContactId = undefined; }
    } else if (origin?.kind === 'candidate') {
      if (clientMode === 'account' && accountId) { source = 'From Existing Client'; clientLinkType = 'Account'; resAccountId = accountId; }
      else if (clientMode === 'prospect' && prospectId) { source = 'From Prospect'; clientLinkType = 'Prospect'; resProspectId = prospectId; }
      else { source = 'From New Client'; clientLinkType = 'Free Text'; resFreeName = freeClientName.trim() || undefined; }
    }
    return { source, clientLinkType, resAccountId, resProspectId, resFreeName, resSourceContactId };
  }, [origin, clientMode, accountId, prospectId, freeClientName]);

  const clientChosen =
    origin?.kind === 'account' ||
    origin?.kind === 'prospect' ||
    (origin?.kind === 'contact') ||
    (origin?.kind === 'candidate' && (
      (clientMode === 'account' && !!accountId) ||
      (clientMode === 'prospect' && !!prospectId) ||
      (clientMode === 'free' && !!freeClientName.trim())
    ));

  const canSubmit = !!origin && !!role.trim() && !!oppRate && clientChosen && !saving;

  // ── Margin preview against first applicant ────────────────────────
  const baselineRate = candidateRates[0]?.rate ?? contactRates[0]?.rate;
  const baselineUnit: RateUnit = (candidateRates[0]?.unit ?? contactRates[0]?.unit ?? 'Hour') as RateUnit;
  const margin = computeMargin(oppRate ? Number(oppRate) : undefined, oppUnit, baselineRate, baselineUnit);
  const hasMargin = oppRate && baselineRate != null;

  // ── Save ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!origin || !canSubmit) return;
    setSaving(true);
    setError('');
    try {
      // Resolve lookups defensively — fail-fast instead of saving NULL
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
        source: resolved.source,
        clientLinkType: resolved.clientLinkType,
        accountId: resolved.resAccountId,
        prospectId: resolved.resProspectId,
        sourceContactId: resolved.resSourceContactId,
        freeClientName: resolved.resFreeName,
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
      console.log('[RaiseForm] saveOpportunity payload:', JSON.stringify(oppPayload, null, 2));
      const newId = await saveOpportunity(oppPayload);
      console.log('[RaiseForm] saveOpportunity response id:', newId);

      // Save applicants sequentially with per-row defensive resolution
      for (const cr of candidateRates) {
        try {
          const apPayload = {
            opportunityId: newId,
            candidateId: cr.candidateId,
            rate: cr.rate,
            rateUnit: cr.unit,
            rateCurrency: cr.currency,
            rateUnitId: resolveUomId(uoms, cr.unit || oppUnit),
            currencyId: resolveCurrencyId(currencies, (cr.currency as any) || currency),
            status: 'Drafted' as const,
          };
          console.log('[RaiseForm] saveOpportunityApplicant payload (candidate ' + cr.candidateId + '):', JSON.stringify(apPayload, null, 2));
          const apId = await saveOpportunityApplicant(apPayload as any);
          console.log('[RaiseForm] saveOpportunityApplicant response id:', apId);
        } catch (err) {
          console.error('[RaiseForm] save candidate applicant failed:', cr.candidateId, err);
        }
      }
      for (const cr of contactRates) {
        try {
          const apPayload = {
            opportunityId: newId,
            contactId: cr.contactId,
            rate: cr.rate,
            rateUnit: cr.unit,
            rateCurrency: cr.currency,
            rateUnitId: resolveUomId(uoms, cr.unit || oppUnit),
            currencyId: resolveCurrencyId(currencies, (cr.currency as any) || currency),
            status: 'Drafted' as const,
          };
          console.log('[RaiseForm] saveOpportunityApplicant payload (contact ' + cr.contactId + '):', JSON.stringify(apPayload, null, 2));
          const apId = await saveOpportunityApplicant(apPayload as any);
          console.log('[RaiseForm] saveOpportunityApplicant response id:', apId);
        } catch (err) {
          console.error('[RaiseForm] save contact applicant failed:', cr.contactId, err);
        }
      }

      const created: Opportunity = {
        id: newId,
        opportunityNumber: '',
        source: resolved.source,
        clientLinkType: resolved.clientLinkType,
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
      onCreated?.(created);
      onClose();
    } catch (err: any) {
      console.error('[RaiseOpportunityForm] create failed:', err);
      setError(err?.message || 'Failed to create opportunity');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !origin) return null;

  // ── Framing per origin ────────────────────────────────────────────
  const framing = (() => {
    switch (origin.kind) {
      case 'account': return {
        Icon: Building2,
        title: `New Opportunity — ${origin.record.name}`,
        subtitle: 'Existing client. The opportunity rolls up under this account.',
        badge: `Account · ${origin.record.name}`,
      };
      case 'prospect': return {
        Icon: Sparkles,
        title: `New Opportunity — ${origin.record.companyName}`,
        subtitle: `Tied to prospect ${origin.record.prospectNumber}. Will contribute to pipeline value.`,
        badge: `Prospect · ${origin.record.prospectNumber}`,
      };
      case 'contact': return {
        Icon: Users,
        title: `Raise Opportunity with ${origin.record.firstName} ${origin.record.lastName}`,
        subtitle: 'Contact-led opportunity. Confirm which client this is for.',
        badge: `Contact · ${origin.record.contactType}`,
      };
      case 'candidate': return {
        Icon: UserPlus,
        title: `Place ${origin.record.firstName} ${origin.record.lastName}${origin.record.candidateRole ? ` — ${origin.record.candidateRole}` : ''}`,
        subtitle: 'Candidate-led opportunity. Rates pre-filled from the candidate record.',
        badge: `Candidate · €${origin.record.hourlyRateEur ?? 0}/h`,
      };
    }
  })();
  const Icon = framing.Icon;

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div style={backdropStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon className="csp-icon-md" />
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{framing.title}</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'hsl(var(--muted) / 0.6)', padding: '2px 10px',
                borderRadius: 9999, fontSize: 11, fontWeight: 500,
              }}>{framing.badge}</span>
              <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{framing.subtitle}</span>
            </div>
          </div>
          <button
            type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'hsl(var(--muted-foreground))' }}
          ><X className="csp-icon-md" /></button>
        </div>

        {/* Client chooser for candidate / contact origins */}
        {(origin.kind === 'candidate' || origin.kind === 'contact') && (
          <section>
            <h4 style={sectionTitleStyle}>{origin.kind === 'candidate' ? 'Where are you placing them?' : 'Confirm the client'}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
              {([
                { id: 'account' as const, Icon: Building2, title: 'Existing Client', blurb: 'Files under an Account.' },
                { id: 'prospect' as const, Icon: Sparkles, title: 'Prospect', blurb: 'Files under a qualified Prospect.' },
                { id: 'free' as const, Icon: UserPlus, title: 'New Client', blurb: 'Free-text client name.' },
              ]).map(c => {
                const active = clientMode === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setClientMode(c.id)}
                    style={{
                      textAlign: 'left', padding: 10,
                      border: active ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                      borderRadius: 6, cursor: 'pointer',
                      background: active ? 'hsl(var(--primary) / 0.05)' : 'white',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                      <c.Icon className="csp-icon-sm" /> {c.title}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'hsl(var(--muted-foreground))', lineHeight: 1.4 }}>{c.blurb}</p>
                  </button>
                );
              })}
            </div>
            {clientMode === 'account' && (
              <>
                <label style={labelStyle}>Account</label>
                <SearchableSelect value={accountId} onChange={setAccountId} options={accountOptions} placeholder="Pick an account…" />
              </>
            )}
            {clientMode === 'prospect' && (
              <>
                <label style={labelStyle}>Prospect</label>
                <SearchableSelect value={prospectId} onChange={setProspectId} options={prospectOptions} placeholder="Pick a prospect…" />
              </>
            )}
            {clientMode === 'free' && (
              <>
                <label style={labelStyle}>Client Name</label>
                <input type="text" value={freeClientName} onChange={e => setFreeClientName(e.target.value)}
                  placeholder="e.g. Acme Health (new)" style={inputStyle} />
              </>
            )}
          </section>
        )}

        {/* Applicants */}
        <section>
          <h4 style={sectionTitleStyle}>Who do we put forward?</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={labelStyle}>Candidates</label>
              <MultiPicker values={candidateIds} onChange={setCandidateIds} options={candidateOptions} placeholder="Pick onboarding candidates…" />
            </div>
            <div>
              <label style={labelStyle}>CSP Consultants</label>
              <MultiPicker values={contactIds} onChange={setContactIds} options={consultantOptions} placeholder="Pick our consultants…" />
            </div>
            {origin.kind === 'contact' && contactIds.includes(origin.record.id) && (
              <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', margin: 0 }}>
                The originating contact is pre-selected. Uncheck to remove them.
              </p>
            )}
          </div>
        </section>

        {/* Role & rates */}
        <section>
          <h4 style={sectionTitleStyle}>Role &amp; commercials</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={labelStyle}>Role <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" value={role} onChange={e => setRole(e.target.value)}
                placeholder="e.g. Senior .NET Developer" style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <label style={labelStyle}>Opportunity Rate <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="number" value={oppRate} onChange={e => setOppRate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Unit</label>
                <select value={oppUnit} onChange={e => setOppUnit(e.target.value as RateUnit)} style={inputStyle as any}>
                  {RATE_UNITS.map(u => <option key={u} value={u}>{`Per ${u}`}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} style={inputStyle as any}>
                  {currencies.map(c => <option key={c.id} value={c.code}>{c.code}</option>)}
                  {currencies.length === 0 && <option value="EUR">EUR</option>}
                </select>
              </div>
            </div>

            {/* Per-applicant rate rows */}
            {(candidateRates.length > 0 || contactRates.length > 0) && (
              <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={labelStyle}>Per-applicant rates &amp; margin</span>
                  <button
                    type="button"
                    className="csp-btn csp-btn-outline csp-btn-sm"
                    onClick={() => {
                      const v = oppRate ? Number(oppRate) : undefined;
                      setCandidateRates(prev => prev.map(r => ({ ...r, rate: v, unit: oppUnit, currency: currency as any })));
                      setContactRates(prev => prev.map(r => ({ ...r, rate: v, unit: oppUnit, currency: currency as any })));
                    }}
                    style={{ fontSize: 11 }}
                  >Apply opportunity rate to all</button>
                </div>
                {candidateRates.map(line => {
                  const c = candidates.find(x => x.id === line.candidateId);
                  const m = computeMargin(oppRate ? Number(oppRate) : undefined, oppUnit, line.rate, line.unit);
                  const valid = oppRate && line.rate != null;
                  return (
                    <div key={`cand-${line.candidateId}`} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 80px 80px', gap: 8, alignItems: 'end', fontSize: 12 }}>
                      <div style={{ paddingBottom: 6 }}>
                        <div style={{ fontWeight: 500 }}>{c ? `${c.firstName} ${c.lastName}` : line.candidateId}</div>
                        <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 10 }}>Candidate{c?.cvFileName ? ' · CV on file' : ''}</div>
                      </div>
                      <div>
                        <label style={labelStyle}>Rate</label>
                        <input type="number" style={inputStyle} value={line.rate ?? ''}
                          onChange={e => setCandidateRates(prev => prev.map(r => r.candidateId === line.candidateId
                            ? { ...r, rate: e.target.value ? Number(e.target.value) : undefined } : r))} />
                      </div>
                      <div>
                        <label style={labelStyle}>Unit</label>
                        <select value={line.unit} style={inputStyle as any}
                          onChange={e => setCandidateRates(prev => prev.map(r => r.candidateId === line.candidateId ? { ...r, unit: e.target.value as RateUnit } : r))}>
                          {RATE_UNITS.map(u => <option key={u} value={u}>/{u.toLowerCase()}</option>)}
                        </select>
                      </div>
                      <div style={{ paddingBottom: 6 }}>
                        <div style={labelStyle}>Margin</div>
                        {valid ? (
                          <span style={{ color: m.hourlyMargin < 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>{m.hourlyMargin.toFixed(2)}/h</span>
                        ) : <span style={{ color: 'hsl(var(--muted-foreground))' }}>—</span>}
                      </div>
                    </div>
                  );
                })}
                {contactRates.map(line => {
                  const c = contacts.find(x => x.id === line.contactId);
                  const m = computeMargin(oppRate ? Number(oppRate) : undefined, oppUnit, line.rate, line.unit);
                  const valid = oppRate && line.rate != null;
                  return (
                    <div key={`con-${line.contactId}`} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 80px 80px', gap: 8, alignItems: 'end', fontSize: 12 }}>
                      <div style={{ paddingBottom: 6 }}>
                        <div style={{ fontWeight: 500 }}>{c ? `${c.firstName} ${c.lastName}` : line.contactId}</div>
                        <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 10 }}>{c?.contactType || 'Contact'}</div>
                      </div>
                      <div>
                        <label style={labelStyle}>Rate</label>
                        <input type="number" style={inputStyle} value={line.rate ?? ''}
                          onChange={e => setContactRates(prev => prev.map(r => r.contactId === line.contactId
                            ? { ...r, rate: e.target.value ? Number(e.target.value) : undefined } : r))} />
                      </div>
                      <div>
                        <label style={labelStyle}>Unit</label>
                        <select value={line.unit} style={inputStyle as any}
                          onChange={e => setContactRates(prev => prev.map(r => r.contactId === line.contactId ? { ...r, unit: e.target.value as RateUnit } : r))}>
                          {RATE_UNITS.map(u => <option key={u} value={u}>/{u.toLowerCase()}</option>)}
                        </select>
                      </div>
                      <div style={{ paddingBottom: 6 }}>
                        <div style={labelStyle}>Margin</div>
                        {valid ? (
                          <span style={{ color: m.hourlyMargin < 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>{m.hourlyMargin.toFixed(2)}/h</span>
                        ) : <span style={{ color: 'hsl(var(--muted-foreground))' }}>—</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Top-line margin */}
            <div style={{ border: '1px solid hsl(var(--border))', background: 'hsl(var(--muted) / 0.3)', borderRadius: 6, padding: '8px 12px' }}>
              <div style={labelStyle}>Profit margin (first applicant)</div>
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
              </div>
            </div>
          </div>
        </section>

        {/* Timeline & details */}
        <section>
          <h4 style={sectionTitleStyle}>Timeline &amp; details</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Closing Date</label>
              <input type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as OpportunityStatus)} style={inputStyle as any}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Opportunity Details</label>
              <textarea value={details} onChange={e => setDetails(e.target.value)} rows={4}
                placeholder="What does the client need? Any context that helps the team move this forward."
                style={textareaStyle} />
            </div>
          </div>
        </section>

        {error && (
          <div style={{ background: 'hsl(0 65% 96%)', border: '1px solid hsl(0 65% 85%)', color: 'hsl(0 65% 35%)', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
          <button type="button" className="csp-btn csp-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="csp-btn csp-btn-primary" onClick={handleCreate} disabled={!canSubmit}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText className="csp-icon-sm" /> {saving ? 'Creating…' : 'Create Opportunity'}
          </button>
        </div>
      </div>
    </div>
  );
}
