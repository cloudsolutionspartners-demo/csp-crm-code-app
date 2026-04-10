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
import { invoices, entities, accounts, contracts, getEntityById, getAccountById, getContractById } from '../data/mock-data';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { Invoice, InvoiceStatus, CurrencyCode, InvoiceLine, UnitOfMeasure } from '../types/crm';

const ALL_STATUSES: InvoiceStatus[] = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled', 'Credit Note'];
const ALL_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'RON', 'GBP'];
const ALL_UOM: UnitOfMeasure[] = ['Day', 'Hour', 'Month', 'Fixed'];

function getCountryFromEntity(entityId: string): string {
  return getEntityById(entityId)?.country || '—';
}

const EMPTY_LINE: Omit<InvoiceLine, 'id' | 'invoiceId'> = {
  description: '', quantity: 0, rate: 0, currencyCode: 'EUR', amount: 0, unitOfMeasure: 'Day',
};

interface FormState {
  id: string;
  invoiceNumber: string;
  entityId: string;
  accountId: string;
  contractId: string;
  currencyCode: CurrencyCode;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  status: InvoiceStatus;
  paymentReceivedDate: string;
  periodMonth: string;
  periodYear: string;
  lines: Omit<InvoiceLine, 'id' | 'invoiceId'>[];
}

function invoiceToForm(inv: Invoice): FormState {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    entityId: inv.entityId,
    accountId: inv.accountId,
    contractId: inv.contractId || '',
    currencyCode: inv.currencyCode,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    subtotal: inv.subtotal,
    vatRate: inv.vatRate,
    vatAmount: inv.vatAmount,
    total: inv.total,
    status: inv.status,
    paymentReceivedDate: inv.paymentReceivedDate || '',
    periodMonth: String(inv.periodMonth),
    periodYear: String(inv.periodYear),
    lines: inv.lines.map(l => ({
      description: l.description,
      quantity: l.quantity,
      rate: l.rate,
      currencyCode: l.currencyCode,
      amount: l.amount,
      unitOfMeasure: l.unitOfMeasure,
      contractId: l.contractId,
      contactId: l.contactId,
    })),
  };
}

function emptyForm(): FormState {
  return {
    id: '',
    invoiceNumber: '',
    entityId: '',
    accountId: '',
    contractId: '',
    currencyCode: 'EUR',
    invoiceDate: '',
    dueDate: '',
    subtotal: 0,
    vatRate: 19,
    vatAmount: 0,
    total: 0,
    status: 'Draft',
    paymentReceivedDate: '',
    periodMonth: '',
    periodYear: '',
    lines: [{ ...EMPTY_LINE }],
  };
}

export default function InvoicesPage() {
  const { toast } = useToast();

  // --- Selection ---
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // --- Status filter ---
  const [statusFilter, setStatusFilter] = useState('all');

  // --- Country filter ---
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
    invoices.forEach(inv => {
      const country = getCountryFromEntity(inv.entityId);
      map.set(country, (map.get(country) || 0) + 1);
    });
    return Array.from(map.entries()).map(([country, count]) => ({ country, count }));
  }, []);

  // --- Status counts ---
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    ALL_STATUSES.forEach(s => { map[s] = 0; });
    invoices.forEach(inv => { map[inv.status] = (map[inv.status] || 0) + 1; });
    return map;
  }, []);

  // --- Filter logic ---
  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      // status filter
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      // country filter
      if (countryFilter !== 'all' && getCountryFromEntity(inv.entityId) !== countryFilter) return false;

      // column filters
      const invNum = getTextFilter(columnFilters, 'invoiceNumber');
      if (invNum && !inv.invoiceNumber.toLowerCase().includes(invNum.toLowerCase())) return false;

      const acctName = getTextFilter(columnFilters, 'account');
      if (acctName) {
        const name = getAccountById(inv.accountId)?.name || '';
        if (!name.toLowerCase().includes(acctName.toLowerCase())) return false;
      }

      const contractText = getTextFilter(columnFilters, 'contract');
      if (contractText) {
        const c = inv.contractId ? getContractById(inv.contractId) : null;
        const label = c ? c.contractNumber : '';
        if (!label.toLowerCase().includes(contractText.toLowerCase())) return false;
      }

      const countryCol = getTextFilter(columnFilters, 'country');
      if (countryCol) {
        const c = getCountryFromEntity(inv.entityId);
        if (!c.toLowerCase().includes(countryCol.toLowerCase())) return false;
      }

      const dateRange = getDateFilter(columnFilters, 'invoiceDate');
      if (!matchDateRange(inv.invoiceDate, dateRange.from, dateRange.to)) return false;

      const dueDateRange = getDateFilter(columnFilters, 'dueDate');
      if (!matchDateRange(inv.dueDate, dueDateRange.from, dueDateRange.to)) return false;

      const currencySelected = getMultiFilter(columnFilters, 'currency');
      if (currencySelected.length > 0 && !currencySelected.includes(inv.currencyCode)) return false;

      const totalRange = getNumberFilter(columnFilters, 'total');
      if (totalRange.min && inv.total < Number(totalRange.min)) return false;
      if (totalRange.max && inv.total > Number(totalRange.max)) return false;

      return true;
    });
  }, [statusFilter, countryFilter, columnFilters]);

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
  const openEdit = (inv: Invoice) => { setForm(invoiceToForm(inv)); setSheetOpen(true); };

  // --- Save ---
  const handleSave = () => {
    toast.success(isNew ? 'Invoice created successfully' : 'Invoice updated successfully');
    setSheetOpen(false);
  };

  // --- Form helpers ---
  const updateForm = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));
  const updateLine = (idx: number, patch: Partial<Omit<InvoiceLine, 'id' | 'invoiceId'>>) => {
    setForm(prev => {
      const lines = [...prev.lines];
      lines[idx] = { ...lines[idx], ...patch };
      // recalculate amount
      lines[idx].amount = lines[idx].quantity * lines[idx].rate;
      const subtotal = lines.reduce((s, l) => s + l.amount, 0);
      const vatAmount = subtotal * (prev.vatRate / 100);
      return { ...prev, lines, subtotal, vatAmount, total: subtotal + vatAmount };
    });
  };
  const addLine = () => {
    setForm(prev => ({ ...prev, lines: [...prev.lines, { ...EMPTY_LINE, currencyCode: prev.currencyCode }] }));
  };
  const removeLine = (idx: number) => {
    setForm(prev => {
      const lines = prev.lines.filter((_, i) => i !== idx);
      const subtotal = lines.reduce((s, l) => s + l.amount, 0);
      const vatAmount = subtotal * (prev.vatRate / 100);
      return { ...prev, lines, subtotal, vatAmount, total: subtotal + vatAmount };
    });
  };

  // --- Lookup options ---
  const accountOptions = useMemo(() => accounts.map(a => ({ value: a.id, label: a.name })), []);
  const entityOptions = useMemo(() => entities.map(e => ({ value: e.id, label: `${e.shortName} (${e.country})` })), []);
  const contractOptions = useMemo(() => contracts.map(c => ({ value: c.id, label: c.contractNumber })), []);

  return (
    <div>
      <HeaderSelectionBar count={selected.size} onClearSelection={() => setSelected(new Set())} entityLabel="invoices" />

      <PageHeader
        title="Invoices"
        subtitle="Manage your invoices"
        action={
          <button className="csp-btn csp-btn-primary" onClick={openNew}>
            <Plus className="csp-icon-inline" /> New Invoice
          </button>
        }
      />

      {/* Status toggle */}
      <div className="csp-filter-bar">
        <ToggleGroup value={statusFilter} onChange={setStatusFilter}>
          <ToggleGroupItem value="all">All ({invoices.length})</ToggleGroupItem>
          {ALL_STATUSES.map(s => (
            <ToggleGroupItem key={s} value={s}>{s} ({statusCounts[s] || 0})</ToggleGroupItem>
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
                Invoice #
                <TextFilterPopover label="Invoice #" value={getTextFilter(columnFilters, 'invoiceNumber')} onChange={v => setTextFilter(setColumnFilters, 'invoiceNumber', v)} />
              </th>
              <th className="csp-th">
                Account
                <TextFilterPopover label="Account" value={getTextFilter(columnFilters, 'account')} onChange={v => setTextFilter(setColumnFilters, 'account', v)} />
              </th>
              <th className="csp-th">
                Contract
                <TextFilterPopover label="Contract" value={getTextFilter(columnFilters, 'contract')} onChange={v => setTextFilter(setColumnFilters, 'contract', v)} />
              </th>
              <th className="csp-th">
                Country
                <TextFilterPopover label="Country" value={getTextFilter(columnFilters, 'country')} onChange={v => setTextFilter(setColumnFilters, 'country', v)} />
              </th>
              <th className="csp-th">
                Date
                <DateRangeFilterPopover label="Date" {...getDateFilter(columnFilters, 'invoiceDate')} onChange={(from, to) => setDateFilter(setColumnFilters, 'invoiceDate', from, to)} />
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
            {filtered.map(inv => {
              const account = getAccountById(inv.accountId);
              const contract = inv.contractId ? getContractById(inv.contractId) : null;
              const country = getCountryFromEntity(inv.entityId);
              return (
                <tr key={inv.id} className={cn('csp-tr', selected.has(inv.id) && 'csp-tr-selected')} onDoubleClick={() => openEdit(inv)}>
                  <td className="csp-td csp-td-check">
                    <Checkbox checked={selected.has(inv.id)} onChange={() => toggleOne(inv.id)} />
                  </td>
                  <td className="csp-td csp-td-link" onClick={() => openEdit(inv)}>{inv.invoiceNumber}</td>
                  <td className="csp-td">{account?.name || '—'}</td>
                  <td className="csp-td">{contract?.contractNumber || '—'}</td>
                  <td className="csp-td">{country}</td>
                  <td className="csp-td">{formatDate(inv.invoiceDate)}</td>
                  <td className="csp-td">{formatDate(inv.dueDate)}</td>
                  <td className="csp-td">{inv.currencyCode}</td>
                  <td className="csp-td csp-text-right">{formatCurrency(inv.total, inv.currencyCode)}</td>
                  <td className="csp-td"><StatusBadge status={inv.status} /></td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="csp-td csp-text-center csp-text-muted">No invoices found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sheet */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={isNew ? 'New Invoice' : `Edit ${form.invoiceNumber}`}>
        <div className="csp-form-grid">
          <TextField label="Invoice #" value={form.invoiceNumber} onChange={v => updateForm({ invoiceNumber: v })} readOnly={!isNew} />
          <SelectField
            label="Status"
            value={form.status}
            onChange={v => updateForm({ status: v as InvoiceStatus })}
            options={ALL_STATUSES.map(s => ({ value: s, label: s }))}
          />
          <LookupField label="Account" value={form.accountId} onChange={v => updateForm({ accountId: v })} options={accountOptions} placeholder="Select account" />
          <LookupField label="Entity (Country)" value={form.entityId} onChange={v => updateForm({ entityId: v })} options={entityOptions} placeholder="Select entity" />
          <DateField label="Invoice Date" value={form.invoiceDate} onChange={v => updateForm({ invoiceDate: v })} />
          <DateField label="Due Date" value={form.dueDate} onChange={v => updateForm({ dueDate: v })} />
          <SelectField
            label="Currency"
            value={form.currencyCode}
            onChange={v => updateForm({ currencyCode: v as CurrencyCode })}
            options={ALL_CURRENCIES.map(c => ({ value: c, label: c }))}
          />
          <TextField label="Period Month" value={form.periodMonth} onChange={v => updateForm({ periodMonth: v })} type="number" />
          <TextField label="Period Year" value={form.periodYear} onChange={v => updateForm({ periodYear: v })} type="number" />
          <DateField label="Payment Received Date" value={form.paymentReceivedDate} onChange={v => updateForm({ paymentReceivedDate: v })} />
        </div>

        {/* Totals section */}
        <div className="csp-form-section csp-border-t csp-mt-4 csp-pt-4">
          <div className="csp-form-grid">
            <TextField label="Subtotal" value={String(form.subtotal)} onChange={v => {
              const sub = Number(v) || 0;
              const vat = sub * (form.vatRate / 100);
              updateForm({ subtotal: sub, vatAmount: vat, total: sub + vat });
            }} type="number" />
            <TextField label="VAT Rate (%)" value={String(form.vatRate)} onChange={v => {
              const rate = Number(v) || 0;
              const vat = form.subtotal * (rate / 100);
              updateForm({ vatRate: rate, vatAmount: vat, total: form.subtotal + vat });
            }} type="number" />
            <TextField label="VAT Amount" value={String(form.vatAmount.toFixed(2))} onChange={() => {}} readOnly />
            <TextField label="Total" value={String(form.total.toFixed(2))} onChange={() => {}} readOnly />
          </div>
        </div>

        {/* Invoice Lines */}
        <div className="csp-form-section csp-mt-4">
          <div className="csp-section-header">
            <h3 className="csp-section-title">Invoice Lines</h3>
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={addLine}>
              <Plus className="csp-icon-inline" /> Add Line
            </button>
          </div>
          <div className="csp-table-wrapper">
            <table className="csp-table csp-table-compact">
              <thead>
                <tr>
                  <th className="csp-th">Description</th>
                  <th className="csp-th" style={{ width: 80 }}>Qty</th>
                  <th className="csp-th" style={{ width: 100 }}>Rate</th>
                  <th className="csp-th" style={{ width: 100 }}>UoM</th>
                  <th className="csp-th csp-text-right" style={{ width: 120 }}>Amount</th>
                  <th className="csp-th" style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {form.lines.map((line, idx) => (
                  <tr key={idx} className="csp-tr">
                    <td className="csp-td">
                      <input className="csp-input csp-input-sm" value={line.description} onChange={e => updateLine(idx, { description: e.target.value })} />
                    </td>
                    <td className="csp-td">
                      <input className="csp-input csp-input-sm" type="number" value={line.quantity} onChange={e => updateLine(idx, { quantity: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="csp-td">
                      <input className="csp-input csp-input-sm" type="number" value={line.rate} onChange={e => updateLine(idx, { rate: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="csp-td">
                      <select className="csp-select csp-select-sm" value={line.unitOfMeasure} onChange={e => updateLine(idx, { unitOfMeasure: e.target.value as UnitOfMeasure })}>
                        {ALL_UOM.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="csp-td csp-text-right">{formatCurrency(line.amount, form.currencyCode)}</td>
                    <td className="csp-td">
                      {form.lines.length > 1 && (
                        <button className="csp-btn csp-btn-ghost csp-btn-icon-sm" onClick={() => removeLine(idx)}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
