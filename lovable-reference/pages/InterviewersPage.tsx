import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { contacts, availabilitySlots, onboardingCandidates } from '@/data/mock-data';
import type { Contact, AvailabilitySlot } from '@/types/crm';
import { TextField, EmailField } from '@/components/FormField';
import { toast } from 'sonner';
import { format, parse, isValid } from 'date-fns';
import { HeaderSelectionBar } from '@/components/HeaderSelectionBar';
import {
  ColumnFilters, ClearColumnFiltersButton,
} from '@/components/ColumnFilters';
import { SearchPill, MultiPill, FilterChip } from '@/components/FilterPills';
import { CheckCircle2, Clock, User, Calendar } from 'lucide-react';

const interviewers = contacts.filter(c => c.isInterviewer);

const fmtDate = (d: string) => {
  const p = parse(d, 'yyyy-MM-dd', new Date());
  return isValid(p) ? format(p, 'dd MMM yyyy') : d;
};

const getCandidateName = (candidateId: string) => {
  const c = onboardingCandidates.find(x => x.id === candidateId);
  return c ? `${c.firstName} ${c.lastName}` : candidateId;
};

export default function InterviewersPage() {
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [selectedInterviewer, setSelectedInterviewer] = useState<Contact | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [slotsVersion, setSlotsVersion] = useState(0);

  const uniqueRoles = useMemo(() => [...new Set(interviewers.map(c => c.jobRole).filter(Boolean) as string[])].sort(), []);
  const uniqueCountries = useMemo(() => [...new Set(interviewers.map(c => c.country).filter(Boolean) as string[])].sort(), []);

  const openForm = (contact: Contact) => setSelectedInterviewer(contact);
  const closeForm = () => setSelectedInterviewer(null);

  // Slots assigned to each interviewer
  const slotsByInterviewer = useMemo(() => {
    const map: Record<string, AvailabilitySlot[]> = {};
    availabilitySlots.forEach(s => {
      if (s.interviewerId) {
        if (!map[s.interviewerId]) map[s.interviewerId] = [];
        map[s.interviewerId].push(s);
      }
    });
    return map;
  }, [slotsVersion]);

  // Pending (unassigned) slots
  const pendingSlots = useMemo(() => availabilitySlots.filter(s => s.status === 'New'), [slotsVersion]);

  const confirmSlot = (slot: AvailabilitySlot) => {
    if (!selectedInterviewer) return;
    const idx = availabilitySlots.findIndex(s => s.id === slot.id);
    if (idx >= 0) {
      availabilitySlots[idx] = {
        ...availabilitySlots[idx],
        interviewerId: selectedInterviewer.id,
        status: 'Booked',
        confirmedAt: format(new Date(), 'yyyy-MM-dd'),
      };
      toast.success(`Confirmed interview with ${getCandidateName(slot.candidateId)}`);
      setSlotsVersion(v => v + 1);
      setSelectedInterviewer({ ...selectedInterviewer });
    }
  };

  const cancelSlot = (slot: AvailabilitySlot) => {
    const idx = availabilitySlots.findIndex(s => s.id === slot.id);
    if (idx >= 0) {
      availabilitySlots[idx] = {
        ...availabilitySlots[idx],
        status: 'Cancelled',
        isActive: false,
      };
      toast.success(`Interview with ${getCandidateName(slot.candidateId)} cancelled`);
      setSlotsVersion(v => v + 1);
      if (selectedInterviewer) setSelectedInterviewer({ ...selectedInterviewer });
    }
  };

  const filtered = useMemo(() => {
    return interviewers.filter(c => {
      if (roleFilter.length > 0 && (!c.jobRole || !roleFilter.includes(c.jobRole))) return false;
      if (countryFilter.length > 0 && (!c.country || !countryFilter.includes(c.country))) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (
          !`${c.firstName} ${c.lastName}`.toLowerCase().includes(q) &&
          !c.email.toLowerCase().includes(q) &&
          !(c.jobRole || '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [searchTerm, roleFilter, countryFilter]);

  const filteredIds = filtered.map(c => c.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const hasActiveFilters = !!searchTerm || roleFilter.length > 0 || countryFilter.length > 0;

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="interviewers" showActivate={false} showDeactivate={false} showDelete showDownload />
      <PageHeader title="Interviewers" subtitle={`${filtered.length} of ${interviewers.length} interviewers`}
        action={<ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />} />

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search name, email, role..." />
          <MultiPill label="Role" values={roleFilter} onChange={setRoleFilter}
            options={uniqueRoles.map(r => ({ value: r, label: r, count: interviewers.filter(i => i.jobRole === r).length }))} />
          <MultiPill label="Country" values={countryFilter} onChange={setCountryFilter}
            options={uniqueCountries.map(c => ({ value: c, label: c, count: interviewers.filter(i => i.country === c).length }))} />
        </div>
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {roleFilter.length > 0 && <FilterChip label={`Role: ${roleFilter.join(', ')}`} onRemove={() => setRoleFilter([])} />}
            {countryFilter.length > 0 && <FilterChip label={`Country: ${countryFilter.join(', ')}`} onRemove={() => setCountryFilter([])} />}
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setSearchTerm(''); setRoleFilter([]); setCountryFilter([]); }}>
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
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Booked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No interviewers found.</TableCell></TableRow>
            ) : filtered.map(contact => {
              const assignedSlots = slotsByInterviewer[contact.id] || [];
              const confirmedCount = assignedSlots.filter(s => s.status === 'Booked').length;
              const completedCount = assignedSlots.filter(s => s.status === 'Completed').length;
              return (
                <TableRow key={contact.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(contact.id)} onCheckedChange={c => toggleOne(contact.id, !!c)} /></TableCell>
                  <TableCell className="font-medium" onClick={() => openForm(contact)}>{contact.firstName} {contact.lastName}</TableCell>
                  <TableCell className="text-sm" onClick={() => openForm(contact)}>{contact.email}</TableCell>
                  <TableCell onClick={() => openForm(contact)}>{contact.jobRole || '—'}</TableCell>
                  <TableCell onClick={() => openForm(contact)}>{contact.country || '—'}</TableCell>
                  <TableCell onClick={() => openForm(contact)}>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">{confirmedCount + completedCount}</span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selectedInterviewer} onOpenChange={closeForm}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedInterviewer && (() => {
            const mySlots = (slotsByInterviewer[selectedInterviewer.id] || [])
              .sort((a, b) => a.date.localeCompare(b.date));
            const currentPending = availabilitySlots.filter(s => s.status === 'New');

            return (
              <>
                <SheetHeader>
                  <SheetTitle>{selectedInterviewer.firstName} {selectedInterviewer.lastName}</SheetTitle>
                </SheetHeader>

                <div className="grid gap-4 mt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <TextField label="First Name" value={selectedInterviewer.firstName} onChange={() => {}} readOnly />
                    <TextField label="Last Name" value={selectedInterviewer.lastName} onChange={() => {}} readOnly />
                  </div>
                  <EmailField label="Email" value={selectedInterviewer.email} onChange={() => {}} />
                  <TextField label="Phone" value={selectedInterviewer.phone || ''} onChange={() => {}} readOnly />
                  <TextField label="Job Role" value={selectedInterviewer.jobRole || ''} onChange={() => {}} readOnly />
                  <TextField label="Country" value={selectedInterviewer.country || ''} onChange={() => {}} readOnly />
                </div>

                {/* Pending interview requests */}
                <div className="mt-6 pt-4 border-t">
                  <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    Pending Interview Requests ({currentPending.length})
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    These candidates have requested an interview slot. Click Confirm to accept.
                  </p>
                  {currentPending.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-4">No pending requests at the moment.</p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {currentPending.map(slot => (
                        <div key={slot.id} className="rounded-md border p-3 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-primary" />
                              <span className="text-sm font-medium">{getCandidateName(slot.candidateId)}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {slot.dayOfWeek}, {fmtDate(slot.date)} · {slot.startTime} – {slot.endTime}
                            </div>
                          </div>
                          <Button size="sm" onClick={() => confirmSlot(slot)} className="text-xs h-7">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* My confirmed / completed interviews */}
                <div className="mt-6 pt-4 border-t">
                  <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    My Interviews ({mySlots.length})
                  </h3>
                  {mySlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-4">No confirmed interviews yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto mt-2">
                      {mySlots.map(slot => (
                        <div key={slot.id} className="rounded-md border p-3 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-primary" />
                              <span className="text-sm font-medium">{getCandidateName(slot.candidateId)}</span>
                              <StatusBadge status={slot.status} />
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {slot.dayOfWeek}, {fmtDate(slot.date)} · {slot.startTime} – {slot.endTime}
                            </div>
                          </div>
                          {slot.status === 'Booked' && (
                            <Button size="sm" variant="outline" className="text-xs h-7 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => cancelSlot(slot)}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                  <Button variant="outline" onClick={closeForm}>Close</Button>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
