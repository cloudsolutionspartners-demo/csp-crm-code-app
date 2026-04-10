import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge } from '../components/Shared';
import { Sheet, Dialog, Tabs, ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, TextAreaField, EmailField, DateField, SelectField } from '../components/FormFields';
import { Plus, CheckCircle2, FileText, ArrowUpDown, X, User, UserX } from '../components/Icons';
import { cn, formatDate } from '../lib/utils';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover,
  DateRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getNumberFilter, getDateFilter,
  setTextFilter, setMultiFilter, setNumberFilter, setDateFilter,
  matchDateRange,
} from '../components/ColumnFilters';
import { onboardingCandidates as initialCandidates, availabilitySlots, getSlotById, contacts } from '../data/mock-data';
import type { OnboardingCandidate, CandidateStatus, CandidatePath, AvailabilitySlot } from '../types/crm';

const statusOptions: CandidateStatus[] = ['Applied', 'Scheduled', 'Fit', 'Not Fit'];
const pathOptions: CandidatePath[] = ['CIM to B2B', 'B2B seeking Contracts'];

const dayOrder: Record<string, number> = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };

function formatSlotLabel(slot: { dayOfWeek: string; startTime: string; endTime: string; weekStart: string }) {
  const ws = new Date(slot.weekStart);
  const dayIdx = dayOrder[slot.dayOfWeek] || 1;
  const mondayIdx = ws.getDay() === 0 ? 7 : ws.getDay();
  const diff = dayIdx - mondayIdx;
  const slotDate = new Date(ws);
  slotDate.setDate(ws.getDate() + diff);
  const day = slotDate.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
  return `${slot.dayOfWeek}, ${day}${suffix} ${slot.startTime} - ${slot.endTime}`;
}

function getSlotSortDate(slot: { dayOfWeek: string; startTime: string; weekStart: string }) {
  const ws = new Date(slot.weekStart);
  const dayIdx = dayOrder[slot.dayOfWeek] || 1;
  const mondayIdx = ws.getDay() === 0 ? 7 : ws.getDay();
  const diff = dayIdx - mondayIdx;
  const slotDate = new Date(ws);
  slotDate.setDate(ws.getDate() + diff);
  const [h, m] = slot.startTime.split(':').map(Number);
  slotDate.setHours(h, m, 0, 0);
  return slotDate.getTime();
}

const statusDotColors: Record<CandidateStatus, string> = {
  Applied: 'csp-dot-gray',
  Scheduled: 'csp-dot-amber',
  Fit: 'csp-dot-green',
  'Not Fit': 'csp-dot-red',
};

const statusRowColors: Record<CandidateStatus, string> = {
  Applied: '',
  Scheduled: 'csp-row-amber',
  Fit: 'csp-row-green',
  'Not Fit': 'csp-row-red',
};

export default function CandidatesPage() {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<OnboardingCandidate[]>(() => initialCandidates.map(c => ({ ...c })));
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [pathFilter, setPathFilter] = useState<string>('');
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedCandidate, setSelectedCandidate] = useState<OnboardingCandidate | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState('general');
  const [cvDialogOpen, setCvDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [slotSortAsc, setSlotSortAsc] = useState(true);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    statusOptions.forEach(s => { counts[s] = candidates.filter(c => c.status === s).length; });
    return counts;
  }, [candidates]);

  const openForm = (candidate: OnboardingCandidate) => {
    setIsNew(false);
    setSelectedCandidate(candidate);
    setActiveTab('general');
    setSlotSortAsc(true);
    setFormData({
      firstName: candidate.firstName, lastName: candidate.lastName, email: candidate.email,
      phone: candidate.phone || '', path: candidate.path, cvFileName: candidate.cvFileName,
      hourlyRateEur: candidate.hourlyRateEur, b2bEntityName: candidate.b2bEntityName || '',
      selectedSlots: candidate.selectedSlots, confirmedSlotId: candidate.confirmedSlotId || '',
      reviewerNotes: candidate.reviewerNotes || '', status: candidate.status,
      appliedDate: candidate.appliedDate, reviewedBy: candidate.reviewedBy || '',
      createdContactId: candidate.createdContactId || '', createdAccountId: candidate.createdAccountId || '',
    });
  };

  const openNewForm = () => {
    setIsNew(true);
    setSelectedCandidate({} as OnboardingCandidate);
    setActiveTab('general');
    setSlotSortAsc(true);
    setFormData({
      firstName: '', lastName: '', email: '', phone: '', path: 'B2B seeking Contracts',
      cvFileName: '', hourlyRateEur: 0, b2bEntityName: '', selectedSlots: [],
      confirmedSlotId: '', reviewerNotes: '', status: 'Applied', appliedDate: '',
      reviewedBy: '', createdContactId: '', createdAccountId: '',
    });
  };

  const closeForm = () => { setSelectedCandidate(null); setIsNew(false); };

  const saveForm = () => {
    const name = `${formData.firstName} ${formData.lastName}`.trim();
    if (!isNew && selectedCandidate?.id) {
      setCandidates(prev => prev.map(c => c.id === selectedCandidate.id ? { ...c, ...formData } : c));
    }
    toast.success(isNew ? `Candidate "${name}" created` : `Candidate "${name}" saved`);
    closeForm();
  };

  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const confirmSlot = (slotId: string) => {
    setFormData(prev => ({ ...prev, confirmedSlotId: slotId, status: 'Scheduled' }));
    if (selectedCandidate?.id) {
      setCandidates(prev => prev.map(c => c.id === selectedCandidate.id ? { ...c, confirmedSlotId: slotId, status: 'Scheduled' as CandidateStatus } : c));
    }
    toast.success('Slot confirmed. Status set to Scheduled.');
  };

  const cancelSlot = () => {
    setFormData(prev => ({ ...prev, confirmedSlotId: '', status: 'Applied' }));
    if (selectedCandidate?.id) {
      setCandidates(prev => prev.map(c => c.id === selectedCandidate.id ? { ...c, confirmedSlotId: undefined, status: 'Applied' as CandidateStatus } : c));
    }
    toast.success('Slot cancelled. Status set to Applied.');
  };

  const approveAndCreateRecords = () => {
    const contactId = `con-new-${Date.now()}`;
    const accountId = `acc-new-${Date.now()}`;
    setFormData(prev => ({ ...prev, createdContactId: contactId, createdAccountId: accountId }));
    if (selectedCandidate?.id) {
      setCandidates(prev => prev.map(c => c.id === selectedCandidate.id ? { ...c, createdContactId: contactId, createdAccountId: accountId } : c));
    }
    setConfirmDialogOpen(false);
    toast.success('Contact and Account records created successfully.');
  };

  const filtered = useMemo(() => {
    return candidates.filter(c => {
      if (statusFilter !== 'All' && c.status !== statusFilter) return false;
      if (pathFilter && c.path !== pathFilter) return false;
      const name = getTextFilter(colFilters, 'name');
      if (name && !`${c.firstName} ${c.lastName}`.toLowerCase().includes(name.toLowerCase())) return false;
      const email = getTextFilter(colFilters, 'email');
      if (email && !c.email.toLowerCase().includes(email.toLowerCase())) return false;
      const pathCol = getMultiFilter(colFilters, 'path');
      if (pathCol.length > 0 && !pathCol.includes(c.path)) return false;
      const rate = getNumberFilter(colFilters, 'rate');
      if (rate.min && c.hourlyRateEur < Number(rate.min)) return false;
      if (rate.max && c.hourlyRateEur > Number(rate.max)) return false;
      const b2b = getTextFilter(colFilters, 'b2b');
      if (b2b && !(c.b2bEntityName || '').toLowerCase().includes(b2b.toLowerCase())) return false;
      const applied = getDateFilter(colFilters, 'applied');
      if (!matchDateRange(c.appliedDate, applied.from, applied.to)) return false;
      return true;
    });
  }, [candidates, statusFilter, pathFilter, colFilters]);

  const filteredIds = filtered.map(c => c.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const candidateSlots = useMemo(() => {
    const slotIds = formData.selectedSlots || [];
    return availabilitySlots.filter(s => slotIds.includes(s.id));
  }, [formData.selectedSlots]);

  const sortedSlots = useMemo(() => {
    const sorted = [...candidateSlots].sort((a, b) => getSlotSortDate(a) - getSlotSortDate(b));
    return slotSortAsc ? sorted : sorted.reverse();
  }, [candidateSlots, slotSortAsc]);

  const groupedSlots = useMemo(() => {
    const groups: Record<string, AvailabilitySlot[]> = {};
    sortedSlots.forEach(s => {
      const key = `${s.startTime}-${s.endTime}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return groups;
  }, [sortedSlots]);

  const confirmedSlot = formData.confirmedSlotId ? getSlotById(formData.confirmedSlotId) : undefined;

  const getInterviewerName = (slot: AvailabilitySlot) => {
    if (!slot.interviewerId) return 'Unassigned';
    const c = contacts.find(ct => ct.id === slot.interviewerId);
    return c ? `${c.firstName} ${c.lastName}` : 'Unknown';
  };

  const isFit = formData.status === 'Fit';
  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'scheduling', label: 'Scheduling' },
    { id: 'review', label: 'Review' },
    ...(isFit ? [{ id: 'records', label: 'Created Records' }] : []),
  ];

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="candidates" />
      <PageHeader title="Onboarding Candidates" subtitle={`${filtered.length} of ${candidates.length} candidates`}
        action={<div className="csp-flex-gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <button className="csp-btn csp-btn-primary" onClick={openNewForm}><Plus className="csp-icon-inline" />Add Candidate</button>
        </div>} />

      <div className="csp-filter-bar">
        <div className="csp-filter-group">
          <span className="csp-filter-group-label">Status</span>
          <ToggleGroup value={statusFilter} onChange={setStatusFilter}>
            <ToggleGroupItem value="All">All</ToggleGroupItem>
            {statusOptions.map(s => (
              <ToggleGroupItem key={s} value={s}>{s}<span className="csp-toggle-count">{statusCounts[s]}</span></ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="csp-filter-group">
          <span className="csp-filter-group-label">Path</span>
          <ToggleGroup value={pathFilter} onChange={setPathFilter}>
            <ToggleGroupItem value="">All</ToggleGroupItem>
            {pathOptions.map(p => <ToggleGroupItem key={p} value={p}>{p}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
      </div>

      <div className="csp-legend-row">
        {statusOptions.map(s => (
          <span key={s} className="csp-legend-item">
            <span className={cn('csp-dot', statusDotColors[s])} />{s}
          </span>
        ))}
      </div>

      <div className="csp-table-wrapper">
        <table className="csp-table">
          <thead>
            <tr>
              <th className="csp-th-checkbox"><Checkbox checked={allSelected} onChange={toggleAll} /></th>
              <th>Name <TextFilterPopover label="Name" value={getTextFilter(colFilters, 'name')} onChange={v => setTextFilter(setColFilters, 'name', v)} /></th>
              <th>Email <TextFilterPopover label="Email" value={getTextFilter(colFilters, 'email')} onChange={v => setTextFilter(setColFilters, 'email', v)} /></th>
              <th>Path <MultiSelectFilterPopover label="Path" options={pathOptions} selected={getMultiFilter(colFilters, 'path')} onChange={v => setMultiFilter(setColFilters, 'path', v)} /></th>
              <th>Rate &euro;/h <NumberRangeFilterPopover label="Rate" min={getNumberFilter(colFilters, 'rate').min} max={getNumberFilter(colFilters, 'rate').max} onChange={(min, max) => setNumberFilter(setColFilters, 'rate', min, max)} /></th>
              <th>B2B Entity <TextFilterPopover label="B2B Entity" value={getTextFilter(colFilters, 'b2b')} onChange={v => setTextFilter(setColFilters, 'b2b', v)} /></th>
              <th>Applied <DateRangeFilterPopover label="Applied" from={getDateFilter(colFilters, 'applied').from} to={getDateFilter(colFilters, 'applied').to} onChange={(from, to) => setDateFilter(setColFilters, 'applied', from, to)} /></th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="csp-td-empty">No candidates match the current filters.</td></tr>
            ) : filtered.map(candidate => (
              <tr key={candidate.id} className={cn('csp-tr-clickable', statusRowColors[candidate.status])}>
                <td onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(candidate.id)} onChange={c => toggleOne(candidate.id, c)} /></td>
                <td className="csp-td-bold" onClick={() => openForm(candidate)}>{candidate.firstName} {candidate.lastName}</td>
                <td onClick={() => openForm(candidate)}>{candidate.email}</td>
                <td onClick={() => openForm(candidate)}>{candidate.path}</td>
                <td onClick={() => openForm(candidate)}>&euro;{candidate.hourlyRateEur}</td>
                <td onClick={() => openForm(candidate)}>{candidate.b2bEntityName || '\u2014'}</td>
                <td onClick={() => openForm(candidate)}>{formatDate(candidate.appliedDate)}</td>
                <td onClick={() => openForm(candidate)}><StatusBadge status={candidate.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selectedCandidate} onClose={closeForm}>
        {selectedCandidate && (
          <>
            <div className="csp-sheet-header">
              <div className="csp-sheet-title">
                {isNew ? 'New Candidate' : `${formData.firstName || ''} ${formData.lastName || ''}`}
              </div>
              {!isNew && <StatusBadge status={formData.status} />}
            </div>
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab}>
              {activeTab === 'general' && (
                <div className="csp-form-grid-2">
                  {isNew ? (
                    <>
                      <TextField label="First Name" value={formData.firstName} onChange={v => updateField('firstName', v)} required />
                      <TextField label="Last Name" value={formData.lastName} onChange={v => updateField('lastName', v)} required />
                      <EmailField label="Email" value={formData.email} onChange={v => updateField('email', v)} required />
                      <TextField label="Phone" value={formData.phone} onChange={v => updateField('phone', v)} />
                      <SelectField label="Path" value={formData.path} onChange={v => updateField('path', v)} options={pathOptions.map(p => ({ value: p, label: p }))} required />
                      <TextField label="Hourly Rate (EUR)" value={String(formData.hourlyRateEur)} onChange={v => updateField('hourlyRateEur', Number(v) || 0)} />
                      <TextField label="B2B Entity Name" value={formData.b2bEntityName} onChange={v => updateField('b2bEntityName', v)} />
                      <TextField label="CV File Name" value={formData.cvFileName} onChange={v => updateField('cvFileName', v)} />
                      <DateField label="Applied Date" value={formData.appliedDate} onChange={v => updateField('appliedDate', v)} />
                    </>
                  ) : (
                    <>
                      <TextField label="First Name" value={formData.firstName} onChange={() => {}} readOnly />
                      <TextField label="Last Name" value={formData.lastName} onChange={() => {}} readOnly />
                      <TextField label="Email" value={formData.email} onChange={() => {}} readOnly />
                      <TextField label="Phone" value={formData.phone} onChange={() => {}} readOnly />
                      <TextField label="Path" value={formData.path} onChange={() => {}} readOnly />
                      <TextField label="Hourly Rate (EUR)" value={`\u20AC${formData.hourlyRateEur}`} onChange={() => {}} readOnly />
                      <TextField label="B2B Entity Name" value={formData.b2bEntityName || '\u2014'} onChange={() => {}} readOnly />
                      <TextField label="Applied Date" value={formatDate(formData.appliedDate)} onChange={() => {}} readOnly />
                      <div className="csp-form-field">
                        <label className="csp-field-label">CV</label>
                        <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => setCvDialogOpen(true)}>
                          <FileText className="csp-icon-inline" />{formData.cvFileName || 'No CV'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'scheduling' && (
                <div className="csp-scheduling-tab">
                  {confirmedSlot && (
                    <div className="csp-confirmed-slot-card">
                      <div className="csp-confirmed-slot-header">
                        <CheckCircle2 className="csp-icon-inline csp-text-green" />
                        <span className="csp-text-bold">Confirmed Slot</span>
                      </div>
                      <p className="csp-text-sm">{formatSlotLabel(confirmedSlot)}</p>
                      <p className="csp-text-muted csp-text-xs">Interviewer: {getInterviewerName(confirmedSlot)}</p>
                      {confirmedSlot.teamsLink && (
                        <p className="csp-text-xs"><a href={confirmedSlot.teamsLink} target="_blank" rel="noopener noreferrer" className="csp-link">Teams Link</a></p>
                      )}
                      <button className="csp-btn csp-btn-destructive csp-btn-sm csp-mt-2" onClick={cancelSlot}>
                        <X className="csp-icon-inline" />Cancel Slot
                      </button>
                    </div>
                  )}

                  <div className="csp-slot-list-header">
                    <span className="csp-text-bold">Available Slots ({candidateSlots.length})</span>
                    <button className="csp-btn csp-btn-ghost csp-btn-sm" onClick={() => setSlotSortAsc(!slotSortAsc)}>
                      <ArrowUpDown className="csp-icon-inline" />{slotSortAsc ? 'Earliest First' : 'Latest First'}
                    </button>
                  </div>

                  {Object.entries(groupedSlots).map(([timeKey, slots]) => (
                    <div key={timeKey} className="csp-slot-group">
                      <div className="csp-slot-group-label">{timeKey}</div>
                      {slots.map(slot => {
                        const isConfirmed = formData.confirmedSlotId === slot.id;
                        return (
                          <div key={slot.id} className={cn('csp-slot-item', isConfirmed && 'csp-slot-item-confirmed')}>
                            <div className="csp-slot-item-info">
                              <span className="csp-text-sm">{formatSlotLabel(slot)}</span>
                              <span className="csp-text-muted csp-text-xs">{getInterviewerName(slot)}</span>
                            </div>
                            <div className="csp-slot-item-actions">
                              {isConfirmed ? (
                                <span className="csp-badge csp-badge-green">Confirmed</span>
                              ) : (
                                <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => confirmSlot(slot.id)}>
                                  {formData.confirmedSlotId ? 'Switch' : 'Confirm'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {candidateSlots.length === 0 && (
                    <p className="csp-text-muted csp-text-sm">No slots selected by this candidate.</p>
                  )}
                </div>
              )}

              {activeTab === 'review' && (
                <div className="csp-review-tab">
                  <TextField label="Reviewed By" value={formData.reviewedBy || '\u2014'} onChange={() => {}} readOnly />
                  <TextAreaField label="Reviewer Notes" value={formData.reviewerNotes || ''} onChange={() => {}} readOnly rows={4} />

                  {isFit && !formData.createdContactId && (
                    <div className="csp-mt-4">
                      <button className="csp-btn csp-btn-primary" onClick={() => setConfirmDialogOpen(true)}>
                        <CheckCircle2 className="csp-icon-inline" />Approve &amp; Create Contact + Account
                      </button>
                    </div>
                  )}

                  {isFit && formData.createdContactId && (
                    <p className="csp-text-muted csp-text-sm csp-mt-2">Records already created.</p>
                  )}
                </div>
              )}

              {activeTab === 'records' && (
                <div className="csp-records-tab">
                  <TextField label="Created Contact ID" value={formData.createdContactId || '\u2014'} onChange={() => {}} readOnly />
                  <TextField label="Created Account ID" value={formData.createdAccountId || '\u2014'} onChange={() => {}} readOnly />
                </div>
              )}
            </Tabs>
            <div className="csp-form-footer">
              <button className="csp-btn csp-btn-outline" onClick={closeForm}>Close</button>
              {isNew && <button className="csp-btn csp-btn-primary" onClick={saveForm}>Save</button>}
            </div>
          </>
        )}
      </Sheet>

      <Dialog open={cvDialogOpen} onClose={() => setCvDialogOpen(false)} title="CV Preview" maxWidth="500px">
        <div className="csp-cv-preview">
          <FileText className="csp-cv-preview-icon" />
          <p className="csp-text-bold">{formData.cvFileName || 'No file'}</p>
          <p className="csp-text-muted csp-text-sm">Simulated CV preview. The actual document would be rendered here.</p>
        </div>
        <div className="csp-dialog-footer">
          <button className="csp-btn csp-btn-outline" onClick={() => setCvDialogOpen(false)}>Close</button>
        </div>
      </Dialog>

      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)} title="Confirm Record Creation" maxWidth="480px">
        <div className="csp-confirm-content">
          <p className="csp-text-sm">This will create the following records for <strong>{formData.firstName} {formData.lastName}</strong>:</p>
          <ul className="csp-confirm-list">
            <li><User className="csp-icon-inline" /><strong>Contact</strong> &mdash; {formData.firstName} {formData.lastName} ({formData.email})</li>
            <li><UserX className="csp-icon-inline" /><strong>Account</strong> &mdash; {formData.b2bEntityName || `${formData.firstName} ${formData.lastName}`} (Contractor)</li>
          </ul>
          <p className="csp-text-muted csp-text-xs">This action cannot be undone.</p>
        </div>
        <div className="csp-dialog-footer">
          <button className="csp-btn csp-btn-outline" onClick={() => setConfirmDialogOpen(false)}>Cancel</button>
          <button className="csp-btn csp-btn-primary" onClick={approveAndCreateRecords}>
            <CheckCircle2 className="csp-icon-inline" />Create Records
          </button>
        </div>
      </Dialog>
    </div>
  );
}
