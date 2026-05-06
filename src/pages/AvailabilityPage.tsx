import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge, Spinner, PageLoading } from '../components/Shared';
import { Sheet, ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, LookupField, SelectField } from '../components/FormFields';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, setTextFilter, setMultiFilter,
  matchDateRange,
} from '../components/ColumnFilters';
import { SearchPill, SinglePill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, type RelativeDateValue } from '../components/FilterPills';
import { Plus } from '../components/Icons';
import { cn, formatDateTime } from '../lib/utils';
import { fetchSlots, saveSlot } from '../services/availabilitySlotService';
import type { SlotRecord } from '../services/availabilitySlotService';
import { fetchCandidates } from '../services/candidateService';
import type { CandidateRecord } from '../services/candidateService';
import { fetchContacts } from '../services/contactService';
import { useDataverse } from '../services/useDataverse';
import { availabilitySlots as mockSlots, contacts as mockContacts } from '../data/mock-data';

/* -- Constants ----------------------------------------------------------- */

const statusOptions = ['Active', 'Inactive'] as const;

/* -- Helper functions ---------------------------------------------------- */

function getCandidateName(candidates: CandidateRecord[], candidateId: string): string {
  if (!candidateId) return '\u2014';
  const c = candidates.find(x => x.id === candidateId);
  return c ? `${c.firstName} ${c.lastName}` : '\u2014';
}

function getInterviewerName(contacts: any[], interviewerId: string): string {
  if (!interviewerId) return '\u2014';
  const c = contacts.find((x: any) => x.id === interviewerId);
  return c ? `${c.firstName} ${c.lastName}` : '\u2014';
}

/* -- Page Component ------------------------------------------------------ */

import { useConfirm } from '../components/ConfirmDialog';

export default function AvailabilityPage() {
  const { toast } = useToast();
  const confirm = useConfirm();

  /* -- Data fetching ----------------------------------------------------- */

  const { data: slots, loading: slotsLoading, refetch, isLive } = useDataverse(fetchSlots, mockSlots as any[]);
  const { data: candidates, loading: candidatesLoading } = useDataverse(fetchCandidates, []);
  const { data: contacts, loading: contactsLoading } = useDataverse(fetchContacts, mockContacts as any[]);

  /* -- Filter state ------------------------------------------------------ */

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter2] = useState<RelativeDateValue>({ type: 'all' });
  const [colFilters, setColFilters] = useState<ColumnFilters>({});

  /* -- Selection state --------------------------------------------------- */

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  /* -- Sheet / form state ------------------------------------------------ */

  const [selectedSlot, setSelectedSlot] = useState<SlotRecord | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  /* -- Counts ------------------------------------------------------------ */

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    statusOptions.forEach(s => { counts[s] = slots.filter((sl: any) => sl.status === s).length; });
    return counts;
  }, [slots]);

  /* -- Filtering --------------------------------------------------------- */

  const filtered = useMemo(() => {
    return slots.filter((s: any) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const cand = candidates.find((c: any) => c.id === s.candidateId);
        const candName = cand ? `${(cand as any).firstName} ${(cand as any).lastName}`.toLowerCase() : '';
        const interviewer = contacts.find((c: any) => c.id === s.interviewerId);
        const intName = interviewer ? `${(interviewer as any).firstName} ${(interviewer as any).lastName}`.toLowerCase() : '';
        if (!candName.includes(q) && !intName.includes(q)) return false;
      }
      if (dateFilter.type !== 'all') {
        const r = dateRangeFor(dateFilter);
        const d = (s.dateTime || s.date || '').slice(0, 10);
        if (!matchDateRange(d, r.from, r.to)) return false;
      }

      const slotIdFilter = getTextFilter(colFilters, 'slotId');
      if (slotIdFilter && !(s.slotId || '').toLowerCase().includes(slotIdFilter.toLowerCase())) return false;

      const teamsFilter = getTextFilter(colFilters, 'teams');
      if (teamsFilter && !(s.teamsLink || '').toLowerCase().includes(teamsFilter.toLowerCase())) return false;

      const statusCol = getMultiFilter(colFilters, 'status');
      if (statusCol.length > 0 && !statusCol.includes(s.status)) return false;

      return true;
    });
  }, [slots, statusFilter, searchTerm, dateFilter, candidates, contacts, colFilters]);

  const hasActiveFilters = !!searchTerm || !!statusFilter || dateFilter.type !== 'all';

  /* -- Selection helpers ------------------------------------------------- */

  const filteredIds = filtered.map((s: any) => s.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) =>
    setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  /* -- Lookup options for form ------------------------------------------- */

  const candidateLookupOptions = useMemo(
    () => candidates.map((c: any) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })),
    [candidates],
  );

  const interviewerLookupOptions = useMemo(
    () => contacts
      .filter((c: any) => c.isInterviewer === true)
      .map((c: any) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })),
    [contacts],
  );

  /* -- Form helpers ------------------------------------------------------ */

  const openForm = (slot: any) => {
    setIsNew(false);
    setSelectedSlot(slot);
    setFormData({
      candidateId: slot.candidateId || '',
      dateTime: slot.dateTime || '',
      teamsLink: slot.teamsLink || '',
      interviewerId: slot.interviewerId || '',
      status: slot.status || 'Active',
    });
  };

  const openNewForm = () => {
    setIsNew(true);
    setSelectedSlot({} as SlotRecord);
    setFormData({
      candidateId: '',
      dateTime: '',
      teamsLink: '',
      interviewerId: '',
      status: 'Active',
    });
  };

  const closeForm = () => {
    setSelectedSlot(null);
    setIsNew(false);
    setFormData({});
    setValidationErrors([]);
  };

  const updateField = (key: string, value: any) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const saveForm = async () => {
    if (isSaving) return;
    // Bug #2: Validate required fields before save
    const errors: string[] = [];
    if (!formData.candidateId) errors.push('Candidate is required');
    if (!formData.dateTime) errors.push('Day / Time is required');
    if (errors.length > 0) {
      setValidationErrors(errors);
      toast.error(errors.join('. '));
      return;
    }
    setValidationErrors([]);
    setIsSaving(true);
    try {
      await saveSlot(formData, isNew ? undefined : selectedSlot?.id);
      toast.success(isNew ? 'Slot created' : 'Slot saved');
      closeForm();
      await refetch();
    } catch (err: any) {
      console.error('Save failed:', err);
      toast.error(err?.message || 'Save failed \u2014 check console for details');
    } finally {
      setIsSaving(false);
    }
  };

  /* -- Loading state ----------------------------------------------------- */

  if (slotsLoading && slots.length === 0) {
    return <PageLoading message="Loading availability slots..." />;
  }

  /* -- Render ------------------------------------------------------------ */

  return (
    <div>
      <HeaderSelectionBar
        count={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        entityLabel="slots"
        onDelete={async () => {
          const count = selectedIds.length;
          const ok = await confirm({ title: 'Delete slot(s)', description: `Are you sure you want to delete ${count} selected slot(s)? This action cannot be undone.` });
          if (!ok) return;
          try {
            const { deleteRecord } = await import('../services/dataverseService');
            for (const id of selectedIds) await deleteRecord('csp_availabilityslotses', id);
            toast.success(`${count} slot(s) deleted`);
            setSelectedIds([]);
            await refetch();
          } catch (err: any) { toast.error('Delete failed'); }
        }}
      />

      <PageHeader
        title="Availability Slots"
        subtitle={`${filtered.length} of ${slots.length} slots`}
        action={
          <div className="csp-flex-gap-2">
            <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
            <button className="csp-btn csp-btn-primary" onClick={openNewForm}>
              <Plus className="csp-icon-inline" />Add Slot
            </button>
          </div>
        }
      />

      {/* -- Filter pills ------------------------------------------------- */}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search candidate or interviewer..." />
          <SinglePill label="Status" value={statusFilter} onChange={setStatusFilter}
            options={statusOptions.map(s => ({ value: s, label: s, count: statusCounts[s] || 0 }))} />
          <DatePill label="Date" value={dateFilter} onChange={setDateFilter2} dates={slots.map((s: any) => (s.dateTime || s.date || '').slice(0, 10)).filter(Boolean) as string[]} />
        </div>
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('')} />}
            {dateFilter.type !== 'all' && <FilterChip label={`Date: ${relativeDateLabel(dateFilter)}`} onRemove={() => setDateFilter2({ type: 'all' })} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setSearchTerm(''); setStatusFilter(''); setDateFilter2({ type: 'all' }); }}>Clear all</button>
          </div>
        )}
      </div>

      {/* -- Table -------------------------------------------------------- */}

      <div className="csp-table-wrapper">
        <table className="csp-table">
          <thead>
            <tr>
              <th className="csp-th-checkbox">
                <Checkbox checked={allSelected} onChange={toggleAll} />
              </th>
              <th>
                Slot ID{' '}
                <TextFilterPopover
                  label="Slot ID"
                  value={getTextFilter(colFilters, 'slotId')}
                  onChange={v => setTextFilter(setColFilters, 'slotId', v)}
                />
              </th>
              <th>Candidate</th>
              <th>Day / Time</th>
              <th>
                Teams Link{' '}
                <TextFilterPopover
                  label="Teams Link"
                  value={getTextFilter(colFilters, 'teams')}
                  onChange={v => setTextFilter(setColFilters, 'teams', v)}
                />
              </th>
              <th>Interviewer</th>
              <th>
                Status{' '}
                <MultiSelectFilterPopover
                  label="Status"
                  options={[...statusOptions]}
                  selected={getMultiFilter(colFilters, 'status')}
                  onChange={v => setMultiFilter(setColFilters, 'status', v)}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="csp-td-empty">
                  No slots match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((slot: any) => (
                <tr
                  key={slot.id}
                  className="csp-tr-clickable"
                  onClick={() => openForm(slot)}
                >
                  <td className="csp-td-check" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(slot.id)}
                      onChange={c => toggleOne(slot.id, c)}
                    />
                  </td>
                  <td className="csp-td-mono">{slot.slotId || (slot.id ? `SLOT-${String(slot.id).substring(0, 8).toUpperCase()}` : null) ||'\u2014'}</td>
                  <td>{(() => {
                    const real = getCandidateName(candidates as CandidateRecord[], slot.candidateId);
                    return real && real !== '—' ? real : (slot.candidateName || '—');
                  })()}</td>
                  <td>{slot.dateTime ? formatDateTime(slot.dateTime) : '\u2014'}</td>
                  <td className="csp-td-truncate" title={slot.teamsLink}>
                    {slot.teamsLink ? slot.teamsLink.substring(0, 35) + '...' : '\u2014'}
                  </td>
                  <td>{slot.interviewerName || getInterviewerName(contacts, slot.interviewerId)}</td>
                  <td><StatusBadge status={slot.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* -- Sheet side panel --------------------------------------------- */}

      <Sheet open={!!selectedSlot} onClose={closeForm}>
        {selectedSlot && (
          <>
            <div className="csp-sheet-header">
              <div className="csp-sheet-title">
                {isNew ? 'New Slot' : `Slot ${(selectedSlot as any).slotId || ''}`}
                {!isNew && <StatusBadge status={formData.status} />}
              </div>
            </div>

            {validationErrors.length > 0 && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6, backgroundColor: 'hsl(0, 84%, 60%, 0.1)', border: '1px solid hsl(0, 84%, 60%, 0.3)', fontSize: '0.8125rem', color: 'hsl(0, 84%, 60%)' }}>
                {validationErrors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            <div className="csp-form-grid-2">
              <LookupField
                label="Candidate"
                value={formData.candidateId}
                onChange={v => { updateField('candidateId', v); setValidationErrors([]); }}
                options={candidateLookupOptions}
                placeholder="Select candidate"
                required
              />
              <TextField
                label="Day / Time"
                value={formData.dateTime}
                onChange={v => { updateField('dateTime', v); setValidationErrors([]); }}
                type="datetime-local"
                min="2020-01-01T00:00"
                max="2099-12-31T23:59"
                required
              />
              <TextField
                label="Teams Link"
                value={formData.teamsLink}
                onChange={v => updateField('teamsLink', v)}
                placeholder="https://teams.microsoft.com/..."
              />
              <LookupField
                label="Interviewer"
                value={formData.interviewerId}
                onChange={v => updateField('interviewerId', v)}
                options={interviewerLookupOptions}
                placeholder="Select interviewer"
              />
              <TextField
                label="Status"
                value={formData.status}
                onChange={() => {}}
                readOnly
              />
            </div>

            <div className="csp-form-footer">
              <button className="csp-btn csp-btn-outline" onClick={closeForm}>
                Close
              </button>
              <button
                className={cn('csp-btn csp-btn-primary', isSaving && 'csp-btn-saving')}
                disabled={isSaving || (!formData.candidateId && !formData.dateTime)}
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
    </div>
  );
}
