import * as React from 'react';
import { useState, useMemo, useCallback, useRef } from 'react';
import { PageHeader, StatusBadge } from '../components/Shared';
import { Sheet, Dialog, ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField } from '../components/FormFields';
import {
  ColumnFilters, TextFilterPopover, NumberRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getNumberFilter, setTextFilter, setNumberFilter,
  matchDateRange,
} from '../components/ColumnFilters';
import { SearchPill, SinglePill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, type RelativeDateValue } from '../components/FilterPills';
import {
  Search, Check, CheckCircle2, RotateCcw, Loader2, FileSpreadsheet, Sparkles,
  SkipForward, CalendarDays, ChevronRight, Download, X,
} from '../components/Icons';
import * as XLSX from 'xlsx';
import { useDataverse } from '../services/useDataverse';
import { fetchTimesheets, saveTimesheet, removeTimesheet } from '../services/timesheetService';
import { timesheets as mockTimesheets } from '../data/mock-data';
import { fetchContracts } from '../services/contractService';
import { fetchContacts } from '../services/contactService';
import { fetchAccounts } from '../services/accountService';
import type { Timesheet, TimesheetStatus, TimesheetEntry, Contract, Contact, Account } from '../types/crm';
import { GroupedByAccountView, MonthlyTimelineView, ByConsultantView, hoursInRange } from '../components/timesheet/TimesheetAlternativeViews';
import { SendTimesheetReportFlow } from '../components/timesheet/SendTimesheetReportFlow';

const tsStatuses: TimesheetStatus[] = ['Draft', 'Submitted', 'Approved'];
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Local YYYY-MM-DD (avoids the toISOString UTC drift that pushes a local
// Monday back to Sunday in positive-UTC timezones like Romania).
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return toLocalDateStr(d);
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
  return 'zero';
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function buildEntries(weekStartStr: string, dailyHours: number, _targetMonth?: number, _targetYear?: number): TimesheetEntry[] {
  const entries: TimesheetEntry[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartStr);
    d.setDate(d.getDate() + i);
    const hrs = dailyHours > 0 && isWeekday(d) ? dailyHours : 0;
    entries.push({ date: toLocalDateStr(d), hours: hrs });
  }
  return entries;
}

import { useConfirm } from '../components/ConfirmDialog';

export default function TimesheetsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data: timesheets, loading, refetch, isLive } = useDataverse<Timesheet>(fetchTimesheets, mockTimesheets);
  const { data: dvContracts } = useDataverse<Contract>(fetchContracts, []);
  const { data: dvContacts } = useDataverse<Contact>(fetchContacts, []);
  const { data: dvAccounts } = useDataverse<Account>(fetchAccounts, []);
  // Dataverse-backed lookup helpers (replace mock-data functions)
  const getContactById = (id: string) => { const c = dvContacts.find(x => x.id === id); return c ? { firstName: c.firstName, lastName: c.lastName } : null; };
  const getContractById = (id: string) => dvContracts.find(c => c.id === id) || null;
  const getAccountById = (id: string) => dvAccounts.find(a => a.id === id) || null;

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [weekStartFilter, setWeekStartFilter] = useState<RelativeDateValue>({ type: 'all' });
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Timesheet | null>(null);
  const [formEntries, setFormEntries] = useState<TimesheetEntry[]>([]);
  const [returnDialog, setReturnDialog] = useState(false);
  const [returnComment, setReturnComment] = useState('');
  const [generateDialog, setGenerateDialog] = useState(false);
  const [reportDialog, setReportDialog] = useState(false);
  const [genMonth, setGenMonth] = useState<string>(String(new Date().getMonth()));
  const [genYearToggle, setGenYearToggle] = useState<string>('this');
  const [genContractIds, setGenContractIds] = useState<Set<string>>(new Set());
  const [genContractSearch, setGenContractSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'account' | 'timeline' | 'consultant'>('table');
  const [selectedContractIds, setSelectedContractIds] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (viewMode !== 'consultant' && selectedContractIds.size > 0) {
      setSelectedContractIds(new Set());
    }
  }, [viewMode]);

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
    const list = timesheets.filter(t => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const con = getContactById(t.contactId);
        const ctr = getContractById(t.contractId);
        const matches = (t.reference || '').toLowerCase().includes(s) ||
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
    // Primary: consultant name asc. Secondary: Week Start desc (newest first).
    return list.sort((a, b) => {
      const conA = getContactById(a.contactId);
      const conB = getContactById(b.contactId);
      const nameA = (conA ? `${conA.firstName} ${conA.lastName}` : '').toLowerCase();
      const nameB = (conB ? `${conB.firstName} ${conB.lastName}` : '').toLowerCase();
      if (nameA !== nameB) return nameA.localeCompare(nameB);
      const dateA = new Date(a.weekStart || '').getTime();
      const dateB = new Date(b.weekStart || '').getTime();
      return dateB - dateA;
    });
  }, [statusFilter, searchTerm, weekStartFilter, colFilters, timesheets, dvContacts]);

  const hasActiveFilters = !!searchTerm || !!statusFilter || weekStartFilter.type !== 'all';

  const activeFilterRange = useMemo(() => {
    if (weekStartFilter.type === 'all') return null;
    const r = dateRangeFor(weekStartFilter);
    const toStr = (d?: Date) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;
    return { from: toStr(r.from), to: toStr(r.to) };
  }, [weekStartFilter]);

  const filteredIds = filtered.map(t => t.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  // --- Form logic ---
  const openForm = (ts: Timesheet) => {
    setSelected(ts);
    setFormEntries((ts.entries || []).map(e => ({ ...e })));
  };

  const closeForm = () => { setSelected(null); setFormEntries([]); };

  const updateEntryHours = (idx: number, val: string) => {
    const num = val === '' ? 0 : parseFloat(val);
    const safe = Number.isFinite(num) ? Math.min(24, Math.max(0, num)) : 0;
    setFormEntries(prev => prev.map((entry, i) => i === idx ? { ...entry, hours: safe } : entry));
  };

  const updateEntryDescription = (idx: number, val: string) => {
    setFormEntries(prev => prev.map((entry, i) => i === idx ? { ...entry, description: val } : entry));
  };

  const saveForm = async () => {
    if (isSaving) return;
    if (!selected) return;
    setIsSaving(true);
    try {
      await saveTimesheet({ entries: formEntries }, selected.id);
      toast.success('Timesheet saved');
      closeForm();
      await refetch();
    } catch (err: any) {
      console.error('Save failed:', err);
      toast.error(err?.message || 'Save failed — check console');
    } finally {
      setIsSaving(false);
    }
  };

  const approveTimesheet = async () => {
    if (!selected) return;
    try {
      await saveTimesheet({ entries: formEntries, status: 'Approved' }, selected.id);
      toast.success('Timesheet approved');
      closeForm();
      await refetch();
    } catch (err: any) {
      console.error('Approve failed:', err);
      toast.error(err?.message || 'Approve failed — check console');
    }
  };

  const handleReturn = async () => {
    if (!selected) return;
    const con = getContactById(selected.contactId);
    const ctr = getContractById(selected.contractId);
    try {
      await saveTimesheet({ status: 'Draft' }, selected.id);
      toast.success(`Return notification sent to ${con ? `${con.firstName} ${con.lastName}` : 'consultant'} for ${selected.reference} (${ctr?.contractNumber})`);
      setReturnDialog(false);
      setReturnComment('');
      closeForm();
      await refetch();
    } catch (err: any) {
      console.error('Return failed:', err);
      toast.error(err?.message || 'Return failed — check console');
    }
  };

  // --- Generate logic ---
  const activeContracts = useMemo(() => dvContracts.filter(c => {
    if (c.status !== 'Active') return false;
    if (!c.hasTimesheet) return false;
    if (c.contractType === 'Fixed Price' && c.billingType === 'Fixed Price') return false;
    return true;
  }), [dvContracts]);
  const genYear = genYearToggle === 'last'
    ? new Date().getFullYear() - 1
    : genYearToggle === 'next'
      ? new Date().getFullYear() + 1
      : new Date().getFullYear();

  const getDvContactName = (id: string) => { const c = dvContacts.find(x => x.id === id); return c ? `${c.firstName} ${c.lastName}` : ''; };
  const getDvAccountName = (id: string) => dvAccounts.find(a => a.id === id)?.name || '';

  const filteredGenContracts = useMemo(() => {
    if (!genContractSearch) return activeContracts;
    const s = genContractSearch.toLowerCase();
    return activeContracts.filter(c => {
      return c.contractNumber.toLowerCase().includes(s) ||
        (c.name || '').toLowerCase().includes(s) ||
        getDvContactName(c.contactId).toLowerCase().includes(s) ||
        getDvAccountName(c.parentAccountId).toLowerCase().includes(s);
    });
  }, [genContractSearch, activeContracts, dvContacts, dvAccounts]);

  const allGenSelected = filteredGenContracts.length > 0 && filteredGenContracts.every(c => genContractIds.has(c.id));

  const closeGenerateDialog = () => {
    genTimersRef.current.forEach(t => clearTimeout(t));
    genTimersRef.current = [];
    setGenerateDialog(false);
    setGenPhase('form');
    setGenProgress(0);
    setGenCurrentIdx(0);
    setGenSteps([]);
    setGenContractIds(new Set());
    setGenContractSearch('');
    setGenAskInput('8');
    genNewTimesheetsRef.current = [];
  };

  /** Compute weeks to create for a contract */
  const computeWeeksForContract = (contractId: string, month: number, year: number, existingTimesheets: Timesheet[]): string[] => {
    const contract = getContractById(contractId);
    if (!contract) return [];

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    // Monday of the week containing the 1st of the month (handles leading split week)
    const firstMonday = getMonday(monthStart);
    // Monday of the week containing the last day of the month (handles trailing split week)
    const lastMonday = getMonday(monthEnd);

    const weeks: string[] = [];
    const current = new Date(firstMonday);

    while (current <= lastMonday) {
      const weekStartStr = toLocalDateStr(current);

      // At least one day of this Mon-Sun must fall inside the selected month
      let hasOverlap = false;
      for (let d = 0; d < 7; d++) {
        const day = new Date(current);
        day.setDate(day.getDate() + d);
        if (day.getMonth() === month && day.getFullYear() === year) {
          hasOverlap = true;
          break;
        }
      }

      if (hasOverlap) {
        const isDuplicate = existingTimesheets.some(t =>
          t.contractId === contractId &&
          t.contactId === contract.contactId &&
          t.weekStart === weekStartStr
        );
        if (!isDuplicate) {
          weeks.push(weekStartStr);
        }
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
    const month = Number(genMonth);
    return weeks.map(weekStartStr => {
      const entries = buildEntries(weekStartStr, dailyHours, month, year);
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
      }, 50);
      genTimersRef.current.push(timer);
    } else {
      // Auto-process
      const dailyHours = strategy === 'eight' ? 8 : 0;
      const month = Number(genMonth);
      const weeks = computeWeeksForContract(step.contractId, month, genYear, [...timesheets, ...genNewTimesheetsRef.current]);
      const newTs = createTimesheetsForContract(step.contractId, weeks, dailyHours, genNextIdRef.current);
      genNextIdRef.current += newTs.length;
      genNewTimesheetsRef.current = [...genNewTimesheetsRef.current, ...newTs];

      const timer = setTimeout(() => {
        setGenSteps(prev => prev.map((s, i) => i === idx ? { ...s, status: 'done', weeksCreated: newTs.length } : s));
        setGenProgress(Math.round(((idx + 1) / steps.length) * 100));

        // Continue to next step or finalize
        if (idx + 1 < steps.length) {
          const nextTimer = setTimeout(() => processGenStep(idx + 1, steps), 50);
          genTimersRef.current.push(nextTimer);
        } else {
          finalizeGeneration();
        }
      }, 50);
      genTimersRef.current.push(timer);
    }
  }, [timesheets, genMonth, genYear]);

  /** Handle user providing daily hours for a "ask" contract */
  const handleAskSubmit = (dailyHours: number) => {
    const idx = genSteps.findIndex(s => s.status === 'waiting_input');
    if (idx === -1) return;

    const step = genSteps[idx];
    const month = Number(genMonth);
    const weeks = computeWeeksForContract(step.contractId, month, genYear, [...timesheets, ...genNewTimesheetsRef.current]);
    const newTs = createTimesheetsForContract(step.contractId, weeks, dailyHours, genNextIdRef.current);
    genNextIdRef.current += newTs.length;
    genNewTimesheetsRef.current = [...genNewTimesheetsRef.current, ...newTs];

    const updatedSteps = genSteps.map((s, i) => i === idx ? { ...s, status: 'done' as StepStatus, weeksCreated: newTs.length, dailyHours } : s);
    setGenSteps(updatedSteps);
    setGenProgress(Math.round(((idx + 1) / updatedSteps.length) * 100));

    if (idx + 1 < updatedSteps.length) {
      const timer = setTimeout(() => processGenStep(idx + 1, updatedSteps), 50);
      genTimersRef.current.push(timer);
    } else {
      finalizeGeneration();
    }
  };

  const handleAskSkip = () => {
    handleAskSubmit(0);
  };

  const finalizeGeneration = () => {
    const timer = setTimeout(async () => {
      const allNew = genNewTimesheetsRef.current;
      let savedCount = 0;
      if (allNew.length > 0) {
        const batchSize = 5;
        for (let i = 0; i < allNew.length; i += batchSize) {
          const batch = allNew.slice(i, i + batchSize);
          const results = await Promise.allSettled(
            batch.map(ts => saveTimesheet({
              reference: ts.reference,
              contactId: ts.contactId,
              contractId: ts.contractId,
              weekStart: ts.weekStart,
              status: ts.status,
              entries: ts.entries,
            }))
          );
          savedCount += results.filter(r => r.status === 'fulfilled').length;
          const failed = results.filter(r => r.status === 'rejected');
          failed.forEach(f => console.error('[Generate] Save failed:', (f as any).reason?.message));
        }
        if (savedCount < allNew.length) {
          toast.error(`${allNew.length - savedCount} of ${allNew.length} timesheets failed to save`);
        }
        await refetch();
      }
      setGenResultCount(savedCount);
      setGenPhase('done');
    }, 50);
    genTimersRef.current.push(timer);
  };

  const generateTimesheets = async () => {
    await refetch();
    const month = Number(genMonth);

    // Build steps with strategy info
    const steps = Array.from(genContractIds).map(contractId => {
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

    genNextIdRef.current = timesheets.length + 1;
    genNewTimesheetsRef.current = [];
    setGenSteps(steps);
    setGenPhase('generating');
    setGenProgress(0);
    setGenCurrentIdx(0);

    // Start processing first step
    if (steps.length > 0) {
      const timer = setTimeout(() => processGenStep(0, steps), 50);
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

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="timesheets"
        showActivate={false} showDeactivate={false}
        onDelete={async () => {
          const count = selectedIds.length;
          const ok = await confirm({ title: 'Delete timesheet(s)', description: `Are you sure you want to delete ${count} selected timesheet(s)? This action cannot be undone.` });
          if (!ok) return;
          try {
            for (const id of selectedIds) await removeTimesheet(id);
            toast.success(`${count} timesheet(s) deleted`);
            setSelectedIds([]);
            await refetch();
          } catch (err: any) {
            toast.error(err?.message || 'Delete failed');
          }
        }}
        onDownload={() => {
          const selectedSet = new Set(selectedIds);
          const selected = filtered.filter(t => selectedSet.has(t.id));
          if (selected.length === 0) return;
          const rows = selected.map(t => {
            const con = dvContacts.find(c => c.id === t.contactId);
            const ctr = dvContracts.find(c => c.id === t.contractId);
            const acc = ctr ? dvAccounts.find(a => a.id === ctr.parentAccountId) : null;
            const entries = t.entries || [];
            return {
              Reference: t.reference,
              Consultant: con ? `${con.firstName} ${con.lastName}` : '',
              Account: acc?.name ?? '',
              Contract: ctr?.contractNumber ?? ctr?.name ?? '',
              'Week Start': t.weekStart,
              'Week End': getWeekEnd(t.weekStart),
              Monday: entries[0]?.hours ?? 0,
              Tuesday: entries[1]?.hours ?? 0,
              Wednesday: entries[2]?.hours ?? 0,
              Thursday: entries[3]?.hours ?? 0,
              Friday: entries[4]?.hours ?? 0,
              Saturday: entries[5]?.hours ?? 0,
              Sunday: entries[6]?.hours ?? 0,
              'Total Hours': t.totalHours,
              Status: t.status,
            };
          }).sort((a, b) => a.Consultant.localeCompare(b.Consultant) || a['Week Start'].localeCompare(b['Week Start']));
          const ws = XLSX.utils.json_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Timesheets');
          const today = new Date().toISOString().split('T')[0];
          XLSX.writeFile(wb, `timesheets-${today}.xlsx`);
          toast.success(`${rows.length} timesheet(s) exported`);
        }}
        extraActions={selectedIds.length > 0 ? <button className="csp-btn csp-btn-primary csp-btn-sm" onClick={async () => {
          try {
            for (const id of selectedIds) await saveTimesheet({ status: 'Approved' }, id);
            toast.success(`${selectedIds.length} timesheets approved`);
            setSelectedIds([]);
            await refetch();
          } catch (err: any) {
            toast.error(err?.message || 'Approve failed');
          }
        }}>Approve Selected</button> : undefined} />
      <PageHeader title="Timesheets" subtitle={loading ? 'Loading...' : `${filtered.length} of ${timesheets.length} timesheets${isLive ? '' : ' (mock data)'}`}
        action={<div className="csp-flex-gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <button className="csp-btn csp-btn-outline" onClick={() => setReportDialog(true)}>
            <FileSpreadsheet className="csp-icon-inline" /> Send Timesheet Report
          </button>
          <button className="csp-btn csp-btn-outline" onClick={() => setGenerateDialog(true)}>Generate Timesheets</button>
        </div>} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search reference, consultant, contract..." />
          <SinglePill label="Status" value={statusFilter} onChange={setStatusFilter}
            options={tsStatuses.map(s => ({ value: s, label: s, count: timesheets.filter(t => t.status === s).length }))} />
          <DatePill label="Week Date" value={weekStartFilter} onChange={setWeekStartFilter} weekMode dates={(() => {
            const realDates = timesheets.map(t => t.weekStart).filter(Boolean) as string[];
            const now = new Date();
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const endStr = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;
            return [...realDates, endStr];
          })()} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <span style={{ fontSize: '11px', fontWeight: 500, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>View</span>
            {[
              { value: 'table', label: 'Table' },
              { value: 'account', label: 'By Account' },
              { value: 'timeline', label: 'Timeline' },
              { value: 'consultant', label: 'By Consultant' },
            ].map(v => (
              <button key={v.value} onClick={() => setViewMode(v.value as any)}
                className={viewMode === v.value ? 'csp-btn csp-btn-sm csp-btn-primary' : 'csp-btn csp-btn-sm csp-btn-outline'}
                style={{ padding: '4px 10px', fontSize: '11px' }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('')} />}
            {weekStartFilter.type !== 'all' && <FilterChip label={`Week Date: ${relativeDateLabel(weekStartFilter)}`} onRemove={() => setWeekStartFilter({ type: 'all' })} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setSearchTerm(''); setStatusFilter(''); setWeekStartFilter({ type: 'all' }); }}>Clear all</button>
          </div>
        )}
      </div>

      {viewMode === 'account' && (
        <GroupedByAccountView timesheets={filtered} onOpen={openForm} contracts={dvContracts} accounts={dvAccounts} contacts={dvContacts} filterRange={activeFilterRange} />
      )}
      {viewMode === 'timeline' && (
        <MonthlyTimelineView timesheets={filtered} onOpen={openForm} />
      )}
      {viewMode === 'consultant' && (
        <ByConsultantView
          timesheets={filtered}
          onOpen={openForm}
          contracts={dvContracts}
          accounts={dvAccounts}
          contacts={dvContacts}
          filterRange={activeFilterRange}
          selectedContractIds={selectedContractIds}
          onSelectionChange={setSelectedContractIds}
        />
      )}

      {viewMode === 'consultant' && selectedContractIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, display: 'flex', alignItems: 'center', gap: 8,
          borderRadius: 9999, border: '1px solid hsl(var(--border))',
          backgroundColor: 'hsl(var(--card))', boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          padding: '8px 16px',
        }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            {selectedContractIds.size} contract{selectedContractIds.size !== 1 ? 's' : ''} selected
          </span>
          <button className="csp-btn csp-btn-primary csp-btn-sm" onClick={() => {
            const rows = filtered
              .filter(t => selectedContractIds.has(t.contractId))
              .map(t => {
                const con = dvContacts.find(c => c.id === t.contactId);
                const ctr = dvContracts.find(c => c.id === t.contractId);
                const acc = ctr ? dvAccounts.find(a => a.id === ctr.parentAccountId) : null;
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
          }}>
            <Download className="csp-icon-inline" /> Download
          </button>
          <button className="csp-btn csp-btn-ghost csp-btn-sm" onClick={() => setSelectedContractIds(new Set())} aria-label="Clear selection">
            <X className="csp-icon-inline" />
          </button>
        </div>
      )}

      {viewMode === 'table' && (
      <div className="csp-table-wrapper">
        <table className="csp-table">
          <thead>
            <tr>
              <th className="csp-th-checkbox"><Checkbox checked={allSelected} onChange={toggleAll} /></th>
              <th>Reference <TextFilterPopover label="Reference" value={getTextFilter(colFilters, 'reference')} onChange={v => setTextFilter(setColFilters, 'reference', v)} /></th>
              <th>Consultant <TextFilterPopover label="Consultant" value={getTextFilter(colFilters, 'consultant')} onChange={v => setTextFilter(setColFilters, 'consultant', v)} /></th>
              <th>Contract <TextFilterPopover label="Contract" value={getTextFilter(colFilters, 'contract')} onChange={v => setTextFilter(setColFilters, 'contract', v)} /></th>
              <th>Week Start</th>
              <th>Hours <NumberRangeFilterPopover label="Hours" min={getNumberFilter(colFilters, 'hours').min} max={getNumberFilter(colFilters, 'hours').max} onChange={(min, max) => setNumberFilter(setColFilters, 'hours', min, max)} /></th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="csp-td-empty">No timesheets match the current filters.</td></tr>
            ) : filtered.map(t => {
              const con = getContactById(t.contactId);
              const ctr = getContractById(t.contractId);
              return (
                <tr key={t.id} className="csp-tr-clickable" style={{ cursor: 'pointer' }} onClick={() => openForm(t)}>
                  <td className="csp-td-check" onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(t.id)} onChange={c => toggleOne(t.id, c)} /></td>
                  <td className="csp-td-mono">{t.reference}</td>
                  <td>{con ? `${con.firstName} ${con.lastName}` : '\u2014'}</td>
                  <td style={{ fontSize: '0.75rem' }}>{ctr?.contractNumber}</td>
                  <td>{t.weekStart}</td>
                  <td>{hoursInRange(t, activeFilterRange?.from ?? null, activeFilterRange?.to ?? null)}</td>
                  <td><StatusBadge status={t.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* ===== TIMESHEET DETAIL SHEET ===== */}
      <Sheet open={!!selected} onClose={closeForm} title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>{selected?.reference ?? 'Timesheet'}</span>
          {selected && <StatusBadge status={selected.status} />}
        </div>
      } width="42rem">
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
            {/* Info Section */}
            <div>
              <h3 className="csp-section-title">Info</h3>
              <div className="csp-form-grid-2">
                <TextField label="Reference" value={selected.reference} onChange={() => {}} required readOnly />
                <TextField label="Contract" value={selectedCtr?.contractNumber ?? ''} onChange={() => {}} readOnly />
                <TextField label="Consultant" value={selectedCon ? `${selectedCon.firstName} ${selectedCon.lastName}` : ''} onChange={() => {}} readOnly />
                <TextField
                  label="Customer"
                  value={
                    (selectedCtr?.childAccountName)
                    || (selectedCtr?.childAccountId ? getAccountById(selectedCtr.childAccountId)?.name : '')
                    || selectedCtr?.parentAccountName
                    || selectedAcc?.name
                    || ''
                  }
                  onChange={() => {}}
                  readOnly
                />
                <TextField label="Week Start" value={selected.weekStart} onChange={() => {}} readOnly />
                <TextField label="Week End" value={getWeekEnd(selected.weekStart)} onChange={() => {}} readOnly />
              </div>
            </div>

            {/* Hours Section */}
            <div>
              <h3 className="csp-section-title">Hours</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {formEntries.map((entry, idx) => (
                  <div key={entry.date} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 120px 1fr', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'hsl(var(--primary))' }}>{dayNames[idx]}</span>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      step={0.5}
                      value={entry.hours || ''}
                      onChange={e => updateEntryHours(idx, e.target.value)}
                      className="csp-input"
                      style={{ height: '2rem' }}
                    />
                    <span className="csp-text-muted" style={{ fontSize: '0.875rem' }}>{dayNames[idx].slice(0, 3)} Comment</span>
                    <input
                      value={entry.description ?? ''}
                      onChange={e => updateEntryDescription(idx, e.target.value)}
                      placeholder="---"
                      className="csp-input"
                      style={{ height: '2rem' }}
                    />
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid hsl(var(--border))' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Total: {formTotal} hours</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid hsl(var(--border))' }}>
              <button className="csp-btn csp-btn-primary" disabled={isSaving} onClick={saveForm}>{isSaving ? 'Saving...' : 'Save'}</button>
              <button className="csp-btn csp-btn-primary" style={{ backgroundColor: '#16a34a' }} onClick={approveTimesheet}>
                <CheckCircle2 className="csp-icon-sm" /> Approve
              </button>
              <button className="csp-btn csp-btn-outline" style={{ color: '#ea580c', borderColor: '#fdba74' }} onClick={() => { setReturnComment(''); setReturnDialog(true); }}>
                <RotateCcw className="csp-icon-sm" /> Return to User
              </button>
              <div style={{ flex: 1 }} />
              <button className="csp-btn csp-btn-ghost" onClick={closeForm}>Close</button>
            </div>
          </div>
        )}
      </Sheet>

      {/* ===== RETURN TO USER DIALOG ===== */}
      <Dialog open={returnDialog} onClose={() => setReturnDialog(false)} title="Return Timesheet to Consultant">
        <p className="csp-text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
          Add comments explaining what needs to be adjusted. The consultant will receive an email with these details.
        </p>
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.875rem', background: 'hsl(var(--muted) / 0.5)', borderRadius: 'var(--radius)', padding: '0.75rem' }}>
              <p><span style={{ fontWeight: 500 }}>Reference:</span> {selected.reference}</p>
              <p><span style={{ fontWeight: 500 }}>Consultant:</span> {selectedCon ? `${selectedCon.firstName} ${selectedCon.lastName}` : '\u2014'}</p>
              <p><span style={{ fontWeight: 500 }}>Contract:</span> {selectedCtr?.contractNumber}</p>
              <p><span style={{ fontWeight: 500 }}>Week:</span> {selected.weekStart} → {getWeekEnd(selected.weekStart)}</p>
            </div>
            <div>
              <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Comments *</label>
              <textarea className="csp-textarea" value={returnComment} onChange={e => setReturnComment(e.target.value)} placeholder="Please describe what needs to be adjusted..." rows={4} />
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '1rem' }}>
          <button className="csp-btn csp-btn-ghost" onClick={() => setReturnDialog(false)}>Cancel</button>
          <button className="csp-btn csp-btn-primary" disabled={!returnComment.trim()} onClick={handleReturn} style={{ backgroundColor: '#ea580c' }}>Send &amp; Return</button>
        </div>
      </Dialog>

      {/* ===== GENERATE TIMESHEETS DIALOG ===== */}
      <Dialog open={generateDialog} onClose={() => { if (genPhase !== 'generating') closeGenerateDialog(); }} title={genPhase === 'form' ? 'Generate Timesheets' : undefined} maxWidth="42rem">
        {genPhase === 'form' && (
          <>
            <p className="csp-text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              Select the month, year, and contracts to generate weekly timesheets for.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="csp-form-grid-2">
                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Month</label>
                  <select className="csp-select" value={genMonth} onChange={e => setGenMonth(e.target.value)}>
                    {monthNames.map((m, i) => <option key={i} value={String(i)}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Year</label>
                  <ToggleGroup value={genYearToggle} onChange={v => { if (v) setGenYearToggle(v); }}>
                    <ToggleGroupItem value="last">Last Year ({new Date().getFullYear() - 1})</ToggleGroupItem>
                    <ToggleGroupItem value="this">This Year ({new Date().getFullYear()})</ToggleGroupItem>
                    <ToggleGroupItem value="next">Next Year ({new Date().getFullYear() + 1})</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Active Contracts</label>
                  <button className="csp-btn csp-btn-ghost csp-btn-sm" onClick={() => setGenContractIds(allGenSelected ? new Set() : new Set(filteredGenContracts.map(c => c.id)))}>
                    {allGenSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                  <span style={{ position: 'absolute', left: '0.625rem', top: '0.625rem', color: 'hsl(var(--muted-foreground))', display: 'flex' }}><Search className="csp-icon-sm" /></span>
                  <input
                    className="csp-input"
                    placeholder="Search contracts..."
                    value={genContractSearch}
                    onChange={e => setGenContractSearch(e.target.value)}
                    style={{ paddingLeft: '2rem', height: '2.25rem' }}
                  />
                </div>
                <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', maxHeight: '300px', overflowY: 'auto' }}>
                  {filteredGenContracts.length === 0 ? (
                    <p className="csp-text-muted" style={{ fontSize: '0.875rem', textAlign: 'center', padding: '1rem 0' }}>No active contracts found</p>
                  ) : filteredGenContracts.map(c => {
                    const con = getContactById(c.contactId);
                    const childName = c.childAccountName
                      || (c.childAccountId ? getAccountById(c.childAccountId)?.name : '')
                      || c.parentAccountName
                      || getAccountById(c.parentAccountId)?.name
                      || '—';
                    const strategy = getHourStrategy(c);
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderBottom: '1px solid hsl(var(--border))', cursor: 'pointer' }}
                        onClick={() => setGenContractIds(prev => { const next = new Set(prev); if (next.has(c.id)) next.delete(c.id); else next.add(c.id); return next; })}>
                        <Checkbox checked={genContractIds.has(c.id)} onChange={checked => setGenContractIds(prev => { const next = new Set(prev); if (checked) next.add(c.id); else next.delete(c.id); return next; })} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="csp-text-truncate" style={{ fontSize: '0.875rem', fontWeight: 500 }}>{c.contractNumber}</p>
                          <p className="csp-text-muted csp-text-truncate" style={{ fontSize: '0.75rem' }}>{con ? `${con.firstName} ${con.lastName}` : '\u2014'} &bull; {childName ??'\u2014'}</p>
                        </div>
                        <span style={{ fontSize: '10px', padding: '0.125rem 0.375rem', borderRadius: 'var(--radius)', background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>
                          {strategy === 'eight' ? '8h/day' : strategy === 'zero' ? 'T&M' : strategy === 'ask' ? 'Fixed Price' : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="csp-text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>{genContractIds.size} of {activeContracts.length} contracts selected</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '1rem' }}>
              <button className="csp-btn csp-btn-ghost" onClick={closeGenerateDialog}>Cancel</button>
              <button className="csp-btn csp-btn-primary" disabled={genContractIds.size === 0} onClick={generateTimesheets}>Generate</button>
            </div>
          </>
        )}

        {genPhase === 'generating' && (
          <div style={{ padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '3.5rem', height: '3.5rem', borderRadius: '9999px', background: 'hsl(var(--primary) / 0.1)', margin: '0 auto' }}>
                <span style={{ width: '1.75rem', height: '1.75rem', color: 'hsl(var(--primary))', display: 'flex' }}><Loader2 className="csp-animate-spin" /></span>
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Generating Timesheets</h3>
              <p className="csp-text-muted" style={{ fontSize: '0.875rem' }}>{monthNames[Number(genMonth)]} {genYear} — Processing {genSteps.length} contracts</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }} className="csp-text-muted">
                <span>Progress</span>
                <span>{genProgress}%</span>
              </div>
              <div className="csp-progress" style={{ height: '0.5rem' }}>
                <div className="csp-progress-bar" style={{ width: `${genProgress}%`, transition: 'width 500ms ease' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '340px', overflowY: 'auto' }}>
              {genSteps.map((step, idx) => (
                <div key={step.contractId}>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.75rem', borderRadius: 'var(--radius)',
                      transition: 'all 300ms ease',
                      ...(step.status === 'processing' || step.status === 'waiting_input'
                        ? { background: 'hsl(var(--primary) / 0.05)', boxShadow: '0 0 0 1px hsl(var(--primary) / 0.2)', transform: 'scale(1.01)' }
                        : step.status === 'done'
                          ? { background: 'hsl(var(--muted) / 0.3)' }
                          : { opacity: 0.5 }
                      ),
                    }}
                  >
                    <div style={{ flexShrink: 0, width: '1.5rem', height: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {step.status === 'pending' && (
                        <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '9999px', background: 'hsl(var(--muted-foreground) / 0.3)' }} />
                      )}
                      {step.status === 'processing' && (
                        <span style={{ width: '1.25rem', height: '1.25rem', color: 'hsl(var(--primary))', display: 'flex' }}><Loader2 className="csp-animate-spin" /></span>
                      )}
                      {step.status === 'waiting_input' && (
                        <div style={{ width: '1.5rem', height: '1.5rem', borderRadius: '9999px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ width: '0.875rem', height: '0.875rem', color: '#d97706', display: 'flex' }}><ChevronRight /></span>
                        </div>
                      )}
                      {step.status === 'done' && (
                        <div className="csp-animate-scale-in" style={{ width: '1.5rem', height: '1.5rem', borderRadius: '9999px', background: 'hsl(var(--primary) / 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ width: '0.875rem', height: '0.875rem', color: 'hsl(var(--primary))', display: 'flex' }}><Check /></span>
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="csp-text-truncate" style={{
                        fontSize: '0.875rem',
                        ...(step.status === 'processing' || step.status === 'waiting_input' ? { fontWeight: 500 } : { color: 'hsl(var(--muted-foreground))' }),
                      }}>{step.label}</p>
                      <p className="csp-text-muted" style={{ fontSize: '10px' }}>{strategyLabel(step.strategy)}</p>
                    </div>
                    {step.status === 'done' && (
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--primary))', fontWeight: 500 }}>{step.weeksCreated} week{step.weeksCreated !== 1 ? 's' : ''}</span>
                    )}
                  </div>

                  {/* Interactive input for Fixed Price contracts */}
                  {step.status === 'waiting_input' && (
                    <div style={{ marginLeft: '2.25rem', marginTop: '0.5rem', marginBottom: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid #fde68a', background: 'rgba(254, 243, 199, 0.5)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <p style={{ fontSize: '0.875rem', color: '#92400e', fontWeight: 500 }}>
                        This is a Fixed Price contract. Enter the daily hours to populate:
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ flex: 1 }}>
                          <input
                            type="number"
                            min={0}
                            max={24}
                            step={0.5}
                            value={genAskInput}
                            onChange={e => setGenAskInput(e.target.value)}
                            placeholder="Hours per day"
                            className="csp-input"
                            style={{ height: '2.25rem' }}
                          />
                        </div>
                        <button className="csp-btn csp-btn-primary csp-btn-sm" onClick={() => handleAskSubmit(Number(genAskInput) || 0)} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ width: '0.875rem', height: '0.875rem', display: 'flex' }}><Check /></span> Apply
                        </button>
                        <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={handleAskSkip} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'hsl(var(--muted-foreground))' }}>
                          <span style={{ width: '0.875rem', height: '0.875rem', display: 'flex' }}><SkipForward /></span> Skip
                        </button>
                      </div>
                      <p className="csp-text-muted" style={{ fontSize: '11px' }}>
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
          <div style={{ padding: '2rem 0', display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'center' }}>
            <div className="csp-animate-scale-in" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '4rem', height: '4rem', borderRadius: '9999px', background: 'hsl(var(--primary) / 0.1)', margin: '0 auto' }}>
              <span style={{ width: '2rem', height: '2rem', color: 'hsl(var(--primary))', display: 'flex' }}><Sparkles /></span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Generation Complete!</h3>
              {genResultCount > 0 ? (
                <p className="csp-text-muted">
                  Successfully created <span style={{ fontWeight: 600 }}>{genResultCount} timesheet{genResultCount !== 1 ? 's' : ''}</span> for {monthNames[Number(genMonth)]} {genYear}
                </p>
              ) : (
                <p className="csp-text-muted">All weeks are already covered — no new timesheets needed.</p>
              )}
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              <div style={{ borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))', background: 'hsl(var(--muted) / 0.3)', padding: '0.75rem' }}>
                <span style={{ width: '1.25rem', height: '1.25rem', color: 'hsl(var(--primary))', margin: '0 auto 0.25rem', display: 'flex' }}><FileSpreadsheet /></span>
                <p style={{ fontSize: '1.125rem', fontWeight: 700 }}>{genResultCount}</p>
                <p className="csp-text-muted" style={{ fontSize: '0.75rem' }}>Timesheets</p>
              </div>
              <div style={{ borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))', background: 'hsl(var(--muted) / 0.3)', padding: '0.75rem' }}>
                <span style={{ width: '1.25rem', height: '1.25rem', color: 'hsl(var(--primary))', margin: '0 auto 0.25rem', display: 'flex' }}><CalendarDays /></span>
                <p style={{ fontSize: '1.125rem', fontWeight: 700 }}>{genSteps.length}</p>
                <p className="csp-text-muted" style={{ fontSize: '0.75rem' }}>Contracts</p>
              </div>
              <div style={{ borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))', background: 'hsl(var(--muted) / 0.3)', padding: '0.75rem' }}>
                <span style={{ width: '1.25rem', height: '1.25rem', color: 'hsl(var(--primary))', margin: '0 auto 0.25rem', display: 'flex' }}><CheckCircle2 /></span>
                <p style={{ fontSize: '1.125rem', fontWeight: 700 }}>Draft</p>
                <p className="csp-text-muted" style={{ fontSize: '0.75rem' }}>Status</p>
              </div>
            </div>

            <button className="csp-btn csp-btn-primary" onClick={closeGenerateDialog} style={{ marginTop: '0.5rem', alignSelf: 'center' }}>Done</button>
          </div>
        )}
      </Dialog>

      <SendTimesheetReportFlow open={reportDialog} onOpenChange={setReportDialog} />
    </div>
  );
}
