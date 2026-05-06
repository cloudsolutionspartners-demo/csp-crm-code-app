import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Upload, FileText, X } from 'lucide-react';
import { dividends, entities, getEntityById } from '@/data/mock-data';
import { formatCurrency, formatDate } from '@/lib/format';
import { HeaderSelectionBar } from '@/components/HeaderSelectionBar';
import { TextField, SelectField, DateField, LookupField } from '@/components/FormField';
import { toast } from 'sonner';
import {
  ColumnFilters, ClearColumnFiltersButton, matchDateRange,
} from '@/components/ColumnFilters';
import { SearchPill, SinglePill, MultiPill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, type RelativeDateValue } from '@/components/FilterPills';
import type { Dividend } from '@/types/crm';

const countryOptions = entities.map(e => ({ id: e.id, label: e.country }));
const uniqueCurrencies = [...new Set(dividends.map(d => d.currencyCode))].sort();
const currencyOptions = ['EUR', 'USD', 'RON', 'GBP'];

export default function DividendsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [currencyFilter, setCurrencyFilter] = useState<string[]>([]);
  const [paymentDateFilter, setPaymentDateFilter] = useState<RelativeDateValue>({ type: 'all' });
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Dividend | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const openForm = (d: Dividend) => {
    setIsNew(false);
    setSelected(d);
    setFormData({
      name: d.name, entityId: d.entityId, currencyCode: d.currencyCode,
      amount: d.amount.toString(), taxWithheld: d.taxWithheld.toString(),
      paymentDate: d.paymentDate, documentFile: d.documentFile || '',
    });
  };

  const openNewForm = () => {
    setIsNew(true);
    setSelected({} as Dividend);
    setFormData({
      name: `DIV-${String(dividends.length + 1).padStart(3, '0')}`,
      entityId: entities[0]?.id || '', currencyCode: 'EUR',
      amount: '', taxWithheld: '', paymentDate: '', documentFile: '',
    });
  };

  const closeForm = () => { setSelected(null); setIsNew(false); };
  const saveForm = () => { toast.success(isNew ? 'Dividend created' : 'Dividend saved'); closeForm(); };
  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const filtered = useMemo(() => {
    const range = dateRangeFor(paymentDateFilter);
    return dividends.filter(d => {
      if (countryFilter && d.entityId !== countryFilter) return false;
      if (currencyFilter.length > 0 && !currencyFilter.includes(d.currencyCode)) return false;
      if (paymentDateFilter.type !== 'all' && !matchDateRange(d.paymentDate, range.from, range.to)) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const country = getEntityById(d.entityId)?.country || '';
        if (!d.name.toLowerCase().includes(q) && !country.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [countryFilter, currencyFilter, paymentDateFilter, searchTerm]);

  const filteredIds = filtered.map(d => d.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const hasActiveFilters = !!searchTerm || !!countryFilter || currencyFilter.length > 0 || paymentDateFilter.type !== 'all';

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="dividends" showActivate={false} showDeactivate={false} />
      <PageHeader title="Dividends" subtitle={`${filtered.length} of ${dividends.length} dividends`}
        action={<div className="flex items-center gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <Button onClick={openNewForm}><Plus className="h-4 w-4 mr-2" />Add Dividend</Button>
        </div>} />

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search name, country..." />
          <SinglePill label="Country" value={countryFilter} onChange={setCountryFilter}
            options={countryOptions.map(e => ({ value: e.id, label: e.label, count: dividends.filter(d => d.entityId === e.id).length }))} />
          <MultiPill label="Currency" values={currencyFilter} onChange={setCurrencyFilter}
            options={uniqueCurrencies.map(c => ({ value: c, label: c, count: dividends.filter(d => d.currencyCode === c).length }))} />
          <DatePill label="Payment Date" value={paymentDateFilter} onChange={setPaymentDateFilter} dates={dividends.map(d => d.paymentDate)} />
        </div>
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {countryFilter && <FilterChip label={`Country: ${countryOptions.find(c => c.id === countryFilter)?.label || countryFilter}`} onRemove={() => setCountryFilter('')} />}
            {currencyFilter.length > 0 && <FilterChip label={`Currency: ${currencyFilter.join(', ')}`} onRemove={() => setCurrencyFilter([])} />}
            {paymentDateFilter.type !== 'all' && <FilterChip label={`Payment Date: ${relativeDateLabel(paymentDateFilter)}`} onRemove={() => setPaymentDateFilter({ type: 'all' })} />}
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setSearchTerm(''); setCountryFilter(''); setCurrencyFilter([]); setPaymentDateFilter({ type: 'all' }); }}>
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
              <TableHead>Name</TableHead>
              <TableHead>Country</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Tax Withheld</TableHead>
              <TableHead>Payment Date</TableHead>
              <TableHead>Document</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No dividends match the current filters.</TableCell></TableRow>
            ) : filtered.map(d => (
              <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openForm(d)}>
                <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(d.id)} onCheckedChange={c => toggleOne(d.id, !!c)} /></TableCell>
                <TableCell className="font-mono text-xs">{d.name}</TableCell>
                <TableCell>{getEntityById(d.entityId)?.country}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(d.amount, d.currencyCode)}</TableCell>
                <TableCell>{d.currencyCode}</TableCell>
                <TableCell className="text-right">{formatCurrency(d.taxWithheld, d.currencyCode)}</TableCell>
                <TableCell>{formatDate(d.paymentDate)}</TableCell>
                <TableCell>{d.documentFile ? <FileText className="h-4 w-4 text-primary" /> : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selected} onOpenChange={closeForm}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader><SheetTitle>{isNew ? 'New Dividend' : formData.name}</SheetTitle></SheetHeader>

              <div className="mt-6 space-y-6">
                {/* General Section */}
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-3 border-b pb-1">General</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <TextField label="Name" value={formData.name} onChange={v => updateField('name', v)} required readOnly />
                    <LookupField label="Country" value={formData.entityId} onChange={v => updateField('entityId', v)} required
                      options={entities.map(e => ({ value: e.id, label: e.country }))} />
                  </div>
                </div>

                {/* Financials Section */}
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-3 border-b pb-1">Financials</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <TextField label="Amount" value={formData.amount} onChange={v => updateField('amount', v)} required type="number" />
                    <SelectField label="Currency" value={formData.currencyCode} onChange={v => updateField('currencyCode', v)} required
                      options={currencyOptions.map(c => ({ value: c, label: c }))} />
                    <TextField label="Tax Withheld" value={formData.taxWithheld} onChange={v => updateField('taxWithheld', v)} type="number" />
                    <DateField label="Payment Date" value={formData.paymentDate} onChange={v => updateField('paymentDate', v)} required />
                  </div>
                </div>

                {/* Document Section */}
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-3 border-b pb-1">Document</h3>
                  <div>
                    {formData.documentFile ? (
                      <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                        <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{formData.documentFile}</p>
                          <p className="text-xs text-muted-foreground">PDF document</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => updateField('documentFile', '')}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-colors">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Click to upload AGA document</span>
                        <span className="text-xs text-muted-foreground/60">PDF files only</span>
                        <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) updateField('documentFile', file.name);
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
