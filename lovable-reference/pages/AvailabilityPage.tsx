import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';

import { availabilitySlots, contacts, onboardingCandidates } from '@/data/mock-data';
import type { AvailabilitySlot, SlotStatus } from '@/types/crm';
import { format, parse, isValid } from 'date-fns';
import { HeaderSelectionBar } from '@/components/HeaderSelectionBar';
import { LookupField, TextField } from '@/components/FormField';
import {
  ColumnFilters, ClearColumnFiltersButton, matchDateRange,
} from '@/components/ColumnFilters';
import { SearchPill, SinglePill, MultiPill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, type RelativeDateValue } from '@/components/FilterPills';
import { User, Mail, Phone, Briefcase, Calendar, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const slotStatuses: SlotStatus[] = ['New', 'Booked', 'Cancelled', 'Completed'];
const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const getCandidateName = (candidateId: string) => {
  const c = onboardingCandidates.find(x => x.id === candidateId);
  return c ? `${c.firstName} ${c.lastName}` : candidateId;
};

const getInterviewerName = (interviewerId?: string) => {
  if (!interviewerId) return '—';
  const c = contacts.find(x => x.id === interviewerId);
  return c ? `${c.firstName} ${c.lastName}` : interviewerId;
};

const fmtDate = (d: string) => {
  const p = parse(d, 'yyyy-MM-dd', new Date());
  return isValid(p) ? format(p, 'dd MMM yyyy') : d;
};

export default function AvailabilityPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dayFilter, setDayFilter] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFilter, setDateFilter2] = useState<RelativeDateValue>({ type: 'all' });
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formInterviewerId, setFormInterviewerId] = useState<string>('');
  const [isChangingInterviewer, setIsChangingInterviewer] = useState(false);

  const interviewerOptions = useMemo(() =>
    contacts.filter(c => c.isInterviewer).map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })),
  []);

  const openSlot = (slot: AvailabilitySlot) => {
    setSelectedSlot(slot);
    setFormInterviewerId(slot.interviewerId || '');
    setIsChangingInterviewer(false);
  };
  const closeSlot = () => { setSelectedSlot(null); setIsChangingInterviewer(false); };

  const confirmSlot = () => {
    if (!selectedSlot || !formInterviewerId) return;
    const idx = availabilitySlots.findIndex(s => s.id === selectedSlot.id);
    if (idx >= 0) {
      availabilitySlots[idx] = {
        ...availabilitySlots[idx],
        interviewerId: formInterviewerId,
        status: 'Booked',
        confirmedAt: format(new Date(), 'yyyy-MM-dd'),
      };
      setSelectedSlot({ ...availabilitySlots[idx] });
      toast.success('Slot confirmed with interviewer');
    }
  };

  const filtered = useMemo(() => {
    return availabilitySlots.filter(s => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (dayFilter.length > 0 && !dayFilter.includes(s.dayOfWeek)) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const candName = getCandidateName(s.candidateId).toLowerCase();
        const intName = getInterviewerName(s.interviewerId).toLowerCase();
        if (!candName.includes(q) && !intName.includes(q)) return false;
      }
      if (dateFilter.type !== 'all') {
        const r = dateRangeFor(dateFilter);
        if (!matchDateRange(s.date, r.from, r.to)) return false;
      }
      return true;
    });
  }, [statusFilter, dayFilter, searchTerm, dateFilter]);

  const filteredIds = filtered.map(s => s.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const hasActiveFilters = !!searchTerm || !!statusFilter || dayFilter.length > 0 || dateFilter.type !== 'all';

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="slots" showDelete showDownload />
      <PageHeader title="Availability Slots" subtitle={`${filtered.length} of ${availabilitySlots.length} slots`}
        action={<ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />} />

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search candidate or interviewer..." />
          <SinglePill label="Status" value={statusFilter} onChange={setStatusFilter}
            options={slotStatuses.map(s => ({ value: s, label: s, count: availabilitySlots.filter(sl => sl.status === s).length }))} />
          <MultiPill label="Day" values={dayFilter} onChange={setDayFilter}
            options={daysOfWeek.map(d => ({ value: d, label: d, count: availabilitySlots.filter(sl => sl.dayOfWeek === d).length }))} />
          <DatePill label="Date" value={dateFilter} onChange={setDateFilter2} dates={availabilitySlots.map(s => s.date)} />
        </div>
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('')} />}
            {dayFilter.length > 0 && <FilterChip label={`Day: ${dayFilter.join(', ')}`} onRemove={() => setDayFilter([])} />}
            {dateFilter.type !== 'all' && <FilterChip label={`Date: ${relativeDateLabel(dateFilter)}`} onRemove={() => setDateFilter2({ type: 'all' })} />}
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setSearchTerm(''); setStatusFilter(''); setDayFilter([]); setDateFilter2({ type: 'all' }); }}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead>Day</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Interviewer</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No slots match the current filters.</TableCell></TableRow>
            ) : filtered.map(slot => (
              <TableRow key={slot.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(slot.id)} onCheckedChange={c => toggleOne(slot.id, !!c)} /></TableCell>
                <TableCell className="font-medium" onClick={() => openSlot(slot)}>{getCandidateName(slot.candidateId)}</TableCell>
                <TableCell onClick={() => openSlot(slot)}>{slot.dayOfWeek}</TableCell>
                <TableCell onClick={() => openSlot(slot)}>{fmtDate(slot.date)}</TableCell>
                <TableCell onClick={() => openSlot(slot)}>{slot.startTime} – {slot.endTime}</TableCell>
                <TableCell onClick={() => openSlot(slot)}>{getInterviewerName(slot.interviewerId)}</TableCell>
                <TableCell onClick={() => openSlot(slot)}><StatusBadge status={slot.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Slot detail panel */}
      <Sheet open={!!selectedSlot} onOpenChange={closeSlot}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedSlot && (() => {
            const candidate = onboardingCandidates.find(c => c.id === selectedSlot.candidateId);
            const interviewer = selectedSlot.interviewerId ? contacts.find(c => c.id === selectedSlot.interviewerId) : null;
            return (
              <>
                <SheetHeader>
                  <SheetTitle>Interview Request</SheetTitle>
                  <div className="mt-1"><StatusBadge status={selectedSlot.status} /></div>
                </SheetHeader>

                {/* Candidate info */}
                <div className="mt-6">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Candidate</h3>
                  {candidate ? (
                    <div className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{candidate.firstName} {candidate.lastName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {candidate.email}</div>
                      {candidate.phone && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {candidate.phone}</div>}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Briefcase className="h-3.5 w-3.5" /> {candidate.path}</div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Candidate not found</p>
                  )}
                </div>

                {/* Slot details */}
                <div className="mt-6 pt-4 border-t">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Requested Slot</h3>
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{selectedSlot.dayOfWeek}, {fmtDate(selectedSlot.date)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground ml-6">{selectedSlot.startTime} – {selectedSlot.endTime}</p>
                    {selectedSlot.teamsLink && (
                      <a href={selectedSlot.teamsLink} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary underline ml-6 truncate">
                        Teams Link
                      </a>
                    )}
                  </div>
                </div>

                {/* Interviewer assignment */}
                <div className="mt-6 pt-4 border-t">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Interviewer Assignment</h3>
                  {selectedSlot.status === 'New' || (selectedSlot.status === 'Booked' && isChangingInterviewer) ? (
                    <div className="space-y-3">
                      <LookupField label={isChangingInterviewer ? "Change Interviewer" : "Assign Interviewer"} value={formInterviewerId} onChange={setFormInterviewerId} options={interviewerOptions} placeholder="Search interviewer..." />
                      <div className="flex gap-2">
                        <Button onClick={confirmSlot} disabled={!formInterviewerId} className="flex-1">
                          <CheckCircle2 className="h-4 w-4 mr-2" /> {isChangingInterviewer ? 'Update Interviewer' : 'Confirm & Assign'}
                        </Button>
                        {isChangingInterviewer && (
                          <Button variant="outline" onClick={() => { setIsChangingInterviewer(false); setFormInterviewerId(selectedSlot.interviewerId || ''); }}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : interviewer ? (
                    <div className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">{interviewer.firstName} {interviewer.lastName}</span>
                        </div>
                        {selectedSlot.status === 'Booked' && (
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setIsChangingInterviewer(true)}>
                            Change
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {interviewer.email}</div>
                      {selectedSlot.confirmedAt && (
                        <p className="text-xs text-muted-foreground">Confirmed on {fmtDate(selectedSlot.confirmedAt)}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No interviewer assigned</p>
                  )}
                </div>

                <div className="flex justify-end mt-6 pt-4 border-t">
                  <Button variant="outline" onClick={closeSlot}>Close</Button>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
