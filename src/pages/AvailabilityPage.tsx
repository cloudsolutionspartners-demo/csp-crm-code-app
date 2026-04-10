import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge } from '../components/Shared';
import { Sheet, Dialog, ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { cn, formatDate } from '../lib/utils';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, DateRangeFilterPopover,
  ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getDateFilter,
  setTextFilter, setMultiFilter, setDateFilter,
  matchDateRange,
} from '../components/ColumnFilters';
import { availabilitySlots, contacts, onboardingCandidates } from '../data/mock-data';
import { FileText, User, Mail, Phone, Briefcase, MapPin, DollarSign, CalendarIcon } from '../components/Icons';
import type { AvailabilitySlot, SlotStatus, Contact, OnboardingCandidate } from '../types/crm';

const statusOptions: SlotStatus[] = ['Available', 'Fully Booked', 'Expired'];
const dayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function ordinalSuffix(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function slotActualDate(weekStart: string, dayOfWeek: string): string {
  const ws = new Date(weekStart);
  if (isNaN(ws.getTime())) return '';
  const dayIdx = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(dayOfWeek);
  if (dayIdx < 0) return '';
  const d = new Date(ws);
  d.setDate(d.getDate() + dayIdx);
  return `${dayOfWeek}, ${ordinalSuffix(d.getDate())}`;
}

function slotFullDate(weekStart: string, dayOfWeek: string): string {
  const ws = new Date(weekStart);
  if (isNaN(ws.getTime())) return '';
  const dayIdx = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(dayOfWeek);
  if (dayIdx < 0) return '';
  const d = new Date(ws);
  d.setDate(d.getDate() + dayIdx);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${dayOfWeek}, ${ordinalSuffix(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="csp-detail-row">
      <span className="csp-text-muted">{icon}</span>
      <div>
        <span className="csp-filter-group-label">{label}</span>
        <p className="csp-text-sm">{value}</p>
      </div>
    </div>
  );
}

export default function AvailabilityPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('Available');
  const [dayFilter, setDayFilter] = useState<string>('');
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [interviewerDialogData, setInterviewerDialogData] = useState<Contact | null>(null);
  const [candidateDialogData, setCandidateDialogData] = useState<OnboardingCandidate | null>(null);
  const [cvDialogOpen, setCvDialogOpen] = useState(false);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    statusOptions.forEach(s => { counts[s] = availabilitySlots.filter(sl => sl.status === s).length; });
    return counts;
  }, []);

  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    dayOptions.forEach(d => { counts[d] = availabilitySlots.filter(sl => sl.dayOfWeek === d).length; });
    return counts;
  }, []);

  const getInterviewerForSlot = (slot: AvailabilitySlot): Contact | undefined => {
    if (!slot.interviewerId) return undefined;
    return contacts.find(c => c.id === slot.interviewerId);
  };

  const getCandidateForSlot = (slot: AvailabilitySlot): OnboardingCandidate | undefined => {
    return onboardingCandidates.find(c => c.confirmedSlotId === slot.id);
  };

  const getInterviewerCount = (slot: AvailabilitySlot): number => {
    return slot.interviewerId ? 1 : 0;
  };

  const filtered = useMemo(() => {
    return availabilitySlots.filter(s => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (dayFilter && s.dayOfWeek !== dayFilter) return false;
      const dayCol = getMultiFilter(colFilters, 'day');
      if (dayCol.length > 0 && !dayCol.includes(s.dayOfWeek)) return false;
      const start = getTextFilter(colFilters, 'start');
      if (start && !s.startTime.includes(start)) return false;
      const end = getTextFilter(colFilters, 'end');
      if (end && !s.endTime.includes(end)) return false;
      const weekStart = getDateFilter(colFilters, 'weekStart');
      if (!matchDateRange(s.weekStart, weekStart.from, weekStart.to)) return false;
      const weekEnd = getDateFilter(colFilters, 'weekEnd');
      if (!matchDateRange(s.weekEnd, weekEnd.from, weekEnd.to)) return false;
      const teams = getTextFilter(colFilters, 'teams');
      if (teams && !s.teamsLink.toLowerCase().includes(teams.toLowerCase())) return false;
      const statusCol = getMultiFilter(colFilters, 'status');
      if (statusCol.length > 0 && !statusCol.includes(s.status)) return false;
      return true;
    });
  }, [statusFilter, dayFilter, colFilters]);

  const filteredIds = filtered.map(s => s.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const openSlot = (slot: AvailabilitySlot) => setSelectedSlot(slot);
  const closeSlot = () => setSelectedSlot(null);

  const slotInterviewers = useMemo(() => {
    if (!selectedSlot) return [];
    const interviewer = getInterviewerForSlot(selectedSlot);
    if (!interviewer) return [];
    const candidate = getCandidateForSlot(selectedSlot);
    return [{ interviewer, candidate }];
  }, [selectedSlot]);

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="slots" />
      <PageHeader title="Availability Slots" subtitle={`${filtered.length} of ${availabilitySlots.length} slots`}
        action={<ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />} />

      <div className="csp-filter-bar">
        <div className="csp-filter-group">
          <span className="csp-filter-group-label">Status</span>
          <ToggleGroup value={statusFilter} onChange={setStatusFilter}>
            <ToggleGroupItem value="">All</ToggleGroupItem>
            {statusOptions.map(s => (
              <ToggleGroupItem key={s} value={s}>{s}<span className="csp-toggle-count">{statusCounts[s]}</span></ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="csp-filter-group">
          <span className="csp-filter-group-label">Day</span>
          <ToggleGroup value={dayFilter} onChange={setDayFilter}>
            <ToggleGroupItem value="">All</ToggleGroupItem>
            {dayOptions.map(d => (
              <ToggleGroupItem key={d} value={d}>{d.slice(0, 3)}<span className="csp-toggle-count">{dayCounts[d]}</span></ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <div className="csp-table-wrapper">
        <table className="csp-table">
          <thead>
            <tr>
              <th className="csp-th-checkbox"><Checkbox checked={allSelected} onChange={toggleAll} /></th>
              <th>Day <MultiSelectFilterPopover label="Day" options={dayOptions} selected={getMultiFilter(colFilters, 'day')} onChange={v => setMultiFilter(setColFilters, 'day', v)} /></th>
              <th>Start <TextFilterPopover label="Start" value={getTextFilter(colFilters, 'start')} onChange={v => setTextFilter(setColFilters, 'start', v)} /></th>
              <th>End <TextFilterPopover label="End" value={getTextFilter(colFilters, 'end')} onChange={v => setTextFilter(setColFilters, 'end', v)} /></th>
              <th>Week Start <DateRangeFilterPopover label="Week Start" from={getDateFilter(colFilters, 'weekStart').from} to={getDateFilter(colFilters, 'weekStart').to} onChange={(from, to) => setDateFilter(setColFilters, 'weekStart', from, to)} /></th>
              <th>Week End <DateRangeFilterPopover label="Week End" from={getDateFilter(colFilters, 'weekEnd').from} to={getDateFilter(colFilters, 'weekEnd').to} onChange={(from, to) => setDateFilter(setColFilters, 'weekEnd', from, to)} /></th>
              <th>Teams Link <TextFilterPopover label="Teams Link" value={getTextFilter(colFilters, 'teams')} onChange={v => setTextFilter(setColFilters, 'teams', v)} /></th>
              <th>Status <MultiSelectFilterPopover label="Status" options={statusOptions} selected={getMultiFilter(colFilters, 'status')} onChange={v => setMultiFilter(setColFilters, 'status', v)} /></th>
              <th>Interviewers</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="csp-td-empty">No slots match the current filters.</td></tr>
            ) : filtered.map(slot => (
              <tr key={slot.id} className="csp-tr-clickable" onClick={() => openSlot(slot)}>
                <td onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(slot.id)} onChange={c => toggleOne(slot.id, c)} /></td>
                <td>{slotActualDate(slot.weekStart, slot.dayOfWeek)}</td>
                <td>{slot.startTime}</td>
                <td>{slot.endTime}</td>
                <td>{formatDate(slot.weekStart)}</td>
                <td>{formatDate(slot.weekEnd)}</td>
                <td className="csp-td-truncate" title={slot.teamsLink}>{slot.teamsLink ? slot.teamsLink.substring(0, 35) + '...' : '\u2014'}</td>
                <td><StatusBadge status={slot.status} /></td>
                <td><span className="csp-badge">{getInterviewerCount(slot)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selectedSlot} onClose={closeSlot}>
        {selectedSlot && (
          <>
            <div className="csp-sheet-header">
              <div className="csp-sheet-title">Slot Details</div>
              <StatusBadge status={selectedSlot.status} />
            </div>
            <div className="csp-slot-details">
              <DetailRow icon={<CalendarIcon className="csp-icon-sm" />} label="Date" value={slotFullDate(selectedSlot.weekStart, selectedSlot.dayOfWeek)} />
              <DetailRow icon={<CalendarIcon className="csp-icon-sm" />} label="Time" value={`${selectedSlot.startTime} - ${selectedSlot.endTime}`} />
              <DetailRow icon={<CalendarIcon className="csp-icon-sm" />} label="Week Range" value={`${formatDate(selectedSlot.weekStart)} - ${formatDate(selectedSlot.weekEnd)}`} />
              {selectedSlot.teamsLink && (
                <div className="csp-detail-row">
                  <span className="csp-text-muted"><Briefcase className="csp-icon-sm" /></span>
                  <div>
                    <span className="csp-filter-group-label">Teams Link</span>
                    <p className="csp-text-sm"><a href={selectedSlot.teamsLink} target="_blank" rel="noopener noreferrer" className="csp-link">{selectedSlot.teamsLink}</a></p>
                  </div>
                </div>
              )}
            </div>

            <div className="csp-mt-4">
              <h3 className="csp-section-title">Assigned Interviewers</h3>
              {slotInterviewers.length === 0 ? (
                <p className="csp-text-muted csp-text-sm">No interviewers assigned to this slot.</p>
              ) : (
                <div className="csp-interviewer-list">
                  {slotInterviewers.map(({ interviewer, candidate }) => (
                    <div key={interviewer.id} className="csp-interviewer-card">
                      <div className="csp-interviewer-card-header">
                        <button className="csp-btn csp-btn-ghost csp-text-bold" onClick={() => setInterviewerDialogData(interviewer)}>
                          <User className="csp-icon-inline" />{interviewer.firstName} {interviewer.lastName}
                        </button>
                        <span className="csp-text-muted csp-text-xs">{interviewer.jobRole || ''}</span>
                      </div>
                      {candidate ? (
                        <div className="csp-interviewer-candidate">
                          <span className="csp-text-xs csp-text-muted">Linked candidate:</span>
                          <button className="csp-btn csp-btn-ghost csp-btn-sm" onClick={() => setCandidateDialogData(candidate)}>
                            {candidate.firstName} {candidate.lastName}
                          </button>
                        </div>
                      ) : (
                        <span className="csp-text-xs csp-text-muted">No candidate linked</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="csp-form-footer">
              <button className="csp-btn csp-btn-outline" onClick={closeSlot}>Close</button>
            </div>
          </>
        )}
      </Sheet>

      <Dialog open={!!interviewerDialogData} onClose={() => setInterviewerDialogData(null)} title="Interviewer Details" maxWidth="480px">
        {interviewerDialogData && (
          <div className="csp-dialog-details">
            <DetailRow icon={<Briefcase className="csp-icon-sm" />} label="Role" value={interviewerDialogData.jobRole || '\u2014'} />
            <DetailRow icon={<Mail className="csp-icon-sm" />} label="Email" value={interviewerDialogData.email} />
            <DetailRow icon={<Phone className="csp-icon-sm" />} label="Phone" value={interviewerDialogData.phone || '\u2014'} />
            <DetailRow icon={<User className="csp-icon-sm" />} label="Type" value={interviewerDialogData.contactType} />
            <DetailRow icon={<MapPin className="csp-icon-sm" />} label="Country" value={interviewerDialogData.country || '\u2014'} />
            {interviewerDialogData.skillset && interviewerDialogData.skillset.length > 0 && (
              <div className="csp-detail-row">
                <span className="csp-text-muted"><Briefcase className="csp-icon-sm" /></span>
                <div>
                  <span className="csp-filter-group-label">Skills</span>
                  <div className="csp-skill-badges">
                    {interviewerDialogData.skillset.map(skill => (
                      <span key={skill} className="csp-badge">{skill}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="csp-dialog-footer">
          <button className="csp-btn csp-btn-outline" onClick={() => setInterviewerDialogData(null)}>Close</button>
        </div>
      </Dialog>

      <Dialog open={!!candidateDialogData && !cvDialogOpen} onClose={() => setCandidateDialogData(null)} title="Candidate Details" maxWidth="480px">
        {candidateDialogData && (
          <div className="csp-dialog-details">
            <DetailRow icon={<Mail className="csp-icon-sm" />} label="Email" value={candidateDialogData.email} />
            <DetailRow icon={<Phone className="csp-icon-sm" />} label="Phone" value={candidateDialogData.phone || '\u2014'} />
            <DetailRow icon={<Briefcase className="csp-icon-sm" />} label="Path" value={candidateDialogData.path} />
            <DetailRow icon={<DollarSign className="csp-icon-sm" />} label="Rate" value={`\u20AC${candidateDialogData.hourlyRateEur}/h`} />
            <DetailRow icon={<MapPin className="csp-icon-sm" />} label="B2B Entity" value={candidateDialogData.b2bEntityName || '\u2014'} />
            <div className="csp-detail-row">
              <span className="csp-text-muted"><FileText className="csp-icon-sm" /></span>
              <div>
                <span className="csp-filter-group-label">CV</span>
                <button className="csp-btn csp-btn-ghost csp-btn-sm" onClick={() => setCvDialogOpen(true)}>
                  {candidateDialogData.cvFileName}
                </button>
              </div>
            </div>
            <DetailRow icon={<CalendarIcon className="csp-icon-sm" />} label="Applied Date" value={formatDate(candidateDialogData.appliedDate)} />
            <div className="csp-detail-row">
              <span className="csp-text-muted"><User className="csp-icon-sm" /></span>
              <div>
                <span className="csp-filter-group-label">Status</span>
                <StatusBadge status={candidateDialogData.status} />
              </div>
            </div>
            {candidateDialogData.reviewerNotes && (
              <DetailRow icon={<FileText className="csp-icon-sm" />} label="Notes" value={candidateDialogData.reviewerNotes} />
            )}
          </div>
        )}
        <div className="csp-dialog-footer">
          <button className="csp-btn csp-btn-outline" onClick={() => setCandidateDialogData(null)}>Close</button>
        </div>
      </Dialog>

      <Dialog open={cvDialogOpen} onClose={() => setCvDialogOpen(false)} title="CV Preview" maxWidth="500px">
        <div className="csp-cv-preview">
          <FileText className="csp-cv-preview-icon" />
          <p className="csp-text-bold">{candidateDialogData?.cvFileName || 'No file'}</p>
          <p className="csp-text-muted csp-text-sm">Simulated CV preview. The actual document would be rendered here.</p>
        </div>
        <div className="csp-dialog-footer">
          <button className="csp-btn csp-btn-outline" onClick={() => setCvDialogOpen(false)}>Close</button>
        </div>
      </Dialog>
    </div>
  );
}
