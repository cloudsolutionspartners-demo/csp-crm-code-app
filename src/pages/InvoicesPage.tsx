import * as React from 'react';
import { useState, useMemo } from 'react';
import { StatusBadge, PageHeader } from '../components/Shared';
import { Sheet, Dialog, ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, SelectField, DateField, LookupField, TextAreaField } from '../components/FormFields';
import {
  TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover, DateRangeFilterPopover,
  ClearColumnFiltersButton,
  ColumnFilters as ColumnFiltersType,
  getTextFilter, getMultiFilter, getNumberFilter, getDateFilter,
  setTextFilter, setMultiFilter, setNumberFilter, setDateFilter,
  matchDateRange,
} from '../components/ColumnFilters';
import { SearchPill, SinglePill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, ALL_DATES, type RelativeDateValue } from '../components/FilterPills';
import { Plus, Trash2, CalendarDays } from '../components/Icons';
import { TutorialVideoButton } from '../components/TutorialVideoDialog';
import { AccountingMonthEndFlow } from '../components/AccountingMonthEndFlow';
import { useDataverse } from '../services/useDataverse';
import { fetchInvoices, saveInvoice, removeInvoice } from '../services/invoiceService';
import { fetchLinesByInvoiceId, createInvoiceLine, updateInvoiceLine, deleteInvoiceLine, setUomCache } from '../services/invoiceLineService';
import { fetchUnitsOfMeasure } from '../services/unitOfMeasureService';
import { fetchAccounts } from '../services/accountService';
import { fetchContacts } from '../services/contactService';
import { fetchContracts } from '../services/contractService';
import { fetchBusinessUnits } from '../services/businessUnitService';
import type { BusinessUnit } from '../services/businessUnitService';
import { invoices as mockInvoices, accounts as mockAccounts, contracts as mockContracts, contacts, getContractLookupLabel } from '../data/mock-data';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import type { Invoice, InvoiceStatus, CurrencyCode, UnitOfMeasure, Account, Contract, Contact } from '../types/crm';
import { GroupedByAccountView, MonthlyTimelineView, ByConsultantView } from '../components/invoice/InvoiceAlternativeViews';

const ALL_STATUSES: InvoiceStatus[] = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled', 'Credit Note'];
const ALL_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'RON', 'GBP'];
const ALL_UOM: UnitOfMeasure[] = ['Day', 'Hour', 'Month', 'Fixed'];
// consultantOptions built from Dataverse contacts inside the component

function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
}

interface FormLine {
  id: string;
  name: string;
  description: string;
  quantity: number;
  rate: number;
  currencyCode: CurrencyCode;
  amount: number;
  unitOfMeasure: UnitOfMeasure;
  contactId?: string;
  contractId?: string;
}

interface FormState {
  id: string;
  invoiceNumber: string;
  entityId: string;
  accountId: string;
  parentAccountId: string;
  contractId: string;
  currencyCode: CurrencyCode;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  vatRate: string;
  vatAmount: string;
  total: string;
  ronConversionRate: string;
  ronTotalValue: string;
  comments: string;
  status: InvoiceStatus;
  paymentReceivedDate: string;
  periodMonth: string;
  periodYear: string;
  lines: FormLine[];
}

function invoiceToForm(inv: Invoice): FormState {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    entityId: inv.entityId,
    accountId: inv.accountId,
    parentAccountId: inv.parentAccountId || '',
    contractId: inv.contractId || '',
    currencyCode: inv.currencyCode,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    subtotal: inv.subtotal,
    vatRate: inv.vatRate.toString(),
    vatAmount: inv.vatAmount.toString(),
    total: inv.total.toString(),
    ronConversionRate: inv.ronConversionRate?.toString() || '',
    ronTotalValue: inv.ronTotal?.toString() || '',
    comments: inv.comments || '',
    status: inv.status,
    paymentReceivedDate: inv.paymentReceivedDate || '',
    periodMonth: String(inv.periodMonth || ''),
    periodYear: String(inv.periodYear || ''),
    lines: inv.lines.map((l, idx) => ({
      id: l.id,
      name: l.name || `Line ${idx + 1}`,
      description: l.description,
      quantity: l.quantity,
      rate: l.rate,
      currencyCode: l.currencyCode,
      amount: l.amount,
      unitOfMeasure: l.unitOfMeasure,
      contactId: l.contactId,
      contractId: l.contractId,
    })),
  };
}

function emptyForm(): FormState {
  return {
    id: '',
    invoiceNumber: '',
    entityId: '',
    accountId: '',
    parentAccountId: '',
    contractId: '',
    currencyCode: 'EUR',
    invoiceDate: '',
    dueDate: '',
    subtotal: 0,
    vatRate: '19',
    vatAmount: '',
    total: '',
    ronConversionRate: '',
    ronTotalValue: '',
    comments: '',
    status: 'Draft',
    paymentReceivedDate: '',
    periodMonth: '',
    periodYear: '',
    lines: [],
  };
}

import { useConfirm } from '../components/ConfirmDialog';

export default function InvoicesPage() {
  const { toast } = useToast();
  const confirm = useConfirm();

  // --- Dataverse data ---
  const { data: invoices, loading, refetch, isLive } = useDataverse<Invoice>(fetchInvoices, mockInvoices);
  const { data: dvAccounts, refetch: refetchAccounts } = useDataverse<Account>(fetchAccounts, mockAccounts);
  const { data: dvContracts } = useDataverse<Contract>(fetchContracts, mockContracts);
  const { data: dvContacts } = useDataverse<Contact>(fetchContacts, contacts);
  const consultantOptions = useMemo(() => dvContacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })), [dvContacts]);
  const getConsultantName = (id?: string) => {
    if (!id) return '—';
    const c = dvContacts.find(ct => ct.id === id);
    return c ? `${c.firstName} ${c.lastName}` : '—';
  };

  // --- Business Units ---
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  React.useEffect(() => { fetchBusinessUnits().then(setBusinessUnits).catch(() => {}); }, []);

  // --- UoM map: name -> GUID (for line saves) ---
  const [uomMap, setUomMap] = useState<Record<string, string>>({});
  React.useEffect(() => {
    fetchUnitsOfMeasure().then(uoms => {
      const map: Record<string, string> = {};
      const idToName: Record<string, string> = {};
      uoms.forEach(u => {
        if (u.name) map[u.name] = u.id;
        if (u.id && u.name) idToName[u.id] = u.name;
      });
      setUomMap(map);
      setUomCache(idToName);
      console.log('[Invoice] UoM map loaded:', Object.keys(map).join(', '));
    }).catch(() => {});
  }, []);

  // --- Original line IDs (for delete-diff on save) ---
  const [originalLineIds, setOriginalLineIds] = useState<string[]>([]);
  const getBuName = (buId: string) => {
    const bu = businessUnits.find(b => b.id === buId);
    return bu ? bu.name : '';
  };

  // --- Selection ---
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // --- Status filter ---
  const [statusFilter, setStatusFilter] = useState('all');

  // --- Country filter ---
  const [countryFilter, setCountryFilter] = useState('all');

  const [searchTerm, setSearchTerm] = useState('');
  const [invoiceDateRel, setInvoiceDateRel] = useState<RelativeDateValue>(ALL_DATES);
  const [dueDateRel, setDueDateRel] = useState<RelativeDateValue>(ALL_DATES);

  // --- Column filters ---
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersType>({});

  // --- Sheet ---
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const isNew = !form.id;
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'account' | 'timeline' | 'consultant'>('table');

  // --- Line dialog ---
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [editingLineIdx, setEditingLineIdx] = useState<number | null>(null);
  const [lineForm, setLineForm] = useState<Record<string, any>>({});

  // Auto-recalc Line Total = Quantity × Sell Rate when contract / qty / UoM change.
  const updateLineField = (key: string, value: any) => setLineForm(prev => {
    const next = { ...prev, [key]: value };
    if (key === 'quantity' || key === 'unitOfMeasure' || key === 'contractId') {
      const contract = dvContracts.find(c => c.id === next.contractId);
      const qty = Number(next.quantity);
      if (contract && !isNaN(qty) && next.quantity !== '' && next.quantity !== undefined) {
        const dayRate = contract.sellRate ?? 0;
        const hourlyRate = contract.sellHourlyRate ?? 0;
        const perUnit = next.unitOfMeasure === 'Hour'
          ? (hourlyRate > 0 ? hourlyRate : dayRate / 8)
          : (next.unitOfMeasure === 'Month'
              ? (contract.monthlySalary ?? 0)
              : dayRate);
        next.lineTotal = (qty * perUnit).toFixed(2);
      }
    }
    return next;
  });

  // --- Month End ---
  const [monthEndOpen, setMonthEndOpen] = useState(false);

  // --- Lookup helpers: resolve account/contract by ID from live data ---
  const accountMap = useMemo(() => {
    const m = new Map<string, Account>();
    dvAccounts.forEach(a => m.set(a.id, a));
    return m;
  }, [dvAccounts]);

  const contractMap = useMemo(() => {
    const m = new Map<string, Contract>();
    dvContracts.forEach(c => m.set(c.id, c));
    return m;
  }, [dvContracts]);

  const getAccount = (id: string) => accountMap.get(id);
  const getContract = (id: string) => contractMap.get(id);

  function getCountryFromEntity(entityId: string): string {
    return getBuName(entityId) || '—';
  }

  // --- Derived: country list from loaded invoices ---
  const countryOptions = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach(inv => {
      const country = getCountryFromEntity(inv.entityId);
      map.set(country, (map.get(country) || 0) + 1);
    });
    return Array.from(map.entries()).map(([country, count]) => ({ country, count }));
  }, [invoices, businessUnits]);

  // --- Status counts ---
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    ALL_STATUSES.forEach(s => { map[s] = 0; });
    invoices.forEach(inv => { map[inv.status] = (map[inv.status] || 0) + 1; });
    return map;
  }, [invoices]);

  // --- Filter logic ---
  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (countryFilter !== 'all' && getCountryFromEntity(inv.entityId) !== countryFilter) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const accName = getAccount(inv.accountId)?.name || '';
        const matches = (inv.invoiceNumber || '').toLowerCase().includes(s) ||
          accName.toLowerCase().includes(s) ||
          (inv.comments || '').toLowerCase().includes(s);
        if (!matches) return false;
      }
      if (invoiceDateRel.type !== 'all') {
        const r = dateRangeFor(invoiceDateRel);
        if (!matchDateRange(inv.invoiceDate, r.from, r.to)) return false;
      }
      if (dueDateRel.type !== 'all') {
        const r = dateRangeFor(dueDateRel);
        if (!matchDateRange(inv.dueDate, r.from, r.to)) return false;
      }

      const invNum = getTextFilter(columnFilters, 'invoiceNumber');
      if (invNum && !inv.invoiceNumber.toLowerCase().includes(invNum.toLowerCase())) return false;

      const acctName = getTextFilter(columnFilters, 'account');
      if (acctName) {
        const name = getAccount(inv.accountId)?.name || '';
        if (!name.toLowerCase().includes(acctName.toLowerCase())) return false;
      }

      const contractText = getTextFilter(columnFilters, 'contract');
      if (contractText) {
        const c = inv.contractId ? getContract(inv.contractId) : null;
        const label = c ? (c.contractNumber || c.name) : '';
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
  }, [invoices, statusFilter, countryFilter, searchTerm, invoiceDateRel, dueDateRel, columnFilters, dvAccounts, dvContracts, businessUnits]);

  const hasActiveFilters = !!searchTerm || statusFilter !== 'all' || countryFilter !== 'all' || invoiceDateRel.type !== 'all' || dueDateRel.type !== 'all';

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
  const openNew = () => {
    refetchAccounts();
    setForm(emptyForm());
    setOriginalLineIds([]);
    setSheetOpen(true);
  };
  const openEdit = async (inv: Invoice) => {
    refetchAccounts();
    const nextForm = invoiceToForm(inv);
    // Fetch lines from Dataverse (not embedded in Invoice record)
    try {
      const lines = await fetchLinesByInvoiceId(inv.id);
      if (lines.length > 0) {
        const uomIdToName: Record<string, string> = {};
        Object.entries(uomMap).forEach(([name, id]) => { uomIdToName[id] = name; });
        nextForm.lines = lines.map((l, idx) => ({
          id: l.id,
          name: l.name || `Line ${idx + 1}`,
          description: l.description,
          quantity: l.quantity,
          rate: l.quantity > 0 ? l.lineTotal / l.quantity : 0,
          currencyCode: nextForm.currencyCode,
          amount: l.lineTotal,
          unitOfMeasure: (uomIdToName[l.unitOfMeasureId] || 'Day') as UnitOfMeasure,
          contactId: l.consultantId || undefined,
          contractId: l.contractId || undefined,
        }));
        setOriginalLineIds(lines.map(l => l.id));
      } else {
        setOriginalLineIds([]);
      }
    } catch (err) {
      console.error('[Invoice] Failed to fetch lines:', err);
      setOriginalLineIds([]);
    }
    setForm(nextForm);
    setSheetOpen(true);
  };
  const closeForm = () => setSheetOpen(false);

  // --- Save (Dataverse) ---
  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      // 1. Save the invoice itself
      const invoiceId = await saveInvoice(form, isNew ? undefined : form.id);

      // 2. Sync lines: create new, update existing, delete removed
      if (invoiceId) {
        const currentLineIds = form.lines.filter(l => isGuid(l.id)).map(l => l.id);
        // Deleted = in originalLineIds but not in currentLineIds
        const toDelete = originalLineIds.filter(id => !currentLineIds.includes(id));

        for (const line of form.lines) {
          const isExisting = isGuid(line.id) && originalLineIds.includes(line.id);
          const payload = {
            name: line.name,
            description: line.description,
            quantity: line.quantity,
            lineTotal: line.amount,
            invoiceId,
            consultantId: line.contactId,
            unitOfMeasureId: uomMap[line.unitOfMeasure] || '',
            contractId: line.contractId,
          };
          try {
            if (isExisting) {
              await updateInvoiceLine(line.id, payload);
            } else {
              await createInvoiceLine(payload);
            }
          } catch (lineErr: any) {
            console.error('[Invoice] Line save failed:', lineErr?.message);
          }
        }

        for (const id of toDelete) {
          try {
            await deleteInvoiceLine(id);
          } catch (delErr: any) {
            console.error('[Invoice] Line delete failed:', delErr?.message);
          }
        }
      }

      toast.success(isNew ? `Invoice "${form.invoiceNumber}" created` : `Invoice "${form.invoiceNumber}" saved`);
      closeForm();
      await refetch();
    } catch (err: any) {
      console.error('Save failed:', err);
      toast.error(err?.message || 'Save failed — check console');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Delete (Dataverse) ---
  const handleDelete = async () => {
    if (selected.size === 0) return;
    const ok = await confirm({ title: 'Delete invoice(s)', description: `Are you sure you want to delete ${selected.size} selected invoice(s)? This action cannot be undone.` });
    if (!ok) return;
    try {
      for (const id of selected) {
        await removeInvoice(id);
      }
      toast.success(`${selected.size} invoice(s) deleted`);
      setSelected(new Set());
      await refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    }
  };

  // --- Form helpers ---
  const updateForm = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  // Auto-calculate subtotal / VAT amount / total from lines + VAT rate
  React.useEffect(() => {
    if (!sheetOpen) return;
    if (form.lines.length === 0) return; // keep manual entry when no lines
    const subtotal = form.lines.reduce((sum, l) => sum + (l.amount || 0), 0);
    const vatRate = parseFloat(form.vatRate) || 0;
    const vatAmount = subtotal * (vatRate / 100);
    const total = subtotal + vatAmount;
    setForm(prev => ({
      ...prev,
      subtotal,
      vatAmount: vatAmount.toFixed(2),
      total: total.toFixed(2),
    }));
  }, [form.lines, form.vatRate, sheetOpen]);

  // --- Line CRUD (local only — invoice lines not yet in Dataverse) ---
  const openNewLine = () => {
    const autoName = `Line ${form.lines.length + 1}`;
    setEditingLineIdx(null);
    setLineForm({
      name: autoName,
      description: '',
      quantity: '',
      unitOfMeasure: 'Day',
      invoiceId: form.invoiceNumber || '',
      contactId: '',
      contractId: form.contractId || '',
      lineTotal: '',
    });
    setLineDialogOpen(true);
  };

  const openEditLine = (idx: number) => {
    const line = form.lines[idx];
    setEditingLineIdx(idx);
    setLineForm({
      name: line.name,
      description: line.description,
      quantity: line.quantity.toString(),
      unitOfMeasure: line.unitOfMeasure,
      invoiceId: form.invoiceNumber || '',
      contactId: line.contactId || '',
      contractId: (line as any).contractId || form.contractId || '',
      lineTotal: line.amount.toString(),
    });
    setLineDialogOpen(true);
  };

  const saveLine = () => {
    const lineData: FormLine = {
      id: editingLineIdx !== null ? form.lines[editingLineIdx].id : `line-${Date.now()}`,
      name: lineForm.name,
      description: lineForm.description || '',
      quantity: Number(lineForm.quantity) || 0,
      rate: 0,
      currencyCode: form.currencyCode,
      amount: Number(lineForm.lineTotal) || 0,
      unitOfMeasure: lineForm.unitOfMeasure as UnitOfMeasure,
      contactId: lineForm.contactId || undefined,
      contractId: lineForm.contractId || undefined,
    } as FormLine;

    if (editingLineIdx !== null) {
      const lines = [...form.lines];
      lines[editingLineIdx] = lineData;
      setForm(prev => ({ ...prev, lines }));
    } else {
      const lines = [...form.lines, lineData];
      setForm(prev => ({ ...prev, lines }));
    }
    setLineDialogOpen(false);
    toast.success(editingLineIdx !== null ? 'Line updated' : 'Line added');
  };

  const deleteLine = async (idx: number) => {
    const ok = await confirm({ title: 'Delete invoice line', description: 'Are you sure you want to delete this invoice line? This action cannot be undone.' });
    if (!ok) return;
    const lines = form.lines.filter((_, i) => i !== idx);
    setForm(prev => ({ ...prev, lines }));
    toast.success('Line deleted');
  };

  // --- Lookup options from live data ---
  const accountOptions = useMemo(
    () => dvAccounts
      .filter(a => a.accountType === 'Recruiter Agency' || a.accountType === 'Direct Customer')
      .map(a => ({ value: a.id, label: a.name })),
    [dvAccounts],
  );
  const childAccountOptions = useMemo(() => {
    if (!form.accountId) return [] as { value: string; label: string }[];
    return dvAccounts
      .filter(a => a.parentAccountId === form.accountId)
      .map(a => ({ value: a.id, label: a.name }));
  }, [dvAccounts, form.accountId]);
  const contractOptions = useMemo(() => {
    if (!form.accountId) {
      return dvContracts.map(c => ({ value: c.id, label: getContractLookupLabel(c) }));
    }
    // Include the selected account itself plus any of its child accounts.
    const childAccountIds = dvAccounts.filter(a => a.parentAccountId === form.accountId).map(a => a.id);
    const relevantAccountIds = new Set<string>([form.accountId, ...childAccountIds]);
    return dvContracts
      .filter(c => relevantAccountIds.has(c.parentAccountId) || relevantAccountIds.has(c.childAccountId))
      .map(c => ({ value: c.id, label: getContractLookupLabel(c) }));
  }, [dvContracts, dvAccounts, form.accountId]);

  // Filter contracts to those linked to the invoice's account or its child accounts.
  // Label prefers the child account name (e.g. "Euna") over the parent (e.g. "Imprint").
  const lineContractOptions = useMemo(() => {
    const accountId = form.accountId;
    const buildLabel = (c: any) => [
      c.contractNumber || c.name,
      c.childAccountName || c.parentAccountName,
      c.assignedToName,
    ].filter(Boolean).join(' — ');
    if (!accountId) {
      return dvContracts.map(c => ({ value: c.id, label: buildLabel(c) }));
    }
    const childAccountIds = dvAccounts.filter(a => a.parentAccountId === accountId).map(a => a.id);
    const relevantAccountIds = new Set<string>([accountId, ...childAccountIds]);
    return dvContracts
      .filter(c => relevantAccountIds.has(c.parentAccountId) || relevantAccountIds.has(c.childAccountId))
      .map(c => ({ value: c.id, label: buildLabel(c) }));
  }, [dvContracts, dvAccounts, form.accountId]);

  const handleContractChange = (contractId: string) => {
    updateForm({ contractId });
    const contract = dvContracts.find(c => c.id === contractId);
    if (!contract) return;
    const patch: any = {};
    if (!form.accountId && contract.parentAccountId) patch.accountId = contract.parentAccountId;
    if (!form.parentAccountId && contract.parentAccountId) patch.parentAccountId = contract.parentAccountId;
    if (!form.entityId && contract.entityId) patch.entityId = contract.entityId;
    if ((!form.currencyCode || form.currencyCode === 'EUR') && contract.sellCurrency) patch.currencyCode = contract.sellCurrency;
    if (Object.keys(patch).length > 0) updateForm(patch);
  };

  const handleAccountChange = (accountId: string) => {
    // Clear dependent fields whenever the parent Account changes.
    updateForm({ accountId, parentAccountId: '', contractId: '' });
  };
  const entityOptions = useMemo(() => {
    return businessUnits.map(bu => ({ value: bu.id, label: bu.name }));
  }, [businessUnits]);

  return (
    <div>
      <HeaderSelectionBar count={selected.size} onClearSelection={() => setSelected(new Set())} onDelete={handleDelete} entityLabel="invoices" />

      <PageHeader
        title="Invoices"
        subtitle={loading ? 'Loading...' : `${filtered.length} of ${invoices.length} invoices${isLive ? '' : ' (mock data)'}`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClearColumnFiltersButton filters={columnFilters} setFilters={setColumnFilters} />
            <TutorialVideoButton moduleLabel="Invoices" entityLabel="Invoices" />
            <button className="csp-btn csp-btn-outline" onClick={() => setMonthEndOpen(true)}>
              <CalendarDays className="csp-icon-inline" /> Accounting Month End
            </button>
            <button className="csp-btn csp-btn-primary" onClick={openNew}>
              <Plus className="csp-icon-inline" /> New Invoice
            </button>
          </div>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search invoices..." />
          <SinglePill label="Status" value={statusFilter === 'all' ? '' : statusFilter} onChange={v => setStatusFilter(v || 'all')}
            options={ALL_STATUSES.map(s => ({ value: s, label: s, count: statusCounts[s] || 0 }))} />
          <SinglePill label="Country" value={countryFilter === 'all' ? '' : countryFilter} onChange={v => setCountryFilter(v || 'all')}
            options={countryOptions.map(c => ({ value: c.country, label: c.country, count: c.count }))} />
          <DatePill label="Invoice Date" value={invoiceDateRel} onChange={setInvoiceDateRel} dates={invoices.map(i => i.invoiceDate).filter(Boolean) as string[]} />
          <DatePill label="Due Date" value={dueDateRel} onChange={setDueDateRel} dates={invoices.map(i => i.dueDate).filter(Boolean) as string[]} />
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
            {statusFilter !== 'all' && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('all')} />}
            {countryFilter !== 'all' && <FilterChip label={`Country: ${countryFilter}`} onRemove={() => setCountryFilter('all')} />}
            {invoiceDateRel.type !== 'all' && <FilterChip label={`Invoice Date: ${relativeDateLabel(invoiceDateRel)}`} onRemove={() => setInvoiceDateRel(ALL_DATES)} />}
            {dueDateRel.type !== 'all' && <FilterChip label={`Due Date: ${relativeDateLabel(dueDateRel)}`} onRemove={() => setDueDateRel(ALL_DATES)} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setCountryFilter('all'); setInvoiceDateRel(ALL_DATES); setDueDateRel(ALL_DATES); }}>Clear all</button>
          </div>
        )}
      </div>

      {viewMode === 'account' && (
        <GroupedByAccountView invoices={filtered} onOpen={openEdit} />
      )}
      {viewMode === 'timeline' && (
        <MonthlyTimelineView invoices={filtered} onOpen={openEdit} />
      )}
      {viewMode === 'consultant' && (
        <ByConsultantView invoices={filtered} onOpen={openEdit} />
      )}

      {viewMode === 'table' && (
      /* Table */
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
              const account = getAccount(inv.accountId);
              const country = getCountryFromEntity(inv.entityId);
              return (
                <tr key={inv.id} className={cn('csp-tr csp-tr-clickable', selected.has(inv.id) && 'csp-tr-selected')} onClick={() => openEdit(inv)}>
                  <td className="csp-td csp-td-check" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selected.has(inv.id)} onChange={() => toggleOne(inv.id)} />
                  </td>
                  <td className="csp-td csp-td-link">{inv.invoiceNumber}</td>
                  <td className="csp-td">{account?.name || '—'}</td>
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
      )}

      {/* Sheet */}
      <Sheet open={sheetOpen} onClose={closeForm} title={isNew ? 'New Invoice' : form.invoiceNumber} width="42rem">
        {/* Status toggle */}
        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="csp-field-label" style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Status</span>
          <ToggleGroup value={form.status} onChange={v => updateForm({ status: v as InvoiceStatus })}>
            {ALL_STATUSES.map(s => (
              <ToggleGroupItem key={s} value={s}>{s}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Form fields */}
        <div style={{ marginTop: '1.5rem' }}>
          <div className="csp-form-grid-2" style={{ gap: '1rem 2rem' }}>
            <LookupField label="Account" value={form.accountId} onChange={handleAccountChange} options={accountOptions} placeholder="Select account" required />
            <LookupField label="Country" value={form.entityId} onChange={v => updateForm({ entityId: v })} options={entityOptions} placeholder="Select entity" required />

            <DateField label="Payment Received Date" value={form.paymentReceivedDate} onChange={v => updateForm({ paymentReceivedDate: v })} />
            <DateField label="Invoice Date" value={form.invoiceDate} onChange={v => updateForm({ invoiceDate: v })} required />

            <SelectField label="Currency" value={form.currencyCode} onChange={v => updateForm({ currencyCode: v as CurrencyCode })} options={ALL_CURRENCIES.map(c => ({ value: c, label: c }))} required />
            <DateField label="Due Date" value={form.dueDate} onChange={v => updateForm({ dueDate: v })} required />

            <TextField label="Total" value={form.total} onChange={v => updateForm({ total: v })} type="number" readOnly={form.lines.length > 0} />
            <TextField label="VAT Amount" value={form.vatAmount} onChange={v => updateForm({ vatAmount: v })} type="number" readOnly={form.lines.length > 0} />

            <TextField label="RON Total Value" value={form.ronTotalValue} onChange={v => updateForm({ ronTotalValue: v })} type="number" />
            <TextField label="VAT Rate %" value={form.vatRate} onChange={v => updateForm({ vatRate: v })} type="number" />

            <TextField label="RON Conversion Rate" value={form.ronConversionRate} onChange={v => updateForm({ ronConversionRate: v })} type="number" />
            <TextAreaField label="Comments" value={form.comments} onChange={v => updateForm({ comments: v })} rows={2} />
          </div>
        </div>

        {/* Invoice Lines */}
        <div className="csp-border-t csp-mt-4 csp-pt-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 500 }}>Invoice Lines</h4>
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={openNewLine}>
              <Plus className="csp-icon-inline" /> Add Line
            </button>
          </div>
          <div className="csp-table-wrapper">
            <table className="csp-table csp-table-compact">
              <thead>
                <tr>
                  <th className="csp-th">Name</th>
                  <th className="csp-th">Description</th>
                  <th className="csp-th">Qty</th>
                  <th className="csp-th">UoM</th>
                  <th className="csp-th">Consultant</th>
                  <th className="csp-th csp-text-right">Line Total</th>
                  <th className="csp-th" style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {form.lines.length === 0 ? (
                  <tr><td colSpan={7} className="csp-td csp-text-center csp-text-muted" style={{ padding: '1rem', fontSize: '0.875rem' }}>No lines yet. Click "Add Line" to add one.</td></tr>
                ) : form.lines.map((line, idx) => (
                  <tr key={line.id} className="csp-tr" style={{ cursor: 'pointer' }}>
                    <td className="csp-td" onClick={() => openEditLine(idx)}>{line.name}</td>
                    <td className="csp-td" onClick={() => openEditLine(idx)} style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line.description}</td>
                    <td className="csp-td" onClick={() => openEditLine(idx)}>{line.quantity}</td>
                    <td className="csp-td" onClick={() => openEditLine(idx)}>{line.unitOfMeasure}</td>
                    <td className="csp-td" onClick={() => openEditLine(idx)}>{getConsultantName(line.contactId)}</td>
                    <td className="csp-td csp-text-right" style={{ fontWeight: 500 }} onClick={() => openEditLine(idx)}>{formatCurrency(line.amount, form.currencyCode)}</td>
                    <td className="csp-td">
                      <button className="csp-btn csp-btn-ghost csp-btn-icon-sm csp-text-destructive" onClick={e => { e.stopPropagation(); deleteLine(idx); }}>
                        <Trash2 className="csp-icon-inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="csp-sheet-footer">
          <button className="csp-btn csp-btn-outline" onClick={closeForm}>Close</button>
          <button className="csp-btn csp-btn-primary" onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
        </div>
      </Sheet>

      {/* Invoice Line Dialog */}
      <Dialog open={lineDialogOpen} onClose={() => setLineDialogOpen(false)} title={editingLineIdx !== null ? 'Edit Invoice Line' : 'New Invoice Line'} maxWidth="42rem">
        <div className="csp-form-grid-2" style={{ gap: '1rem 2rem', padding: '1rem 0' }}>
          <TextField label="Name" value={lineForm.name || ''} onChange={() => {}} readOnly />
          <TextField label="Invoice" value={lineForm.invoiceId || ''} onChange={() => {}} readOnly />

          <div style={{ gridColumn: '1 / -1' }}>
            <LookupField
              label="Contract"
              value={lineForm.contractId || ''}
              onChange={v => updateLineField('contractId', v)}
              required
              options={lineContractOptions}
              placeholder={form.accountId ? (lineContractOptions.length === 0 ? 'No contracts for this account' : 'Select contract') : 'Select an account on the invoice first'}
            />
          </div>

          <TextAreaField label="Description" value={lineForm.description || ''} onChange={v => setLineForm(prev => ({ ...prev, description: v }))} required rows={4} />
          <LookupField label="Consultant" value={lineForm.contactId || ''} onChange={v => setLineForm(prev => ({ ...prev, contactId: v }))} options={consultantOptions} />

          <TextField label="Quantity" value={lineForm.quantity || ''} onChange={v => updateLineField('quantity', v)} required type="number" />
          <TextField label="Line Total" value={lineForm.lineTotal || ''} onChange={v => setLineForm(prev => ({ ...prev, lineTotal: v }))} required type="number" />

          <SelectField label="Unit of Measure" value={lineForm.unitOfMeasure || 'Day'} onChange={v => updateLineField('unitOfMeasure', v)} required options={ALL_UOM.map(u => ({ value: u, label: u }))} />
        </div>
        <div className="csp-dialog-footer">
          <button className="csp-btn csp-btn-outline" onClick={() => setLineDialogOpen(false)}>Cancel</button>
          <button className="csp-btn csp-btn-primary" onClick={saveLine}>Save</button>
        </div>
      </Dialog>

      {/* Accounting Month End Flow */}
      <AccountingMonthEndFlow open={monthEndOpen} onClose={() => setMonthEndOpen(false)} />
    </div>
  );
}
