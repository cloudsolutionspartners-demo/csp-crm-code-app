import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader, Spinner } from '../components/Shared';
import { Sheet, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, DateField, LookupField, SelectField } from '../components/FormFields';
import {
  ColumnFilters as ColumnFiltersType,
  TextFilterPopover, NumberRangeFilterPopover, DateRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getNumberFilter, getDateFilter,
  setTextFilter, setNumberFilter, setDateFilter,
  matchDateRange,
} from '../components/ColumnFilters';
import { SearchPill, MultiPill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, type RelativeDateValue } from '../components/FilterPills';
import { Plus, Check } from '../components/Icons';
import { leaveRequests as mockLeaveRequests } from '../data/mock-data';
import { useDataverse } from '../services/useDataverse';
import { fetchLeaveRequests, saveLeaveRequest, removeLeaveRequest } from '../services/leaveService';
import { fetchContacts } from '../services/contactService';
import type { LeaveRequest, Contact } from '../types/crm';

const LEAVE_TYPES = ['Annual Leave', 'Sick Leave', 'Unpaid Leave', 'Bank Holiday', 'Other'];

const emptyLeave: Omit<LeaveRequest, 'id'> = {
  name: '',
  contactId: '',
  leaveType: 'Annual Leave',
  startDate: '',
  endDate: '',
  totalDays: 0,
  status: 'Pending',
  clientNotified: false,
};

function calcWorkingDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

import { useConfirm } from '../components/ConfirmDialog';

export default function LeavePage() {
  const { toast } = useToast();
  const confirm = useConfirm();

  // --- Data: Dataverse ---
  const { data: allLeave, loading, refetch, isLive } = useDataverse(fetchLeaveRequests, mockLeaveRequests);
  const { data: dvContacts } = useDataverse<Contact>(fetchContacts, []);
  const [isSaving, setIsSaving] = useState(false);

  const [colFilters, setColFilters] = useState<ColumnFiltersType>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editLeave, setEditLeave] = useState<Omit<LeaveRequest, 'id'> & { id?: string }>(emptyLeave);

  const [searchTerm, setSearchTerm] = useState('');
  const [consultantFilter, setConsultantFilter] = useState<string[]>([]);
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [startDateFilter, setStartDateFilter] = useState<RelativeDateValue>({ type: 'all' });
  const [endDateFilter, setEndDateFilter] = useState<RelativeDateValue>({ type: 'all' });

  const getContactName = (contactId: string): string => {
    if (!contactId) return '\u2014';
    const c = dvContacts.find(x => x.id === contactId);
    return c ? `${c.firstName} ${c.lastName}` : '\u2014';
  };

  const filtered = useMemo(() => {
    const startRange = dateRangeFor(startDateFilter);
    const endRange = dateRangeFor(endDateFilter);
    return allLeave.filter(lr => {
      if (consultantFilter.length > 0 && !consultantFilter.includes(lr.contactId)) return false;
      if (leaveTypeFilter.length > 0 && !leaveTypeFilter.includes(lr.leaveType)) return false;
      if (statusFilter.length > 0 && !statusFilter.includes((lr as any).status || '')) return false;
      if (startDateFilter.type !== 'all' && !matchDateRange(lr.startDate, startRange.from, startRange.to)) return false;
      if (endDateFilter.type !== 'all' && !matchDateRange(lr.endDate, endRange.from, endRange.to)) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const conName = getContactName(lr.contactId).toLowerCase();
        if (!(lr.name || '').toLowerCase().includes(q) && !conName.includes(q)) return false;
      }
      const consultant = getTextFilter(colFilters, 'consultant');
      if (consultant) {
        const name = getContactName(lr.contactId);
        if (!name.toLowerCase().includes(consultant.toLowerCase())) return false;
      }
      const nameF = getTextFilter(colFilters, 'name');
      if (nameF && !lr.name.toLowerCase().includes(nameF.toLowerCase())) return false;
      const startF = getDateFilter(colFilters, 'startDate');
      if (!matchDateRange(lr.startDate, startF.from, startF.to)) return false;
      const endF = getDateFilter(colFilters, 'endDate');
      if (!matchDateRange(lr.endDate, endF.from, endF.to)) return false;
      const days = getNumberFilter(colFilters, 'days');
      if (days.min && lr.totalDays < Number(days.min)) return false;
      if (days.max && lr.totalDays > Number(days.max)) return false;
      return true;
    });
  }, [colFilters, allLeave, dvContacts, searchTerm, consultantFilter, leaveTypeFilter, statusFilter, startDateFilter, endDateFilter]);

  const leaveTypesAll = useMemo(() => Array.from(new Set(allLeave.map(l => l.leaveType).filter(Boolean) as string[])), [allLeave]);
  const statusesAll = useMemo(() => Array.from(new Set(allLeave.map(l => (l as any).status).filter(Boolean) as string[])), [allLeave]);
  const hasActiveFilters = !!searchTerm || consultantFilter.length > 0 || leaveTypeFilter.length > 0 || statusFilter.length > 0 || startDateFilter.type !== 'all' || endDateFilter.type !== 'all';

  const filteredIds = filtered.map(lr => lr.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const consultantOptions = useMemo(() =>
    dvContacts
      .filter(c => c.contactType === 'Consultant' || c.contactType === 'Permanent Employee')
      .map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })),
  [dvContacts]);

  const openNew = () => {
    setEditLeave({ ...emptyLeave });
    setFormOpen(true);
  };

  const openEdit = (lr: LeaveRequest) => {
    setEditLeave({ ...lr });
    setFormOpen(true);
  };

  const updateField = <K extends keyof LeaveRequest>(key: K, val: LeaveRequest[K]) => {
    setEditLeave(prev => {
      const next = { ...prev, [key]: val };
      if (key === 'startDate' || key === 'endDate') {
        next.totalDays = calcWorkingDays(
          key === 'startDate' ? (val as string) : prev.startDate,
          key === 'endDate' ? (val as string) : prev.endDate
        );
      }
      return next;
    });
  };

  const saveLeave = async () => {
    if (!editLeave.contactId || !editLeave.startDate || !editLeave.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveLeaveRequest(editLeave, editLeave.id || undefined);
      toast.success(editLeave.id ? 'Leave request updated' : 'Leave request created');
      setFormOpen(false);
      await refetch();
    } catch (err: any) {
      console.error('Save failed:', err);
      toast.error(err?.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <HeaderSelectionBar
        count={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        entityLabel="requests"
        showActivate={false}
        showDeactivate={false}
        showDelete={true}
        onDelete={async () => {
          const ids = [...selectedIds];
          const ok = await confirm({ title: 'Delete leave request(s)', description: `Are you sure you want to delete ${ids.length} selected leave request(s)? This action cannot be undone.` });
          if (!ok) return;
          try {
            for (const id of ids) await removeLeaveRequest(id);
            toast.success(`${ids.length} request(s) deleted`);
            setSelectedIds([]);
            await refetch();
          } catch (err: any) { toast.error('Delete failed'); }
        }}
      />

      <PageHeader
        title="Leave Management"
        subtitle={loading ? 'Loading...' : `${filtered.length} of ${allLeave.length} requests${isLive ? '' : ' (mock data)'}`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
            <button className="csp-btn csp-btn-primary csp-btn-sm" onClick={openNew}>
              <Plus className="csp-icon-inline" /> Add Leave
            </button>
          </div>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search name, consultant..." />
          <MultiPill label="Consultant" values={consultantFilter} onChange={setConsultantFilter}
            options={consultantOptions.map(o => ({ value: o.value, label: o.label, count: allLeave.filter(l => l.contactId === o.value).length }))} />
          <MultiPill label="Leave Type" values={leaveTypeFilter} onChange={setLeaveTypeFilter}
            options={leaveTypesAll.map(t => ({ value: t, label: t, count: allLeave.filter(l => l.leaveType === t).length }))} />
          {statusesAll.length > 0 && (
            <MultiPill label="Status" values={statusFilter} onChange={setStatusFilter}
              options={statusesAll.map(s => ({ value: s, label: s, count: allLeave.filter(l => (l as any).status === s).length }))} />
          )}
          <DatePill label="Start Date" value={startDateFilter} onChange={setStartDateFilter} dates={allLeave.map(l => l.startDate).filter(Boolean) as string[]} />
          <DatePill label="End Date" value={endDateFilter} onChange={setEndDateFilter} dates={allLeave.map(l => l.endDate).filter(Boolean) as string[]} />
        </div>
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {consultantFilter.length > 0 && <FilterChip label={`Consultant: ${consultantFilter.map(id => consultantOptions.find(c => c.value === id)?.label).filter(Boolean).join(', ')}`} onRemove={() => setConsultantFilter([])} />}
            {leaveTypeFilter.length > 0 && <FilterChip label={`Leave Type: ${leaveTypeFilter.join(', ')}`} onRemove={() => setLeaveTypeFilter([])} />}
            {statusFilter.length > 0 && <FilterChip label={`Status: ${statusFilter.join(', ')}`} onRemove={() => setStatusFilter([])} />}
            {startDateFilter.type !== 'all' && <FilterChip label={`Start: ${relativeDateLabel(startDateFilter)}`} onRemove={() => setStartDateFilter({ type: 'all' })} />}
            {endDateFilter.type !== 'all' && <FilterChip label={`End: ${relativeDateLabel(endDateFilter)}`} onRemove={() => setEndDateFilter({ type: 'all' })} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setSearchTerm(''); setConsultantFilter([]); setLeaveTypeFilter([]); setStatusFilter([]); setStartDateFilter({ type: 'all' }); setEndDateFilter({ type: 'all' }); }}>Clear all</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="csp-table-wrapper">
        <table className="csp-table">
          <thead>
            <tr>
              <th className="csp-th csp-th-check">
                <Checkbox checked={allSelected} onChange={toggleAll} />
              </th>
              <th className="csp-th">
                Name
                <TextFilterPopover label="Name" value={getTextFilter(colFilters, 'name')} onChange={v => setTextFilter(setColFilters, 'name', v)} />
              </th>
              <th className="csp-th">
                Consultant
                <TextFilterPopover label="Consultant" value={getTextFilter(colFilters, 'consultant')} onChange={v => setTextFilter(setColFilters, 'consultant', v)} />
              </th>
              <th className="csp-th">
                Start
                <DateRangeFilterPopover label="Start Date" {...getDateFilter(colFilters, 'startDate')} onChange={(from, to) => setDateFilter(setColFilters, 'startDate', from, to)} />
              </th>
              <th className="csp-th">
                End
                <DateRangeFilterPopover label="End Date" {...getDateFilter(colFilters, 'endDate')} onChange={(from, to) => setDateFilter(setColFilters, 'endDate', from, to)} />
              </th>
              <th className="csp-th">
                Days
                <NumberRangeFilterPopover label="Days" {...getNumberFilter(colFilters, 'days')} onChange={(min, max) => setNumberFilter(setColFilters, 'days', min, max)} />
              </th>
              <th className="csp-th">Client Notified</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="csp-td csp-text-center csp-text-muted" style={{ padding: '2rem 0' }}>No leave requests match the current filters.</td></tr>
            ) : filtered.map(lr => (
              <tr key={lr.id} className="csp-tr" style={{ cursor: 'pointer' }} onClick={() => openEdit(lr)}>
                <td className="csp-td csp-td-check" onClick={e => e.stopPropagation()}>
                  <Checkbox checked={selectedIds.includes(lr.id)} onChange={c => toggleOne(lr.id, c)} />
                </td>
                <td className="csp-td" style={{ fontWeight: 500 }}>{lr.name}</td>
                <td className="csp-td">{getContactName(lr.contactId)}</td>
                <td className="csp-td">{lr.startDate}</td>
                <td className="csp-td">{lr.endDate}</td>
                <td className="csp-td">{lr.totalDays}</td>
                <td className="csp-td">{lr.clientNotified ? <span style={{ color: 'hsl(var(--primary))' }}><Check className="csp-icon-inline" /></span> : '\u2014'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit / New Leave Sheet */}
      <Sheet open={formOpen} onClose={() => setFormOpen(false)} title={editLeave.id ? 'Edit Leave' : 'Add Leave'}>
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>Details</h3>
          <div className="csp-form-grid-2">
            <LookupField label="Consultant" value={editLeave.contactId} onChange={v => updateField('contactId', v)} options={consultantOptions} required />
            <SelectField label="Leave Type" value={editLeave.leaveType || 'Annual Leave'} onChange={v => updateField('leaveType', v as any)} options={LEAVE_TYPES.map(t => ({ value: t, label: t }))} />
            <DateField label="Start Date" value={editLeave.startDate} onChange={v => updateField('startDate', v)} required />
            <DateField label="End Date" value={editLeave.endDate} onChange={v => updateField('endDate', v)} required />
            <TextField label="Total Days" value={String(editLeave.totalDays)} onChange={() => {}} readOnly />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: '1.5rem' }}>
              <Checkbox checked={editLeave.clientNotified} onChange={c => updateField('clientNotified', c)} />
              <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Client Notified</label>
            </div>
          </div>
        </div>
        <div className="csp-sheet-footer">
          <button className="csp-btn csp-btn-outline" onClick={() => setFormOpen(false)}>Cancel</button>
          <button className="csp-btn csp-btn-primary" disabled={isSaving} onClick={saveLeave}>
            {isSaving ? <><Spinner size="sm" /> Saving...</> : editLeave.id ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
