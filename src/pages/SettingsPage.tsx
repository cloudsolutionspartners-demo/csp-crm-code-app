import * as React from 'react';
import { useState, useEffect } from 'react';
import { PageHeader, PageLoading } from '../components/Shared';
import { Tabs, Dialog, Sheet, useToast } from '../components/Layout';
import { TextField, TextAreaField, SelectField, DateField } from '../components/FormFields';
import { Plus, Pencil } from '../components/Icons';
import { fetchBusinessUnits, updateBusinessUnit } from '../services/businessUnitService';
import type { BusinessUnit } from '../services/businessUnitService';
import { fetchPublicHolidays, savePublicHoliday, removePublicHoliday } from '../services/publicHolidayService';
import { fetchUnitsOfMeasure, saveUnitOfMeasure, removeUnitOfMeasure } from '../services/unitOfMeasureService';
import { fetchExchangeRates, saveExchangeRate, removeExchangeRate } from '../services/exchangeRateService';
import { formatDate } from '../lib/utils';
import type { BusinessEntity, PublicHoliday, ExchangeRate, Country } from '../types/crm';

// ===== Units of Measure (local mutable list with name + description) =====
interface UomItem {
  id: string;
  name: string;
  description: string;
}

const initialUomList: UomItem[] = [
  { id: 'uom-1', name: 'Day', description: 'Daily rate' },
  { id: 'uom-2', name: 'Hour', description: 'Hourly rate' },
  { id: 'uom-3', name: 'Month', description: 'Monthly rate' },
  { id: 'uom-4', name: 'Fixed', description: 'Fixed price' },
];

const countryOptions = [
  { value: 'Romania', label: 'Romania' },
  { value: 'Bulgaria', label: 'Bulgaria' },
  { value: 'US', label: 'US' },
];

const currencyOptions = [
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'GBP', label: 'GBP' },
  { value: 'RON', label: 'RON' },
];

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'hsl(var(--primary))',
  borderBottom: '1px solid hsl(var(--border))',
  paddingBottom: 4,
  marginBottom: 12,
  marginTop: 16,
};

function DetailField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="csp-text-muted">{label}</span>
      <p>{value || <span className="csp-text-muted" style={{ fontStyle: 'italic' }}>Not set</span>}</p>
    </div>
  );
}

function buFromBusinessUnit(bu: BusinessUnit): BusinessEntity {
  const country: Country = (['Romania', 'Bulgaria', 'US', 'UK'] as Country[]).includes(bu.name as Country)
    ? (bu.name as Country)
    : 'Romania';
  const r = bu.raw || {};

  if (country === 'Bulgaria') {
    return {
      id: bu.id,
      name: r.csp_bglegalname || bu.name,
      shortName: bu.name,
      country,
      baseCurrencyCode: 'EUR',
      vatNumber: r.csp_bgvatnumber || '',
      registrationNumber: '',
      address: r.csp_bgaddress || '',
      email: r.csp_bgemail || '',
      phone: r.csp_bgphone || '',
      accountantEmail: r.csp_bgaccountantemail || '',
      bankName: r.csp_bgeubankname || '',
      iban: r.csp_bgeuiban || '',
      swift: r.csp_bgeuswiftbic || '',
      ukBankName: r.csp_bgukbankname || '',
      ukAccountNumber: r.csp_bgukaccountnumber || '',
      ukSortCode: r.csp_bguksortcode || '',
      ukIban: r.csp_bgukiban || '',
      ukSwift: r.csp_bgukswiftbic || '',
      ukIntermediaryBic: r.csp_bgukintermediarybic || '',
      invoicePrefix: '',
      invoiceFooter: r.csp_bginvoicefooter || '',
    } as BusinessEntity;
  }

  if (country === 'US') {
    return {
      id: bu.id,
      name: r.csp_uslegalname || bu.name,
      shortName: bu.name,
      country,
      baseCurrencyCode: 'USD',
      vatNumber: r.csp_usvatnumber || '',
      registrationNumber: '',
      address: r.csp_usaddress || '',
      email: r.csp_usemail || '',
      phone: r.csp_usphone || '',
      accountantEmail: r.csp_usaccountantemail || '',
      bankName: r.csp_usbankname || '',
      iban: '',
      swift: '',
      usAccountNumber: r.csp_usaccountnumber || '',
      usAchRoutingNumber: r.csp_usachroutingnumber || '',
      usWireRoutingNumber: r.csp_uswireroutingnumber || '',
      invoicePrefix: '',
      invoiceFooter: r.csp_usinvoicefooter || '',
    } as BusinessEntity;
  }

  // Romania (default)
  return {
    id: bu.id,
    name: r.csp_rolegalname || bu.name,
    shortName: bu.name,
    country,
    baseCurrencyCode: 'EUR',
    vatNumber: r.csp_rovatnumber || '',
    registrationNumber: '',
    address: r.csp_roaddress || '',
    email: r.csp_roemail || '',
    phone: r.csp_rophone || '',
    accountantEmail: r.csp_roaccountantemail || '',
    bankName: r.csp_robankname || '',
    iban: r.csp_roiban || '',
    swift: r.csp_roswiftbic || '',
    invoicePrefix: '',
    invoiceFooter: r.csp_roinvoicefooter || '',
  } as BusinessEntity;
}

import { useConfirm } from '../components/ConfirmDialog';

type BuCountryCode = 'RO' | 'BG' | 'US';

function countryToCode(country: string): BuCountryCode | null {
  if (country === 'Romania') return 'RO';
  if (country === 'Bulgaria') return 'BG';
  if (country === 'US') return 'US';
  return null;
}

/**
 * Build the OData PATCH payload for a Business Unit update.
 * Each country has different csp_* columns in Dataverse; we explicitly map
 * only what exists per the verified schema. Fields with no target column
 * are silently dropped (e.g. iban/swift on US — schema has no csp_usiban).
 */
function buildBuPayload(country: BuCountryCode, form: Record<string, string>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const nullable = (v: string | undefined | null) => (v && String(v).trim() !== '' ? String(v).trim() : null);

  if (country === 'RO') {
    payload.csp_rolegalname = nullable(form.name);
    payload.csp_rovatnumber = nullable(form.vatNumber);
    payload.csp_roaddress = nullable(form.address);
    payload.csp_rophone = nullable(form.phone);
    payload.csp_roemail = nullable(form.email);
    payload.csp_roaccountantemail = nullable(form.accountantEmail);
    payload.csp_robankname = nullable(form.bankName);
    payload.csp_roiban = nullable(form.iban);
    payload.csp_roswiftbic = nullable(form.swift);
    payload.csp_roinvoicefooter = nullable(form.invoiceFooter);
    // No intermediaryBic column for RO — skip
  } else if (country === 'BG') {
    payload.csp_bglegalname = nullable(form.name);
    payload.csp_bgvatnumber = nullable(form.vatNumber);
    payload.csp_bgaddress = nullable(form.address);
    payload.csp_bgphone = nullable(form.phone);
    payload.csp_bgemail = nullable(form.email);
    payload.csp_bgaccountantemail = nullable(form.accountantEmail);
    payload.csp_bginvoicefooter = nullable(form.invoiceFooter);
    // BG EU bank (the "always" bank fields)
    payload.csp_bgeubankname = nullable(form.bankName);
    payload.csp_bgeuiban = nullable(form.iban);
    payload.csp_bgeuswiftbic = nullable(form.swift);
    // BG UK secondary bank
    payload.csp_bgukbankname = nullable(form.ukBankName);
    payload.csp_bgukiban = nullable(form.ukIban);
    payload.csp_bgukswiftbic = nullable(form.ukSwift);
    payload.csp_bgukaccountnumber = nullable(form.ukAccountNumber);
    payload.csp_bguksortcode = nullable(form.ukSortCode);
    payload.csp_bgukintermediarybic = nullable(form.ukIntermediaryBic);
  } else if (country === 'US') {
    payload.csp_uslegalname = nullable(form.name);
    payload.csp_usvatnumber = nullable(form.vatNumber);
    payload.csp_usaddress = nullable(form.address);
    payload.csp_usphone = nullable(form.phone);
    payload.csp_usemail = nullable(form.email);
    payload.csp_usaccountantemail = nullable(form.accountantEmail);
    payload.csp_usinvoicefooter = nullable(form.invoiceFooter);
    // US uses bankName + ACH/Wire — no IBAN, no SWIFT, no intermediaryBIC in schema
    payload.csp_usbankname = nullable(form.bankName);
    payload.csp_usaccountnumber = nullable(form.usAccountNumber);
    payload.csp_usachroutingnumber = nullable(form.usAchRoutingNumber);
    payload.csp_uswireroutingnumber = nullable(form.usWireRoutingNumber);
    // form.iban / form.swift / form.intermediaryBic — SILENTLY DROPPED for US.
  } else {
    throw new Error(`buildBuPayload: unknown country "${country}"`);
  }

  return payload;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('countries');
  const [loading, setLoading] = useState(true);

  // ===== Country entity (Business Unit) state =====
  const [entities, setEntities] = useState<BusinessEntity[]>([]);
  const [editEntity, setEditEntity] = useState<BusinessEntity | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  // ===== Holiday state =====
  const [holidaysList, setHolidaysList] = useState<PublicHoliday[]>([]);
  const [editHoliday, setEditHoliday] = useState<PublicHoliday | null>(null);
  const [isNewHoliday, setIsNewHoliday] = useState(false);
  const [holidayForm, setHolidayForm] = useState<Record<string, string>>({});
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);

  // ===== UoM state =====
  const [uomList, setUomList] = useState<UomItem[]>([]);
  const [editUom, setEditUom] = useState<UomItem | null>(null);
  const [isNewUom, setIsNewUom] = useState(false);
  const [uomForm, setUomForm] = useState<Record<string, string>>({});
  const [isSavingUom, setIsSavingUom] = useState(false);

  // ===== Exchange Rate state =====
  const [ratesList, setRatesList] = useState<ExchangeRate[]>([]);
  const [editRate, setEditRate] = useState<ExchangeRate | null>(null);
  const [isNewRate, setIsNewRate] = useState(false);
  const [rateForm, setRateForm] = useState<Record<string, string>>({});
  const [isSavingRate, setIsSavingRate] = useState(false);

  // ===== Fetch from Dataverse on mount =====
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [bus, holidays, uoms, rates] = await Promise.all([
          fetchBusinessUnits().catch(() => []),
          fetchPublicHolidays().catch(() => []),
          fetchUnitsOfMeasure().catch(() => []),
          fetchExchangeRates().catch(() => []),
        ]);
        if (cancelled) return;
        // Hide the root org BU; show only country-level BUs.
        setEntities(bus.filter(b => !b.isRoot).map(buFromBusinessUnit));
        setHolidaysList(holidays);
        setUomList(uoms.map(r => ({ id: r.id, name: r.name, description: '' })));
        setRatesList(rates);
      } catch (err) {
        console.error('[Settings] Failed to load:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const tabs = [
    { id: 'countries', label: 'Countries' },
    { id: 'holidays', label: 'Public Holidays' },
    { id: 'uom', label: 'Units of Measure' },
    { id: 'rates', label: 'Exchange Rates' },
  ];

  // ===== Entity helpers =====
  const openEdit = (e: BusinessEntity) => {
    setEditEntity(e);
    const f: Record<string, string> = {
      name: e.name,
      shortName: e.shortName,
      vatNumber: e.vatNumber,
      registrationNumber: e.registrationNumber,
      address: e.address,
      phone: e.phone || '',
      email: e.email || '',
      accountantEmail: e.accountantEmail || '',
      bankName: e.bankName,
      iban: e.iban,
      swift: e.swift,
      intermediaryBic: e.intermediaryBic || '',
      invoicePrefix: e.invoicePrefix,
      invoiceFooter: e.invoiceFooter,
    };
    if (e.country === 'Bulgaria') {
      f.ukBankName = e.ukBankName || '';
      f.ukAccountNumber = e.ukAccountNumber || '';
      f.ukSortCode = e.ukSortCode || '';
      f.ukIban = e.ukIban || '';
      f.ukSwift = e.ukSwift || '';
      f.ukIntermediaryBic = e.ukIntermediaryBic || '';
    }
    if (e.country === 'US') {
      f.usAccountNumber = e.usAccountNumber || '';
      f.usAchRoutingNumber = e.usAchRoutingNumber || '';
      f.usWireRoutingNumber = e.usWireRoutingNumber || '';
    }
    setForm(f);
  };

  const updateField = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const saveEntity = async () => {
    console.log('[SettingsBU] Save clicked');
    console.log('[SettingsBU] editEntity BEFORE save:', JSON.stringify(editEntity, null, 2));
    console.log('[SettingsBU] form BEFORE save:', JSON.stringify(form, null, 2));
    if (!editEntity) {
      console.warn('[SettingsBU] aborting: editEntity is null');
      return;
    }
    const country = editEntity.country;
    const code = countryToCode(country);
    console.log('[SettingsBU] country:', country, 'code:', code);
    if (!code) {
      console.error('[SettingsBU] aborting: unsupported country', country);
      toast.error(`Unsupported country: ${country}`);
      return;
    }

    if (code === 'US' && (form.iban?.trim() || form.swift?.trim() || form.intermediaryBic?.trim())) {
      console.warn('[SettingsBU] US does not support IBAN/SWIFT/IntermediaryBIC — these values will not be saved.');
      toast.error("US business unit doesn't use IBAN/SWIFT; only Bank Name / Account / ACH / Wire fields will be saved.");
    }

    const record = buildBuPayload(code, form);

    console.log('[SettingsBU] OData payload:', JSON.stringify(record, null, 2));
    console.log('[SettingsBU] target table: businessunits');
    console.log('[SettingsBU] target record id:', editEntity.id);

    try {
      const result = await updateBusinessUnit(editEntity.id, record);
      console.log('[SettingsBU] SUCCESS — updateBusinessUnit returned:', result);
      console.log('[SettingsBU] reading back after save...');
      const bus = await fetchBusinessUnits();
      const saved = bus.find(b => b.id === editEntity.id);
      console.log('[SettingsBU] readback — full BU record:', JSON.stringify(saved, null, 2));
      if (saved) {
        const keysOfInterest = Object.keys(record);
        const readbackValues: Record<string, unknown> = {};
        keysOfInterest.forEach(k => { readbackValues[k] = saved.raw?.[k]; });
        console.log('[SettingsBU] readback — fields we just wrote:', JSON.stringify(readbackValues, null, 2));
      } else {
        console.warn('[SettingsBU] readback — could not find BU with id', editEntity.id);
      }
      toast.success(`${country} entity saved to Dataverse`);
      setEntities(bus.filter(b => !b.isRoot).map(buFromBusinessUnit));
      setEditEntity(null);
    } catch (err: any) {
      console.error('[SettingsBU] ERROR:', err);
      console.error('[SettingsBU] err.message:', err?.message);
      console.error('[SettingsBU] err.response:', err?.response);
      console.error('[SettingsBU] err.status:', err?.status, 'err.statusCode:', err?.statusCode);
      try { console.error('[SettingsBU] err JSON:', JSON.stringify(err, Object.getOwnPropertyNames(err))); } catch {}
      toast.error(err?.message || 'Failed to save');
    }
  };

  // ===== Holiday helpers =====
  const openNewHoliday = () => {
    setIsNewHoliday(true);
    setEditHoliday(null);
    setHolidayForm({ name: '', date: '', country: 'Romania', year: new Date().getFullYear().toString() });
  };
  const openEditHoliday = (h: PublicHoliday) => {
    setIsNewHoliday(false);
    setEditHoliday(h);
    setHolidayForm({ name: h.name, date: h.date, country: h.country, year: h.year.toString() });
  };
  const updateHolidayField = (k: string, v: string) => setHolidayForm(p => ({ ...p, [k]: v }));
  const saveHoliday = async () => {
    if (isSavingHoliday) return;
    if (!holidayForm.name || !holidayForm.date) {
      toast.error('Name and Date are required');
      return;
    }
    setIsSavingHoliday(true);
    try {
      await savePublicHoliday({ name: holidayForm.name, date: holidayForm.date }, isNewHoliday ? undefined : editHoliday?.id);
      toast.success(isNewHoliday ? 'Holiday added' : 'Holiday updated');
      setEditHoliday(null); setIsNewHoliday(false);
      fetchPublicHolidays().then(setHolidaysList).catch(() => {});
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setIsSavingHoliday(false);
    }
  };
  const deleteHoliday = async () => {
    if (!editHoliday) return;
    const ok = await confirm({ title: 'Delete public holiday', description: 'Are you sure you want to delete this public holiday? This action cannot be undone.' });
    if (!ok) return;
    try {
      await removePublicHoliday(editHoliday.id);
      toast.success('Holiday deleted');
      setEditHoliday(null);
      fetchPublicHolidays().then(setHolidaysList).catch(() => {});
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    }
  };
  const holidaySheetOpen = isNewHoliday || !!editHoliday;
  const closeHolidaySheet = () => { setEditHoliday(null); setIsNewHoliday(false); };

  // ===== UoM helpers =====
  const openNewUom = () => {
    setIsNewUom(true);
    setEditUom(null);
    setUomForm({ name: '', description: '' });
  };
  const openEditUom = (u: UomItem) => {
    setIsNewUom(false);
    setEditUom(u);
    setUomForm({ name: u.name, description: u.description });
  };
  const updateUomField = (k: string, v: string) => setUomForm(p => ({ ...p, [k]: v }));
  const saveUom = async () => {
    if (isSavingUom) return;
    if (!uomForm.name?.trim()) {
      toast.error('Unit name is required');
      return;
    }
    setIsSavingUom(true);
    try {
      await saveUnitOfMeasure({ name: uomForm.name.trim() }, isNewUom ? undefined : editUom?.id);
      toast.success(isNewUom ? 'Unit added' : 'Unit updated');
      setEditUom(null); setIsNewUom(false);
      fetchUnitsOfMeasure().then(recs => setUomList(recs.map(r => ({ id: r.id, name: r.name, description: '' })))).catch(() => {});
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setIsSavingUom(false);
    }
  };
  const deleteUom = async () => {
    if (!editUom) return;
    const ok = await confirm({ title: 'Delete unit of measure', description: 'Are you sure you want to delete this unit of measure? This action cannot be undone.' });
    if (!ok) return;
    try {
      await removeUnitOfMeasure(editUom.id);
      toast.success('Unit deleted');
      setEditUom(null);
      fetchUnitsOfMeasure().then(recs => setUomList(recs.map(r => ({ id: r.id, name: r.name, description: '' })))).catch(() => {});
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    }
  };
  const uomSheetOpen = isNewUom || !!editUom;
  const closeUomSheet = () => { setEditUom(null); setIsNewUom(false); };

  // ===== Exchange Rate helpers =====
  const openNewRate = () => {
    setIsNewRate(true);
    setEditRate(null);
    setRateForm({ fromCurrencyCode: 'EUR', toCurrencyCode: 'RON', rate: '', effectiveDate: '' });
  };
  const openEditRate = (r: ExchangeRate) => {
    setIsNewRate(false);
    setEditRate(r);
    setRateForm({
      fromCurrencyCode: r.fromCurrencyCode,
      toCurrencyCode: r.toCurrencyCode,
      rate: r.rate.toString(),
      effectiveDate: r.effectiveDate,
    });
  };
  const updateRateField = (k: string, v: string) => setRateForm(p => ({ ...p, [k]: v }));
  const saveRate = async () => {
    if (isSavingRate) return;
    if (!rateForm.rate || !rateForm.effectiveDate) {
      toast.error('Rate and Effective Date are required');
      return;
    }
    setIsSavingRate(true);
    try {
      const d = new Date(rateForm.effectiveDate);
      await saveExchangeRate({
        name: `${rateForm.fromCurrencyCode}/${rateForm.toCurrencyCode}`,
        fromCurrencyCode: rateForm.fromCurrencyCode,
        toCurrencyCode: rateForm.toCurrencyCode,
        rate: rateForm.rate,
        effectiveDate: rateForm.effectiveDate,
        month: d.getMonth() + 1,
        year: d.getFullYear(),
      }, isNewRate ? undefined : editRate?.id);
      toast.success(isNewRate ? 'Exchange rate added' : 'Exchange rate updated');
      setEditRate(null); setIsNewRate(false);
      fetchExchangeRates().then(setRatesList).catch(() => {});
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setIsSavingRate(false);
    }
  };
  const deleteRate = async () => {
    if (!editRate) return;
    const ok = await confirm({ title: 'Delete exchange rate', description: 'Are you sure you want to delete this exchange rate? This action cannot be undone.' });
    if (!ok) return;
    try {
      await removeExchangeRate(editRate.id);
      toast.success('Exchange rate deleted');
      setEditRate(null);
      fetchExchangeRates().then(setRatesList).catch(() => {});
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    }
  };
  const rateSheetOpen = isNewRate || !!editRate;
  const closeRateSheet = () => { setEditRate(null); setIsNewRate(false); };

  if (loading) {
    return <PageLoading message="Loading settings..." />;
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage business configuration" />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab}>
        {/* ===== Countries Tab ===== */}
        {activeTab === 'countries' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {entities.map(e => (
              <div
                key={e.id}
                className="csp-card csp-card-clickable"
                onClick={() => openEdit(e)}
              >
                {/* Card Header */}
                <div className="csp-card-header" style={{ paddingBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 500 }}>
                    {e.country}
                    <span className="csp-badge-outline">{e.shortName}</span>
                    <span className="csp-text-muted" style={{ marginLeft: 'auto', display: 'inline-flex' }}><Pencil className="csp-icon-inline" /></span>
                  </div>
                </div>
                {/* Card Content */}
                <div className="csp-card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', fontSize: '0.875rem' }}>
                    <DetailField label="Legal Name" value={e.name} />
                    <DetailField label="Registration #" value={e.registrationNumber} />
                    <DetailField label="VAT" value={e.vatNumber} />
                    <DetailField label="Bank" value={e.bankName} />
                    <DetailField label="IBAN" value={e.iban} />
                    <DetailField label="Invoice Prefix" value={e.invoicePrefix} />
                    <DetailField label="Phone" value={e.phone} />
                    <DetailField label="Email" value={e.email} />
                    <DetailField label="Accountant Email" value={e.accountantEmail} />
                  </div>
                  {e.country === 'Bulgaria' && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid hsl(var(--border))' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--primary))', marginBottom: '0.5rem' }}>UK Bank Details</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', fontSize: '0.875rem' }}>
                        <DetailField label="Bank Name" value={e.ukBankName} />
                        <DetailField label="Account Number" value={e.ukAccountNumber} />
                        <DetailField label="Sort Code" value={e.ukSortCode} />
                        <DetailField label="IBAN" value={e.ukIban} />
                        <DetailField label="SWIFT/BIC" value={e.ukSwift} />
                        <DetailField label="Intermediary BIC" value={e.ukIntermediaryBic} />
                      </div>
                    </div>
                  )}
                  {e.country === 'US' && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid hsl(var(--border))' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--primary))', marginBottom: '0.5rem' }}>US Banking Details</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', fontSize: '0.875rem' }}>
                        <DetailField label="Account Number" value={e.usAccountNumber} />
                        <DetailField label="ACH Routing Number" value={e.usAchRoutingNumber} />
                        <DetailField label="Wire Routing Number" value={e.usWireRoutingNumber} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== Public Holidays Tab ===== */}
        {activeTab === 'holidays' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button className="csp-btn csp-btn-primary" onClick={openNewHoliday}>
                <Plus className="csp-icon-inline" /> Add Holiday
              </button>
            </div>
            <div className="csp-table-wrapper">
              <table className="csp-table">
                <thead>
                  <tr>
                    <th className="csp-th">Name</th>
                    <th className="csp-th">Date</th>
                    <th className="csp-th">Country</th>
                    <th className="csp-th">Year</th>
                  </tr>
                </thead>
                <tbody>
                  {holidaysList.map(h => (
                    <tr key={h.id} className="csp-tr csp-tr-clickable" onClick={() => openEditHoliday(h)} style={{ cursor: 'pointer' }}>
                      <td className="csp-td" style={{ fontWeight: 500 }}>{h.name}</td>
                      <td className="csp-td">{formatDate(h.date)}</td>
                      <td className="csp-td"><span className="csp-badge-outline">{h.country}</span></td>
                      <td className="csp-td">{h.year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== Units of Measure Tab ===== */}
        {activeTab === 'uom' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button className="csp-btn csp-btn-primary" onClick={openNewUom}>
                <Plus className="csp-icon-inline" /> Add Unit
              </button>
            </div>
            <div className="csp-table-wrapper" style={{ maxWidth: '36rem' }}>
              <table className="csp-table">
                <thead>
                  <tr>
                    <th className="csp-th">Unit</th>
                    <th className="csp-th">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {uomList.map(u => (
                    <tr key={u.id} className="csp-tr csp-tr-clickable" onClick={() => openEditUom(u)} style={{ cursor: 'pointer' }}>
                      <td className="csp-td" style={{ fontWeight: 500 }}>{u.name}</td>
                      <td className="csp-td">{u.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== Exchange Rates Tab ===== */}
        {activeTab === 'rates' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button className="csp-btn csp-btn-primary" onClick={openNewRate}>
                <Plus className="csp-icon-inline" /> Add Rate
              </button>
            </div>
            <div className="csp-table-wrapper">
              <table className="csp-table">
                <thead>
                  <tr>
                    <th className="csp-th">From</th>
                    <th className="csp-th">To</th>
                    <th className="csp-th">Rate</th>
                    <th className="csp-th">Effective Date</th>
                    <th className="csp-th">Period</th>
                  </tr>
                </thead>
                <tbody>
                  {ratesList.map(r => (
                    <tr key={r.id} className="csp-tr csp-tr-clickable" onClick={() => openEditRate(r)} style={{ cursor: 'pointer' }}>
                      <td className="csp-td">{r.fromCurrencyCode}</td>
                      <td className="csp-td">{r.toCurrencyCode}</td>
                      <td className="csp-td csp-text-mono">{r.rate.toFixed(4)}</td>
                      <td className="csp-td">{formatDate(r.effectiveDate)}</td>
                      <td className="csp-td">{r.month}/{r.year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Tabs>

      {/* ===== Edit Business Unit Dialog ===== */}
      <Dialog
        open={!!editEntity}
        onClose={() => setEditEntity(null)}
        title={`Edit Business Unit — ${editEntity?.country || ''}`}
        maxWidth="42rem"
      >
        {editEntity && (
          <>
            {/* General Information */}
            <div style={sectionHeadingStyle}>General Information</div>
            <div className="csp-form-grid-2" style={{ gap: '1rem 2rem' }}>
              <TextField label="Legal Name" value={form.name} onChange={v => updateField('name', v)} required />
              <TextField label="Short Name" value={form.shortName} onChange={v => updateField('shortName', v)} required />
              <TextField label="VAT Number" value={form.vatNumber} onChange={v => updateField('vatNumber', v)} required />
              <TextField label="Phone" value={form.phone} onChange={v => updateField('phone', v)} />
              <TextField label="Email" value={form.email} onChange={v => updateField('email', v)} />
              <TextField label="Accountant Email" value={form.accountantEmail} onChange={v => updateField('accountantEmail', v)} />
              <div style={{ gridColumn: 'span 2' }}>
                <TextAreaField label="Address" value={form.address} onChange={v => updateField('address', v)} required rows={2} />
              </div>
            </div>

            {/* Bank Details (EUR) */}
            <div style={sectionHeadingStyle}>Bank Details (EUR)</div>
            <div className="csp-form-grid-2" style={{ gap: '1rem 2rem' }}>
              <TextField label="Bank Name" value={form.bankName} onChange={v => updateField('bankName', v)} required />
              <TextField label="IBAN" value={form.iban} onChange={v => updateField('iban', v)} required />
              <TextField label="SWIFT/BIC" value={form.swift} onChange={v => updateField('swift', v)} required />
              <TextField label="Intermediary BIC" value={form.intermediaryBic} onChange={v => updateField('intermediaryBic', v)} />
            </div>

            {/* UK Bank Details (Bulgaria only) */}
            {editEntity.country === 'Bulgaria' && (
              <>
                <div style={sectionHeadingStyle}>UK Bank Details</div>
                <div className="csp-form-grid-2" style={{ gap: '1rem 2rem' }}>
                  <TextField label="UK Bank Name" value={form.ukBankName} onChange={v => updateField('ukBankName', v)} />
                  <TextField label="UK Account Number" value={form.ukAccountNumber} onChange={v => updateField('ukAccountNumber', v)} />
                  <TextField label="UK Sort Code" value={form.ukSortCode} onChange={v => updateField('ukSortCode', v)} />
                  <TextField label="UK IBAN" value={form.ukIban} onChange={v => updateField('ukIban', v)} />
                  <TextField label="UK SWIFT/BIC" value={form.ukSwift} onChange={v => updateField('ukSwift', v)} />
                  <TextField label="UK Intermediary BIC" value={form.ukIntermediaryBic} onChange={v => updateField('ukIntermediaryBic', v)} />
                </div>
              </>
            )}

            {/* US Banking Details (US only) */}
            {editEntity.country === 'US' && (
              <>
                <div style={sectionHeadingStyle}>US Banking Details</div>
                <div className="csp-form-grid-2" style={{ gap: '1rem 2rem' }}>
                  <TextField label="Account Number" value={form.usAccountNumber} onChange={v => updateField('usAccountNumber', v)} />
                  <TextField label="ACH Routing Number" value={form.usAchRoutingNumber} onChange={v => updateField('usAchRoutingNumber', v)} />
                  <TextField label="Wire Routing Number" value={form.usWireRoutingNumber} onChange={v => updateField('usWireRoutingNumber', v)} />
                </div>
              </>
            )}

            {/* Invoice Settings */}
            <div style={sectionHeadingStyle}>Invoice Settings</div>
            <div className="csp-form-grid-2" style={{ gap: '1rem 2rem' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <TextAreaField label="Invoice Footer" value={form.invoiceFooter} onChange={v => updateField('invoiceFooter', v)} rows={2} />
              </div>
            </div>

            <div className="csp-dialog-footer">
              <button className="csp-btn csp-btn-outline" onClick={() => setEditEntity(null)}>Cancel</button>
              <button className="csp-btn csp-btn-primary" onClick={saveEntity}>Save</button>
            </div>
          </>
        )}
      </Dialog>

      {/* ===== Holiday Sheet ===== */}
      <Sheet
        open={holidaySheetOpen}
        onClose={closeHolidaySheet}
        title={isNewHoliday ? 'New Public Holiday' : 'Edit Public Holiday'}
      >
        <div className="csp-form-grid-2">
          <TextField label="Name" value={holidayForm.name || ''} onChange={v => updateHolidayField('name', v)} required />
          <DateField label="Date" value={holidayForm.date || ''} onChange={v => {
            updateHolidayField('date', v);
            if (v) {
              const parsed = new Date(v);
              if (!isNaN(parsed.getTime())) updateHolidayField('year', parsed.getFullYear().toString());
            }
          }} required />
          <SelectField
            label="Country"
            value={holidayForm.country || 'Romania'}
            onChange={v => updateHolidayField('country', v)}
            options={countryOptions}
            required
          />
          <TextField label="Year" value={holidayForm.year || ''} onChange={v => updateHolidayField('year', v)} type="number" required />
        </div>
        <div className="csp-sheet-footer">
          {!isNewHoliday && (
            <button className="csp-btn csp-btn-destructive" onClick={deleteHoliday}>Delete</button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            <button className="csp-btn csp-btn-outline" onClick={closeHolidaySheet}>Cancel</button>
            <button className="csp-btn csp-btn-primary" onClick={saveHoliday}>Save</button>
          </div>
        </div>
      </Sheet>

      {/* ===== UoM Sheet ===== */}
      <Sheet
        open={uomSheetOpen}
        onClose={closeUomSheet}
        title={isNewUom ? 'New Unit of Measure' : 'Edit Unit of Measure'}
      >
        <div className="csp-form-grid-2">
          <TextField label="Unit Name" value={uomForm.name || ''} onChange={v => updateUomField('name', v)} required />
          <div style={{ gridColumn: 'span 2' }}>
            <TextAreaField label="Description" value={uomForm.description || ''} onChange={v => updateUomField('description', v)} rows={2} />
          </div>
        </div>
        <div className="csp-sheet-footer">
          {!isNewUom && (
            <button className="csp-btn csp-btn-destructive" onClick={deleteUom}>Delete</button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            <button className="csp-btn csp-btn-outline" onClick={closeUomSheet}>Cancel</button>
            <button className="csp-btn csp-btn-primary" onClick={saveUom}>Save</button>
          </div>
        </div>
      </Sheet>

      {/* ===== Exchange Rate Sheet ===== */}
      <Sheet
        open={rateSheetOpen}
        onClose={closeRateSheet}
        title={isNewRate ? 'New Exchange Rate' : 'Edit Exchange Rate'}
      >
        <div className="csp-form-grid-2">
          <SelectField
            label="From Currency"
            value={rateForm.fromCurrencyCode || 'EUR'}
            onChange={v => updateRateField('fromCurrencyCode', v)}
            options={currencyOptions}
            required
          />
          <SelectField
            label="To Currency"
            value={rateForm.toCurrencyCode || 'RON'}
            onChange={v => updateRateField('toCurrencyCode', v)}
            options={currencyOptions}
            required
          />
          <TextField label="Rate" value={rateForm.rate || ''} onChange={v => updateRateField('rate', v)} type="number" required />
          <DateField label="Effective Date" value={rateForm.effectiveDate || ''} onChange={v => updateRateField('effectiveDate', v)} required />
        </div>
        <div className="csp-sheet-footer">
          {!isNewRate && (
            <button className="csp-btn csp-btn-destructive" onClick={deleteRate}>Delete</button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            <button className="csp-btn csp-btn-outline" onClick={closeRateSheet}>Cancel</button>
            <button className="csp-btn csp-btn-primary" onClick={saveRate}>Save</button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
