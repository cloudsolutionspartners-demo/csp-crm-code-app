import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader, Spinner, PageLoading } from '../components/Shared';
import { Sheet, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, SelectField, LookupField } from '../components/FormFields';
import { Plus } from '../components/Icons';
import {
  ColumnFilters, TextFilterPopover, ClearColumnFiltersButton,
  getTextFilter, setTextFilter,
} from '../components/ColumnFilters';
import { SearchPill, MultiPill, FilterChip } from '../components/FilterPills';
import { paymentDetails as mockPD } from '../data/mock-data';
import { fetchAllPaymentDetails, savePaymentDetail, createPaymentDetailForAccount } from '../services/paymentDetailService';
import { fetchAccounts } from '../services/accountService';
import { useDataverse } from '../services/useDataverse';
import type { PaymentDetail, Account } from '../types/crm';

import { useConfirm } from '../components/ConfirmDialog';

export default function PaymentDetailsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data: dvPD, loading, refetch } = useDataverse(
    async () => {
      const recs = await fetchAllPaymentDetails();
      return recs.map(r => ({ id: r.id, accountId: r.accountId, currencyCode: (r.currency || 'EUR') as any, iban: r.iban, swift: r.swift, bankName: r.bankName, isPrimary: r.isPrimary } as PaymentDetail));
    },
    mockPD,
  );
  const { data: dvAccounts } = useDataverse<Account>(fetchAccounts, []);
  const accountOptions = useMemo(() => dvAccounts.map(a => ({ value: a.id, label: a.name })), [dvAccounts]);
  const getAccountName = (id: string) => dvAccounts.find(a => a.id === id)?.name || '';
  const [isSaving, setIsSaving] = useState(false);
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
    setIsNew(false); setSelected(pd);
    setFormData({
      accountId: pd.accountId || '',
      bankName: pd.bankName || '',
      iban: pd.iban,
      swift: pd.swift,
      currency: (pd as any).currencyCode || 'EUR',
      isPrimary: pd.isPrimary,
    });
  };
  const openNewForm = () => {
    setIsNew(true); setSelected({} as PaymentDetail);
    setFormData({ accountId: '', bankName: '', iban: '', swift: '', currency: 'EUR', isPrimary: false });
  };
  const closeForm = () => { setSelected(null); setIsNew(false); };
  const saveForm = async () => {
    if (isSaving) return;
    if (!formData.accountId) {
      toast.error('Account is required');
      return;
    }
    if (formData.iban) {
      const ibanRegex = /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/;
      if (!ibanRegex.test(String(formData.iban).replace(/\s/g, ''))) {
        console.warn('[PaymentDetail] IBAN format may be invalid:', formData.iban);
      }
    }
    if (formData.swift) {
      const swiftRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
      if (!swiftRegex.test(String(formData.swift).replace(/\s/g, ''))) {
        console.warn('[PaymentDetail] SWIFT format may be invalid:', formData.swift);
      }
    }
    setIsSaving(true);
    try {
      const payload = { ...formData, name: formData.bankName || formData.iban || 'Payment Detail' };
      if (isNew) {
        await createPaymentDetailForAccount(payload, formData.accountId);
      } else {
        await savePaymentDetail(payload, selected?.id);
      }
      toast.success(isNew ? 'Payment Detail created' : 'Payment Detail saved');
      closeForm();
      await refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };
  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const uniqueCurrencies = useMemo(() => Array.from(new Set(dvPD.map(pd => pd.currencyCode).filter(Boolean) as string[])).sort(), [dvPD]);

  const filtered = useMemo(() => {
    return dvPD.filter(pd => {
      if (accountFilter.length > 0 && !accountFilter.includes(pd.accountId)) return false;
      if (currencyFilter.length > 0 && !currencyFilter.includes(pd.currencyCode)) return false;
      if (primaryFilter.length > 0) {
        const v = pd.isPrimary ? 'Yes' : 'No';
        if (!primaryFilter.includes(v)) return false;
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const acc = getAccountName(pd.accountId) || '';
        if (
          !acc.toLowerCase().includes(q) &&
          !(pd.bankName || '').toLowerCase().includes(q) &&
          !pd.iban.toLowerCase().includes(q) &&
          !pd.swift.toLowerCase().includes(q)
        ) return false;
      }
      const account = getTextFilter(colFilters, 'account');
      if (account && !getAccountName(pd.accountId).toLowerCase().includes(account.toLowerCase())) return false;
      const bank = getTextFilter(colFilters, 'bankName');
      if (bank && !(pd.bankName || '').toLowerCase().includes(bank.toLowerCase())) return false;
      const iban = getTextFilter(colFilters, 'iban');
      if (iban && !pd.iban.toLowerCase().includes(iban.toLowerCase())) return false;
      const swift = getTextFilter(colFilters, 'swift');
      if (swift && !pd.swift.toLowerCase().includes(swift.toLowerCase())) return false;
      return true;
    });
  }, [dvPD, searchTerm, accountFilter, currencyFilter, primaryFilter, colFilters, dvAccounts]);

  const hasActiveFilters = !!searchTerm || accountFilter.length > 0 || currencyFilter.length > 0 || primaryFilter.length > 0;

  const muted = (val?: string) => val
    ? val
    : React.createElement('span', { style: { color: 'hsl(var(--muted-foreground))' } }, '—');

  const filteredIds = filtered.map(m => m.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  if (loading && dvPD.length === 0) return <PageLoading message="Loading payment details..." />;

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="payment details" showDelete showActivate={false} showDeactivate={false} onDelete={async () => {
        const ok = await confirm({ title: 'Delete payment detail(s)', description: `Are you sure you want to delete ${selectedIds.length} selected payment detail(s)? This action cannot be undone.` });
        if (!ok) return;
        const count = selectedIds.length;
        try {
          const { deleteRecord } = await import('../services/dataverseService');
          for (const id of selectedIds) await deleteRecord('csp_paymentdetails', id);
          toast.success(`${count} payment detail(s) deleted`);
          setSelectedIds([]);
          await refetch();
        } catch (err: any) { toast.error('Delete failed'); }
      }} />
      <PageHeader title="Payment Details" subtitle={`${filtered.length} of ${dvPD.length} payment details`}
        action={<div className="csp-flex-gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <button className="csp-btn csp-btn-primary" onClick={openNewForm}><Plus className="csp-icon-inline" />Add Payment Detail</button>
        </div>} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search account, bank, IBAN, SWIFT..." />
          <MultiPill label="Account" values={accountFilter} onChange={setAccountFilter}
            options={accountOptions.map(a => ({ value: a.value, label: a.label, count: dvPD.filter(pd => pd.accountId === a.value).length }))} />
          <MultiPill label="Currency" values={currencyFilter} onChange={setCurrencyFilter}
            options={uniqueCurrencies.map(c => ({ value: c, label: c, count: dvPD.filter(pd => pd.currencyCode === c).length }))} />
          <MultiPill label="Primary" values={primaryFilter} onChange={setPrimaryFilter}
            options={['Yes', 'No'].map(v => ({ value: v, label: v, count: dvPD.filter(pd => (pd.isPrimary ? 'Yes' : 'No') === v).length }))} />
        </div>
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {accountFilter.length > 0 && <FilterChip label={`Account: ${accountFilter.map(id => accountOptions.find(a => a.value === id)?.label).filter(Boolean).join(', ')}`} onRemove={() => setAccountFilter([])} />}
            {currencyFilter.length > 0 && <FilterChip label={`Currency: ${currencyFilter.join(', ')}`} onRemove={() => setCurrencyFilter([])} />}
            {primaryFilter.length > 0 && <FilterChip label={`Primary: ${primaryFilter.join(', ')}`} onRemove={() => setPrimaryFilter([])} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setSearchTerm(''); setAccountFilter([]); setCurrencyFilter([]); setPrimaryFilter([]); }}>Clear all</button>
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="csp-table" style={{ width: '100%' }}>
          <thead><tr>
            <th style={{ width: 32, padding: '10px 8px' }}><Checkbox checked={allSelected} onChange={toggleAll} /></th>
            <th style={{ padding: '10px 12px' }}>
              Account
              <TextFilterPopover label="Account" value={getTextFilter(colFilters, 'account')} onChange={v => setTextFilter(setColFilters, 'account', v)} />
            </th>
            <th style={{ padding: '10px 12px' }}>
              Bank Name
              <TextFilterPopover label="Bank Name" value={getTextFilter(colFilters, 'bankName')} onChange={v => setTextFilter(setColFilters, 'bankName', v)} />
            </th>
            <th style={{ padding: '10px 12px' }}>
              IBAN
              <TextFilterPopover label="IBAN" value={getTextFilter(colFilters, 'iban')} onChange={v => setTextFilter(setColFilters, 'iban', v)} />
            </th>
            <th style={{ padding: '10px 12px' }}>
              SWIFT/BIC
              <TextFilterPopover label="SWIFT/BIC" value={getTextFilter(colFilters, 'swift')} onChange={v => setTextFilter(setColFilters, 'swift', v)} />
            </th>
            <th style={{ padding: '10px 12px', textAlign: 'center' }}>Primary</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="csp-text-center csp-text-muted" style={{ padding: '24px 12px' }}>No payment details found.</td></tr>
            ) : filtered.map(pd => (
              <tr key={pd.id} className="csp-tr-clickable" onClick={() => openForm(pd)}>
                <td style={{ width: 32, padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
                  <Checkbox checked={selectedIds.includes(pd.id)} onChange={c => toggleOne(pd.id, c)} />
                </td>
                <td style={{ padding: '10px 12px' }}>{muted(getAccountName(pd.accountId))}</td>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{muted(pd.bankName)}</td>
                <td className="csp-td-mono" style={{ padding: '10px 12px' }}>{muted(pd.iban)}</td>
                <td className="csp-td-mono" style={{ padding: '10px 12px' }}>{muted(pd.swift)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  {pd.isPrimary ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: 'hsl(142 76% 36% / 0.1)', color: 'hsl(142 76% 36%)',
                      fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 6,
                    }}>Primary</span>
                  ) : (
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>{'\u2014'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selected} onClose={closeForm}>
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

        <div className="csp-sheet-header"><div className="csp-sheet-title">{isNew ? 'New Payment Detail' : 'Edit Payment Detail'}</div></div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <LookupField
            label="Account"
            value={formData.accountId || ''}
            onChange={v => updateField('accountId', v)}
            options={accountOptions}
            placeholder="Select account"
            required
          />
          <TextField label="Bank Name" value={formData.bankName} onChange={v => updateField('bankName', v)} />
          <TextField label="IBAN" value={formData.iban} onChange={v => updateField('iban', v)} required />
          <TextField label="SWIFT / BIC" value={formData.swift} onChange={v => updateField('swift', v)} required />
          <SelectField
            label="Currency"
            value={formData.currency || 'EUR'}
            onChange={v => updateField('currency', v)}
            options={[
              { value: 'EUR', label: 'EUR' },
              { value: 'GBP', label: 'GBP' },
              { value: 'USD', label: 'USD' },
              { value: 'RON', label: 'RON' },
            ]}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <input
              type="checkbox"
              checked={!!formData.isPrimary}
              onChange={e => updateField('isPrimary', e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
              id="pd-is-primary"
            />
            <label htmlFor="pd-is-primary" style={{ fontSize: 13, color: 'hsl(var(--foreground))', cursor: 'pointer' }}>Is Primary</label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid hsl(var(--border))', paddingTop: 16, marginTop: 24 }}>
          <button className="csp-btn csp-btn-outline" onClick={closeForm}>Close</button>
          <button className={`csp-btn csp-btn-primary ${isSaving ? 'csp-btn-saving' : ''}`} disabled={isSaving} onClick={saveForm}>{isSaving ? <><Spinner size="sm" /> Saving...</> : 'Save'}</button>
        </div>
      </Sheet>
    </div>
  );
}
