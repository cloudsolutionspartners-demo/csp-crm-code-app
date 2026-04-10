import * as React from 'react';
import { useState, useMemo } from 'react';
import { StatusBadge, PageHeader } from '../components/Shared';
import { Sheet, ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, SelectField, DateField, LookupField } from '../components/FormFields';
import {
  TextFilterPopover, NumberRangeFilterPopover, MultiSelectFilterPopover,
  ClearColumnFiltersButton,
  ColumnFilters as ColumnFiltersType,
  getTextFilter, getMultiFilter, getNumberFilter,
  setTextFilter, setMultiFilter, setNumberFilter,
} from '../components/ColumnFilters';
import { Plus } from '../components/Icons';
import { contractMilestones, contracts, getContractById, getContractLookupLabel } from '../data/mock-data';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { ContractMilestone, MilestoneStatus, CurrencyCode } from '../types/crm';

const ALL_STATUSES: MilestoneStatus[] = ['Pending', 'Invoiced', 'Paid'];
const ALL_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'RON', 'GBP'];

interface FormState {
  id: string;
  milestoneId: string;
  contractId: string;
  description: string;
  value: number;
  currencyCode: CurrencyCode;
  startDate: string;
  endDate: string;
  status: MilestoneStatus;
}

function milestoneToForm(m: ContractMilestone): FormState {
  return {
    id: m.id,
    milestoneId: m.milestoneId,
    contractId: m.contractId,
    description: m.description,
    value: m.value,
    currencyCode: m.currencyCode,
    startDate: m.startDate,
    endDate: m.endDate,
    status: m.status,
  };
}

function emptyForm(): FormState {
  return {
    id: '',
    milestoneId: '',
    contractId: '',
    description: '',
    value: 0,
    currencyCode: 'EUR',
    startDate: '',
    endDate: '',
    status: 'Pending',
  };
}

export default function MilestonesPage() {
  const { toast } = useToast();

  // --- Selection ---
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // --- Status filter ---
  const [statusFilter, setStatusFilter] = useState('all');

  // --- Column filters ---
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersType>({});

  // --- Sheet ---
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const isNew = !form.id;

  // --- Status counts ---
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    ALL_STATUSES.forEach(s => { map[s] = 0; });
    contractMilestones.forEach(m => { map[m.status] = (map[m.status] || 0) + 1; });
    return map;
  }, []);

  // --- Contract lookup options (only contracts with hasMilestones) ---
  const contractOptions = useMemo(() =>
    contracts.filter(c => c.hasMilestones).map(c => ({ value: c.id, label: getContractLookupLabel(c) })),
  []);

  // --- Filter logic ---
  const filtered = useMemo(() => {
    return contractMilestones.filter(m => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;

      const milestoneIdText = getTextFilter(columnFilters, 'milestoneId');
      if (milestoneIdText && !m.milestoneId.toLowerCase().includes(milestoneIdText.toLowerCase())) return false;

      const contractText = getTextFilter(columnFilters, 'contract');
      if (contractText) {
        const c = getContractById(m.contractId);
        const label = c ? c.contractNumber : '';
        if (!label.toLowerCase().includes(contractText.toLowerCase())) return false;
      }

      const descText = getTextFilter(columnFilters, 'description');
      if (descText && !m.description.toLowerCase().includes(descText.toLowerCase())) return false;

      const valueRange = getNumberFilter(columnFilters, 'value');
      if (valueRange.min && m.value < Number(valueRange.min)) return false;
      if (valueRange.max && m.value > Number(valueRange.max)) return false;

      const currencySelected = getMultiFilter(columnFilters, 'currency');
      if (currencySelected.length > 0 && !currencySelected.includes(m.currencyCode)) return false;

      return true;
    });
  }, [statusFilter, columnFilters]);

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
  const openEdit = (m: ContractMilestone) => { setForm(milestoneToForm(m)); setSheetOpen(true); };

  // --- Save ---
  const handleSave = () => {
    toast.success(isNew ? 'Milestone created successfully' : 'Milestone updated successfully');
    setSheetOpen(false);
  };

  // --- Form helpers ---
  const updateForm = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  return (
    <div>
      <HeaderSelectionBar count={selected.size} onClearSelection={() => setSelected(new Set())} entityLabel="milestones" />

      <PageHeader
        title="Milestones"
        subtitle="Manage contract milestones"
        action={
          <button className="csp-btn csp-btn-primary" onClick={openNew}>
            <Plus className="csp-icon-inline" /> New Milestone
          </button>
        }
      />

      {/* Status toggle */}
      <div className="csp-filter-bar">
        <ToggleGroup value={statusFilter} onChange={setStatusFilter}>
          <ToggleGroupItem value="all">All ({contractMilestones.length})</ToggleGroupItem>
          {ALL_STATUSES.map(s => (
            <ToggleGroupItem key={s} value={s}>{s} ({statusCounts[s] || 0})</ToggleGroupItem>
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
                Milestone ID
                <TextFilterPopover label="Milestone ID" value={getTextFilter(columnFilters, 'milestoneId')} onChange={v => setTextFilter(setColumnFilters, 'milestoneId', v)} />
              </th>
              <th className="csp-th">
                Contract
                <TextFilterPopover label="Contract" value={getTextFilter(columnFilters, 'contract')} onChange={v => setTextFilter(setColumnFilters, 'contract', v)} />
              </th>
              <th className="csp-th">
                Description
                <TextFilterPopover label="Description" value={getTextFilter(columnFilters, 'description')} onChange={v => setTextFilter(setColumnFilters, 'description', v)} />
              </th>
              <th className="csp-th csp-text-right">
                Value
                <NumberRangeFilterPopover label="Value" {...getNumberFilter(columnFilters, 'value')} onChange={(min, max) => setNumberFilter(setColumnFilters, 'value', min, max)} />
              </th>
              <th className="csp-th">
                Currency
                <MultiSelectFilterPopover label="Currency" options={ALL_CURRENCIES} selected={getMultiFilter(columnFilters, 'currency')} onChange={v => setMultiFilter(setColumnFilters, 'currency', v)} />
              </th>
              <th className="csp-th">Start Date</th>
              <th className="csp-th">End Date</th>
              <th className="csp-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const contract = getContractById(m.contractId);
              return (
                <tr key={m.id} className={cn('csp-tr', selected.has(m.id) && 'csp-tr-selected')} onDoubleClick={() => openEdit(m)}>
                  <td className="csp-td csp-td-check">
                    <Checkbox checked={selected.has(m.id)} onChange={() => toggleOne(m.id)} />
                  </td>
                  <td className="csp-td csp-td-link" onClick={() => openEdit(m)}>{m.milestoneId}</td>
                  <td className="csp-td">{contract?.contractNumber || '\u2014'}</td>
                  <td className="csp-td csp-text-truncate" style={{ maxWidth: 240 }}>{m.description}</td>
                  <td className="csp-td csp-text-right">{formatCurrency(m.value, m.currencyCode)}</td>
                  <td className="csp-td">{m.currencyCode}</td>
                  <td className="csp-td">{formatDate(m.startDate)}</td>
                  <td className="csp-td">{formatDate(m.endDate)}</td>
                  <td className="csp-td"><StatusBadge status={m.status} /></td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="csp-td csp-text-center csp-text-muted">No milestones found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sheet */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={isNew ? 'New Milestone' : `Edit ${form.milestoneId}`}>
        <div className="csp-form-grid">
          <TextField label="Milestone ID" value={form.milestoneId} onChange={v => updateForm({ milestoneId: v })} readOnly={!isNew} />
          <LookupField label="Contract" value={form.contractId} onChange={v => updateForm({ contractId: v })} options={contractOptions} placeholder="Select contract" />
          <TextField label="Description" value={form.description} onChange={v => updateForm({ description: v })} />
          <div className="csp-form-grid-2">
            <TextField label="Value" value={String(form.value)} onChange={v => updateForm({ value: Number(v) || 0 })} type="number" />
            <SelectField
              label="Currency"
              value={form.currencyCode}
              onChange={v => updateForm({ currencyCode: v as CurrencyCode })}
              options={ALL_CURRENCIES.map(c => ({ value: c, label: c }))}
            />
          </div>
          <div className="csp-form-grid-2">
            <DateField label="Start Date" value={form.startDate} onChange={v => updateForm({ startDate: v })} />
            <DateField label="End Date" value={form.endDate} onChange={v => updateForm({ endDate: v })} />
          </div>
          <SelectField
            label="Status"
            value={form.status}
            onChange={v => updateForm({ status: v as MilestoneStatus })}
            options={ALL_STATUSES.map(s => ({ value: s, label: s }))}
          />
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
