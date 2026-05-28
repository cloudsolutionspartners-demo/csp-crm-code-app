import * as React from 'react';
import { useState, useMemo } from 'react';
import { StatusBadge, PageHeader, Spinner, PageLoading } from '../components/Shared';
import { Sheet, Dialog, Tabs, ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, SelectField, SwitchField, DateField, LookupField } from '../components/FormFields';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getNumberFilter,
  setTextFilter, setMultiFilter, setNumberFilter,
  matchDateRange,
} from '../components/ColumnFilters';
import { SearchPill, SinglePill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, ALL_DATES, type RelativeDateValue } from '../components/FilterPills';
import { Plus } from '../components/Icons';
import {
  contracts as mockContracts, accounts as mockAccounts, contacts as mockContacts,
  entities, invoices as mockInvoices, expenses, timesheets as mockTimesheets,
  contractMilestones, getMilestonesByContractId, getEntityById, getContactById,
} from '../data/mock-data';
import { fetchContracts, saveContract as saveContractToDataverse } from '../services/contractService';
import { fetchInvoices } from '../services/invoiceService';
import { fetchTimesheets } from '../services/timesheetService';
import { saveMilestone as saveMilestoneToDataverse, fetchMilestones } from '../services/milestoneService';
import { fetchAccounts } from '../services/accountService';
import { fetchContacts } from '../services/contactService';
import { fetchBusinessUnits } from '../services/businessUnitService';
import type { BusinessUnit } from '../services/businessUnitService';
import { useDataverse } from '../services/useDataverse';
import type { Account, Contact } from '../types/crm';
import { cn, formatCurrency, formatDate, formatPercent } from '../lib/utils';
import type { Contract, ContractStatus, ContractType, BillingType, CurrencyCode, MilestoneStatus } from '../types/crm';
import { ByAccountView, ByChildAccountView, ByContractorView } from '../components/contract/ContractAlternativeViews';

// ===== Constants =====
const CONTRACT_STATUSES: ContractStatus[] = ['Draft', 'Active', 'Inactive' as ContractStatus, 'On Hold', 'Completed', 'Terminated'];
const CONTRACT_TYPES: ContractType[] = ['Standard Contracting', 'Permanent Employee', 'Fixed Price'];
const BILLING_TYPES: BillingType[] = ['Time & Material', 'Fixed Price', 'Monthly Salary', 'Standard Contracting'];
const CURRENCY_OPTIONS: { value: string; label: string }[] = [
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'GBP', label: 'GBP' },
  { value: 'RON', label: 'RON' },
];
const MILESTONE_STATUSES: MilestoneStatus[] = ['Pending', 'Invoiced', 'Paid'];

// Will be replaced by getBuName at runtime — this is the static fallback
// getCountryFromEntity is defined inside the component using live BU data

// getAccountName and getContactName are defined inside the component using live Dataverse data

// ===== Default form state =====
function emptyContract(): Contract {
  return {
    id: '',
    contractNumber: '',
    name: '',
    contractType: 'Standard Contracting',
    billingType: 'Time & Material',
    entityId: 'ent-1',
    parentAccountId: '',
    childAccountId: '',
    contactId: '',
    sellRate: 0,
    sellHourlyRate: 0,
    sellCurrency: 'EUR',
    buyRate: 0,
    buyHourlyRate: 0,
    buyCurrency: 'EUR',
    unitOfMeasure: 'Day',
    payTerms: '30 Days',
    margin: 0,
    marginPercent: 0,
    grossValue: 0,
    monthlySalary: 0,
    monthlySalaryCurrency: 'EUR',
    startDate: '',
    endDate: '',
    actualEndDate: '',
    hasTimesheet: true,
    hasMilestones: false,
    status: 'Draft',
  };
}

// ===== Component =====
import { useConfirm } from '../components/ConfirmDialog';

export default function ContractsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();

  // Data — Dataverse with mock fallback
  const { data: dvContracts, loading, refetch, isLive } = useDataverse(fetchContracts, mockContracts);
  const { data: dvAccounts, refetch: refetchAccounts } = useDataverse<Account>(fetchAccounts, mockAccounts);
  const { data: dvContacts } = useDataverse<Contact>(fetchContacts, mockContacts);
  const { data: invoices } = useDataverse(fetchInvoices, mockInvoices);
  const { data: timesheets } = useDataverse(fetchTimesheets, mockTimesheets);
  const [contractsList, setContractsList] = useState<Contract[]>(mockContracts);
  React.useEffect(() => { setContractsList(dvContracts); }, [dvContracts]);

  // Business Units
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  React.useEffect(() => { fetchBusinessUnits().then(setBusinessUnits).catch(() => {}); }, []);
  const buLookupOptions = useMemo(() => businessUnits.map(bu => ({ value: bu.id, label: bu.name })), [businessUnits]);
  const getBuName = (buId: string) => businessUnits.find(bu => bu.id === buId)?.name || '';

  // Lookup helpers from live data
  const getAccountName = (id: string) => dvAccounts.find(a => a.id === id)?.name || '—';
  const getContactName = (id: string) => { const c = dvContacts.find(x => x.id === id); return c ? `${c.firstName} ${c.lastName}` : '—'; };
  const getCountryFromEntity = (buId: string) => getBuName(buId) || '';

  // Filter bar state
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [billingFilter, setBillingFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDateRel, setStartDateRel] = useState<RelativeDateValue>(ALL_DATES);
  const [endDateRel, setEndDateRel] = useState<RelativeDateValue>(ALL_DATES);
  const [viewMode, setViewMode] = useState<'table' | 'account' | 'childaccount' | 'contractor'>('table');

  // Column filters
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract>(emptyContract());
  const [isNew, setIsNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalEntityId, setOriginalEntityId] = useState('');
  const [activeTab, setActiveTab] = useState('parties');

  // Milestone dialog
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({
    milestoneId: '',
    description: '',
    value: '0',
    currencyCode: 'EUR' as CurrencyCode,
    startDate: '',
    endDate: '',
  });
  const [localMilestones, setLocalMilestones] = useState<typeof contractMilestones>([]);

  // ===== Derived data =====
  // Show all BUs as Country options — always visible even with 0 contracts
  const allCountries = useMemo(() =>
    businessUnits.map(bu => bu.name).filter(Boolean).sort(),
  [businessUnits]);

  // Counts for filter badges
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    CONTRACT_STATUSES.forEach(s => { map[s] = contractsList.filter(c => c.status === s).length; });
    return map;
  }, [contractsList]);

  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    CONTRACT_TYPES.forEach(t => { map[t] = contractsList.filter(c => c.contractType === t).length; });
    return map;
  }, [contractsList]);

  const billingCounts = useMemo(() => {
    const map: Record<string, number> = {};
    BILLING_TYPES.forEach(b => { map[b] = contractsList.filter(c => c.billingType === b).length; });
    return map;
  }, [contractsList]);

  const countryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    allCountries.forEach(co => { map[co] = contractsList.filter(c => getCountryFromEntity(c.entityId) === co).length; });
    return map;
  }, [contractsList, allCountries]);

  // ===== Filtered list =====
  const filtered = useMemo(() => {
    let list = contractsList;

    // Status bar filter
    if (statusFilter !== 'all') list = list.filter(c => c.status === statusFilter);
    if (typeFilter !== 'all') list = list.filter(c => c.contractType === typeFilter);
    if (billingFilter !== 'all') list = list.filter(c => c.billingType === billingFilter);
    if (countryFilter === '__unassigned__') {
      list = list.filter(c => !businessUnits.find(bu => bu.id === c.entityId));
    } else if (countryFilter !== 'all') {
      list = list.filter(c => getCountryFromEntity(c.entityId) === countryFilter);
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(c => {
        const accName = getAccountName(c.parentAccountId) || '';
        const conName = getContactName(c.contactId) || '';
        return (c.contractNumber || '').toLowerCase().includes(s) ||
          (c.name || '').toLowerCase().includes(s) ||
          accName.toLowerCase().includes(s) ||
          conName.toLowerCase().includes(s);
      });
    }
    if (startDateRel.type !== 'all') {
      const r = dateRangeFor(startDateRel);
      list = list.filter(c => matchDateRange(c.startDate, r.from, r.to));
    }
    if (endDateRel.type !== 'all') {
      const r = dateRangeFor(endDateRel);
      list = list.filter(c => !c.endDate || matchDateRange(c.endDate, r.from, r.to));
    }

    // Column filters
    const contractNumFilter = getTextFilter(columnFilters, 'contractNumber');
    if (contractNumFilter) list = list.filter(c => c.contractNumber.toLowerCase().includes(contractNumFilter.toLowerCase()));

    const typeColFilter = getMultiFilter(columnFilters, 'contractType');
    if (typeColFilter.length) list = list.filter(c => typeColFilter.includes(c.contractType));

    const billingColFilter = getMultiFilter(columnFilters, 'billingType');
    if (billingColFilter.length) list = list.filter(c => billingColFilter.includes(c.billingType));

    const accountFilter = getTextFilter(columnFilters, 'account');
    if (accountFilter) list = list.filter(c => getAccountName(c.parentAccountId).toLowerCase().includes(accountFilter.toLowerCase()));

    const contractorFilter = getTextFilter(columnFilters, 'contractor');
    if (contractorFilter) list = list.filter(c => getContactName(c.contactId).toLowerCase().includes(contractorFilter.toLowerCase()));

    const marginRange = getNumberFilter(columnFilters, 'marginPercent');
    if (marginRange.min) list = list.filter(c => c.marginPercent >= Number(marginRange.min));
    if (marginRange.max) list = list.filter(c => c.marginPercent <= Number(marginRange.max));

    return list;
  }, [contractsList, statusFilter, typeFilter, billingFilter, countryFilter, searchTerm, startDateRel, endDateRel, columnFilters]);

  const hasActiveFilters = !!searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || billingFilter !== 'all' || countryFilter !== 'all' || startDateRel.type !== 'all' || endDateRel.type !== 'all';

  // ===== Selection helpers =====
  const allSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ===== Open sheet =====
  function openNew() {
    refetchAccounts();
    const newContract = {
      ...emptyContract(),
      id: `ctr-new-${Date.now()}`,
      contractNumber: '',
    };
    setEditingContract(newContract);
    setLocalMilestones([]);
    setIsNew(true);
    setActiveTab('parties');
    setSheetOpen(true);
  }

  function openEdit(contract: Contract) {
    refetchAccounts();
    const sell = contract.sellRate || 0;
    const buy = contract.buyRate || 0;
    const margin = sell - buy;
    const marginPct = sell > 0 ? Math.round(((sell - buy) / sell) * 10000) / 100 : 0;
    setEditingContract({ ...contract, margin, marginPercent: marginPct });
    setLocalMilestones([]);
    fetchMilestones()
      .then(all => {
        const contractIdLower = (contract.id || '').toLowerCase();
        const filtered = all.filter(m => (m.contractId || '').toLowerCase() === contractIdLower);
        setLocalMilestones(filtered as typeof contractMilestones);
      })
      .catch(err => {
        console.error('[ContractsPage] Failed to load milestones for contract', contract.id, err);
      });
    setIsNew(false);
    setOriginalEntityId(contract.entityId || '');
    setActiveTab('parties');
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
  }

  // ===== Save =====
  async function saveContract() {
    if (isSaving) return;
    if (editingContract.entityId && !businessUnits.find(bu => bu.id === editingContract.entityId)) {
      toast.error('Please select a valid Business Unit');
      return;
    }
    if (!editingContract.startDate) {
      toast.error('Start Date is required');
      setActiveTab('dates');
      return;
    }
    if (!editingContract.endDate) {
      toast.error('End Date is required');
      setActiveTab('dates');
      return;
    }
    if (new Date(editingContract.endDate) < new Date(editingContract.startDate)) {
      toast.error('End Date cannot be before Start Date');
      setActiveTab('dates');
      return;
    }
    setIsSaving(true);
    try {
      await saveContractToDataverse(editingContract as any, isNew ? undefined : editingContract.id, isNew ? undefined : originalEntityId);
      toast.success(isNew ? 'Contract created successfully' : 'Contract updated successfully');
      closeSheet();
      await refetch();
    } catch (err: any) {
      console.error('Save failed:', err);
      toast.error(err?.message || 'Save failed — check console for details');
    } finally {
      setIsSaving(false);
    }
  }

  // ===== Delete =====
  async function deleteContract() {
    const ok = await confirm({ title: 'Delete contract', description: 'Are you sure you want to delete this contract? This action cannot be undone.' });
    if (!ok) return;
    setContractsList(prev => prev.filter(c => c.id !== editingContract.id));
    toast.success('Contract deleted');
    closeSheet();
  }

  // ===== Milestone dialog =====
  function openMilestoneDialog() {
    const nextId = localMilestones.length + 1;
    setMilestoneForm({
      milestoneId: `MS-${String(nextId).padStart(3, '0')}`,
      description: '',
      value: '0',
      currencyCode: editingContract.sellCurrency,
      startDate: '',
      endDate: '',
    });
    setMilestoneDialogOpen(true);
  }

  async function saveMilestone() {
    try {
      const newId = await saveMilestoneToDataverse({
        milestoneId: milestoneForm.milestoneId,
        contractId: editingContract.id,
        description: milestoneForm.description,
        value: Number(milestoneForm.value),
        currencyCode: milestoneForm.currencyCode,
        startDate: milestoneForm.startDate,
        endDate: milestoneForm.endDate,
        status: 'Pending',
      });
      const newMilestone = {
        id: newId,
        milestoneId: milestoneForm.milestoneId,
        contractId: editingContract.id,
        description: milestoneForm.description,
        value: Number(milestoneForm.value),
        currencyCode: milestoneForm.currencyCode,
        startDate: milestoneForm.startDate,
        endDate: milestoneForm.endDate,
        status: 'Pending' as MilestoneStatus,
      };
      setLocalMilestones(prev => [...prev, newMilestone]);
      setMilestoneDialogOpen(false);
      toast.success('Milestone added');
    } catch (err: any) {
      console.error('[saveMilestone] failed:', err);
      toast.error(err?.message || 'Failed to save milestone');
    }
  }

  // ===== Related data for sheet tabs =====
  const contractInvoices = useMemo(() => invoices.filter(i => i.accountId === editingContract.parentAccountId), [editingContract.parentAccountId, invoices]);
  const contractTimesheets = useMemo(() => timesheets.filter(t => t.contractId === editingContract.id), [editingContract.id]);

  // ===== Lookup options =====
  const accountOptions = useMemo(() =>
    dvAccounts.filter(a => !a.parentAccountId).map(a => ({ value: a.id, label: a.name })),
  [dvAccounts]);
  const childAccountOptions = useMemo(() =>
    dvAccounts.filter(a => a.parentAccountId === editingContract.parentAccountId).map(a => ({ value: a.id, label: a.name })),
  [dvAccounts, editingContract.parentAccountId]);
  const accountOptionsWithNone = useMemo(() => [{ value: '', label: 'None' }, ...childAccountOptions], [childAccountOptions]);
  const consultantOptions = useMemo(() =>
    dvContacts.filter(c => c.contactType === 'Consultant').map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })),
  [dvContacts]);

  // ===== Tab definitions =====
  const sheetTabs = useMemo(() => {
    const tabs = [
      { id: 'parties', label: 'Parties' },
      { id: 'commercials', label: 'Commercials' },
      { id: 'dates', label: 'Dates' },
      { id: 'invoices', label: `Invoices (${contractInvoices.length})` },
      { id: 'timesheets', label: `Timesheets (${contractTimesheets.length})` },
    ];
    if (editingContract.hasMilestones) {
      tabs.push({ id: 'milestones', label: `Milestones (${localMilestones.length})` });
    }
    return tabs;
  }, [contractInvoices.length, contractTimesheets.length, editingContract.hasMilestones, localMilestones.length]);

  // ===== Update helper =====
  function update(field: keyof Contract, value: any) {
    setEditingContract(prev => {
      const next = { ...prev, [field]: value };
      // Auto-calculate margin when sell/buy rates change
      if (field === 'sellRate' || field === 'buyRate') {
        const sell = field === 'sellRate' ? Number(value) || 0 : next.sellRate;
        const buy = field === 'buyRate' ? Number(value) || 0 : next.buyRate;
        next.margin = sell - buy;
        next.marginPercent = sell > 0 ? Math.round(((sell - buy) / sell) * 10000) / 100 : 0;
      }
      return next;
    });
  }

  // ===== Render =====
  if (loading && contractsList.length === 0) {
    return <PageLoading message="Loading contracts..." />;
  }

  return (
    <div>
      <PageHeader
        title="Contracts"
        subtitle={`${filtered.length} of ${contractsList.length} contracts`}
        action={
          <button className="csp-btn csp-btn-primary" onClick={openNew}>
            <Plus className="csp-icon-inline" /> New Contract
          </button>
        }
      />

      <HeaderSelectionBar
        count={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        entityLabel="contracts"
        showActivate={true}
        showDeactivate={true}
        showDelete={true}
        showDownload={true}
        onActivate={async () => {
          const ids = Array.from(selectedIds);
          try {
            for (const id of ids) {
              await saveContractToDataverse({ status: 'Active' } as any, id);
            }
            toast.success(`${ids.length} contract(s) activated`);
            setSelectedIds(new Set());
            await refetch();
          } catch (err: any) { toast.error('Activate failed'); }
        }}
        onDeactivate={async () => {
          const ids = Array.from(selectedIds);
          try {
            for (const id of ids) {
              await saveContractToDataverse({ status: 'Inactive' } as any, id);
            }
            toast.success(`${ids.length} contract(s) deactivated`);
            setSelectedIds(new Set());
            await refetch();
          } catch (err: any) { toast.error('Deactivate failed'); }
        }}
        onDelete={async () => {
          const ids = Array.from(selectedIds);
          const ok = await confirm({ title: 'Delete contract(s)', description: `Are you sure you want to delete ${ids.length} selected contract(s)? This action cannot be undone.` });
          if (!ok) return;
          try {
            const { deleteRecord } = await import('../services/dataverseService');
            for (const id of ids) await deleteRecord('csp_contracts', id);
            toast.success(`${ids.length} contract(s) deleted`);
            setSelectedIds(new Set());
            await refetch();
          } catch (err: any) { toast.error('Delete failed'); }
        }}
        onDownload={() => {
          const selected = filtered.filter(c => selectedIds.has(c.id));
          if (selected.length === 0) return;
          const rows = selected.map(c => {
            const parentAcc = dvAccounts.find(a => a.id === c.parentAccountId);
            const childAcc = c.childAccountId ? dvAccounts.find(a => a.id === c.childAccountId) : null;
            const consultant = dvContacts.find(ct => ct.id === c.contactId);
            return {
              'Contract Number': c.contractNumber || c.name || '',
              'Contract Type': c.contractType,
              'Billing Type': c.billingType,
              'Parent Account': parentAcc?.name ?? '',
              'Child Account': childAcc?.name ?? '',
              'Consultant': consultant ? `${consultant.firstName} ${consultant.lastName}` : '',
              'Sell Day Rate': c.sellRate ?? '',
              'Sell Hourly Rate': c.sellHourlyRate ?? '',
              'Buy Day Rate': c.buyRate ?? '',
              'Buy Hourly Rate': c.buyHourlyRate ?? '',
              'Sell Currency': c.sellCurrency ?? '',
              'Buy Currency': c.buyCurrency ?? '',
              'Margin': c.margin ?? '',
              'Margin %': c.marginPercent ?? '',
              'Monthly Salary': c.monthlySalary ?? '',
              'Start Date': c.startDate ?? '',
              'End Date': c.endDate ?? '',
              'Has Timesheet': c.hasTimesheet ? 'Yes' : 'No',
              'Has Milestones': c.hasMilestones ? 'Yes' : 'No',
              'Status': c.status,
            } as Record<string, any>;
          }).sort((a, b) => String(a['Contract Number']).localeCompare(String(b['Contract Number'])));
          const headers = Object.keys(rows[0]);
          const csvContent = [
            headers.join(','),
            ...rows.map(row => headers.map(h => {
              const val = String(row[h] ?? '');
              return val.includes(',') || val.includes('"') || val.includes('\n')
                ? `"${val.replace(/"/g, '""')}"`
                : val;
            }).join(',')),
          ].join('\n');
          const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `contracts-${new Date().toISOString().slice(0, 10)}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success(`${rows.length} contract(s) exported`);
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search contracts..." />
          <SinglePill label="Status" value={statusFilter === 'all' ? '' : statusFilter} onChange={v => setStatusFilter(v || 'all')}
            options={CONTRACT_STATUSES.map(s => ({ value: s, label: s, count: statusCounts[s] || 0 }))} />
          <SinglePill label="Contract Type" value={typeFilter === 'all' ? '' : typeFilter} onChange={v => setTypeFilter(v || 'all')}
            options={CONTRACT_TYPES.map(t => ({ value: t, label: t, count: typeCounts[t] || 0 }))} />
          <SinglePill label="Billing Type" value={billingFilter === 'all' ? '' : billingFilter} onChange={v => setBillingFilter(v || 'all')}
            options={BILLING_TYPES.map(b => ({ value: b, label: b, count: billingCounts[b] || 0 }))} />
          <SinglePill label="Country" value={countryFilter === 'all' ? '' : countryFilter} onChange={v => setCountryFilter(v || 'all')}
            options={[
              ...allCountries.map(co => ({ value: co, label: co, count: countryCounts[co] || 0 })),
              ...(contractsList.filter(c => !businessUnits.find(bu => bu.id === c.entityId)).length > 0
                ? [{ value: '__unassigned__', label: 'Unassigned', count: contractsList.filter(c => !businessUnits.find(bu => bu.id === c.entityId)).length }]
                : []),
            ]} />
          <DatePill label="Start Date" value={startDateRel} onChange={setStartDateRel} dates={contractsList.map(c => c.startDate).filter(Boolean) as string[]} />
          <DatePill label="End Date" value={endDateRel} onChange={setEndDateRel} dates={contractsList.map(c => c.endDate).filter(Boolean) as string[]} />
          <div style={{ marginLeft: 'auto' }}>
            <ClearColumnFiltersButton filters={columnFilters} setFilters={setColumnFilters} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <span style={{ fontSize: '11px', fontWeight: 500, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>View</span>
            {[
              { value: 'table', label: 'Table' },
              { value: 'account', label: 'By Account' },
              { value: 'childaccount', label: 'By Child Account' },
              { value: 'contractor', label: 'By Contractor' },
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
            {typeFilter !== 'all' && <FilterChip label={`Contract: ${typeFilter}`} onRemove={() => setTypeFilter('all')} />}
            {billingFilter !== 'all' && <FilterChip label={`Billing: ${billingFilter}`} onRemove={() => setBillingFilter('all')} />}
            {countryFilter !== 'all' && <FilterChip label={`Country: ${countryFilter === '__unassigned__' ? 'Unassigned' : countryFilter}`} onRemove={() => setCountryFilter('all')} />}
            {startDateRel.type !== 'all' && <FilterChip label={`Start: ${relativeDateLabel(startDateRel)}`} onRemove={() => setStartDateRel(ALL_DATES)} />}
            {endDateRel.type !== 'all' && <FilterChip label={`End: ${relativeDateLabel(endDateRel)}`} onRemove={() => setEndDateRel(ALL_DATES)} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setTypeFilter('all'); setBillingFilter('all'); setCountryFilter('all'); setStartDateRel(ALL_DATES); setEndDateRel(ALL_DATES); }}>Clear all</button>
          </div>
        )}
      </div>

      {viewMode === 'account' && (
        <ByAccountView contracts={filtered} onOpen={openEdit} accounts={dvAccounts} contacts={dvContacts} />
      )}
      {viewMode === 'childaccount' && (
        <ByChildAccountView contracts={filtered} onOpen={openEdit} accounts={dvAccounts} contacts={dvContacts} />
      )}
      {viewMode === 'contractor' && (
        <ByContractorView contracts={filtered} onOpen={openEdit} accounts={dvAccounts} contacts={dvContacts} />
      )}

      {viewMode === 'table' && (
      <>
      {/* ===== Table ===== */}
      <div className="csp-table-wrap">
        <table className="csp-table">
          <thead>
            <tr>
              <th className="csp-th csp-th-check">
                <Checkbox checked={allSelected} onChange={toggleSelectAll} />
              </th>
              <th className="csp-th">
                <div className="csp-th-content">
                  Contract#
                  <TextFilterPopover label="Contract#" value={getTextFilter(columnFilters, 'contractNumber')} onChange={v => setTextFilter(setColumnFilters, 'contractNumber', v)} />
                </div>
              </th>
              <th className="csp-th">
                <div className="csp-th-content">
                  Contract Type
                  <MultiSelectFilterPopover label="Contract Type" options={CONTRACT_TYPES} selected={getMultiFilter(columnFilters, 'contractType')} onChange={v => setMultiFilter(setColumnFilters, 'contractType', v)} />
                </div>
              </th>
              <th className="csp-th">
                <div className="csp-th-content">
                  Billing Type
                  <MultiSelectFilterPopover label="Billing Type" options={BILLING_TYPES} selected={getMultiFilter(columnFilters, 'billingType')} onChange={v => setMultiFilter(setColumnFilters, 'billingType', v)} />
                </div>
              </th>
              <th className="csp-th">Country</th>
              <th className="csp-th">
                <div className="csp-th-content">
                  Account
                  <TextFilterPopover label="Account" value={getTextFilter(columnFilters, 'account')} onChange={v => setTextFilter(setColumnFilters, 'account', v)} />
                </div>
              </th>
              <th className="csp-th">Child Account</th>
              <th className="csp-th">
                <div className="csp-th-content">
                  Contractor
                  <TextFilterPopover label="Contractor" value={getTextFilter(columnFilters, 'contractor')} onChange={v => setTextFilter(setColumnFilters, 'contractor', v)} />
                </div>
              </th>
              <th className="csp-th csp-th-right">Sell Rate</th>
              <th className="csp-th csp-th-right">Buy Rate</th>
              <th className="csp-th csp-th-right">
                <div className="csp-th-content">
                  Margin%
                  <NumberRangeFilterPopover label="Margin%" min={getNumberFilter(columnFilters, 'marginPercent').min} max={getNumberFilter(columnFilters, 'marginPercent').max} onChange={(min, max) => setNumberFilter(setColumnFilters, 'marginPercent', min, max)} />
                </div>
              </th>
              <th className="csp-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(contract => (
              <tr
                key={contract.id}
                className={cn('csp-tr csp-tr-clickable', selectedIds.has(contract.id) && 'csp-tr-selected')}
                onClick={() => openEdit(contract)}
              >
                <td className="csp-td csp-td-check" onClick={e => e.stopPropagation()}>
                  <Checkbox checked={selectedIds.has(contract.id)} onChange={() => toggleSelect(contract.id)} />
                </td>
                <td className="csp-td csp-td-primary">{contract.contractNumber}</td>
                <td className="csp-td">{contract.contractType}</td>
                <td className="csp-td">{contract.billingType}</td>
                <td className="csp-td">{getBuName(contract.entityId) || getCountryFromEntity(contract.entityId) || '\u2014'}</td>
                <td className="csp-td">{contract.parentAccountName || getAccountName(contract.parentAccountId) || '—'}</td>
                <td className="csp-td">{contract.childAccountName || (contract.childAccountId ? getAccountName(contract.childAccountId) : '—')}</td>
                <td className="csp-td">{contract.assignedToName || getContactName(contract.contactId) || '—'}</td>
                <td className="csp-td csp-td-right">{formatCurrency(contract.sellRate, contract.sellCurrency)}</td>
                <td className="csp-td csp-td-right">{formatCurrency(contract.buyRate, contract.buyCurrency)}</td>
                <td className="csp-td csp-td-right">{formatPercent(
                  contract.marginPercent && contract.marginPercent !== 0
                    ? contract.marginPercent
                    : (contract.sellRate && contract.sellRate > 0
                        ? ((contract.sellRate - (contract.buyRate || 0)) / contract.sellRate) * 100
                        : 0)
                )}</td>
                <td className="csp-td"><StatusBadge status={contract.status} /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="csp-td csp-td-empty">No contracts found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </>
      )}

      {/* ===== Sheet ===== */}
      <Sheet open={sheetOpen} onClose={closeSheet} title={isNew ? 'New Contract' : `Edit ${[editingContract.contractNumber || editingContract.name, editingContract.parentAccountName, editingContract.assignedToName].filter(Boolean).join(' — ')}`} width="720px">
        <Tabs tabs={sheetTabs} activeTab={activeTab} onChange={setActiveTab}>

          {/* --- Parties Tab --- */}
          {activeTab === 'parties' && (
            <div className="csp-form-grid">
              <TextField
                label="Contract Number"
                value={
                  isNew
                    ? '(auto-generated on save)'
                    : [editingContract.contractNumber || editingContract.name, editingContract.parentAccountName, editingContract.assignedToName].filter(Boolean).join(' — ')
                }
                onChange={() => {}}
                readOnly
              />
              <SelectField
                label="Contract Type"
                value={editingContract.contractType}
                onChange={v => update('contractType', v)}
                options={CONTRACT_TYPES.map(t => ({ value: t, label: t }))}
              />
              <LookupField
                label="Parent Account"
                value={editingContract.parentAccountId}
                onChange={v => {
                  update('parentAccountId', v);
                  update('childAccountId', '');
                }}
                options={accountOptions}
                placeholder="Select account"
                required
              />
              <LookupField
                label="Child Account"
                value={editingContract.childAccountId || ''}
                onChange={v => update('childAccountId', v)}
                options={editingContract.parentAccountId ? accountOptionsWithNone : []}
                placeholder={editingContract.parentAccountId ? 'None' : 'Select a parent account first'}
              />
              <LookupField
                label="Assigned To"
                value={editingContract.contactId}
                onChange={v => update('contactId', v)}
                options={consultantOptions}
                placeholder="Select consultant"
                required
              />
              <SelectField
                label="Billing Type"
                value={editingContract.billingType}
                onChange={v => update('billingType', v)}
                options={BILLING_TYPES.map(b => ({ value: b, label: b }))}
              />
              <LookupField
                label="Business Unit"
                value={editingContract.entityId}
                onChange={v => update('entityId', v)}
                options={buLookupOptions}
              />
            </div>
          )}

          {/* --- Commercials Tab --- */}
          {activeTab === 'commercials' && (
            <div className="csp-form-grid">
              <TextField
                label="Sell Day Rate"
                value={String(editingContract.sellRate)}
                onChange={v => update('sellRate', Number(v) || 0)}
                type="number"
              />
              <TextField
                label="Buy Day Rate"
                value={String(editingContract.buyRate)}
                onChange={v => update('buyRate', Number(v) || 0)}
                type="number"
              />
              <TextField
                label="Sell Hourly Rate"
                value={String(editingContract.sellHourlyRate || 0)}
                onChange={v => update('sellHourlyRate', Number(v) || 0)}
                type="number"
              />
              <TextField
                label="Buy Hourly Rate"
                value={String(editingContract.buyHourlyRate || 0)}
                onChange={v => update('buyHourlyRate', Number(v) || 0)}
                type="number"
              />
              <SelectField
                label="Sell Currency"
                value={editingContract.sellCurrency}
                onChange={v => update('sellCurrency', v)}
                options={CURRENCY_OPTIONS}
              />
              <SelectField
                label="Buy Currency"
                value={editingContract.buyCurrency}
                onChange={v => update('buyCurrency', v)}
                options={CURRENCY_OPTIONS}
              />
              <TextField
                label="Margin"
                value={String(editingContract.margin)}
                onChange={() => {}}
                readOnly
              />
              <TextField
                label="Margin %"
                value={`${editingContract.marginPercent}%`}
                onChange={() => {}}
                readOnly
              />
              <TextField
                label="Gross Value"
                value={String(editingContract.grossValue || 0)}
                onChange={v => update('grossValue', Number(v) || 0)}
                type="number"
              />
              <TextField
                label="Monthly Salary"
                value={String(editingContract.monthlySalary || 0)}
                onChange={v => update('monthlySalary', Number(v) || 0)}
                type="number"
              />
              <SelectField
                label="Monthly Salary Currency"
                value={editingContract.monthlySalaryCurrency || 'EUR'}
                onChange={v => update('monthlySalaryCurrency', v)}
                options={CURRENCY_OPTIONS}
              />
              <SwitchField
                label="Has Milestones"
                checked={editingContract.hasMilestones}
                onChange={v => update('hasMilestones', v)}
              />
              <SwitchField
                label="Has Timesheet"
                checked={editingContract.hasTimesheet}
                onChange={v => update('hasTimesheet', v)}
              />
            </div>
          )}

          {/* --- Dates Tab --- */}
          {activeTab === 'dates' && (
            <div className="csp-form-grid">
              <DateField
                label="Start Date"
                value={editingContract.startDate}
                onChange={v => update('startDate', v)}
                required
              />
              <DateField
                label="End Date"
                value={editingContract.endDate || ''}
                onChange={v => update('endDate', v)}
                required
              />
              <DateField
                label="Actual End Date"
                value={editingContract.actualEndDate || ''}
                onChange={v => update('actualEndDate', v)}
              />
            </div>
          )}

          {/* --- Invoices Tab --- */}
          {activeTab === 'invoices' && (
            <div className="csp-subtable-wrap">
              {contractInvoices.length === 0 ? (
                <p className="csp-text-muted csp-p-4">No invoices for this contract.</p>
              ) : (
                <table className="csp-table csp-table-compact">
                  <thead>
                    <tr>
                      <th className="csp-th">Invoice#</th>
                      <th className="csp-th">Date</th>
                      <th className="csp-th">Due Date</th>
                      <th className="csp-th csp-th-right">Total</th>
                      <th className="csp-th">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractInvoices.map(inv => (
                      <tr key={inv.id} className="csp-tr">
                        <td className="csp-td">{inv.invoiceNumber}</td>
                        <td className="csp-td">{formatDate(inv.invoiceDate)}</td>
                        <td className="csp-td">{formatDate(inv.dueDate)}</td>
                        <td className="csp-td csp-td-right">{formatCurrency(inv.total, inv.currencyCode)}</td>
                        <td className="csp-td"><StatusBadge status={inv.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* --- Timesheets Tab --- */}
          {activeTab === 'timesheets' && (
            <div className="csp-subtable-wrap">
              {contractTimesheets.length === 0 ? (
                <p className="csp-text-muted csp-p-4">No timesheets for this contract.</p>
              ) : (
                <table className="csp-table csp-table-compact">
                  <thead>
                    <tr>
                      <th className="csp-th">Reference</th>
                      <th className="csp-th">Week Start</th>
                      <th className="csp-th csp-th-right">Total Hours</th>
                      <th className="csp-th">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractTimesheets.map(ts => (
                      <tr key={ts.id} className="csp-tr">
                        <td className="csp-td">{ts.reference}</td>
                        <td className="csp-td">{formatDate(ts.weekStart)}</td>
                        <td className="csp-td csp-td-right">{ts.totalHours}</td>
                        <td className="csp-td"><StatusBadge status={ts.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* --- Milestones Tab --- */}
          {activeTab === 'milestones' && editingContract.hasMilestones && (
            <div className="csp-subtable-wrap">
              <div className="csp-subtable-header">
                <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={openMilestoneDialog}>
                  <Plus className="csp-icon-inline" /> Add Milestone
                </button>
              </div>
              {localMilestones.length === 0 ? (
                <p className="csp-text-muted csp-p-4">No milestones yet.</p>
              ) : (
                <table className="csp-table csp-table-compact">
                  <thead>
                    <tr>
                      <th className="csp-th">ID</th>
                      <th className="csp-th">Description</th>
                      <th className="csp-th csp-th-right">Value</th>
                      <th className="csp-th">Start</th>
                      <th className="csp-th">End</th>
                      <th className="csp-th">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localMilestones.map(ms => (
                      <tr key={ms.id} className="csp-tr">
                        <td className="csp-td">{ms.milestoneId}</td>
                        <td className="csp-td">{ms.description}</td>
                        <td className="csp-td csp-td-right">{formatCurrency(ms.value, ms.currencyCode)}</td>
                        <td className="csp-td">{formatDate(ms.startDate)}</td>
                        <td className="csp-td">{formatDate(ms.endDate)}</td>
                        <td className="csp-td"><StatusBadge status={ms.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </Tabs>

        {/* Sheet Footer */}
        <div className="csp-sheet-footer">
          {!isNew && (
            <button className="csp-btn csp-btn-destructive" onClick={deleteContract}>Delete</button>
          )}
          <div className="csp-sheet-footer-right">
            <button className="csp-btn csp-btn-outline" onClick={closeSheet}>Cancel</button>
            <button className={`csp-btn csp-btn-primary ${isSaving ? 'csp-btn-saving' : ''}`} disabled={isSaving} onClick={saveContract}>
              {isSaving ? <><Spinner size="sm" /> Saving...</> : isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      </Sheet>

      {/* ===== Add Milestone Dialog ===== */}
      <Dialog open={milestoneDialogOpen} onClose={() => setMilestoneDialogOpen(false)} title="Add Milestone" maxWidth="480px">
        <div className="csp-form-grid">
          <TextField
            label="Milestone ID"
            value={milestoneForm.milestoneId}
            onChange={() => {}}
            readOnly
          />
          <TextField
            label="Description"
            value={milestoneForm.description}
            onChange={v => setMilestoneForm(prev => ({ ...prev, description: v }))}
            required
          />
          <TextField
            label="Value"
            value={milestoneForm.value}
            onChange={v => setMilestoneForm(prev => ({ ...prev, value: v }))}
            type="number"
          />
          <SelectField
            label="Currency"
            value={milestoneForm.currencyCode}
            onChange={v => setMilestoneForm(prev => ({ ...prev, currencyCode: v as CurrencyCode }))}
            options={CURRENCY_OPTIONS}
          />
          <DateField
            label="Start Date"
            value={milestoneForm.startDate}
            onChange={v => setMilestoneForm(prev => ({ ...prev, startDate: v }))}
          />
          <DateField
            label="End Date"
            value={milestoneForm.endDate}
            onChange={v => setMilestoneForm(prev => ({ ...prev, endDate: v }))}
          />
        </div>
        <div className="csp-dialog-footer">
          <button className="csp-btn csp-btn-outline" onClick={() => setMilestoneDialogOpen(false)}>Cancel</button>
          <button className="csp-btn csp-btn-primary" onClick={saveMilestone}>Add Milestone</button>
        </div>
      </Dialog>
    </div>
  );
}
