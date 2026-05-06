import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { timesheets as initialTimesheets, getContactById, getContractById, getAccountById, contracts } from '@/data/mock-data';
import type { Timesheet, TimesheetStatus, TimesheetEntry, Contract } from '@/types/crm';
import { toast } from 'sonner';
import { HeaderSelectionBar } from '@/components/HeaderSelectionBar';
import { TextField, LookupField, DateField } from '@/components/FormField';
import { Search, CheckCircle, RotateCcw, Loader2, Calendar, FileSpreadsheet, Check, Sparkles, SkipForward, ArrowRight, Table as TableIcon, Users, CalendarDays, Building2, Download, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { GroupedByAccountView, MonthlyTimelineView, ByConsultantView } from '@/components/timesheet/TimesheetAlternativeViews';
import { SendTimesheetReportFlow } from '@/components/timesheet/SendTimesheetReportFlow';
import { Progress } from '@/components/ui/progress';
import {
  ColumnFilters, TextFilterPopover, NumberRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getNumberFilter, setTextFilter, setNumberFilter, matchDateRange,
} from '@/components/ColumnFilters';
import { SearchPill, SinglePill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, type RelativeDateValue } from '@/components/FilterPills';

const tsStatuses: TimesheetStatus[] = ['Draft', 'Submitted', 'Approved', 'Rejected'];
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

/** Determine how hours should be pre-populated for a contract */
type HourStrategy = 'eight' | 'zero' | 'ask' | 'exclude';
function getHourStrategy(contract: Contract): HourStrategy {
  if (contract.contractType === 'Fixed Price' && contract.billingType === 'Fixed Price') return 'exclude';
  if (contract.contractType === 'Standard Contracting' && contract.billingType === 'Standard Contracting') return 'eight';
  if (contract.contractType === 'Standard Contracting' && contract.billingType === 'Time & Material') return 'zero';
  if (contract.contractType === 'Standard Contracting' && contract.billingType === 'Fixed Price') return 'ask';
  // Default for other combos
  return 'zero';
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function buildEntries(weekStartStr: string, dailyHours: number): TimesheetEntry[] {
  const entries: TimesheetEntry[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartStr);
    d.setDate(d.getDate() + i);
    const hrs = dailyHours > 0 && isWeekday(d) ? dailyHours : 0;
    entries.push({ date: d.toISOString().split('T')[0], hours: hrs });
  }
  return entries;
}

export default function TimesheetsPage() {
  const [allTimesheets, setAllTimesheets] = useState<Timesheet[]>(initialTimesheets);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [weekStartFilter, setWeekStartFilter] = useState<RelativeDateValue>({ type: 'all' });
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'account' | 'timeline' | 'consultant'>('table');
  const [selectedContractIds, setSelectedContractIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Timesheet | null>(null);
  const [formEntries, setFormEntries] = useState<TimesheetEntry[]>([]);
  const [returnDialog, setReturnDialog] = useState(false);
  const [returnComment, setReturnComment] = useState('');
  const [commentDialog, setCommentDialog] = useState<{ open: boolean; idx: number; value: string }>({ open: false, idx: 0, value: '' });
  const [generateDialog, setGenerateDialog] = useState(false);
  const [reportDialog, setReportDialog] = useState(false);
  const [genMonth, setGenMonth] = useState<string>(String(new Date().getMonth()));
  const [genYearToggle, setGenYearToggle] = useState<string>('this');
  const [genContractIds, setGenContractIds] = useState<string[]>([]);
  const [genContractSearch, setGenContractSearch] = useState('');

  // Progress animation state
  type GenPhase = 'form' | 'generating' | 'done';
  type StepStatus = 'pending' | 'processing' | 'waiting_input' | 'done';
  const [genPhase, setGenPhase] = useState<GenPhase>('form');
  const [genProgress, setGenProgress] = useState(0);
  const [genSteps, setGenSteps] = useState<{ contractId: string; label: string; weeksCreated: number; status: StepStatus; strategy: HourStrategy; dailyHours: number }[]>([]);
  const [genResultCount, setGenResultCount] = useState(0);
  const [genAskInput, setGenAskInput] = useState<string>('8');
  const [genCurrentIdx, setGenCurrentIdx] = useState(0);
  const genTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const genNewTimesheetsRef = useRef<Timesheet[]>([]);
  const genNextIdRef = useRef(0);

  const filtered = useMemo(() => {
    return allTimesheets.filter(t => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const con = getContactById(t.contactId);
        const ctr = getContractById(t.contractId);
        const matches = t.reference.toLowerCase().includes(s) ||
          (con && `${con.firstName} ${con.lastName}`.toLowerCase().includes(s)) ||
          (ctr?.contractNumber.toLowerCase().includes(s));
        if (!matches) return false;
      }
      if (weekStartFilter.type !== 'all') {
        const r = dateRangeFor(weekStartFilter);
        if (!matchDateRange(t.weekStart, r.from, r.to)) return false;
      }
      const ref = getTextFilter(colFilters, 'reference');
      if (ref && !t.reference.toLowerCase().includes(ref.toLowerCase())) return false;
      const consultant = getTextFilter(colFilters, 'consultant');
      if (consultant) { const con = getContactById(t.contactId); if (!con || !`${con.firstName} ${con.lastName}`.toLowerCase().includes(consultant.toLowerCase())) return false; }
      const contract = getTextFilter(colFilters, 'contract');
      if (contract) { const ctr = getContractById(t.contractId); if (!ctr || !ctr.contractNumber.toLowerCase().includes(contract.toLowerCase())) return false; }
      const hours = getNumberFilter(colFilters, 'hours');
      if (hours.min && t.totalHours < Number(hours.min)) return false;
      if (hours.max && t.totalHours > Number(hours.max)) return false;
      return true;
    });
  }, [statusFilter, searchTerm, weekStartFilter, colFilters, allTimesheets]);

  const filteredIds = filtered.map(t => t.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  // --- Form logic ---
  const openForm = (ts: Timesheet) => {
    setSelected(ts);
    setFormEntries(ts.entries.map(e => ({ ...e })));
  };

  const closeForm = () => { setSelected(null); setFormEntries([]); };

  const updateEntryHours = (idx: number, val: string) => {
    const entries = [...formEntries];
    entries[idx] = { ...entries[idx], hours: val === '' ? 0 : Number(val) };
    setFormEntries(entries);
  };

  const updateEntryComment = (idx: number, val: string) => {
    const entries = [...formEntries];
    entries[idx] = { ...entries[idx], comment: val };
    setFormEntries(entries);
  };

  const saveForm = () => {
    if (!selected) return;
    const totalHours = formEntries.reduce((s, e) => s + e.hours, 0);
    setAllTimesheets(prev => prev.map(t => t.id === selected.id ? { ...t, entries: formEntries, totalHours } : t));
    toast.success('Timesheet saved');
    closeForm();
  };

  const approveTimesheet = () => {
    if (!selected) return;
    const totalHours = formEntries.reduce((s, e) => s + e.hours, 0);
    setAllTimesheets(prev => prev.map(t => t.id === selected.id ? { ...t, entries: formEntries, totalHours, status: 'Approved' as TimesheetStatus } : t));
    toast.success('Timesheet approved');
    closeForm();
  };

  const handleReturn = () => {
    if (!selected) return;
    const con = getContactById(selected.contactId);
    const ctr = getContractById(selected.contractId);
    setAllTimesheets(prev => prev.map(t => t.id === selected.id ? { ...t, status: 'Rejected' as TimesheetStatus } : t));
    toast.success(`Return notification sent to ${con ? `${con.firstName} ${con.lastName}` : 'consultant'} for ${selected.reference} (${ctr?.contractNumber})`);
    setReturnDialog(false);
    setReturnComment('');
    closeForm();
  };

  // --- Generate logic ---
  // Exclude Fixed Price + Fixed Price contracts (they use milestones, not timesheets)
  const activeContracts = contracts.filter(c => {
    if (c.status !== 'Active') return false;
    if (!c.hasTimesheet) return false;
    if (c.contractType === 'Fixed Price' && c.billingType === 'Fixed Price') return false;
    return true;
  });
  const genYear = genYearToggle === 'this' ? new Date().getFullYear() : new Date().getFullYear() + 1;

  const filteredGenContracts = useMemo(() => {
    if (!genContractSearch) return activeContracts;
    const s = genContractSearch.toLowerCase();
    return activeContracts.filter(c => {
      const con = getContactById(c.contactId);
      const acc = getAccountById(c.parentAccountId);
      return c.contractNumber.toLowerCase().includes(s) ||
        c.name?.toLowerCase().includes(s) ||
        (con && `${con.firstName} ${con.lastName}`.toLowerCase().includes(s)) ||
        (acc && acc.name.toLowerCase().includes(s));
    });
  }, [genContractSearch, activeContracts]);

  const allGenSelected = filteredGenContracts.length > 0 && filteredGenContracts.every(c => genContractIds.includes(c.id));

  const closeGenerateDialog = () => {
    genTimersRef.current.forEach(t => clearTimeout(t));
    genTimersRef.current = [];
    setGenerateDialog(false);
    setGenPhase('form');
    setGenProgress(0);
    setGenCurrentIdx(0);
    setGenSteps([]);
    setGenContractIds([]);
    setGenContractSearch('');
    setGenAskInput('8');
    genNewTimesheetsRef.current = [];
  };

  /** Compute weeks to create for a contract */
  const computeWeeksForContract = (contractId: string, month: number, year: number, existingTimesheets: Timesheet[]): string[] => {
    const contractTs = existingTimesheets.filter(t => t.contractId === contractId);
    let latestWeekStart: Date | null = null;
    for (const ts of contractTs) {
      const d = new Date(ts.weekStart);
      if (!latestWeekStart || d > latestWeekStart) latestWeekStart = d;
    }

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    let startMonday: Date;
    if (latestWeekStart) {
      startMonday = new Date(latestWeekStart);
      startMonday.setDate(startMonday.getDate() + 7);
    } else {
      startMonday = getMonday(monthStart);
      if (startMonday < monthStart) startMonday.setDate(startMonday.getDate() + 7);
    }

    const weeks: string[] = [];
    let current = new Date(startMonday);
    while (current.getMonth() === month && current.getFullYear() === year && current <= monthEnd) {
      const weekStartStr = current.toISOString().split('T')[0];
      const exists = existingTimesheets.some(t => t.contractId === contractId && t.weekStart === weekStartStr);
      if (!exists) {
        weeks.push(weekStartStr);
      }
      current.setDate(current.getDate() + 7);
    }
    return weeks;
  };

  /** Create timesheets for a contract with given daily hours */
  const createTimesheetsForContract = (contractId: string, weeks: string[], dailyHours: number, nextIdStart: number): Timesheet[] => {
    const contract = getContractById(contractId);
    if (!contract) return [];
    let nextId = nextIdStart;
    const year = genYear;
    return weeks.map(weekStartStr => {
      const entries = buildEntries(weekStartStr, dailyHours);
      const totalHours = entries.reduce((s, e) => s + e.hours, 0);
      const ts: Timesheet = {
        id: `ts-gen-${nextId}`,
        reference: `TS-${year}-${String(nextId).padStart(3, '0')}`,
        contactId: contract.contactId,
        contractId: contract.id,
        weekStart: weekStartStr,
        totalHours,
        status: 'Draft',
        entries,
      };
      nextId++;
      return ts;
    });
  };

  /** Process a single step in the generation animation */
  const processGenStep = useCallback((idx: number, steps: typeof genSteps) => {
    const step = steps[idx];
    if (!step) return;

    const contract = getContractById(step.contractId);
    if (!contract) return;

    const strategy = step.strategy;

    // Mark as processing
    setGenSteps(prev => prev.map((s, i) => i === idx ? { ...s, status: 'processing' } : s));
    setGenCurrentIdx(idx);
    setGenProgress(Math.round(((idx + 0.3) / steps.length) * 100));

    if (strategy === 'ask') {
      // Pause and wait for user input
      const timer = setTimeout(() => {
        setGenSteps(prev => prev.map((s, i) => i === idx ? { ...s, status: 'waiting_input' } : s));
        setGenAskInput('8');
      }, 600);
      genTimersRef.current.push(timer);
    } else {
      // Auto-process
      const dailyHours = strategy === 'eight' ? 8 : 0;
      const month = Number(genMonth);
      const weeks = computeWeeksForContract(step.contractId, month, genYear, [...allTimesheets, ...genNewTimesheetsRef.current]);
      const newTs = createTimesheetsForContract(step.contractId, weeks, dailyHours, genNextIdRef.current);
      genNextIdRef.current += newTs.length;
      genNewTimesheetsRef.current = [...genNewTimesheetsRef.current, ...newTs];

      const timer = setTimeout(() => {
        setGenSteps(prev => prev.map((s, i) => i === idx ? { ...s, status: 'done', weeksCreated: newTs.length } : s));
        setGenProgress(Math.round(((idx + 1) / steps.length) * 100));

        // Continue to next step or finalize
        if (idx + 1 < steps.length) {
          const nextTimer = setTimeout(() => processGenStep(idx + 1, steps), 300);
          genTimersRef.current.push(nextTimer);
        } else {
          finalizeGeneration();
        }
      }, 600);
      genTimersRef.current.push(timer);
    }
  }, [allTimesheets, genMonth, genYear]);

  /** Handle user providing daily hours for a "ask" contract */
  const handleAskSubmit = (dailyHours: number) => {
    const idx = genSteps.findIndex(s => s.status === 'waiting_input');
    if (idx === -1) return;

    const step = genSteps[idx];
    const month = Number(genMonth);
    const weeks = computeWeeksForContract(step.contractId, month, genYear, [...allTimesheets, ...genNewTimesheetsRef.current]);
    const newTs = createTimesheetsForContract(step.contractId, weeks, dailyHours, genNextIdRef.current);
    genNextIdRef.current += newTs.length;
    genNewTimesheetsRef.current = [...genNewTimesheetsRef.current, ...newTs];

    const updatedSteps = genSteps.map((s, i) => i === idx ? { ...s, status: 'done' as StepStatus, weeksCreated: newTs.length, dailyHours } : s);
    setGenSteps(updatedSteps);
    setGenProgress(Math.round(((idx + 1) / updatedSteps.length) * 100));

    if (idx + 1 < updatedSteps.length) {
      const timer = setTimeout(() => processGenStep(idx + 1, updatedSteps), 300);
      genTimersRef.current.push(timer);
    } else {
      finalizeGeneration();
    }
  };

  const handleAskSkip = () => {
    handleAskSubmit(0);
  };

  const finalizeGeneration = () => {
    const timer = setTimeout(() => {
      const allNew = genNewTimesheetsRef.current;
      if (allNew.length > 0) {
        setAllTimesheets(prev => [...prev, ...allNew]);
      }
      setGenResultCount(allNew.length);
      setGenPhase('done');
    }, 400);
    genTimersRef.current.push(timer);
  };

  const generateTimesheets = () => {
    const month = Number(genMonth);

    // Build steps with strategy info
    const steps = genContractIds.map(contractId => {
      const contract = getContractById(contractId);
      if (!contract) return null;
      const con = getContactById(contract.contactId);
      const label = `${contract.contractNumber} — ${con ? `${con.firstName} ${con.lastName}` : 'Unknown'}`;
      const strategy = getHourStrategy(contract);
      return {
        contractId,
        label,
        weeksCreated: 0,
        status: 'pending' as StepStatus,
        strategy,
        dailyHours: 0,
      };
    }).filter(Boolean) as typeof genSteps;

    genNextIdRef.current = allTimesheets.length + 1;
    genNewTimesheetsRef.current = [];
    setGenSteps(steps);
    setGenPhase('generating');
    setGenProgress(0);
    setGenCurrentIdx(0);

    // Start processing first step
    if (steps.length > 0) {
      const timer = setTimeout(() => processGenStep(0, steps), 300);
      genTimersRef.current.push(timer);
    } else {
      finalizeGeneration();
    }
  };

  // Selected timesheet derived data
  const selectedCon = selected ? getContactById(selected.contactId) : null;
  const selectedCtr = selected ? getContractById(selected.contractId) : null;
  const selectedAcc = selectedCtr ? getAccountById(selectedCtr.parentAccountId) : null;
  const formTotal = formEntries.reduce((s, e) => s + e.hours, 0);

  /** Get a strategy description label */
  const strategyLabel = (strategy: HourStrategy) => {
    switch (strategy) {
      case 'eight': return '8 hrs/day (Standard)';
      case 'zero': return '0 hrs (Time & Material)';
      case 'ask': return 'Fixed Price — input needed';
      default: return '';
    }
  };

  // Reset contract selection when leaving consultant view
  useEffect(() => {
    if (viewMode !== 'consultant' && selectedContractIds.size > 0) {
      setSelectedContractIds(new Set());
    }
  }, [viewMode]);

  const handleDownloadSelectedContracts = () => {
    const rows = filtered
      .filter(t => selectedContractIds.has(t.contractId))
      .map(t => {
        const con = getContactById(t.contactId);
        const ctr = getContractById(t.contractId);
        const acc = ctr ? getAccountById(ctr.parentAccountId) : null;
        return {
          Consultant: con ? `${con.firstName} ${con.lastName}` : '',
          Account: acc?.name ?? '',
          Contract: ctr?.contractNumber ?? '',
          'Timesheet ID': t.reference,
          'Week Start': t.weekStart,
          'Week End': getWeekEnd(t.weekStart),
          Hours: t.totalHours,
          Status: t.status,
        };
      })
      .sort((a, b) => a.Consultant.localeCompare(b.Consultant) || a['Week Start'].localeCompare(b['Week Start']));

    if (rows.length === 0) {
      toast.error('No timesheets found for the selected contracts');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timesheet Hours');
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `timesheet-hours-${today}.xlsx`);
    toast.success(`Downloaded ${rows.length} timesheet${rows.length !== 1 ? 's' : ''}`);
  };

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="timesheets"
        showActivate={false} showDeactivate={false}
        extraActions={selectedIds.length > 0 ? <Button size="sm" onClick={() => {
          setAllTimesheets(prev => prev.map(t => selectedIds.includes(t.id) ? { ...t, status: 'Approved' as TimesheetStatus } : t));
          toast.success(`${selectedIds.length} timesheets approved`);
          setSelectedIds([]);
        }}>Approve Selected</Button> : undefined} />
      <PageHeader title="Timesheets" subtitle={`${filtered.length} of ${allTimesheets.length} timesheets`}
        action={<div className="flex items-center gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <Button variant="outline" onClick={() => setGenerateDialog(true)}>Generate Timesheets</Button>
          <Button variant="outline" onClick={() => setReportDialog(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />Send Timesheet Report
          </Button>
        </div>} />

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search reference, consultant, contract..." />
          <SinglePill label="Status" value={statusFilter} onChange={setStatusFilter}
            options={tsStatuses.map(s => ({ value: s, label: s, count: allTimesheets.filter(t => t.status === s).length }))} />
          <DatePill label="Week Start" value={weekStartFilter} onChange={setWeekStartFilter} dates={allTimesheets.map(t => t.weekStart)} />
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">View</span>
            <ToggleGroup type="single" value={viewMode} onValueChange={v => v && setViewMode(v as any)} className="border rounded-md p-0.5">
              <ToggleGroupItem value="table" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm gap-1.5"><TableIcon className="h-3.5 w-3.5" />Table</ToggleGroupItem>
              <ToggleGroupItem value="account" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm gap-1.5"><Building2 className="h-3.5 w-3.5" />By Account</ToggleGroupItem>
              <ToggleGroupItem value="timeline" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Timeline</ToggleGroupItem>
              <ToggleGroupItem value="consultant" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm gap-1.5"><Users className="h-3.5 w-3.5" />By Consultant</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        {(searchTerm || statusFilter || weekStartFilter.type !== 'all') && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('')} />}
            {weekStartFilter.type !== 'all' && <FilterChip label={`Week Start: ${relativeDateLabel(weekStartFilter)}`} onRemove={() => setWeekStartFilter({ type: 'all' })} />}
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setSearchTerm(''); setStatusFilter(''); setWeekStartFilter({ type: 'all' }); }}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      {viewMode === 'table' && (
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
              <TableHead>Reference <TextFilterPopover label="Reference" value={getTextFilter(colFilters, 'reference')} onChange={v => setTextFilter(setColFilters, 'reference', v)} /></TableHead>
              <TableHead>Consultant <TextFilterPopover label="Consultant" value={getTextFilter(colFilters, 'consultant')} onChange={v => setTextFilter(setColFilters, 'consultant', v)} /></TableHead>
              <TableHead>Contract <TextFilterPopover label="Contract" value={getTextFilter(colFilters, 'contract')} onChange={v => setTextFilter(setColFilters, 'contract', v)} /></TableHead>
              <TableHead>Week Start</TableHead>
              <TableHead>Hours <NumberRangeFilterPopover label="Hours" min={getNumberFilter(colFilters, 'hours').min} max={getNumberFilter(colFilters, 'hours').max} onChange={(min, max) => setNumberFilter(setColFilters, 'hours', min, max)} /></TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No timesheets match the current filters.</TableCell></TableRow>
            ) : filtered.map(t => {
              const con = getContactById(t.contactId);
              const ctr = getContractById(t.contractId);
              return (
                <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openForm(t)}>
                  <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(t.id)} onCheckedChange={c => toggleOne(t.id, !!c)} /></TableCell>
                  <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                  <TableCell>{con ? `${con.firstName} ${con.lastName}` : '—'}</TableCell>
                  <TableCell className="text-xs">{ctr?.contractNumber}</TableCell>
                  <TableCell>{t.weekStart}</TableCell>
                  <TableCell>{t.totalHours}</TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      )}
      {viewMode === 'account' && <GroupedByAccountView timesheets={filtered} onOpen={openForm} />}
      {viewMode === 'timeline' && <MonthlyTimelineView timesheets={filtered} onOpen={openForm} />}
      {viewMode === 'consultant' && <ByConsultantView timesheets={filtered} onOpen={openForm} selectedContractIds={selectedContractIds} onSelectionChange={setSelectedContractIds} />}

      {/* Floating action bar for consultant-view contract selection */}
      {viewMode === 'consultant' && selectedContractIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border bg-card shadow-lg px-4 py-2">
          <span className="text-sm font-medium">
            {selectedContractIds.size} contract{selectedContractIds.size !== 1 ? 's' : ''} selected
          </span>
          <Button size="sm" onClick={handleDownloadSelectedContracts}>
            <Download className="h-4 w-4 mr-1" /> Download
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedContractIds(new Set())}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ===== TIMESHEET DETAIL SHEET ===== */}
      <Sheet open={!!selected} onOpenChange={open => { if (!open) closeForm(); }}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.reference ?? 'Timesheet'}</SheetTitle>
            {selected && <StatusBadge status={selected.status} />}
          </SheetHeader>

          {selected && (
            <div className="mt-6 space-y-6">
              {/* Info Section */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3 border-b pb-1">Info</h3>
                <div className="grid grid-cols-2 gap-4">
                  <TextField label="Reference" value={selected.reference} onChange={() => {}} required readOnly />
                  <TextField label="Contract" value={selectedCtr?.contractNumber ?? ''} onChange={() => {}} readOnly />
                  <TextField label="Consultant" value={selectedCon ? `${selectedCon.firstName} ${selectedCon.lastName}` : ''} onChange={() => {}} readOnly />
                  <TextField label="Customer" value={selectedAcc?.name ?? ''} onChange={() => {}} readOnly />
                  <TextField label="Week Start" value={selected.weekStart} onChange={() => {}} readOnly />
                  <TextField label="Week End" value={getWeekEnd(selected.weekStart)} onChange={() => {}} readOnly />
                </div>
              </div>

              {/* Hours Section */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3 border-b pb-1">Hours</h3>
                <div className="space-y-2">
                  {formEntries.map((entry, idx) => (
                    <div key={entry.date} className="grid grid-cols-[120px_1fr_auto] gap-3 items-center">
                      <span className="text-sm font-medium text-primary">{dayNames[idx]}</span>
                      <Input
                        type="number"
                        min={0}
                        max={24}
                        step={0.5}
                        value={entry.hours || ''}
                        onChange={e => updateEntryHours(idx, e.target.value)}
                        className="h-8"
                      />
                      <Button
                        variant={entry.comment ? 'secondary' : 'outline'}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setCommentDialog({ open: true, idx, value: entry.comment ?? '' })}
                      >
                        {entry.comment ? 'Edit Comment' : 'Add Comment'}
                      </Button>
                    </div>
                  ))}
                  <div className="flex justify-end pt-2 border-t">
                    <span className="text-sm font-semibold">Total: {formTotal} hours</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t">
                <Button onClick={saveForm}>Save</Button>
                <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={approveTimesheet}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => { setReturnComment(''); setReturnDialog(true); }}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Return to User
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" onClick={closeForm}>Close</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ===== RETURN TO USER DIALOG ===== */}
      <Dialog open={returnDialog} onOpenChange={setReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Timesheet to Consultant</DialogTitle>
            <DialogDescription>
              Add comments explaining what needs to be adjusted. The consultant will receive an email with these details.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="text-sm space-y-1 bg-muted/50 rounded-md p-3">
                <p><span className="font-medium">Reference:</span> {selected.reference}</p>
                <p><span className="font-medium">Consultant:</span> {selectedCon ? `${selectedCon.firstName} ${selectedCon.lastName}` : '—'}</p>
                <p><span className="font-medium">Contract:</span> {selectedCtr?.contractNumber}</p>
                <p><span className="font-medium">Week:</span> {selected.weekStart} → {getWeekEnd(selected.weekStart)}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Comments *</label>
                <Textarea value={returnComment} onChange={e => setReturnComment(e.target.value)} placeholder="Please describe what needs to be adjusted..." rows={4} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReturnDialog(false)}>Cancel</Button>
            <Button disabled={!returnComment.trim()} onClick={handleReturn} className="bg-orange-600 hover:bg-orange-700">Send & Return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DAY COMMENT DIALOG ===== */}
      <Dialog open={commentDialog.open} onOpenChange={open => { if (!open) setCommentDialog(prev => ({ ...prev, open: false })); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dayNames[commentDialog.idx]} Comment</DialogTitle>
            <DialogDescription>Add or edit comments for this day.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={commentDialog.value}
            onChange={e => setCommentDialog(prev => ({ ...prev, value: e.target.value }))}
            placeholder="Enter comments for this day..."
            rows={5}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCommentDialog(prev => ({ ...prev, open: false }))}>Cancel</Button>
            <Button onClick={() => {
              updateEntryComment(commentDialog.idx, commentDialog.value);
              setCommentDialog(prev => ({ ...prev, open: false }));
            }}>Save Comment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={generateDialog} onOpenChange={open => { if (!open) closeGenerateDialog(); else setGenerateDialog(true); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" onInteractOutside={e => { if (genPhase === 'generating') e.preventDefault(); }}>
          {genPhase === 'form' && (
            <>
              <DialogHeader>
                <DialogTitle>Generate Timesheets</DialogTitle>
                <DialogDescription>Select the month, year, and contracts to generate weekly timesheets for.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Month</label>
                    <Select value={genMonth} onValueChange={setGenMonth}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {monthNames.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Year</label>
                    <ToggleGroup type="single" value={genYearToggle} onValueChange={v => v && setGenYearToggle(v)} className="border rounded-md p-0.5 w-full justify-start">
                      <ToggleGroupItem value="this" className="flex-1 text-xs h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm">
                        This Year ({new Date().getFullYear()})
                      </ToggleGroupItem>
                      <ToggleGroupItem value="next" className="flex-1 text-xs h-8 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm">
                        Next Year ({new Date().getFullYear() + 1})
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Active Contracts</label>
                    <Button variant="ghost" size="sm" onClick={() => setGenContractIds(allGenSelected ? [] : filteredGenContracts.map(c => c.id))}>
                      {allGenSelected ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search contracts..." value={genContractSearch} onChange={e => setGenContractSearch(e.target.value)} className="pl-8 h-9" />
                  </div>
                  <div className="border rounded-md max-h-[300px] overflow-y-auto">
                    {filteredGenContracts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No active contracts found</p>
                    ) : filteredGenContracts.map(c => {
                      const con = getContactById(c.contactId);
                      const acc = getAccountById(c.parentAccountId);
                      const strategy = getHourStrategy(c);
                      return (
                        <div key={c.id} className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer" onClick={() => setGenContractIds(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])}>
                          <Checkbox checked={genContractIds.includes(c.id)} onCheckedChange={checked => setGenContractIds(prev => checked ? [...prev, c.id] : prev.filter(x => x !== c.id))} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{c.contractNumber}</p>
                            <p className="text-xs text-muted-foreground truncate">{con ? `${con.firstName} ${con.lastName}` : '—'} • {acc?.name ?? '—'}</p>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap">
                            {strategy === 'eight' ? '8h/day' : strategy === 'zero' ? 'T&M' : strategy === 'ask' ? 'Fixed Price' : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{genContractIds.length} of {activeContracts.length} contracts selected</p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={closeGenerateDialog}>Cancel</Button>
                <Button disabled={genContractIds.length === 0} onClick={generateTimesheets}>Generate</Button>
              </DialogFooter>
            </>
          )}

          {genPhase === 'generating' && (
            <div className="py-4 space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mx-auto">
                  <Loader2 className="h-7 w-7 text-primary animate-spin" />
                </div>
                <h3 className="text-lg font-semibold">Generating Timesheets</h3>
                <p className="text-sm text-muted-foreground">{monthNames[Number(genMonth)]} {genYear} — Processing {genSteps.length} contracts</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{genProgress}%</span>
                </div>
                <Progress value={genProgress} className="h-2 transition-all duration-500" />
              </div>

              <div className="space-y-1 max-h-[340px] overflow-y-auto">
                {genSteps.map((step, idx) => (
                  <div key={step.contractId}>
                    <div
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-300 ${
                        step.status === 'processing' || step.status === 'waiting_input' ? 'bg-primary/5 ring-1 ring-primary/20 scale-[1.01]' :
                        step.status === 'done' ? 'bg-muted/30' : 'opacity-50'
                      }`}
                    >
                      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                        {step.status === 'pending' && (
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                        )}
                        {step.status === 'processing' && (
                          <Loader2 className="h-5 w-5 text-primary animate-spin" />
                        )}
                        {step.status === 'waiting_input' && (
                          <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                            <ArrowRight className="h-3.5 w-3.5 text-amber-600" />
                          </div>
                        )}
                        {step.status === 'done' && (
                          <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center animate-scale-in">
                            <Check className="h-3.5 w-3.5 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${step.status === 'processing' || step.status === 'waiting_input' ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{step.label}</p>
                        <p className="text-[10px] text-muted-foreground">{strategyLabel(step.strategy)}</p>
                      </div>
                      {step.status === 'done' && (
                        <span className="text-xs text-primary font-medium animate-fade-in">{step.weeksCreated} week{step.weeksCreated !== 1 ? 's' : ''}</span>
                      )}
                    </div>

                    {/* Interactive input for Fixed Price contracts */}
                    {step.status === 'waiting_input' && (
                      <div className="ml-9 mt-2 mb-3 p-3 rounded-lg border border-amber-200 bg-amber-50/50 space-y-3 animate-fade-in">
                        <p className="text-sm text-amber-800 font-medium">
                          This is a Fixed Price contract. Enter the daily hours to populate:
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <Input
                              type="number"
                              min={0}
                              max={24}
                              step={0.5}
                              value={genAskInput}
                              onChange={e => setGenAskInput(e.target.value)}
                              placeholder="Hours per day"
                              className="h-9 bg-background"
                            />
                          </div>
                          <Button size="sm" onClick={() => handleAskSubmit(Number(genAskInput) || 0)} className="gap-1">
                            <Check className="h-3.5 w-3.5" /> Apply
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleAskSkip} className="gap-1 text-muted-foreground">
                            <SkipForward className="h-3.5 w-3.5" /> Skip
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Skip will populate with 0 hours. Apply will set the entered hours for all working days.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {genPhase === 'done' && (
            <div className="py-8 space-y-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto animate-scale-in">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-1 animate-fade-in">
                <h3 className="text-xl font-bold">Generation Complete!</h3>
                {genResultCount > 0 ? (
                  <p className="text-muted-foreground">
                    Successfully created <span className="font-semibold text-foreground">{genResultCount} timesheet{genResultCount !== 1 ? 's' : ''}</span> for {monthNames[Number(genMonth)]} {genYear}
                  </p>
                ) : (
                  <p className="text-muted-foreground">All weeks are already covered — no new timesheets needed.</p>
                )}
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: '200ms' }}>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <FileSpreadsheet className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-lg font-bold">{genResultCount}</p>
                  <p className="text-xs text-muted-foreground">Timesheets</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <Calendar className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-lg font-bold">{genSteps.length}</p>
                  <p className="text-xs text-muted-foreground">Contracts</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <CheckCircle className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-lg font-bold">Draft</p>
                  <p className="text-xs text-muted-foreground">Status</p>
                </div>
              </div>

              <Button onClick={closeGenerateDialog} className="mt-2">Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SendTimesheetReportFlow open={reportDialog} onOpenChange={setReportDialog} />
    </div>
  );
}
