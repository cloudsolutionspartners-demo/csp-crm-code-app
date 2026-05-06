import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
import { contractMilestones, contracts, getContractById, getContractLookupLabel } from '@/data/mock-data';
import type { ContractMilestone, MilestoneStatus, CurrencyCode } from '@/types/crm';
import { formatCurrency, formatDate } from '@/lib/format';
import { HeaderSelectionBar } from '@/components/HeaderSelectionBar';
import { TextField, SelectField, DateField, LookupField } from '@/components/FormField';
import { toast } from 'sonner';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getNumberFilter, setTextFilter, setMultiFilter, setNumberFilter, matchDateRange,
} from '@/components/ColumnFilters';
import { SearchPill, SinglePill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, type RelativeDateValue } from '@/components/FilterPills';

const milestoneStatuses: MilestoneStatus[] = ['Pending', 'Invoiced', 'Paid'];
const currencyOptions: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'RON'];

export default function ContractMilestonesPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [startDateFilter, setStartDateFilter] = useState<RelativeDateValue>({ type: 'all' });
  const [endDateFilter, setEndDateFilter] = useState<RelativeDateValue>({ type: 'all' });
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selected, setSelected] = useState<ContractMilestone | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const openForm = (milestone: ContractMilestone) => {
    setIsNew(false);
    setSelected(milestone);
    setFormData({
      milestoneId: milestone.milestoneId, contractId: milestone.contractId,
      description: milestone.description, value: milestone.value.toString(),
      currencyCode: milestone.currencyCode, startDate: milestone.startDate,
      endDate: milestone.endDate, status: milestone.status,
    });
  };

  const openNewForm = () => {
    setIsNew(true);
    setSelected({} as ContractMilestone);
    setFormData({
      milestoneId: `MS-${String(contractMilestones.length + 1).padStart(3, '0')}`,
      contractId: '', description: '', value: '', currencyCode: 'EUR',
      startDate: '', endDate: '', status: 'Pending',
    });
  };

  const closeForm = () => { setSelected(null); setIsNew(false); };
  const saveForm = () => { toast.success(isNew ? `Milestone "${formData.milestoneId}" created` : `Milestone "${formData.milestoneId}" saved`); closeForm(); };
  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  // Only contracts with hasMilestones
  const milestoneContracts = contracts.filter(c => c.hasMilestones);

  const filtered = useMemo(() => {
    return contractMilestones.filter(m => {
      if (statusFilter && m.status !== statusFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const c = getContractById(m.contractId);
        const ok = m.milestoneId.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
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
      const msId = getTextFilter(colFilters, 'milestoneId');
      if (msId && !m.milestoneId.toLowerCase().includes(msId.toLowerCase())) return false;
      const desc = getTextFilter(colFilters, 'description');
      if (desc && !m.description.toLowerCase().includes(desc.toLowerCase())) return false;
      const contract = getTextFilter(colFilters, 'contract');
      if (contract) { const c = getContractById(m.contractId); if (!c || !c.contractNumber.toLowerCase().includes(contract.toLowerCase())) return false; }
      const valRange = getNumberFilter(colFilters, 'value');
      if (valRange.min && m.value < Number(valRange.min)) return false;
      if (valRange.max && m.value > Number(valRange.max)) return false;
      return true;
    });
  }, [statusFilter, searchTerm, startDateFilter, endDateFilter, colFilters]);

  const filteredIds = filtered.map(m => m.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="milestones" />
      <PageHeader title="Contract Milestones" subtitle={`${filtered.length} of ${contractMilestones.length} milestones`}
        action={<div className="flex items-center gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <Button onClick={openNewForm}><Plus className="h-4 w-4 mr-2" />Add Milestone</Button>
        </div>} />

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search milestone, description, contract..." />
          <SinglePill label="Status" value={statusFilter} onChange={setStatusFilter}
            options={milestoneStatuses.map(s => ({ value: s, label: s, count: contractMilestones.filter(m => m.status === s).length }))} />
          <DatePill label="Start Date" value={startDateFilter} onChange={setStartDateFilter} dates={contractMilestones.map(m => m.startDate)} />
          <DatePill label="End Date" value={endDateFilter} onChange={setEndDateFilter} dates={contractMilestones.map(m => m.endDate)} />
        </div>
        {(searchTerm || statusFilter || startDateFilter.type !== 'all' || endDateFilter.type !== 'all') && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('')} />}
            {startDateFilter.type !== 'all' && <FilterChip label={`Start: ${relativeDateLabel(startDateFilter)}`} onRemove={() => setStartDateFilter({ type: 'all' })} />}
            {endDateFilter.type !== 'all' && <FilterChip label={`End: ${relativeDateLabel(endDateFilter)}`} onRemove={() => setEndDateFilter({ type: 'all' })} />}
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setSearchTerm(''); setStatusFilter(''); setStartDateFilter({ type: 'all' }); setEndDateFilter({ type: 'all' }); }}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
              <TableHead>Milestone ID <TextFilterPopover label="Milestone ID" value={getTextFilter(colFilters, 'milestoneId')} onChange={v => setTextFilter(setColFilters, 'milestoneId', v)} /></TableHead>
              <TableHead>Contract <TextFilterPopover label="Contract" value={getTextFilter(colFilters, 'contract')} onChange={v => setTextFilter(setColFilters, 'contract', v)} /></TableHead>
              <TableHead>Description <TextFilterPopover label="Description" value={getTextFilter(colFilters, 'description')} onChange={v => setTextFilter(setColFilters, 'description', v)} /></TableHead>
              <TableHead>Value <NumberRangeFilterPopover label="Value" min={getNumberFilter(colFilters, 'value').min} max={getNumberFilter(colFilters, 'value').max} onChange={(min, max) => setNumberFilter(setColFilters, 'value', min, max)} /></TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No milestones match the current filters.</TableCell></TableRow>
            ) : filtered.map(m => {
              const contract = getContractById(m.contractId);
              return (
                <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(m.id)} onCheckedChange={ch => toggleOne(m.id, !!ch)} /></TableCell>
                  <TableCell className="font-mono text-xs" onClick={() => openForm(m)}>{m.milestoneId}</TableCell>
                  <TableCell onClick={() => openForm(m)}>{contract?.contractNumber || '—'}</TableCell>
                  <TableCell className="max-w-[250px] truncate" onClick={() => openForm(m)}>{m.description}</TableCell>
                  <TableCell onClick={() => openForm(m)}>{formatCurrency(m.value, m.currencyCode)}</TableCell>
                  <TableCell onClick={() => openForm(m)}>{m.currencyCode}</TableCell>
                  <TableCell onClick={() => openForm(m)}>{formatDate(m.startDate)}</TableCell>
                  <TableCell onClick={() => openForm(m)}>{formatDate(m.endDate)}</TableCell>
                  <TableCell onClick={() => openForm(m)}><StatusBadge status={m.status} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selected} onOpenChange={closeForm}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader><SheetTitle>{isNew ? 'New Milestone' : formData.milestoneId}</SheetTitle></SheetHeader>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</span>
                <ToggleGroup type="single" value={formData.status} onValueChange={v => { if (v) updateField('status', v); }} className="border rounded-md p-0.5">
                  {milestoneStatuses.map(s => (<ToggleGroupItem key={s} value={s} className="text-xs px-3 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm">{s}</ToggleGroupItem>))}
                </ToggleGroup>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-4">
                <TextField label="Milestone ID" value={formData.milestoneId} onChange={v => updateField('milestoneId', v)} required readOnly />
                <LookupField label="Contract" value={formData.contractId} onChange={v => updateField('contractId', v)} required
                  options={milestoneContracts.map(c => ({ value: c.id, label: getContractLookupLabel(c) }))} />
                <TextField label="Milestone Description" value={formData.description} onChange={v => updateField('description', v)} required />
                <div className="grid grid-cols-2 gap-4">
                  <TextField label="Milestone Value" value={formData.value} onChange={v => updateField('value', v)} required type="number" />
                  <SelectField label="Milestone Currency" value={formData.currencyCode} onChange={v => updateField('currencyCode', v)} required
                    options={currencyOptions.map(c => ({ value: c, label: c }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <DateField label="Start Date" value={formData.startDate} onChange={v => updateField('startDate', v)} required />
                  <DateField label="End Date" value={formData.endDate} onChange={v => updateField('endDate', v)} required />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button variant="outline" onClick={closeForm}>Close</Button>
                <Button onClick={saveForm}>Save</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
