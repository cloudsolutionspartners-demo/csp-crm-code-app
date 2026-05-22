import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader, StatusBadge, Spinner } from '../components/Shared';
import { Sheet, Tabs, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, SelectField, TextAreaField } from '../components/FormFields';
import { SearchPill, SinglePill, FilterChip } from '../components/FilterPills';
import { Plus, X, FileText, Upload, Send, Trash2 } from '../components/Icons';
import { useConfirm } from '../components/ConfirmDialog';
import { cn, formatDate, formatOppNumber } from '../lib/utils';
import { listRecords, getOrgUrl } from '../services/dataverseService';
import { MicrosoftDataverseService } from '../generated/services/MicrosoftDataverseService';
import { Csp_opportunityapplicantsService } from '../generated/services/Csp_opportunityapplicantsService';
import { fetchOpportunities, saveOpportunity, removeOpportunity } from '../services/opportunityService';
import { resolveUomId, resolveCurrencyId, normalizeCurrencyCode } from '../lib/dataverseHelpers';
import {
  fetchOpportunityApplicants, saveOpportunityApplicant, removeOpportunityApplicant,
} from '../services/opportunityApplicantService';
import {
  fetchOpportunityMaterials, saveOpportunityMaterial, removeOpportunityMaterial,
} from '../services/opportunityMaterialService';
import { fetchAccounts } from '../services/accountService';
import { fetchProspects } from '../services/prospectService';
import { fetchContacts } from '../services/contactService';
import { fetchCandidates } from '../services/candidateService';
import { fetchUnitsOfMeasure } from '../services/unitOfMeasureService';
import type {
  Opportunity, OpportunityStatus, OpportunitySource,
  OpportunityApplicant, ApplicantStatus, OpportunityMaterial,
  Account, Prospect, Contact, OnboardingCandidate, RateUnit,
} from '../types/crm';
import { AddOpportunityWizard, computeMargin } from '../components/opportunity/AddOpportunityWizard';
import { SendOpportunityProfilesDialog } from '../components/opportunity/SendOpportunityProfilesDialog';
import { Picker } from '../components/opportunity/Picker';
import { fetchContactCvs } from '../services/contactCvService';
import type { ContactCv } from '../types/crm';

// ─── Constants ────────────────────────────────────────────────────────
const STATUSES: OpportunityStatus[] = ['New', 'Interview Booked', 'Won', 'Lost'];
const SOURCES: OpportunitySource[] = ['From Prospect', 'From Existing Client', 'From New Client', 'From Existing Consultant'];
const RATE_UNITS: RateUnit[] = ['Hour', 'Day'];
const APPLICANT_STATUSES: ApplicantStatus[] = ['Drafted', 'Sent', 'Accepted', 'Rejected'];

const statusColors: Record<OpportunityStatus, string> = {
  'New': '#3b82f6',
  'Interview Booked': '#f59e0b',
  'Won': '#10b981',
  'Lost': '#ef4444',
};

const statusBadgeStyles: Record<OpportunityStatus, React.CSSProperties> = {
  'New': { background: 'hsl(215 90% 95%)', color: 'hsl(215 80% 35%)' },
  'Interview Booked': { background: 'hsl(38 92% 92%)', color: 'hsl(38 75% 30%)' },
  'Won': { background: 'hsl(142 60% 92%)', color: 'hsl(142 60% 25%)' },
  'Lost': { background: 'hsl(0 65% 93%)', color: 'hsl(0 60% 35%)' },
};

const applicantStatusStyles: Record<ApplicantStatus, React.CSSProperties> = {
  'Drafted': { background: 'hsl(var(--muted) / 0.6)', color: 'hsl(var(--foreground))' },
  'Sent': { background: 'hsl(215 90% 95%)', color: 'hsl(215 80% 35%)' },
  'Accepted': { background: 'hsl(142 60% 92%)', color: 'hsl(142 60% 25%)' },
  'Rejected': { background: 'hsl(0 65% 93%)', color: 'hsl(0 60% 35%)' },
};

// ─── Local minimal types matching Phase 2A wizard props ───────────────
type CurrencyOpt = { id: string; code: string; name?: string };
type UomOpt = { id: string; name: string };

// ─── Helpers ──────────────────────────────────────────────────────────
function renderStatusBadge(status: OpportunityStatus) {
  return (
    <span
      style={{
        ...statusBadgeStyles[status],
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 10px', borderRadius: 9999,
        fontSize: 11, fontWeight: 600,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColors[status] }} />
      {status}
    </span>
  );
}

function renderApplicantBadge(status: ApplicantStatus) {
  return (
    <span
      style={{
        ...applicantStatusStyles[status],
        display: 'inline-block',
        padding: '2px 10px', borderRadius: 9999,
        fontSize: 11, fontWeight: 600,
      }}
    >{status}</span>
  );
}

function resolveClientName(
  opp: Opportunity,
  accounts: Account[], prospects: Prospect[], contacts: Contact[],
): string {
  if (opp.clientLinkType === 'Account') {
    return accounts.find(a => a.id === opp.accountId)?.name || opp.accountName || '—';
  }
  if (opp.clientLinkType === 'Prospect') {
    return prospects.find(p => p.id === opp.prospectId)?.companyName || opp.prospectName || '—';
  }
  if (opp.clientLinkType === 'Contact') {
    const c = contacts.find(x => x.id === opp.sourceContactId);
    return c ? `${c.firstName} ${c.lastName}` : (opp.sourceContactName || '—');
  }
  return opp.freeClientName || '—';
}

async function fetchCurrenciesList(): Promise<CurrencyOpt[]> {
  try {
    const records = await listRecords(
      'transactioncurrencies',
      // currencyname needed so resolveCurrencyId can also match the display name
      // ("Euro", "US Dollar") returned in lookup FormattedValue annotations.
      'transactioncurrencyid,isocurrencycode,currencyname',
      undefined, 'isocurrencycode asc',
    );
    return records
      .map(r => ({
        id: String(r.transactioncurrencyid).replace(/[{}]/g, ''),
        code: (r.isocurrencycode || '').toUpperCase(),
        name: r.currencyname || '',
      }))
      .filter(c => !!c.code);
  } catch (err) {
    console.error('[Opportunities] failed to load currencies:', err);
    return [];
  }
}

/**
 * Snapshot the source CV onto an applicant's csp_document column at apply time.
 * Best-effort: failures are logged but do NOT block applicant creation.
 *
 * Candidate source → reads csp_candidates.csp_candidatecv (one CV per candidate).
 * Contact source   → finds the first row in csp_contactcvs for that contact and
 *                    reads its csp_document column.
 *
 * The fetched bytes come back from GetEntityFileImageFieldContentWithOrganization
 * as either real base64 OR a Latin-1 raw-byte string (the SDK is inconsistent).
 * Magic-byte detection on PDF (%PDF) / ZIP (PK\x03\x04) routes the right way.
 */
async function copyCvToApplicant(args: {
  applicantId: string;
  source: { kind: 'candidate'; candidateId: string; fileName?: string }
        | { kind: 'contact'; contactId: string };
}): Promise<{ copied: boolean; reason?: string }> {
  const { applicantId, source } = args;
  console.log('[copyCvToApplicant] start', { applicantId, source });
  try {
    const orgUrl = getOrgUrl();
    let cvBytesString: string | null = null;
    let cvFileName = 'CV.pdf';

    if (source.kind === 'candidate') {
      const result = await MicrosoftDataverseService.GetEntityFileImageFieldContentWithOrganization(
        'bytes=0-', orgUrl, 'csp_candidates', source.candidateId, 'csp_candidatecv',
      ) as any;
      cvBytesString = (result?.data ?? (typeof result === 'string' ? result : null)) as string | null;
      if (source.fileName) cvFileName = source.fileName;
    } else {
      // Find the contact's first CV row via the existing service helper
      const cvs = await fetchContactCvs(source.contactId);
      if (cvs.length === 0) {
        console.warn('[copyCvToApplicant] Contact has no CVs in csp_contactcvs');
        return { copied: false, reason: 'Contact has no CVs uploaded' };
      }
      const firstCv = cvs.find(c => c.isPrimary) || cvs[0];
      cvFileName = firstCv.fileName || firstCv.label || 'CV.pdf';
      const result = await MicrosoftDataverseService.GetEntityFileImageFieldContentWithOrganization(
        'bytes=0-', orgUrl, 'csp_contactcvs', firstCv.id, 'csp_document',
      ) as any;
      cvBytesString = (result?.data ?? (typeof result === 'string' ? result : null)) as string | null;
    }

    if (!cvBytesString || typeof cvBytesString !== 'string' || cvBytesString.length === 0) {
      console.warn('[copyCvToApplicant] Source has no CV bytes');
      return { copied: false, reason: 'Source CV is empty' };
    }
    console.log('[copyCvToApplicant] fetched CV bytes:', { length: cvBytesString.length, fileName: cvFileName });

    // Content type from extension
    const ext = cvFileName.split('.').pop()?.toLowerCase();
    let cvContentType = 'application/pdf';
    if (ext === 'docx') cvContentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === 'doc') cvContentType = 'application/msword';

    // Decode bytes — magic-byte detection on PDF / ZIP-DOCX prefix
    const firstBytes = cvBytesString.slice(0, 4);
    const isRawLatin1Pdf = firstBytes === '%PDF';
    const isRawLatin1Zip = firstBytes.charCodeAt(0) === 0x50 && firstBytes.charCodeAt(1) === 0x4B
      && firstBytes.charCodeAt(2) === 0x03 && firstBytes.charCodeAt(3) === 0x04;
    let byteArray: Uint8Array;
    if (isRawLatin1Pdf || isRawLatin1Zip) {
      console.log('[copyCvToApplicant] detected RAW Latin-1 binary string');
      byteArray = new Uint8Array(cvBytesString.length);
      for (let i = 0; i < cvBytesString.length; i++) byteArray[i] = cvBytesString.charCodeAt(i) & 0xff;
    } else {
      console.log('[copyCvToApplicant] decoding as base64');
      try {
        const binaryString = atob(cvBytesString);
        byteArray = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) byteArray[i] = binaryString.charCodeAt(i);
      } catch (decodeErr) {
        console.error('[copyCvToApplicant] base64 decode failed, falling back to raw bytes:', decodeErr);
        byteArray = new Uint8Array(cvBytesString.length);
        for (let i = 0; i < cvBytesString.length; i++) byteArray[i] = cvBytesString.charCodeAt(i) & 0xff;
      }
    }

    // Copy into a plain ArrayBuffer so the File constructor type-checks under
    // strict lib settings (Uint8Array's buffer is ArrayBufferLike which can be
    // SharedArrayBuffer; .slice() always returns ArrayBuffer).
    const plainAb = byteArray.buffer.slice(byteArray.byteOffset, byteArray.byteOffset + byteArray.byteLength) as ArrayBuffer;
    const file = new File([plainAb], cvFileName, { type: cvContentType });
    console.log('[copyCvToApplicant] built File for upload:', { size: file.size, name: file.name, type: file.type });

    // Reuse the typed-service upload path that the Replace flow uses successfully.
    const uploadResult = await Csp_opportunityapplicantsService.upload(
      applicantId, 'csp_document', file, cvFileName,
    ) as any;
    console.log('[copyCvToApplicant] upload result:', uploadResult);
    if (uploadResult?.success === false) {
      return { copied: false, reason: uploadResult?.error?.message || 'Upload service returned failure' };
    }
    return { copied: true };
  } catch (err: any) {
    console.error('[copyCvToApplicant] error:', err);
    return { copied: false, reason: err?.message || 'Unknown error' };
  }
}

// ─── Page Component ───────────────────────────────────────────────────
export default function OpportunitiesPage() {
  const { toast } = useToast();
  const confirm = useConfirm();

  // Data
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [candidates, setCandidates] = useState<OnboardingCandidate[]>([]);
  const [uoms, setUoms] = useState<UomOpt[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyOpt[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [statusTab, setStatusTab] = useState<OpportunityStatus | 'All'>('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Slide-over
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [form, setForm] = useState<any>({});
  const [activeTab, setActiveTab] = useState('details');
  const [applicants, setApplicants] = useState<OpportunityApplicant[]>([]);
  const [materials, setMaterials] = useState<OpportunityMaterial[]>([]);
  // Map of contactId → that contact's CV rows (used to display the fallback
  // filename on applicant cards when applicant.csp_document hasn't been overridden).
  const [contactCvIndex, setContactCvIndex] = useState<Record<string, (ContactCv & { contactId?: string })[]>>({});
  const [tabLoading, setTabLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // List-view expansion state + per-opp applicant index for inline subgrid + counts column.
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [applicantsByOpp, setApplicantsByOpp] = useState<Record<string, OpportunityApplicant[]>>({});

  // Dialogs
  const [wizardOpen, setWizardOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  // Dedicated state for the Send Profiles dialog so it can be invoked from
  // the list-page header WITHOUT also opening the slide-over behind it.
  const [sendProfilesOpp, setSendProfilesOpp] = useState<Opportunity | null>(null);
  const [sendProfilesApplicants, setSendProfilesApplicants] = useState<OpportunityApplicant[]>([]);

  // ── Mount: load everything ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [opps, accs, props, cons, cands, uomRecs, curs] = await Promise.all([
          fetchOpportunities(),
          fetchAccounts(),
          fetchProspects(),
          fetchContacts(),
          fetchCandidates(),
          fetchUnitsOfMeasure(),
          fetchCurrenciesList(),
        ]);
        setOpportunities(opps);
        // Eager-load all applicants in one query so the list view can render
        // "Candidates / Contacts" counts + the inline expand-row subgrid without
        // a per-row fetch round-trip.
        try {
          const allAps = await fetchOpportunityApplicants();
          const idx: Record<string, OpportunityApplicant[]> = {};
          for (const a of allAps) {
            if (!a.opportunityId) continue;
            if (!idx[a.opportunityId]) idx[a.opportunityId] = [];
            idx[a.opportunityId].push(a);
          }
          setApplicantsByOpp(idx);
        } catch (err) {
          console.error('[Opportunities] eager-load applicants failed:', err);
        }
        setAccounts(accs);
        setProspects(props);
        setContacts(cons);
        // Adapt CandidateRecord → minimal OnboardingCandidate-compatible shape
        setCandidates(cands.map(c => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          path: (c.path as any) || 'B2B seeking Contracts',
          candidateRole: c.candidateRole,
          cvFileName: c.cvFileName,
          hourlyRateEur: c.hourlyRateEur,
          b2bEntityName: c.b2bEntityName,
          selectedSlots: [],
          status: c.status as any,
          appliedDate: c.appliedDate,
        })));
        setUoms(uomRecs.map(u => ({ id: u.id, name: u.name })));
        setCurrencies(curs);
      } catch (err: any) {
        console.error('[Opportunities] load failed:', err);
        setError(err?.message || 'Failed to load opportunities');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Load children when an opp is selected ─────────────────────────
  // Wizard's onCreated hydrates state directly; this ref tells the effect
  // to skip the immediate re-fetch so the slide-over doesn't blink to (0).
  const skipChildFetchRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedOpp) {
      setApplicants([]);
      setMaterials([]);
      return;
    }
    // If the wizard just hydrated this opp's children, skip the network round-trip
    if (skipChildFetchRef.current === selectedOpp.id) {
      skipChildFetchRef.current = null;
      return;
    }
    // Clear stale data from the previous opp BEFORE fetching the new one
    setApplicants([]);
    setMaterials([]);
    setContactCvIndex({});
    setTabLoading(true);

    let cancelled = false;
    (async () => {
      try {
        const [aps, mats] = await Promise.all([
          fetchOpportunityApplicants(selectedOpp.id),
          fetchOpportunityMaterials(selectedOpp.id),
        ]);
        if (cancelled) return;
        setApplicants(aps);
        setMaterials(mats);
        // Build contact-CV index for fallback filename display.
        const contactIds = Array.from(new Set(aps.map(a => a.contactId).filter(Boolean) as string[]));
        if (contactIds.length > 0) {
          const results = await Promise.all(contactIds.map(cid =>
            fetchContactCvs(cid).then(cvs => [cid, cvs] as const).catch(() => [cid, [] as any] as const),
          ));
          if (cancelled) return;
          const idx: Record<string, (ContactCv & { contactId?: string })[]> = {};
          for (const [cid, cvs] of results) idx[cid] = cvs;
          setContactCvIndex(idx);
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error('[Opportunities] children load failed:', err);
        toast.error('Failed to load applicants/materials');
      } finally {
        if (!cancelled) setTabLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOpp?.id]);

  // ── Filtering ─────────────────────────────────────────────────────
  const filtered = useMemo(() => opportunities.filter(o => {
    if (statusTab !== 'All' && o.status !== statusTab) return false;
    if (statusFilter && o.status !== statusFilter) return false;
    if (sourceFilter && o.source !== sourceFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      // Include both raw + display-formatted opp # so users can search either
      const blob = `${o.opportunityNumber} ${formatOppNumber(o.opportunityNumber)} ${o.role} ${resolveClientName(o, accounts, prospects, contacts)}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  }), [opportunities, statusFilter, sourceFilter, searchTerm, statusTab, accounts, prospects, contacts]);

  const filteredIds = filtered.map(o => o.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (c: boolean) => setSelectedIds(c ? filteredIds : []);
  const toggleOne = (id: string, c: boolean) =>
    setSelectedIds(c ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = { All: opportunities.length };
    STATUSES.forEach(s => { m[s] = opportunities.filter(o => o.status === s).length; });
    return m;
  }, [opportunities]);

  // ── Slide-over open/close ─────────────────────────────────────────
  const openForm = (o: Opportunity) => {
    setSelectedOpp(o);
    setForm({ ...o });
    setActiveTab('details');
  };
  const closeForm = () => {
    setSelectedOpp(null);
    setForm({});
  };
  const updateField = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  // Closing date must be on/after start date (slide-over Details validation)
  const dateError = (() => {
    if (!form.startDate || !form.closingDate) return null;
    if (new Date(form.closingDate) < new Date(form.startDate)) {
      return 'Closing date must be on or after start date';
    }
    return null;
  })();

  // ── Save details (Opportunity) ────────────────────────────────────
  const saveForm = async () => {
    if (!selectedOpp || saving || dateError) return;
    setSaving(true);
    try {
      // Resolve lookups defensively so we never silently store NULL
      let rateUnitId: string;
      let currencyId: string;
      try {
        rateUnitId = resolveUomId(uoms, form.opportunityRateUnit);
        currencyId = resolveCurrencyId(currencies, form.opportunityCurrency);
      } catch (lookupErr: any) {
        toast.error(lookupErr.message);
        setSaving(false);
        return;
      }
      const payload = {
        source: form.source,
        clientLinkType: form.clientLinkType,
        accountId: form.accountId,
        prospectId: form.prospectId,
        sourceContactId: form.sourceContactId,
        freeClientName: form.freeClientName,
        role: form.role,
        opportunityRate: form.opportunityRate,
        opportunityRateUnit: form.opportunityRateUnit,
        opportunityCurrency: form.opportunityCurrency,
        rateUnitId,
        currencyId,
        startDate: form.startDate,
        closingDate: form.closingDate,
        status: form.status,
        details: form.details,
        outcomeComments: form.outcomeComments,
      };
      console.log('[OppPage] saveOpportunity (update) payload:', JSON.stringify(payload, null, 2));
      const savedId = await saveOpportunity(payload, selectedOpp.id);
      console.log('[OppPage] saveOpportunity response id:', savedId);
      // Refresh local list with edits
      const next = { ...selectedOpp, ...form } as Opportunity;
      setOpportunities(prev => prev.map(o => o.id === selectedOpp.id ? next : o));
      setSelectedOpp(next);
      toast.success('Opportunity saved');
    } catch (err: any) {
      console.error('[Opportunities] save failed:', err);
      toast.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteOpp = async () => {
    if (!selectedOpp) return;
    const ok = await confirm({ title: 'Delete opportunity', description: `Delete ${formatOppNumber(selectedOpp.opportunityNumber)}? This cannot be undone.` });
    if (!ok) return;
    try {
      await removeOpportunity(selectedOpp.id);
      setOpportunities(prev => prev.filter(o => o.id !== selectedOpp.id));
      toast.success('Opportunity deleted');
      closeForm();
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    }
  };

  // ── Send Profiles enable condition ────────────────────────────────
  const hasDraftedApplicants = applicants.some(a => a.status === 'Drafted');

  // ── Bulk: open send dialog when one opp selected from header ─────
  // IMPORTANT: do NOT touch selectedOpp/form here — the slide-over reacts to
  // selectedOpp and would render behind the dialog. Use dedicated dialog state.
  const openSendFromHeader = async () => {
    if (selectedIds.length !== 1) return;
    const o = opportunities.find(x => x.id === selectedIds[0]);
    if (!o) return;
    setSendProfilesOpp(o);
    try {
      const aps = await fetchOpportunityApplicants(o.id);
      setSendProfilesApplicants(aps);
      // Pre-load contact CVs so the dialog can show the fallback filename
      const contactIds = Array.from(new Set(aps.map(a => a.contactId).filter(Boolean) as string[]));
      if (contactIds.length > 0) {
        const results = await Promise.all(contactIds.map(cid =>
          fetchContactCvs(cid).then(cvs => [cid, cvs] as const).catch(() => [cid, [] as any] as const),
        ));
        setContactCvIndex(prev => {
          const next = { ...prev };
          for (const [cid, cvs] of results) next[cid] = cvs;
          return next;
        });
      }
    } catch (err) {
      console.error('[Opportunities] load applicants for header Send failed:', err);
      setSendProfilesApplicants([]);
    }
    setSendOpen(true);
  };

  // Slide-over Applicants tab → opens dialog using the already-loaded context.
  const openSendFromSlideOver = () => {
    if (!selectedOpp) return;
    setSendProfilesOpp(selectedOpp);
    setSendProfilesApplicants(applicants);
    setSendOpen(true);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <Spinner size="md" /> <span style={{ marginLeft: 8 }}>Loading opportunities…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Opportunities</h2>
        <p style={{ color: 'hsl(0 65% 35%)', marginTop: 8 }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="csp-opportunities-page">
      <style>{`
        /* Hide "Clear selection" affordance under SelectField/LookupField in the opp slide-over */
        .csp-opportunities-page .csp-form-field > button[type="button"] { display: none !important; }
      `}</style>
      <HeaderSelectionBar
        count={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        entityLabel="opportunities"
        onDelete={async () => {
          const count = selectedIds.length;
          const ok = await confirm({ title: 'Delete opportunities', description: `Delete ${count} selected opportunity(ies)?` });
          if (!ok) return;
          try {
            for (const id of selectedIds) await removeOpportunity(id);
            setOpportunities(prev => prev.filter(o => !selectedIds.includes(o.id)));
            toast.success(`${count} opportunity(ies) deleted`);
            setSelectedIds([]);
          } catch (err: any) { toast.error(err?.message || 'Delete failed'); }
        }}
      />

      <PageHeader
        title="Opportunities"
        subtitle={`${filtered.length} of ${opportunities.length} opportunities`}
        action={
          <div className="csp-flex-gap-2">
            <button
              className="csp-btn csp-btn-outline"
              disabled={selectedIds.length !== 1}
              onClick={openSendFromHeader}
              title={selectedIds.length === 1 ? 'Send profiles for the selected opportunity' : 'Select one opportunity to enable'}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Send className="csp-icon-inline" /> Send Profiles
            </button>
            <button className="csp-btn csp-btn-primary" onClick={() => setWizardOpen(true)}>
              <Plus className="csp-icon-inline" /> Add Opportunity
            </button>
          </div>
        }
      />

      {/* Filter pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search number, role, client..." />
          <SinglePill
            label="Status" value={statusFilter} onChange={setStatusFilter}
            options={STATUSES.map(s => ({ value: s, label: s, count: statusCounts[s] || 0 }))}
          />
          <SinglePill
            label="Source" value={sourceFilter} onChange={setSourceFilter}
            options={SOURCES.map(s => ({ value: s, label: s, count: opportunities.filter(o => o.source === s).length }))}
          />
        </div>
        {(searchTerm || statusFilter || sourceFilter) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('')} />}
            {sourceFilter && <FilterChip label={`Source: ${sourceFilter}`} onRemove={() => setSourceFilter('')} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm"
              onClick={() => { setSearchTerm(''); setStatusFilter(''); setSourceFilter(''); }}>Clear all</button>
          </div>
        )}
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid hsl(var(--border))' }}>
        {(['All' as const, ...STATUSES]).map(s => {
          const active = statusTab === s;
          const count = s === 'All' ? statusCounts.All : statusCounts[s];
          const dot = s === 'All' ? null : statusColors[s as OpportunityStatus];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusTab(s)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', fontSize: 13, fontWeight: active ? 600 : 500,
                background: 'transparent',
                color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                border: 'none',
                borderBottom: active ? '2px solid hsl(var(--primary))' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              {dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />}
              {s}
              <span style={{
                background: 'hsl(var(--muted) / 0.6)', padding: '0 6px',
                borderRadius: 9999, fontSize: 11, fontWeight: 500,
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="csp-table-wrapper">
        <table className="csp-table">
          <thead>
            <tr>
              <th className="csp-th-checkbox"><Checkbox checked={allSelected} onChange={toggleAll} /></th>
              <th style={{ width: 32 }}></th>
              <th>Opportunity #</th>
              <th>Role</th>
              <th>Name</th>
              <th>Source</th>
              <th>Candidates / Contacts</th>
              <th>Opp. Rate</th>
              <th>Margin</th>
              <th>Closing</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="csp-td-empty">
                  {opportunities.length === 0
                    ? 'No opportunities yet. Click + Add Opportunity to create one.'
                    : 'No opportunities match the current filters.'}
                </td>
              </tr>
            ) : filtered.map(o => {
              const clientName = resolveClientName(o, accounts, prospects, contacts);
              const rate = o.opportunityRate != null
                ? `${o.opportunityRate} ${o.opportunityCurrency || ''}/${(o.opportunityRateUnit || 'Hour').toLowerCase()}`.trim()
                : '—';
              const oppAps = applicantsByOpp[o.id] || [];
              const cCount = oppAps.filter(a => a.candidateId).length;
              const pCount = oppAps.filter(a => a.contactId).length;
              const firstAp = oppAps[0];
              const m = firstAp
                ? computeMargin(o.opportunityRate, (o.opportunityRateUnit || 'Hour') as RateUnit, firstAp.rate, (firstAp.rateUnit || 'Hour') as RateUnit)
                : null;
              const hasMargin = !!m && o.opportunityRate != null && firstAp?.rate != null;
              const isExpanded = expandedRows.has(o.id);
              return (
                <React.Fragment key={o.id}>
                <tr className="csp-tr-clickable" onClick={() => openForm(o)}>
                  <td className="csp-td-check" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.includes(o.id)} onChange={c => toggleOne(o.id, c)} />
                  </td>
                  <td onClick={e => { e.stopPropagation(); setExpandedRows(prev => { const n = new Set(prev); if (n.has(o.id)) n.delete(o.id); else n.add(o.id); return n; }); }} style={{ cursor: 'pointer', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }} title={isExpanded ? 'Collapse applicants' : 'Expand applicants'}>
                    {isExpanded ? '▾' : '▸'}
                  </td>
                  <td className="csp-td-mono">{formatOppNumber(o.opportunityNumber) || '—'}</td>
                  <td>{o.role || '—'}</td>
                  <td className="csp-td-bold">{clientName}</td>
                  <td style={{ fontSize: 12 }}>{o.source}</td>
                  <td style={{ fontSize: 12 }}>{cCount}c / {pCount}p</td>
                  <td style={{ fontSize: 13 }}>{rate}</td>
                  <td style={{ fontSize: 12 }}>
                    {hasMargin ? (
                      <div style={{ color: m!.hourlyMargin < 0 ? '#dc2626' : '#10b981', lineHeight: 1.3 }}>
                        <div>{m!.hourlyMargin.toFixed(2)} /h</div>
                        <div>{m!.dailyMargin.toFixed(2)} /d</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td>{o.closingDate ? formatDate(o.closingDate) : '—'}</td>
                  <td>{renderStatusBadge(o.status)}</td>
                </tr>
                {isExpanded && (
                  <tr style={{ background: 'hsl(var(--muted) / 0.3)' }}>
                    <td colSpan={11} style={{ padding: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
                        👥 Applicants ({oppAps.length})
                      </div>
                      {oppAps.length === 0 ? (
                        <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 13, padding: 8 }}>No applicants yet.</div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                          <thead>
                            <tr>
                              {['Full Name', 'Type', 'Rate', 'Unit', 'Currency', 'Margin', 'Status'].map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: 8, fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid hsl(var(--border))' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {oppAps.map(a => {
                              const apName = a.candidateId
                                ? (() => { const c = candidates.find(x => x.id === a.candidateId); return c ? `${c.firstName} ${c.lastName}` : a.candidateId; })()
                                : a.contactId
                                  ? (() => { const c = contacts.find(x => x.id === a.contactId); return c ? `${c.firstName} ${c.lastName}` : a.contactId; })()
                                  : '—';
                              const apMargin = computeMargin(o.opportunityRate, (o.opportunityRateUnit || 'Hour') as RateUnit, a.rate, (a.rateUnit || 'Hour') as RateUnit);
                              const apHasMargin = o.opportunityRate != null && a.rate != null;
                              return (
                                <tr key={a.id}>
                                  <td style={{ padding: 8, fontSize: 13 }}>{apName}</td>
                                  <td style={{ padding: 8, fontSize: 12 }}>
                                    <span style={{ background: 'hsl(var(--muted) / 0.6)', padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 500 }}>{a.candidateId ? 'Candidate' : 'Contact'}</span>
                                  </td>
                                  <td style={{ padding: 8, fontSize: 13 }}>{a.rate ?? '—'}</td>
                                  <td style={{ padding: 8, fontSize: 13 }}>{a.rateUnit || '—'}</td>
                                  <td style={{ padding: 8, fontSize: 13 }}>{a.rateCurrency || '—'}</td>
                                  <td style={{ padding: 8, fontSize: 12 }}>
                                    {apHasMargin ? (
                                      <span style={{ color: apMargin.hourlyMargin < 0 ? '#dc2626' : '#10b981' }}>
                                        {apMargin.hourlyMargin.toFixed(2)} /h · {apMargin.dailyMargin.toFixed(2)} /d
                                      </span>
                                    ) : '—'}
                                  </td>
                                  <td style={{ padding: 8 }}>{renderApplicantBadge(a.status)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Slide-over */}
      <Sheet open={!!selectedOpp} onClose={closeForm}>
        {selectedOpp && (
          <>
            <div className="csp-sheet-header">
              <div className="csp-sheet-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="csp-td-mono" style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>{formatOppNumber(selectedOpp.opportunityNumber)}</span>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{form.role || 'Opportunity'}</span>
                {form.status && renderStatusBadge(form.status as OpportunityStatus)}
              </div>
            </div>

            <Tabs
              tabs={[
                { id: 'details', label: 'Details' },
                { id: 'applicants', label: `Applicants (${applicants.length})` },
                { id: 'materials', label: `Materials (${materials.length})` },
                { id: 'outcome', label: 'Outcome' },
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
            >
              {/* Details */}
              {activeTab === 'details' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <TextField label="Opportunity #" value={formatOppNumber(form.opportunityNumber)} onChange={() => {}} readOnly />
                    <TextField label="Source" value={form.source || ''} onChange={() => {}} readOnly />
                  </div>

                  {/* Client section varies by source */}
                  {form.clientLinkType === 'Account' && (
                    <TextField label="Account" value={accounts.find(a => a.id === form.accountId)?.name || '—'} onChange={() => {}} readOnly />
                  )}
                  {form.clientLinkType === 'Prospect' && (
                    <TextField label="Prospect" value={prospects.find(p => p.id === form.prospectId)?.companyName || '—'} onChange={() => {}} readOnly />
                  )}
                  {form.clientLinkType === 'Free Text' && (
                    <TextField label="Client Name" value={form.freeClientName || ''} onChange={v => updateField('freeClientName', v)} />
                  )}
                  {form.clientLinkType === 'Contact' && (
                    <TextField
                      label="Referrer Contact"
                      value={(() => { const c = contacts.find(x => x.id === form.sourceContactId); return c ? `${c.firstName} ${c.lastName}` : '—'; })()}
                      onChange={() => {}} readOnly
                    />
                  )}

                  <TextField label="Role" value={form.role || ''} onChange={v => updateField('role', v)} />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <TextField label="Opportunity Rate" value={form.opportunityRate?.toString() || ''} onChange={v => updateField('opportunityRate', v ? Number(v) : undefined)} type="number" />
                    <div>
                      <label style={dateLabelStyle}>Rate Unit</label>
                      <Picker
                        value={form.opportunityRateUnit || 'Hour'}
                        onChange={v => updateField('opportunityRateUnit', v)}
                        options={RATE_UNITS.map(u => ({ value: u, label: `Per ${u}` }))}
                      />
                    </div>
                    <div>
                      <label style={dateLabelStyle}>Currency</label>
                      <Picker
                        value={normalizeCurrencyCode(currencies, form.opportunityCurrency)}
                        onChange={v => updateField('opportunityCurrency', v)}
                        options={currencies.map(c => ({ value: c.code, label: c.code }))}
                        placeholder="Pick currency…"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={dateLabelStyle}>Start Date</label>
                      <input type="date" value={form.startDate || ''} onChange={e => updateField('startDate', e.target.value)} style={dateInputStyle} />
                    </div>
                    <div>
                      <label style={dateLabelStyle}>Closing Date</label>
                      <input type="date" value={form.closingDate || ''} onChange={e => updateField('closingDate', e.target.value)} style={dateInputStyle} />
                    </div>
                    {dateError && (
                      <div style={{ gridColumn: '1 / -1', color: '#dc2626', fontSize: 12 }}>{dateError}</div>
                    )}
                  </div>

                  <div>
                    <label style={dateLabelStyle}>Status</label>
                    <Picker
                      value={form.status || 'New'}
                      onChange={v => updateField('status', v)}
                      options={STATUSES.map(s => ({ value: s, label: s }))}
                    />
                  </div>

                  <TextAreaField label="Opportunity Details" value={form.details || ''} onChange={v => updateField('details', v)} rows={4} />
                </div>
              )}

              {/* Applicants */}
              {activeTab === 'applicants' && (
                <ApplicantsTab
                  opportunity={selectedOpp}
                  applicants={applicants}
                  candidates={candidates}
                  contacts={contacts}
                  contactCvIndex={contactCvIndex}
                  uoms={uoms}
                  currencies={currencies}
                  tabLoading={tabLoading}
                  onChange={setApplicants}
                  onOpenSend={openSendFromSlideOver}
                  hasDraftedApplicants={hasDraftedApplicants}
                />
              )}

              {/* Materials */}
              {activeTab === 'materials' && (
                <MaterialsTab
                  opportunity={selectedOpp}
                  materials={materials}
                  tabLoading={tabLoading}
                  onChange={setMaterials}
                />
              )}

              {/* Outcome */}
              {activeTab === 'outcome' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 12, fontSize: 13, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px' }}>
                    <div style={smallLabel}>Client</div><div>{resolveClientName(selectedOpp, accounts, prospects, contacts)}</div>
                    <div style={smallLabel}>Role</div><div>{form.role || '—'}</div>
                    <div style={smallLabel}>Rate</div><div>{form.opportunityRate != null ? `${form.opportunityRate} ${form.opportunityCurrency || ''}/${(form.opportunityRateUnit || 'Hour').toLowerCase()}` : '—'}</div>
                    <div style={smallLabel}>Start → Close</div><div>{(form.startDate || '—')} → {(form.closingDate || '—')}</div>
                  </div>

                  <div>
                    <label style={dateLabelStyle}>Status</label>
                    <Picker
                      value={form.status || 'New'}
                      onChange={v => updateField('status', v)}
                      options={STATUSES.map(s => ({ value: s, label: s }))}
                    />
                  </div>
                  <TextAreaField label="Outcome Comments" value={form.outcomeComments || ''} onChange={v => updateField('outcomeComments', v)} rows={6}
                    placeholder="Capture why this was won/lost, feedback received, next steps…" />

                  {/* Per-applicant margin summary */}
                  {applicants.length > 0 && form.opportunityRate != null && (
                    <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 12 }}>
                      <div style={{ ...smallLabel, marginBottom: 8 }}>Per-applicant margin</div>
                      {applicants.map(a => {
                        const name = a.candidateId
                          ? (() => { const c = candidates.find(x => x.id === a.candidateId); return c ? `${c.firstName} ${c.lastName}` : a.candidateId!; })()
                          : (() => { const c = contacts.find(x => x.id === a.contactId); return c ? `${c.firstName} ${c.lastName}` : (a.contactId || '—'); })();
                        const m = computeMargin(form.opportunityRate, (form.opportunityRateUnit || 'Hour') as RateUnit, a.rate, (a.rateUnit || 'Hour') as RateUnit);
                        const valid = a.rate != null;
                        return (
                          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                            <span>{name} <span style={{ color: 'hsl(var(--muted-foreground))' }}>({a.candidateId ? 'Candidate' : 'Contact'})</span></span>
                            {valid ? (
                              <span style={{ color: m.hourlyMargin < 0 ? '#dc2626' : '#059669' }}>{m.hourlyMargin.toFixed(2)}/h · {m.dailyMargin.toFixed(2)}/d</span>
                            ) : <span style={{ color: 'hsl(var(--muted-foreground))' }}>—</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Tabs>

            <div className="csp-form-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="csp-btn csp-btn-outline" onClick={deleteOpp} style={{ color: '#dc2626' }}>
                <Trash2 className="csp-icon-inline" /> Delete
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="csp-btn csp-btn-outline" onClick={closeForm} disabled={saving}>Close</button>
                <button className={cn('csp-btn csp-btn-primary', saving && 'csp-btn-saving')} onClick={saveForm} disabled={saving || !!dateError} title={dateError || undefined}>
                  {saving ? <><Spinner size="sm" /> Saving…</> : 'Save'}
                </button>
              </div>
            </div>
          </>
        )}
      </Sheet>

      {/* Wizard */}
      <AddOpportunityWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={async (opp /* savedApplicants unused — slide-over stays closed */) => {
          setWizardOpen(false);
          // Re-fetch list + applicants index so the new opp shows correct
          // Candidates/Contacts counts and Margin in the list view.
          let created = opp;
          try {
            const all = await fetchOpportunities();
            setOpportunities(all);
            created = all.find(o => o.id === opp.id) || opp;
            try {
              const allAps = await fetchOpportunityApplicants();
              const idx: Record<string, OpportunityApplicant[]> = {};
              for (const a of allAps) {
                if (!a.opportunityId) continue;
                if (!idx[a.opportunityId]) idx[a.opportunityId] = [];
                idx[a.opportunityId].push(a);
              }
              setApplicantsByOpp(idx);
            } catch (err) {
              console.error('[Opportunities] refresh applicants index after create failed:', err);
            }
          } catch {
            setOpportunities(prev => [opp, ...prev]);
          }
          const display = formatOppNumber(created.opportunityNumber);
          toast.success(display ? `Opportunity ${display} created` : 'Opportunity created');
        }}
        accounts={accounts}
        prospects={prospects}
        contacts={contacts}
        candidates={candidates}
        uoms={uoms}
        currencies={currencies}
      />

      {/* Send dialog */}
      <SendOpportunityProfilesDialog
        open={sendOpen}
        onClose={() => {
          setSendOpen(false);
          setSendProfilesOpp(null);
          setSendProfilesApplicants([]);
        }}
        opportunity={sendProfilesOpp}
        applicants={sendProfilesApplicants}
        candidates={candidates}
        contacts={contacts}
        accounts={accounts}
        prospects={prospects}
        contactCvIndex={contactCvIndex}
        onSent={async () => {
          setSendOpen(false);
          const oppId = sendProfilesOpp?.id;
          if (!oppId) { setSendProfilesOpp(null); setSendProfilesApplicants([]); return; }
          try {
            const aps = await fetchOpportunityApplicants(oppId);
            // If the slide-over is open on the same opp, keep it in sync too.
            if (selectedOpp?.id === oppId) setApplicants(aps);
          } catch (err) {
            console.error('[Opportunities] refresh applicants after send failed:', err);
          }
          setSendProfilesOpp(null);
          setSendProfilesApplicants([]);
        }}
      />
    </div>
  );
}

// ─── Shared inline styles ─────────────────────────────────────────────
const smallLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
  color: 'hsl(var(--muted-foreground))',
};
const dateLabelStyle: React.CSSProperties = { ...smallLabel, marginBottom: 6, display: 'block' };
const dateInputStyle: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 10px', fontSize: 14,
  border: '1px solid hsl(var(--border))', borderRadius: 6, background: 'white',
  boxSizing: 'border-box',
};

// ═══════════════════════════════════════════════════════════════════════
// Applicants tab
// ═══════════════════════════════════════════════════════════════════════
interface ApplicantsTabProps {
  opportunity: Opportunity;
  applicants: OpportunityApplicant[];
  candidates: OnboardingCandidate[];
  contacts: Contact[];
  contactCvIndex: Record<string, (ContactCv & { contactId?: string })[]>;
  uoms: UomOpt[];
  currencies: CurrencyOpt[];
  tabLoading: boolean;
  onChange: (next: OpportunityApplicant[]) => void;
  onOpenSend: () => void;
  hasDraftedApplicants: boolean;
}

function ApplicantsTab({
  opportunity, applicants, candidates, contacts, contactCvIndex, uoms, currencies, tabLoading, onChange, onOpenSend, hasDraftedApplicants,
}: ApplicantsTabProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerKind, setPickerKind] = useState<'candidate' | 'contact'>('candidate');
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSaving, setPickerSaving] = useState(false);

  const usedCandidateIds = new Set(applicants.map(a => a.candidateId).filter(Boolean) as string[]);
  const usedContactIds = new Set(applicants.map(a => a.contactId).filter(Boolean) as string[]);

  const pickerOptions = useMemo(() => {
    if (pickerKind === 'candidate') {
      return candidates
        .filter(c => !usedCandidateIds.has(c.id))
        .filter(c => !pickerSearch || `${c.firstName} ${c.lastName} ${c.candidateRole || ''}`.toLowerCase().includes(pickerSearch.toLowerCase()))
        .map(c => ({ id: c.id, label: `${c.firstName} ${c.lastName}`, sub: c.candidateRole || '', defaultRate: c.hourlyRateEur }));
    }
    return contacts
      .filter(c => c.contactType === 'Consultant' && !usedContactIds.has(c.id))
      .filter(c => !pickerSearch || `${c.firstName} ${c.lastName} ${c.jobRole || ''}`.toLowerCase().includes(pickerSearch.toLowerCase()))
      .map(c => ({ id: c.id, label: `${c.firstName} ${c.lastName}`, sub: c.jobRole || '', defaultRate: undefined as number | undefined }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerKind, pickerSearch, candidates, contacts, applicants]);

  const addApplicant = async (pickedId: string, defaultRate?: number) => {
    setPickerSaving(true);
    try {
      // Resolve lookups defensively. Always default new applicants to EUR (ISO
      // code) — opportunity.opportunityCurrency may be a localised display
      // name like "leu românesc" in Romanian environments which doesn't match
      // any ISO code and would resolve to the wrong currency GUID.
      let rateUnitId: string;
      let currencyId: string;
      const inputCurrency = 'EUR';
      console.log('[ApplicantsTab] add applicant currency:', {
        defaultCurrency: inputCurrency,
        oppCurrencyRaw: opportunity.opportunityCurrency,
        availableCodes: currencies.map(c => c.code),
      });
      try {
        rateUnitId = resolveUomId(uoms, 'Hour');
        currencyId = resolveCurrencyId(currencies, inputCurrency);
      } catch (lookupErr: any) {
        toast.error(lookupErr.message);
        setPickerSaving(false);
        return;
      }
      const payload: any = {
        opportunityId: opportunity.id,
        rate: defaultRate,
        rateUnit: 'Hour',
        rateCurrency: 'EUR',
        rateUnitId,
        currencyId,
        status: 'Drafted',
      };
      if (pickerKind === 'candidate') payload.candidateId = pickedId;
      else payload.contactId = pickedId;
      console.log('[OppPage] saveOpportunityApplicant payload (add):', JSON.stringify(payload, null, 2));
      const newId = await saveOpportunityApplicant(payload);
      console.log('[OppPage] saveOpportunityApplicant response id:', newId);

      // Snapshot CV onto the applicant at apply time. Best-effort — if the
      // source has no CV, applicant is created without one and user can use
      // Replace later.
      if (newId) {
        console.log('[ApplicantsTab] applicant saved, now snapshotting CV');
        let cvCopyResult: { copied: boolean; reason?: string };
        if (pickerKind === 'candidate') {
          const cand = candidates.find(c => c.id === pickedId);
          cvCopyResult = await copyCvToApplicant({
            applicantId: newId,
            source: { kind: 'candidate', candidateId: pickedId, fileName: cand?.cvFileName },
          });
        } else {
          cvCopyResult = await copyCvToApplicant({
            applicantId: newId,
            source: { kind: 'contact', contactId: pickedId },
          });
        }
        if (cvCopyResult.copied) {
          console.log('[ApplicantsTab] CV snapshot successful');
        } else {
          console.warn('[ApplicantsTab] CV snapshot skipped:', cvCopyResult.reason);
          toast.error(`Applicant added without CV — ${cvCopyResult.reason}. Use Replace to upload one.`);
        }
      }

      const fresh = await fetchOpportunityApplicants(opportunity.id);
      onChange(fresh);
      toast.success('Applicant added');
      setPickerOpen(false);
      setPickerSearch('');
    } catch (err: any) {
      console.error('[Opp] add applicant failed:', err);
      toast.error(err?.message || 'Failed to add applicant');
    } finally {
      setPickerSaving(false);
    }
  };

  if (tabLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Spinner size="sm" /> <span style={{ marginLeft: 8 }}>Loading applicants…</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={smallLabel}>Applicants on this opportunity</span>
        <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => setPickerOpen(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus className="csp-icon-sm" /> Add Applicant
        </button>
      </div>

      {pickerOpen && (
        <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 12, background: 'hsl(var(--muted) / 0.2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['candidate', 'contact'] as const).map(k => (
              <button
                key={k}
                onClick={() => { setPickerKind(k); setPickerSearch(''); }}
                style={{
                  padding: '4px 12px', fontSize: 12, fontWeight: 500,
                  background: pickerKind === k ? 'hsl(var(--primary))' : 'white',
                  color: pickerKind === k ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--border))', borderRadius: 6, cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >{k}</button>
            ))}
          </div>
          <input
            type="text" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
            placeholder={`Search ${pickerKind}s…`} autoFocus
            style={{ ...dateInputStyle, height: 32 }}
          />
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid hsl(var(--border))', borderRadius: 6, background: 'white' }}>
            {pickerOptions.length === 0 && (
              <div style={{ padding: 12, fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>No matches.</div>
            )}
            {pickerOptions.map(o => (
              <button
                key={o.id}
                disabled={pickerSaving}
                onClick={() => addApplicant(o.id, o.defaultRate)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: 13, borderBottom: '1px solid hsl(var(--border))',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--muted) / 0.3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontWeight: 500 }}>{o.label}</div>
                {o.sub && <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}>{o.sub}</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {applicants.length === 0 ? (
        <p style={{ color: 'hsl(var(--muted-foreground))', textAlign: 'center', padding: 24, fontSize: 13 }}>
          No applicants yet. Click + Add Applicant to add candidates or consultants.
        </p>
      ) : applicants.map(a => (
        <ApplicantCard
          key={a.id}
          applicant={a}
          opportunity={opportunity}
          candidates={candidates}
          contacts={contacts}
          contactCvs={a.contactId ? (contactCvIndex[a.contactId] || []) : []}
          uoms={uoms}
          currencies={currencies}
          onChange={(next) => onChange(applicants.map(x => x.id === a.id ? next : x))}
          onDelete={async () => {
            const ok = await confirm({ title: 'Remove applicant', description: 'Remove this applicant from the opportunity?' });
            if (!ok) return;
            try {
              await removeOpportunityApplicant(a.id);
              onChange(applicants.filter(x => x.id !== a.id));
              toast.success('Applicant removed');
            } catch (err: any) { toast.error(err?.message || 'Remove failed'); }
          }}
        />
      ))}

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid hsl(var(--border))' }}>
        <button
          className="csp-btn csp-btn-primary"
          disabled={!hasDraftedApplicants}
          onClick={onOpenSend}
          title={hasDraftedApplicants ? 'Send Drafted applicants to client via Outlook' : 'Need at least one Drafted applicant'}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Send className="csp-icon-inline" /> Send Profiles via Outlook
        </button>
      </div>

    </div>
  );
}

// ─── Single applicant card ────────────────────────────────────────────
interface ApplicantCardProps {
  applicant: OpportunityApplicant;
  opportunity: Opportunity;
  candidates: OnboardingCandidate[];
  contacts: Contact[];
  contactCvs: (ContactCv & { contactId?: string })[];
  uoms: UomOpt[];
  currencies: CurrencyOpt[];
  onChange: (next: OpportunityApplicant) => void;
  onDelete: () => void;
}

function ApplicantCard({ applicant, opportunity, candidates, contacts, contactCvs, uoms, currencies, onChange, onDelete }: ApplicantCardProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingPatch, setSavingPatch] = useState(false);

  const candidate = applicant.candidateId ? candidates.find(c => c.id === applicant.candidateId) : null;
  const contact = applicant.contactId ? contacts.find(c => c.id === applicant.contactId) : null;
  const name = candidate ? `${candidate.firstName} ${candidate.lastName}`
    : contact ? `${contact.firstName} ${contact.lastName}` : applicant.id;
  const kind: 'Candidate' | 'Contact' = applicant.candidateId ? 'Candidate' : 'Contact';

  const margin = computeMargin(
    opportunity.opportunityRate, (opportunity.opportunityRateUnit || 'Hour') as RateUnit,
    applicant.rate, (applicant.rateUnit || 'Hour') as RateUnit,
  );
  const hasMargin = opportunity.opportunityRate != null && applicant.rate != null;

  const persistPatch = async (patch: Partial<OpportunityApplicant>) => {
    setSavingPatch(true);
    try {
      const effectiveUnit = patch.rateUnit || applicant.rateUnit;
      const effectiveCurrency = patch.rateCurrency || applicant.rateCurrency;
      const payload: any = { ...patch };
      // Only attach @odata.bind resolution when the patch touches that field
      // or when we have a known unit/currency on the current row.
      if (effectiveUnit) {
        try {
          payload.rateUnitId = resolveUomId(uoms, effectiveUnit);
        } catch (lookupErr: any) {
          toast.error(lookupErr.message);
          setSavingPatch(false);
          return;
        }
      }
      if (effectiveCurrency) {
        console.log('[ApplicantCard] resolving currency for patch:', {
          input: effectiveCurrency, expectedFormat: 'ISO code like EUR',
          availableCodes: currencies.map(c => c.code),
        });
        try {
          payload.currencyId = resolveCurrencyId(currencies, effectiveCurrency);
        } catch (lookupErr: any) {
          toast.error(lookupErr.message);
          setSavingPatch(false);
          return;
        }
      }
      console.log('[OppPage] applicant patch payload:', JSON.stringify(payload, null, 2));
      const savedId = await saveOpportunityApplicant(payload, applicant.id);
      console.log('[OppPage] applicant patch response id:', savedId);
      onChange({ ...applicant, ...patch });
    } catch (err: any) {
      console.error('[Opp] patch applicant failed:', err);
      toast.error(err?.message || 'Save failed');
    } finally {
      setSavingPatch(false);
    }
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    console.log('[Replace] start', { applicantId: applicant.id, fileName: file.name, fileSize: file.size, fileType: file.type });
    setUploading(true);
    try {
      // 1. Read file as ArrayBuffer
      const arrayBuf = await file.arrayBuffer();
      console.log('[Replace] file read, bytes:', arrayBuf.byteLength);

      // 2. Convert to base64 (chunked to avoid stack overflow on large files)
      const bytes = new Uint8Array(arrayBuf);
      let binary = '';
      const chunkSize = 0x8000; // 32KB
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
      }
      const base64 = btoa(binary);
      console.log('[Replace] base64 length:', base64.length, 'first40:', base64.substring(0, 40));

      // 3. Validate base64 before sending
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
        throw new Error('Encoded base64 is not valid — encoding failed');
      }

      // 4. Detect content type — fall back to extension when file.type is empty
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const extMime: Record<string, string> = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
      const contentType = file.type || extMime[ext] || 'application/octet-stream';

      // 5. Sanitise filename — strip JSON-breaking chars (quotes, backslashes,
      // tabs, CR/LF) that have caused 400 "Invalid JSON" from the connector.
      const safeFileName = file.name.replace(/["\\\r\n\t]/g, '').substring(0, 200) || 'file';
      if (safeFileName !== file.name) {
        console.log('[Replace] sanitised filename:', { original: file.name, safe: safeFileName });
      }

      // 6. Upload to Dataverse
      console.log('[Replace] calling Update...', { entitySet: 'csp_opportunityapplicants', applicantId: applicant.id, column: 'csp_document', fileName: safeFileName, contentType });

      // ═══════════════════════════════════════════════════════════════
      // DIAGNOSTIC — PRE-SDK call: dump everything we're about to send
      // ═══════════════════════════════════════════════════════════════
      const _orgUrl = getOrgUrl();
      const _entitySet = 'csp_opportunityapplicants';
      const _fieldName = 'csp_document';
      const _recordId = applicant.id;
      console.log('═══════════ [Replace] PRE-SDK call ═══════════');
      console.log('  orgUrl:', _orgUrl);
      console.log('  entitySet:', _entitySet);
      console.log('  recordId:', _recordId);
      console.log('  fieldName:', _fieldName);
      console.log('  contentType:', contentType);
      console.log('  safeFileName:', safeFileName);
      console.log('  base64.length:', base64.length);
      console.log('  base64.starts:', base64.substring(0, 60));
      console.log('  base64.ends:', base64.substring(base64.length - 30));
      console.log('  base64 has data: prefix?', base64.startsWith('data:'));
      console.log('  base64 has padding?', base64.endsWith('=') || base64.endsWith('=='));
      console.log('═══════════════════════════════════════════════');

      let result: any;
      try {
        // Microsoft's UpdateEntityFileImageFieldContentWithOrganization wraps
        // the payload incorrectly for file fields → connector returns 400
        // "Invalid JSON" (error code 0x80048d19). Use the generated typed
        // service instead, which routes through client.uploadFileToRecord
        // (the Microsoft-recommended pattern from PowerAppsCodeApps samples).
        console.log('[Replace] using generated typed service Csp_opportunityapplicantsService.upload');
        result = await Csp_opportunityapplicantsService.upload(
          applicant.id,
          'csp_document',
          file,
          safeFileName,
        );
        console.log('[Replace] generated service result:', result);
      } catch (sdkErr: any) {
        // ═══════════════════════════════════════════════════════════════
        // DIAGNOSTIC — SDK threw: dump full error shape
        // ═══════════════════════════════════════════════════════════════
        console.error('═══════════ [Replace] SDK THREW ═══════════');
        console.error('  err.name:', sdkErr?.name);
        console.error('  err.message:', sdkErr?.message);
        console.error('  err.code:', sdkErr?.code);
        console.error('  err.status:', sdkErr?.status);
        console.error('  err.response:', sdkErr?.response);
        console.error('  err.data:', sdkErr?.data);
        console.error('  err full:', sdkErr);
        console.error('  err keys:', sdkErr && Object.keys(sdkErr));
        try {
          console.error('  err JSON:', JSON.stringify(sdkErr, Object.getOwnPropertyNames(sdkErr || {})));
        } catch (_) { /* circular */ }
        console.error('═════════════════════════════════════════');
        throw sdkErr;
      }

      // ═══════════════════════════════════════════════════════════════
      // DIAGNOSTIC — POST-SDK call: dump result shape
      // ═══════════════════════════════════════════════════════════════
      console.log('═══════════ [Replace] POST-SDK ═══════════');
      console.log('  result type:', typeof result);
      console.log('  result:', result);
      console.log('  result.success:', result?.success);
      console.log('  result.error:', result?.error);
      console.log('  result keys:', result && typeof result === 'object' ? Object.keys(result) : 'n/a');
      console.log('═════════════════════════════════════════');

      console.log('[Replace] upload result:', result);
      if (result?.success === false || result?.error) {
        throw new Error(`Upload failed: ${result?.error?.message || JSON.stringify(result?.error || result)}`);
      }
      console.log('[Replace] ✅ upload succeeded');

      // 5. Re-fetch this applicant from Dataverse so documentFileName comes
      // from the server, not optimistic UI. Verifies the upload actually stuck.
      const fresh = await fetchOpportunityApplicants(opportunity.id);
      const updated = fresh.find(a => a.id === applicant.id);
      console.log('[Replace] applicant after refresh:', { id: updated?.id, documentFileName: updated?.documentFileName });
      if (!updated?.documentFileName) {
        console.warn('[Replace] ⚠ Server returned applicant without documentFileName — upload may have failed silently');
        toast.error('CV replace may not have saved correctly. Please verify in MDA and retry.');
        return;
      }
      onChange(updated);
      toast.success(`CV replaced: ${updated.documentFileName}`);
    } catch (err: any) {
      console.error('[Replace] FAILED:', err);
      toast.error(`Failed to replace CV: ${err?.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Displayed CV name: applicant override → candidate.csp_candidatecv → contact's primary csp_contactcv
  const sourceCvFileName = applicant.candidateId
    ? candidate?.cvFileName
    : applicant.contactId
      ? (contactCvs.find(c => c.isPrimary) || contactCvs[0])?.fileName
      : undefined;
  const displayedCvFileName = applicant.documentFileName || sourceCvFileName || '';
  const cvIsOverride = !!applicant.documentFileName;

  const handleDownload = () => {
    let url: string;
    if (cvIsOverride) {
      url = `${getOrgUrl()}/api/data/v9.2/csp_opportunityapplicants(${applicant.id})/csp_document/$value`;
    } else if (applicant.candidateId) {
      url = `${getOrgUrl()}/api/data/v9.2/csp_candidates(${applicant.candidateId})/csp_candidatecv/$value`;
    } else if (applicant.contactId) {
      const sourceCv = contactCvs.find(c => c.isPrimary) || contactCvs[0];
      if (!sourceCv) { toast.error('No CV available for this contact'); return; }
      url = `${getOrgUrl()}/api/data/v9.2/csp_contactcvs(${sourceCv.id})/csp_document/$value`;
    } else {
      toast.error('No CV to download');
      return;
    }
    window.open(url, '_blank');
  };

  return (
    <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', rowGap: 4 }}>
          <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 14 }}>📄</span>
          <span style={{ fontWeight: 600 }}>{name}</span>
          <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>· {kind}</span>
          {applicant.rate != null && (
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>
              Rate <strong style={{ color: 'hsl(var(--foreground))' }}>{((applicant.rateUnit || 'Hour') === 'Hour' ? applicant.rate : applicant.rate / 8).toFixed(2)}</strong>/h · <strong style={{ color: 'hsl(var(--foreground))' }}>{((applicant.rateUnit || 'Hour') === 'Day' ? applicant.rate : applicant.rate * 8).toFixed(2)}</strong>/d
            </span>
          )}
          {hasMargin && (
            <span style={{ fontSize: 11, color: margin.hourlyMargin < 0 ? '#dc2626' : '#059669', whiteSpace: 'nowrap' }}>
              Margin {margin.hourlyMargin.toFixed(2)}/h · {margin.dailyMargin.toFixed(2)}/d
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {renderApplicantBadge(applicant.status)}
          <button
            type="button" onClick={onDelete}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#dc2626' }}
            aria-label="Delete applicant"
          ><Trash2 className="csp-icon-sm" /></button>
        </div>
      </div>

      {/* Rate / Unit / Currency / Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
        <div>
          <label style={dateLabelStyle}>Rate</label>
          <input
            type="number" style={dateInputStyle} disabled={savingPatch}
            value={applicant.rate ?? ''}
            onChange={e => onChange({ ...applicant, rate: e.target.value ? Number(e.target.value) : undefined })}
            onBlur={e => persistPatch({ rate: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div>
          <label style={dateLabelStyle}>Unit</label>
          <Picker
            value={applicant.rateUnit || 'Hour'}
            onChange={v => { onChange({ ...applicant, rateUnit: v }); persistPatch({ rateUnit: v }); }}
            options={RATE_UNITS.map(u => ({ value: u, label: `Per ${u}` }))}
          />
        </div>
        <div>
          <label style={dateLabelStyle}>Currency</label>
          <Picker
            value={normalizeCurrencyCode(currencies, applicant.rateCurrency || opportunity.opportunityCurrency)}
            onChange={v => { onChange({ ...applicant, rateCurrency: v }); persistPatch({ rateCurrency: v }); }}
            options={currencies.map(c => ({ value: c.code, label: c.code }))}
            placeholder="—"
          />
        </div>
        <div>
          <label style={dateLabelStyle}>Status</label>
          <Picker
            value={applicant.status}
            onChange={v => { const next = v as ApplicantStatus; onChange({ ...applicant, status: next }); persistPatch({ status: next }); }}
            options={APPLICANT_STATUSES.map(s => ({ value: s, label: s }))}
          />
        </div>
      </div>

      {/* CV — reference model with optional applicant-level override */}
      <div>
        <label style={dateLabelStyle}>CV to apply with</label>
        <input
          ref={fileRef} type="file" accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
          style={{ display: 'none' }}
          onChange={e => handleUpload(e.target.files?.[0] || null)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid hsl(var(--border))', borderRadius: 6, background: 'white' }}>
          <FileText className="csp-icon-sm" />
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayedCvFileName || <span style={{ color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>No CV on file</span>}
          </span>
          {cvIsOverride && (
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: 'hsl(38 92% 92%)', color: 'hsl(38 75% 30%)', fontWeight: 600 }}>OVERRIDE</span>
          )}
          {displayedCvFileName && (
            <button type="button" className="csp-btn csp-btn-outline csp-btn-sm" onClick={handleDownload}>Download</button>
          )}
          <button type="button" className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Replace'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Materials tab
// ═══════════════════════════════════════════════════════════════════════
interface MaterialsTabProps {
  opportunity: Opportunity;
  materials: OpportunityMaterial[];
  tabLoading: boolean;
  onChange: (next: OpportunityMaterial[]) => void;
}

function MaterialsTab({ opportunity, materials, tabLoading, onChange }: MaterialsTabProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<{ fileName: string; sharedDate: string; description: string; file?: File | null }>({
    fileName: '', sharedDate: new Date().toISOString().substring(0, 10), description: '', file: null,
  });
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!draft.fileName.trim()) { toast.error('File name required'); return; }
    setAdding(true);
    try {
      const newId = await saveOpportunityMaterial({
        opportunityId: opportunity.id,
        fileName: draft.fileName.trim(),
        sharedDate: draft.sharedDate || undefined,
        description: draft.description || undefined,
      });
      // Upload file if provided
      if (draft.file) {
        try {
          const arrayBuf = await draft.file.arrayBuffer();
          let binary = '';
          const bytes = new Uint8Array(arrayBuf);
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          await MicrosoftDataverseService.UpdateEntityFileImageFieldContentWithOrganization(
            draft.file.type || 'application/octet-stream', getOrgUrl(),
            'csp_opportunitymaterials', newId, 'csp_document', base64, draft.file.name,
          );
        } catch (err) {
          console.error('[Opp] material upload failed:', err);
          toast.error('Material saved but file upload failed');
        }
      }
      const fresh = await fetchOpportunityMaterials(opportunity.id);
      onChange(fresh);
      setDraft({ fileName: '', sharedDate: new Date().toISOString().substring(0, 10), description: '', file: null });
      if (fileRef.current) fileRef.current.value = '';
      toast.success('Material added');
    } catch (err: any) {
      console.error('[Opp] add material failed:', err);
      toast.error(err?.message || 'Add failed');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (m: OpportunityMaterial) => {
    const ok = await confirm({ title: 'Delete material', description: `Delete "${m.fileName}"?` });
    if (!ok) return;
    try {
      await removeOpportunityMaterial(m.id);
      onChange(materials.filter(x => x.id !== m.id));
      toast.success('Material deleted');
    } catch (err: any) { toast.error(err?.message || 'Delete failed'); }
  };

  const handleDownload = (m: OpportunityMaterial) => {
    const url = `${getOrgUrl()}/api/data/v9.2/csp_opportunitymaterials(${m.id})/csp_document/$value`;
    window.open(url, '_blank');
  };

  if (tabLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Spinner size="sm" /> <span style={{ marginLeft: 8 }}>Loading materials…</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Add form */}
      <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 12, background: 'hsl(var(--muted) / 0.2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Add a new material</span>
          <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>One file per material</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <TextField label="File Name" value={draft.fileName} onChange={v => setDraft({ ...draft, fileName: v })} placeholder="e.g. Capability_Deck.pdf" />
          <div>
            <label style={dateLabelStyle}>Shared Date</label>
            <input type="date" value={draft.sharedDate} onChange={e => setDraft({ ...draft, sharedDate: e.target.value })} style={dateInputStyle} />
          </div>
        </div>
        <TextField label="Description" value={draft.description} onChange={v => setDraft({ ...draft, description: v })} />
        <div>
          <label style={dateLabelStyle}>Document</label>
          <input
            ref={fileRef} type="file"
            onChange={e => {
              const f = e.target.files?.[0] || null;
              setDraft(d => ({ ...d, file: f, fileName: d.fileName || (f?.name || '') }));
            }}
            style={{ fontSize: 12 }}
          />
          {draft.file && (
            <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
              Attached: {draft.file.name} · {(draft.file.size / 1024).toFixed(1)} KB
            </p>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => {
            setDraft({ fileName: '', sharedDate: new Date().toISOString().substring(0, 10), description: '', file: null });
            if (fileRef.current) fileRef.current.value = '';
          }}>Clear</button>
          <button className="csp-btn csp-btn-primary csp-btn-sm" disabled={adding || !draft.fileName.trim()} onClick={handleAdd}>
            <Plus className="csp-icon-sm" /> {adding ? 'Adding…' : 'Add material'}
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={smallLabel}>Shared materials ({materials.length})</span>
        {materials.length === 0 && (
          <p style={{ color: 'hsl(var(--muted-foreground))', textAlign: 'center', padding: 24, fontSize: 13 }}>
            No materials shared yet.
          </p>
        )}
        {materials.map(m => (
          <div key={m.id} style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText className="csp-icon-sm" />
                <span style={{ fontWeight: 500, fontSize: 14 }}>{m.fileName || '—'}</span>
                {m.documentFileName && <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>· {m.documentFileName}</span>}
              </div>
              {m.description && <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', margin: '4px 0 0' }}>{m.description}</p>}
              {m.sharedDate && <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', margin: '4px 0 0' }}>Shared {formatDate(m.sharedDate)}</p>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {m.documentFileName && (
                <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => handleDownload(m)}>Download</button>
              )}
              <button
                type="button" onClick={() => handleDelete(m)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#dc2626' }}
                aria-label="Delete material"
              ><Trash2 className="csp-icon-sm" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
