import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Upload, FileText, X, Table as TableIcon, Building2, Tag, FileSignature } from 'lucide-react';
import { expenses, entities, accounts, contracts, getEntityById, getAccountById, getContactById, getContractById } from '@/data/mock-data';
import { ByVendorView, ByTypeView, ByContractView } from '@/components/expense/ExpenseAlternativeViews';
import type { Expense, ExpenseType, ExpenseStatus, CurrencyCode } from '@/types/crm';
import { formatCurrency, formatDate } from '@/lib/format';
import { HeaderSelectionBar } from '@/components/HeaderSelectionBar';
import { TextField, SelectField, DateField, LookupField } from '@/components/FormField';
import { toast } from 'sonner';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover, DateRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getNumberFilter, getDateFilter, setTextFilter, setMultiFilter, setNumberFilter, setDateFilter, matchDateRange,
} from '@/components/ColumnFilters';
import { SearchPill, SinglePill, MultiPill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, type RelativeDateValue } from '@/components/FilterPills';

const expenseTypes: ExpenseType[] = ['Contractor Payment', 'Supplier Invoice', 'Tax', 'Employee Salary', 'Operating Cost', 'Software / Subscription'];
const expenseStatuses: ExpenseStatus[] = ['Received', 'Paid', 'Overdue'];
const countryOptions = entities.map(e => ({ id: e.id, label: e.country }));
const uniqueCurrencies = [...new Set(expenses.map(e => e.currencyCode))].sort();
const currencyOptions: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'RON'];

export default function ExpensesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateIssuedFilter, setDateIssuedFilter] = useState<RelativeDateValue>({ type: 'all' });
  const [dueDateFilter, setDueDateFilter] = useState<RelativeDateValue>({ type: 'all' });
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selected, setSelected] = useState<Expense | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [viewMode, setViewMode] = useState<'table' | 'vendor' | 'type' | 'contract'>('table');

  const openForm = (expense: Expense) => {
    setIsNew(false);
    setSelected(expense);
    setFormData({
      reference: expense.reference, entityId: expense.entityId, accountId: expense.accountId,
      expenseType: expense.expenseType, contractId: expense.contractId || '',
      currencyCode: expense.currencyCode,
      totalAmount: expense.totalAmount.toString(), vatAmount: expense.vatAmount.toString(),
      netAmount: expense.netAmount.toString(), dateIssued: expense.dateIssued,
      dueDate: expense.dueDate, paymentDate: expense.paymentDate || '',
      vendorInvoiceNumber: expense.vendorInvoiceNumber || '', status: expense.status,
      evidenceFile: expense.vendorInvoiceNumber ? `${expense.reference}_evidence.pdf` : '',
      periodMonth: expense.periodMonth.toString(), periodYear: expense.periodYear.toString(),
    });
  };

  const openNewForm = () => {
    setIsNew(true);
    setSelected({} as Expense);
    setFormData({
      reference: `EXP-${String(expenses.length + 1).padStart(3, '0')}`, entityId: entities[0]?.id || '',
      accountId: '', expenseType: 'Supplier Invoice', contractId: '',
      currencyCode: 'EUR',
      totalAmount: '', vatAmount: '', netAmount: '', dateIssued: '', dueDate: '',
      paymentDate: '', vendorInvoiceNumber: '', status: 'Received', evidenceFile: '',
      periodMonth: '', periodYear: '',
    });
  };

  const closeForm = () => { setSelected(null); setIsNew(false); };
  const saveForm = () => { toast.success(isNew ? `Expense "${formData.reference}" created` : `Expense "${formData.reference}" saved`); closeForm(); };
  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  // Auto-open expense from URL param
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId) {
      const exp = expenses.find(e => e.id === openId);
      if (exp) openForm(exp);
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      if (statusFilter && e.status !== statusFilter) return false;
      if (typeFilter && e.expenseType !== typeFilter) return false;
      if (countryFilter.length > 0 && !countryFilter.includes(e.entityId)) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const acc = getAccountById(e.accountId);
        const matches = e.reference.toLowerCase().includes(s) ||
          (acc?.name.toLowerCase().includes(s)) ||
          (e.vendorInvoiceNumber || '').toLowerCase().includes(s);
        if (!matches) return false;
      }
      if (dateIssuedFilter.type !== 'all') {
        const r = dateRangeFor(dateIssuedFilter);
        if (!matchDateRange(e.dateIssued, r.from, r.to)) return false;
      }
      if (dueDateFilter.type !== 'all') {
        const r = dateRangeFor(dueDateFilter);
        if (!matchDateRange(e.dueDate, r.from, r.to)) return false;
      }
      const ref = getTextFilter(colFilters, 'reference');
      if (ref && !e.reference.toLowerCase().includes(ref.toLowerCase())) return false;
      const vendor = getTextFilter(colFilters, 'vendor');
      if (vendor) { const acc = getAccountById(e.accountId); if (!acc || !acc.name.toLowerCase().includes(vendor.toLowerCase())) return false; }
      const currencyCol = getMultiFilter(colFilters, 'currency');
      if (currencyCol.length > 0 && !currencyCol.includes(e.currencyCode)) return false;
      const dateF = getDateFilter(colFilters, 'dateIssued');
      if (!matchDateRange(e.dateIssued, dateF.from, dateF.to)) return false;
      const dueDateF = getDateFilter(colFilters, 'dueDate');
      if (!matchDateRange(e.dueDate, dueDateF.from, dueDateF.to)) return false;
      const totalNum = getNumberFilter(colFilters, 'total');
      if (totalNum.min && e.totalAmount < Number(totalNum.min)) return false;
      if (totalNum.max && e.totalAmount > Number(totalNum.max)) return false;
      return true;
    });
  }, [statusFilter, typeFilter, countryFilter, searchTerm, dateIssuedFilter, dueDateFilter, colFilters]);

  const filteredIds = filtered.map(e => e.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="expenses" />
      <PageHeader title="Expenses" subtitle={`${filtered.length} of ${expenses.length} expenses`}
        action={<div className="flex items-center gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <Button onClick={openNewForm}><Plus className="h-4 w-4 mr-2" />Add Expense</Button>
        </div>} />

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search reference, vendor, invoice #..." />
          <SinglePill label="Status" value={statusFilter} onChange={setStatusFilter}
            options={expenseStatuses.map(s => ({ value: s, label: s, count: expenses.filter(e => e.status === s).length }))} />
          <SinglePill label="Type" value={typeFilter} onChange={setTypeFilter}
            options={expenseTypes.map(t => ({ value: t, label: t, count: expenses.filter(e => e.expenseType === t).length }))} />
          <MultiPill label="Country" values={countryFilter} onChange={setCountryFilter}
            options={countryOptions.map(e => ({ value: e.id, label: e.label, count: expenses.filter(ex => ex.entityId === e.id).length }))} />
          <DatePill label="Date Issued" value={dateIssuedFilter} onChange={setDateIssuedFilter} dates={expenses.map(e => e.dateIssued)} />
          <DatePill label="Due Date" value={dueDateFilter} onChange={setDueDateFilter} dates={expenses.map(e => e.dueDate)} />
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">View</span>
            <ToggleGroup type="single" value={viewMode} onValueChange={v => v && setViewMode(v as any)} className="border rounded-md p-0.5">
              <ToggleGroupItem value="table" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm gap-1.5"><TableIcon className="h-3.5 w-3.5" />Table</ToggleGroupItem>
              <ToggleGroupItem value="vendor" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm gap-1.5"><Building2 className="h-3.5 w-3.5" />By Vendor</ToggleGroupItem>
              <ToggleGroupItem value="type" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm gap-1.5"><Tag className="h-3.5 w-3.5" />By Type</ToggleGroupItem>
              <ToggleGroupItem value="contract" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm gap-1.5"><FileSignature className="h-3.5 w-3.5" />By Contract</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        {(searchTerm || statusFilter || typeFilter || countryFilter.length > 0 || dateIssuedFilter.type !== 'all' || dueDateFilter.type !== 'all') && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('')} />}
            {typeFilter && <FilterChip label={`Type: ${typeFilter}`} onRemove={() => setTypeFilter('')} />}
            {countryFilter.length > 0 && <FilterChip label={`Country: ${countryFilter.map(id => countryOptions.find(c => c.id === id)?.label).filter(Boolean).join(', ')}`} onRemove={() => setCountryFilter([])} />}
            {dateIssuedFilter.type !== 'all' && <FilterChip label={`Date Issued: ${relativeDateLabel(dateIssuedFilter)}`} onRemove={() => setDateIssuedFilter({ type: 'all' })} />}
            {dueDateFilter.type !== 'all' && <FilterChip label={`Due Date: ${relativeDateLabel(dueDateFilter)}`} onRemove={() => setDueDateFilter({ type: 'all' })} />}
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setSearchTerm(''); setStatusFilter(''); setTypeFilter(''); setCountryFilter([]); setDateIssuedFilter({ type: 'all' }); setDueDateFilter({ type: 'all' }); }}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      {viewMode === 'table' && (
      <div className="rounded-lg border">

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
              <TableHead>Reference <TextFilterPopover label="Reference" value={getTextFilter(colFilters, 'reference')} onChange={v => setTextFilter(setColFilters, 'reference', v)} /></TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Vendor <TextFilterPopover label="Vendor" value={getTextFilter(colFilters, 'vendor')} onChange={v => setTextFilter(setColFilters, 'vendor', v)} /></TableHead>
              <TableHead>Contract</TableHead>
              <TableHead>Currency <MultiSelectFilterPopover label="Currency" options={uniqueCurrencies} selected={getMultiFilter(colFilters, 'currency')} onChange={v => setMultiFilter(setColFilters, 'currency', v)} /></TableHead>
              <TableHead className="text-right">Total <NumberRangeFilterPopover label="Total" min={getNumberFilter(colFilters, 'total').min} max={getNumberFilter(colFilters, 'total').max} onChange={(min, max) => setNumberFilter(setColFilters, 'total', min, max)} /></TableHead>
              <TableHead className="text-right">VAT</TableHead>
              <TableHead>Date Issued <DateRangeFilterPopover label="Date Issued" from={getDateFilter(colFilters, 'dateIssued').from} to={getDateFilter(colFilters, 'dateIssued').to} onChange={(from, to) => setDateFilter(setColFilters, 'dateIssued', from, to)} /></TableHead>
              <TableHead>Due Date <DateRangeFilterPopover label="Due Date" from={getDateFilter(colFilters, 'dueDate').from} to={getDateFilter(colFilters, 'dueDate').to} onChange={(from, to) => setDateFilter(setColFilters, 'dueDate', from, to)} /></TableHead>
              <TableHead>Vendor Invoice #</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={14} className="text-center py-8 text-muted-foreground">No expenses match the current filters.</TableCell></TableRow>
            ) : filtered.map(e => {
              const contract = e.contractId ? getContractById(e.contractId) : null;
              return (
              <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell onClick={ev => ev.stopPropagation()}><Checkbox checked={selectedIds.includes(e.id)} onCheckedChange={c => toggleOne(e.id, !!c)} /></TableCell>
                <TableCell className="font-mono text-xs" onClick={() => openForm(e)}>{e.reference}</TableCell>
                <TableCell className="text-sm" onClick={() => openForm(e)}>{e.expenseType}</TableCell>
                <TableCell onClick={() => openForm(e)}>{getAccountById(e.accountId)?.name}</TableCell>
                <TableCell className="text-sm" onClick={() => openForm(e)}>
                  {contract ? (
                    <div className="leading-tight">
                      <div className="font-medium">{contract.contractNumber}</div>
                      <div className="text-xs text-muted-foreground">{getAccountById(contract.parentAccountId)?.name}</div>
                      {contract.childAccountId && <div className="text-xs text-muted-foreground">{getAccountById(contract.childAccountId)?.name}</div>}
                    </div>
                  ) : '—'}
                </TableCell>
                <TableCell onClick={() => openForm(e)}>{e.currencyCode}</TableCell>
                <TableCell className="text-right font-medium" onClick={() => openForm(e)}>{formatCurrency(e.totalAmount, e.currencyCode)}</TableCell>
                <TableCell className="text-right" onClick={() => openForm(e)}>{formatCurrency(e.vatAmount, e.currencyCode)}</TableCell>
                <TableCell onClick={() => openForm(e)}>{formatDate(e.dateIssued)}</TableCell>
                <TableCell onClick={() => openForm(e)}>{formatDate(e.dueDate)}</TableCell>
                <TableCell className="text-sm" onClick={() => openForm(e)}>{e.vendorInvoiceNumber || '—'}</TableCell>
                <TableCell onClick={() => openForm(e)}>{getEntityById(e.entityId)?.country}</TableCell>
                <TableCell onClick={() => openForm(e)}><StatusBadge status={e.status} /></TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </div>
      )}

      {viewMode === 'vendor' && <ByVendorView expenses={filtered} onOpen={openForm} />}
      {viewMode === 'type' && <ByTypeView expenses={filtered} onOpen={openForm} />}
      {viewMode === 'contract' && <ByContractView expenses={filtered} onOpen={openForm} />}


      <Sheet open={!!selected} onOpenChange={closeForm}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader><SheetTitle className="flex items-center gap-3">{isNew ? 'New Expense' : formData.reference}</SheetTitle></SheetHeader>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</span>
                <ToggleGroup type="single" value={formData.status} onValueChange={v => { if (v) updateField('status', v); }} className="border rounded-md p-0.5">
                  {expenseStatuses.map(s => (<ToggleGroupItem key={s} value={s} className="text-xs px-3 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm">{s}</ToggleGroupItem>))}
                </ToggleGroup>
              </div>

              <div className="mt-6 space-y-6">
                {/* General Section */}
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-3 border-b pb-1">General</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <TextField label="Reference" value={formData.reference} onChange={v => updateField('reference', v)} required readOnly />
                    <SelectField label="Type" value={formData.expenseType} onChange={v => updateField('expenseType', v)} required
                      options={expenseTypes.map(t => ({ value: t, label: t }))} />
                    <LookupField label="Vendor" value={formData.accountId} onChange={v => updateField('accountId', v)} required
                      options={accounts.map(a => ({ value: a.id, label: a.name }))} />
                    <div className="col-span-2">
                      <LookupField label="Contract" value={formData.contractId} onChange={v => updateField('contractId', v)}
                        options={contracts.map(c => {
                          const account = getAccountById(c.parentAccountId);
                          const contact = getContactById(c.contactId);
                          const contactName = contact ? `${contact.firstName} ${contact.lastName}` : '';
                          return { value: c.id, label: `${c.contractNumber} — ${c.name} — ${contactName}${account ? ` (${account.name})` : ''}` };
                        })} />
                    </div>
                  </div>
                </div>

                {/* Financials Section */}
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-3 border-b pb-1">Financials</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <TextField label="Total Amount" value={formData.totalAmount} onChange={v => updateField('totalAmount', v)} required type="number" />
                    <TextField label="VAT" value={formData.vatAmount} onChange={v => updateField('vatAmount', v)} type="number" />
                    <TextField label="Net Amount" value={formData.netAmount} onChange={v => updateField('netAmount', v)} type="number" />
                    <SelectField label="Currency" value={formData.currencyCode} onChange={v => updateField('currencyCode', v)} required
                      options={currencyOptions.map(c => ({ value: c, label: c }))} />
                  </div>
                </div>

                {/* Dates Section */}
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-3 border-b pb-1">Dates</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <DateField label="Date Issued" value={formData.dateIssued} onChange={v => updateField('dateIssued', v)} required />
                    <DateField label="Due Date" value={formData.dueDate} onChange={v => updateField('dueDate', v)} />
                    <DateField label="Payment Date" value={formData.paymentDate} onChange={v => updateField('paymentDate', v)} />
                    <TextField label="Vendor Invoice #" value={formData.vendorInvoiceNumber} onChange={v => updateField('vendorInvoiceNumber', v)} />
                  </div>
                </div>

                {/* Period Section */}
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-3 border-b pb-1">Period</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <LookupField label="Country" value={formData.entityId} onChange={v => updateField('entityId', v)} required
                      options={entities.map(e => ({ value: e.id, label: e.country }))} />
                    <TextField label="Period Month" value={formData.periodMonth} onChange={v => updateField('periodMonth', v)} required type="number" />
                    <TextField label="Period Year" value={formData.periodYear} onChange={v => updateField('periodYear', v)} required type="number" />
                  </div>
                </div>

                {/* Evidence Section */}
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-3 border-b pb-1">Evidence</h3>
                  <div>
                    {formData.evidenceFile ? (
                      <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                        <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{formData.evidenceFile}</p>
                          <p className="text-xs text-muted-foreground">PDF document</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => updateField('evidenceFile', '')}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-colors">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Click to upload PDF evidence</span>
                        <span className="text-xs text-muted-foreground/60">PDF files only</span>
                        <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) updateField('evidenceFile', file.name);
                        }} />
                      </label>
                    )}
                  </div>
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
