import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge, PageLoading } from '../components/Shared';
import { Sheet, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField } from '../components/FormFields';
import { Clock, User, CalendarIcon, CheckCircle2 } from '../components/Icons';
import {
  ColumnFilters, TextFilterPopover, ClearColumnFiltersButton,
  getTextFilter, setTextFilter,
} from '../components/ColumnFilters';
import { SearchPill, MultiPill, FilterChip } from '../components/FilterPills';
import { fetchContacts } from '../services/contactService';
import { fetchSlots, confirmSlot as apiConfirmSlot, cancelSlot as apiCancelSlot, SLOT_STATUS_PENDING, SLOT_STATUS_BOOKED } from '../services/availabilitySlotService';
import type { SlotRecord } from '../services/availabilitySlotService';
import { fetchCandidates } from '../services/candidateService';
import { useDataverse } from '../services/useDataverse';
import { contacts as mockContacts, onboardingCandidates as mockCandidates } from '../data/mock-data';

/* -- Date helpers ------------------------------------------------------- */

function parseDateTime(dt?: string): { date: Date; start: string; end: string } | null {
  if (!dt) return null;
  const d = new Date(dt);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const endDate = new Date(d.getTime() + 15 * 60000);
  const end = `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
  return { date: d, start, end };
}

function formatInterviewDate(dt?: string): string {
  const parsed = parseDateTime(dt);
  if (!parsed) return '—';
  const dayStr = parsed.date.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
  });
  return `${dayStr} · ${parsed.start} – ${parsed.end}`;
}

/* -- Page Component ------------------------------------------------------ */

import { useConfirm } from '../components/ConfirmDialog';

export default function InterviewersPage() {
  const { toast } = useToast();
  const confirm = useConfirm();

  const { data: contacts, loading: contactsLoading, refetch: refetchContacts } = useDataverse(fetchContacts, mockContacts as any[]);
  const { data: slots, refetch: refetchSlots } = useDataverse(fetchSlots, []);
  const { data: rawCandidates } = useDataverse(fetchCandidates, mockCandidates as any[]);

  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [countryFilter, setCountryFilter] = useState<string[]>([]);

  /* -- Candidate name lookup --------------------------------------------- */

  const getCandidateName = (candidateId: string): string => {
    if (!candidateId) return '—';
    const c = rawCandidates.find((x: any) => x.id === candidateId);
    return c ? `${(c as any).firstName} ${(c as any).lastName}` : '—';
  };

  /* -- Filter to interviewers only (isInterviewer === true) -------------- */

  const interviewers = useMemo(
    () => contacts.filter((c: any) => c.isInterviewer === true),
    [contacts],
  );

  /* -- Booked counts per interviewer ------------------------------------- */

  const bookedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    slots.forEach((s: SlotRecord) => {
      if (s.interviewerId && s.status === 'Active' && s.statusCode === SLOT_STATUS_BOOKED) {
        counts[s.interviewerId] = (counts[s.interviewerId] || 0) + 1;
      }
    });
    return counts;
  }, [slots]);

  /* -- Pending slots for the selected interviewer (statuscode = 1) ------- */

  const pendingSlots = useMemo(() => {
    if (!selectedContact) return [] as SlotRecord[];
    return slots.filter((s: SlotRecord) =>
      s.status === 'Active'
      && s.interviewerId === selectedContact.id
      && s.statusCode === SLOT_STATUS_PENDING
    );
  }, [slots, selectedContact]);

  /* -- Filtering --------------------------------------------------------- */

  const uniqueRoles = useMemo(() => Array.from(new Set(interviewers.map((c: any) => c.jobRole).filter(Boolean) as string[])).sort(), [interviewers]);
  const uniqueCountries = useMemo(() => Array.from(new Set(interviewers.map((c: any) => c.country).filter(Boolean) as string[])).sort(), [interviewers]);

  const filtered = useMemo(() => {
    return interviewers.filter((c: any) => {
      if (roleFilter.length > 0 && (!c.jobRole || !roleFilter.includes(c.jobRole))) return false;
      if (countryFilter.length > 0 && (!c.country || !countryFilter.includes(c.country))) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (
          !`${c.firstName} ${c.lastName}`.toLowerCase().includes(q) &&
          !(c.email || '').toLowerCase().includes(q) &&
          !(c.jobRole || '').toLowerCase().includes(q)
        ) return false;
      }
      const name = getTextFilter(colFilters, 'name');
      if (name && !`${c.firstName} ${c.lastName}`.toLowerCase().includes(name.toLowerCase())) return false;
      const email = getTextFilter(colFilters, 'email');
      if (email && !(c.email || '').toLowerCase().includes(email.toLowerCase())) return false;
      const role = getTextFilter(colFilters, 'role');
      if (role && !(c.jobRole || '').toLowerCase().includes(role.toLowerCase())) return false;
      return true;
    });
  }, [interviewers, searchTerm, roleFilter, countryFilter, colFilters]);

  const hasActiveFilters = !!searchTerm || roleFilter.length > 0 || countryFilter.length > 0;

  const filteredIds = filtered.map((c: any) => c.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) =>
    setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const openSheet = (contact: any) => setSelectedContact(contact);
  const closeSheet = () => setSelectedContact(null);

  /* -- Confirm / Cancel slot handlers ------------------------------------ */

  const confirmSlot = async (slot: SlotRecord) => {
    try {
      await apiConfirmSlot(slot.id);
      toast.success(`Confirmed interview with ${getCandidateName(slot.candidateId)}`);
      await refetchSlots();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to confirm slot');
    }
  };

  const cancelSlot = async (slot: SlotRecord) => {
    const ok = await confirm({ title: 'Cancel interview', description: `Are you sure you want to cancel the interview with ${getCandidateName(slot.candidateId)}? This action cannot be undone.` });
    if (!ok) return;
    try {
      await apiCancelSlot(slot.id);
      toast.success(`Interview with ${getCandidateName(slot.candidateId)} cancelled`);
      await refetchSlots();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel slot');
    }
  };

  /* -- Derived: booked interviews for selected contact (statuscode = 725070001) */

  const myInterviews = useMemo(() => {
    if (!selectedContact) return [] as SlotRecord[];
    return slots.filter((s: SlotRecord) =>
      s.status === 'Active'
      && s.interviewerId === selectedContact.id
      && s.statusCode === SLOT_STATUS_BOOKED
    );
  }, [slots, selectedContact]);

  /* -- Loading state ----------------------------------------------------- */

  if (contactsLoading && contacts.length === 0) {
    return <PageLoading message="Loading interviewers..." />;
  }

  /* -- Render ------------------------------------------------------------ */

  const cardStyle: React.CSSProperties = {
    border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  };

  return (
    <div>
      <HeaderSelectionBar
        count={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        entityLabel="interviewers"
        showActivate={false}
        showDeactivate={false}
        showDelete
        onDelete={async () => {
          const count = selectedIds.length;
          const ok = await confirm({ title: 'Delete interviewer(s)', description: `Are you sure you want to delete ${count} selected contact(s)? This action cannot be undone.` });
          if (!ok) return;
          try {
            const { deleteRecord } = await import('../services/dataverseService');
            for (const id of selectedIds) await deleteRecord('contacts', id);
            toast.success(`${count} contact(s) deleted`);
            setSelectedIds([]);
            await refetchContacts();
          } catch (err: any) {
            toast.error(err?.message || 'Failed to delete contacts');
          }
        }}
      />

      <PageHeader
        title="Interviewers"
        subtitle={`${filtered.length} of ${interviewers.length} interviewers`}
        action={<ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search name, email, role..." />
          <MultiPill label="Role" values={roleFilter} onChange={setRoleFilter}
            options={uniqueRoles.map(r => ({ value: r, label: r, count: interviewers.filter((i: any) => i.jobRole === r).length }))} />
          <MultiPill label="Country" values={countryFilter} onChange={setCountryFilter}
            options={uniqueCountries.map(c => ({ value: c, label: c, count: interviewers.filter((i: any) => i.country === c).length }))} />
        </div>
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {roleFilter.length > 0 && <FilterChip label={`Role: ${roleFilter.join(', ')}`} onRemove={() => setRoleFilter([])} />}
            {countryFilter.length > 0 && <FilterChip label={`Country: ${countryFilter.join(', ')}`} onRemove={() => setCountryFilter([])} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setSearchTerm(''); setRoleFilter([]); setCountryFilter([]); }}>Clear all</button>
          </div>
        )}
      </div>

      {/* ===== Table ===== */}
      <div className="csp-table-wrapper">
        <table className="csp-table">
          <thead>
            <tr>
              <th className="csp-th-checkbox">
                <Checkbox checked={allSelected} onChange={toggleAll} />
              </th>
              <th>
                Name{' '}
                <TextFilterPopover label="Name" value={getTextFilter(colFilters, 'name')}
                  onChange={v => setTextFilter(setColFilters, 'name', v)} />
              </th>
              <th>
                Email{' '}
                <TextFilterPopover label="Email" value={getTextFilter(colFilters, 'email')}
                  onChange={v => setTextFilter(setColFilters, 'email', v)} />
              </th>
              <th>
                Role{' '}
                <TextFilterPopover label="Role" value={getTextFilter(colFilters, 'role')}
                  onChange={v => setTextFilter(setColFilters, 'role', v)} />
              </th>
              <th>Booked</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="csp-td-empty">No interviewers match the current filters.</td>
              </tr>
            ) : (
              filtered.map((contact: any) => (
                <tr key={contact.id} className="csp-tr-clickable" onClick={() => openSheet(contact)}>
                  <td onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.includes(contact.id)} onChange={c => toggleOne(contact.id, c)} />
                  </td>
                  <td className="csp-td-bold">{contact.firstName} {contact.lastName}</td>
                  <td>{contact.email}</td>
                  <td>{contact.jobRole || '—'}</td>
                  <td><span className="csp-badge">{bookedCounts[contact.id] || 0}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ===== Detail Sheet ===== */}
      <Sheet open={!!selectedContact} onClose={closeSheet}>
        {selectedContact && (
          <>
            <div className="csp-sheet-header">
              <div className="csp-sheet-title">{selectedContact.firstName} {selectedContact.lastName}</div>
            </div>

            {/* Read-only contact info (managed from Contacts page) */}
            <div className="csp-form-grid-2">
              <TextField label="First Name" value={selectedContact.firstName} onChange={() => {}} readOnly />
              <TextField label="Last Name" value={selectedContact.lastName} onChange={() => {}} readOnly />
              <TextField label="Email" value={selectedContact.email || ''} onChange={() => {}} readOnly />
              <TextField label="Phone" value={selectedContact.phone || ''} onChange={() => {}} readOnly />
              <TextField label="Job Role" value={selectedContact.jobRole || ''} onChange={() => {}} readOnly />
              <TextField label="Country" value={selectedContact.country || ''} onChange={() => {}} readOnly />
            </div>

            {/* ===== Pending Interview Requests ===== */}
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ color: 'hsl(38, 92%, 50%)' }}><Clock className="csp-icon-inline" /></span>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>
                  Pending Interview Requests ({pendingSlots.length})
                </h3>
              </div>
              <p className="csp-text-muted csp-text-sm" style={{ marginTop: 0, marginBottom: 12 }}>
                These candidates have requested an interview slot. Click Confirm to accept.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingSlots.length === 0 ? (
                  <p className="csp-text-muted csp-text-sm">No pending requests at the moment.</p>
                ) : pendingSlots.map((slot: any) => (
                  <div key={slot.id} style={cardStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="csp-text-muted"><User className="csp-icon-inline" /></span>
                        <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                          {getCandidateName(slot.candidateId)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="csp-text-muted"><CalendarIcon className="csp-icon-inline" /></span>
                        <span className="csp-text-muted" style={{ fontSize: '0.75rem' }}>
                          {formatInterviewDate(slot.dateTime)}
                        </span>
                      </div>
                    </div>
                    <button
                      className="csp-btn csp-btn-sm"
                      style={{ backgroundColor: 'hsl(160, 84%, 39%)', color: 'white', borderColor: 'hsl(160, 84%, 39%)' }}
                      onClick={() => confirmSlot(slot)}
                    >
                      <CheckCircle2 className="csp-icon-inline" /> Confirm
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* ===== My Interviews ===== */}
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ color: 'hsl(160, 84%, 39%)' }}><CheckCircle2 className="csp-icon-inline" /></span>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>
                  My Interviews ({myInterviews.length})
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {myInterviews.length === 0 ? (
                  <p className="csp-text-muted csp-text-sm">No confirmed interviews yet.</p>
                ) : myInterviews.map((slot: any) => {
                  // Map "Active" with interviewer to "Booked" for display
                  const displayStatus = slot.status === 'Active' ? 'Booked' : slot.status;
                  return (
                    <div key={slot.id} style={cardStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="csp-text-muted"><User className="csp-icon-inline" /></span>
                          <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                            {getCandidateName(slot.candidateId)}
                          </span>
                          <StatusBadge status={displayStatus} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="csp-text-muted"><CalendarIcon className="csp-icon-inline" /></span>
                          <span className="csp-text-muted" style={{ fontSize: '0.75rem' }}>
                            {formatInterviewDate(slot.dateTime)}
                          </span>
                        </div>
                      </div>
                      {displayStatus === 'Booked' && (
                        <button
                          className="csp-btn csp-btn-outline csp-btn-sm"
                          style={{ color: 'hsl(0, 84%, 60%)', borderColor: 'hsl(0, 84%, 70%)' }}
                          onClick={() => cancelSlot(slot)}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="csp-form-footer">
              <button className="csp-btn csp-btn-outline" onClick={closeSheet}>Close</button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
