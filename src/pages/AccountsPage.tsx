import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge } from '../components/Shared';
import { Sheet, Dialog, Tabs, ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, SelectField, TextAreaField, EmailField, WebsiteField, LookupField, SwitchField } from '../components/FormFields';
import { Plus } from '../components/Icons';
import { cn } from '../lib/utils';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getNumberFilter, setTextFilter, setMultiFilter, setNumberFilter,
} from '../components/ColumnFilters';
import { accounts as mockAccounts, entities, contracts, invoices, contacts as mockContacts, getEntityById } from '../data/mock-data';
import { fetchAccounts, saveAccount } from '../services/accountService';
import { useDataverse } from '../services/useDataverse';
import type { Account, AccountStatus, AccountType, ContactType } from '../types/crm';

const contactTypes: ContactType[] = ['Consultant', 'Client Contact', 'Middleman Contact', 'Finance Contact', 'Permanent Employee'];
const accountTypes: AccountType[] = ['Direct Customer', 'Recruiter Client', 'Recruiter Agency', 'Partner B2B', 'Contractor', 'Supplier', 'Legal Taxes'];
const accountStatuses: AccountStatus[] = ['Active', 'Inactive', 'Prospect'];
const paymentTermsOptions = ['15 Days', '30 Days', '45 Days', '60 Days'];
const countryOptions = entities.map(e => ({ id: e.id, label: e.country }));

export default function AccountsPage() {
  const { toast } = useToast();
  const { data: accounts, loading, refetch, isLive } = useDataverse(fetchAccounts, mockAccounts);
  const contacts = mockContacts; // TODO: wire up contacts too
  const contactLookupOptions = useMemo(() => contacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })), [contacts]);
  const uniqueCountries = useMemo(() => [...new Set(accounts.map(a => a.country))].sort(), [accounts]);
  const uniquePaymentTerms = useMemo(() => [...new Set(accounts.map(a => a.paymentTerms))].sort(), [accounts]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContactData, setNewContactData] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState('general');
  const [assignContactId, setAssignContactId] = useState('');

  const openForm = (account: Account) => {
    setIsNew(false);
    setSelectedAccount(account);
    setActiveTab('general');
    setFormData({
      name: account.name, accountType: account.accountType, entityId: account.entityId,
      country: account.country, vatNumber: account.vatNumber || '', registrationNumber: account.registrationNumber || '',
      paymentTerms: account.paymentTerms, email: account.email || '', invoicingEmail: account.invoicingEmail || '',
      phone: account.phone || '', website: account.website || '',
      addressStreet: account.addressStreet || '', addressCity: account.addressCity || '',
      addressState: account.addressState || '', addressPostalCode: account.addressPostalCode || '',
      addressCountry: account.addressCountry || '',
      invoiceComments: account.invoiceComments || '',
      invoiceFooter: account.invoiceFooter || '', paymentDetails: account.paymentDetails || '',
      status: account.status, primaryContactId: '',
    });
  };

  const openNewForm = () => {
    setIsNew(true);
    setSelectedAccount({} as Account);
    setActiveTab('general');
    setFormData({
      name: '', accountType: 'Direct Customer', entityId: entities[0]?.id || '',
      country: entities[0]?.country || '', vatNumber: '', registrationNumber: '',
      paymentTerms: '30 Days', email: '', invoicingEmail: '', phone: '',
      website: '', addressStreet: '', addressCity: '', addressState: '',
      addressPostalCode: '', addressCountry: '',
      invoiceComments: '', invoiceFooter: '', paymentDetails: '',
      status: 'Active', primaryContactId: '',
    });
  };

  const openNewContactDialog = () => {
    setNewContactData({
      firstName: '', lastName: '', email: '', phone: '', contactType: 'Client Contact',
      country: '', nationality: '', company: '', jobRole: '',
      available: false, isInterviewer: false, summary: '',
    });
    setShowNewContact(true);
  };

  const saveNewContact = () => {
    const name = `${newContactData.firstName} ${newContactData.lastName}`.trim();
    if (!name) { toast.error('First and Last name are required'); return; }
    const newId = `new-contact-${Date.now()}`;
    contactLookupOptions.push({ value: newId, label: name });
    updateField('primaryContactId', newId);
    toast.success(`Contact "${name}" created`);
    setShowNewContact(false);
  };

  const updateNewContactField = (key: string, value: any) => setNewContactData(prev => ({ ...prev, [key]: value }));
  const closeForm = () => { setSelectedAccount(null); setIsNew(false); };
  const saveForm = async () => {
    try {
      await saveAccount(formData, isNew ? undefined : selectedAccount?.id);
      toast.success(isNew ? `Account "${formData.name}" created` : `Account "${formData.name}" saved`);
      closeForm();
      refetch();
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('Save failed — check console for details');
    }
  };
  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const filtered = useMemo(() => {
    return accounts.filter(a => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (typeFilter && a.accountType !== typeFilter) return false;
      if (countryFilter && a.entityId !== countryFilter) return false;
      const name = getTextFilter(colFilters, 'name');
      if (name && !a.name.toLowerCase().includes(name.toLowerCase())) return false;
      const typeCol = getMultiFilter(colFilters, 'type');
      if (typeCol.length > 0 && !typeCol.includes(a.accountType)) return false;
      const countryCol = getMultiFilter(colFilters, 'country');
      if (countryCol.length > 0 && !countryCol.includes(a.country)) return false;
      const ptCol = getMultiFilter(colFilters, 'paymentTerms');
      if (ptCol.length > 0 && !ptCol.includes(a.paymentTerms)) return false;
      const contractsNum = getNumberFilter(colFilters, 'contracts');
      if (contractsNum.min && a.activeContracts < Number(contractsNum.min)) return false;
      if (contractsNum.max && a.activeContracts > Number(contractsNum.max)) return false;
      return true;
    });
  }, [accounts, statusFilter, typeFilter, countryFilter, colFilters]);

  const filteredIds = filtered.map(a => a.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const accountContracts = selectedAccount?.id ? contracts.filter(c => c.parentAccountId === selectedAccount.id || c.childAccountId === selectedAccount.id) : [];
  const accountInvoices = selectedAccount?.id ? invoices.filter(i => i.accountId === selectedAccount.id) : [];
  const accountContacts = selectedAccount?.id ? contacts.filter(c => c.accountId === selectedAccount.id) : [];

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'contacts', label: `Contacts (${accountContacts.length})` },
    { id: 'contracts', label: `Contracts (${accountContracts.length})` },
    { id: 'invoices', label: `Invoices (${accountInvoices.length})` },
  ];

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="accounts" />
      <PageHeader title="Accounts" subtitle={`${filtered.length} of ${accounts.length} accounts`}
        action={<div className="csp-flex-gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <button className="csp-btn csp-btn-primary" onClick={openNewForm}><Plus className="csp-icon-inline" />Add Account</button>
        </div>} />

      <div className="csp-filter-bar">
        <div className="csp-filter-group">
          <span className="csp-filter-group-label">Status</span>
          <ToggleGroup value={statusFilter} onChange={setStatusFilter}>
            <ToggleGroupItem value="">All</ToggleGroupItem>
            {accountStatuses.map(s => <ToggleGroupItem key={s} value={s}>{s}<span className="csp-toggle-count">{accounts.filter(a => a.status === s).length}</span></ToggleGroupItem>)}
          </ToggleGroup>
        </div>
        <div className="csp-filter-group">
          <span className="csp-filter-group-label">Type</span>
          <ToggleGroup value={typeFilter} onChange={setTypeFilter}>
            <ToggleGroupItem value="">All</ToggleGroupItem>
            {accountTypes.map(t => <ToggleGroupItem key={t} value={t}>{t}<span className="csp-toggle-count">{accounts.filter(a => a.accountType === t).length}</span></ToggleGroupItem>)}
          </ToggleGroup>
        </div>
        <div className="csp-filter-group">
          <span className="csp-filter-group-label">Country</span>
          <ToggleGroup value={countryFilter} onChange={setCountryFilter}>
            <ToggleGroupItem value="">All</ToggleGroupItem>
            {countryOptions.map(e => <ToggleGroupItem key={e.id} value={e.id}>{e.label}<span className="csp-toggle-count">{accounts.filter(a => a.entityId === e.id).length}</span></ToggleGroupItem>)}
          </ToggleGroup>
        </div>
      </div>

      <div className="csp-table-wrapper">
        <table className="csp-table">
          <thead>
            <tr>
              <th className="csp-th-checkbox"><Checkbox checked={allSelected} onChange={toggleAll} /></th>
              <th>Name <TextFilterPopover label="Name" value={getTextFilter(colFilters, 'name')} onChange={v => setTextFilter(setColFilters, 'name', v)} /></th>
              <th>Type <MultiSelectFilterPopover label="Type" options={accountTypes} selected={getMultiFilter(colFilters, 'type')} onChange={v => setMultiFilter(setColFilters, 'type', v)} /></th>
              <th>Country <MultiSelectFilterPopover label="Country" options={uniqueCountries} selected={getMultiFilter(colFilters, 'country')} onChange={v => setMultiFilter(setColFilters, 'country', v)} /></th>
              <th>Payment Terms <MultiSelectFilterPopover label="Payment Terms" options={uniquePaymentTerms} selected={getMultiFilter(colFilters, 'paymentTerms')} onChange={v => setMultiFilter(setColFilters, 'paymentTerms', v)} /></th>
              <th>Contracts <NumberRangeFilterPopover label="Contracts" min={getNumberFilter(colFilters, 'contracts').min} max={getNumberFilter(colFilters, 'contracts').max} onChange={(min, max) => setNumberFilter(setColFilters, 'contracts', min, max)} /></th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="csp-td-empty">No accounts match the current filters.</td></tr>
            ) : filtered.map(account => (
              <tr key={account.id} className="csp-tr-clickable">
                <td onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(account.id)} onChange={c => toggleOne(account.id, c)} /></td>
                <td className="csp-td-bold" onClick={() => openForm(account)}>{account.name}</td>
                <td onClick={() => openForm(account)}>{account.accountType}</td>
                <td onClick={() => openForm(account)}>{account.country}</td>
                <td onClick={() => openForm(account)}>{account.paymentTerms}</td>
                <td onClick={() => openForm(account)}>{account.activeContracts}</td>
                <td onClick={() => openForm(account)}><StatusBadge status={account.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selectedAccount} onClose={closeForm}>
        {selectedAccount && (
          <>
            <div className="csp-sheet-header">
              <div className="csp-sheet-title">
                {isNew ? 'New Account' : (formData.name || selectedAccount.name)}
                {!isNew && <StatusBadge status={formData.status} />}
              </div>
            </div>
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab}>
              {activeTab === 'general' && (
                <div className="csp-form-grid-2">
                  <TextField label="Name" value={formData.name} onChange={v => updateField('name', v)} required />
                  <SelectField label="Type" value={formData.accountType} onChange={v => updateField('accountType', v)} required options={accountTypes.map(t => ({ value: t, label: t }))} />
                  <LookupField label="Country" value={formData.entityId} onChange={v => updateField('entityId', v)} required options={entities.map(e => ({ value: e.id, label: e.country }))} />
                  <SelectField label="Status" value={formData.status} onChange={v => updateField('status', v)} required options={accountStatuses.map(s => ({ value: s, label: s }))} />
                  <LookupField label="Primary Contact" value={formData.primaryContactId} onChange={v => updateField('primaryContactId', v)} options={contactLookupOptions} />
                  <TextField label="VAT Number" value={formData.vatNumber} onChange={v => updateField('vatNumber', v)} />
                  <TextField label="Registration Number" value={formData.registrationNumber} onChange={v => updateField('registrationNumber', v)} />
                  <SelectField label="Payment Terms" value={formData.paymentTerms} onChange={v => updateField('paymentTerms', v)} required options={paymentTermsOptions.map(p => ({ value: p, label: p }))} />
                  <EmailField label="Email" value={formData.email} onChange={v => updateField('email', v)} />
                  <EmailField label="Invoicing Email" value={formData.invoicingEmail} onChange={v => updateField('invoicingEmail', v)} />
                  <TextField label="Phone" value={formData.phone} onChange={v => updateField('phone', v)} />
                  <WebsiteField label="Website" value={formData.website} onChange={v => updateField('website', v)} />
                  <TextField label="Street" value={formData.addressStreet} onChange={v => updateField('addressStreet', v)} className="csp-col-span-2" />
                  <TextField label="City" value={formData.addressCity} onChange={v => updateField('addressCity', v)} />
                  <TextField label="State/Province" value={formData.addressState} onChange={v => updateField('addressState', v)} />
                  <TextField label="Postal Code" value={formData.addressPostalCode} onChange={v => updateField('addressPostalCode', v)} />
                  <TextField label="Country" value={formData.addressCountry} onChange={v => updateField('addressCountry', v)} />
                  <TextAreaField label="Invoice Comments" value={formData.invoiceComments} onChange={v => updateField('invoiceComments', v)} className="csp-col-span-2" />
                  <TextAreaField label="Invoice Footer" value={formData.invoiceFooter} onChange={v => updateField('invoiceFooter', v)} className="csp-col-span-2" />
                  <TextField label="Payment Details" value={formData.paymentDetails} onChange={v => updateField('paymentDetails', v)} className="csp-col-span-2" />
                </div>
              )}
              {activeTab === 'contacts' && (
                <div>
                  <div className="csp-flex-gap-2 csp-mb-4">
                    <div className="csp-flex-1">
                      <LookupField label="Add Existing Contact" value={assignContactId} onChange={setAssignContactId}
                        options={contactLookupOptions.filter(o => !accountContacts.some(ac => ac.id === o.value))} />
                    </div>
                    <button className="csp-btn csp-btn-primary csp-btn-sm" disabled={!assignContactId} onClick={async () => {
                      try {
                        const { saveContact } = await import('../services/contactService');
                        await saveContact({ accountId: selectedAccount!.id }, assignContactId);
                        toast.success('Contact assigned to account');
                        setAssignContactId('');
                        refetch();
                      } catch (err) {
                        console.error('Assign failed:', err);
                        toast.error('Failed to assign contact');
                      }
                    }}>Assign</button>
                    <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={openNewContactDialog}><Plus className="csp-icon-inline" />New Contact</button>
                  </div>
                  <table className="csp-table">
                    <thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Phone</th></tr></thead>
                    <tbody>
                      {accountContacts.length === 0 ? (
                        <tr><td colSpan={4} className="csp-td-empty">No contacts linked to this account.</td></tr>
                      ) : accountContacts.map(c => (
                        <tr key={c.id}>
                          <td className="csp-td-bold">{c.firstName} {c.lastName}</td>
                          <td>{c.email}</td>
                          <td>{c.contactType}</td>
                          <td>{c.phone || '\u2014'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {activeTab === 'contracts' && (
                <table className="csp-table">
                  <thead><tr><th>Contract #</th><th>Name</th><th>Status</th></tr></thead>
                  <tbody>{accountContracts.map(c => (
                    <tr key={c.id}><td className="csp-td-mono">{c.contractNumber}</td><td>{c.name}</td><td><StatusBadge status={c.status} /></td></tr>
                  ))}</tbody>
                </table>
              )}
              {activeTab === 'invoices' && (
                <table className="csp-table">
                  <thead><tr><th>Invoice #</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
                  <tbody>{accountInvoices.map(i => (
                    <tr key={i.id}><td className="csp-td-mono">{i.invoiceNumber}</td><td>{i.invoiceDate}</td><td>{i.total.toLocaleString()}</td><td><StatusBadge status={i.status} /></td></tr>
                  ))}</tbody>
                </table>
              )}
            </Tabs>
            <div className="csp-form-footer">
              <button className="csp-btn csp-btn-outline" onClick={closeForm}>Close</button>
              <button className="csp-btn csp-btn-primary" onClick={saveForm}>Save</button>
            </div>
          </>
        )}
      </Sheet>

      <Dialog open={showNewContact} onClose={() => setShowNewContact(false)} title="New Contact" maxWidth="36rem">
        <div className="csp-form-grid-2">
          <TextField label="First Name" value={newContactData.firstName} onChange={v => updateNewContactField('firstName', v)} required />
          <TextField label="Last Name" value={newContactData.lastName} onChange={v => updateNewContactField('lastName', v)} required />
          <EmailField label="Email" value={newContactData.email} onChange={v => updateNewContactField('email', v)} required />
          <TextField label="Phone" value={newContactData.phone} onChange={v => updateNewContactField('phone', v)} />
          <SelectField label="Type" value={newContactData.contactType} onChange={v => updateNewContactField('contactType', v)} required options={contactTypes.map(t => ({ value: t, label: t }))} />
          <TextField label="Country" value={newContactData.country} onChange={v => updateNewContactField('country', v)} />
          <TextField label="Nationality" value={newContactData.nationality} onChange={v => updateNewContactField('nationality', v)} />
          <TextField label="Account" value={newContactData.company} onChange={v => updateNewContactField('company', v)} />
          <TextField label="Job Role" value={newContactData.jobRole} onChange={v => updateNewContactField('jobRole', v)} />
          <div />
          <SwitchField label="Interviewer" checked={newContactData.isInterviewer} onChange={v => updateNewContactField('isInterviewer', v)} />
          <SwitchField label="Assigned" checked={newContactData.available} onChange={v => updateNewContactField('available', v)} />
          <TextAreaField label="Summary" value={newContactData.summary} onChange={v => updateNewContactField('summary', v)} className="csp-col-span-2" />
        </div>
        <div className="csp-form-footer">
          <button className="csp-btn csp-btn-outline" onClick={() => setShowNewContact(false)}>Cancel</button>
          <button className="csp-btn csp-btn-primary" onClick={saveNewContact}>Create Contact</button>
        </div>
      </Dialog>
    </div>
  );
}
