import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
import { contracts, entities, invoices, expenses, timesheets, accounts, contacts, contractMilestones, getMilestonesByContractId, getEntityById, getAccountById, getContactById } from '@/data/mock-data';
import type { Contract, ContractStatus, ContractType, BillingType, UnitOfMeasure, CurrencyCode, MilestoneStatus } from '@/types/crm';
import { formatCurrency, formatPercent, formatDate } from '@/lib/format';
import { HeaderSelectionBar } from '@/components/HeaderSelectionBar';
import { TextField, SelectField, SwitchField, DateField, LookupField } from '@/components/FormField';
import { toast } from 'sonner';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getNumberFilter, setTextFilter, setMultiFilter, setNumberFilter, matchDateRange,
} from '@/components/ColumnFilters';
import { SearchPill, SinglePill, DatePill, FilterChip, dateRangeFor, relativeDateLabel, ALL_DATES, type RelativeDateValue } from '@/components/FilterPills';

const contractStatuses: ContractStatus[] = ['Draft', 'Active', 'On Hold', 'Completed', 'Terminated'];
const contractTypes: ContractType[] = ['Standard Contracting', 'Permanent Employee', 'Fixed Price'];
const billingTypes: BillingType[] = ['Time & Material', 'Fixed Price', 'Monthly Salary', 'Standard Contracting'];
const uomOptions: UnitOfMeasure[] = ['Day', 'Hour', 'Month', 'Fixed'];
const currencyOptions: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'RON'];
const milestoneStatuses: MilestoneStatus[] = ['Pending', 'Invoiced', 'Paid'];
const paymentTermsOptions = ['15 Days', '30 Days', '45 Days', '60 Days'];
const countryOptions = entities.map(e => ({ id: e.id, label: e.country }));

export default function ContractsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [contractTypeFilter, setContractTypeFilter] = useState<string>('');
  const [billingTypeFilter, setBillingTypeFilter] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [startDateRel, setStartDateRel] = useState<RelativeDateValue>(ALL_DATES);
  const [endDateRel, setEndDateRel] = useState<RelativeDateValue>(ALL_DATES);
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selected, setSelected] = useState<Contract | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const openForm = (contract: Contract) => {
    setIsNew(false);
    setSelected(contract);
    setFormData({
      contractNumber: contract.contractNumber, name: contract.name,
      contractType: contract.contractType, billingType: contract.billingType,
      entityId: contract.entityId, parentAccountId: contract.parentAccountId,
      childAccountId: contract.childAccountId || '', contactId: contract.contactId,
      sellRate: contract.sellRate.toString(), sellHourlyRate: contract.sellHourlyRate?.toString() || '',
      sellCurrency: contract.sellCurrency,
      buyRate: contract.buyRate.toString(), buyHourlyRate: contract.buyHourlyRate?.toString() || '',
      buyCurrency: contract.buyCurrency,
      unitOfMeasure: contract.unitOfMeasure, payTerms: contract.payTerms,
      margin: contract.margin.toString(), grossValue: contract.grossValue?.toString() || '',
      monthlySalary: contract.monthlySalary?.toString() || '',
      monthlySalaryCurrency: contract.monthlySalaryCurrency || 'EUR',
      startDate: contract.startDate, endDate: contract.endDate || '',
      actualEndDate: contract.actualEndDate || '', noticePeriod: contract.noticePeriod || '',
      hasTimesheet: contract.hasTimesheet, hasMilestones: contract.hasMilestones,
      status: contract.status,
    });
  };

  const openNewForm = () => {
    setIsNew(true);
    setSelected({} as Contract);
    setFormData({
      contractNumber: `CON-${String(contracts.length + 1).padStart(3, '0')}`, name: '',
      contractType: 'Standard Contracting', billingType: 'Time & Material', entityId: entities[0]?.id || '',
      parentAccountId: '', childAccountId: '', contactId: '',
      sellRate: '', sellHourlyRate: '', sellCurrency: 'EUR',
      buyRate: '', buyHourlyRate: '', buyCurrency: 'EUR',
      unitOfMeasure: 'Day', payTerms: '30 Days',
      margin: '', grossValue: '', monthlySalary: '', monthlySalaryCurrency: 'EUR',
      startDate: '', endDate: '',
      actualEndDate: '', noticePeriod: '',
      hasTimesheet: true, hasMilestones: false, status: 'Draft',
    });
  };

  const closeForm = () => { setSelected(null); setIsNew(false); };

  // Auto-open contract from URL param
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId) {
      const contract = contracts.find(c => c.id === openId);
      if (contract) openForm(contract);
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const saveForm = () => { toast.success(isNew ? `Contract "${formData.name}" created` : `Contract "${formData.contractNumber}" saved`); closeForm(); };
  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const filtered = useMemo(() => {
    const sR = dateRangeFor(startDateRel);
    const eR = dateRangeFor(endDateRel);
    return contracts.filter(c => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (contractTypeFilter && c.contractType !== contractTypeFilter) return false;
      if (billingTypeFilter && c.billingType !== billingTypeFilter) return false;
      if (countryFilter && c.entityId !== countryFilter) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const con = getContactById(c.contactId);
        const acc = getAccountById(c.parentAccountId);
        if (!c.contractNumber.toLowerCase().includes(s) &&
            !(c.name?.toLowerCase().includes(s)) &&
            !(con && `${con.firstName} ${con.lastName}`.toLowerCase().includes(s)) &&
            !(acc && acc.name.toLowerCase().includes(s))) return false;
      }
      if (!matchDateRange(c.startDate, sR.from, sR.to)) return false;
      if (c.endDate && !matchDateRange(c.endDate, eR.from, eR.to)) return false;
      const billingCol = getMultiFilter(colFilters, 'billingType');
      if (billingCol.length > 0 && !billingCol.includes(c.billingType)) return false;
      const num = getTextFilter(colFilters, 'contractNumber');
      if (num && !c.contractNumber.toLowerCase().includes(num.toLowerCase())) return false;
      const account = getTextFilter(colFilters, 'account');
      if (account) { const acc = getAccountById(c.parentAccountId); if (!acc || !acc.name.toLowerCase().includes(account.toLowerCase())) return false; }
      const contractor = getTextFilter(colFilters, 'contractor');
      if (contractor) { const con = getContactById(c.contactId); if (!con || !`${con.firstName} ${con.lastName}`.toLowerCase().includes(contractor.toLowerCase())) return false; }
      const marginNum = getNumberFilter(colFilters, 'margin');
      if (marginNum.min && c.marginPercent < Number(marginNum.min)) return false;
      if (marginNum.max && c.marginPercent > Number(marginNum.max)) return false;
      return true;
    });
  }, [statusFilter, contractTypeFilter, billingTypeFilter, countryFilter, searchTerm, startDateRel, endDateRel, colFilters]);

  const filteredIds = filtered.map(c => c.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const relInvoices = selected ? invoices.filter(i => i.contractId === selected.id) : [];
  const relTimesheets = selected ? timesheets.filter(t => t.contractId === selected.id) : [];
  const relMilestones = selected ? getMilestonesByContractId(selected.id) : [];

  const [msDialogOpen, setMsDialogOpen] = useState(false);
  const [msForm, setMsForm] = useState<Record<string, any>>({});
  const openMsDialog = () => {
    setMsForm({
      milestoneId: `MS-${String(contractMilestones.length + relMilestones.length + 1).padStart(3, '0')}`,
      description: '', value: '', currencyCode: 'EUR', startDate: '', endDate: '',
    });
    setMsDialogOpen(true);
  };
  const saveMilestone = () => { toast.success(`Milestone "${msForm.milestoneId}" added`); setMsDialogOpen(false); };

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="contracts" />
      <PageHeader title="Contracts" subtitle={`${filtered.length} of ${contracts.length} contracts`}
        action={<div className="flex items-center gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <Button onClick={openNewForm}><Plus className="h-4 w-4 mr-2" />Add Contract</Button>
        </div>} />

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search contracts..." />
          <SinglePill label="Status" value={statusFilter} onChange={setStatusFilter}
            options={contractStatuses.map(s => ({ value: s, label: s, count: contracts.filter(c => c.status === s).length }))} />
          <SinglePill label="Contract Type" value={contractTypeFilter} onChange={setContractTypeFilter}
            options={contractTypes.map(t => ({ value: t, label: t, count: contracts.filter(c => c.contractType === t).length }))} />
          <SinglePill label="Billing Type" value={billingTypeFilter} onChange={setBillingTypeFilter}
            options={billingTypes.map(b => ({ value: b, label: b, count: contracts.filter(c => c.billingType === b).length }))} />
          <SinglePill label="Country" value={countryFilter} onChange={setCountryFilter}
            options={countryOptions.map(e => ({ value: e.id, label: e.label, count: contracts.filter(c => c.entityId === e.id).length }))} />
          <DatePill label="Start Date" value={startDateRel} onChange={setStartDateRel} dates={contracts.map(c => c.startDate)} />
          <DatePill label="End Date" value={endDateRel} onChange={setEndDateRel} dates={contracts.map(c => c.endDate)} />
        </div>
        {(searchTerm || statusFilter || contractTypeFilter || billingTypeFilter || countryFilter || startDateRel.type !== 'all' || endDateRel.type !== 'all') && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-muted-foreground">{filtered.length} of {contracts.length} contracts</span>
            <span className="text-muted-foreground">·</span>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('')} />}
            {contractTypeFilter && <FilterChip label={`Contract: ${contractTypeFilter}`} onRemove={() => setContractTypeFilter('')} />}
            {billingTypeFilter && <FilterChip label={`Billing: ${billingTypeFilter}`} onRemove={() => setBillingTypeFilter('')} />}
            {countryFilter && <FilterChip label={`Country: ${countryOptions.find(c => c.id === countryFilter)?.label}`} onRemove={() => setCountryFilter('')} />}
            {startDateRel.type !== 'all' && <FilterChip label={`Start: ${relativeDateLabel(startDateRel)}`} onRemove={() => setStartDateRel(ALL_DATES)} />}
            {endDateRel.type !== 'all' && <FilterChip label={`End: ${relativeDateLabel(endDateRel)}`} onRemove={() => setEndDateRel(ALL_DATES)} />}
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setSearchTerm(''); setStatusFilter(''); setContractTypeFilter(''); setBillingTypeFilter(''); setCountryFilter(''); setStartDateRel(ALL_DATES); setEndDateRel(ALL_DATES); }}>
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
              <TableHead>Contract # <TextFilterPopover label="Contract #" value={getTextFilter(colFilters, 'contractNumber')} onChange={v => setTextFilter(setColFilters, 'contractNumber', v)} /></TableHead>
              <TableHead>Contract Type <MultiSelectFilterPopover label="Contract Type" options={contractTypes} selected={getMultiFilter(colFilters, 'type')} onChange={v => setMultiFilter(setColFilters, 'type', v)} /></TableHead>
              <TableHead>Billing Type <MultiSelectFilterPopover label="Billing Type" options={billingTypes} selected={getMultiFilter(colFilters, 'billingType')} onChange={v => setMultiFilter(setColFilters, 'billingType', v)} /></TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Account <TextFilterPopover label="Account" value={getTextFilter(colFilters, 'account')} onChange={v => setTextFilter(setColFilters, 'account', v)} /></TableHead>
              <TableHead>Contractor <TextFilterPopover label="Contractor" value={getTextFilter(colFilters, 'contractor')} onChange={v => setTextFilter(setColFilters, 'contractor', v)} /></TableHead>
              <TableHead>Sell Rate</TableHead>
              <TableHead>Buy Rate</TableHead>
              <TableHead>Margin % <NumberRangeFilterPopover label="Margin %" min={getNumberFilter(colFilters, 'margin').min} max={getNumberFilter(colFilters, 'margin').max} onChange={(min, max) => setNumberFilter(setColFilters, 'margin', min, max)} /></TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No contracts match the current filters.</TableCell></TableRow>
            ) : filtered.map(c => {
              const contact = getContactById(c.contactId);
              return (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(c.id)} onCheckedChange={ch => toggleOne(c.id, !!ch)} /></TableCell>
                  <TableCell className="font-mono text-xs" onClick={() => openForm(c)}>{c.contractNumber}</TableCell>
                  <TableCell onClick={() => openForm(c)}>{c.contractType}</TableCell>
                  <TableCell onClick={() => openForm(c)}>{c.billingType}</TableCell>
                  <TableCell onClick={() => openForm(c)}>{getEntityById(c.entityId)?.country}</TableCell>
                  <TableCell onClick={() => openForm(c)}>{getAccountById(c.parentAccountId)?.name}</TableCell>
                  <TableCell onClick={() => openForm(c)}>{contact ? `${contact.firstName} ${contact.lastName}` : '—'}</TableCell>
                  <TableCell onClick={() => openForm(c)}>{formatCurrency(c.sellRate, c.sellCurrency)}</TableCell>
                  <TableCell onClick={() => openForm(c)}>{formatCurrency(c.buyRate, c.buyCurrency)}</TableCell>
                  <TableCell className="font-medium" onClick={() => openForm(c)}>{formatPercent(c.marginPercent)}</TableCell>
                  <TableCell onClick={() => openForm(c)}><StatusBadge status={c.status} /></TableCell>
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
              <SheetHeader><SheetTitle className="flex items-center gap-3">{isNew ? 'New Contract' : formData.contractNumber} {!isNew && <StatusBadge status={formData.status} />}</SheetTitle></SheetHeader>
              <Tabs defaultValue="parties" className="mt-6">
                <TabsList>
                  <TabsTrigger value="parties">Parties</TabsTrigger>
                  <TabsTrigger value="commercials">Commercials</TabsTrigger>
                  <TabsTrigger value="dates">Dates</TabsTrigger>
                  <TabsTrigger value="invoices">Invoices ({relInvoices.length})</TabsTrigger>
                  <TabsTrigger value="timesheets">Timesheets ({relTimesheets.length})</TabsTrigger>
                  {formData.hasMilestones && <TabsTrigger value="milestones">Milestones ({relMilestones.length})</TabsTrigger>}
                </TabsList>
                <TabsContent value="parties" className="mt-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">Contract Parties</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <TextField label="Contract Number" value={formData.contractNumber} onChange={v => updateField('contractNumber', v)} readOnly />
                    <SelectField label="Contract Type" value={formData.contractType} onChange={v => updateField('contractType', v)} required
                      options={contractTypes.map(t => ({ value: t, label: t }))} />
                    <LookupField label="Parent Account" value={formData.parentAccountId} onChange={v => updateField('parentAccountId', v)} required
                      options={accounts.map(a => ({ value: a.id, label: a.name }))} />
                    <LookupField label="Child Account" value={formData.childAccountId || '__none__'} onChange={v => updateField('childAccountId', v === '__none__' ? '' : v)}
                      options={[{ value: '__none__', label: 'None' }, ...accounts.map(a => ({ value: a.id, label: a.name }))]} />
                    <LookupField label="Assigned To" value={formData.contactId} onChange={v => updateField('contactId', v)} required
                      options={contacts.filter(c => c.contactType === 'Consultant').map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))} />
                    <SelectField label="Billing Type" value={formData.billingType} onChange={v => updateField('billingType', v)} required
                      options={billingTypes.map(b => ({ value: b, label: b }))} />
                  </div>
                </TabsContent>
                <TabsContent value="commercials" className="mt-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">Rates</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <TextField label="Sell Day Rate" value={formData.sellRate} onChange={v => updateField('sellRate', v)} required type="number" />
                    <TextField label="Buy Day Rate" value={formData.buyRate} onChange={v => updateField('buyRate', v)} required type="number" />
                    <TextField label="Sell Hourly Rate" value={formData.sellHourlyRate} onChange={v => updateField('sellHourlyRate', v)} type="number" />
                    <TextField label="Buy Hourly Rate" value={formData.buyHourlyRate} onChange={v => updateField('buyHourlyRate', v)} type="number" />
                    <SelectField label="Sell Currency" value={formData.sellCurrency} onChange={v => updateField('sellCurrency', v)} required
                      options={currencyOptions.map(c => ({ value: c, label: c }))} />
                    <SelectField label="Buy Currency" value={formData.buyCurrency} onChange={v => updateField('buyCurrency', v)} required
                      options={currencyOptions.map(c => ({ value: c, label: c }))} />
                    <TextField label="Margin" value={formData.margin} onChange={v => updateField('margin', v)} type="number" />
                    <TextField label="Gross Value" value={formData.grossValue} onChange={v => updateField('grossValue', v)} type="number" />
                    <TextField label="Monthly Salary" value={formData.monthlySalary} onChange={v => updateField('monthlySalary', v)} type="number" />
                    <SelectField label="Monthly Salary Currency" value={formData.monthlySalaryCurrency} onChange={v => updateField('monthlySalaryCurrency', v)}
                      options={currencyOptions.map(c => ({ value: c, label: c }))} />
                    <SwitchField label="Has Milestones" checked={formData.hasMilestones} onChange={v => updateField('hasMilestones', v)} />
                    <SwitchField label="Has Timesheet" checked={formData.hasTimesheet} onChange={v => updateField('hasTimesheet', v)} />
                  </div>
                </TabsContent>
                <TabsContent value="dates" className="mt-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">Dates</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <DateField label="Start Date" value={formData.startDate} onChange={v => updateField('startDate', v)} required />
                    <DateField label="End Date" value={formData.endDate} onChange={v => updateField('endDate', v)} required />
                    <DateField label="Actual End Date" value={formData.actualEndDate} onChange={v => updateField('actualEndDate', v)} />
                  </div>
                </TabsContent>
                <TabsContent value="invoices" className="mt-4">
                  <Table><TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>{relInvoices.map(i => (<TableRow key={i.id}><TableCell className="font-mono text-xs">{i.invoiceNumber}</TableCell><TableCell>{i.invoiceDate}</TableCell><TableCell>{formatCurrency(i.total, i.currencyCode)}</TableCell><TableCell><StatusBadge status={i.status} /></TableCell></TableRow>))}</TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="timesheets" className="mt-4">
                  <Table><TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Week</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>{relTimesheets.map(t => (<TableRow key={t.id}><TableCell className="font-mono text-xs">{t.reference}</TableCell><TableCell>{t.weekStart}</TableCell><TableCell>{t.totalHours}</TableCell><TableCell><StatusBadge status={t.status} /></TableCell></TableRow>))}</TableBody>
                  </Table>
                </TabsContent>
                {formData.hasMilestones && (
                  <TabsContent value="milestones" className="mt-4">
                    <div className="flex justify-end mb-3">
                      <Button size="sm" onClick={openMsDialog}><Plus className="h-4 w-4 mr-1" />Add Milestone</Button>
                    </div>
                    <Table>
                      <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Description</TableHead><TableHead>Value</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {relMilestones.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No milestones yet</TableCell></TableRow>
                        ) : relMilestones.map(m => (
                          <TableRow key={m.id}>
                            <TableCell className="font-mono text-xs">{m.milestoneId}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{m.description}</TableCell>
                            <TableCell>{formatCurrency(m.value, m.currencyCode)}</TableCell>
                            <TableCell>{formatDate(m.startDate)}</TableCell>
                            <TableCell>{formatDate(m.endDate)}</TableCell>
                            <TableCell><StatusBadge status={m.status} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>
                )}
              </Tabs>

              {/* Add Milestone Dialog */}
              <Dialog open={msDialogOpen} onOpenChange={setMsDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader><DialogTitle>Add Milestone</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-1 gap-4 mt-2">
                    <TextField label="Milestone ID" value={msForm.milestoneId || ''} onChange={() => {}} readOnly />
                    <TextField label="Description" value={msForm.description || ''} onChange={v => setMsForm(p => ({ ...p, description: v }))} required />
                    <div className="grid grid-cols-2 gap-4">
                      <TextField label="Value" value={msForm.value || ''} onChange={v => setMsForm(p => ({ ...p, value: v }))} required type="number" />
                      <SelectField label="Currency" value={msForm.currencyCode || 'EUR'} onChange={v => setMsForm(p => ({ ...p, currencyCode: v }))} required
                        options={currencyOptions.map(c => ({ value: c, label: c }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <DateField label="Start Date" value={msForm.startDate || ''} onChange={v => setMsForm(p => ({ ...p, startDate: v }))} required />
                      <DateField label="End Date" value={msForm.endDate || ''} onChange={v => setMsForm(p => ({ ...p, endDate: v }))} required />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setMsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={saveMilestone}>Save Milestone</Button>
                  </div>
                </DialogContent>
              </Dialog>
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
