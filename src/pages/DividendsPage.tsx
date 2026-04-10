import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader } from '../components/Shared';
import { Sheet, ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, SelectField, DateField, LookupField } from '../components/FormFields';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover,
  DateRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getNumberFilter, getDateFilter,
  setTextFilter, setMultiFilter, setNumberFilter, setDateFilter, matchDateRange,
} from '../components/ColumnFilters';
import { Plus } from '../components/Icons';
import { dividends, entities, contacts, getEntityById, getContactById } from '../data/mock-data';
import { formatCurrency, formatDate } from '../lib/utils';
import type { Dividend } from '../types/crm';

const currencyOptions = ['EUR', 'USD', 'RON', 'GBP'];
const countryOptions = entities.map(e => ({ id: e.id, label: e.country }));
const contactLookupOptions = contacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }));
const entityLookupOptions = entities.map(e => ({ value: e.id, label: e.country }));
const uniqueCurrencies = [...new Set(dividends.map(d => d.currencyCode))].sort();

export default function DividendsPage() {
  const { toast } = useToast();
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedDividend, setSelectedDividend] = useState<Dividend | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const openForm = (dividend: Dividend) => {
    setIsNew(false);
    setSelectedDividend(dividend);
    setFormData({
      entityId: dividend.entityId,
      contactId: dividend.contactId || '',
      currencyCode: dividend.currencyCode,
      amount: dividend.amount,
      taxWithheld: dividend.taxWithheld,
      netAmount: dividend.netAmount,
      paymentDate: dividend.paymentDate,
    });
  };

  const openNewForm = () => {
    setIsNew(true);
    setSelectedDividend({} as Dividend);
    setFormData({
      entityId: entities[0]?.id || '',
      contactId: '',
      currencyCode: 'EUR',
      amount: 0,
      taxWithheld: 0,
      netAmount: 0,
      paymentDate: '',
    });
  };

  const closeForm = () => { setSelectedDividend(null); setIsNew(false); };
  const saveForm = () => { toast.success(isNew ? 'Dividend created' : 'Dividend saved'); closeForm(); };
  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const filtered = useMemo(() => {
    return dividends.filter(d => {
      if (countryFilter && d.entityId !== countryFilter) return false;
      const recipientText = getTextFilter(colFilters, 'recipient');
      if (recipientText) {
        const contact = getContactById(d.contactId || '');
        const name = contact ? `${contact.firstName} ${contact.lastName}` : '';
        if (!name.toLowerCase().includes(recipientText.toLowerCase())) return false;
      }
      const currCol = getMultiFilter(colFilters, 'currency');
      if (currCol.length > 0 && !currCol.includes(d.currencyCode)) return false;
      const amountRange = getNumberFilter(colFilters, 'amount');
      if (amountRange.min && d.amount < Number(amountRange.min)) return false;
      if (amountRange.max && d.amount > Number(amountRange.max)) return false;
      const dateRange = getDateFilter(colFilters, 'date');
      if (!matchDateRange(d.paymentDate, dateRange.from, dateRange.to)) return false;
      return true;
    });
  }, [countryFilter, colFilters]);

  const filteredIds = filtered.map(d => d.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="dividends" showActivate={false} showDeactivate={false} />
      <PageHeader title="Dividends" subtitle={`${filtered.length} of ${dividends.length} dividends`}
        action={<div className="csp-flex-gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <button className="csp-btn csp-btn-primary" onClick={openNewForm}><Plus className="csp-icon-inline" />Add Dividend</button>
        </div>} />

      <div className="csp-filter-bar">
        <div className="csp-filter-group">
          <span className="csp-filter-group-label">Country</span>
          <ToggleGroup value={countryFilter} onChange={setCountryFilter}>
            <ToggleGroupItem value="">All</ToggleGroupItem>
            {countryOptions.map(e => (
              <ToggleGroupItem key={e.id} value={e.id}>{e.label}<span className="csp-toggle-count">{dividends.filter(d => d.entityId === e.id).length}</span></ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <div className="csp-table-wrapper">
        <table className="csp-table">
          <thead>
            <tr>
              <th className="csp-th-checkbox"><Checkbox checked={allSelected} onChange={toggleAll} /></th>
              <th>Country</th>
              <th>Recipient <TextFilterPopover label="Recipient" value={getTextFilter(colFilters, 'recipient')} onChange={v => setTextFilter(setColFilters, 'recipient', v)} /></th>
              <th>Amount <NumberRangeFilterPopover label="Amount" min={getNumberFilter(colFilters, 'amount').min} max={getNumberFilter(colFilters, 'amount').max} onChange={(min, max) => setNumberFilter(setColFilters, 'amount', min, max)} /></th>
              <th>Currency <MultiSelectFilterPopover label="Currency" options={uniqueCurrencies} selected={getMultiFilter(colFilters, 'currency')} onChange={v => setMultiFilter(setColFilters, 'currency', v)} /></th>
              <th>Tax Withheld</th>
              <th>Net Amount</th>
              <th>Date <DateRangeFilterPopover label="Date" from={getDateFilter(colFilters, 'date').from} to={getDateFilter(colFilters, 'date').to} onChange={(from, to) => setDateFilter(setColFilters, 'date', from, to)} /></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="csp-td-empty">No dividends match the current filters.</td></tr>
            ) : filtered.map(dividend => {
              const entity = getEntityById(dividend.entityId);
              const contact = getContactById(dividend.contactId || '');
              const recipientName = contact ? `${contact.firstName} ${contact.lastName}` : '\u2014';
              return (
                <tr key={dividend.id} className="csp-tr-clickable">
                  <td onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(dividend.id)} onChange={c => toggleOne(dividend.id, c)} /></td>
                  <td onClick={() => openForm(dividend)}>{entity?.country || '\u2014'}</td>
                  <td onClick={() => openForm(dividend)}>{recipientName}</td>
                  <td onClick={() => openForm(dividend)}>{formatCurrency(dividend.amount, dividend.currencyCode)}</td>
                  <td onClick={() => openForm(dividend)}>{dividend.currencyCode}</td>
                  <td onClick={() => openForm(dividend)}>{formatCurrency(dividend.taxWithheld, dividend.currencyCode)}</td>
                  <td onClick={() => openForm(dividend)}>{formatCurrency(dividend.netAmount, dividend.currencyCode)}</td>
                  <td onClick={() => openForm(dividend)}>{formatDate(dividend.paymentDate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selectedDividend} onClose={closeForm} width="32rem">
        {selectedDividend && (
          <>
            <div className="csp-sheet-header">
              <div className="csp-sheet-title">
                {isNew ? 'New Dividend' : 'Edit Dividend'}
              </div>
            </div>
            <div className="csp-form-grid-2">
              <LookupField label="Country" value={formData.entityId} onChange={v => updateField('entityId', v)} required options={entityLookupOptions} />
              <LookupField label="Recipient" value={formData.contactId} onChange={v => updateField('contactId', v)} options={contactLookupOptions} />
              <SelectField label="Currency" value={formData.currencyCode} onChange={v => updateField('currencyCode', v)} required options={currencyOptions.map(c => ({ value: c, label: c }))} />
              <TextField label="Gross Amount" value={formData.amount} onChange={v => updateField('amount', v)} />
              <TextField label="Tax Withheld" value={formData.taxWithheld} onChange={v => updateField('taxWithheld', v)} />
              <TextField label="Net Amount" value={formData.netAmount} onChange={v => updateField('netAmount', v)} />
              <DateField label="Payment Date" value={formData.paymentDate} onChange={v => updateField('paymentDate', v)} className="csp-col-span-2" />
            </div>
            <div className="csp-form-footer">
              <button className="csp-btn csp-btn-outline" onClick={closeForm}>Close</button>
              <button className="csp-btn csp-btn-primary" onClick={saveForm}>Save</button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
