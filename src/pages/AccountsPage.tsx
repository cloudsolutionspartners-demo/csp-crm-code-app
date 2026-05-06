import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge, Spinner, PageLoading } from '../components/Shared';
import { Sheet, Dialog, Tabs, ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, SelectField, TextAreaField, EmailField, WebsiteField, LookupField, SwitchField } from '../components/FormFields';
import { Plus, Trash2, Send, ChevronRight, ChevronDown } from '../components/Icons';
import { SendInvoiceFlow } from '../components/invoice/SendInvoiceFlow';
import { TutorialVideoButton } from '../components/TutorialVideoDialog';
import { cn, formatCurrency } from '../lib/utils';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getNumberFilter, setTextFilter, setMultiFilter, setNumberFilter,
} from '../components/ColumnFilters';
import { SearchPill, SinglePill, MultiPill, FilterChip } from '../components/FilterPills';
import { accounts as mockAccounts, entities, contracts as mockContracts, invoices as mockInvoices, contacts as mockContacts, getEntityById } from '../data/mock-data';
import { fetchAccounts, saveAccount } from '../services/accountService';
import { fetchBusinessUnits } from '../services/businessUnitService';
import type { BusinessUnit } from '../services/businessUnitService';
import { fetchContacts } from '../services/contactService';
import { fetchContracts } from '../services/contractService';
import { fetchInvoices } from '../services/invoiceService';
import { fetchPaymentDetailsByAccount, savePaymentDetail, createPaymentDetailForAccount } from '../services/paymentDetailService';
import type { PaymentDetailRecord } from '../services/paymentDetailService';
import { fetchDocuments } from '../services/documentService';
import { useDataverse } from '../services/useDataverse';
import type { Account, AccountStatus, AccountType, ContactType, Contract, Invoice, CompanyDocument } from '../types/crm';

const contactTypes: ContactType[] = ['Consultant', 'Client Contact', 'Middleman Contact', 'Finance Contact', 'Permanent Employee'];
const accountTypes: AccountType[] = ['Direct Customer', 'Recruiter Client', 'Recruiter Agency', 'Partner B2B', 'Contractor', 'Supplier', 'Legal Taxes'];
const accountStatuses: AccountStatus[] = ['Active', 'Inactive'];
const paymentTermsOptions = ['15 Days', '30 Days', '45 Days', '60 Days'];

import { useConfirm } from '../components/ConfirmDialog';

export default function AccountsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data: accounts, loading, refetch, isLive } = useDataverse(fetchAccounts, mockAccounts);
  const { data: contacts, refetch: refetchContacts } = useDataverse(fetchContacts, mockContacts);
  const { data: dvContracts } = useDataverse<Contract>(fetchContracts, mockContracts);
  const { data: dvInvoices } = useDataverse<Invoice>(fetchInvoices, mockInvoices);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  React.useEffect(() => { fetchBusinessUnits().then(setBusinessUnits).catch(() => {}); }, []);
  const buLookupOptions = useMemo(() => businessUnits.map(bu => ({ value: bu.id, label: bu.name })), [businessUnits]);
  const childBUs = businessUnits;
  const getBuName = (buId: string) => {
    if (!buId) return '';
    const bu = businessUnits.find(b => b.id === buId);
    return bu ? bu.name : '';
  };
  const contactLookupOptions = useMemo(() => contacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })), [contacts]);
  const accountLookupOptions = useMemo(() => accounts.map(a => ({ value: a.id, label: a.name })), [accounts]);
  const uniquePaymentTerms = useMemo(() => [...new Set(accounts.map(a => a.paymentTerms))].sort(), [accounts]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContactData, setNewContactData] = useState<Record<string, any>>({});
  const [assignProgress, setAssignProgress] = useState<{ active: boolean; value: number; label: string }>({ active: false, value: 0, label: '' });
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [assignContactId, setAssignContactId] = useState('');
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetailRecord[]>([]);
  const [showNewPaymentDetail, setShowNewPaymentDetail] = useState(false);
  const [pdForm, setPdForm] = useState({ bankName: '', iban: '', swift: '', isPrimary: false, currency: 'EUR' });
  const [editingPdId, setEditingPdId] = useState<string | null>(null);
  const [isSavingPd, setIsSavingPd] = useState(false);
  const [sendInvoiceOpen, setSendInvoiceOpen] = useState(false);
  const [selectedTabInvoice, setSelectedTabInvoice] = useState<Invoice | null>(null);
  const { data: dvDocuments } = useDataverse<CompanyDocument>(fetchDocuments, []);

  const loadPaymentDetails = async (accId?: string) => {
    const id = accId || selectedAccount?.id;
    if (!id) { setPaymentDetails([]); return; }
    try { setPaymentDetails(await fetchPaymentDetailsByAccount(id)); } catch (e) { setPaymentDetails([]); }
  };

  const openForm = (account: Account) => {
    setIsNew(false);
    setSelectedAccount(account);
    setActiveTab('general');
    loadPaymentDetails(account.id);
    setFormData({
      name: account.name, accountType: account.accountType, entityId: account.entityId,
      country: account.country, vatNumber: account.vatNumber || '', registrationNumber: account.registrationNumber || '',
      paymentTerms: account.paymentTerms, email: account.email || '', invoicingEmail: account.invoicingEmail || '',
      phone: account.phone || '', website: account.website || '',
      street1: account.street1 || '', street2: account.street2 || '', street3: account.street3 || '',
      city: account.city || '', stateProvince: account.stateProvince || '',
      postalCode: account.postalCode || '', addressCountry: account.country || '',
      invoiceComments: account.invoiceComments || '', invoiceFooter: account.invoiceFooter || '',
      status: account.status, primaryContactId: account.primaryContactId || '',
      parentAccountId: account.parentAccountId || '',
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
      website: '', street1: '', street2: '', street3: '',
      city: '', stateProvince: '', postalCode: '', addressCountry: '',
      invoiceComments: '', invoiceFooter: '', status: 'Active', primaryContactId: '',
      parentAccountId: '',
    });
  };

  const openNewContactDialog = () => {
    setNewContactData({
      firstName: '', lastName: '', email: '', phone: '', contactType: 'Client Contact',
      country: '', nationality: '', company: selectedAccount?.name || '', jobRole: '',
      available: false, isInterviewer: false, summary: '',
      accountId: selectedAccount?.id || '',
    });
    setShowNewContact(true);
  };

  const saveNewContact = async () => {
    if (isSavingContact) return;
    const name = `${newContactData.firstName} ${newContactData.lastName}`.trim();
    if (!name) { toast.error('First and Last name are required'); return; }
    setIsSavingContact(true);
    try {
      const { saveContact } = await import('../services/contactService');
      const newId = await saveContact(newContactData);
      if (newId) updateField('primaryContactId', newId);
      toast.success(`Contact "${name}" created`);
      setShowNewContact(false);
      refetchContacts();
    } catch (err: any) {
      console.error('Create contact failed:', err);
      toast.error(err?.message || 'Failed to create contact');
    } finally {
      setIsSavingContact(false);
    }
  };

  const updateNewContactField = (key: string, value: any) => setNewContactData(prev => ({ ...prev, [key]: value }));
  const closeForm = () => { setSelectedAccount(null); setIsNew(false); };
  const saveForm = async () => {
    if (isSaving) return;
    if (formData.entityId && !businessUnits.find(bu => bu.id === formData.entityId)) {
      toast.error('Please select a valid Business Unit');
      return;
    }
    setIsSaving(true);
    // Check for duplicate account name
    const duplicateName = accounts.find(a =>
      a.name.toLowerCase().trim() === (formData.name || '').toLowerCase().trim() &&
      a.id !== selectedAccount?.id
    );
    if (duplicateName) {
      const proceed = window.confirm(
        `An account named "${formData.name}" already exists. Are you sure you want to create another one?`
      );
      if (!proceed) {
        setIsSaving(false);
        return;
      }
    }
    try {
      await saveAccount(formData, isNew ? undefined : selectedAccount?.id, isNew ? undefined : selectedAccount?.entityId);
      toast.success(isNew ? `Account "${formData.name}" created` : `Account "${formData.name}" saved`);
      closeForm();
      await refetch();
    } catch (err: any) {
      console.error('Save failed:', err);
      toast.error(err?.message || 'Save failed — check console for details');
    } finally {
      setIsSaving(false);
    }
  };
  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const filtered = useMemo(() => {
    return accounts.filter(a => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (typeFilter && a.accountType !== typeFilter) return false;
      if (countryFilter === '__unassigned__') {
        if (businessUnits.find(bu => bu.id === a.entityId)) return false;
      } else if (countryFilter && a.entityId !== countryFilter) return false;
      if (searchTerm && !a.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      const name = getTextFilter(colFilters, 'name');
      if (name && !a.name.toLowerCase().includes(name.toLowerCase())) return false;
      const typeCol = getMultiFilter(colFilters, 'type');
      if (typeCol.length > 0 && !typeCol.includes(a.accountType)) return false;
      const countryCol = getMultiFilter(colFilters, 'country');
      if (countryCol.length > 0 && !countryCol.includes(a.country)) return false;
      const ptCol = getMultiFilter(colFilters, 'paymentTerms');
      if (ptCol.length > 0 && !ptCol.includes(a.paymentTerms)) return false;
      const vatText = getTextFilter(colFilters, 'vat');
      if (vatText && !(a.vatNumber || '').toLowerCase().includes(vatText.toLowerCase())) return false;
      const contractsNum = getNumberFilter(colFilters, 'contracts');
      if (contractsNum.min && a.activeContracts < Number(contractsNum.min)) return false;
      if (contractsNum.max && a.activeContracts > Number(contractsNum.max)) return false;
      return true;
    });
  }, [accounts, statusFilter, typeFilter, countryFilter, searchTerm, businessUnits, colFilters]);

  const hasActiveFilters = !!searchTerm || !!statusFilter || !!typeFilter || !!countryFilter;

  const filteredIds = filtered.map(a => a.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const childrenByParent = useMemo(() => {
    const map = new Map<string, Account[]>();
    accounts.forEach(a => {
      if (a.parentAccountId) {
        if (!map.has(a.parentAccountId)) map.set(a.parentAccountId, []);
        map.get(a.parentAccountId)!.push(a);
      }
    });
    map.forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [accounts]);

  const accountContracts = selectedAccount?.id ? dvContracts.filter(c => c.parentAccountId === selectedAccount.id || c.childAccountId === selectedAccount.id) : [];
  const contractCountByAccount = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of dvContracts) {
      // Count contract on the most specific account (child if exists, otherwise parent)
      const accountId = c.childAccountId || c.parentAccountId;
      if (accountId) {
        map.set(accountId, (map.get(accountId) || 0) + 1);
      }
    }
    return map;
  }, [dvContracts]);
  const accountInvoices = selectedAccount?.id ? dvInvoices.filter(i => i.accountId === selectedAccount.id) : [];
  const accountContacts = selectedAccount?.id ? contacts.filter(c => c.accountId === selectedAccount.id) : [];
  const accountDocuments = selectedAccount?.id ? dvDocuments.filter(d => d.relatedAccountId === selectedAccount.id) : [];

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'contacts', label: `Contacts (${accountContacts.length})` },
    { id: 'contracts', label: `Contracts (${accountContracts.length})` },
    { id: 'invoices', label: `Invoices (${accountInvoices.length})` },
    { id: 'payments', label: `Payment Details (${paymentDetails.length})` },
    { id: 'documents', label: `Documents (${accountDocuments.length})` },
  ];

  if (loading && accounts.length === 0) {
    return <PageLoading message="Loading accounts..." />;
  }

  return (
    <div>
      <HeaderSelectionBar
        count={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        entityLabel="accounts"
        onActivate={async () => {
          const count = selectedIds.length;
          try {
            for (const id of selectedIds) {
              const a = accounts.find(x => x.id === id);
              if (a) await saveAccount({ ...a, status: 'Active' }, id, a.entityId);
            }
            toast.success(`${count} account(s) activated`);
            setSelectedIds([]);
            await refetch();
          } catch (err: any) { toast.error(err?.message || 'Activate failed'); }
        }}
        onDeactivate={async () => {
          const count = selectedIds.length;
          try {
            for (const id of selectedIds) {
              const a = accounts.find(x => x.id === id);
              if (a) await saveAccount({ ...a, status: 'Inactive' }, id, a.entityId);
            }
            toast.success(`${count} account(s) deactivated`);
            setSelectedIds([]);
            await refetch();
          } catch (err: any) { toast.error(err?.message || 'Deactivate failed'); }
        }}
        onDelete={async () => {
          const count = selectedIds.length;
          const ok = await confirm({ title: 'Delete account(s)', description: `Are you sure you want to delete ${count} selected account(s)? This action cannot be undone.` });
          if (!ok) return;
          // Hard delete — permanently remove from Dataverse
          try {
            const { deleteRecord } = await import('../services/dataverseService');
            for (const id of selectedIds) {
              await deleteRecord('accounts', id);
            }
            toast.success(`${count} account(s) deleted`);
            setSelectedIds([]);
            await refetch();
          } catch (err: any) { toast.error(err?.message || 'Delete failed'); }
        }}
        onDownload={() => {
          const selected = accounts.filter(a => selectedIds.includes(a.id));
          const rows = [
            ['Name', 'Type', 'Country', 'Payment Terms', 'Status', 'Email'],
            ...selected.map(a => [
              a.name || '',
              a.accountType || '',
              a.country || '',
              a.paymentTerms || '',
              a.status || '',
              a.email || '',
            ]),
          ];
          const csv = rows.map(r => r.map(cell => {
            const s = String(cell).replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
          }).join(',')).join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `accounts-${new Date().toISOString().substring(0, 10)}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success(`${selected.length} account(s) exported to CSV`);
        }}
        extraActions={selectedIds.length === 1 ? (
          <button
            className="csp-btn csp-btn-outline csp-btn-sm"
            onClick={() => setSendInvoiceOpen(true)}
          >
            <Send className="csp-icon-inline" />Send Invoice
          </button>
        ) : undefined}
      />

      <SendInvoiceFlow
        account={selectedIds.length === 1 ? accounts.find(a => a.id === selectedIds[0]) || null : null}
        open={sendInvoiceOpen}
        onClose={() => setSendInvoiceOpen(false)}
      />
      <PageHeader title="Accounts" subtitle={`${filtered.length} of ${accounts.length} accounts`}
        action={<div className="csp-flex-gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <TutorialVideoButton moduleLabel="Accounts" entityLabel="Accounts" />
          <button className="csp-btn csp-btn-primary" onClick={openNewForm}><Plus className="csp-icon-inline" />Add Account</button>
        </div>} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search accounts..." />
          <SinglePill label="Status" value={statusFilter} onChange={setStatusFilter}
            options={accountStatuses.map(s => ({ value: s, label: s, count: accounts.filter(a => a.status === s).length }))} />
          <SinglePill label="Type" value={typeFilter} onChange={setTypeFilter}
            options={accountTypes.map(t => ({ value: t, label: t, count: accounts.filter(a => a.accountType === t).length }))} />
          <SinglePill label="Business Unit" value={countryFilter} onChange={setCountryFilter}
            options={[
              ...childBUs.map(bu => ({ value: bu.id, label: bu.name, count: accounts.filter(a => a.entityId === bu.id).length })),
              ...(accounts.filter(a => !businessUnits.find(bu => bu.id === a.entityId)).length > 0
                ? [{ value: '__unassigned__', label: 'Unassigned', count: accounts.filter(a => !businessUnits.find(bu => bu.id === a.entityId)).length }]
                : []),
            ]} />
          <div style={{ marginLeft: 'auto' }}>
            {(() => {
              const parentIds = filtered.filter(a => childrenByParent.has(a.id) && !a.parentAccountId).map(a => a.id);
              const allExpanded = parentIds.length > 0 && parentIds.every(id => expandedParents.has(id));
              if (parentIds.length === 0) return null;
              return (
                <button type="button" className="csp-btn csp-btn-outline csp-btn-sm"
                  onClick={() => setExpandedParents(allExpanded ? new Set() : new Set(parentIds))}>
                  {allExpanded ? 'Collapse all' : 'Expand all'}
                </button>
              );
            })()}
          </div>
        </div>
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('')} />}
            {typeFilter && <FilterChip label={`Type: ${typeFilter}`} onRemove={() => setTypeFilter('')} />}
            {countryFilter && <FilterChip label={`Business Unit: ${countryFilter === '__unassigned__' ? 'Unassigned' : (businessUnits.find(b => b.id === countryFilter)?.name || countryFilter)}`} onRemove={() => setCountryFilter('')} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setSearchTerm(''); setStatusFilter(''); setTypeFilter(''); setCountryFilter(''); }}>Clear all</button>
          </div>
        )}
      </div>

      <div className="csp-table-wrapper">
        <table className="csp-table">
          <thead>
            <tr>
              <th className="csp-th-checkbox"><Checkbox checked={allSelected} onChange={toggleAll} /></th>
              <th>Name <TextFilterPopover label="Name" value={getTextFilter(colFilters, 'name')} onChange={v => setTextFilter(setColFilters, 'name', v)} /></th>
              <th>Type <MultiSelectFilterPopover label="Type" options={accountTypes} selected={getMultiFilter(colFilters, 'type')} onChange={v => setMultiFilter(setColFilters, 'type', v)} /></th>
              <th>Business Unit</th>
              <th>Payment Terms <MultiSelectFilterPopover label="Payment Terms" options={uniquePaymentTerms} selected={getMultiFilter(colFilters, 'paymentTerms')} onChange={v => setMultiFilter(setColFilters, 'paymentTerms', v)} /></th>
              <th>VAT <TextFilterPopover label="VAT" value={getTextFilter(colFilters, 'vat')} onChange={v => setTextFilter(setColFilters, 'vat', v)} /></th>
              <th>Contracts <NumberRangeFilterPopover label="Contracts" min={getNumberFilter(colFilters, 'contracts').min} max={getNumberFilter(colFilters, 'contracts').max} onChange={(min, max) => setNumberFilter(setColFilters, 'contracts', min, max)} /></th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="csp-td-empty">No accounts match the current filters.</td></tr>
            ) : (() => {
              const filteredIdSet = new Set(filtered.map(a => a.id));
              const topLevel = filtered.filter(a => !a.parentAccountId).sort((a, b) => a.name.localeCompare(b.name));
              const orphanParentIds = new Set<string>();
              filtered.forEach(a => {
                if (a.parentAccountId && !filteredIdSet.has(a.parentAccountId)) orphanParentIds.add(a.parentAccountId);
              });
              const orphanParents = accounts.filter(a => orphanParentIds.has(a.id) && !a.parentAccountId);
              const allTop = [...topLevel, ...orphanParents].sort((a, b) => a.name.localeCompare(b.name));
              const seen = new Set<string>();
              const rows: React.ReactNode[] = [];
              const contractCountFor = (id: string) => contractCountByAccount.get(id) || 0;
              allTop.forEach(parent => {
                if (seen.has(parent.id)) return;
                seen.add(parent.id);
                const allChildren = childrenByParent.get(parent.id) || [];
                const matchingChildren = allChildren.filter(c => filteredIdSet.has(c.id));
                const isParent = allChildren.length > 0;
                const isExpanded = expandedParents.has(parent.id);
                const aggregateContracts = isParent
                  ? contractCountFor(parent.id) + allChildren.reduce((sum, c) => sum + contractCountFor(c.id), 0)
                  : (contractCountFor(parent.id) || parent.activeContracts || 0);
                rows.push(
                  <tr key={parent.id} className="csp-tr-clickable" onClick={() => openForm(parent)}>
                    <td className="csp-td-check" onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.includes(parent.id)} onChange={c => toggleOne(parent.id, c)} />
                    </td>
                    <td className="csp-td-bold">
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                        {isParent ? (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setExpandedParents(prev => {
                                const next = new Set(prev);
                                if (next.has(parent.id)) next.delete(parent.id); else next.add(parent.id);
                                return next;
                              });
                            }}
                            style={{
                              marginTop: 2,
                              padding: 2,
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'hsl(var(--muted-foreground))',
                              borderRadius: 4,
                            }}
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isExpanded ? <ChevronDown className="csp-icon-sm" /> : <ChevronRight className="csp-icon-sm" />}
                          </button>
                        ) : (
                          <span style={{ display: 'inline-block', width: 20 }} />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{parent.name}</div>
                          {isParent && (
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                              {allChildren.length} child account{allChildren.length === 1 ? '' : 's'} {'\u00B7'} {aggregateContracts} contract{aggregateContracts === 1 ? '' : 's'} total
                              {matchingChildren.length < allChildren.length && (
                                <span style={{ marginLeft: 8, color: 'hsl(var(--primary))' }}>
                                  {'\u00B7'} {matchingChildren.length} of {allChildren.length} children match filter
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{parent.accountType}</td>
                    <td>{getBuName(parent.entityId) || parent.country || '\u2014'}</td>
                    <td>{parent.paymentTerms}</td>
                    <td>{parent.vatNumber || '\u2014'}</td>
                    <td>{aggregateContracts}</td>
                    <td><StatusBadge status={parent.status} /></td>
                  </tr>
                );
                if (isParent && isExpanded) {
                  matchingChildren.forEach(child => {
                    seen.add(child.id);
                    rows.push(
                      <tr key={child.id} className="csp-tr-clickable" style={{ backgroundColor: 'hsl(var(--muted) / 0.2)' }} onClick={() => openForm(child)}>
                        <td className="csp-td-check" onClick={e => e.stopPropagation()}>
                          <Checkbox checked={selectedIds.includes(child.id)} onChange={c => toggleOne(child.id, c)} />
                        </td>
                        <td className="csp-td-bold">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 32 }}>
                            <span style={{ color: 'hsl(var(--muted-foreground))' }}>{'\u2514'}</span>
                            <span>{child.name}</span>
                          </div>
                        </td>
                        <td>{child.accountType}</td>
                        <td>{getBuName(child.entityId) || child.country || '\u2014'}</td>
                        <td>{child.paymentTerms}</td>
                        <td>{child.vatNumber || '\u2014'}</td>
                        <td>{contractCountFor(child.id) || child.activeContracts || 0}</td>
                        <td><StatusBadge status={child.status} /></td>
                      </tr>
                    );
                  });
                }
              });
              return rows;
            })()}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span className="csp-text-muted csp-text-xs" style={{ textTransform: 'uppercase' }}>Status</span>
              <ToggleGroup value={formData.status} onChange={v => { if (v) updateField('status', v); }}>
                {accountStatuses.map(s => <ToggleGroupItem key={s} value={s}>{s}</ToggleGroupItem>)}
              </ToggleGroup>
            </div>
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab}>
              {activeTab === 'general' && (
                <div className="csp-form-grid-2">
                  <TextField label="Name" value={formData.name} onChange={v => updateField('name', v)} required />
                  <SelectField label="Type" value={formData.accountType} onChange={v => updateField('accountType', v)} required options={accountTypes.map(t => ({ value: t, label: t }))} />
                  <LookupField label="Business Unit" value={formData.entityId} onChange={v => updateField('entityId', v)} options={buLookupOptions} />
                  <LookupField label="Primary Contact" value={formData.primaryContactId} onChange={v => updateField('primaryContactId', v)} options={contactLookupOptions} />
                  <LookupField label="Parent Account" value={formData.parentAccountId} onChange={v => updateField('parentAccountId', v)} options={accounts.filter(a => !a.parentAccountId && a.id !== selectedAccount?.id).map(a => ({ value: a.id, label: a.name }))} />
                  <TextField label="VAT Number" value={formData.vatNumber} onChange={v => updateField('vatNumber', v)} />
                  <TextField label="Registration Number" value={formData.registrationNumber} onChange={v => updateField('registrationNumber', v)} />
                  <SelectField label="Payment Terms" value={formData.paymentTerms} onChange={v => updateField('paymentTerms', v)} required options={paymentTermsOptions.map(p => ({ value: p, label: p }))} />
                  <EmailField label="Email" value={formData.email} onChange={v => updateField('email', v)} />
                  <EmailField label="Invoicing Email" value={formData.invoicingEmail} onChange={v => updateField('invoicingEmail', v)} />
                  <TextField label="Phone" value={formData.phone} onChange={v => updateField('phone', v)} />
                  <WebsiteField label="Website" value={formData.website} onChange={v => updateField('website', v)} />
                  <TextField label="Street" value={formData.street1} onChange={v => updateField('street1', v)} className="csp-col-span-2" />
                  <TextField label="City" value={formData.city} onChange={v => updateField('city', v)} />
                  <TextField label="State/Province" value={formData.stateProvince} onChange={v => updateField('stateProvince', v)} />
                  <TextField label="ZIP/Postal Code" value={formData.postalCode} onChange={v => updateField('postalCode', v)} />
                  <TextField label="Country/Region" value={formData.addressCountry} onChange={v => updateField('addressCountry', v)} />
                  <TextAreaField label="Invoice Comments" value={formData.invoiceComments} onChange={v => updateField('invoiceComments', v)} className="csp-col-span-2" />
                  <TextAreaField label="Invoice Footer" value={formData.invoiceFooter} onChange={v => updateField('invoiceFooter', v)} className="csp-col-span-2" />
                </div>
              )}
              {activeTab === 'contacts' && (
                <div>
                  {isNew ? <p className="csp-text-muted csp-text-sm" style={{ padding: '2rem 0', textAlign: 'center' }}>Save the account first to add contacts.</p> : <>
                  <div className="csp-flex-gap-2 csp-mb-4">
                    <div className="csp-flex-1">
                      <LookupField label="Add Existing Contact" value={assignContactId} onChange={setAssignContactId}
                        options={contactLookupOptions.filter(o => !accountContacts.some(ac => ac.id === o.value))} />
                    </div>
                    <button className="csp-btn csp-btn-primary csp-btn-sm" disabled={!assignContactId || assignProgress.active} onClick={async () => {
                      const contactName = contactLookupOptions.find(c => c.value === assignContactId)?.label || 'Contact';
                      setAssignProgress({ active: true, value: 10, label: `Validating ${contactName}...` });
                      setTimeout(() => setAssignProgress(p => p.active ? { active: true, value: 40, label: 'Linking contact to account...' } : p), 600);
                      setTimeout(() => setAssignProgress(p => p.active ? { active: true, value: 70, label: 'Updating permissions...' } : p), 1200);
                      try {
                        const { updateRecord } = await import('../services/dataverseService');
                        await updateRecord('contacts', assignContactId, {
                          'parentcustomerid_account@odata.bind': `/accounts(${selectedAccount!.id})`
                        });
                        setTimeout(() => setAssignProgress({ active: true, value: 100, label: 'Contact assigned!' }), 1800);
                        setTimeout(() => {
                          setAssignProgress({ active: false, value: 0, label: '' });
                          toast.success(`${contactName} assigned to account`);
                          setAssignContactId('');
                          refetchContacts();
                        }, 2400);
                      } catch (err) {
                        setAssignProgress({ active: false, value: 0, label: '' });
                        toast.error('Failed to assign contact');
                      }
                    }}>{assignProgress.active ? 'Assigning...' : 'Assign'}</button>
                    <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={openNewContactDialog}><Plus className="csp-icon-inline" />New Contact</button>
                  </div>
                  {assignProgress.active && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span className="csp-text-muted csp-text-sm">{assignProgress.label}</span>
                        <span className="csp-text-muted csp-text-xs">{assignProgress.value}%</span>
                      </div>
                      <div className="csp-progress"><div className="csp-progress-bar" style={{ width: `${assignProgress.value}%` }} /></div>
                    </div>
                  )}
                  <table className="csp-table">
                    <thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Phone</th><th style={{ width: 40 }}></th></tr></thead>
                    <tbody>
                      {accountContacts.length === 0 ? (
                        <tr><td colSpan={5} className="csp-td-empty">No contacts linked to this account.</td></tr>
                      ) : accountContacts.map(c => (
                        <tr key={c.id}>
                          <td className="csp-td-bold">{c.firstName} {c.lastName}</td>
                          <td>{c.email}</td>
                          <td>{c.contactType}</td>
                          <td>{c.phone || '\u2014'}</td>
                          <td>
                            <button className="csp-btn csp-btn-ghost csp-btn-icon csp-text-danger" onClick={async () => {
                              try {
                                const { updateRecord } = await import('../services/dataverseService');
                                await updateRecord('contacts', c.id, { parentcustomerid_account: null });
                                toast.success(`${c.firstName} ${c.lastName} removed from account`);
                                refetchContacts();
                              } catch (err) { toast.error('Failed to remove contact'); }
                            }}><Trash2 className="csp-icon-sm" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>}
                </div>
              )}
              {activeTab === 'contracts' && (
                isNew ? <p className="csp-text-muted csp-text-sm" style={{ padding: '2rem 0', textAlign: 'center' }}>Save the account first to add contracts.</p> :
                <table className="csp-table">
                  <thead><tr><th>Contract #</th><th>Consultant</th><th>Type</th><th>Billing</th><th>Status</th></tr></thead>
                  <tbody>{accountContracts.map(c => (
                    <tr key={c.id}><td className="csp-td-mono">{c.contractNumber || c.name}</td><td>{c.assignedToName || '—'}</td><td>{c.contractType}</td><td>{c.billingType}</td><td><StatusBadge status={c.status} /></td></tr>
                  ))}</tbody>
                </table>
              )}
              {activeTab === 'invoices' && (
                isNew ? <p className="csp-text-muted csp-text-sm" style={{ padding: '2rem 0', textAlign: 'center' }}>Save the account first to view invoices.</p> :
                <table className="csp-table">
                  <thead><tr><th>Invoice #</th><th>Date</th><th>Currency</th><th>Total</th><th>Status</th></tr></thead>
                  <tbody>{accountInvoices.map(i => (
                    <tr key={i.id} className="csp-tr-clickable" onClick={() => setSelectedTabInvoice(i)}>
                      <td className="csp-td-mono">{i.invoiceNumber}</td><td>{i.invoiceDate}</td><td>{i.currencyCode}</td><td>{formatCurrency(i.total || 0, i.currencyCode)}</td><td><StatusBadge status={i.status} /></td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
              {activeTab === 'payments' && (
                <div>
                  {isNew ? <p className="csp-text-muted csp-text-sm" style={{ padding: '2rem 0', textAlign: 'center' }}>Save the account first to add payment details.</p> : <>
                  <div className="csp-flex-gap-2 csp-mb-4" style={{ justifyContent: 'flex-end' }}>
                    <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setEditingPdId(null); setPdForm({ bankName: '', iban: '', swift: '', isPrimary: false, currency: 'EUR' }); setShowNewPaymentDetail(true); }}>
                      <Plus className="csp-icon-inline" />Add Payment Detail
                    </button>
                  </div>
                  <table className="csp-table">
                    <thead><tr><th>Bank Name</th><th>IBAN</th><th>SWIFT</th><th>Currency</th><th>Primary</th></tr></thead>
                    <tbody>
                      {paymentDetails.length === 0 ? (
                        <tr><td colSpan={5} className="csp-td-empty">No payment details for this account.</td></tr>
                      ) : paymentDetails.map(pd => (
                        <tr key={pd.id} className="csp-tr-clickable" onClick={() => {
                          setEditingPdId(pd.id);
                          setPdForm({ bankName: pd.bankName || '', iban: pd.iban || '', swift: pd.swift || '', isPrimary: pd.isPrimary, currency: pd.currency || 'EUR' });
                          setShowNewPaymentDetail(true);
                        }}>
                          <td className="csp-td-bold">{pd.bankName || pd.name || '\u2014'}</td>
                          <td className="csp-td-mono">{pd.iban}</td>
                          <td className="csp-td-mono">{pd.swift}</td>
                          <td>{pd.currency || '\u2014'}</td>
                          <td>{pd.isPrimary ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>}
                </div>
              )}
              {activeTab === 'documents' && (
                isNew ? <p className="csp-text-muted csp-text-sm" style={{ padding: '2rem 0', textAlign: 'center' }}>Save the account first to view documents.</p> :
                <table className="csp-table">
                  <thead><tr><th>Document Name</th><th>Type</th><th>Issued Date</th><th>Expiration Date</th></tr></thead>
                  <tbody>
                    {accountDocuments.length === 0 ? (
                      <tr><td colSpan={4} className="csp-td-empty">No documents linked to this account.</td></tr>
                    ) : accountDocuments.map(doc => (
                      <tr key={doc.id}>
                        <td className="csp-td-bold">{doc.documentName}</td>
                        <td>{doc.documentType}</td>
                        <td>{doc.issuedDate || '\u2014'}</td>
                        <td>{doc.expirationDate || '\u2014'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Tabs>
            <div className="csp-form-footer">
              <button className="csp-btn csp-btn-outline" onClick={closeForm}>Close</button>
              <button className={cn('csp-btn csp-btn-primary', isSaving && 'csp-btn-saving')} disabled={isSaving} onClick={saveForm}>{isSaving ? <><Spinner size="sm" /> Saving...</> : 'Save'}</button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={!!selectedTabInvoice} onClose={() => setSelectedTabInvoice(null)}>
        {selectedTabInvoice && (
          <>
            <div className="csp-sheet-header">
              <div className="csp-sheet-title">{selectedTabInvoice.invoiceNumber || 'Invoice'}</div>
            </div>
            <div className="csp-form-grid-2">
              <TextField label="Invoice #" value={selectedTabInvoice.invoiceNumber || ''} onChange={() => {}} readOnly />
              <TextField label="Status" value={selectedTabInvoice.status || ''} onChange={() => {}} readOnly />
              <TextField label="Invoice Date" value={selectedTabInvoice.invoiceDate || ''} onChange={() => {}} readOnly />
              <TextField label="Due Date" value={selectedTabInvoice.dueDate || ''} onChange={() => {}} readOnly />
              <TextField label="Currency" value={selectedTabInvoice.currencyCode || ''} onChange={() => {}} readOnly />
              <TextField label="Total" value={String(selectedTabInvoice.total ?? '')} onChange={() => {}} readOnly />
              <TextField label="VAT Rate" value={String(selectedTabInvoice.vatRate ?? '')} onChange={() => {}} readOnly />
              <TextField label="VAT Amount" value={String(selectedTabInvoice.vatAmount ?? '')} onChange={() => {}} readOnly />
              <TextAreaField label="Comments" value={selectedTabInvoice.comments || ''} onChange={() => {}} readOnly className="csp-col-span-2" rows={3} />
            </div>
            <div className="csp-form-footer">
              <button className="csp-btn csp-btn-outline" onClick={() => setSelectedTabInvoice(null)}>Close</button>
            </div>
          </>
        )}
      </Sheet>

      <Dialog open={showNewPaymentDetail} onClose={() => { setShowNewPaymentDetail(false); setEditingPdId(null); }} title={editingPdId ? 'Edit Payment Detail' : 'Add Payment Detail'} maxWidth="28rem">
        <div className="csp-form-grid-2">
          <TextField label="Bank Name" value={pdForm.bankName} onChange={v => setPdForm(p => ({ ...p, bankName: v }))} required className="csp-col-span-2" />
          <TextField label="IBAN" value={pdForm.iban} onChange={v => setPdForm(p => ({ ...p, iban: v }))} required />
          <TextField label="SWIFT" value={pdForm.swift} onChange={v => setPdForm(p => ({ ...p, swift: v }))} required />
          <SelectField label="Currency" value={pdForm.currency} onChange={v => setPdForm(p => ({ ...p, currency: v }))} options={['EUR', 'USD', 'GBP', 'RON'].map(c => ({ value: c, label: c }))} />
          <SwitchField label="Primary" checked={pdForm.isPrimary} onChange={v => setPdForm(p => ({ ...p, isPrimary: v }))} />
        </div>
        <div className="csp-form-footer">
          {editingPdId && (
            <button className="csp-btn csp-btn-destructive" onClick={async () => {
              const ok = await confirm({ title: 'Delete payment detail', description: 'Are you sure you want to delete this payment detail? This action cannot be undone.' });
              if (!ok) return;
              try {
                const { deleteRecord } = await import('../services/dataverseService');
                await deleteRecord('csp_paymentdetails', editingPdId);
                toast.success('Payment detail deleted');
                setShowNewPaymentDetail(false);
                setEditingPdId(null);
                loadPaymentDetails();
              } catch (err) {
                console.error('Delete payment detail failed:', err);
                toast.error('Failed to delete payment detail');
              }
            }}>Delete</button>
          )}
          <button className="csp-btn csp-btn-outline" onClick={() => { setShowNewPaymentDetail(false); setEditingPdId(null); }}>Cancel</button>
          <button className="csp-btn csp-btn-primary" disabled={isSavingPd} onClick={async () => {
            if (isSavingPd) return;
            setIsSavingPd(true);
            try {
              const payload = { ...pdForm, name: pdForm.bankName || pdForm.iban || 'Payment Detail' };
              console.log('[AccountPD] Save start, payload:', payload, 'editingId:', editingPdId);
              if (editingPdId) {
                await savePaymentDetail(payload, editingPdId);
                toast.success('Payment detail updated');
              } else {
                await createPaymentDetailForAccount(payload, selectedAccount?.id || '');
                toast.success('Payment detail created');
              }
              setShowNewPaymentDetail(false);
              setEditingPdId(null);
              await loadPaymentDetails();
            } catch (err: any) {
              console.error('[AccountPD] Save failed:', err);
              toast.error(`Failed to save payment detail: ${err?.message || 'Unknown error'}`);
              // Dialog stays open on error
            } finally {
              setIsSavingPd(false);
            }
          }}>{isSavingPd ? 'Saving...' : editingPdId ? 'Save' : 'Create'}</button>
        </div>
      </Dialog>

      <Dialog open={showNewContact} onClose={() => setShowNewContact(false)} title="New Contact" maxWidth="36rem">
        <div className="csp-form-grid-2">
          <TextField label="First Name" value={newContactData.firstName} onChange={v => updateNewContactField('firstName', v)} required />
          <TextField label="Last Name" value={newContactData.lastName} onChange={v => updateNewContactField('lastName', v)} required />
          <EmailField label="Email" value={newContactData.email} onChange={v => updateNewContactField('email', v)} required />
          <TextField label="Phone" value={newContactData.phone} onChange={v => updateNewContactField('phone', v)} />
          <SelectField label="Type" value={newContactData.contactType} onChange={v => updateNewContactField('contactType', v)} required options={contactTypes.map(t => ({ value: t, label: t }))} />
          <TextField label="Country" value={newContactData.country} onChange={v => updateNewContactField('country', v)} />
          <TextField label="Nationality" value={newContactData.nationality} onChange={v => updateNewContactField('nationality', v)} />
          <TextField label="Account" value={selectedAccount?.name || ''} onChange={() => {}} readOnly />
          <TextField label="Job Role" value={newContactData.jobRole} onChange={v => updateNewContactField('jobRole', v)} />
          <div />
          <SwitchField label="Interviewer" checked={newContactData.isInterviewer} onChange={v => updateNewContactField('isInterviewer', v)} />
          <SwitchField label="Assigned" checked={newContactData.available} onChange={v => updateNewContactField('available', v)} />
        </div>
        <div className="csp-form-footer">
          <button className="csp-btn csp-btn-outline" onClick={() => setShowNewContact(false)}>Cancel</button>
          <button className="csp-btn csp-btn-primary" onClick={saveNewContact} disabled={isSavingContact}>{isSavingContact ? 'Saving...' : 'Create Contact'}</button>
        </div>
      </Dialog>
    </div>
  );
}
