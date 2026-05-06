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
  matchDateRange,
} from '../components/ColumnFilters';
import { SearchPill, SinglePill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, type RelativeDateValue } from '../components/FilterPills';
import { Plus } from '../components/Icons';
import { Spinner, PageLoading } from '../components/Shared';
import { contractMilestones as mockMilestones, contracts as mockContracts, getContractById, getContractLookupLabel } from '../data/mock-data';
import { fetchMilestones, saveMilestone } from '../services/milestoneService';
import type { MilestoneRecord } from '../services/milestoneService';
import { fetchContracts } from '../services/contractService';
import { useDataverse } from '../services/useDataverse';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { ContractMilestone, MilestoneStatus, CurrencyCode } from '../types/crm';

const ALL_STATUSES: MilestoneStatus[] = ['Pending', 'Invoiced', 'Paid'];
const ALL_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'RON', 'GBP'];

interface FormState {
  id: string;
  milestoneId: string;
  contractId: string;
  description: string;
  value: string;
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
    value: m.value != null ? String(m.value) : '',
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
    value: '',
    currencyCode: 'EUR',
    startDate: '',
    endDate: '',
    status: 'Pending',
  };
}

const STATUS_BADGE_STYLE: Record<string, React.CSSProperties> = {
  Pending: { backgroundColor: 'hsl(45, 93%, 90%)', color: 'hsl(35, 80%, 30%)' },
  Invoiced: { backgroundColor: 'hsl(213, 30%, 91%)', color: 'hsl(213, 70%, 30%)' },
  Paid: { backgroundColor: 'hsl(142, 76%, 92%)', color: 'hsl(142, 71%, 25%)' },
};

function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 500,
      height: 22,
      ...STATUS_BADGE_STYLE[status],
    }}>{status}</span>
  );
}

function MilestoneFilterPills<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              background: active ? 'hsl(var(--muted) / 0.6)' : 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 10px',
              borderRadius: 6,
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
              <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

import { useConfirm } from '../components/ConfirmDialog';

export default function MilestonesPage() {
  const { toast } = useToast();
  const confirm = useConfirm();

  // --- Dataverse data ---
  const mockMapped: ContractMilestone[] = mockMilestones;
  const { data: dvMilestones, loading, refetch } = useDataverse(
    async () => {
      const recs = await fetchMilestones();
      return recs.map(r => ({
        id: r.id, milestoneId: r.milestoneId, contractId: r.contractId,
        description: r.description, value: r.value, currencyCode: (r.currencyCode || 'EUR') as CurrencyCode,
        startDate: r.startDate, endDate: r.endDate, status: (r.status || 'Pending') as MilestoneStatus,
      }));
    },
    mockMapped,
  );
  const { data: dvContracts } = useDataverse(fetchContracts, mockContracts);
  const [isSaving, setIsSaving] = useState(false);

  // --- Selection ---
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // --- Status filter ---
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDateFilter, setStartDateFilter] = useState<RelativeDateValue>({ type: 'all' });
  const [endDateFilter, setEndDateFilter] = useState<RelativeDateValue>({ type: 'all' });

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
    dvMilestones.forEach(m => { map[m.status] = (map[m.status] || 0) + 1; });
    return map;
  }, [dvMilestones]);

  // --- Contract lookup options ---
  const contractOptions = useMemo(() =>
    dvContracts.map(c => ({ value: c.id, label: getContractLookupLabel(c) })),
  [dvContracts]);

  // --- Filter logic ---
  const filtered = useMemo(() => {
    return dvMilestones.filter(m => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const c = getContractById(m.contractId);
        const ok = (m.milestoneId || '').toLowerCase().includes(q) ||
          (m.description || '').toLowerCase().includes(q) ||
          (c?.contractNumber.toLowerCase().includes(q));
        if (!ok) return false;
      }
      if (startDateFilter.type !== 'all') {
        const r = dateRangeFor(startDateFilter);
        if (!matchDateRange(m.startDate, r.from, r.to)) return false;
      }
      if (endDateFilter.type !== 'all') {
        const r = dateRangeFor(endDateFilter);
        if (!matchDateRange(m.endDate, r.from, r.to)) return false;
      }

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
  }, [dvMilestones, statusFilter, searchTerm, startDateFilter, endDateFilter, columnFilters]);

  const hasActiveFilters = !!searchTerm || statusFilter !== 'all' || startDateFilter.type !== 'all' || endDateFilter.type !== 'all';

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
  const generateMilestoneId = () => {
    const existingIds = dvMilestones
      .map(m => m.milestoneId || '')
      .filter(id => /^MS-\d+$/i.test(id))
      .map(id => parseInt(id.replace(/^MS-/i, ''), 10));
    const next = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    return `MS-${String(next).padStart(3, '0')}`;
  };
  const openNew = () => { setForm({ ...emptyForm(), milestoneId: generateMilestoneId() }); setSheetOpen(true); };
  const openEdit = (m: ContractMilestone) => { setForm(milestoneToForm(m)); setSheetOpen(true); };
  const closeForm = () => setSheetOpen(false);

  function formatMilestoneId(id: string): string {
    if (!id) return '—';
    if (/^MS-/i.test(id)) return id.toUpperCase();
    const num = parseInt(id, 10);
    if (!isNaN(num)) return `MS-${String(num).padStart(3, '0')}`;
    return id;
  }
  function shortContractName(name?: string): string {
    if (!name) return '—';
    return name.replace(/^CONTRACT-/i, 'CTR-').replace(/^CTR-0+/, 'CTR-') || '—';
  }

  // --- Save ---
  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveMilestone(form, isNew ? undefined : form.id);
      toast.success(isNew ? 'Milestone created successfully' : 'Milestone updated successfully');
      setSheetOpen(false);
      await refetch();
    } catch (err: any) {
      console.error('Milestone save failed:', err);
      toast.error(err?.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Form helpers ---
  const updateForm = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  if (loading && dvMilestones.length === 0) {
    return <PageLoading message="Loading milestones..." />;
  }

  return (
    <div>
      <HeaderSelectionBar count={selected.size} onClearSelection={() => setSelected(new Set())} entityLabel="milestones" onDelete={async () => {
        const ids = Array.from(selected);
        const ok = await confirm({ title: 'Delete milestone(s)', description: `Are you sure you want to delete ${ids.length} selected milestone(s)? This action cannot be undone.` });
        if (!ok) return;
        try {
          const { deleteRecord } = await import('../services/dataverseService');
          for (const id of ids) await deleteRecord('csp_contractmilestones', id);
          toast.success(`${ids.length} milestone(s) deleted`);
          setSelected(new Set());
          await refetch();
        } catch (err: any) { toast.error('Delete failed'); }
      }} />

      <PageHeader
        title="Contract Milestones"
        subtitle={`${filtered.length} of ${dvMilestones.length} milestones`}
        action={
          <button className="csp-btn csp-btn-primary" onClick={openNew}>
            <Plus className="csp-icon-inline" /> New Milestone
          </button>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search milestone, description, contract..." />
          <SinglePill label="Status" value={statusFilter === 'all' ? '' : statusFilter} onChange={v => setStatusFilter(v || 'all')}
            options={ALL_STATUSES.map(s => ({ value: s, label: s, count: statusCounts[s] || 0 }))} />
          <DatePill label="Start Date" value={startDateFilter} onChange={setStartDateFilter} dates={dvMilestones.map(m => m.startDate).filter(Boolean) as string[]} />
          <DatePill label="End Date" value={endDateFilter} onChange={setEndDateFilter} dates={dvMilestones.map(m => m.endDate).filter(Boolean) as string[]} />
          <div style={{ marginLeft: 'auto' }}>
            <ClearColumnFiltersButton filters={columnFilters} setFilters={setColumnFilters} />
          </div>
        </div>
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter !== 'all' && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('all')} />}
            {startDateFilter.type !== 'all' && <FilterChip label={`Start: ${relativeDateLabel(startDateFilter)}`} onRemove={() => setStartDateFilter({ type: 'all' })} />}
            {endDateFilter.type !== 'all' && <FilterChip label={`End: ${relativeDateLabel(endDateFilter)}`} onRemove={() => setEndDateFilter({ type: 'all' })} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setStartDateFilter({ type: 'all' }); setEndDateFilter({ type: 'all' }); }}>Clear all</button>
          </div>
        )}
      </div>

      {/* Table flush, no card border */}
      <div style={{ overflowX: 'auto' }}>
        <table className="csp-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 32, padding: '10px 8px' }}>
                <Checkbox checked={allSelected} onChange={toggleAll} />
              </th>
              <th style={{ padding: '10px 12px' }}>
                Milestone ID
                <TextFilterPopover label="Milestone ID" value={getTextFilter(columnFilters, 'milestoneId')} onChange={v => setTextFilter(setColumnFilters, 'milestoneId', v)} />
              </th>
              <th style={{ padding: '10px 12px' }}>
                Contract
                <TextFilterPopover label="Contract" value={getTextFilter(columnFilters, 'contract')} onChange={v => setTextFilter(setColumnFilters, 'contract', v)} />
              </th>
              <th style={{ padding: '10px 12px' }}>
                Description
                <TextFilterPopover label="Description" value={getTextFilter(columnFilters, 'description')} onChange={v => setTextFilter(setColumnFilters, 'description', v)} />
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>
                Value
                <NumberRangeFilterPopover label="Value" {...getNumberFilter(columnFilters, 'value')} onChange={(min, max) => setNumberFilter(setColumnFilters, 'value', min, max)} />
              </th>
              <th style={{ padding: '10px 12px' }}>Currency</th>
              <th style={{ padding: '10px 12px' }}>Start Date</th>
              <th style={{ padding: '10px 12px' }}>End Date</th>
              <th style={{ padding: '10px 12px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const contract = dvContracts.find(c => c.id === m.contractId) || getContractById(m.contractId);
              return (
                <tr key={m.id} className={cn('csp-tr csp-tr-clickable', selected.has(m.id) && 'csp-tr-selected')} onClick={() => openEdit(m)}>
                  <td style={{ width: 32, padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selected.has(m.id)} onChange={() => toggleOne(m.id)} />
                  </td>
                  <td className="csp-td-link" style={{ padding: '10px 12px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{formatMilestoneId(m.milestoneId)}</td>
                  <td style={{ padding: '10px 12px' }}>{shortContractName(contract?.name || contract?.contractNumber)}</td>
                  <td className="csp-text-truncate" style={{ padding: '10px 12px', maxWidth: 240 }}>{m.description}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(m.value, m.currencyCode)}</td>
                  <td style={{ padding: '10px 12px' }}>{m.currencyCode}</td>
                  <td style={{ padding: '10px 12px' }}>{formatDate(m.startDate)}</td>
                  <td style={{ padding: '10px 12px' }}>{formatDate(m.endDate)}</td>
                  <td style={{ padding: '10px 12px' }}><MilestoneStatusBadge status={m.status} /></td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="csp-text-center csp-text-muted" style={{ padding: '24px 12px' }}>No milestones found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sheet */}
      <Sheet open={sheetOpen} onClose={closeForm} title={isNew ? 'New Milestone' : `Edit ${form.milestoneId}`}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '0.5rem', marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))' }}>Status</span>
          <ToggleGroup value={form.status} onChange={v => updateForm({ status: v as MilestoneStatus })}>
            {ALL_STATUSES.map(s => (
              <ToggleGroupItem key={s} value={s}>{s}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <TextField label="Milestone ID" value={form.milestoneId} onChange={() => {}} required readOnly />
            <LookupField label="Contract" value={form.contractId} onChange={v => updateForm({ contractId: v })} required options={contractOptions} placeholder="Select contract" />
          </div>
          <TextField label="Milestone Description" value={form.description} onChange={v => updateForm({ description: v })} required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <TextField label="Milestone Value" value={form.value} onChange={v => updateForm({ value: v })} required type="number" placeholder="0.00" />
            <SelectField
              label="Milestone Currency"
              value={form.currencyCode}
              onChange={v => updateForm({ currencyCode: v as CurrencyCode })}
              required
              options={ALL_CURRENCIES.map(c => ({ value: c, label: c }))}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <DateField label="Start Date" value={form.startDate} onChange={v => updateForm({ startDate: v })} required />
            <DateField label="End Date" value={form.endDate} onChange={v => updateForm({ endDate: v })} required />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid hsl(var(--border))', paddingTop: 16, marginTop: 24 }}>
          <button className="csp-btn csp-btn-outline" onClick={closeForm}>Close</button>
          <button className={`csp-btn csp-btn-primary ${isSaving ? 'csp-btn-saving' : ''}`} disabled={isSaving} onClick={handleSave}>{isSaving ? <><Spinner size="sm" /> Saving...</> : 'Save'}</button>
        </div>
      </Sheet>
    </div>
  );
}
