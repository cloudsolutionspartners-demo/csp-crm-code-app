import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge, Spinner, PageLoading } from '../components/Shared';
import { Sheet, Tabs, ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, SelectField, TextAreaField, EmailField, LookupField } from '../components/FormFields';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover, DateRangeFilterPopover,
  ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getNumberFilter, getDateFilter,
  setTextFilter, setMultiFilter, setNumberFilter, setDateFilter, matchDateRange,
} from '../components/ColumnFilters';
import { SearchPill, SinglePill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, type RelativeDateValue } from '../components/FilterPills';
import { Plus } from '../components/Icons';
import { cn, formatDate } from '../lib/utils';
import { fetchCandidates, saveCandidate } from '../services/candidateService';
import { Csp_candidatesService } from '../generated/services/Csp_candidatesService';
import { getOrgUrl } from '../services/dataverseService';
import type { CandidateRecord } from '../services/candidateService';
import { fetchContacts } from '../services/contactService';
import { listRecords, createRecord, updateRecord } from '../services/dataverseService';
import { useDataverse } from '../services/useDataverse';
import { onboardingCandidates as mockCandidates, contacts as mockContacts } from '../data/mock-data';

/* ── Constants ───────────────────────────────────────────────── */

const statusOptions = ['Applied', 'Scheduled', 'Fit', 'Not Fit'] as const;
const candidateSources = ['Website', 'Recruiter', 'Referral'] as const;
const pathOptions = ['B2B seeking Contracts', 'CIM to B2B'] as const;
const currencyOptions = ['EUR', 'USD', 'GBP', 'RON'] as const;

const statusRowColors: Record<string, string> = {
  Applied: '',
  Scheduled: 'csp-row-amber',
  Fit: 'csp-row-green',
  'Not Fit': 'csp-row-red',
};

const statusDotColors: Record<string, string> = {
  Applied: 'csp-dot-gray',
  Scheduled: 'csp-dot-amber',
  Fit: 'csp-dot-green',
  'Not Fit': 'csp-dot-red',
};

/* ── Local row type (compatible with CandidateRecord) ────────── */

interface CandidateRow {
  id: string;
  candidateIdNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  path: string;
  candidateRole: string;
  cvFileName: string;
  hourlyRateEur: number;
  b2bEntityName: string;
  aiDecision: string;
  aiSummary: string;
  aiSuggestedRate: number;
  currencyCode: string;
  status: string;
  appliedDate: string;
  source: string;
}

function mapRecord(r: CandidateRecord): CandidateRow {
  return { ...r };
}

function mapMock(m: any): CandidateRow {
  return {
    id: m.id,
    candidateIdNumber: m.candidateIdNumber || m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    email: m.email,
    phone: m.phone || '',
    path: m.path || 'B2B seeking Contracts',
    candidateRole: m.candidateRole || '',
    cvFileName: m.cvFileName || '',
    hourlyRateEur: m.hourlyRateEur ?? 0,
    b2bEntityName: m.b2bEntityName || '',
    aiDecision: m.aiDecision || '',
    aiSummary: m.aiSummary || '',
    aiSuggestedRate: m.aiSuggestedRate ?? 0,
    currencyCode: m.currencyCode || 'EUR',
    status: m.status || 'Applied',
    appliedDate: m.appliedDate || '',
    source: m.source || 'Website',
  };
}

/* ── Sheet form tabs ─────────────────────────────────────────── */

const formTabs = [
  { id: 'general', label: 'General' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'review', label: 'Review' },
];

/* ── Page Component ──────────────────────────────────────────── */

import { useConfirm } from '../components/ConfirmDialog';
import { SendCandidateProfilesDialog } from '../components/candidate/SendCandidateProfilesDialog';
import { RaiseOpportunityForm } from '../components/opportunity/RaiseOpportunityForm';
import { fetchAccounts } from '../services/accountService';
import { fetchProspects } from '../services/prospectService';
import { fetchUnitsOfMeasure } from '../services/unitOfMeasureService';
import { listRecords as listRec } from '../services/dataverseService';
import type { Account, Prospect } from '../types/crm';

export default function CandidatesPage() {
  const { toast } = useToast();
  const confirm = useConfirm();

  // Dataverse fetch with mock fallback
  const { data: rawCandidates, loading, refetch, isLive } = useDataverse(fetchCandidates, mockCandidates as any[]);
  const { data: rawContacts } = useDataverse(fetchContacts, mockContacts as any[]);

  const candidates: CandidateRow[] = useMemo(
    () => rawCandidates.map(r => (isLive ? mapRecord(r as CandidateRecord) : mapMock(r))),
    [rawCandidates, isLive],
  );

  // Interviewer options for the Scheduling tab lookup
  const interviewerOptions = useMemo(
    () => rawContacts
      .filter((c: any) => c.isInterviewer)
      .map((c: any) => ({
        value: c.id,
        label: `${c.firstName} ${c.lastName}`,
        sublabel: c.company || '',
      })),
    [rawContacts],
  );

  const getInterviewerName = (interviewerId?: string) => {
    if (!interviewerId) return 'Unassigned';
    const c = rawContacts.find((con: any) => con.id === interviewerId);
    return c ? `${(c as any).firstName} ${(c as any).lastName}` : interviewerId;
  };

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [pathFilter, setPathFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedDateFilter, setAppliedDateFilter] = useState<RelativeDateValue>({ type: 'all' });
  const [colFilters, setColFilters] = useState<ColumnFilters>({});

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Sheet / form state
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [emailError, setEmailError] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const cvFileRef = React.useRef<HTMLInputElement>(null);
  const [sendProfilesOpen, setSendProfilesOpen] = useState(false);
  const [raiseOppOpen, setRaiseOppOpen] = useState(false);
  const [oppAccounts, setOppAccounts] = useState<Account[]>([]);
  const [oppProspects, setOppProspects] = useState<Prospect[]>([]);
  const [oppUoms, setOppUoms] = useState<{ id: string; name: string }[]>([]);
  const [oppCurrencies, setOppCurrencies] = useState<{ id: string; code: string }[]>([]);
  // Load opportunity-related reference data once
  React.useEffect(() => {
    (async () => {
      try {
        const [accs, props, uomRecs, curRecs] = await Promise.all([
          fetchAccounts(),
          fetchProspects(),
          fetchUnitsOfMeasure(),
          listRec('transactioncurrencies', 'transactioncurrencyid,isocurrencycode,currencyname', undefined, 'isocurrencycode asc'),
        ]);
        setOppAccounts(accs);
        setOppProspects(props);
        setOppUoms(uomRecs.map(u => ({ id: u.id, name: u.name })));
        setOppCurrencies(curRecs
          .map(r => ({ id: String(r.transactioncurrencyid).replace(/[{}]/g, ''), code: (r.isocurrencycode || '').toUpperCase(), name: r.currencyname || '' }))
          .filter(c => !!c.code));
      } catch (err) {
        console.error('[CandidatesPage] failed to load opp reference data:', err);
      }
    })();
  }, []);

  /* ── Counts ──────────────────────────────────────────────── */

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    statusOptions.forEach(s => { counts[s] = candidates.filter(c => c.status === s).length; });
    return counts;
  }, [candidates]);

  const pathCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    pathOptions.forEach(p => { counts[p] = candidates.filter(c => c.path === p).length; });
    return counts;
  }, [candidates]);

  /* ── Filtering ───────────────────────────────────────────── */

  const filtered = useMemo(() => {
    return candidates.filter(c => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (pathFilter && c.path !== pathFilter) return false;
      if (sourceFilter && (c.source || '') !== sourceFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const m = `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.b2bEntityName || '').toLowerCase().includes(q);
        if (!m) return false;
      }
      if (appliedDateFilter.type !== 'all') {
        const r = dateRangeFor(appliedDateFilter);
        if (!matchDateRange(c.appliedDate, r.from, r.to)) return false;
      }

      const idNum = getTextFilter(colFilters, 'idNumber');
      if (idNum && !c.candidateIdNumber.toLowerCase().includes(idNum.toLowerCase())) return false;

      const name = getTextFilter(colFilters, 'name');
      if (name && !`${c.firstName} ${c.lastName}`.toLowerCase().includes(name.toLowerCase())) return false;

      const role = getTextFilter(colFilters, 'role');
      if (role && !(c.candidateRole || '').toLowerCase().includes(role.toLowerCase())) return false;

      const email = getTextFilter(colFilters, 'email');
      if (email && !c.email.toLowerCase().includes(email.toLowerCase())) return false;

      const pathCol = getMultiFilter(colFilters, 'path');
      if (pathCol.length > 0 && !pathCol.includes(c.path)) return false;

      const sourceCol = getMultiFilter(colFilters, 'source');
      if (sourceCol.length > 0 && !sourceCol.includes(c.source || '')) return false;

      const rate = getNumberFilter(colFilters, 'rate');
      if (rate.min && c.hourlyRateEur < Number(rate.min)) return false;
      if (rate.max && c.hourlyRateEur > Number(rate.max)) return false;

      const dateF = getDateFilter(colFilters, 'appliedDate');
      if (!matchDateRange(c.appliedDate, dateF.from, dateF.to)) return false;

      const entity = getTextFilter(colFilters, 'b2bEntity');
      if (entity && !(c.b2bEntityName || '').toLowerCase().includes(entity.toLowerCase())) return false;

      return true;
    });
  }, [candidates, statusFilter, pathFilter, sourceFilter, searchTerm, appliedDateFilter, colFilters]);

  const hasActiveFilters = !!searchTerm || !!statusFilter || !!pathFilter || !!sourceFilter || appliedDateFilter.type !== 'all';

  /* ── Selection helpers ───────────────────────────────────── */

  const filteredIds = filtered.map(c => c.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) =>
    setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  /* ── Form helpers ────────────────────────────────────────── */

  const fetchCandidateSlots = async (candidateId: string) => {
    try {
      const records = await listRecords(
        'csp_availabilityslotses',
        'csp_availabilityslotsid,_csp_interviewer_value,csp_daytime,csp_teamslink,statuscode',
        `_csp_candidate_value eq ${candidateId} and statecode eq 0`,
      );
      const activeSlot = records.find((s: any) =>
        s.statuscode === 1 || s.statuscode === 725070001,
      );
      if (!activeSlot) return;
      const interviewerId = String(activeSlot._csp_interviewer_value || '').replace(/[{}]/g, '').toLowerCase();
      setFormData(prev => ({
        ...prev,
        confirmedSlotId: interviewerId,
        _slotId: activeSlot.csp_availabilityslotsid,
        _slotDatetime: activeSlot.csp_daytime || '',
        _slotTeamsLink: activeSlot.csp_teamslink || '',
        _slotStatus: activeSlot.statuscode,
        _slotInterviewerName: activeSlot['_csp_interviewer_value@OData.Community.Display.V1.FormattedValue'] || '',
      }));
    } catch (err) {
      console.error('[Candidate] Failed to fetch slots:', err);
    }
  };

  const openForm = (candidate: CandidateRow) => {
    setIsNew(false);
    setSelectedCandidate(candidate);
    setActiveTab('general');
    setFormData({
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      path: candidate.path,
      candidateRole: candidate.candidateRole || '',
      cvFileName: candidate.cvFileName || '',
      hourlyRateEur: candidate.hourlyRateEur,
      b2bEntityName: candidate.b2bEntityName,
      currencyCode: candidate.currencyCode || 'EUR',
      status: candidate.status,
      source: candidate.source || 'Website',
      // AI fields (read-only)
      aiDecision: candidate.aiDecision,
      aiSummary: candidate.aiSummary,
      aiSuggestedRate: candidate.aiSuggestedRate,
      // Scheduling fields — populated from Dataverse below
      confirmedSlotId: '',
      _slotId: '',
      _slotDatetime: '',
      _slotTeamsLink: '',
      _slotStatus: undefined,
      _slotInterviewerName: '',
      // Review fields
      reviewedBy: '',
      reviewerNotes: '',
    });
    setCvFile(null);
    if (cvFileRef.current) cvFileRef.current.value = '';
    fetchCandidateSlots(candidate.id);
  };

  const openNewForm = () => {
    setIsNew(true);
    setSelectedCandidate({} as CandidateRow);
    setActiveTab('general');
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      path: 'B2B seeking Contracts',
      candidateRole: '',
      cvFileName: '',
      hourlyRateEur: '',
      b2bEntityName: '',
      currencyCode: 'EUR',
      status: 'Applied',
      source: 'Website',
      appliedDate: new Date().toISOString().substring(0, 10),
      aiDecision: '',
      aiSummary: '',
      aiSuggestedRate: 0,
      confirmedSlotId: '',
      _slotId: '',
      _slotDatetime: '',
      _slotTeamsLink: '',
      _slotStatus: undefined,
      _slotInterviewerName: '',
      reviewedBy: '',
      reviewerNotes: '',
    });
    setCvFile(null);
    if (cvFileRef.current) cvFileRef.current.value = '';
  };

  const handleAssignInterviewer = async (interviewerId: string) => {
    updateField('confirmedSlotId', interviewerId);
    if (!interviewerId || !selectedCandidate?.id) return;
    try {
      const record: Record<string, any> = {
        'csp_Candidate@odata.bind': `/csp_candidates(${selectedCandidate.id})`,
        'csp_Interviewer@odata.bind': `/contacts(${interviewerId})`,
      };
      await createRecord('csp_availabilityslotses', record);
      toast.success('Interviewer assigned');
      await fetchCandidateSlots(selectedCandidate.id);
    } catch (err: any) {
      console.error('[Candidate] Failed to create slot:', err);
      toast.error(err?.message || 'Failed to assign interviewer');
    }
  };

  const handleRemoveInterviewer = async () => {
    const slotId = formData._slotId;
    if (slotId) {
      try {
        await updateRecord('csp_availabilityslotses', slotId, { statuscode: 725070002 });
        toast.success('Interviewer removed');
      } catch (err: any) {
        console.error('[Candidate] Failed to cancel slot:', err);
        toast.error(err?.message || 'Failed to remove interviewer');
        return;
      }
    }
    setFormData(prev => ({
      ...prev,
      confirmedSlotId: '',
      _slotId: '',
      _slotDatetime: '',
      _slotTeamsLink: '',
      _slotStatus: undefined,
      _slotInterviewerName: '',
      status: prev.status === 'Scheduled' ? 'Applied' : prev.status,
    }));
  };

  const closeForm = () => {
    setSelectedCandidate(null);
    setIsNew(false);
    setEmailError('');
  };

  const updateField = (key: string, value: any) =>
    setFormData(prev => {
      const updated = { ...prev, [key]: value };
      // Auto-set status based on slot assignment
      if (key === 'confirmedSlotId') {
        if (value) {
          updated.status = 'Scheduled';
        } else if (prev.status === 'Scheduled') {
          updated.status = 'Applied';
        }
      }
      return updated;
    });

  const saveForm = async () => {
    if (isSaving) return;
    const name = `${formData.firstName} ${formData.lastName}`.trim();
    // Bug #11: Validate required fields with feedback
    if (!formData.firstName || !formData.lastName) {
      toast.error('First and Last name are required');
      return;
    }
    if (!formData.email) {
      toast.error('Email is required');
      return;
    }
    // Bug #10: Check for duplicate email (case-insensitive, trim, skip self on edit)
    if (formData.email) {
      const editingId = isNew ? null : selectedCandidate?.id;
      const existingWithEmail = rawCandidates.find((c: any) =>
        c.email && c.email.toLowerCase().trim() === formData.email.toLowerCase().trim()
        && c.id !== editingId
      );
      if (existingWithEmail) {
        const dupName = `${(existingWithEmail as any).firstName || ''} ${(existingWithEmail as any).lastName || ''}`.trim();
        const msg = `A candidate with email "${formData.email}" already exists${dupName ? ` (${dupName})` : ''}`;
        toast.error(msg);
        setEmailError(msg);
        return;
      }
    }
    setEmailError('');
    setIsSaving(true);
    try {
      const candidateId = await saveCandidate(formData, isNew ? undefined : selectedCandidate?.id);
      if (cvFile && candidateId) {
        try {
          await Csp_candidatesService.upload(candidateId, 'csp_candidatecv', cvFile, cvFile.name);
          console.log('[Candidate] CV uploaded for', candidateId);
        } catch (uploadErr: any) {
          console.error('[Candidate] CV upload failed:', uploadErr?.message);
          toast.error('Candidate saved but CV upload failed');
        }
      }
      setCvFile(null);
      if (cvFileRef.current) cvFileRef.current.value = '';
      toast.success(isNew ? `Candidate "${name}" created` : `Candidate "${name}" saved`);
      closeForm();
      await refetch();
    } catch (err: any) {
      console.error('Save failed:', err);
      toast.error(err?.message || 'Save failed — check console for details');
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Loading state ───────────────────────────────────────── */

  if (loading && candidates.length === 0) {
    return <PageLoading message="Loading candidates..." />;
  }

  /* ── Render ──────────────────────────────────────────────── */

  const rowTint: Record<string, string> = {
    Fit: 'rgba(34, 197, 94, 0.06)',
    'Not Fit': 'rgba(239, 68, 68, 0.06)',
    Scheduled: 'rgba(245, 158, 11, 0.06)',
    Applied: 'transparent',
  };
  const statusBadgeStyles: Record<string, React.CSSProperties> = {
    Applied: { background: 'hsl(215 20% 93%)', color: 'hsl(215 25% 35%)' },
    Scheduled: { background: 'hsl(38 92% 92%)', color: 'hsl(38 75% 30%)' },
    Fit: { background: 'hsl(142 60% 92%)', color: 'hsl(142 60% 25%)' },
    'Not Fit': { background: 'hsl(0 65% 93%)', color: 'hsl(0 60% 35%)' },
    Booked: { background: 'hsl(215 20% 93%)', color: 'hsl(215 25% 35%)' },
  };
  const renderCandidateBadge = (status: string) => (
    <span
      style={{
        ...(statusBadgeStyles[status] || statusBadgeStyles.Applied),
        display: 'inline-block', padding: '2px 10px', borderRadius: 9999,
        fontSize: 11, fontWeight: 600, lineHeight: 1.5,
      }}
    >{status}</span>
  );
  const sourceToggleRow = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))' }}>Source</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {candidateSources.map(s => {
          const active = formData.source === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => updateField('source', s)}
              style={{
                padding: '4px 14px', fontSize: 12, cursor: 'pointer', borderRadius: 9999,
                background: active ? 'hsl(222 47% 20%)' : 'transparent',
                color: active ? 'white' : 'hsl(var(--muted-foreground))',
                border: active ? 'none' : '1px solid transparent',
              }}
            >{s}</button>
          );
        })}
      </div>
      {formData.source === 'Recruiter' && (
        <span style={{ fontSize: 12, color: '#d97706', marginLeft: 4 }}>Outreach must go through the recruiter.</span>
      )}
    </div>
  );

  return (
    <div className="csp-candidates-page">
      <style>{`
        .csp-candidates-page .csp-input-readonly {
          background-color: hsl(40 33% 97%) !important;
          color: hsl(var(--foreground)) !important;
        }
        .csp-candidates-page .csp-textarea-tinted .csp-textarea {
          background-color: hsl(40 33% 97%) !important;
        }
        .csp-candidates-page .csp-tab-pill {
          background: transparent; border: 1px solid transparent; padding: 6px 14px; border-radius: 6px;
          font-size: 13px; font-weight: 500; cursor: pointer; color: hsl(var(--muted-foreground));
        }
        .csp-candidates-page .csp-tab-pill.is-active {
          background: white; border-color: hsl(var(--border));
          color: hsl(222 47% 20%); font-weight: 600;
        }
        .csp-candidates-page .csp-form-field > button[type="button"] {
          display: none !important;
        }
      `}</style>
      <HeaderSelectionBar
        count={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        entityLabel="candidates"
        onDelete={async () => {
          const count = selectedIds.length;
          const ok = await confirm({ title: 'Delete candidate(s)', description: `Are you sure you want to delete ${count} selected candidate(s)? This action cannot be undone.` });
          if (!ok) return;
          try {
            const { deleteRecord } = await import('../services/dataverseService');
            for (const id of selectedIds) await deleteRecord('csp_candidates', id);
            toast.success(`${count} candidate(s) deleted`);
            setSelectedIds([]);
            await refetch();
          } catch (err: any) { toast.error('Delete failed'); }
        }}
      />

      <PageHeader
        title="Candidates"
        subtitle={`${filtered.length} of ${candidates.length} candidates`}
        action={
          <div className="csp-flex-gap-2">
            <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
            <button
              className="csp-btn csp-btn-outline csp-btn-sm"
              disabled={selectedIds.length !== 1}
              onClick={() => setRaiseOppOpen(true)}
              title={selectedIds.length === 1 ? 'Raise opportunity for the selected candidate' : 'Select a single candidate to enable'}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              💼 Raise Opportunity
            </button>
            <button className="csp-btn csp-btn-primary" onClick={openNewForm}>
              <Plus className="csp-icon-inline" />Add Candidate
            </button>
          </div>
        }
      />

      {/* ── Filter pills ─────────────────────────────────── */}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search name, email, B2B entity..." />
          <SinglePill label="Status" value={statusFilter} onChange={setStatusFilter}
            options={statusOptions.map(s => ({ value: s, label: s, count: statusCounts[s] }))} />
          <SinglePill label="Path" value={pathFilter} onChange={setPathFilter}
            options={pathOptions.map(p => ({ value: p, label: p, count: pathCounts[p] }))} />
          <SinglePill label="Source" value={sourceFilter} onChange={setSourceFilter}
            options={candidateSources.map(s => ({ value: s, label: s, count: candidates.filter(c => c.source === s).length }))} />
          <DatePill label="Applied" value={appliedDateFilter} onChange={setAppliedDateFilter} dates={candidates.map(c => c.appliedDate).filter(Boolean) as string[]} />
        </div>
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('')} />}
            {pathFilter && <FilterChip label={`Path: ${pathFilter}`} onRemove={() => setPathFilter('')} />}
            {sourceFilter && <FilterChip label={`Source: ${sourceFilter}`} onRemove={() => setSourceFilter('')} />}
            {appliedDateFilter.type !== 'all' && <FilterChip label={`Applied: ${relativeDateLabel(appliedDateFilter)}`} onRemove={() => setAppliedDateFilter({ type: 'all' })} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setSearchTerm(''); setStatusFilter(''); setPathFilter(''); setSourceFilter(''); setAppliedDateFilter({ type: 'all' }); }}>Clear all</button>
          </div>
        )}
      </div>

      {/* ── Status legend ────────────────────────────────── */}

      <div className="csp-legend-row">
        <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', marginRight: 8 }}>Legend</span>
        {statusOptions.map(s => (
          <span key={s} className="csp-legend-item">
            <span className={cn('csp-dot', statusDotColors[s])} />{s}
          </span>
        ))}
      </div>

      {/* ── Table ────────────────────────────────────────── */}

      <div className="csp-table-wrapper">
        <table className="csp-table">
          <thead>
            <tr>
              <th className="csp-th-checkbox">
                <Checkbox checked={allSelected} onChange={toggleAll} />
              </th>
              <th>
                Name{' '}
                <TextFilterPopover
                  label="Name"
                  value={getTextFilter(colFilters, 'name')}
                  onChange={v => setTextFilter(setColFilters, 'name', v)}
                />
              </th>
              <th>
                Role{' '}
                <TextFilterPopover
                  label="Role"
                  value={getTextFilter(colFilters, 'role')}
                  onChange={v => setTextFilter(setColFilters, 'role', v)}
                />
              </th>
              <th>
                Email{' '}
                <TextFilterPopover
                  label="Email"
                  value={getTextFilter(colFilters, 'email')}
                  onChange={v => setTextFilter(setColFilters, 'email', v)}
                />
              </th>
              <th>
                Source{' '}
                <MultiSelectFilterPopover
                  label="Source"
                  options={[...candidateSources]}
                  selected={getMultiFilter(colFilters, 'source')}
                  onChange={v => setMultiFilter(setColFilters, 'source', v)}
                />
              </th>
              <th>
                Path{' '}
                <MultiSelectFilterPopover
                  label="Path"
                  options={[...pathOptions]}
                  selected={getMultiFilter(colFilters, 'path')}
                  onChange={v => setMultiFilter(setColFilters, 'path', v)}
                />
              </th>
              <th>
                Rate (&euro;/h){' '}
                <NumberRangeFilterPopover
                  label="Rate"
                  min={getNumberFilter(colFilters, 'rate').min}
                  max={getNumberFilter(colFilters, 'rate').max}
                  onChange={(min, max) => setNumberFilter(setColFilters, 'rate', min, max)}
                />
              </th>
              <th style={{ textAlign: 'right' }}>Daily Rate (&euro;)</th>
              <th>
                B2B Entity{' '}
                <TextFilterPopover
                  label="B2B Entity"
                  value={getTextFilter(colFilters, 'b2bEntity')}
                  onChange={v => setTextFilter(setColFilters, 'b2bEntity', v)}
                />
              </th>
              <th>
                Applied{' '}
                <DateRangeFilterPopover
                  label="Applied"
                  from={getDateFilter(colFilters, 'appliedDate').from}
                  to={getDateFilter(colFilters, 'appliedDate').to}
                  onChange={(f, t) => setDateFilter(setColFilters, 'appliedDate', f, t)}
                />
              </th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="csp-td-empty">
                  No candidates match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map(candidate => (
                <tr
                  key={candidate.id}
                  className="csp-tr-clickable"
                  style={{ backgroundColor: rowTint[candidate.status] || 'transparent' }}
                  onClick={() => openForm(candidate)}
                >
                  <td className="csp-td-check" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(candidate.id)}
                      onChange={c => toggleOne(candidate.id, c)}
                    />
                  </td>
                  <td className="csp-td-bold">
                    {candidate.firstName} {candidate.lastName}
                  </td>
                  <td>{candidate.candidateRole || '\u2014'}</td>
                  <td>{candidate.email}</td>
                  <td>{candidate.source || '\u2014'}</td>
                  <td>{candidate.path}</td>
                  <td>
                    &euro;{candidate.hourlyRateEur}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {candidate.hourlyRateEur ? `\u20ac${(candidate.hourlyRateEur * 8).toFixed(0)}` : '\u2014'}
                  </td>
                  <td>
                    {candidate.b2bEntityName || '\u2014'}
                  </td>
                  <td>
                    {candidate.appliedDate ? candidate.appliedDate.substring(0, 10) : '—'}
                  </td>
                  <td>
                    {renderCandidateBadge(candidate.status)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Sheet side panel ─────────────────────────────── */}

      <Sheet open={!!selectedCandidate} onClose={closeForm}>
        {selectedCandidate && (
          <>
            <div className="csp-sheet-header">
              <div className="csp-sheet-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20, fontWeight: 700 }}>
                  {isNew
                    ? 'New Candidate'
                    : `${formData.firstName || ''} ${formData.lastName || ''}`}
                </span>
                {!isNew && renderCandidateBadge(formData.status)}
              </div>
            </div>

            <div className="csp-tabs">
              <div className="csp-tabs-list" style={{ display: 'flex', gap: 4, borderBottom: 'none', padding: '0 0 8px 0' }}>
                {formTabs.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={cn('csp-tab-pill', activeTab === t.id && 'is-active')}
                    onClick={() => setActiveTab(t.id)}
                  >{t.label}</button>
                ))}
              </div>
              <div className="csp-tab-content">

              {/* ── General Tab ─────────────────────────────── */}

              {activeTab === 'general' && (
                <>
                  {sourceToggleRow}
                  <div className="csp-form-grid-2">
                    <TextField
                      label="First Name"
                      value={formData.firstName}
                      onChange={v => updateField('firstName', v)}
                    />
                    <TextField
                      label="Last Name"
                      value={formData.lastName}
                      onChange={v => updateField('lastName', v)}
                    />
                    <EmailField
                      label="Email"
                      value={formData.email}
                      onChange={v => { updateField('email', v); setEmailError(''); }}
                      externalError={emailError}
                    />
                    <TextField
                      label="Phone"
                      value={formData.phone}
                      onChange={v => updateField('phone', v)}
                    />
                    <SelectField
                      label="Path"
                      value={formData.path}
                      onChange={v => updateField('path', v)}
                      options={pathOptions.map(p => ({ value: p, label: p }))}
                    />
                    <TextField
                      label="Candidate Role"
                      value={formData.candidateRole || ''}
                      onChange={v => updateField('candidateRole', v)}
                      placeholder="e.g. Senior Developer"
                    />
                    <TextField
                      label="Hourly Rate (€)"
                      value={formData.hourlyRateEur != null ? String(formData.hourlyRateEur) : ''}
                      onChange={v => updateField('hourlyRateEur', v)}
                      type="number"
                      min="0"
                      placeholder="0"
                    />
                    <TextField
                      label="Daily Rate (€)"
                      value={formData.hourlyRateEur ? `€${(Number(formData.hourlyRateEur) * 8).toFixed(0)}` : ''}
                      onChange={() => {}}
                      readOnly
                    />
                    {formData.path === 'B2B seeking Contracts' && (
                      <TextField
                        label="B2B Entity Name"
                        value={formData.b2bEntityName}
                        onChange={v => updateField('b2bEntityName', v)}
                      />
                    )}
                    <TextField
                      label="Applied Date"
                      value={formData.appliedDate || (selectedCandidate?.appliedDate || '')}
                      onChange={() => {}}
                      readOnly
                    />
                  </div>

                  {/* ── Candidate CV upload (dropzone) ─────────────── */}
                  <div style={{ marginTop: 16 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--primary))' }}>Candidate CV</label>
                    <input
                      ref={cvFileRef}
                      type="file"
                      accept=".pdf,.doc,.docx"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setCvFile(file);
                        if (file && !formData.cvFileName) updateField('cvFileName', file.name);
                      }}
                    />
                    {!(cvFile || (!isNew && formData.cvFileName)) && (
                      <div
                        onClick={() => cvFileRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={(e) => {
                          e.preventDefault(); e.stopPropagation();
                          const file = e.dataTransfer?.files?.[0];
                          if (file) {
                            setCvFile(file);
                            if (!formData.cvFileName) updateField('cvFileName', file.name);
                          }
                        }}
                        style={{
                          border: '2px dashed hsl(var(--border))',
                          borderRadius: 8,
                          padding: '24px 16px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          marginTop: 8,
                          background: 'hsl(var(--muted) / 0.2)',
                        }}
                      >
                        <div style={{ fontSize: 20, marginBottom: 8, color: 'hsl(var(--muted-foreground))' }}>⬆</div>
                        <div style={{ fontSize: 13 }}>Click to upload candidate CV</div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>PDF, DOC, DOCX</div>
                      </div>
                    )}
                    {(cvFile || (!isNew && formData.cvFileName)) && (
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8, padding: '10px 12px', marginTop: 8,
                          background: 'hsl(var(--background))',
                        }}
                      >
                        <span style={{ fontSize: 18, color: 'hsl(215 15% 55%)' }}>📄</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cvFile ? cvFile.name : formData.cvFileName}
                          </div>
                          <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                            {cvFile ? `${cvFile.type} · ${(cvFile.size / 1024).toFixed(0)} KB` : 'Document'}
                          </div>
                        </div>
                        {!isNew && formData.cvFileName && !cvFile && (
                          <button
                            type="button"
                            className="csp-btn csp-btn-outline csp-btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              const orgUrl = getOrgUrl();
                              window.open(`${orgUrl}/api/data/v9.2/csp_candidates(${selectedCandidate?.id})/csp_candidatecv/$value`, '_blank');
                            }}
                          >View</button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCvFile(null);
                            if (cvFileRef.current) cvFileRef.current.value = '';
                            updateField('cvFileName', '');
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'hsl(var(--muted-foreground))' }}
                        >×</button>
                      </div>
                    )}
                  </div>

                  {/* ── AI Fields (read-only, shown only when values exist) ── */}

                  {(formData.aiDecision || formData.aiSummary || formData.aiSuggestedRate > 0) && (
                    <div className="csp-section csp-mt-4">
                      <div className="csp-section-title">AI Assessment</div>
                      <div className="csp-form-grid-2">
                        {formData.aiDecision && (
                          <TextField
                            label="AI Decision"
                            value={formData.aiDecision}
                            onChange={() => {}}
                            readOnly
                          />
                        )}
                        {formData.aiSuggestedRate > 0 && (
                          <TextField
                            label="AI Suggested Rate"
                            value={`\u20AC${formData.aiSuggestedRate}`}
                            onChange={() => {}}
                            readOnly
                          />
                        )}
                        {formData.aiSummary && (
                          <TextAreaField
                            label="AI Summary"
                            value={formData.aiSummary}
                            onChange={() => {}}
                            readOnly
                            rows={4}
                            className="csp-col-span-2"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Scheduling Tab ─────────────────────────── */}

              {activeTab === 'scheduling' && (
                <div className="csp-mt-4">
                  {sourceToggleRow}
                  <LookupField
                    label="Assigned Interviewer"
                    value={formData.confirmedSlotId || ''}
                    onChange={handleAssignInterviewer}
                    options={interviewerOptions}
                    placeholder="Search and select an interviewer..."
                  />
                  {formData.confirmedSlotId && (
                    <div style={{ marginTop: 12, border: '1px solid hsl(var(--border))', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16, color: 'hsl(var(--muted-foreground))' }}>👤</span>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                          {getInterviewerName(formData.confirmedSlotId) !== formData.confirmedSlotId
                            ? getInterviewerName(formData.confirmedSlotId)
                            : (formData._slotInterviewerName || getInterviewerName(formData.confirmedSlotId))}
                        </span>
                        {renderCandidateBadge(formData._slotStatus === 725070001 ? 'Booked' : 'Scheduled')}
                        <div style={{ flex: 1 }} />
                        <button
                          type="button"
                          className="csp-btn csp-btn-outline csp-btn-sm"
                          onClick={handleRemoveInterviewer}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                        >× Remove</button>
                      </div>
                      {(formData._slotDatetime || formData._slotTeamsLink) && (
                        <div style={{ marginTop: 6, paddingLeft: 26, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {formData._slotDatetime && (
                            <span className="csp-text-xs csp-text-muted">
                              {new Date(formData._slotDatetime).toLocaleString('en-GB', {
                                weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                          )}
                          {formData._slotTeamsLink && (
                            <a
                              href={formData._slotTeamsLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="csp-text-xs"
                              style={{ color: '#6366f1' }}
                            >Join Teams Meeting</a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {!formData.confirmedSlotId && (
                    <p className="csp-text-muted csp-text-sm csp-mt-4">
                      No interviewer assigned yet. Use the search above to find and assign one.
                    </p>
                  )}
                </div>
              )}

              {/* ── Review Tab ─────────────────────────────── */}

              {activeTab === 'review' && (
                <div className="csp-mt-4">
                  {sourceToggleRow}
                  <TextField
                    label="Reviewed By"
                    value={formData.reviewedBy || ''}
                    onChange={() => {}}
                    readOnly
                  />
                  <div className="csp-textarea-tinted">
                    <TextAreaField
                      label="Reviewer Notes"
                      value={formData.reviewerNotes || ''}
                      onChange={v => updateField('reviewerNotes', v)}
                      rows={5}
                    />
                  </div>
                </div>
              )}
              </div>
            </div>

            <div className="csp-form-footer">
              <button className="csp-btn csp-btn-outline" onClick={closeForm}>
                Close
              </button>
              <button
                className={cn('csp-btn csp-btn-primary', isSaving && 'csp-btn-saving')}
                disabled={isSaving}
                onClick={saveForm}
              >
                {isSaving ? (
                  <>
                    <Spinner size="sm" /> Saving...
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </>
        )}
      </Sheet>

      <SendCandidateProfilesDialog
        open={sendProfilesOpen}
        onOpenChange={setSendProfilesOpen}
        candidates={candidates.filter(c => selectedIds.includes(c.id)) as any}
        contacts={rawContacts as any}
        accounts={oppAccounts}
        prospects={oppProspects}
      />

      <RaiseOpportunityForm
        open={raiseOppOpen}
        onClose={() => setRaiseOppOpen(false)}
        origin={selectedIds.length === 1
          ? { kind: 'candidate', record: (candidates.find(c => c.id === selectedIds[0]) as any) }
          : null}
        onCreated={() => { setRaiseOppOpen(false); setSelectedIds([]); }}
        accounts={oppAccounts}
        prospects={oppProspects}
        contacts={rawContacts as any}
        candidates={candidates as any}
        uoms={oppUoms}
        currencies={oppCurrencies}
      />
    </div>
  );
}
