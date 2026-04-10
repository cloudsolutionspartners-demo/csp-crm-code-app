import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge } from '../components/Shared';
import { Sheet, Tabs, ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, SelectField, TextAreaField, EmailField, LookupField, SwitchField } from '../components/FormFields';
import { Plus } from '../components/Icons';
import { cn } from '../lib/utils';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, setTextFilter, setMultiFilter,
} from '../components/ColumnFilters';
import { contacts as mockContacts, accounts, contracts, timesheets, getAccountById } from '../data/mock-data';
import { countries } from '../data/countries';
import { fetchContacts, saveContact } from '../services/contactService';
import { useDataverse } from '../services/useDataverse';
import type { Contact, ContactType } from '../types/crm';

const contactTypes: ContactType[] = ['Consultant', 'Client Contact', 'Middleman Contact', 'Finance Contact', 'Permanent Employee'];
const professionalTypes: ContactType[] = ['Consultant', 'Permanent Employee'];
const accountLookupOptions = accounts.map(a => ({ value: a.id, label: a.name }));

export default function ContactsPage() {
  const { toast } = useToast();
  const { data: contacts, loading, refetch, isLive } = useDataverse(fetchContacts, mockContacts);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState('general');

  const openForm = (contact: Contact) => {
    setIsNew(false);
    setSelectedContact(contact);
    setActiveTab('general');
    setFormData({
      firstName: contact.firstName, lastName: contact.lastName, email: contact.email,
      phone: contact.phone || '', contactType: contact.contactType,
      country: contact.country || '', nationality: contact.nationality || '',
      accountId: contact.accountId || '', company: contact.company || '',
      jobRole: contact.jobRole || '', isInterviewer: contact.isInterviewer || false,
      available: contact.available || false, summary: contact.summary || '',
      skillset: contact.skillset || [],
    });
  };

  const openNewForm = () => {
    setIsNew(true);
    setSelectedContact({} as Contact);
    setActiveTab('general');
    setFormData({
      firstName: '', lastName: '', email: '', phone: '', contactType: 'Consultant',
      country: '', nationality: '', accountId: '', company: '',
      jobRole: '', isInterviewer: false, available: false, summary: '', skillset: [],
    });
  };

  const closeForm = () => { setSelectedContact(null); setIsNew(false); };
  const saveForm = async () => {
    const name = `${formData.firstName} ${formData.lastName}`.trim();
    try {
      await saveContact(formData, isNew ? undefined : selectedContact?.id);
      toast.success(isNew ? `Contact "${name}" created` : `Contact "${name}" saved`);
      closeForm();
      refetch();
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('Save failed — check console for details');
    }
  };
  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const isProfessional = (type: string) => professionalTypes.includes(type as ContactType);
  const isPermanentEmployee = (type: string) => type === 'Permanent Employee';

  const filtered = useMemo(() => {
    return contacts.filter(c => {
      if (typeFilter && c.contactType !== typeFilter) return false;
      const name = getTextFilter(colFilters, 'name');
      if (name && !`${c.firstName} ${c.lastName}`.toLowerCase().includes(name.toLowerCase())) return false;
      const account = getTextFilter(colFilters, 'account');
      if (account) {
        const accName = c.accountId ? (getAccountById(c.accountId)?.name || '') : (c.company || '');
        if (!accName.toLowerCase().includes(account.toLowerCase())) return false;
      }
      const typeCol = getMultiFilter(colFilters, 'type');
      if (typeCol.length > 0 && !typeCol.includes(c.contactType)) return false;
      const emailCol = getTextFilter(colFilters, 'email');
      if (emailCol && !c.email.toLowerCase().includes(emailCol.toLowerCase())) return false;
      return true;
    });
  }, [typeFilter, colFilters]);

  const filteredIds = filtered.map(c => c.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const showAccountCol = typeFilter !== 'Permanent Employee';

  const contactContracts = selectedContact?.id ? contracts.filter(ct => ct.contactId === selectedContact.id) : [];
  const contactTimesheets = selectedContact?.id ? timesheets.filter(ts => ts.contactId === selectedContact.id) : [];

  const showProfessionalTab = selectedContact ? isProfessional(formData.contactType || selectedContact.contactType) : false;

  const tabs = [
    { id: 'general', label: 'General' },
    ...(showProfessionalTab ? [{ id: 'professional', label: 'Professional' }] : []),
    { id: 'contracts', label: `Contracts (${contactContracts.length})` },
    { id: 'timesheets', label: `Timesheets (${contactTimesheets.length})` },
  ];

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="contacts" />
      <PageHeader title="Contacts" subtitle={`${filtered.length} of ${contacts.length} contacts`}
        action={<div className="csp-flex-gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <button className="csp-btn csp-btn-primary" onClick={openNewForm}><Plus className="csp-icon-inline" />Add Contact</button>
        </div>} />

      <div className="csp-filter-bar">
        <div className="csp-filter-group">
          <span className="csp-filter-group-label">Type</span>
          <ToggleGroup value={typeFilter} onChange={setTypeFilter}>
            <ToggleGroupItem value="">All</ToggleGroupItem>
            {contactTypes.map(t => <ToggleGroupItem key={t} value={t}>{t}<span className="csp-toggle-count">{contacts.filter(c => c.contactType === t).length}</span></ToggleGroupItem>)}
          </ToggleGroup>
        </div>
      </div>

      <div className="csp-table-wrapper">
        <table className="csp-table">
          <thead>
            <tr>
              <th className="csp-th-checkbox"><Checkbox checked={allSelected} onChange={toggleAll} /></th>
              <th>Name <TextFilterPopover label="Name" value={getTextFilter(colFilters, 'name')} onChange={v => setTextFilter(setColFilters, 'name', v)} /></th>
              {showAccountCol && <th>Account <TextFilterPopover label="Account" value={getTextFilter(colFilters, 'account')} onChange={v => setTextFilter(setColFilters, 'account', v)} /></th>}
              <th>Type <MultiSelectFilterPopover label="Type" options={contactTypes} selected={getMultiFilter(colFilters, 'type')} onChange={v => setMultiFilter(setColFilters, 'type', v)} /></th>
              <th>Email <TextFilterPopover label="Email" value={getTextFilter(colFilters, 'email')} onChange={v => setTextFilter(setColFilters, 'email', v)} /></th>
              <th>Skills</th>
              <th>Interviewer</th>
              <th>Assigned</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={showAccountCol ? 8 : 7} className="csp-td-empty">No contacts match the current filters.</td></tr>
            ) : filtered.map(contact => {
              const accountName = contact.accountId ? (getAccountById(contact.accountId)?.name || '\u2014') : (contact.company || '\u2014');
              const showSkills = isProfessional(contact.contactType);
              return (
                <tr key={contact.id} className="csp-tr-clickable">
                  <td onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(contact.id)} onChange={c => toggleOne(contact.id, c)} /></td>
                  <td className="csp-td-bold" onClick={() => openForm(contact)}>{contact.firstName} {contact.lastName}</td>
                  {showAccountCol && <td onClick={() => openForm(contact)}>{accountName}</td>}
                  <td onClick={() => openForm(contact)}>{contact.contactType}</td>
                  <td onClick={() => openForm(contact)}>{contact.email}</td>
                  <td onClick={() => openForm(contact)}>
                    {showSkills && contact.skillset && contact.skillset.length > 0 ? (
                      <div className="csp-skill-badges">
                        {contact.skillset.map(skill => <span key={skill} className="csp-badge">{skill}</span>)}
                      </div>
                    ) : '\u2014'}
                  </td>
                  <td onClick={() => openForm(contact)}>
                    {showSkills ? <span className={cn('csp-dot', contact.isInterviewer ? 'csp-dot-green' : 'csp-dot-gray')} /> : '\u2014'}
                  </td>
                  <td onClick={() => openForm(contact)}>
                    {showSkills ? <span className={cn('csp-dot', contact.available ? 'csp-dot-green' : 'csp-dot-gray')} /> : '\u2014'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selectedContact} onClose={closeForm}>
        {selectedContact && (
          <>
            <div className="csp-sheet-header">
              <div className="csp-sheet-title">
                {isNew ? 'New Contact' : `${formData.firstName || selectedContact.firstName} ${formData.lastName || selectedContact.lastName}`}
              </div>
            </div>
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab}>
              {activeTab === 'general' && (
                <div className="csp-form-grid-2">
                  <TextField label="First Name" value={formData.firstName} onChange={v => updateField('firstName', v)} required />
                  <TextField label="Last Name" value={formData.lastName} onChange={v => updateField('lastName', v)} required />
                  <EmailField label="Email" value={formData.email} onChange={v => updateField('email', v)} required />
                  <TextField label="Phone" value={formData.phone} onChange={v => updateField('phone', v)} />
                  <SelectField label="Type" value={formData.contactType} onChange={v => updateField('contactType', v)} required options={contactTypes.map(t => ({ value: t, label: t }))} />
                  <LookupField label="Country" value={formData.country} onChange={v => updateField('country', v)} options={countries.map(c => ({ value: c, label: c }))} />
                  <LookupField label="Nationality" value={formData.nationality} onChange={v => updateField('nationality', v)} options={countries.map(c => ({ value: c, label: c }))} />
                  {!isPermanentEmployee(formData.contactType) && (
                    <LookupField label="Account" value={formData.accountId} onChange={v => updateField('accountId', v)} options={accountLookupOptions} />
                  )}
                </div>
              )}
              {activeTab === 'professional' && (
                <div className="csp-form-grid-2">
                  <TextField label="Job Role" value={formData.jobRole} onChange={v => updateField('jobRole', v)} />
                  <div />
                  <SwitchField label="Interviewer" checked={formData.isInterviewer} onChange={v => updateField('isInterviewer', v)} />
                  <SwitchField label="Assigned" checked={formData.available} onChange={v => updateField('available', v)} />
                </div>
              )}
              {activeTab === 'contracts' && (
                <table className="csp-table">
                  <thead><tr><th>Contract #</th><th>Name</th><th>Status</th></tr></thead>
                  <tbody>
                    {contactContracts.length === 0 ? (
                      <tr><td colSpan={3} className="csp-td-empty">No contracts linked to this contact.</td></tr>
                    ) : contactContracts.map(c => (
                      <tr key={c.id}><td className="csp-td-mono">{c.contractNumber}</td><td>{c.name}</td><td><StatusBadge status={c.status} /></td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              {activeTab === 'timesheets' && (
                <table className="csp-table">
                  <thead><tr><th>Reference</th><th>Week</th><th>Hours</th><th>Status</th></tr></thead>
                  <tbody>
                    {contactTimesheets.length === 0 ? (
                      <tr><td colSpan={4} className="csp-td-empty">No timesheets for this contact.</td></tr>
                    ) : contactTimesheets.map(ts => (
                      <tr key={ts.id}><td className="csp-td-mono">{ts.reference}</td><td>{ts.weekStart}</td><td>{ts.totalHours}</td><td><StatusBadge status={ts.status} /></td></tr>
                    ))}
                  </tbody>
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
    </div>
  );
}
