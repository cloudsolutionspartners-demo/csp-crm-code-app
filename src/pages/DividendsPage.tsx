import * as React from 'react';
import { useState, useMemo, useRef } from 'react';
import { PageHeader, Spinner } from '../components/Shared';
import { Sheet, ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, SelectField, DateField, LookupField } from '../components/FormFields';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover,
  DateRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getNumberFilter, getDateFilter,
  setTextFilter, setMultiFilter, setNumberFilter, setDateFilter, matchDateRange,
} from '../components/ColumnFilters';
import { SearchPill, SinglePill, MultiPill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, type RelativeDateValue } from '../components/FilterPills';
import { Plus, Upload, FileText, Download, X } from '../components/Icons';
import { dividends as mockDividends } from '../data/mock-data';
import { useDataverse } from '../services/useDataverse';
import { fetchDividends, saveDividend, removeDividend, uploadDividendFile, downloadDividendFile } from '../services/dividendService';
import { fetchBusinessUnits } from '../services/businessUnitService';
import type { BusinessUnit } from '../services/businessUnitService';
import { formatCurrency, formatDate } from '../lib/utils';
import type { Dividend } from '../types/crm';

const currencyOptions = ['EUR', 'USD', 'RON', 'GBP'];

import { useConfirm } from '../components/ConfirmDialog';

export default function DividendsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();

  // --- Data: Dataverse ---
  const { data: dividends, loading, refetch, isLive } = useDataverse(fetchDividends, mockDividends);
  const [businessUnits, setBusinessUnits] = React.useState<BusinessUnit[]>([]);
  React.useEffect(() => { fetchBusinessUnits().then(setBusinessUnits).catch(() => {}); }, []);
  const [isSaving, setIsSaving] = useState(false);

  const getBuName = (buId: string) => businessUnits.find(bu => bu.id === buId)?.name || '—';

  const buLookupOptions = useMemo(() =>
    businessUnits.map(bu => ({ value: bu.id, label: bu.name })),
  [businessUnits]);

  const [countryFilter, setCountryFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<string[]>([]);
  const [paymentDateFilter, setPaymentDateFilter] = useState<RelativeDateValue>({ type: 'all' });
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedDividend, setSelectedDividend] = useState<Dividend | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openForm = (dividend: Dividend) => {
    setIsNew(false);
    setSelectedDividend(dividend);
    setFormData({
      name: dividend.name || '',
      entityId: dividend.entityId,
      currencyCode: dividend.currencyCode,
      amount: dividend.amount,
      taxWithheld: dividend.taxWithheld,
      paymentDate: dividend.paymentDate,
      fileName: dividend.fileName || '',
    });
    setPendingFile(null);
  };

  const openNewForm = () => {
    setIsNew(true);
    setSelectedDividend({} as Dividend);
    setFormData({
      name: '(auto-generated)',
      entityId: businessUnits[0]?.id || '',
      currencyCode: 'EUR',
      amount: '',
      taxWithheld: '',
      paymentDate: '',
      fileName: '',
    });
    setPendingFile(null);
  };

  const closeForm = () => {
    setSelectedDividend(null);
    setIsNew(false);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setFormData(prev => ({ ...prev, fileName: file.name }));
    }
  };

  const clearFile = () => {
    setPendingFile(null);
    setFormData(prev => ({ ...prev, fileName: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async () => {
    const id = selectedDividend?.id;
    if (!id || !formData.fileName) return;
    try {
      await downloadDividendFile(id, formData.fileName);
    } catch (err: any) {
      console.error('Download failed:', err);
      toast.error(err?.message || 'Download failed');
    }
  };

  const saveForm = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const recordId = await saveDividend(formData, isNew ? undefined : selectedDividend?.id);
      if (pendingFile && recordId) {
        try {
          await uploadDividendFile(recordId, pendingFile);
        } catch (err: any) {
          console.error('Upload failed:', err);
          toast.error(err?.message || 'File upload failed');
          return;
        }
      }
      toast.success(isNew ? 'Dividend created' : 'Dividend saved');
      closeForm();
      await refetch();
    } catch (err: any) {
      console.error('Save failed:', err);
      toast.error(err?.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };
  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const filtered = useMemo(() => {
    const range = dateRangeFor(paymentDateFilter);
    return dividends.filter(d => {
      if (countryFilter === '__unassigned__') {
        if (businessUnits.find(bu => bu.id === d.entityId)) return false;
      } else if (countryFilter && d.entityId !== countryFilter) return false;
      if (currencyFilter.length > 0 && !currencyFilter.includes(d.currencyCode)) return false;
      if (paymentDateFilter.type !== 'all' && !matchDateRange(d.paymentDate, range.from, range.to)) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const country = getBuName(d.entityId) || '';
        if (!(d.name || '').toLowerCase().includes(q) && !country.toLowerCase().includes(q)) return false;
      }
      const nameCol = getTextFilter(colFilters, 'name');
      if (nameCol && !(d.name || '').toLowerCase().includes(nameCol.toLowerCase())) return false;
      const currCol = getMultiFilter(colFilters, 'currency');
      if (currCol.length > 0 && !currCol.includes(d.currencyCode)) return false;
      const amountRange = getNumberFilter(colFilters, 'amount');
      if (amountRange.min && d.amount < Number(amountRange.min)) return false;
      if (amountRange.max && d.amount > Number(amountRange.max)) return false;
      const dateRange = getDateFilter(colFilters, 'date');
      if (!matchDateRange(d.paymentDate, dateRange.from, dateRange.to)) return false;
      return true;
    });
  }, [dividends, countryFilter, searchTerm, currencyFilter, paymentDateFilter, colFilters, businessUnits]);

  const hasActiveFilters = !!searchTerm || !!countryFilter || currencyFilter.length > 0 || paymentDateFilter.type !== 'all';

  const uniqueCurrencies = useMemo(() => [...new Set(dividends.map(d => d.currencyCode))].sort(), [dividends]);

  const filteredIds = filtered.map(d => d.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  return (
    <div>
      <HeaderSelectionBar
        count={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        entityLabel="dividends"
        showActivate={false}
        showDeactivate={false}
        showDelete={true}
        onDelete={async () => {
          const ids = [...selectedIds];
          const ok = await confirm({ title: 'Delete dividend(s)', description: `Are you sure you want to delete ${ids.length} selected dividend(s)? This action cannot be undone.` });
          if (!ok) return;
          try {
            for (const id of ids) await removeDividend(id);
            toast.success(`${ids.length} dividend(s) deleted`);
            setSelectedIds([]);
            await refetch();
          } catch (err: any) { toast.error('Delete failed'); }
        }}
      />
      <PageHeader title="Dividends" subtitle={loading ? 'Loading...' : `${filtered.length} of ${dividends.length} dividends${isLive ? '' : ' (mock data)'}`}
        action={<div className="csp-flex-gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <button className="csp-btn csp-btn-primary" onClick={openNewForm}><Plus className="csp-icon-inline" />Add Dividend</button>
        </div>} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search name, country..." />
          <SinglePill label="Country" value={countryFilter} onChange={setCountryFilter}
            options={[
              ...businessUnits.map(bu => ({ value: bu.id, label: bu.name, count: dividends.filter(d => d.entityId === bu.id).length })),
              ...(dividends.filter(d => !businessUnits.find(bu => bu.id === d.entityId)).length > 0
                ? [{ value: '__unassigned__', label: 'Unassigned', count: dividends.filter(d => !businessUnits.find(bu => bu.id === d.entityId)).length }]
                : []),
            ]} />
          <MultiPill label="Currency" values={currencyFilter} onChange={setCurrencyFilter}
            options={uniqueCurrencies.map(c => ({ value: c, label: c, count: dividends.filter(d => d.currencyCode === c).length }))} />
          <DatePill label="Payment Date" value={paymentDateFilter} onChange={setPaymentDateFilter} dates={dividends.map(d => d.paymentDate).filter(Boolean) as string[]} />
        </div>
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {countryFilter && <FilterChip label={`Country: ${countryFilter === '__unassigned__' ? 'Unassigned' : (businessUnits.find(b => b.id === countryFilter)?.name || countryFilter)}`} onRemove={() => setCountryFilter('')} />}
            {currencyFilter.length > 0 && <FilterChip label={`Currency: ${currencyFilter.join(', ')}`} onRemove={() => setCurrencyFilter([])} />}
            {paymentDateFilter.type !== 'all' && <FilterChip label={`Payment Date: ${relativeDateLabel(paymentDateFilter)}`} onRemove={() => setPaymentDateFilter({ type: 'all' })} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setSearchTerm(''); setCountryFilter(''); setCurrencyFilter([]); setPaymentDateFilter({ type: 'all' }); }}>Clear all</button>
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="csp-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 32, padding: '10px 8px' }}><Checkbox checked={allSelected} onChange={toggleAll} /></th>
              <th style={{ padding: '10px 12px' }}>Name</th>
              <th style={{ padding: '10px 12px' }}>Country</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>
                Amount
                <NumberRangeFilterPopover label="Amount" min={getNumberFilter(colFilters, 'amount').min} max={getNumberFilter(colFilters, 'amount').max} onChange={(min, max) => setNumberFilter(setColFilters, 'amount', min, max)} />
              </th>
              <th style={{ padding: '10px 12px' }}>
                Currency
                <MultiSelectFilterPopover label="Currency" options={uniqueCurrencies} selected={getMultiFilter(colFilters, 'currency')} onChange={v => setMultiFilter(setColFilters, 'currency', v)} />
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tax Withheld</th>
              <th style={{ padding: '10px 12px' }}>
                Payment Date
                <DateRangeFilterPopover label="Payment Date" from={getDateFilter(colFilters, 'date').from} to={getDateFilter(colFilters, 'date').to} onChange={(from, to) => setDateFilter(setColFilters, 'date', from, to)} />
              </th>
              <th style={{ padding: '10px 12px' }}>Document</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="csp-text-center csp-text-muted" style={{ padding: '24px 12px' }}>No dividends match the current filters.</td></tr>
            ) : filtered.map(dividend => (
              <tr key={dividend.id} className="csp-tr-clickable" onClick={() => openForm(dividend)}>
                <td style={{ width: 32, padding: '10px 8px' }} onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(dividend.id)} onChange={c => toggleOne(dividend.id, c)} /></td>
                <td style={{ padding: '10px 12px' }}>{dividend.name || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{getBuName(dividend.entityId)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(dividend.amount, dividend.currencyCode)}</td>
                <td style={{ padding: '10px 12px' }}>{dividend.currencyCode}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(dividend.taxWithheld, dividend.currencyCode)}</td>
                <td style={{ padding: '10px 12px' }}>{formatDate(dividend.paymentDate)}</td>
                <td style={{ padding: '10px 12px' }}>{dividend.fileName || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selectedDividend} onClose={closeForm} width="560px">
        {selectedDividend && (
          <>
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

            <div className="csp-sheet-header">
              <div className="csp-sheet-title">
                {isNew ? 'New Dividend' : 'Edit Dividend'}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: 12 }}>General</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <TextField label="Name" value={formData.name} onChange={() => {}} readOnly />
                <LookupField label="Country" value={formData.entityId} onChange={v => updateField('entityId', v)} required options={buLookupOptions} />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: 12 }}>Financials</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <TextField label="Amount" value={formData.amount} onChange={v => updateField('amount', v)} type="number" placeholder="0.00" required />
                <SelectField label="Currency" value={formData.currencyCode} onChange={v => updateField('currencyCode', v)} required options={currencyOptions.map(c => ({ value: c, label: c }))} />
                <TextField label="Tax Withheld" value={formData.taxWithheld} onChange={v => updateField('taxWithheld', v)} type="number" placeholder="0.00" />
                <DateField label="Payment Date" value={formData.paymentDate} onChange={v => updateField('paymentDate', v)} required />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: 12 }}>Document</div>
              <input ref={fileInputRef} type="file" style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={handleFileSelect} />
              {formData.fileName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', background: 'hsl(var(--muted) / 0.3)', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                  <FileText className="csp-icon-sm csp-text-muted" />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formData.fileName}</span>
                  {!isNew && !pendingFile && selectedDividend?.id && (
                    <button className="csp-btn csp-btn-ghost csp-btn-icon-sm" onClick={handleDownload} title="Download">
                      <Download className="csp-icon-sm" />
                    </button>
                  )}
                  <button onClick={clearFile} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }} title="Remove">
                    <X className="csp-icon-sm" />
                  </button>
                </div>
              ) : (
                <div
                  className="csp-dividend-upload"
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  style={{ padding: '40px 24px' }}
                >
                  <Upload className="csp-icon-lg" />
                  <div className="csp-dividend-upload-primary">Click to upload AGA document</div>
                  <div className="csp-dividend-upload-secondary">PDF files only</div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid hsl(var(--border))', paddingTop: 16, marginTop: 24 }}>
              <button className="csp-btn csp-btn-outline" onClick={closeForm}>Close</button>
              <button className="csp-btn csp-btn-primary" disabled={isSaving} onClick={saveForm}>
                {isSaving ? <><Spinner size="sm" /> Saving...</> : 'Save'}
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
