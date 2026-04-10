import * as React from 'react';
import { useState, useMemo } from 'react';
import { StatusBadge, PageHeader } from '../components/Shared';
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
import { Plus } from '../components/Icons';
import { expenses, entities, accounts, getEntityById, getAccountById } from '../data/mock-data';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { Expense, ExpenseType, ExpenseStatus, CurrencyCode } from '../types/crm';

const ALL_STATUSES: ExpenseStatus[] = ['Pending', 'Approved', 'Paid', 'Rejected'];
const ALL_TYPES: ExpenseType[] = ['Contractor Payment', 'Supplier Invoice', 'Tax', 'Permanent Employee', 'Operating Cost', 'Office Rent', 'Software Subscription'];
const ALL_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'RON', 'GBP'];

function getCountryFromEntity(entityId: string): string {
  return getEntityById(entityId)?.country || '—';
}

interface FormState {
  id: string;
  reference: string;
  entityId: string;
  accountId: string;
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
}

function expenseToForm(exp: Expense): FormState {
  return {
    id: exp.id,
    reference: exp.reference,
    entityId: exp.entityId,
    accountId: exp.accountId,
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
  };
}

function emptyForm(): FormState {
  return {
    id: '',
    reference: '',
    entityId: '',
    accountId: '',
    expenseType: 'Contractor Payment',
    currencyCode: 'EUR',
    totalAmount: '',
    vatAmount: '',
    netAmount: '',
    dateIssued: '',
    dueDate: '',
    paymentDate: '',
    vendorInvoiceNumber: '',
    status: 'Pending',
    periodMonth: '',
    periodYear: '',
  };
}

export default function ExpensesPage() {
  const { toast } = useToast();

  // --- Selection ---
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // --- Filters ---
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');

  // --- Column filters ---
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersType>({});

  // --- Sheet ---
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const isNew = !form.id;

  // --- Derived: country list from entities ---
  const countryOptions = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach(exp => {
      const country = getCountryFromEntity(exp.entityId);
      map.set(country, (map.get(country) || 0) + 1);
    });
    return Array.from(map.entries()).map(([country, count]) => ({ country, count }));
  }, []);

  // --- Status counts ---
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    ALL_STATUSES.forEach(s => { map[s] = 0; });
    expenses.forEach(exp => { map[exp.status] = (map[exp.status] || 0) + 1; });
    return map;
  }, []);

  // --- Type counts ---
  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    ALL_TYPES.forEach(t => { map[t] = 0; });
    expenses.forEach(exp => { map[exp.expenseType] = (map[exp.expenseType] || 0) + 1; });
    return map;
  }, []);

  // --- Filter logic ---
  const filtered = useMemo(() => {
    return expenses.filter(exp => {
      if (statusFilter !== 'all' && exp.status !== statusFilter) return false;
      if (typeFilter !== 'all' && exp.expenseType !== typeFilter) return false;
      if (countryFilter !== 'all' && getCountryFromEntity(exp.entityId) !== countryFilter) return false;

      // column filters
      const ref = getTextFilter(columnFilters, 'reference');
      if (ref && !exp.reference.toLowerCase().includes(ref.toLowerCase())) return false;

      const vendor = getTextFilter(columnFilters, 'vendor');
      if (vendor) {
        const name = getAccountById(exp.accountId)?.name || '';
        if (!name.toLowerCase().includes(vendor.toLowerCase())) return false;
      }

      const typeCol = getTextFilter(columnFilters, 'type');
      if (typeCol && !exp.expenseType.toLowerCase().includes(typeCol.toLowerCase())) return false;

      const countryCol = getTextFilter(columnFilters, 'country');
      if (countryCol) {
        const c = getCountryFromEntity(exp.entityId);
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
  }, [statusFilter, typeFilter, countryFilter, columnFilters]);

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
  const openNew = () => { setForm(emptyForm()); setSheetOpen(true); };
  const openEdit = (exp: Expense) => { setForm(expenseToForm(exp)); setSheetOpen(true); };

  // --- Save ---
  const handleSave = () => {
    toast.success(isNew ? 'Expense created successfully' : 'Expense updated successfully');
    setSheetOpen(false);
  };

  // --- Form helpers ---
  const updateForm = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  // --- Lookup options ---
  const accountOptions = useMemo(() => accounts.map(a => ({ value: a.id, label: a.name })), []);
  const entityOptions = useMemo(() => entities.map(e => ({ value: e.id, label: `${e.shortName} (${e.country})` })), []);

  return (
    <div>
      <HeaderSelectionBar count={selected.size} onClearSelection={() => setSelected(new Set())} entityLabel="expenses" />

      <PageHeader
        title="Expenses"
        subtitle="Manage your expenses"
        action={
          <button className="csp-btn csp-btn-primary" onClick={openNew}>
            <Plus className="csp-icon-inline" /> New Expense
          </button>
        }
      />

      {/* Status toggle */}
      <div className="csp-filter-bar">
        <ToggleGroup value={statusFilter} onChange={setStatusFilter}>
          <ToggleGroupItem value="all">All ({expenses.length})</ToggleGroupItem>
          {ALL_STATUSES.map(s => (
            <ToggleGroupItem key={s} value={s}>{s} ({statusCounts[s] || 0})</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Type toggle */}
      <div className="csp-filter-bar">
        <ToggleGroup value={typeFilter} onChange={setTypeFilter}>
          <ToggleGroupItem value="all">All Types</ToggleGroupItem>
          {ALL_TYPES.map(t => (
            <ToggleGroupItem key={t} value={t}>{t} ({typeCounts[t] || 0})</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Country toggle */}
      <div className="csp-filter-bar">
        <ToggleGroup value={countryFilter} onChange={setCountryFilter}>
          <ToggleGroupItem value="all">All Countries</ToggleGroupItem>
          {countryOptions.map(c => (
            <ToggleGroupItem key={c.country} value={c.country}>{c.country} ({c.count})</ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ClearColumnFiltersButton filters={columnFilters} setFilters={setColumnFilters} />
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
                Reference
                <TextFilterPopover label="Reference" value={getTextFilter(columnFilters, 'reference')} onChange={v => setTextFilter(setColumnFilters, 'reference', v)} />
              </th>
              <th className="csp-th">
                Vendor
                <TextFilterPopover label="Vendor" value={getTextFilter(columnFilters, 'vendor')} onChange={v => setTextFilter(setColumnFilters, 'vendor', v)} />
              </th>
              <th className="csp-th">
                Type
                <TextFilterPopover label="Type" value={getTextFilter(columnFilters, 'type')} onChange={v => setTextFilter(setColumnFilters, 'type', v)} />
              </th>
              <th className="csp-th">
                Country
                <TextFilterPopover label="Country" value={getTextFilter(columnFilters, 'country')} onChange={v => setTextFilter(setColumnFilters, 'country', v)} />
              </th>
              <th className="csp-th">
                Date
                <DateRangeFilterPopover label="Date" {...getDateFilter(columnFilters, 'dateIssued')} onChange={(from, to) => setDateFilter(setColumnFilters, 'dateIssued', from, to)} />
              </th>
              <th className="csp-th">
                Due Date
                <DateRangeFilterPopover label="Due Date" {...getDateFilter(columnFilters, 'dueDate')} onChange={(from, to) => setDateFilter(setColumnFilters, 'dueDate', from, to)} />
              </th>
              <th className="csp-th">
                Currency
                <MultiSelectFilterPopover label="Currency" options={ALL_CURRENCIES} selected={getMultiFilter(columnFilters, 'currency')} onChange={v => setMultiFilter(setColumnFilters, 'currency', v)} />
              </th>
              <th className="csp-th csp-text-right">
                Total
                <NumberRangeFilterPopover label="Total" {...getNumberFilter(columnFilters, 'total')} onChange={(min, max) => setNumberFilter(setColumnFilters, 'total', min, max)} />
              </th>
              <th className="csp-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(exp => {
              const account = getAccountById(exp.accountId);
              const country = getCountryFromEntity(exp.entityId);
              return (
                <tr key={exp.id} className={cn('csp-tr', selected.has(exp.id) && 'csp-tr-selected')} onDoubleClick={() => openEdit(exp)}>
                  <td className="csp-td csp-td-check">
                    <Checkbox checked={selected.has(exp.id)} onChange={() => toggleOne(exp.id)} />
                  </td>
                  <td className="csp-td csp-td-link" onClick={() => openEdit(exp)}>{exp.reference}</td>
                  <td className="csp-td">{account?.name || '—'}</td>
                  <td className="csp-td">{exp.expenseType}</td>
                  <td className="csp-td">{country}</td>
                  <td className="csp-td">{formatDate(exp.dateIssued)}</td>
                  <td className="csp-td">{formatDate(exp.dueDate)}</td>
                  <td className="csp-td">{exp.currencyCode}</td>
                  <td className="csp-td csp-text-right">{formatCurrency(exp.totalAmount, exp.currencyCode)}</td>
                  <td className="csp-td"><StatusBadge status={exp.status} /></td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="csp-td csp-text-center csp-text-muted">No expenses found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sheet */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={isNew ? 'New Expense' : `Edit ${form.reference}`} width="32rem">
        <div className="csp-form-grid">
          <TextField label="Reference" value={form.reference} onChange={v => updateForm({ reference: v })} readOnly={!isNew} />
          <SelectField
            label="Status"
            value={form.status}
            onChange={v => updateForm({ status: v as ExpenseStatus })}
            options={ALL_STATUSES.map(s => ({ value: s, label: s }))}
          />
          <LookupField label="Vendor" value={form.accountId} onChange={v => updateForm({ accountId: v })} options={accountOptions} placeholder="Select vendor" />
          <SelectField
            label="Type"
            value={form.expenseType}
            onChange={v => updateForm({ expenseType: v as ExpenseType })}
            options={ALL_TYPES.map(t => ({ value: t, label: t }))}
          />
          <LookupField label="Entity (Country)" value={form.entityId} onChange={v => updateForm({ entityId: v })} options={entityOptions} placeholder="Select entity" />
          <SelectField
            label="Currency"
            value={form.currencyCode}
            onChange={v => updateForm({ currencyCode: v as CurrencyCode })}
            options={ALL_CURRENCIES.map(c => ({ value: c, label: c }))}
          />
          <TextField label="Total Amount" value={form.totalAmount} onChange={v => updateForm({ totalAmount: v })} type="number" />
          <TextField label="VAT Amount" value={form.vatAmount} onChange={v => updateForm({ vatAmount: v })} type="number" />
          <TextField label="Net Amount" value={form.netAmount} onChange={v => updateForm({ netAmount: v })} type="number" />
          <DateField label="Date Issued" value={form.dateIssued} onChange={v => updateForm({ dateIssued: v })} />
          <DateField label="Due Date" value={form.dueDate} onChange={v => updateForm({ dueDate: v })} />
          <DateField label="Payment Date" value={form.paymentDate} onChange={v => updateForm({ paymentDate: v })} />
          <TextField label="Vendor Invoice #" value={form.vendorInvoiceNumber} onChange={v => updateForm({ vendorInvoiceNumber: v })} />
          <TextField label="Period Month" value={form.periodMonth} onChange={v => updateForm({ periodMonth: v })} type="number" />
          <TextField label="Period Year" value={form.periodYear} onChange={v => updateForm({ periodYear: v })} type="number" />
        </div>

        {/* Footer */}
        <div className="csp-sheet-footer">
          <button className="csp-btn csp-btn-outline" onClick={() => setSheetOpen(false)}>Close</button>
          <button className="csp-btn csp-btn-primary" onClick={handleSave}>Save</button>
        </div>
      </Sheet>
    </div>
  );
}
