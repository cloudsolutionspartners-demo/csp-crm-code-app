import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Plus, FileText, Eye, Trash2, Send, ExternalLink, ChevronRight, ChevronDown, Briefcase } from 'lucide-react';
import { SendInvoiceFlow } from '@/components/invoice/SendInvoiceFlow';
import { RaiseOpportunityForm } from '@/components/opportunity/RaiseOpportunityForm';
import { TutorialVideoButton } from '@/components/TutorialVideoDialog';
import type { CompanyDocument, Contract, Invoice, InvoiceLine } from '@/types/crm';
import { accounts, entities, contracts, invoices, contacts, getEntityById, getAccountById, getContactById, getContractById, paymentDetails } from '@/data/mock-data';
import { countries } from '@/data/countries';
import type { Account, AccountStatus, AccountType, ContactType, CurrencyCode } from '@/types/crm';
import { formatCurrency, formatPercent, formatDate } from '@/lib/format';
import { HeaderSelectionBar } from '@/components/HeaderSelectionBar';
import { useConfirm } from '@/components/ConfirmDialog';
import { TextField, SelectField, TextAreaField, EmailField, WebsiteField, LookupField, SwitchField } from '@/components/FormField';
import { toast } from 'sonner';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getNumberFilter, setTextFilter, setMultiFilter, setNumberFilter,
} from '@/components/ColumnFilters';
import { SearchPill, SinglePill, MultiPill, FilterChip } from '@/components/FilterPills';

const contactTypes: ContactType[] = ['Consultant', 'Client Contact', 'Middleman Contact', 'Finance Contact', 'Permanent Employee'];
const contactLookupOptions = contacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }));

const accountTypes: AccountType[] = ['Direct Customer', 'Recruiter Client', 'Recruiter Agency', 'Partner B2B', 'Contractor', 'Supplier', 'Legal Taxes'];
const accountStatuses: AccountStatus[] = ['Active', 'Inactive'];
const paymentTermsOptions = ['15 Days', '30 Days', '45 Days', '60 Days'];
const countryOptions = entities.map(e => ({ id: e.id, label: e.country }));
const uniqueCountries = [...new Set(accounts.map(a => a.country))].sort();
const uniquePaymentTerms = [...new Set(accounts.map(a => a.paymentTerms))].sort();

const mockDocuments: CompanyDocument[] = [
  { id: 'doc-1', documentName: 'CSP-RO Operating License', documentType: 'Certificate', relatedAccountId: 'acc-6', issuedDate: '2023-01-15', expirationDate: '2026-01-15', description: 'Business operating license', fileName: 'operating_license.pdf' },
  { id: 'doc-2', documentName: 'TechCorp MSA', documentType: 'Contract', relatedAccountId: 'acc-1', issuedDate: '2024-03-01', description: 'Master Service Agreement', fileName: 'techcorp_msa.pdf' },
  { id: 'doc-3', documentName: 'TechCorp NDA', documentType: 'Contract', relatedAccountId: 'acc-1', issuedDate: '2024-01-10', description: 'Non-Disclosure Agreement', fileName: 'techcorp_nda.pdf' },
  { id: 'doc-4', documentName: 'Nordic Staffing Agreement', documentType: 'Contract', relatedAccountId: 'acc-2', issuedDate: '2024-06-01', description: 'Staffing framework agreement', fileName: 'nordic_agreement.pdf' },
  { id: 'doc-5', documentName: 'FinanceHub SOW', documentType: 'Contract', relatedAccountId: 'acc-3', issuedDate: '2024-09-15', description: 'Statement of Work', fileName: 'financehub_sow.pdf' },
  { id: 'doc-6', documentName: 'DataFlow Certificate', documentType: 'Certificate', relatedAccountId: 'acc-4', issuedDate: '2024-02-01', expirationDate: '2025-02-01', description: 'Vendor certification', fileName: 'dataflow_cert.pdf' },
  { id: 'doc-7', documentName: 'Alpine Consulting Partnership', documentType: 'Contract', relatedAccountId: 'acc-5', issuedDate: '2024-04-20', description: 'Partnership agreement', fileName: 'alpine_partnership.pdf' },
];

export default function AccountsPage() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('Active');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContactData, setNewContactData] = useState<Record<string, any>>({});
  const [newContactMode, setNewContactMode] = useState<'account_contact' | 'account_primary_contact'>('account_contact');
  const [showNewPayment, setShowNewPayment] = useState(false);
  const [newPaymentData, setNewPaymentData] = useState<Record<string, any>>({});
  const [viewDocument, setViewDocument] = useState<CompanyDocument | null>(null);
  const [assignProgress, setAssignProgress] = useState<{ active: boolean; value: number; label: string }>({ active: false, value: 0, label: '' });
  const [savingPayment, setSavingPayment] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [sendInvoiceOpen, setSendInvoiceOpen] = useState(false);
  const [viewContract, setViewContract] = useState<Contract | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [oppWizardOpen, setOppWizardOpen] = useState(false);

  // Map of parentId -> child accounts (single-level hierarchy)
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
  }, []);
  const isChildAccount = useCallback((id: string) => accounts.find(a => a.id === id)?.parentAccountId != null, []);
  const contractCountFor = useCallback((id: string) =>
    contracts.filter(c => c.parentAccountId === id || c.childAccountId === id).length, []);

  const openForm = (account: Account) => {
    setIsNew(false);
    setSelectedAccount(account);
    setFormData({
      name: account.name,
      accountType: account.accountType,
      entityId: account.entityId,
      country: account.country,
      vatNumber: account.vatNumber || '',
      registrationNumber: account.registrationNumber || '',
      paymentTerms: account.paymentTerms,
      email: account.email || '',
      invoicingEmail: account.invoicingEmail || '',
      phone: account.phone || '',
      address: account.address || '',
      website: account.website || '',
      invoiceComments: account.invoiceComments || '',
      status: account.status,
      primaryContactId: (account as any).primaryContactId || '',
      parentAccountId: account.parentAccountId || '',
    });
  };

  const openNewForm = () => {
    setIsNew(true);
    setSelectedAccount({} as Account);
    setFormData({
      name: '', accountType: 'Direct Customer', entityId: entities[0]?.id || '',
      country: entities[0]?.country || '', vatNumber: '', registrationNumber: '',
      paymentTerms: '30 Days', email: '', invoicingEmail: '', phone: '',
      address: '', website: '', invoiceComments: '', status: 'Active',
      primaryContactId: '',
      parentAccountId: '',
    });
  };

  const openNewContactDialog = (mode: 'account_contact' | 'account_primary_contact' = 'account_contact') => {
    setNewContactMode(mode);
    setNewContactData({
      firstName: '', lastName: '', email: '', phone: '', contactType: 'Client Contact',
      country: '', nationality: '', company: '', jobRole: '',
      available: false, isInterviewer: false, availableForWork: false, summary: '',
    });
    setShowNewContact(true);
  };

  const saveNewContact = () => {
    const name = `${newContactData.firstName} ${newContactData.lastName}`.trim();
    if (!name || name === '') { toast.error('First and Last name are required'); return; }
    const newId = `new-contact-${Date.now()}`;
    contactLookupOptions.push({ value: newId, label: name });
    if (newContactMode === 'account_primary_contact') {
      updateField('primaryContactId', newId);
      toast.success(`Contact "${name}" created and set as Primary Contact`);
    } else {
      updateField('primaryContactId', newId);
      toast.success(`Contact "${name}" created`);
    }
    setShowNewContact(false);
  };

  const updateNewContactField = (key: string, value: any) => setNewContactData(prev => ({ ...prev, [key]: value }));

  const closeForm = () => { setSelectedAccount(null); setIsNew(false); };
  const saveForm = () => { toast.success(isNew ? `Account "${formData.name}" created` : `Account "${formData.name}" saved`); closeForm(); };
  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const filtered = useMemo(() => {
    return accounts.filter(a => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (typeFilter && a.accountType !== typeFilter) return false;
      if (countryFilter.length > 0 && !countryFilter.includes(a.entityId)) return false;
      if (searchTerm && !a.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
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
  }, [statusFilter, typeFilter, countryFilter, searchTerm, colFilters]);

  const filteredIds = filtered.map(a => a.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const accountContracts = selectedAccount ? contracts.filter(c => c.parentAccountId === selectedAccount.id || c.childAccountId === selectedAccount.id) : [];
  const accountInvoices = selectedAccount ? invoices.filter(i => i.accountId === selectedAccount.id) : [];
  const accountContacts = selectedAccount ? contacts.filter(c => c.accountId === selectedAccount.id) : [];
  const accountPaymentDetails = selectedAccount ? paymentDetails.filter(pd => pd.accountId === selectedAccount.id) : [];
  const [assignContactId, setAssignContactId] = useState<string>('');
  const accountDocuments = selectedAccount ? mockDocuments.filter(d => d.relatedAccountId === selectedAccount.id) : [];

  const handleAssignContact = useCallback(() => {
    if (!assignContactId) return;
    const contactName = contactLookupOptions.find(c => c.value === assignContactId)?.label ?? 'Contact';
    setAssignProgress({ active: true, value: 10, label: `Validating ${contactName}…` });
    setTimeout(() => setAssignProgress({ active: true, value: 40, label: 'Linking contact to account…' }), 600);
    setTimeout(() => setAssignProgress({ active: true, value: 70, label: 'Updating permissions…' }), 1200);
    setTimeout(() => setAssignProgress({ active: true, value: 100, label: 'Contact assigned!' }), 1800);
    setTimeout(() => {
      setAssignProgress({ active: false, value: 0, label: '' });
      toast.success(`${contactName} assigned to account`);
      setAssignContactId('');
    }, 2400);
  }, [assignContactId]);

  const openNewPaymentDialog = () => {
    setEditingPaymentId(null);
    setNewPaymentData({ bankName: '', iban: '', swift: '', currencyCode: 'EUR', isPrimary: false });
    setShowNewPayment(true);
  };
  const openEditPaymentDialog = (pd: any) => {
    setEditingPaymentId(pd.id);
    setNewPaymentData({ bankName: pd.bankName || '', iban: pd.iban, swift: pd.swift, currencyCode: pd.currencyCode, isPrimary: pd.isPrimary });
    setShowNewPayment(true);
  };
  const saveNewPayment = () => {
    if (!newPaymentData.iban || !newPaymentData.swift) { toast.error('IBAN and SWIFT are required'); return; }
    setSavingPayment(true);
    setTimeout(() => {
      toast.success(editingPaymentId ? 'Payment Detail updated' : 'Payment Detail created');
      setSavingPayment(false);
      setShowNewPayment(false);
      setEditingPaymentId(null);
    }, 1500);
  };
  const updateNewPaymentField = (key: string, value: any) => setNewPaymentData(prev => ({ ...prev, [key]: value }));

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="accounts"
        extraActions={selectedIds.length === 1 && invoices.some(i => i.accountId === selectedIds[0] && i.status === 'Draft') ? (
          <Button size="sm" variant="outline" onClick={() => setSendInvoiceOpen(true)}>
            <Send className="h-3.5 w-3.5 mr-1" />Send Invoice
          </Button>
        ) : undefined}
      />
      <PageHeader title="Accounts" subtitle={`${filtered.length} of ${accounts.length} accounts`}
        action={<div className="flex items-center gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <Button onClick={openNewForm}><Plus className="h-4 w-4 mr-2" />Add Account</Button>
          <Button variant="secondary" disabled={selectedIds.length !== 1}
            title={selectedIds.length === 1 ? 'Raise an opportunity for the selected account' : 'Select a single account to enable'}
            onClick={() => setOppWizardOpen(true)}>
            <Briefcase className="h-4 w-4 mr-2" /> Raise Opportunity
          </Button>
          <TutorialVideoButton
            entityLabel="Accounts"
            videos={[
              {
                id: 'create-account',
                title: 'How to Create a New Account',
                description: 'Step-by-step guide to creating and configuring an account',
                duration: '3:31',
                videoUrl: '/tutorials/create-account.mp4',
              },
              {
                id: 'send-invoice',
                title: 'How to Send Invoices to Accounts',
                description: 'Select accounts, review draft invoices, and send via Outlook',
                duration: '2:45',
                videoUrl: '/tutorials/send-invoice.mp4',
              },
            ]}
          />
        </div>} />

      {(() => {
        const a = accounts.find(x => x.id === selectedIds[0]);
        return (
          <RaiseOpportunityForm
            open={oppWizardOpen}
            onOpenChange={setOppWizardOpen}
            origin={a ? { kind: 'account', record: a } : null}
            onCreated={() => setSelectedIds([])}
          />
        );
      })()}

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search accounts..." />
          <SinglePill
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={accountStatuses.map(s => ({ value: s, label: s, count: accounts.filter(a => a.status === s).length }))}
          />
          <SinglePill
            label="Type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={accountTypes.map(t => ({ value: t, label: t, count: accounts.filter(a => a.accountType === t).length }))}
          />
          <MultiPill
            label="Country"
            values={countryFilter}
            onChange={setCountryFilter}
            options={countryOptions.map(e => ({ value: e.id, label: e.label, count: accounts.filter(a => a.entityId === e.id).length }))}
          />
          <div className="flex items-center gap-2 ml-auto">
            {(() => {
              const parentIds = filtered.filter(a => childrenByParent.has(a.id) && !a.parentAccountId).map(a => a.id);
              const allExpanded = parentIds.length > 0 && parentIds.every(id => expandedParents.has(id));
              return (
                <Button size="sm" variant="outline" onClick={() => setExpandedParents(allExpanded ? new Set() : new Set(parentIds))}>
                  {allExpanded ? 'Collapse all' : 'Expand all'}
                </Button>
              );
            })()}
          </div>
        </div>

        {(statusFilter || typeFilter || countryFilter.length > 0 || searchTerm) && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-muted-foreground">{filtered.length} of {accounts.length} accounts</span>
            {(statusFilter || typeFilter || countryFilter.length > 0 || searchTerm) && <span className="text-muted-foreground">·</span>}
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('')} />}
            {typeFilter && <FilterChip label={`Type: ${typeFilter}`} onRemove={() => setTypeFilter('')} />}
            {countryFilter.length > 0 && (
              <FilterChip
                label={`Country: ${countryFilter.map(id => countryOptions.find(c => c.id === id)?.label).filter(Boolean).join(', ')}`}
                onRemove={() => setCountryFilter([])}
              />
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setSearchTerm(''); setStatusFilter(''); setTypeFilter(''); setCountryFilter([]); }}
            >
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
              
              <TableHead>Name <TextFilterPopover label="Name" value={getTextFilter(colFilters, 'name')} onChange={v => setTextFilter(setColFilters, 'name', v)} /></TableHead>
              <TableHead>Type <MultiSelectFilterPopover label="Type" options={accountTypes} selected={getMultiFilter(colFilters, 'type')} onChange={v => setMultiFilter(setColFilters, 'type', v)} /></TableHead>
              <TableHead>Country <MultiSelectFilterPopover label="Country" options={uniqueCountries} selected={getMultiFilter(colFilters, 'country')} onChange={v => setMultiFilter(setColFilters, 'country', v)} /></TableHead>
              <TableHead>Payment Terms <MultiSelectFilterPopover label="Payment Terms" options={uniquePaymentTerms} selected={getMultiFilter(colFilters, 'paymentTerms')} onChange={v => setMultiFilter(setColFilters, 'paymentTerms', v)} /></TableHead>
              <TableHead>Contracts <NumberRangeFilterPopover label="Contracts" min={getNumberFilter(colFilters, 'contracts').min} max={getNumberFilter(colFilters, 'contracts').max} onChange={(min, max) => setNumberFilter(setColFilters, 'contracts', min, max)} /></TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No accounts match the current filters.</TableCell></TableRow>
            ) : (() => {
              // Hierarchy view: parents/standalone at top level, children nested.
              const filteredIdSet = new Set(filtered.map(a => a.id));
              // Top-level rows = filtered accounts that are not children, sorted alphabetically.
              const topLevel = filtered.filter(a => !a.parentAccountId).sort((a, b) => a.name.localeCompare(b.name));
              // Also include parents whose children matched the filter even if the parent itself didn't match.
              const orphanParentIds = new Set<string>();
              filtered.forEach(a => {
                if (a.parentAccountId && !filteredIdSet.has(a.parentAccountId)) orphanParentIds.add(a.parentAccountId);
              });
              const orphanParents = accounts.filter(a => orphanParentIds.has(a.id) && !a.parentAccountId);
              const allTop = [...topLevel, ...orphanParents].sort((a, b) => a.name.localeCompare(b.name));
              const rows: JSX.Element[] = [];
              allTop.forEach(parent => {
                const allChildren = childrenByParent.get(parent.id) || [];
                const matchingChildren = allChildren.filter(c => filteredIdSet.has(c.id));
                const isParent = allChildren.length > 0;
                const isExpanded = expandedParents.has(parent.id);
                const aggregateContracts = isParent
                  ? contractCountFor(parent.id) + allChildren.reduce((sum, c) => sum + contractCountFor(c.id), 0)
                  : parent.activeContracts;
                rows.push(
                  <TableRow key={parent.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(parent.id)} onCheckedChange={c => toggleOne(parent.id, !!c)} /></TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-start gap-1">
                        {isParent ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedParents(prev => {
                                const next = new Set(prev);
                                if (next.has(parent.id)) next.delete(parent.id); else next.add(parent.id);
                                return next;
                              });
                            }}
                            className="mt-0.5 p-0.5 hover:bg-muted rounded"
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        ) : (
                          <span className="inline-block w-5" />
                        )}
                        <div onClick={() => openForm(parent)} className="flex-1">
                          <div className="font-semibold">{parent.name}</div>
                          {isParent && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {allChildren.length} child account{allChildren.length === 1 ? '' : 's'} · {aggregateContracts} contract{aggregateContracts === 1 ? '' : 's'} total
                              {matchingChildren.length < allChildren.length && (
                                <span className="ml-2 text-primary">· {matchingChildren.length} of {allChildren.length} children match filter</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm" onClick={() => openForm(parent)}>{parent.accountType}</TableCell>
                    <TableCell onClick={() => openForm(parent)}>{parent.country}</TableCell>
                    <TableCell onClick={() => openForm(parent)}>{parent.paymentTerms}</TableCell>
                    <TableCell onClick={() => openForm(parent)}>{aggregateContracts}</TableCell>
                    <TableCell onClick={() => openForm(parent)}><StatusBadge status={parent.status} /></TableCell>
                  </TableRow>
                );
                if (isParent && isExpanded) {
                  matchingChildren.forEach(child => {
                    rows.push(
                      <TableRow key={child.id} className="cursor-pointer hover:bg-muted/50 bg-muted/20">
                        <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(child.id)} onCheckedChange={c => toggleOne(child.id, !!c)} /></TableCell>
                        <TableCell className="font-medium" onClick={() => openForm(child)}>
                          <div className="flex items-center gap-2 pl-8">
                            <span className="text-muted-foreground">└</span>
                            <span>{child.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm" onClick={() => openForm(child)}>{child.accountType}</TableCell>
                        <TableCell onClick={() => openForm(child)}>{child.country}</TableCell>
                        <TableCell onClick={() => openForm(child)}>{child.paymentTerms}</TableCell>
                        <TableCell onClick={() => openForm(child)}>{child.activeContracts}</TableCell>
                        <TableCell onClick={() => openForm(child)}><StatusBadge status={child.status} /></TableCell>
                      </TableRow>
                    );
                  });
                }
              });
              return rows;
            })()}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selectedAccount} onOpenChange={closeForm}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedAccount && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">{isNew ? 'New Account' : (formData.name || selectedAccount.name)}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</span>
                <ToggleGroup type="single" value={formData.status} onValueChange={v => { if (v) updateField('status', v); }} className="border rounded-md p-0.5">
                  {accountStatuses.map(s => (<ToggleGroupItem key={s} value={s} className="text-xs px-3 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm">{s}</ToggleGroupItem>))}
                </ToggleGroup>
              </div>
              <Tabs defaultValue="general" className="mt-4">
                <TabsList>
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="contacts">Contacts ({accountContacts.length})</TabsTrigger>
                  <TabsTrigger value="payments">Payment Details ({accountPaymentDetails.length})</TabsTrigger>
                  <TabsTrigger value="contracts">Contracts ({accountContracts.length})</TabsTrigger>
                  <TabsTrigger value="invoices">Invoices ({accountInvoices.length})</TabsTrigger>
                  <TabsTrigger value="documents">Documents ({accountDocuments.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="general" className="mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <TextField label="Account Name" value={formData.name} onChange={v => updateField('name', v)} required />
                    <SelectField label="Type" value={formData.accountType} onChange={v => updateField('accountType', v)} required
                      options={accountTypes.map(t => ({ value: t, label: t }))} />
                    {(() => {
                      const hasOwnChildren = !!selectedAccount && childrenByParent.has(selectedAccount.id);
                      const parentOptions = accounts
                        .filter(a => selectedAccount && a.id !== selectedAccount.id && !a.parentAccountId)
                        .map(a => ({ value: a.id, label: a.name }));
                      if (hasOwnChildren) {
                        return (
                          <div>
                            <label className="text-sm font-medium">Parent Account</label>
                            <div className="mt-1 text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">
                              Cannot be set — this account has child accounts (single-level hierarchy).
                            </div>
                          </div>
                        );
                      }
                      return (
                        <LookupField
                          label="Parent Account"
                          value={formData.parentAccountId}
                          onChange={v => updateField('parentAccountId', v)}
                          options={parentOptions}
                        />
                      );
                    })()}
                    <LookupField label="Country" value={formData.entityId} onChange={v => updateField('entityId', v)} required
                      options={entities.map(e => ({ value: e.id, label: e.country }))} />
                    <LookupField label="Account Country" value={formData.country} onChange={v => updateField('country', v)} required
                      options={countries.map(c => ({ value: c, label: c }))} />
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <LookupField label="Primary Contact" value={formData.primaryContactId} onChange={v => updateField('primaryContactId', v)}
                          options={contactLookupOptions} />
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openNewContactDialog('account_primary_contact')} className="mb-0.5">
                        <Plus className="h-3.5 w-3.5 mr-1" />New
                      </Button>
                    </div>
                    <TextField label="VAT Number" value={formData.vatNumber} onChange={v => updateField('vatNumber', v)} />
                    <TextField label="Registration Number" value={formData.registrationNumber} onChange={v => updateField('registrationNumber', v)} />
                    <SelectField label="Payment Terms" value={formData.paymentTerms} onChange={v => updateField('paymentTerms', v)} required
                      options={paymentTermsOptions.map(p => ({ value: p, label: p }))} />
                    <EmailField label="Email" value={formData.email} onChange={v => updateField('email', v)} />
                    <EmailField label="Invoicing Email" value={formData.invoicingEmail} onChange={v => updateField('invoicingEmail', v)} />
                    <TextField label="Phone" value={formData.phone} onChange={v => updateField('phone', v)} />
                    <WebsiteField label="Website" value={formData.website} onChange={v => updateField('website', v)} />
                    <TextField label="Address" value={formData.address} onChange={v => updateField('address', v)} className="col-span-2" />
                    <TextAreaField label="Invoice Comments" value={formData.invoiceComments} onChange={v => updateField('invoiceComments', v)} className="col-span-2" />
                    {formData.sourceProspectId && (
                      <div className="col-span-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Source Prospect</p>
                          <p className="font-medium">{formData.sourceProspectId}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => navigate(`/prospecting/prospects?open=${formData.sourceProspectId}`)}>
                          Open Prospect
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="contacts" className="mt-4">
                  <div className="flex items-end gap-2 mb-4">
                    <div className="flex-1">
                      <LookupField label="Add Existing Contact" value={assignContactId} onChange={setAssignContactId}
                        options={contactLookupOptions.filter(o => !accountContacts.some(ac => ac.id === o.value))} />
                    </div>
                    <Button size="sm" disabled={!assignContactId || assignProgress.active} onClick={handleAssignContact} className="mb-0.5">
                      Assign
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openNewContactDialog('account_contact')} className="mb-0.5">
                      <Plus className="h-3.5 w-3.5 mr-1" />New Contact
                    </Button>
                  </div>
                  {assignProgress.active && (
                    <div className="mb-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{assignProgress.label}</span>
                        <span className="text-xs text-muted-foreground">{assignProgress.value}%</span>
                      </div>
                      <Progress value={assignProgress.value} className="h-2" />
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Type</TableHead>
                         <TableHead>Phone</TableHead>
                         <TableHead className="w-10"></TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {accountContacts.length === 0 ? (
                         <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No contacts linked to this account.</TableCell></TableRow>
                       ) : accountContacts.map(c => (
                         <TableRow key={c.id}>
                           <TableCell className="font-medium">{c.firstName} {c.lastName}</TableCell>
                           <TableCell className="text-sm">{c.email}</TableCell>
                           <TableCell className="text-sm">{c.contactType}</TableCell>
                           <TableCell className="text-sm">{c.phone || '—'}</TableCell>
                           <TableCell>
                             <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={async () => {
                               const ok = await confirm({ title: 'Remove contact', description: `Are you sure you want to remove ${c.firstName} ${c.lastName} from this account?` });
                               if (!ok) return;
                               toast.success(`${c.firstName} ${c.lastName} removed from account`);
                             }}>
                               <Trash2 className="h-4 w-4" />
                             </Button>
                           </TableCell>
                         </TableRow>
                       ))}
                    </TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="payments" className="mt-4">
                  <div className="flex justify-end mb-4">
                    <Button size="sm" variant="outline" onClick={openNewPaymentDialog}>
                      <Plus className="h-3.5 w-3.5 mr-1" />New Payment Detail
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bank Name</TableHead>
                        <TableHead>IBAN</TableHead>
                        <TableHead>SWIFT / BIC</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead>Primary</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountPaymentDetails.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No payment details for this account.</TableCell></TableRow>
                       ) : accountPaymentDetails.map(pd => (
                         <TableRow key={pd.id} className="cursor-pointer" onClick={() => openEditPaymentDialog(pd)}>
                           <TableCell className="font-medium">{pd.bankName || '—'}</TableCell>
                           <TableCell className="text-sm">{pd.iban}</TableCell>
                           <TableCell className="text-sm">{pd.swift}</TableCell>
                           <TableCell>{pd.currencyCode}</TableCell>
                           <TableCell>{pd.isPrimary ? 'Yes' : 'No'}</TableCell>
                         </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="contracts" className="mt-4">
                  <Table><TableHeader><TableRow><TableHead>Contract #</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Billing</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>{accountContracts.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No contracts linked to this account.</TableCell></TableRow>
                    ) : accountContracts.map(c => (<TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewContract(c)}><TableCell className="font-mono text-xs">{c.contractNumber}</TableCell><TableCell>{c.name}</TableCell><TableCell className="text-sm">{c.contractType}</TableCell><TableCell className="text-sm">{c.billingType}</TableCell><TableCell><StatusBadge status={c.status} /></TableCell></TableRow>))}</TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="invoices" className="mt-4">
                  <Table><TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead>Currency</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>{accountInvoices.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No invoices linked to this account.</TableCell></TableRow>
                    ) : accountInvoices.map(i => (<TableRow key={i.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewInvoice(i)}><TableCell className="font-mono text-xs">{i.invoiceNumber}</TableCell><TableCell>{formatDate(i.invoiceDate)}</TableCell><TableCell>{i.currencyCode}</TableCell><TableCell className="text-right font-medium">{formatCurrency(i.total, i.currencyCode)}</TableCell><TableCell><StatusBadge status={i.status} /></TableCell></TableRow>))}</TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="documents" className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Issued Date</TableHead>
                        <TableHead>Expiration</TableHead>
                        <TableHead className="w-20">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountDocuments.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No documents linked to this account.</TableCell></TableRow>
                      ) : accountDocuments.map(doc => (
                        <TableRow key={doc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewDocument(doc)}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              {doc.documentName}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm"><StatusBadge status={doc.documentType} /></TableCell>
                          <TableCell className="text-sm">{doc.issuedDate || '—'}</TableCell>
                          <TableCell className="text-sm">{doc.expirationDate || '—'}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setViewDocument(doc); }}>
                              <Eye className="h-4 w-4 mr-1" /> Open
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button variant="outline" onClick={closeForm}>Close</Button>
                <Button onClick={saveForm}>Save</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={showNewContact} onOpenChange={setShowNewContact}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{newContactMode === 'account_primary_contact' ? 'New Primary Contact' : 'New Contact'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <TextField label="First Name" value={newContactData.firstName} onChange={v => updateNewContactField('firstName', v)} required />
            <TextField label="Last Name" value={newContactData.lastName} onChange={v => updateNewContactField('lastName', v)} required />
            <EmailField label="Email" value={newContactData.email} onChange={v => updateNewContactField('email', v)} required />
            <TextField label="Phone" value={newContactData.phone} onChange={v => updateNewContactField('phone', v)} />
            <SelectField label="Type" value={newContactData.contactType} onChange={v => updateNewContactField('contactType', v)} required
              options={contactTypes.map(t => ({ value: t, label: t }))} />
            <TextField label="Country" value={newContactData.country} onChange={v => updateNewContactField('country', v)} />
            <TextField label="Nationality" value={newContactData.nationality} onChange={v => updateNewContactField('nationality', v)} />
            <TextField label="Account" value={newContactData.company} onChange={v => updateNewContactField('company', v)} />
            <TextField label="Job Role" value={newContactData.jobRole} onChange={v => updateNewContactField('jobRole', v)} />
            <div />
            <SwitchField label="Interviewer" checked={newContactData.isInterviewer} onChange={v => updateNewContactField('isInterviewer', v)} />
            <SwitchField label="Assigned" checked={newContactData.available} onChange={v => updateNewContactField('available', v)} />
            <SwitchField label="Available" checked={newContactData.availableForWork} onChange={v => updateNewContactField('availableForWork', v)} />
            <div />
            <TextAreaField label="Summary" value={newContactData.summary} onChange={v => updateNewContactField('summary', v)} className="col-span-2" />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowNewContact(false)}>Cancel</Button>
            <Button onClick={saveNewContact}>Create Contact</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewPayment} onOpenChange={setShowNewPayment}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingPaymentId ? 'Edit Payment Detail' : 'New Payment Detail'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <TextField label="Bank Name" value={newPaymentData.bankName} onChange={v => updateNewPaymentField('bankName', v)} />
            <TextField label="IBAN" value={newPaymentData.iban} onChange={v => updateNewPaymentField('iban', v)} required />
            <TextField label="SWIFT / BIC" value={newPaymentData.swift} onChange={v => updateNewPaymentField('swift', v)} required />
            <SelectField label="Currency" value={newPaymentData.currencyCode} onChange={v => updateNewPaymentField('currencyCode', v)}
              options={['EUR', 'USD', 'GBP', 'RON'].map(c => ({ value: c, label: c }))} />
            <div className="flex items-center gap-2">
              <Checkbox checked={newPaymentData.isPrimary} onCheckedChange={c => updateNewPaymentField('isPrimary', !!c)} />
              <span className="text-sm">Is Primary</span>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowNewPayment(false)}>Cancel</Button>
            <Button onClick={saveNewPayment} disabled={savingPayment}>
              {savingPayment ? 'Saving…' : editingPaymentId ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewDocument} onOpenChange={() => setViewDocument(null)}>
        <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              {viewDocument?.documentName}
            </DialogTitle>
            {viewDocument?.description && (
              <p className="text-sm text-muted-foreground">{viewDocument.description}</p>
            )}
          </DialogHeader>
          <div className="flex-1 mx-6 mb-6 rounded-md border bg-muted/30 flex items-center justify-center">
            <div className="text-center space-y-3">
              <FileText className="h-16 w-16 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-medium">{viewDocument?.fileName}</p>
              <p className="text-xs text-muted-foreground">PDF preview will be available once documents are stored in the backend.</p>
              <Button variant="outline" size="sm" onClick={() => setViewDocument(null)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contract Preview Dialog */}
      <Dialog open={!!viewContract} onOpenChange={() => setViewContract(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewContract && (() => {
            const cEntity = getEntityById(viewContract.entityId);
            const cAccount = getAccountById(viewContract.parentAccountId);
            const cChild = viewContract.childAccountId ? getAccountById(viewContract.childAccountId) : null;
            const cContact = getContactById(viewContract.contactId);
            const cInvoices = invoices.filter(i => i.contractId === viewContract.id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    {viewContract.contractNumber}
                    <StatusBadge status={viewContract.status} />
                  </DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="parties" className="mt-4">
                  <TabsList>
                    <TabsTrigger value="parties">Parties</TabsTrigger>
                    <TabsTrigger value="commercials">Commercials</TabsTrigger>
                    <TabsTrigger value="dates">Dates</TabsTrigger>
                    <TabsTrigger value="invoices">Invoices ({cInvoices.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="parties" className="mt-4">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">Contract Parties</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <TextField label="Contract Number" value={viewContract.contractNumber} onChange={() => {}} readOnly />
                      <TextField label="Contract Type" value={viewContract.contractType} onChange={() => {}} readOnly />
                      <TextField label="Parent Account" value={cAccount?.name || '—'} onChange={() => {}} readOnly />
                      <TextField label="Child Account" value={cChild?.name || 'None'} onChange={() => {}} readOnly />
                      <TextField label="Assigned To" value={cContact ? `${cContact.firstName} ${cContact.lastName}` : '—'} onChange={() => {}} readOnly />
                      <TextField label="Billing Type" value={viewContract.billingType} onChange={() => {}} readOnly />
                      <TextField label="Country" value={cEntity?.country || '—'} onChange={() => {}} readOnly />
                    </div>
                  </TabsContent>
                  <TabsContent value="commercials" className="mt-4">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">Rates</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <TextField label="Sell Day Rate" value={formatCurrency(viewContract.sellRate, viewContract.sellCurrency)} onChange={() => {}} readOnly />
                      <TextField label="Buy Day Rate" value={formatCurrency(viewContract.buyRate, viewContract.buyCurrency)} onChange={() => {}} readOnly />
                      {viewContract.sellHourlyRate && <TextField label="Sell Hourly Rate" value={formatCurrency(viewContract.sellHourlyRate, viewContract.sellCurrency)} onChange={() => {}} readOnly />}
                      {viewContract.buyHourlyRate && <TextField label="Buy Hourly Rate" value={formatCurrency(viewContract.buyHourlyRate, viewContract.buyCurrency)} onChange={() => {}} readOnly />}
                      <TextField label="Margin" value={formatCurrency(viewContract.margin, viewContract.sellCurrency)} onChange={() => {}} readOnly />
                      <TextField label="Margin %" value={formatPercent(viewContract.marginPercent)} onChange={() => {}} readOnly />
                      {viewContract.grossValue && <TextField label="Gross Value" value={formatCurrency(viewContract.grossValue, viewContract.sellCurrency)} onChange={() => {}} readOnly />}
                      {viewContract.monthlySalary && <TextField label="Monthly Salary" value={formatCurrency(viewContract.monthlySalary, viewContract.monthlySalaryCurrency || viewContract.buyCurrency)} onChange={() => {}} readOnly />}
                    </div>
                  </TabsContent>
                  <TabsContent value="dates" className="mt-4">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">Dates</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <TextField label="Start Date" value={formatDate(viewContract.startDate)} onChange={() => {}} readOnly />
                      <TextField label="End Date" value={viewContract.endDate ? formatDate(viewContract.endDate) : '—'} onChange={() => {}} readOnly />
                      {viewContract.actualEndDate && <TextField label="Actual End Date" value={formatDate(viewContract.actualEndDate)} onChange={() => {}} readOnly />}
                    </div>
                  </TabsContent>
                  <TabsContent value="invoices" className="mt-4">
                    <Table><TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                      <TableBody>{cInvoices.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No invoices</TableCell></TableRow>
                      ) : cInvoices.map(i => (<TableRow key={i.id}><TableCell className="font-mono text-xs">{i.invoiceNumber}</TableCell><TableCell>{formatDate(i.invoiceDate)}</TableCell><TableCell className="text-right">{formatCurrency(i.total, i.currencyCode)}</TableCell><TableCell><StatusBadge status={i.status} /></TableCell></TableRow>))}</TableBody>
                    </Table>
                  </TabsContent>
                </Tabs>
                <DialogFooter className="mt-6">
                  <Button variant="outline" onClick={() => setViewContract(null)}>Close</Button>
                  <Button onClick={() => { const id = viewContract!.id; setViewContract(null); navigate(`/contracts?open=${id}`); }}>
                    <ExternalLink className="h-4 w-4 mr-2" />Open in Contracts
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Invoice Preview Dialog */}
      <Dialog open={!!viewInvoice} onOpenChange={() => setViewInvoice(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewInvoice && (() => {
            const iAccount = getAccountById(viewInvoice.accountId);
            const iEntity = getEntityById(viewInvoice.entityId);
            const iContract = viewInvoice.contractId ? getContractById(viewInvoice.contractId) : null;
            const consultantOptions = contacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }));
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    {viewInvoice.invoiceNumber}
                    <StatusBadge status={viewInvoice.status} />
                  </DialogTitle>
                </DialogHeader>
                <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4">
                  <TextField label="Account" value={iAccount?.name || '—'} onChange={() => {}} readOnly />
                  <TextField label="Country" value={iEntity?.country || '—'} onChange={() => {}} readOnly />
                  <TextField label="Contract" value={iContract?.contractNumber || '—'} onChange={() => {}} readOnly />
                  <TextField label="Currency" value={viewInvoice.currencyCode} onChange={() => {}} readOnly />
                  <TextField label="Invoice Date" value={formatDate(viewInvoice.invoiceDate)} onChange={() => {}} readOnly />
                  <TextField label="Due Date" value={formatDate(viewInvoice.dueDate)} onChange={() => {}} readOnly />
                  <TextField label="VAT Rate %" value={viewInvoice.vatRate.toString()} onChange={() => {}} readOnly />
                  <TextField label="VAT Amount" value={formatCurrency(viewInvoice.vatAmount, viewInvoice.currencyCode)} onChange={() => {}} readOnly />
                  <TextField label="Subtotal" value={formatCurrency(viewInvoice.subtotal, viewInvoice.currencyCode)} onChange={() => {}} readOnly />
                  <TextField label="Total" value={formatCurrency(viewInvoice.total, viewInvoice.currencyCode)} onChange={() => {}} readOnly />
                  {viewInvoice.ronConversionRate && <TextField label="RON Conversion Rate" value={viewInvoice.ronConversionRate.toFixed(4)} onChange={() => {}} readOnly />}
                  {viewInvoice.ronTotal && <TextField label="RON Total" value={formatCurrency(viewInvoice.ronTotal, 'RON')} onChange={() => {}} readOnly />}
                  {viewInvoice.paymentReceivedDate && <TextField label="Payment Received" value={formatDate(viewInvoice.paymentReceivedDate)} onChange={() => {}} readOnly />}
                  {viewInvoice.comments && <TextAreaField label="Comments" value={viewInvoice.comments} onChange={() => {}} className="col-span-2" />}
                </div>
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium mb-2">Invoice Lines</h4>
                  <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Qty</TableHead><TableHead>UoM</TableHead><TableHead>Consultant</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(viewInvoice.lines || []).length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground text-sm">No lines</TableCell></TableRow>
                      ) : (viewInvoice.lines || []).map(line => (
                        <TableRow key={line.id}>
                          <TableCell>{line.name}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{line.description}</TableCell>
                          <TableCell>{line.quantity}</TableCell>
                          <TableCell>{line.unitOfMeasure}</TableCell>
                          <TableCell>{line.contactId ? consultantOptions.find(c => c.value === line.contactId)?.label || '—' : '—'}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(line.amount, line.currencyCode)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <DialogFooter className="mt-6">
                  <Button variant="outline" onClick={() => setViewInvoice(null)}>Close</Button>
                  <Button onClick={() => { const id = viewInvoice!.id; setViewInvoice(null); navigate(`/invoices?open=${id}`); }}>
                    <ExternalLink className="h-4 w-4 mr-2" />Open in Invoices
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Send Invoice Flow */}
      {selectedIds.length === 1 && (
        <SendInvoiceFlow
          accountId={selectedIds[0]}
          open={sendInvoiceOpen}
          onOpenChange={setSendInvoiceOpen}
        />
      )}
    </div>
  );
}
