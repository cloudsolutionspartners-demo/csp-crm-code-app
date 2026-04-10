import * as React from 'react';
import { useState, useMemo } from 'react';
import { StatusBadge, PageHeader } from '../components/Shared';
import { Sheet, Dialog, Tabs, ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, SelectField, SwitchField, DateField, LookupField } from '../components/FormFields';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getNumberFilter,
  setTextFilter, setMultiFilter, setNumberFilter,
} from '../components/ColumnFilters';
import { Plus } from '../components/Icons';
import {
  contracts as mockContracts, entities, invoices, expenses, timesheets, accounts, contacts,
  contractMilestones, getMilestonesByContractId, getEntityById, getAccountById, getContactById,
} from '../data/mock-data';
import { fetchContracts, saveContract as saveContractToDataverse } from '../services/contractService';
import { useDataverse } from '../services/useDataverse';
import { cn, formatCurrency, formatDate, formatPercent } from '../lib/utils';
import type { Contract, ContractStatus, ContractType, BillingType, CurrencyCode, MilestoneStatus } from '../types/crm';

// ===== Constants =====
const CONTRACT_STATUSES: ContractStatus[] = ['Draft', 'Active', 'On Hold', 'Completed', 'Terminated'];
const CONTRACT_TYPES: ContractType[] = ['Standard Contracting', 'Permanent Employee', 'Fixed Price'];
const BILLING_TYPES: BillingType[] = ['Time & Material', 'Fixed Price', 'Monthly Salary', 'Standard Contracting'];
const CURRENCY_OPTIONS: { value: string; label: string }[] = [
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'GBP', label: 'GBP' },
  { value: 'RON', label: 'RON' },
];
const MILESTONE_STATUSES: MilestoneStatus[] = ['Pending', 'Invoiced', 'Paid'];

function getCountryFromEntity(entityId: string): string {
  return getEntityById(entityId)?.country || '—';
}

function getAccountName(accountId: string): string {
  return getAccountById(accountId)?.name || '—';
}

function getContactName(contactId: string): string {
  const c = getContactById(contactId);
  return c ? `${c.firstName} ${c.lastName}` : '—';
}

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
export default function ContractsPage() {
  const { toast } = useToast();

  // Data — Dataverse with mock fallback
  const { data: dvContracts, loading, refetch, isLive } = useDataverse(fetchContracts, mockContracts);
  const [contractsList, setContractsList] = useState<Contract[]>(mockContracts);
  React.useEffect(() => { setContractsList(dvContracts); }, [dvContracts]);

  // Filter bar state
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [billingFilter, setBillingFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');

  // Column filters
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract>(emptyContract());
  const [isNew, setIsNew] = useState(false);
  const [activeTab, setActiveTab] = useState('parties');

  // Milestone dialog
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({
    milestoneId: '',
    description: '',
    value: 0,
    currencyCode: 'EUR' as CurrencyCode,
    startDate: '',
    endDate: '',
  });
  const [localMilestones, setLocalMilestones] = useState<typeof contractMilestones>([]);

  // ===== Derived data =====
  const allCountries = useMemo(() => {
    const set = new Set(contractsList.map(c => getCountryFromEntity(c.entityId)));
    return Array.from(set).sort();
  }, [contractsList]);

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
    if (countryFilter !== 'all') list = list.filter(c => getCountryFromEntity(c.entityId) === countryFilter);

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
  }, [contractsList, statusFilter, typeFilter, billingFilter, countryFilter, columnFilters]);

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
    const nextNum = contractsList.length + 1;
    const newContract = {
      ...emptyContract(),
      id: `ctr-new-${Date.now()}`,
      contractNumber: `CTR-2026-${String(nextNum).padStart(3, '0')}`,
    };
    setEditingContract(newContract);
    setLocalMilestones([]);
    setIsNew(true);
    setActiveTab('parties');
    setSheetOpen(true);
  }

  function openEdit(contract: Contract) {
    setEditingContract({ ...contract });
    setLocalMilestones(getMilestonesByContractId(contract.id));
    setIsNew(false);
    setActiveTab('parties');
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
  }

  // ===== Save =====
  async function saveContract() {
    try {
      await saveContractToDataverse(editingContract as any, isNew ? undefined : editingContract.id);
      toast.success(isNew ? 'Contract created successfully' : 'Contract updated successfully');
      closeSheet();
      refetch();
    } catch (err) {
      console.error('Save failed:', err);
      // Fallback: update local state
      if (isNew) {
        setContractsList(prev => [...prev, editingContract]);
        toast.success('Contract created (local only)');
      } else {
        setContractsList(prev => prev.map(c => c.id === editingContract.id ? editingContract : c));
        toast.success('Contract updated (local only)');
      }
      closeSheet();
    }
  }

  // ===== Delete =====
  function deleteContract() {
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
      value: 0,
      currencyCode: editingContract.sellCurrency,
      startDate: '',
      endDate: '',
    });
    setMilestoneDialogOpen(true);
  }

  function saveMilestone() {
    const newMilestone = {
      id: `ms-new-${Date.now()}`,
      milestoneId: milestoneForm.milestoneId,
      contractId: editingContract.id,
      description: milestoneForm.description,
      value: milestoneForm.value,
      currencyCode: milestoneForm.currencyCode,
      startDate: milestoneForm.startDate,
      endDate: milestoneForm.endDate,
      status: 'Pending' as MilestoneStatus,
    };
    setLocalMilestones(prev => [...prev, newMilestone]);
    setMilestoneDialogOpen(false);
    toast.success('Milestone added');
  }

  // ===== Related data for sheet tabs =====
  const contractInvoices = useMemo(() => invoices.filter(i => i.contractId === editingContract.id), [editingContract.id]);
  const contractTimesheets = useMemo(() => timesheets.filter(t => t.contractId === editingContract.id), [editingContract.id]);

  // ===== Lookup options =====
  const accountOptions = useMemo(() => accounts.map(a => ({ value: a.id, label: a.name })), []);
  const accountOptionsWithNone = useMemo(() => [{ value: '', label: 'None' }, ...accountOptions], [accountOptions]);
  const consultantOptions = useMemo(() =>
    contacts.filter(c => c.contactType === 'Consultant').map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })),
  []);

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
    setEditingContract(prev => ({ ...prev, [field]: value }));
  }

  // ===== Render =====
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
      />

      {/* ===== Filter Bars ===== */}
      <div className="csp-filter-bars">
        {/* Status */}
        <div className="csp-filter-bar">
          <span className="csp-filter-bar-label">Status</span>
          <ToggleGroup value={statusFilter} onChange={setStatusFilter}>
            <ToggleGroupItem value="all">All ({contractsList.length})</ToggleGroupItem>
            {CONTRACT_STATUSES.map(s => (
              <ToggleGroupItem key={s} value={s}>{s} ({statusCounts[s] || 0})</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Contract Type */}
        <div className="csp-filter-bar">
          <span className="csp-filter-bar-label">Contract Type</span>
          <ToggleGroup value={typeFilter} onChange={setTypeFilter}>
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            {CONTRACT_TYPES.map(t => (
              <ToggleGroupItem key={t} value={t}>{t} ({typeCounts[t] || 0})</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Billing Type */}
        <div className="csp-filter-bar">
          <span className="csp-filter-bar-label">Billing Type</span>
          <ToggleGroup value={billingFilter} onChange={setBillingFilter}>
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            {BILLING_TYPES.map(b => (
              <ToggleGroupItem key={b} value={b}>{b} ({billingCounts[b] || 0})</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Country */}
        <div className="csp-filter-bar">
          <span className="csp-filter-bar-label">Country</span>
          <ToggleGroup value={countryFilter} onChange={setCountryFilter}>
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            {allCountries.map(co => (
              <ToggleGroupItem key={co} value={co}>{co} ({countryCounts[co] || 0})</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {/* Column filter clear */}
      <div className="csp-table-toolbar">
        <ClearColumnFiltersButton filters={columnFilters} setFilters={setColumnFilters} />
      </div>

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
                className={cn('csp-tr', selectedIds.has(contract.id) && 'csp-tr-selected')}
                onClick={() => openEdit(contract)}
              >
                <td className="csp-td csp-td-check" onClick={e => e.stopPropagation()}>
                  <Checkbox checked={selectedIds.has(contract.id)} onChange={() => toggleSelect(contract.id)} />
                </td>
                <td className="csp-td csp-td-primary">{contract.contractNumber}</td>
                <td className="csp-td">{contract.contractType}</td>
                <td className="csp-td">{contract.billingType}</td>
                <td className="csp-td">{getCountryFromEntity(contract.entityId)}</td>
                <td className="csp-td">{getAccountName(contract.parentAccountId)}</td>
                <td className="csp-td">{getContactName(contract.contactId)}</td>
                <td className="csp-td csp-td-right">{formatCurrency(contract.sellRate, contract.sellCurrency)}</td>
                <td className="csp-td csp-td-right">{formatCurrency(contract.buyRate, contract.buyCurrency)}</td>
                <td className="csp-td csp-td-right">{formatPercent(contract.marginPercent)}</td>
                <td className="csp-td"><StatusBadge status={contract.status} /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="csp-td csp-td-empty">No contracts found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== Sheet ===== */}
      <Sheet open={sheetOpen} onClose={closeSheet} title={isNew ? 'New Contract' : `Edit ${editingContract.contractNumber}`} width="720px">
        <Tabs tabs={sheetTabs} activeTab={activeTab} onChange={setActiveTab}>

          {/* --- Parties Tab --- */}
          {activeTab === 'parties' && (
            <div className="csp-form-grid">
              <TextField
                label="Contract Number"
                value={editingContract.contractNumber}
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
                onChange={v => update('parentAccountId', v)}
                options={accountOptions}
                placeholder="Select account"
                required
              />
              <LookupField
                label="Child Account"
                value={editingContract.childAccountId || ''}
                onChange={v => update('childAccountId', v)}
                options={accountOptionsWithNone}
                placeholder="None"
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
                onChange={v => update('margin', Number(v) || 0)}
                type="number"
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
            <button className="csp-btn csp-btn-primary" onClick={saveContract}>
              {isNew ? 'Create' : 'Save'}
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
            value={String(milestoneForm.value)}
            onChange={v => setMilestoneForm(prev => ({ ...prev, value: Number(v) || 0 }))}
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
