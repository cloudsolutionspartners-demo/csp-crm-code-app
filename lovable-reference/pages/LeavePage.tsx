import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { leaveRequests as initialLeaveRequests, getContactById, contacts } from '@/data/mock-data';
import type { LeaveRequest } from '@/types/crm';
import { toast } from 'sonner';
import { HeaderSelectionBar } from '@/components/HeaderSelectionBar';
import { TextField, DateField, LookupField } from '@/components/FormField';
import { Plus, Check } from 'lucide-react';
import {
  ColumnFilters, ClearColumnFiltersButton, matchDateRange,
} from '@/components/ColumnFilters';
import { SearchPill, MultiPill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, type RelativeDateValue } from '@/components/FilterPills';

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

export default function LeavePage() {
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allLeave, setAllLeave] = useState<LeaveRequest[]>(initialLeaveRequests);
  const [formOpen, setFormOpen] = useState(false);
  const [editLeave, setEditLeave] = useState<Omit<LeaveRequest, 'id'> & { id?: string }>(emptyLeave);

  const [searchTerm, setSearchTerm] = useState('');
  const [consultantFilter, setConsultantFilter] = useState<string[]>([]);
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [startDateFilter, setStartDateFilter] = useState<RelativeDateValue>({ type: 'all' });
  const [endDateFilter, setEndDateFilter] = useState<RelativeDateValue>({ type: 'all' });

  const consultantOptionsAll = useMemo(() => contacts
    .filter(c => c.contactType === 'Consultant' || c.contactType === 'Permanent Employee')
    .map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })), []);
  const leaveTypes = useMemo(() => [...new Set(allLeave.map(l => l.leaveType))], [allLeave]);
  const statuses = useMemo(() => [...new Set(allLeave.map(l => l.status))], [allLeave]);

  const filtered = useMemo(() => {
    const startRange = dateRangeFor(startDateFilter);
    const endRange = dateRangeFor(endDateFilter);
    return allLeave.filter(lr => {
      if (consultantFilter.length > 0 && !consultantFilter.includes(lr.contactId)) return false;
      if (leaveTypeFilter.length > 0 && !leaveTypeFilter.includes(lr.leaveType)) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(lr.status)) return false;
      if (startDateFilter.type !== 'all' && !matchDateRange(lr.startDate, startRange.from, startRange.to)) return false;
      if (endDateFilter.type !== 'all' && !matchDateRange(lr.endDate, endRange.from, endRange.to)) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const con = getContactById(lr.contactId);
        const conName = con ? `${con.firstName} ${con.lastName}`.toLowerCase() : '';
        if (!lr.name.toLowerCase().includes(q) && !conName.includes(q)) return false;
      }
      return true;
    });
  }, [searchTerm, consultantFilter, leaveTypeFilter, statusFilter, startDateFilter, endDateFilter, allLeave]);

  const filteredIds = filtered.map(lr => lr.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const consultantOptions = contacts
    .filter(c => c.contactType === 'Consultant' || c.contactType === 'Permanent Employee')
    .map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }));

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

  const saveLeave = () => {
    if (!editLeave.contactId || !editLeave.startDate || !editLeave.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (editLeave.id) {
      setAllLeave(prev => prev.map(lr => lr.id === editLeave.id ? { ...editLeave, id: editLeave.id! } as LeaveRequest : lr));
      toast.success('Leave request updated');
    } else {
      const nextNum = allLeave.length + 1;
      const name = `LEA-${String(nextNum).padStart(4, '0')}`;
      const newLr: LeaveRequest = { ...editLeave, name, id: `lr-${Date.now()}` } as LeaveRequest;
      setAllLeave(prev => [...prev, newLr]);
      toast.success('Leave request created');
    }
    setFormOpen(false);
  };

  const hasActiveFilters = !!searchTerm || consultantFilter.length > 0 || leaveTypeFilter.length > 0 || statusFilter.length > 0 || startDateFilter.type !== 'all' || endDateFilter.type !== 'all';

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="requests"
        showActivate={false} showDeactivate={false} />
      <PageHeader title="Leave Management" subtitle={`${filtered.length} of ${allLeave.length} requests`}
        action={<div className="flex items-center gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Add Leave</Button>
        </div>} />

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search name, consultant..." />
          <MultiPill label="Consultant" values={consultantFilter} onChange={setConsultantFilter}
            options={consultantOptionsAll.map(o => ({ value: o.value, label: o.label, count: allLeave.filter(l => l.contactId === o.value).length }))} />
          <MultiPill label="Leave Type" values={leaveTypeFilter} onChange={setLeaveTypeFilter}
            options={leaveTypes.map(t => ({ value: t, label: t, count: allLeave.filter(l => l.leaveType === t).length }))} />
          <MultiPill label="Status" values={statusFilter} onChange={setStatusFilter}
            options={statuses.map(s => ({ value: s, label: s, count: allLeave.filter(l => l.status === s).length }))} />
          <DatePill label="Start Date" value={startDateFilter} onChange={setStartDateFilter} dates={allLeave.map(l => l.startDate)} />
          <DatePill label="End Date" value={endDateFilter} onChange={setEndDateFilter} dates={allLeave.map(l => l.endDate)} />
        </div>
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {consultantFilter.length > 0 && <FilterChip label={`Consultant: ${consultantFilter.map(id => consultantOptionsAll.find(c => c.value === id)?.label).filter(Boolean).join(', ')}`} onRemove={() => setConsultantFilter([])} />}
            {leaveTypeFilter.length > 0 && <FilterChip label={`Leave Type: ${leaveTypeFilter.join(', ')}`} onRemove={() => setLeaveTypeFilter([])} />}
            {statusFilter.length > 0 && <FilterChip label={`Status: ${statusFilter.join(', ')}`} onRemove={() => setStatusFilter([])} />}
            {startDateFilter.type !== 'all' && <FilterChip label={`Start: ${relativeDateLabel(startDateFilter)}`} onRemove={() => setStartDateFilter({ type: 'all' })} />}
            {endDateFilter.type !== 'all' && <FilterChip label={`End: ${relativeDateLabel(endDateFilter)}`} onRemove={() => setEndDateFilter({ type: 'all' })} />}
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setSearchTerm(''); setConsultantFilter([]); setLeaveTypeFilter([]); setStatusFilter([]); setStartDateFilter({ type: 'all' }); setEndDateFilter({ type: 'all' }); }}>
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
              <TableHead>Consultant</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Client Notified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No leave requests match the current filters.</TableCell></TableRow>
            ) : filtered.map(lr => {
              const con = getContactById(lr.contactId);
              return (
                <TableRow key={lr.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(lr)}>
                  <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(lr.id)} onCheckedChange={c => toggleOne(lr.id, !!c)} /></TableCell>
                  <TableCell className="font-medium">{lr.name}</TableCell>
                  <TableCell>{con ? `${con.firstName} ${con.lastName}` : '—'}</TableCell>
                  <TableCell>{lr.startDate}</TableCell>
                  <TableCell>{lr.endDate}</TableCell>
                  <TableCell>{lr.totalDays}</TableCell>
                  <TableCell>{lr.clientNotified ? <Check className="h-4 w-4 text-primary" /> : '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editLeave.id ? 'Edit Leave' : 'Add Leave'}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-1">
            <h3 className="text-sm font-semibold text-foreground mb-3">Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <LookupField label="Consultant" value={editLeave.contactId} onChange={v => updateField('contactId', v)} options={consultantOptions} required />
              <LookupField label="Consultant" value={editLeave.contactId} onChange={v => updateField('contactId', v)} options={consultantOptions} required />
              <DateField label="Start Date" value={editLeave.startDate} onChange={v => updateField('startDate', v)} required />
              <DateField label="End Date" value={editLeave.endDate} onChange={v => updateField('endDate', v)} required />
              <TextField label="Total Days" value={String(editLeave.totalDays)} onChange={() => {}} readOnly />
              <div className="flex items-center gap-3 pt-6">
                <Checkbox checked={editLeave.clientNotified} onCheckedChange={c => updateField('clientNotified', !!c)} />
                <label className="text-sm font-medium">Client Notified</label>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={saveLeave}>{editLeave.id ? 'Save Changes' : 'Create'}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
