import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Calendar, Table as TableIcon, Users, CalendarDays, Building2 } from 'lucide-react';
import { invoices, entities, accounts, contacts, contracts, getEntityById, getAccountById, getContactById, getContractById } from '@/data/mock-data';
import type { Invoice, InvoiceStatus, InvoiceLine, CurrencyCode, UnitOfMeasure } from '@/types/crm';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { HeaderSelectionBar } from '@/components/HeaderSelectionBar';
import { useConfirm } from '@/components/ConfirmDialog';
import { TextField, SelectField, DateField, LookupField, TextAreaField } from '@/components/FormField';
import { AccountingMonthEndFlow } from '@/components/invoice/AccountingMonthEndFlow';
import { TutorialVideoButton } from '@/components/TutorialVideoDialog';
import { GroupedByAccountView, MonthlyTimelineView, ByConsultantView } from '@/components/invoice/InvoiceAlternativeViews';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover, DateRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getNumberFilter, getDateFilter, setTextFilter, setMultiFilter, setNumberFilter, setDateFilter, matchDateRange,
} from '@/components/ColumnFilters';
import { SearchPill, SinglePill, DatePill, FilterChip, dateRangeFor, relativeDateLabel, ALL_DATES, type RelativeDateValue } from '@/components/FilterPills';

const invoiceStatuses: InvoiceStatus[] = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled', 'Credit Note'];
const countryOptions = entities.map(e => ({ id: e.id, label: e.country }));
const uniqueCurrencies = [...new Set(invoices.map(i => i.currencyCode))].sort();
const currencyOptions: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'RON'];
const uomOptions: UnitOfMeasure[] = ['Day', 'Hour', 'Month', 'Fixed'];
const consultantOptions = contacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }));

export default function InvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [invoiceDateRel, setInvoiceDateRel] = useState<RelativeDateValue>(ALL_DATES);
  const [dueDateRel, setDueDateRel] = useState<RelativeDateValue>(ALL_DATES);
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formLines, setFormLines] = useState<InvoiceLine[]>([]);
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<InvoiceLine | null>(null);
  const [lineForm, setLineForm] = useState<Record<string, any>>({});
  const [monthEndOpen, setMonthEndOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'account' | 'timeline' | 'consultant'>('table');

  const openForm = (inv: Invoice) => {
    setIsNew(false);
    setSelected(inv);
    setFormLines([...(inv.lines || [])]);
    setFormData({
      invoiceNumber: inv.invoiceNumber, entityId: inv.entityId, accountId: inv.accountId,
      parentAccountId: inv.parentAccountId || '', contractId: inv.contractId || '',
      currencyCode: inv.currencyCode, invoiceDate: inv.invoiceDate, dueDate: inv.dueDate,
      vatRate: inv.vatRate.toString(), vatAmount: inv.vatAmount.toString(),
      total: inv.total.toString(), ronTotalValue: inv.ronTotal?.toString() || '',
      ronConversionRate: inv.ronConversionRate?.toString() || '',
      comments: inv.comments || '', status: inv.status,
      paymentReceivedDate: inv.paymentReceivedDate || '',
    });
  };

  const openNewForm = () => {
    setIsNew(true);
    setSelected({} as Invoice);
    setFormLines([]);
    setFormData({
      invoiceNumber: `INV-${String(invoices.length + 1).padStart(3, '0')}`, entityId: entities[0]?.id || '',
      accountId: '', parentAccountId: '', contractId: '',
      currencyCode: 'EUR', invoiceDate: '', dueDate: '',
      vatRate: '19', vatAmount: '', total: '',
      ronTotalValue: '', ronConversionRate: '',
      comments: '', status: 'Draft', paymentReceivedDate: '',
    });
  };

  const closeForm = () => { setSelected(null); setIsNew(false); };

  // Auto-open invoice from URL param
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId) {
      const inv = invoices.find(i => i.id === openId);
      if (inv) openForm(inv);
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const saveForm = () => { toast.success(isNew ? `Invoice "${formData.invoiceNumber}" created` : `Invoice "${formData.invoiceNumber}" saved`); closeForm(); };
  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  // Line CRUD
  const openNewLine = () => {
    setEditingLine(null);
    const autoName = `Line ${formLines.length + 1}`;
    setLineForm({ name: autoName, description: '', quantity: '', unitOfMeasure: 'Day', invoiceId: formData.invoiceNumber || '', contactId: '', contractId: formData.contractId || '', lineTotal: '' });
    setLineDialogOpen(true);
  };
  const openEditLine = (line: InvoiceLine) => {
    setEditingLine(line);
    setLineForm({ name: line.name, description: line.description, quantity: line.quantity.toString(), unitOfMeasure: line.unitOfMeasure, invoiceId: formData.invoiceNumber || '', contactId: line.contactId || '', contractId: (line as any).contractId || formData.contractId || '', lineTotal: line.amount.toString() });
    setLineDialogOpen(true);
  };
  const saveLine = () => {
    const lineData: InvoiceLine = {
      id: editingLine?.id || `line-${Date.now()}`,
      invoiceId: lineForm.invoiceId,
      name: lineForm.name,
      description: lineForm.description,
      quantity: Number(lineForm.quantity) || 0,
      unitOfMeasure: lineForm.unitOfMeasure as UnitOfMeasure,
      contactId: lineForm.contactId || undefined,
      contractId: lineForm.contractId || undefined,
      rate: 0,
      currencyCode: formData.currencyCode || 'EUR',
      amount: Number(lineForm.lineTotal) || 0,
    };
    if (editingLine) {
      setFormLines(prev => prev.map(l => l.id === editingLine.id ? lineData : l));
    } else {
      setFormLines(prev => [...prev, lineData]);
    }
    setLineDialogOpen(false);
    toast.success(editingLine ? 'Line updated' : 'Line added');
  };
  const confirm = useConfirm();
  const deleteLine = async (lineId: string) => {
    const ok = await confirm({ title: 'Delete line', description: 'Are you sure you want to delete this line? This action cannot be undone.' });
    if (!ok) return;
    setFormLines(prev => prev.filter(l => l.id !== lineId));
    toast.success('Line deleted');
  };
  const updateLineField = (key: string, value: any) => setLineForm(prev => {
    const next = { ...prev, [key]: value };
    if (key === 'quantity' || key === 'unitOfMeasure' || key === 'contractId') {
      const contract = contracts.find(c => c.id === next.contractId);
      const qty = Number(next.quantity);
      if (contract && !isNaN(qty) && next.quantity !== '') {
        const perUnit = next.unitOfMeasure === 'Hour' ? contract.sellRate / 8 : contract.sellRate;
        next.lineTotal = (qty * perUnit).toFixed(2);
      }
    }
    return next;
  });

  const filtered = useMemo(() => {
    const invDateR = dateRangeFor(invoiceDateRel);
    const dueDateR = dateRangeFor(dueDateRel);
    return invoices.filter(inv => {
      if (statusFilter && inv.status !== statusFilter) return false;
      if (countryFilter && inv.entityId !== countryFilter) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const acc = getAccountById(inv.accountId);
        if (!inv.invoiceNumber.toLowerCase().includes(s) && !(acc?.name.toLowerCase().includes(s))) return false;
      }
      if (!matchDateRange(inv.invoiceDate, invDateR.from, invDateR.to)) return false;
      if (!matchDateRange(inv.dueDate, dueDateR.from, dueDateR.to)) return false;
      const num = getTextFilter(colFilters, 'invoiceNumber');
      if (num && !inv.invoiceNumber.toLowerCase().includes(num.toLowerCase())) return false;
      const account = getTextFilter(colFilters, 'account');
      if (account) { const acc = getAccountById(inv.accountId); if (!acc || !acc.name.toLowerCase().includes(account.toLowerCase())) return false; }
      const currencyCol = getMultiFilter(colFilters, 'currency');
      if (currencyCol.length > 0 && !currencyCol.includes(inv.currencyCode)) return false;
      const dateF = getDateFilter(colFilters, 'invoiceDate');
      if (!matchDateRange(inv.invoiceDate, dateF.from, dateF.to)) return false;
      const dueDateF = getDateFilter(colFilters, 'dueDate');
      if (!matchDateRange(inv.dueDate, dueDateF.from, dueDateF.to)) return false;
      const totalNum = getNumberFilter(colFilters, 'total');
      if (totalNum.min && inv.total < Number(totalNum.min)) return false;
      if (totalNum.max && inv.total > Number(totalNum.max)) return false;
      return true;
    });
  }, [statusFilter, countryFilter, searchTerm, invoiceDateRel, dueDateRel, colFilters]);

  const filteredIds = filtered.map(i => i.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="invoices" />
      <PageHeader title="Invoices" subtitle={`${filtered.length} of ${invoices.length} invoices`}
        action={<div className="flex items-center gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <Button variant="outline" onClick={() => setMonthEndOpen(true)}><Calendar className="h-4 w-4 mr-2" />Accounting Month End</Button>
          <Button onClick={openNewForm}><Plus className="h-4 w-4 mr-2" />Create Invoice</Button>
          <TutorialVideoButton
            entityLabel="Invoices"
            videos={[
              {
                id: 'month-end',
                title: 'How to Use Accounting Month End',
                description: 'Select period, review invoices, and send to accounting via Outlook',
                duration: '2:54',
                videoUrl: '/tutorials/month-end.mp4',
              },
            ]}
          />
        </div>} />

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search invoices..." />
          <SinglePill label="Status" value={statusFilter} onChange={setStatusFilter}
            options={invoiceStatuses.map(s => ({ value: s, label: s, count: invoices.filter(i => i.status === s).length }))} />
          <SinglePill label="Country" value={countryFilter} onChange={setCountryFilter}
            options={countryOptions.map(e => ({ value: e.id, label: e.label, count: invoices.filter(i => i.entityId === e.id).length }))} />
          <DatePill label="Invoice Date" value={invoiceDateRel} onChange={setInvoiceDateRel} dates={invoices.map(i => i.invoiceDate)} />
          <DatePill label="Due Date" value={dueDateRel} onChange={setDueDateRel} dates={invoices.map(i => i.dueDate)} />
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">View</span>
            <ToggleGroup type="single" value={viewMode} onValueChange={v => v && setViewMode(v as any)} className="border rounded-md p-0.5">
              <ToggleGroupItem value="table" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm gap-1.5"><TableIcon className="h-3.5 w-3.5" />Table</ToggleGroupItem>
              <ToggleGroupItem value="account" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm gap-1.5"><Building2 className="h-3.5 w-3.5" />By Account</ToggleGroupItem>
              <ToggleGroupItem value="timeline" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Timeline</ToggleGroupItem>
              <ToggleGroupItem value="consultant" className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm gap-1.5"><Users className="h-3.5 w-3.5" />By Consultant</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        {(searchTerm || statusFilter || countryFilter || invoiceDateRel.type !== 'all' || dueDateRel.type !== 'all') && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-muted-foreground">{filtered.length} of {invoices.length} invoices</span>
            <span className="text-muted-foreground">·</span>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('')} />}
            {countryFilter && <FilterChip label={`Country: ${countryOptions.find(c => c.id === countryFilter)?.label}`} onRemove={() => setCountryFilter('')} />}
            {invoiceDateRel.type !== 'all' && <FilterChip label={`Invoice Date: ${relativeDateLabel(invoiceDateRel)}`} onRemove={() => setInvoiceDateRel(ALL_DATES)} />}
            {dueDateRel.type !== 'all' && <FilterChip label={`Due Date: ${relativeDateLabel(dueDateRel)}`} onRemove={() => setDueDateRel(ALL_DATES)} />}
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setSearchTerm(''); setStatusFilter(''); setCountryFilter(''); setInvoiceDateRel(ALL_DATES); setDueDateRel(ALL_DATES); }}>
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
              <TableHead>Invoice # <TextFilterPopover label="Invoice #" value={getTextFilter(colFilters, 'invoiceNumber')} onChange={v => setTextFilter(setColFilters, 'invoiceNumber', v)} /></TableHead>
              <TableHead>Account <TextFilterPopover label="Account" value={getTextFilter(colFilters, 'account')} onChange={v => setTextFilter(setColFilters, 'account', v)} /></TableHead>
              <TableHead>Contract</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Date <DateRangeFilterPopover label="Invoice Date" from={getDateFilter(colFilters, 'invoiceDate').from} to={getDateFilter(colFilters, 'invoiceDate').to} onChange={(from, to) => setDateFilter(setColFilters, 'invoiceDate', from, to)} /></TableHead>
              <TableHead>Due Date <DateRangeFilterPopover label="Due Date" from={getDateFilter(colFilters, 'dueDate').from} to={getDateFilter(colFilters, 'dueDate').to} onChange={(from, to) => setDateFilter(setColFilters, 'dueDate', from, to)} /></TableHead>
              <TableHead>Currency <MultiSelectFilterPopover label="Currency" options={uniqueCurrencies} selected={getMultiFilter(colFilters, 'currency')} onChange={v => setMultiFilter(setColFilters, 'currency', v)} /></TableHead>
              <TableHead className="text-right">Total <NumberRangeFilterPopover label="Total" min={getNumberFilter(colFilters, 'total').min} max={getNumberFilter(colFilters, 'total').max} onChange={(min, max) => setNumberFilter(setColFilters, 'total', min, max)} /></TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No invoices match the current filters.</TableCell></TableRow>
            ) : filtered.map(inv => (
              <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(inv.id)} onCheckedChange={c => toggleOne(inv.id, !!c)} /></TableCell>
                <TableCell className="font-mono text-xs" onClick={() => openForm(inv)}>{inv.invoiceNumber}</TableCell>
                <TableCell onClick={() => openForm(inv)}>{getAccountById(inv.accountId)?.name}</TableCell>
                <TableCell className="text-xs" onClick={() => openForm(inv)}>{inv.contractId ? getContractById(inv.contractId)?.contractNumber : '—'}</TableCell>
                <TableCell onClick={() => openForm(inv)}>{getEntityById(inv.entityId)?.country}</TableCell>
                <TableCell onClick={() => openForm(inv)}>{formatDate(inv.invoiceDate)}</TableCell>
                <TableCell onClick={() => openForm(inv)}>{formatDate(inv.dueDate)}</TableCell>
                <TableCell onClick={() => openForm(inv)}>{inv.currencyCode}</TableCell>
                <TableCell className="text-right font-medium" onClick={() => openForm(inv)}>{formatCurrency(inv.total, inv.currencyCode)}</TableCell>
                <TableCell onClick={() => openForm(inv)}><StatusBadge status={inv.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      )}
      {viewMode === 'account' && <GroupedByAccountView invoices={filtered} onOpen={openForm} />}
      {viewMode === 'timeline' && <MonthlyTimelineView invoices={filtered} onOpen={openForm} />}
      {viewMode === 'consultant' && <ByConsultantView invoices={filtered} onOpen={openForm} />}

      <Sheet open={!!selected} onOpenChange={closeForm}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader><SheetTitle className="flex items-center gap-3">{isNew ? 'New Invoice' : formData.invoiceNumber}</SheetTitle></SheetHeader>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</span>
                <ToggleGroup type="single" value={formData.status} onValueChange={v => { if (v) updateField('status', v); }} className="border rounded-md p-0.5">
                  {invoiceStatuses.map(s => (<ToggleGroupItem key={s} value={s} className="text-xs px-3 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm">{s}</ToggleGroupItem>))}
                </ToggleGroup>
              </div>
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  {/* Left column fields */}
                  <LookupField label="Account" value={formData.accountId} onChange={v => updateField('accountId', v)} required
                    options={accounts.filter(a => a.accountType === 'Direct Customer' || a.accountType === 'Recruiter Agency').map(a => ({ value: a.id, label: a.name }))} />
                  <LookupField label="Country" value={formData.entityId} onChange={v => updateField('entityId', v)} required
                    options={entities.map(e => ({ value: e.id, label: e.country }))} />

                  <DateField label="Payment Received Date" value={formData.paymentReceivedDate} onChange={v => updateField('paymentReceivedDate', v)} />

                  <DateField label="Invoice Date" value={formData.invoiceDate} onChange={v => updateField('invoiceDate', v)} required />
                  <SelectField label="Currency" value={formData.currencyCode} onChange={v => updateField('currencyCode', v)} required
                    options={currencyOptions.map(c => ({ value: c, label: c }))} />

                  <DateField label="Due Date" value={formData.dueDate} onChange={v => updateField('dueDate', v)} required />
                  <TextField label="Total" value={formData.total} onChange={v => updateField('total', v)} type="number" />

                  <TextField label="VAT Amount" value={formData.vatAmount} onChange={v => updateField('vatAmount', v)} type="number" />
                  <TextField label="RON Total Value" value={formData.ronTotalValue} onChange={v => updateField('ronTotalValue', v)} type="number" />

                  <TextField label="VAT Rate %" value={formData.vatRate} onChange={v => updateField('vatRate', v)} type="number" />
                  <TextField label="RON Conversion Rate" value={formData.ronConversionRate} onChange={v => updateField('ronConversionRate', v)} type="number" />

                  <TextAreaField label="Comments" value={formData.comments} onChange={v => updateField('comments', v)} rows={2} />
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">Invoice Lines</h4>
                    <Button size="sm" variant="outline" onClick={openNewLine}><Plus className="h-3.5 w-3.5 mr-1" />Add Line</Button>
                  </div>
                  <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Qty</TableHead><TableHead>UoM</TableHead><TableHead>Consultant</TableHead><TableHead className="text-right">Line Total</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {formLines.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-4 text-muted-foreground text-sm">No lines yet. Click "Add Line" to add one.</TableCell></TableRow>
                      ) : formLines.map(line => (
                        <TableRow key={line.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell onClick={() => openEditLine(line)}>{line.name}</TableCell>
                          <TableCell onClick={() => openEditLine(line)} className="max-w-[150px] truncate">{line.description}</TableCell>
                          <TableCell onClick={() => openEditLine(line)}>{line.quantity}</TableCell>
                          <TableCell onClick={() => openEditLine(line)}>{line.unitOfMeasure}</TableCell>
                          <TableCell onClick={() => openEditLine(line)}>{line.contactId ? consultantOptions.find(c => c.value === line.contactId)?.label || '—' : '—'}</TableCell>
                          <TableCell className="text-right font-medium" onClick={() => openEditLine(line)}>{formatCurrency(line.amount, line.currencyCode)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteLine(line.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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

      {/* Invoice Line Dialog */}
      <Dialog open={lineDialogOpen} onOpenChange={setLineDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editingLine ? 'Edit Invoice Line' : 'New Invoice Line'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 py-4">
            <TextField label="Name" value={lineForm.name || ''} onChange={() => {}} readOnly />
            <TextField label="Invoice" value={lineForm.invoiceId || ''} onChange={() => {}} readOnly />

            <div className="col-span-2">
              <LookupField label="Contract" value={lineForm.contractId || ''} onChange={v => updateLineField('contractId', v)} required
                options={contracts.map(c => {
                  const account = getAccountById(c.parentAccountId);
                  const contact = getContactById(c.contactId);
                  const contactName = contact ? `${contact.firstName} ${contact.lastName}` : '';
                  return { value: c.id, label: `${c.contractNumber} — ${c.name} — ${contactName}${account ? ` (${account.name})` : ''}` };
                })} />
            </div>

            <TextAreaField label="Description" value={lineForm.description || ''} onChange={v => updateLineField('description', v)} required rows={4} />
            <LookupField label="Consultant" value={lineForm.contactId || ''} onChange={v => updateLineField('contactId', v)}
              options={consultantOptions} />

            <TextField label="Quantity" value={lineForm.quantity || ''} onChange={v => updateLineField('quantity', v)} required type="number" />
            <TextField label="Line Total" value={lineForm.lineTotal || ''} onChange={v => updateLineField('lineTotal', v)} required type="number" />

            <SelectField label="Unit of Measure" value={lineForm.unitOfMeasure || 'Day'} onChange={v => updateLineField('unitOfMeasure', v)} required
              options={uomOptions.map(u => ({ value: u, label: u }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveLine}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AccountingMonthEndFlow open={monthEndOpen} onOpenChange={setMonthEndOpen} />
    </div>
  );
}
