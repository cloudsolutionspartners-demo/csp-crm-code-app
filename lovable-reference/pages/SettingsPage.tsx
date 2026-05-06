import { useState } from 'react';
import { PageHeader, SectionHeading } from '@/components/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, Pencil } from 'lucide-react';
import { entities, publicHolidays, exchangeRates } from '@/data/mock-data';
import { formatDate } from '@/lib/format';
import { TextField, TextAreaField, SelectField, DateField } from '@/components/FormField';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';
import type { BusinessEntity, PublicHoliday, ExchangeRate, Country, CurrencyCode } from '@/types/crm';

// ===== Units of Measure (mutable array) =====
const unitsOfMeasureList = ['Day', 'Hour', 'Month', 'Fixed'];

const countryOptions = ['Romania', 'Bulgaria', 'US'];
const currencyOptions = ['EUR', 'USD', 'GBP', 'RON'];

function DetailField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <p className="text-sm">{value || <span className="text-muted-foreground italic">Not set</span>}</p>
    </div>
  );
}

export default function SettingsPage() {
  const confirm = useConfirm();
  // ===== Country entity editing =====
  const [editEntity, setEditEntity] = useState<BusinessEntity | null>(null);
  const [entityForm, setEntityForm] = useState<Record<string, string>>({});

  // ===== Holiday state =====
  const [holidaysList, setHolidaysList] = useState<PublicHoliday[]>([...publicHolidays]);
  const [editHoliday, setEditHoliday] = useState<PublicHoliday | null>(null);
  const [isNewHoliday, setIsNewHoliday] = useState(false);
  const [holidayForm, setHolidayForm] = useState<Record<string, string>>({});

  // ===== UoM state =====
  const [uomList, setUomList] = useState<string[]>([...unitsOfMeasureList]);
  const [editUom, setEditUom] = useState<string | null>(null);
  const [isNewUom, setIsNewUom] = useState(false);
  const [uomForm, setUomForm] = useState('');

  // ===== Exchange Rate state =====
  const [ratesList, setRatesList] = useState<ExchangeRate[]>([...exchangeRates]);
  const [editRate, setEditRate] = useState<ExchangeRate | null>(null);
  const [isNewRate, setIsNewRate] = useState(false);
  const [rateForm, setRateForm] = useState<Record<string, string>>({});

  // ===== Entity helpers =====
  const openEditEntity = (e: BusinessEntity) => {
    setEditEntity(e);
    const f: Record<string, string> = {
      name: e.name, vatNumber: e.vatNumber, registrationNumber: e.registrationNumber,
      address: e.address, phone: e.phone || '', email: e.email || '',
      bankName: e.bankName, iban: e.iban, swift: e.swift, intermediaryBic: e.intermediaryBic || '',
      invoicePrefix: e.invoicePrefix, invoiceFooter: e.invoiceFooter,
      accountantEmail: e.accountantEmail || '',
    };
    if (e.country === 'Bulgaria') {
      f.ukBankName = e.ukBankName || ''; f.ukAccountNumber = e.ukAccountNumber || '';
      f.ukSortCode = e.ukSortCode || ''; f.ukIban = e.ukIban || '';
      f.ukSwift = e.ukSwift || ''; f.ukIntermediaryBic = e.ukIntermediaryBic || '';
    }
    if (e.country === 'US') {
      f.usAccountNumber = e.usAccountNumber || ''; f.usAchRoutingNumber = e.usAchRoutingNumber || '';
      f.usWireRoutingNumber = e.usWireRoutingNumber || '';
    }
    setEntityForm(f);
  };
  const updateEntityField = (k: string, v: string) => setEntityForm(p => ({ ...p, [k]: v }));
  const saveEntity = () => {
    if (!editEntity) return;
    Object.assign(editEntity, {
      name: entityForm.name, vatNumber: entityForm.vatNumber,
      registrationNumber: entityForm.registrationNumber, address: entityForm.address,
      phone: entityForm.phone || undefined, email: entityForm.email || undefined,
      bankName: entityForm.bankName, iban: entityForm.iban, swift: entityForm.swift,
      intermediaryBic: entityForm.intermediaryBic || undefined,
      invoicePrefix: entityForm.invoicePrefix, invoiceFooter: entityForm.invoiceFooter,
      accountantEmail: entityForm.accountantEmail || undefined,
      ...(editEntity.country === 'Bulgaria' && {
        ukBankName: entityForm.ukBankName || undefined, ukAccountNumber: entityForm.ukAccountNumber || undefined,
        ukSortCode: entityForm.ukSortCode || undefined, ukIban: entityForm.ukIban || undefined,
        ukSwift: entityForm.ukSwift || undefined, ukIntermediaryBic: entityForm.ukIntermediaryBic || undefined,
      }),
      ...(editEntity.country === 'US' && {
        usAccountNumber: entityForm.usAccountNumber || undefined, usAchRoutingNumber: entityForm.usAchRoutingNumber || undefined,
        usWireRoutingNumber: entityForm.usWireRoutingNumber || undefined,
      }),
    });
    toast.success(`${editEntity.country} business unit updated`);
    setEditEntity(null);
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
  const saveHoliday = () => {
    if (!holidayForm.name || !holidayForm.date) { toast.error('Name and Date are required'); return; }
    if (isNewHoliday) {
      const newH: PublicHoliday = {
        id: `hol-${Date.now()}`, name: holidayForm.name, date: holidayForm.date,
        country: holidayForm.country as Country, year: parseInt(holidayForm.year) || new Date().getFullYear(),
      };
      setHolidaysList(prev => [...prev, newH]);
      toast.success('Holiday added');
    } else if (editHoliday) {
      setHolidaysList(prev => prev.map(h => h.id === editHoliday.id ? {
        ...h, name: holidayForm.name, date: holidayForm.date,
        country: holidayForm.country as Country, year: parseInt(holidayForm.year) || h.year,
      } : h));
      toast.success('Holiday updated');
    }
    setEditHoliday(null);
    setIsNewHoliday(false);
  };
  const deleteHoliday = async () => {
    if (!editHoliday) return;
    const ok = await confirm({ title: 'Delete holiday', description: 'Are you sure you want to delete this holiday? This action cannot be undone.' });
    if (!ok) return;
    setHolidaysList(prev => prev.filter(h => h.id !== editHoliday.id));
    toast.success('Holiday deleted');
    setEditHoliday(null);
  };
  const holidaySheetOpen = isNewHoliday || !!editHoliday;

  // ===== UoM helpers =====
  const openNewUom = () => { setIsNewUom(true); setEditUom(null); setUomForm(''); };
  const openEditUom = (u: string) => { setIsNewUom(false); setEditUom(u); setUomForm(u); };
  const saveUom = () => {
    if (!uomForm.trim()) { toast.error('Unit name is required'); return; }
    if (isNewUom) {
      if (uomList.includes(uomForm.trim())) { toast.error('Unit already exists'); return; }
      setUomList(prev => [...prev, uomForm.trim()]);
      toast.success('Unit added');
    } else if (editUom) {
      setUomList(prev => prev.map(u => u === editUom ? uomForm.trim() : u));
      toast.success('Unit updated');
    }
    setEditUom(null); setIsNewUom(false);
  };
  const deleteUom = async () => {
    if (!editUom) return;
    const ok = await confirm({ title: 'Delete unit', description: 'Are you sure you want to delete this unit of measure? This action cannot be undone.' });
    if (!ok) return;
    setUomList(prev => prev.filter(u => u !== editUom));
    toast.success('Unit deleted');
    setEditUom(null);
  };
  const uomSheetOpen = isNewUom || !!editUom;

  // ===== Exchange Rate helpers =====
  const openNewRate = () => {
    setIsNewRate(true); setEditRate(null);
    setRateForm({ fromCurrencyCode: 'EUR', toCurrencyCode: 'RON', rate: '', effectiveDate: '' });
  };
  const openEditRate = (r: ExchangeRate) => {
    setIsNewRate(false); setEditRate(r);
    setRateForm({ fromCurrencyCode: r.fromCurrencyCode, toCurrencyCode: r.toCurrencyCode, rate: r.rate.toString(), effectiveDate: r.effectiveDate });
  };
  const updateRateField = (k: string, v: string) => setRateForm(p => ({ ...p, [k]: v }));
  const saveRate = () => {
    if (!rateForm.rate || !rateForm.effectiveDate) { toast.error('Rate and Effective Date are required'); return; }
    if (isNewRate) {
      const newR: ExchangeRate = {
        id: `rate-${Date.now()}`, fromCurrencyCode: rateForm.fromCurrencyCode as CurrencyCode,
        toCurrencyCode: rateForm.toCurrencyCode as CurrencyCode, rate: parseFloat(rateForm.rate),
        effectiveDate: rateForm.effectiveDate, month: 1, year: new Date().getFullYear(),
      };
      setRatesList(prev => [...prev, newR]);
      toast.success('Exchange rate added');
    } else if (editRate) {
      setRatesList(prev => prev.map(r => r.id === editRate.id ? {
        ...r, fromCurrencyCode: rateForm.fromCurrencyCode as CurrencyCode,
        toCurrencyCode: rateForm.toCurrencyCode as CurrencyCode, rate: parseFloat(rateForm.rate),
        effectiveDate: rateForm.effectiveDate,
      } : r));
      toast.success('Exchange rate updated');
    }
    setEditRate(null); setIsNewRate(false);
  };
  const deleteRate = async () => {
    if (!editRate) return;
    const ok = await confirm({ title: 'Delete exchange rate', description: 'Are you sure you want to delete this exchange rate? This action cannot be undone.' });
    if (!ok) return;
    setRatesList(prev => prev.filter(r => r.id !== editRate.id));
    toast.success('Exchange rate deleted');
    setEditRate(null);
  };
  const rateSheetOpen = isNewRate || !!editRate;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage business configuration" />
      <Tabs defaultValue="countries">
        <TabsList>
          <TabsTrigger value="countries">Countries</TabsTrigger>
          <TabsTrigger value="holidays">Public Holidays</TabsTrigger>
          <TabsTrigger value="uom">Units of Measure</TabsTrigger>
          <TabsTrigger value="rates">Exchange Rates</TabsTrigger>
          
        </TabsList>

        {/* ===== COUNTRIES ===== */}
        <TabsContent value="countries" className="mt-4">
          <div className="grid gap-4">
            {entities.map(e => (
              <Card key={e.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openEditEntity(e)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {e.country}
                    <Pencil className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <DetailField label="Legal Name" value={e.name} />
                    <DetailField label="VAT Number" value={e.vatNumber} />
                    <DetailField label="Phone" value={e.phone} />
                    <DetailField label="Email" value={e.email} />
                    <div className="col-span-2"><DetailField label="Address" value={e.address} /></div>
                    <DetailField label="Currency" value={e.baseCurrencyCode} />
                    <DetailField
                      label={`Accountant Email (${e.country === 'Romania' ? 'RO' : e.country === 'Bulgaria' ? 'BG' : 'US'})`}
                      value={e.accountantEmail}
                    />
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-semibold text-primary mb-2">{e.country === 'Bulgaria' ? 'EU Bank Details' : 'Bank Details'}</p>
                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <DetailField label="Bank Name" value={e.bankName} />
                      <DetailField label="IBAN" value={e.iban} />
                      <DetailField label="SWIFT/BIC" value={e.swift} />
                      {e.intermediaryBic && <DetailField label="Intermediary BIC" value={e.intermediaryBic} />}
                    </div>
                  </div>
                  {e.country === 'Bulgaria' && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-semibold text-primary mb-2">UK Bank Details</p>
                      <div className="grid grid-cols-4 gap-3 text-sm">
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
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-semibold text-primary mb-2">US Banking Details</p>
                      <div className="grid grid-cols-4 gap-3 text-sm">
                        <DetailField label="Account Number" value={e.usAccountNumber} />
                        <DetailField label="ACH Routing Number" value={e.usAchRoutingNumber} />
                        <DetailField label="Wire Routing Number" value={e.usWireRoutingNumber} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ===== PUBLIC HOLIDAYS ===== */}
        <TabsContent value="holidays" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button onClick={openNewHoliday}><Plus className="h-4 w-4 mr-2" />Add Holiday</Button>
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Date</TableHead><TableHead>Country</TableHead><TableHead>Year</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidaysList.map(h => (
                  <TableRow key={h.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEditHoliday(h)}>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell>{formatDate(h.date)}</TableCell>
                    <TableCell><Badge variant="outline">{h.country}</Badge></TableCell>
                    <TableCell>{h.year}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ===== UNITS OF MEASURE ===== */}
        <TabsContent value="uom" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button onClick={openNewUom}><Plus className="h-4 w-4 mr-2" />Add Unit</Button>
          </div>
          <div className="rounded-lg border max-w-sm">
            <Table>
              <TableHeader><TableRow><TableHead>Unit</TableHead></TableRow></TableHeader>
              <TableBody>
                {uomList.map(u => (
                  <TableRow key={u} className="cursor-pointer hover:bg-muted/50" onClick={() => openEditUom(u)}>
                    <TableCell className="font-medium">{u}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ===== EXCHANGE RATES ===== */}
        <TabsContent value="rates" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button onClick={openNewRate}><Plus className="h-4 w-4 mr-2" />Add Rate</Button>
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Rate</TableHead><TableHead>Effective Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ratesList.map(r => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEditRate(r)}>
                    <TableCell>{r.fromCurrencyCode}</TableCell>
                    <TableCell>{r.toCurrencyCode}</TableCell>
                    <TableCell className="font-mono">{r.rate.toFixed(4)}</TableCell>
                    <TableCell>{formatDate(r.effectiveDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

      </Tabs>

      {/* ===== Edit Business Unit Dialog ===== */}
      <Dialog open={!!editEntity} onOpenChange={() => setEditEntity(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Business Unit — {editEntity?.country}</DialogTitle></DialogHeader>
          {editEntity && (
            <div className="space-y-6 py-4">
              <div>
                <SectionHeading title="General Information" />
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <TextField label="Legal Name" value={entityForm.name} onChange={v => updateEntityField('name', v)} required />
                  <TextField label="VAT Number" value={entityForm.vatNumber} onChange={v => updateEntityField('vatNumber', v)} required />
                  <TextField label="Registration Number" value={entityForm.registrationNumber} onChange={v => updateEntityField('registrationNumber', v)} />
                  <TextField label="Phone" value={entityForm.phone} onChange={v => updateEntityField('phone', v)} />
                  <TextField label="Email" value={entityForm.email} onChange={v => updateEntityField('email', v)} />
                  <TextField
                    label={`Accountant Email (${editEntity.country === 'Romania' ? 'RO' : editEntity.country === 'Bulgaria' ? 'BG' : 'US'})`}
                    value={entityForm.accountantEmail}
                    onChange={v => updateEntityField('accountantEmail', v)}
                  />
                  <div className="col-span-2">
                    <TextAreaField label="Address" value={entityForm.address} onChange={v => updateEntityField('address', v)} required rows={2} />
                  </div>
                </div>
              </div>
              <div>
                <SectionHeading title={editEntity.country === 'Bulgaria' ? 'EU Bank Details' : 'Bank Details'} />
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <TextField label="Bank Name" value={entityForm.bankName} onChange={v => updateEntityField('bankName', v)} required />
                  <TextField label="IBAN" value={entityForm.iban} onChange={v => updateEntityField('iban', v)} required />
                  <TextField label="SWIFT/BIC" value={entityForm.swift} onChange={v => updateEntityField('swift', v)} required />
                  <TextField label="Intermediary BIC" value={entityForm.intermediaryBic} onChange={v => updateEntityField('intermediaryBic', v)} />
                </div>
              </div>
              {editEntity.country === 'Bulgaria' && (
                <div>
                  <SectionHeading title="UK Bank Details" />
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <TextField label="UK Bank Name" value={entityForm.ukBankName} onChange={v => updateEntityField('ukBankName', v)} />
                    <TextField label="UK Account Number" value={entityForm.ukAccountNumber} onChange={v => updateEntityField('ukAccountNumber', v)} />
                    <TextField label="UK Sort Code" value={entityForm.ukSortCode} onChange={v => updateEntityField('ukSortCode', v)} />
                    <TextField label="UK IBAN" value={entityForm.ukIban} onChange={v => updateEntityField('ukIban', v)} />
                    <TextField label="UK SWIFT/BIC" value={entityForm.ukSwift} onChange={v => updateEntityField('ukSwift', v)} />
                    <TextField label="UK Intermediary BIC" value={entityForm.ukIntermediaryBic} onChange={v => updateEntityField('ukIntermediaryBic', v)} />
                  </div>
                </div>
              )}
              {editEntity.country === 'US' && (
                <div>
                  <SectionHeading title="US Banking Details" />
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <TextField label="Account Number" value={entityForm.usAccountNumber} onChange={v => updateEntityField('usAccountNumber', v)} />
                    <TextField label="ACH Routing Number" value={entityForm.usAchRoutingNumber} onChange={v => updateEntityField('usAchRoutingNumber', v)} />
                    <TextField label="Wire Routing Number" value={entityForm.usWireRoutingNumber} onChange={v => updateEntityField('usWireRoutingNumber', v)} />
                  </div>
                </div>
              )}
              <div>
                <SectionHeading title="Invoice Settings" />
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <div className="col-span-2">
                    <TextAreaField label="Invoice Footer" value={entityForm.invoiceFooter} onChange={v => updateEntityField('invoiceFooter', v)} rows={2} />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntity(null)}>Cancel</Button>
            <Button onClick={saveEntity}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Holiday Sheet ===== */}
      <Sheet open={holidaySheetOpen} onOpenChange={() => { setEditHoliday(null); setIsNewHoliday(false); }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isNewHoliday ? 'New Public Holiday' : 'Edit Public Holiday'}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <TextField label="Name" value={holidayForm.name} onChange={v => updateHolidayField('name', v)} required />
            <DateField label="Date" value={holidayForm.date} onChange={v => {
              updateHolidayField('date', v);
              if (v) {
                const parsed = new Date(v);
                if (!isNaN(parsed.getTime())) updateHolidayField('year', parsed.getFullYear().toString());
              }
            }} required />
            <SelectField label="Country" value={holidayForm.country} onChange={v => updateHolidayField('country', v)}
              options={countryOptions.map(c => ({ value: c, label: c }))} required />
            <TextField label="Year" value={holidayForm.year} onChange={v => updateHolidayField('year', v)} required />
            <div className="flex gap-2 pt-4">
              <Button onClick={saveHoliday} className="flex-1">Save</Button>
              {!isNewHoliday && (
                <Button variant="destructive" onClick={deleteHoliday}>Delete</Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ===== UoM Sheet ===== */}
      <Sheet open={uomSheetOpen} onOpenChange={() => { setEditUom(null); setIsNewUom(false); }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isNewUom ? 'New Unit of Measure' : 'Edit Unit of Measure'}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <TextField label="Unit Name" value={uomForm} onChange={setUomForm} required />
            <div className="flex gap-2 pt-4">
              <Button onClick={saveUom} className="flex-1">Save</Button>
              {!isNewUom && (
                <Button variant="destructive" onClick={deleteUom}>Delete</Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ===== Exchange Rate Sheet ===== */}
      <Sheet open={rateSheetOpen} onOpenChange={() => { setEditRate(null); setIsNewRate(false); }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isNewRate ? 'New Exchange Rate' : 'Edit Exchange Rate'}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <SelectField label="From Currency" value={rateForm.fromCurrencyCode} onChange={v => updateRateField('fromCurrencyCode', v)}
              options={currencyOptions.map(c => ({ value: c, label: c }))} required />
            <SelectField label="To Currency" value={rateForm.toCurrencyCode} onChange={v => updateRateField('toCurrencyCode', v)}
              options={currencyOptions.map(c => ({ value: c, label: c }))} required />
            <TextField label="Rate" value={rateForm.rate} onChange={v => updateRateField('rate', v)} required />
            <DateField label="Effective Date" value={rateForm.effectiveDate} onChange={v => updateRateField('effectiveDate', v)} required />
            <div className="flex gap-2 pt-4">
              <Button onClick={saveRate} className="flex-1">Save</Button>
              {!isNewRate && (
                <Button variant="destructive" onClick={deleteRate}>Delete</Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
