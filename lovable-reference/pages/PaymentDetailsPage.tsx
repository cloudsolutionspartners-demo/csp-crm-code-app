import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
import { paymentDetails, accounts, getAccountById } from '@/data/mock-data';
import type { PaymentDetail, CurrencyCode } from '@/types/crm';
import { HeaderSelectionBar } from '@/components/HeaderSelectionBar';
import { TextField, SelectField, LookupField } from '@/components/FormField';
import { toast } from 'sonner';
import {
  ColumnFilters, ClearColumnFiltersButton,
} from '@/components/ColumnFilters';
import { SearchPill, MultiPill, FilterChip } from '@/components/FilterPills';

const currencyOptions: { value: string; label: string }[] = ['EUR', 'USD', 'GBP', 'RON'].map(c => ({ value: c, label: c }));

export default function PaymentDetailsPage() {
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selected, setSelected] = useState<PaymentDetail | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [accountFilter, setAccountFilter] = useState<string[]>([]);
  const [currencyFilter, setCurrencyFilter] = useState<string[]>([]);
  const [primaryFilter, setPrimaryFilter] = useState<string[]>([]);

  const openForm = (pd: PaymentDetail) => {
    setIsNew(false);
    setSelected(pd);
    setFormData({
      accountId: pd.accountId, bankName: pd.bankName,
      iban: pd.iban, swift: pd.swift, currencyCode: pd.currencyCode, isPrimary: pd.isPrimary,
    });
  };

  const openNewForm = () => {
    setIsNew(true);
    setSelected({} as PaymentDetail);
    setFormData({ accountId: '', bankName: '', iban: '', swift: '', currencyCode: 'EUR', isPrimary: false });
  };

  const closeForm = () => { setSelected(null); setIsNew(false); };
  const saveForm = () => { toast.success(isNew ? 'Payment Detail created' : 'Payment Detail saved'); closeForm(); };
  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const accountOptions = accounts.map(a => ({ value: a.id, label: a.name }));
  const uniqueCurrencies = useMemo(() => [...new Set(paymentDetails.map(pd => pd.currencyCode))].sort(), []);

  const filtered = useMemo(() => {
    return paymentDetails.filter(pd => {
      if (accountFilter.length > 0 && !accountFilter.includes(pd.accountId)) return false;
      if (currencyFilter.length > 0 && !currencyFilter.includes(pd.currencyCode)) return false;
      if (primaryFilter.length > 0) {
        const v = pd.isPrimary ? 'Yes' : 'No';
        if (!primaryFilter.includes(v)) return false;
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const acc = getAccountById(pd.accountId)?.name || '';
        if (
          !acc.toLowerCase().includes(q) &&
          !(pd.bankName || '').toLowerCase().includes(q) &&
          !pd.iban.toLowerCase().includes(q) &&
          !pd.swift.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [searchTerm, accountFilter, currencyFilter, primaryFilter]);

  const filteredIds = filtered.map(m => m.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const hasActiveFilters = !!searchTerm || accountFilter.length > 0 || currencyFilter.length > 0 || primaryFilter.length > 0;

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Payment Details" action={<Button size="sm" onClick={openNewForm}><Plus className="h-4 w-4 mr-1" />Add Payment Detail</Button>} />

      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} showDelete />

      <div className="space-y-3 px-6 pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search account, bank, IBAN, SWIFT..." />
          <MultiPill label="Account" values={accountFilter} onChange={setAccountFilter}
            options={accountOptions.map(a => ({ value: a.value, label: a.label, count: paymentDetails.filter(pd => pd.accountId === a.value).length }))} />
          <MultiPill label="Currency" values={currencyFilter} onChange={setCurrencyFilter}
            options={uniqueCurrencies.map(c => ({ value: c, label: c, count: paymentDetails.filter(pd => pd.currencyCode === c).length }))} />
          <MultiPill label="Primary" values={primaryFilter} onChange={setPrimaryFilter}
            options={['Yes', 'No'].map(v => ({ value: v, label: v, count: paymentDetails.filter(pd => (pd.isPrimary ? 'Yes' : 'No') === v).length }))} />
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
        </div>
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {accountFilter.length > 0 && <FilterChip label={`Account: ${accountFilter.map(id => accountOptions.find(a => a.value === id)?.label).filter(Boolean).join(', ')}`} onRemove={() => setAccountFilter([])} />}
            {currencyFilter.length > 0 && <FilterChip label={`Currency: ${currencyFilter.join(', ')}`} onRemove={() => setCurrencyFilter([])} />}
            {primaryFilter.length > 0 && <FilterChip label={`Primary: ${primaryFilter.join(', ')}`} onRemove={() => setPrimaryFilter([])} />}
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setSearchTerm(''); setAccountFilter([]); setCurrencyFilter([]); setPrimaryFilter([]); }}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Bank Name</TableHead>
              <TableHead>IBAN</TableHead>
              <TableHead>SWIFT / BIC</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Primary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(pd => (
              <TableRow key={pd.id} className="cursor-pointer" onClick={() => openForm(pd)}>
                <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(pd.id)} onCheckedChange={c => toggleOne(pd.id, !!c)} /></TableCell>
                <TableCell className="font-medium">{getAccountById(pd.accountId)?.name || '—'}</TableCell>
                <TableCell>{pd.bankName || '—'}</TableCell>
                <TableCell>{pd.iban}</TableCell>
                <TableCell>{pd.swift}</TableCell>
                <TableCell>{pd.currencyCode}</TableCell>
                <TableCell>{pd.isPrimary ? 'Yes' : 'No'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selected} onOpenChange={open => { if (!open) closeForm(); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{isNew ? 'New Payment Detail' : 'Edit Payment Detail'}</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <LookupField label="Account" value={formData.accountId} onChange={v => updateField('accountId', v)} options={accountOptions} required />
            <TextField label="Bank Name" value={formData.bankName} onChange={v => updateField('bankName', v)} />
            
            <TextField label="IBAN" value={formData.iban} onChange={v => updateField('iban', v)} required />
            <TextField label="SWIFT / BIC" value={formData.swift} onChange={v => updateField('swift', v)} required />
            <SelectField label="Currency" value={formData.currencyCode} onChange={v => updateField('currencyCode', v)} options={currencyOptions} />
            <div className="flex items-center gap-2">
              <Checkbox checked={formData.isPrimary} onCheckedChange={c => updateField('isPrimary', !!c)} />
              <span className="text-sm">Is Primary</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button onClick={saveForm}>Save</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
