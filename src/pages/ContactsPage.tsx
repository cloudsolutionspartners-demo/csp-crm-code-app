import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge, Spinner, PageLoading } from '../components/Shared';
import { Sheet, Tabs, ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, SelectField, TextAreaField, EmailField, LookupField, SwitchField } from '../components/FormFields';
import { Plus, X } from '../components/Icons';
import { SearchPill, SinglePill, MultiPill, FilterChip } from '../components/FilterPills';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, setTextFilter, setMultiFilter,
} from '../components/ColumnFilters';
import { contacts as mockContacts, accounts as mockAccounts, contracts as mockContracts, timesheets } from '../data/mock-data';
import { fetchJDSkills } from '../services/jdSkillService';
import { fetchJDPlatforms } from '../services/jdPlatformService';
import { fetchSkillsForContact, fetchAllContactSkills, addSkillToContact, removeSkillFromContact } from '../services/contactSkillService';
import type { ContactSkillPlatform } from '../services/contactSkillService';
import { countries } from '../data/countries';
import { fetchContacts, saveContact } from '../services/contactService';
import { fetchAccounts } from '../services/accountService';
import { fetchContracts } from '../services/contractService';
import { useDataverse } from '../services/useDataverse';
import type { Contact, ContactType, Account, Contract } from '../types/crm';

const contactTypes: ContactType[] = ['Consultant', 'Client Contact', 'Middleman Contact', 'Finance Contact', 'Permanent Employee'];
const professionalTypes: ContactType[] = ['Consultant', 'Permanent Employee'];

import { useConfirm } from '../components/ConfirmDialog';
import { fetchContactCvs, saveContactCv, removeContactCv } from '../services/contactCvService';
import { MicrosoftDataverseService } from '../generated/services/MicrosoftDataverseService';
import { getOrgUrl } from '../services/dataverseService';
import type { ContactCv } from '../types/crm';

export default function ContactsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data: contacts, loading, refetch, isLive } = useDataverse(fetchContacts, mockContacts);
  const { data: dvAccounts, refetch: refetchAccounts } = useDataverse<Account>(fetchAccounts, mockAccounts);
  const { data: dvContracts } = useDataverse<Contract>(fetchContracts, mockContracts);
  const accountLookupOptions = useMemo(() => dvAccounts.map(a => ({ value: a.id, label: a.name })), [dvAccounts]);
  const getAccountName = (id: string) => dvAccounts.find(a => a.id === id)?.name || '';
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);

  // CVs tab — Dataverse-backed
  // NOTE: isPrimary and label are UI-only conveniences in this session;
  // not persisted to Dataverse (no columns yet on csp_contactcvs).
  const [contactCvs, setContactCvs] = useState<(ContactCv & { contactId?: string })[]>([]);
  const [uploadingCv, setUploadingCv] = useState(false);
  const cvFileRef = React.useRef<HTMLInputElement>(null);

  // Skills tab — Dataverse-backed
  const [contactSkills, setContactSkills] = useState<ContactSkillPlatform[]>([]);
  const [jdSkillsOptions, setJdSkillsOptions] = useState<{ value: string; label: string }[]>([]);
  const [jdPlatformsOptions, setJdPlatformsOptions] = useState<{ value: string; label: string }[]>([]);
  const [addSkillId, setAddSkillId] = useState('');
  const [addPlatformId, setAddPlatformId] = useState('');
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsSaving, setSkillsSaving] = useState(false);
  const [allContactSkills, setAllContactSkills] = useState<ContactSkillPlatform[]>([]);

  // Load JD Skills + Platforms lookup data once, plus all junctions for the list view
  React.useEffect(() => {
    Promise.all([
      fetchJDSkills().catch(() => []),
      fetchJDPlatforms().catch(() => []),
      fetchAllContactSkills().catch(() => []),
    ]).then(([skills, platforms, junctions]) => {
      setJdSkillsOptions(skills.map((s: any) => ({ value: s.id, label: s.name })));
      setJdPlatformsOptions(platforms.map((p: any) => ({ value: p.id, label: p.name })));
      setAllContactSkills(junctions);
    });
  }, []);

  const skillsByContact = useMemo(() => {
    const skillNameById = new Map(jdSkillsOptions.map(o => [o.value, o.label]));
    const map = new Map<string, string[]>();
    for (const junction of allContactSkills) {
      const name = skillNameById.get(junction.skillId) || junction.skillName;
      if (!junction.contactId || !name) continue;
      const list = map.get(junction.contactId) || [];
      list.push(name);
      map.set(junction.contactId, list);
    }
    return map;
  }, [allContactSkills, jdSkillsOptions]);

  const loadContactSkills = async (contactId: string) => {
    if (!contactId) { setContactSkills([]); return; }
    setSkillsLoading(true);
    try {
      const skills = await fetchSkillsForContact(contactId);
      setContactSkills(skills);
    } catch (err) {
      console.error('[ContactsPage] Load skills failed:', err);
      setContactSkills([]);
    } finally {
      setSkillsLoading(false);
    }
  };

  const handleAddSkill = async () => {
    if (!selectedContact?.id || !addSkillId || skillsSaving) return;
    setSkillsSaving(true);
    try {
      await addSkillToContact(selectedContact.id, addSkillId, addPlatformId);
      await loadContactSkills(selectedContact.id);
      fetchAllContactSkills().then(setAllContactSkills).catch(() => {});
      setAddSkillId(''); setAddPlatformId('');
      toast.success('Skill added');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add skill');
    } finally {
      setSkillsSaving(false);
    }
  };

  const handleRemoveSkill = async (recordId: string) => {
    if (!selectedContact?.id || skillsSaving) return;
    const ok = await confirm({ title: 'Remove skill', description: 'Are you sure you want to remove this skill? This action cannot be undone.' });
    if (!ok) return;
    setSkillsSaving(true);
    try {
      await removeSkillFromContact(recordId);
      await loadContactSkills(selectedContact.id);
      fetchAllContactSkills().then(setAllContactSkills).catch(() => {});
      toast.success('Skill removed');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove skill');
    } finally {
      setSkillsSaving(false);
    }
  };

  const openForm = (contact: Contact) => {
    refetchAccounts();
    setIsNew(false);
    setSelectedContact(contact);
    setActiveTab('general');
    setFormData({
      firstName: contact.firstName, lastName: contact.lastName, email: contact.email,
      phone: contact.phone || '', contactType: contact.contactType,
      country: contact.country || '', nationality: contact.nationality || '',
      accountId: contact.accountId || '', company: contact.company || '',
      jobRole: contact.jobRole || '', isInterviewer: contact.isInterviewer || false,
      available: contact.available || false,
      availableForWork: contact.availableForWork ?? (contact.contactType === 'Consultant'),
      summary: contact.summary || '',
      skillset: contact.skillset || [],
      status: contact.status || 'Active',
    });
    setAddSkillId(''); setAddPlatformId('');
    // Load skills from Dataverse
    loadContactSkills(contact.id);
    // Load CVs from Dataverse
    loadContactCvs(contact.id);
  };

  const loadContactCvs = async (contactId: string) => {
    if (!contactId) { setContactCvs([]); return; }
    try {
      const cvs = await fetchContactCvs(contactId);
      // isPrimary/label are not persisted; default first one to primary in UI
      setContactCvs(cvs.map((c, i) => ({ ...c, isPrimary: i === 0 })));
    } catch (err) {
      console.error('[ContactsPage] Load CVs failed:', err);
      setContactCvs([]);
    }
  };

  const handleCvUpload = async (file: File | null) => {
    if (!file || !selectedContact?.id) return;
    setUploadingCv(true);
    try {
      const newId = await saveContactCv({ contactId: selectedContact.id, fileName: file.name });
      // Upload binary
      const arrayBuf = await file.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(arrayBuf);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const contentType = file.type || 'application/octet-stream';
      await MicrosoftDataverseService.UpdateEntityFileImageFieldContentWithOrganization(
        contentType, getOrgUrl(), 'csp_contactcvs', newId, 'csp_document', base64, file.name,
      );
      await loadContactCvs(selectedContact.id);
      toast.success('CV uploaded');
    } catch (err: any) {
      console.error('[ContactsPage] CV upload failed:', err);
      toast.error(err?.message || 'CV upload failed');
    } finally {
      setUploadingCv(false);
      if (cvFileRef.current) cvFileRef.current.value = '';
    }
  };

  const handleCvRemove = async (id: string, fileName: string) => {
    const ok = await confirm({ title: 'Delete CV', description: `Delete "${fileName}"? This cannot be undone.` });
    if (!ok) return;
    try {
      await removeContactCv(id);
      setContactCvs(prev => prev.filter(c => c.id !== id));
      toast.success('CV removed');
    } catch (err: any) {
      toast.error(err?.message || 'Remove failed');
    }
  };

  const handleCvSetPrimary = (id: string) => {
    // UI-only — not persisted
    setContactCvs(prev => prev.map(c => ({ ...c, isPrimary: c.id === id })));
  };

  const handleCvDownload = (id: string) => {
    window.open(`${getOrgUrl()}/api/data/v9.2/csp_contactcvs(${id})/csp_document/$value`, '_blank');
  };

  const openNewForm = () => {
    refetchAccounts();
    setIsNew(true);
    setSelectedContact({} as Contact);
    setActiveTab('general');
    setFormData({
      firstName: '', lastName: '', email: '', phone: '', contactType: 'Consultant',
      country: '', nationality: '', accountId: '', company: '',
      jobRole: '', isInterviewer: false, available: true, availableForWork: true, summary: '', skillset: [], status: 'Active',
    });
    setContactSkills([]);
    setAddSkillId(''); setAddPlatformId('');
  };

  const closeForm = () => { setSelectedContact(null); setIsNew(false); };
  const saveForm = async () => {
    if (isSaving) return;
    const name = `${formData.firstName} ${formData.lastName}`.trim();
    console.log('[ContactsPage] Save formData:', { isInterviewer: formData.isInterviewer, available: formData.available, jobRole: formData.jobRole });
    setIsSaving(true);
    try {
      await saveContact(formData, isNew ? undefined : selectedContact?.id);
      toast.success(isNew ? `Contact "${name}" created` : `Contact "${name}" saved`);
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

  const isProfessional = (type: string) => professionalTypes.includes(type as ContactType);
  const isPermanentEmployee = (type: string) => type === 'Permanent Employee';

  const filtered = useMemo(() => {
    return contacts.filter(c => {
      if (typeFilter && c.contactType !== typeFilter) return false;
      if (countryFilter.length > 0 && !countryFilter.includes(c.country || '')) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
        const accName = (c.accountId ? (getAccountName(c.accountId) || '') : (c.company || '')).toLowerCase();
        if (!fullName.includes(q) && !c.email.toLowerCase().includes(q) && !accName.includes(q)) return false;
      }
      const name = getTextFilter(colFilters, 'name');
      if (name && !`${c.firstName} ${c.lastName}`.toLowerCase().includes(name.toLowerCase())) return false;
      const account = getTextFilter(colFilters, 'account');
      if (account) {
        const accName = c.accountId ? (getAccountName(c.accountId) || '') : (c.company || '');
        if (!accName.toLowerCase().includes(account.toLowerCase())) return false;
      }
      const typeCol = getMultiFilter(colFilters, 'type');
      if (typeCol.length > 0 && !typeCol.includes(c.contactType)) return false;
      const emailCol = getTextFilter(colFilters, 'email');
      if (emailCol && !c.email.toLowerCase().includes(emailCol.toLowerCase())) return false;
      return true;
    });
  }, [contacts, typeFilter, searchTerm, countryFilter, colFilters]);

  const hasActiveFilters = !!searchTerm || !!typeFilter || countryFilter.length > 0;

  const filteredIds = filtered.map(c => c.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const showAccountCol = typeFilter !== 'Permanent Employee';

  const contactContracts = selectedContact?.id ? dvContracts.filter(ct => ct.contactId === selectedContact.id) : [];
  const contactTimesheets = selectedContact?.id ? timesheets.filter(ts => ts.contactId === selectedContact.id) : [];

  const showProfessionalTab = selectedContact ? isProfessional(formData.contactType || selectedContact.contactType) : false;

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'cvs', label: `CVs (${contactCvs.length})` },
    ...(showProfessionalTab ? [
      { id: 'professional', label: 'Professional' },
      { id: 'skills', label: `Skills (${contactSkills.length})` },
    ] : []),
    { id: 'contracts', label: `Contracts (${contactContracts.length})` },
    { id: 'timesheets', label: `Timesheets (${contactTimesheets.length})` },
  ];

  if (loading && contacts.length === 0) {
    return <PageLoading message="Loading contacts..." />;
  }

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="contacts" onDelete={async () => {
        const count = selectedIds.length;
        const ok = await confirm({ title: 'Delete contact(s)', description: `Are you sure you want to delete ${count} selected contact(s)? This action cannot be undone.` });
        if (!ok) return;
        try {
          const { deleteRecord } = await import('../services/dataverseService');
          for (const id of selectedIds) await deleteRecord('contacts', id);
          toast.success(`${count} contact(s) deleted`);
          setSelectedIds([]);
          await refetch();
        } catch (err: any) { toast.error('Delete failed'); }
      }} />
      <PageHeader title="Contacts" subtitle={`${filtered.length} of ${contacts.length} contacts`}
        action={<div className="csp-flex-gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <button className="csp-btn csp-btn-primary" onClick={openNewForm}><Plus className="csp-icon-inline" />Add Contact</button>
        </div>} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search name, email, account..." />
          <SinglePill label="Type" value={typeFilter} onChange={setTypeFilter}
            options={contactTypes.map(t => ({ value: t, label: t, count: contacts.filter(c => c.contactType === t).length }))} />
          <MultiPill label="Country" values={countryFilter} onChange={setCountryFilter}
            options={Array.from(new Set(contacts.map(c => c.country).filter(Boolean) as string[])).sort().map(co => ({ value: co, label: co, count: contacts.filter(c => c.country === co).length }))} />
        </div>
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {typeFilter && <FilterChip label={`Type: ${typeFilter}`} onRemove={() => setTypeFilter('')} />}
            {countryFilter.length > 0 && <FilterChip label={`Country: ${countryFilter.join(', ')}`} onRemove={() => setCountryFilter([])} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setSearchTerm(''); setTypeFilter(''); setCountryFilter([]); }}>Clear all</button>
          </div>
        )}
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
              <th>Available</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={showAccountCol ? 9 : 8} className="csp-td-empty">No contacts match the current filters.</td></tr>
            ) : filtered.map(contact => {
              const accountName = contact.accountId ? (getAccountName(contact.accountId) || '\u2014') : (contact.company || '\u2014');
              return (
                <tr key={contact.id} className="csp-tr-clickable" onClick={() => openForm(contact)}>
                  <td className="csp-td-check" onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(contact.id)} onChange={c => toggleOne(contact.id, c)} /></td>
                  <td className="csp-td-bold">{contact.firstName} {contact.lastName}</td>
                  {showAccountCol && <td>{accountName}</td>}
                  <td>{contact.contactType}</td>
                  <td>{contact.email}</td>
                  <td>
                    {(() => {
                      const names = skillsByContact.get(contact.id) || [];
                      if (names.length === 0) return '—';
                      return (
                        <div className="csp-skill-badges">
                          {names.map((n, i) => <span key={i} className="csp-badge">{n}</span>)}
                        </div>
                      );
                    })()}
                  </td>
                  <td>
                    {contact.isInterviewer ? <span className="csp-dot csp-dot-green" /> :'\u2014'}
                  </td>
                  <td>
                    {contact.available ? <span className="csp-dot csp-dot-green" /> : '\u2014'}
                  </td>
                  <td>
                    {contact.contactType === 'Consultant' ? (contact.availableForWork ? <span className="csp-dot csp-dot-green" /> : '—') : '—'}
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
                {!isNew && <StatusBadge status={formData.status} />}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span className="csp-text-muted csp-text-xs" style={{ textTransform: 'uppercase' }}>Status</span>
              <ToggleGroup value={formData.status} onChange={v => { if (v) updateField('status', v); }}>
                {['Active', 'Inactive'].map(s => <ToggleGroupItem key={s} value={s}>{s}</ToggleGroupItem>)}
              </ToggleGroup>
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
                </div>
              )}
              {activeTab === 'cvs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', margin: 0 }}>
                      CVs are saved to <code>csp_contactcvs.csp_document</code>. The "primary" star and per-CV label are UI-only.
                    </p>
                    <input
                      ref={cvFileRef} type="file" accept=".pdf,.doc,.docx"
                      style={{ display: 'none' }}
                      onChange={e => handleCvUpload(e.target.files?.[0] || null)}
                    />
                    <button
                      type="button"
                      className="csp-btn csp-btn-primary csp-btn-sm"
                      disabled={uploadingCv || isNew || !selectedContact?.id}
                      onClick={() => cvFileRef.current?.click()}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Plus className="csp-icon-sm" /> {uploadingCv ? 'Uploading…' : 'Upload CV'}
                    </button>
                  </div>

                  {isNew && (
                    <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>
                      Save the contact first, then upload CVs from this tab.
                    </p>
                  )}

                  {!isNew && contactCvs.length === 0 && (
                    <p style={{ textAlign: 'center', color: 'hsl(var(--muted-foreground))', padding: 24, fontSize: 13 }}>
                      No CVs on file. Click + Upload CV to add one.
                    </p>
                  )}

                  {contactCvs.map(cv => (
                    <div key={cv.id} style={{
                      border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 12,
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <span style={{ fontSize: 16, color: 'hsl(var(--muted-foreground))' }}>📄</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cv.fileName}</div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
                          {cv.label ? `${cv.label} · ` : ''}Uploaded {cv.uploadedAt || '—'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCvSetPrimary(cv.id)}
                        title={cv.isPrimary ? 'Primary CV (session)' : 'Set as primary (session)'}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                          fontSize: 16, color: cv.isPrimary ? '#f59e0b' : 'hsl(var(--muted-foreground))',
                        }}
                      >{cv.isPrimary ? '★' : '☆'}</button>
                      <button type="button" className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => handleCvDownload(cv.id)}>Download</button>
                      <button
                        type="button"
                        onClick={() => handleCvRemove(cv.id, cv.fileName)}
                        aria-label="Delete CV"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#dc2626', fontSize: 18 }}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'professional' && (
                <div className="csp-form-grid-2">
                  <TextField label="Job Role" value={formData.jobRole} onChange={v => updateField('jobRole', v)} />
                  <div />
                  <SwitchField label="Interviewer" checked={formData.isInterviewer} onChange={v => updateField('isInterviewer', v)} />
                  <SwitchField label="Assigned" checked={formData.available} onChange={v => updateField('available', v)} />
                  {formData.contactType === 'Consultant' && (
                    <SwitchField label="Available" checked={formData.availableForWork} onChange={v => updateField('availableForWork', v)} />
                  )}
                </div>
              )}
              {activeTab === 'skills' && (
                <div>
                  {isNew ? (
                    <p className="csp-text-muted csp-text-sm" style={{ padding: '2rem 0', textAlign: 'center' }}>Save the contact first to add skills.</p>
                  ) : <>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 16 }}>
                    <div style={{ flex: 1 }}>
                      <LookupField label="Skill" value={addSkillId} onChange={setAddSkillId}
                        options={jdSkillsOptions.filter(s => !contactSkills.some(cs => cs.skillId === s.value))}
                        placeholder="Select skill" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <LookupField label="Platform" value={addPlatformId} onChange={setAddPlatformId}
                        options={jdPlatformsOptions}
                        placeholder="Select platform" />
                    </div>
                    <button className="csp-btn csp-btn-primary csp-btn-sm" disabled={!addSkillId || skillsSaving}
                      onClick={handleAddSkill}>
                      <Plus className="csp-icon-inline" /> {skillsSaving ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                  <table className="csp-table">
                    <thead><tr><th>Skill</th><th>Platform</th><th style={{ width: 40 }}></th></tr></thead>
                    <tbody>
                      {skillsLoading ? (
                        <tr><td colSpan={3} className="csp-td-empty">Loading skills...</td></tr>
                      ) : contactSkills.length === 0 ? (
                        <tr><td colSpan={3} className="csp-td-empty">No skills assigned.</td></tr>
                      ) : contactSkills.map(cs => {
                        const skillLabel = jdSkillsOptions.find(o => o.value === cs.skillId)?.label || cs.skillName || '—';
                        const platformLabel = cs.platformId ? (jdPlatformsOptions.find(o => o.value === cs.platformId)?.label || cs.platformName || '—') : '—';
                        return (
                        <tr key={cs.id}>
                          <td className="csp-td-bold">{skillLabel}</td>
                          <td>{platformLabel}</td>
                          <td>
                            <button className="csp-btn csp-btn-ghost csp-btn-icon-sm" disabled={skillsSaving} onClick={() => handleRemoveSkill(cs.id)}>
                              <X className="csp-icon-sm" />
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </>}
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
              <button className={`csp-btn csp-btn-primary ${isSaving ? 'csp-btn-saving' : ''}`} disabled={isSaving} onClick={saveForm}>{isSaving ? <><Spinner size="sm" /> Saving...</> : 'Save'}</button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
