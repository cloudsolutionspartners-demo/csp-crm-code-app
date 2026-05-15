import * as React from 'react';
import { useState, useMemo } from 'react';
import { StatusBadge, PageHeader, Spinner } from '../components/Shared';
import { Sheet, ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, SelectField, DateField, LookupField } from '../components/FormFields';
import {
  TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover, DateRangeFilterPopover,
  ClearColumnFiltersButton,
  ColumnFilters as ColumnFiltersType,
  getTextFilter, getMultiFilter, getNumberFilter, getDateFilter,
  setTextFilter, setMultiFilter, setNumberFilter, setDateFilter,
  matchDateRange, countActiveFilters,
} from '../components/ColumnFilters';
import { SearchPill, SinglePill, MultiPill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, type RelativeDateValue } from '../components/FilterPills';
import { Plus } from '../components/Icons';
import { expenses as mockExpenses, accounts as mockAccounts } from '../data/mock-data';
import { useDataverse } from '../services/useDataverse';
import { fetchExpenses, saveExpense, removeExpense } from '../services/expenseService';
import { getOrgUrl } from '../services/dataverseService';
import { Csp_expensesService } from '../generated/services/Csp_expensesService';
import { ByVendorView, ByTypeView, ByContractView } from '../components/expense/ExpenseAlternativeViews';
import { fetchAccounts } from '../services/accountService';
import { fetchContracts } from '../services/contractService';
import { fetchContacts } from '../services/contactService';
import { fetchBusinessUnits } from '../services/businessUnitService';
import type { BusinessUnit } from '../services/businessUnitService';
import type { Account, Contract, Contact } from '../types/crm';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { Expense, ExpenseType, ExpenseStatus, CurrencyCode } from '../types/crm';

const ALL_STATUSES: ExpenseStatus[] = ['Pending', 'Approved', 'Paid', 'Rejected'];
const ALL_TYPES: ExpenseType[] = ['Contractor Payment', 'Supplier Invoice', 'Tax', 'Permanent Employee', 'Operating Cost', 'Office Rent', 'Software Subscription'];
const TYPE_LABELS: Record<ExpenseType, string> = {
  'Contractor Payment': 'Contractor Payment',
  'Supplier Invoice': 'Supplier Invoice',
  'Tax': 'Tax',
  'Permanent Employee': 'Employee Salary',
  'Operating Cost': 'Operating Cost',
  'Office Rent': 'Office Rent',
  'Software Subscription': 'Software / Subscription',
};
const ALL_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'RON', 'GBP'];

type StatusFilter = 'all' | 'received' | 'paid' | 'overdue';
const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'received', label: 'Received' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

const STATUS_BADGE_STYLE: Record<string, React.CSSProperties> = {
  Received: { backgroundColor: 'hsl(220, 13%, 91%)', color: 'hsl(215, 25%, 27%)' },
  Paid: { backgroundColor: 'hsl(142, 76%, 92%)', color: 'hsl(142, 71%, 25%)' },
  Overdue: { backgroundColor: 'hsl(0, 86%, 94%)', color: 'hsl(0, 70%, 35%)' },
};

function expenseDisplayStatus(exp: Expense, today: Date): 'Received' | 'Paid' | 'Overdue' {
  if (exp.status === 'Paid') return 'Paid';
  const due = exp.dueDate ? new Date(exp.dueDate) : null;
  if (due && due < today) return 'Overdue';
  return 'Received';
}

function ExpenseStatusBadge({ label }: { label: 'Received' | 'Paid' | 'Overdue' }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: '0.75rem',
      fontWeight: 500,
      ...STATUS_BADGE_STYLE[label],
    }}>{label}</span>
  );
}

function FilterPills<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontSize: '0.8125rem',
              fontWeight: active ? 600 : 400,
              color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 4,
            }}
          >
            {o.label}
            {o.count !== undefined && o.count > 0 && (
              <span style={{ fontSize: '0.625rem', color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// getCountryFromEntity is defined inside the component using live BU data

interface FormState {
  id: string;
  reference: string;
  entityId: string;
  accountId: string;
  contractId: string;
  expenseType: ExpenseType;
  currencyCode: CurrencyCode;
  totalAmount: string;
  vatAmount: string;
  netAmount: string;
  dateIssued: string;
  dueDate: string;
  paymentDate: string;
  vendorInvoiceNumber: string;
  status: ExpenseStatus;
  periodMonth: string;
  periodYear: string;
  documentName: string;
}

function expenseToForm(exp: Expense): FormState {
  return {
    id: exp.id,
    reference: exp.reference,
    entityId: exp.entityId,
    accountId: exp.accountId,
    contractId: exp.contractId || '',
    expenseType: exp.expenseType,
    currencyCode: exp.currencyCode,
    totalAmount: String(exp.totalAmount),
    vatAmount: String(exp.vatAmount),
    netAmount: String(exp.netAmount),
    dateIssued: exp.dateIssued,
    dueDate: exp.dueDate,
    paymentDate: exp.paymentDate || '',
    vendorInvoiceNumber: exp.vendorInvoiceNumber || '',
    status: exp.status,
    periodMonth: String(exp.periodMonth),
    periodYear: String(exp.periodYear),
    documentName: (exp as any).documentName || '',
  };
}

function emptyForm(): FormState {
  const now = new Date();
  return {
    id: '',
    reference: '',
    entityId: '',
    accountId: '',
    contractId: '',
    expenseType: 'Supplier Invoice',
    currencyCode: 'EUR',
    totalAmount: '',
    vatAmount: '',
    netAmount: '',
    dateIssued: '',
    dueDate: '',
    paymentDate: '',
    vendorInvoiceNumber: '',
    status: 'Approved',
    periodMonth: String(now.getMonth() + 1),
    periodYear: String(now.getFullYear()),
    documentName: '',
  };
}

const MONTH_OPTIONS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
  { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
  { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

type FormStatusKey = 'Received' | 'Paid' | 'Overdue';
const FORM_STATUS_OPTIONS: FormStatusKey[] = ['Received', 'Paid', 'Overdue'];

function statusToFormKey(s: ExpenseStatus, dueDate: string, today: Date): FormStatusKey {
  if (s === 'Paid') return 'Paid';
  if (dueDate && new Date(dueDate) < today) return 'Overdue';
  return 'Received';
}

function formKeyToStatus(key: FormStatusKey): ExpenseStatus {
  if (key === 'Paid') return 'Paid';
  return 'Approved';
}

import { useConfirm } from '../components/ConfirmDialog';

export default function ExpensesPage() {
  const { toast } = useToast();
  const confirm = useConfirm();

  // --- Data: Dataverse with mock fallback ---
  const { data: expenses, loading, refetch, isLive } = useDataverse(fetchExpenses, mockExpenses);
  const { data: dvAccounts, refetch: refetchAccounts } = useDataverse<Account>(fetchAccounts, mockAccounts);
  const { data: dvContracts } = useDataverse<Contract>(fetchContracts, []);
  const { data: dvContacts } = useDataverse<Contact>(fetchContacts, []);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  React.useEffect(() => { fetchBusinessUnits().then(setBusinessUnits).catch(() => {}); }, []);
  const getBuName = (buId: string) => businessUnits.find(bu => bu.id === buId)?.name || '';
  const getCountryFromEntity = (buId: string) => getBuName(buId) || '\u2014';
  const [isSaving, setIsSaving] = useState(false);

  // --- Selection ---
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // --- Filters ---
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ExpenseType>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateIssuedFilter, setDateIssuedFilter] = useState<RelativeDateValue>({ type: 'all' });
  const [dueDateFilter, setDueDateFilter] = useState<RelativeDateValue>({ type: 'all' });

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  // --- Column filters ---
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersType>({});

  // --- Sheet ---
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const isNew = !form.id;
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const evidenceInputRef = React.useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<'table' | 'vendor' | 'type' | 'contract'>('table');

  // --- BU-based country options (always show all BUs) ---
  const unassignedCount = useMemo(() =>
    expenses.filter(exp => !businessUnits.find(bu => bu.id === exp.entityId)).length,
  [expenses, businessUnits]);

  // --- Status counts (Received / Paid / Overdue derived) ---
  const statusCounts = useMemo(() => {
    const map: Record<StatusFilter, number> = { all: expenses.length, received: 0, paid: 0, overdue: 0 };
    expenses.forEach(exp => {
      const s = expenseDisplayStatus(exp, today);
      if (s === 'Paid') map.paid++;
      else if (s === 'Overdue') map.overdue++;
      else map.received++;
    });
    return map;
  }, [expenses, today]);

  // --- Type counts ---
  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    ALL_TYPES.forEach(t => { map[t] = 0; });
    expenses.forEach(exp => { map[exp.expenseType] = (map[exp.expenseType] || 0) + 1; });
    return map;
  }, [expenses]);

  // --- Filter logic ---
  const filtered = useMemo(() => {
    return expenses.filter(exp => {
      if (statusFilter !== 'all') {
        const s = expenseDisplayStatus(exp, today);
        if (statusFilter === 'received' && s !== 'Received') return false;
        if (statusFilter === 'paid' && s !== 'Paid') return false;
        if (statusFilter === 'overdue' && s !== 'Overdue') return false;
      }
      if (typeFilter !== 'all' && exp.expenseType !== typeFilter) return false;
      if (countryFilter === '__unassigned__') {
        if (businessUnits.find(bu => bu.id === exp.entityId)) return false;
      } else if (countryFilter !== 'all') {
        if (exp.entityId !== countryFilter) return false;
      }
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const accName = getAccountName(exp.accountId) || '';
        const matches = (exp.reference || '').toLowerCase().includes(s) ||
          accName.toLowerCase().includes(s) ||
          (exp.vendorInvoiceNumber || '').toLowerCase().includes(s);
        if (!matches) return false;
      }
      if (dateIssuedFilter.type !== 'all') {
        const r = dateRangeFor(dateIssuedFilter);
        if (!matchDateRange(exp.dateIssued, r.from, r.to)) return false;
      }
      if (dueDateFilter.type !== 'all') {
        const r = dateRangeFor(dueDateFilter);
        if (!matchDateRange(exp.dueDate, r.from, r.to)) return false;
      }

      // column filters
      const ref = getTextFilter(columnFilters, 'reference');
      if (ref && !(exp.reference || '').toLowerCase().includes(ref.toLowerCase())) return false;

      const vendor = getTextFilter(columnFilters, 'vendor');
      if (vendor) {
        const name = getAccountName(exp.accountId) || '';
        if (!name.toLowerCase().includes(vendor.toLowerCase())) return false;
      }

      const typeCol = getTextFilter(columnFilters, 'type');
      if (typeCol && !(exp.expenseType || '').toLowerCase().includes(typeCol.toLowerCase())) return false;

      const countryCol = getTextFilter(columnFilters, 'country');
      if (countryCol) {
        const c = getCountryFromEntity(exp.entityId) || '';
        if (!c.toLowerCase().includes(countryCol.toLowerCase())) return false;
      }

      const dateRange = getDateFilter(columnFilters, 'dateIssued');
      if (!matchDateRange(exp.dateIssued, dateRange.from, dateRange.to)) return false;

      const dueDateRange = getDateFilter(columnFilters, 'dueDate');
      if (!matchDateRange(exp.dueDate, dueDateRange.from, dueDateRange.to)) return false;

      const currencySelected = getMultiFilter(columnFilters, 'currency');
      if (currencySelected.length > 0 && !currencySelected.includes(exp.currencyCode)) return false;

      const totalRange = getNumberFilter(columnFilters, 'total');
      if (totalRange.min && exp.totalAmount < Number(totalRange.min)) return false;
      if (totalRange.max && exp.totalAmount > Number(totalRange.max)) return false;

      return true;
    });
  }, [expenses, statusFilter, typeFilter, countryFilter, searchTerm, dateIssuedFilter, dueDateFilter, columnFilters, businessUnits, today]);

  const hasActiveFilters = !!searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || (countryFilter && countryFilter !== 'all') || dateIssuedFilter.type !== 'all' || dueDateFilter.type !== 'all';

  // --- Selection helpers ---
  const allSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map(r => r.id)));
  };
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // --- Open sheet ---
  const generateNextReference = (): string => {
    let max = 0;
    expenses.forEach(e => {
      const m = (e.reference || '').match(/^EXP-(\d+)/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n > max) max = n;
      }
    });
    return `EXP-${String(max + 1).padStart(6, '0')}`;
  };
  const openNew = () => {
    refetchAccounts();
    const seed = emptyForm();
    seed.reference = generateNextReference();
    const romaniaBu = businessUnits.find(b => (b.name || '').toLowerCase().includes('romania'));
    if (romaniaBu) seed.entityId = romaniaBu.id;
    setForm(seed);
    setOriginalEntityId('');
    setEvidenceFile(null);
    setSheetOpen(true);
  };
  const [originalEntityId, setOriginalEntityId] = useState<string>('');
  const openEdit = (exp: Expense) => { refetchAccounts(); setForm(expenseToForm(exp)); setOriginalEntityId(exp.entityId || ''); setEvidenceFile(null); setSheetOpen(true); };

  // --- Save ---
  const handleSave = async () => {
    if (isSaving) return;
    if (form.entityId && !businessUnits.find(bu => bu.id === form.entityId)) {
      toast.error('Please select a valid Business Unit');
      return;
    }
    setIsSaving(true);
    try {
      const expenseId = await saveExpense(form, isNew ? undefined : form.id, isNew ? undefined : originalEntityId);
      if (evidenceFile && expenseId) {
        try {
          await Csp_expensesService.upload(expenseId, 'csp_document', evidenceFile, evidenceFile.name);
          console.log('[Expense] Evidence PDF uploaded for', expenseId);
        } catch (uploadErr: any) {
          console.error('[Expense] Evidence upload failed:', uploadErr?.message);
        }
      }
      toast.success(isNew ? 'Expense created successfully' : 'Expense updated successfully');
      setEvidenceFile(null);
      setSheetOpen(false);
      await refetch();
    } catch (err: any) {
      console.error('Save failed:', err);
      toast.error(err?.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Form helpers ---
  const updateForm = (patch: Partial<FormState>) => setForm(prev => {
    const next = { ...prev, ...patch };
    if (patch.totalAmount !== undefined || patch.vatAmount !== undefined) {
      const total = Number(next.totalAmount);
      const vat = Number(next.vatAmount) || 0;
      if (!isNaN(total) && next.totalAmount !== '') {
        next.netAmount = String(total - vat);
      }
    }
    return next;
  });
  const closeForm = () => { setEvidenceFile(null); setSheetOpen(false); };
  const contractOptions = useMemo(() =>
    dvContracts.map(c => {
      const consultant = dvContacts.find(con => con.id === c.contactId);
      const consultantName = consultant ? `${consultant.firstName} ${consultant.lastName}` : '';
      const childAccount = c.childAccountId ? dvAccounts.find(a => a.id === c.childAccountId) : null;
      const childName = childAccount?.name || '';
      const parts = [c.contractNumber || c.name || c.id];
      if (consultantName) parts.push(consultantName);
      if (childName) parts.push(childName);
      return { value: c.id, label: parts.join(' — ') };
    }),
  [dvContracts, dvContacts, dvAccounts]);

  // --- Lookup options ---
  const accountOptions = useMemo(() => dvAccounts.map(a => ({ value: a.id, label: a.name })), [dvAccounts]);
  const getAccountName = (id: string) => dvAccounts.find(a => a.id === id)?.name || '—';
  const getContractName = (id?: string) => {
    if (!id) return '—';
    const c = dvContracts.find(c => c.id === id);
    return c ? (c.contractNumber || c.name || '—') : '—';
  };
  const entityOptions = useMemo(() => businessUnits.map(bu => ({ value: bu.id, label: bu.name })), [businessUnits]);

  return (
    <div>
      <HeaderSelectionBar
        count={selected.size}
        onClearSelection={() => setSelected(new Set())}
        entityLabel="expenses"
        showDelete={true}
        onDelete={async () => {
          const ids = Array.from(selected);
          const ok = await confirm({ title: 'Delete expense(s)', description: `Are you sure you want to delete ${ids.length} selected expense(s)? This action cannot be undone.` });
          if (!ok) return;
          try {
            for (const id of ids) await removeExpense(id);
            toast.success(`${ids.length} expense(s) deleted`);
            setSelected(new Set());
            await refetch();
          } catch (err: any) { toast.error('Delete failed'); }
        }}
      />

      <PageHeader
        title="Expenses"
        subtitle={loading ? 'Loading...' : `${filtered.length} of ${expenses.length} expenses${isLive ? '' : ' (mock data)'}`}
        action={
          <button className="csp-btn csp-btn-primary" onClick={openNew}>
            <Plus className="csp-icon-inline" /> Add Expense
          </button>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search reference, vendor, invoice #..." />
          <SinglePill label="Status" value={statusFilter === 'all' ? '' : statusFilter} onChange={v => setStatusFilter((v || 'all') as StatusFilter)}
            options={STATUS_FILTERS.filter(s => s.value !== 'all').map(s => ({ value: s.value, label: s.label, count: statusCounts[s.value] }))} />
          <SinglePill label="Type" value={typeFilter === 'all' ? '' : typeFilter} onChange={v => setTypeFilter((v || 'all') as ('all' | ExpenseType))}
            options={ALL_TYPES.map(t => ({ value: t, label: TYPE_LABELS[t], count: typeCounts[t] || 0 }))} />
          <SinglePill label="Country" value={countryFilter === 'all' ? '' : countryFilter} onChange={v => setCountryFilter(v || 'all')}
            options={[
              ...businessUnits.map(bu => ({ value: bu.id, label: bu.name, count: expenses.filter(e => e.entityId === bu.id).length })),
              ...(unassignedCount > 0 ? [{ value: '__unassigned__', label: 'Unassigned', count: unassignedCount }] : []),
            ]} />
          <DatePill label="Date Issued" value={dateIssuedFilter} onChange={setDateIssuedFilter} dates={expenses.map(e => e.dateIssued).filter(Boolean) as string[]} />
          <DatePill label="Due Date" value={dueDateFilter} onChange={setDueDateFilter} dates={expenses.map(e => e.dueDate).filter(Boolean) as string[]} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <ClearColumnFiltersButton filters={columnFilters} setFilters={setColumnFilters} />
            <span style={{ fontSize: 11, fontWeight: 500, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>View</span>
            {[
              { value: 'table', label: 'Table' },
              { value: 'vendor', label: 'By Vendor' },
              { value: 'type', label: 'By Type' },
              { value: 'contract', label: 'By Contract' },
            ].map(v => (
              <button key={v.value} onClick={() => setViewMode(v.value as any)}
                className={viewMode === v.value ? 'csp-btn csp-btn-sm csp-btn-primary' : 'csp-btn csp-btn-sm csp-btn-outline'}
                style={{ padding: '4px 10px', fontSize: 11 }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter !== 'all' && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('all')} />}
            {typeFilter !== 'all' && <FilterChip label={`Type: ${TYPE_LABELS[typeFilter as ExpenseType]}`} onRemove={() => setTypeFilter('all')} />}
            {countryFilter && countryFilter !== 'all' && <FilterChip label={`Country: ${countryFilter === '__unassigned__' ? 'Unassigned' : (businessUnits.find(b => b.id === countryFilter)?.name || countryFilter)}`} onRemove={() => setCountryFilter('all')} />}
            {dateIssuedFilter.type !== 'all' && <FilterChip label={`Date Issued: ${relativeDateLabel(dateIssuedFilter)}`} onRemove={() => setDateIssuedFilter({ type: 'all' })} />}
            {dueDateFilter.type !== 'all' && <FilterChip label={`Due Date: ${relativeDateLabel(dueDateFilter)}`} onRemove={() => setDueDateFilter({ type: 'all' })} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setTypeFilter('all'); setCountryFilter('all'); setDateIssuedFilter({ type: 'all' }); setDueDateFilter({ type: 'all' }); }}>Clear all</button>
          </div>
        )}
      </div>

      {viewMode === 'vendor' && <ByVendorView expenses={filtered} onOpen={openEdit} accounts={dvAccounts} contracts={dvContracts} />}
      {viewMode === 'type' && <ByTypeView expenses={filtered} onOpen={openEdit} accounts={dvAccounts} contracts={dvContracts} />}
      {viewMode === 'contract' && <ByContractView expenses={filtered} onOpen={openEdit} accounts={dvAccounts} contracts={dvContracts} />}

      {/* Table */}
      {viewMode === 'table' && (
      <div style={{ overflowX: 'auto' }}>
        <table className="csp-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 32, padding: '10px 8px' }}>
                <Checkbox checked={allSelected} onChange={toggleAll} />
              </th>
              <th style={{ padding: '10px 12px' }}>
                Reference
                <TextFilterPopover label="Reference" value={getTextFilter(columnFilters, 'reference')} onChange={v => setTextFilter(setColumnFilters, 'reference', v)} />
              </th>
              <th style={{ padding: '10px 12px' }}>
                Type
                <TextFilterPopover label="Type" value={getTextFilter(columnFilters, 'type')} onChange={v => setTextFilter(setColumnFilters, 'type', v)} />
              </th>
              <th style={{ padding: '10px 12px' }}>
                Vendor
                <TextFilterPopover label="Vendor" value={getTextFilter(columnFilters, 'vendor')} onChange={v => setTextFilter(setColumnFilters, 'vendor', v)} />
              </th>
              <th style={{ padding: '10px 12px' }}>Contract</th>
              <th style={{ padding: '10px 12px' }}>
                Currency
                <MultiSelectFilterPopover label="Currency" options={ALL_CURRENCIES} selected={getMultiFilter(columnFilters, 'currency')} onChange={v => setMultiFilter(setColumnFilters, 'currency', v)} />
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>
                Total
                <NumberRangeFilterPopover label="Total" {...getNumberFilter(columnFilters, 'total')} onChange={(min, max) => setNumberFilter(setColumnFilters, 'total', min, max)} />
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>VAT</th>
              <th style={{ padding: '10px 12px' }}>
                Date Issued
                <DateRangeFilterPopover label="Date Issued" {...getDateFilter(columnFilters, 'dateIssued')} onChange={(from, to) => setDateFilter(setColumnFilters, 'dateIssued', from, to)} />
              </th>
              <th style={{ padding: '10px 12px' }}>
                Due Date
                <DateRangeFilterPopover label="Due Date" {...getDateFilter(columnFilters, 'dueDate')} onChange={(from, to) => setDateFilter(setColumnFilters, 'dueDate', from, to)} />
              </th>
              <th style={{ padding: '10px 12px' }}>Vendor Invoice #</th>
              <th style={{ padding: '10px 12px' }}>
                Country
                <TextFilterPopover label="Country" value={getTextFilter(columnFilters, 'country')} onChange={v => setTextFilter(setColumnFilters, 'country', v)} />
              </th>
              <th style={{ padding: '10px 12px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(exp => {
              const account = { name: getAccountName(exp.accountId) };
              const country = getCountryFromEntity(exp.entityId);
              const status = expenseDisplayStatus(exp, today);
              const vatDisplay = exp.vatAmount && exp.vatAmount > 0 ? formatCurrency(exp.vatAmount, exp.currencyCode) : '—';
              return (
                <tr key={exp.id} className={cn('csp-tr csp-tr-clickable', selected.has(exp.id) && 'csp-tr-selected')} onClick={() => openEdit(exp)}>
                  <td style={{ width: 32, padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selected.has(exp.id)} onChange={() => toggleOne(exp.id)} />
                  </td>
                  <td className="csp-td-link" style={{ padding: '10px 12px' }}>{exp.reference}</td>
                  <td style={{ padding: '10px 12px' }}>{TYPE_LABELS[exp.expenseType] || exp.expenseType}</td>
                  <td style={{ padding: '10px 12px' }}>{account?.name || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{(() => {
                    const contract = exp.contractId ? dvContracts.find(c => c.id === exp.contractId) : null;
                    if (!contract) return '—';
                    const parts = [contract.contractNumber || contract.name || contract.id];
                    const consultant = dvContacts.find(c => c.id === contract.contactId);
                    if (consultant) parts.push(`${consultant.firstName} ${consultant.lastName}`);
                    const childAcc = contract.childAccountId ? dvAccounts.find(a => a.id === contract.childAccountId) : null;
                    if (childAcc) {
                      parts.push(childAcc.name);
                    } else {
                      const parentAcc = contract.parentAccountId ? dvAccounts.find(a => a.id === contract.parentAccountId) : null;
                      if (parentAcc) parts.push(parentAcc.name);
                    }
                    return parts.join(' — ');
                  })()}</td>
                  <td style={{ padding: '10px 12px' }}>{exp.currencyCode}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(exp.totalAmount, exp.currencyCode)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{vatDisplay}</td>
                  <td style={{ padding: '10px 12px' }}>{formatDate(exp.dateIssued)}</td>
                  <td style={{ padding: '10px 12px' }}>{formatDate(exp.dueDate)}</td>
                  <td style={{ padding: '10px 12px' }}>{exp.vendorInvoiceNumber || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{country}</td>
                  <td style={{ padding: '10px 12px' }}><ExpenseStatusBadge label={status} /></td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={13} className="csp-text-center csp-text-muted" style={{ padding: '24px 12px' }}>No expenses found</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Sheet */}
      <Sheet open={sheetOpen} onClose={closeForm} title={isNew ? 'New Expense' : form.reference} width="42rem">
        <button
          type="button"
          onClick={closeForm}
          style={{
            position: 'absolute', right: 16, top: 16,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, color: 'hsl(var(--muted-foreground))',
            lineHeight: 1, padding: 4, zIndex: 5,
          }}
          aria-label="Close"
        >{'×'}</button>

        {/* Status toggle (Received / Paid / Overdue) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '1rem', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))' }}>Status</span>
          <ToggleGroup
            value={statusToFormKey(form.status, form.dueDate, today)}
            onChange={v => updateForm({ status: formKeyToStatus(v as FormStatusKey) })}
          >
            {FORM_STATUS_OPTIONS.map(s => <ToggleGroupItem key={s} value={s}>{s}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>

        {/* General */}
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: 15, marginBottom: 8 }}>General</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <TextField label="Reference" value={form.reference} onChange={v => updateForm({ reference: v })} readOnly={!isNew} required />
            <SelectField label="Type" value={form.expenseType} onChange={v => updateForm({ expenseType: v as ExpenseType })} options={ALL_TYPES.map(t => ({ value: t, label: TYPE_LABELS[t] || t }))} required />
            <LookupField label="Vendor" value={form.accountId} onChange={v => updateForm({ accountId: v })} options={accountOptions} placeholder="Select vendor" required />
            <div />
            <div style={{ gridColumn: 'span 2' }}>
              <LookupField
                label="Contract"
                value={form.contractId}
                onChange={v => updateForm({ contractId: v })}
                options={contractOptions}
                placeholder="Select contract"
              />
            </div>
          </div>
        </div>

        {/* Financials */}
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Financials</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <TextField label="Total Amount" value={form.totalAmount} onChange={v => updateForm({ totalAmount: v })} type="number" required />
            <SelectField label="Currency" value={form.currencyCode} onChange={v => updateForm({ currencyCode: v as CurrencyCode })} options={ALL_CURRENCIES.map(c => ({ value: c, label: c }))} required />
          </div>
        </div>

        {/* Dates */}
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Dates</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <DateField label="Date Issued" value={form.dateIssued} onChange={v => updateForm({ dateIssued: v })} required />
            <DateField label="Due Date" value={form.dueDate} onChange={v => updateForm({ dueDate: v })} />
            <DateField label="Payment Date" value={form.paymentDate} onChange={v => updateForm({ paymentDate: v })} />
            <TextField label="Vendor Invoice #" value={form.vendorInvoiceNumber} onChange={v => updateForm({ vendorInvoiceNumber: v })} placeholder="e.g. INV-2026-0123" />
          </div>
        </div>

        {/* Period */}
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Period</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <LookupField label="Country" value={form.entityId} onChange={v => updateForm({ entityId: v })} options={entityOptions} placeholder="Select country" required />
            <div />
            <SelectField label="Period Month" value={form.periodMonth} onChange={v => updateForm({ periodMonth: v })} options={MONTH_OPTIONS} required />
            <TextField label="Period Year" value={form.periodYear} onChange={v => updateForm({ periodYear: v })} type="number" min="2000" max="2100" required />
          </div>
        </div>

        {/* Evidence */}
        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: 12 }}>Evidence</div>
          <input
            ref={evidenceInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setEvidenceFile(file);
            }}
          />
          <div
            onClick={() => evidenceInputRef.current?.click()}
            style={{
              border: '2px dashed hsl(var(--border))',
              borderRadius: 8,
              padding: '40px 20px',
              textAlign: 'center',
              color: 'hsl(var(--muted-foreground))',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 500 }}>Click to upload PDF evidence</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>PDF files only</div>
          </div>
          {evidenceFile && (
            <p style={{ fontSize: 12, color: 'hsl(var(--foreground))', marginTop: 8, fontWeight: 500 }}>
              Selected: {evidenceFile.name}
            </p>
          )}
          {!evidenceFile && form.documentName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 12, color: 'hsl(var(--foreground))', fontWeight: 500 }}>
                Current: {form.documentName}
              </span>
              <button
                type="button"
                className="csp-btn csp-btn-outline csp-btn-sm"
                style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => {
                  const orgUrl = getOrgUrl();
                  const url = `${orgUrl}/api/data/v9.2/csp_expenses(${form.id})/csp_document/$value`;
                  window.open(url, '_blank');
                }}
              >
                View PDF
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid hsl(var(--border))', paddingTop: 16, marginTop: 16 }}>
          <button className="csp-btn csp-btn-outline" onClick={closeForm}>Close</button>
          <button className="csp-btn csp-btn-primary" disabled={isSaving} onClick={handleSave}>
            {isSaving ? <><Spinner size="sm" /> Saving...</> : 'Save'}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
