import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X, Briefcase, Upload, Trash2, Star, FileText } from 'lucide-react';
import { RaiseOpportunityForm } from '@/components/opportunity/RaiseOpportunityForm';

import { contacts, contracts, timesheets, getAccountById, jdSkills, jdPlatforms } from '@/data/mock-data';
import type { Contact, ContactType, ContactCv } from '@/types/crm';
import { HeaderSelectionBar } from '@/components/HeaderSelectionBar';
import { TextField, SelectField, SwitchField, EmailField, LookupField } from '@/components/FormField';
import { toast } from 'sonner';
import {
  ColumnFilters, ClearColumnFiltersButton,
} from '@/components/ColumnFilters';
import { SearchPill, SinglePill, MultiPill, FilterChip } from '@/components/FilterPills';

const contactTypes: ContactType[] = ['Consultant', 'Client Contact', 'Middleman Contact', 'Finance Contact', 'Permanent Employee'];
const uniqueCountries = [...new Set(contacts.map(c => c.country).filter(Boolean) as string[])].sort();

export default function ContactsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string[]>([]);
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [contactSkills, setContactSkills] = useState<{ skillId: string; platformId: string }[]>([]);
  const [addSkillId, setAddSkillId] = useState('');
  const [addPlatformId, setAddPlatformId] = useState('');
  const [oppWizardOpen, setOppWizardOpen] = useState(false);
  
  const [contactCvs, setContactCvs] = useState<ContactCv[]>([]);

  const openForm = (contact: Contact) => {
    setIsNew(false);
    setSelectedContact(contact);
    setFormData({
      firstName: contact.firstName, lastName: contact.lastName, email: contact.email,
      phone: contact.phone || '', contactType: contact.contactType, country: contact.country || '',
      nationality: contact.nationality || '', company: contact.company || '',
      jobRole: contact.jobRole || '',
      available: contact.available || false, isInterviewer: contact.isInterviewer || false,
      availableForWork: contact.availableForWork ?? (contact.contactType === 'Consultant'),
      summary: contact.summary || '',
    });
    // Mock: derive skills from contact.skillset
    setContactSkills((contact.skillset || []).map((s, i) => ({ skillId: jdSkills.find(sk => sk.name === s)?.id || '', platformId: jdPlatforms[i % jdPlatforms.length]?.id || '' })));
    setContactCvs([...(contact.cvs || [])]);
    setAddSkillId(''); setAddPlatformId('');
  };

  const openNewForm = () => {
    setIsNew(true);
    setSelectedContact({} as Contact);
    setFormData({
      firstName: '', lastName: '', email: '', phone: '', contactType: 'Consultant',
      country: '', nationality: '', company: '', jobRole: '',
      available: true, isInterviewer: false, availableForWork: true, summary: '',
    });
    setContactSkills([]);
    setContactCvs([]);
    setAddSkillId(''); setAddPlatformId('');
  };

  const closeForm = () => { setSelectedContact(null); setIsNew(false); };
  const saveForm = () => {
    // Persist CVs to the underlying mock contact so other screens (Opportunities) see them
    if (selectedContact && !isNew) {
      const idx = contacts.findIndex(c => c.id === selectedContact.id);
      if (idx >= 0) contacts[idx] = { ...contacts[idx], cvs: contactCvs };
    }
    toast.success(isNew ? `Contact "${formData.firstName} ${formData.lastName}" created` : `Contact "${formData.firstName} ${formData.lastName}" saved`);
    closeForm();
  };

  const handleCvUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const cv: ContactCv = {
        id: `cv-${Date.now()}`,
        fileName: file.name,
        document: reader.result as string,
        mimeType: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString().split('T')[0],
        isPrimary: contactCvs.length === 0,
      };
      setContactCvs(prev => [...prev, cv]);
    };
    reader.readAsDataURL(file);
  };
  const setPrimaryCv = (id: string) => setContactCvs(prev => prev.map(cv => ({ ...cv, isPrimary: cv.id === id })));
  const removeCv = (id: string) => setContactCvs(prev => {
    const next = prev.filter(cv => cv.id !== id);
    // If we removed the primary, promote the first remaining to primary
    if (next.length > 0 && !next.some(cv => cv.isPrimary)) next[0].isPrimary = true;
    return next;
  });
  const updateCvLabel = (id: string, label: string) => setContactCvs(prev => prev.map(cv => cv.id === id ? { ...cv, label } : cv));

  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const filtered = useMemo(() => {
    return contacts.filter(c => {
      if (typeFilter && c.contactType !== typeFilter) return false;
      if (countryFilter.length > 0 && (!c.country || !countryFilter.includes(c.country))) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const companyName = c.company || (c.accountId ? getAccountById(c.accountId)?.name : '') || '';
        if (
          !`${c.firstName} ${c.lastName}`.toLowerCase().includes(q) &&
          !c.email.toLowerCase().includes(q) &&
          !companyName.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [typeFilter, countryFilter, searchTerm]);

  const filteredIds = filtered.map(c => c.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const contactContracts = selectedContact ? contracts.filter(c => c.contactId === selectedContact.id) : [];
  const contactTimesheets = selectedContact ? timesheets.filter(t => t.contactId === selectedContact.id) : [];

  const hasActiveFilters = !!searchTerm || !!typeFilter || countryFilter.length > 0;

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="contacts" />
      <PageHeader title="Contacts" subtitle={`${filtered.length} of ${contacts.length} contacts`}
        action={<div className="flex items-center gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <Button onClick={openNewForm}><Plus className="h-4 w-4 mr-2" />Add Contact</Button>
          <Button variant="secondary" disabled={selectedIds.length !== 1}
            title={selectedIds.length === 1 ? 'Raise an opportunity for the selected contact' : 'Select a single contact to enable'}
            onClick={() => setOppWizardOpen(true)}>
            <Briefcase className="h-4 w-4 mr-2" /> Raise Opportunity
          </Button>
        </div>} />

      {(() => {
        const c = contacts.find(x => x.id === selectedIds[0]);
        return (
          <RaiseOpportunityForm
            open={oppWizardOpen}
            onOpenChange={setOppWizardOpen}
            origin={c ? { kind: 'contact', record: c } : null}
            onCreated={() => setSelectedIds([])}
          />
        );
      })()}

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search name, email, account..." />
          <SinglePill label="Type" value={typeFilter} onChange={setTypeFilter}
            options={contactTypes.map(t => ({ value: t, label: t, count: contacts.filter(c => c.contactType === t).length }))} />
          <MultiPill label="Country" values={countryFilter} onChange={setCountryFilter}
            options={uniqueCountries.map(c => ({ value: c, label: c, count: contacts.filter(x => x.country === c).length }))} />
        </div>
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {typeFilter && <FilterChip label={`Type: ${typeFilter}`} onRemove={() => setTypeFilter('')} />}
            {countryFilter.length > 0 && <FilterChip label={`Country: ${countryFilter.join(', ')}`} onRemove={() => setCountryFilter([])} />}
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setSearchTerm(''); setTypeFilter(''); setCountryFilter([]); }}>
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
              <TableHead>Name</TableHead>
              {typeFilter !== 'Permanent Employee' && <TableHead>Account</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead>Email</TableHead>
              {(!typeFilter || typeFilter === 'Consultant' || typeFilter === 'Permanent Employee') && <TableHead>Skills</TableHead>}
              {(!typeFilter || typeFilter === 'Consultant' || typeFilter === 'Permanent Employee') && <TableHead>Interviewer</TableHead>}
              {(!typeFilter || typeFilter === 'Consultant' || typeFilter === 'Permanent Employee') && <TableHead>Assigned</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={(!typeFilter || typeFilter === 'Consultant' || typeFilter === 'Permanent Employee') ? 8 : 5} className="text-center py-8 text-muted-foreground">No contacts match the current filters.</TableCell></TableRow>
            ) : filtered.map(contact => (
              <TableRow key={contact.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(contact.id)} onCheckedChange={c => toggleOne(contact.id, !!c)} /></TableCell>
                <TableCell className="font-medium" onClick={() => openForm(contact)}>{contact.firstName} {contact.lastName}</TableCell>
                {typeFilter !== 'Permanent Employee' && <TableCell onClick={() => openForm(contact)}>{contact.company || (contact.accountId ? getAccountById(contact.accountId)?.name : '—')}</TableCell>}
                <TableCell onClick={() => openForm(contact)}><Badge variant="outline" className="text-xs">{contact.contactType}</Badge></TableCell>
                <TableCell className="text-sm" onClick={() => openForm(contact)}>{contact.email}</TableCell>
                {(!typeFilter || typeFilter === 'Consultant' || typeFilter === 'Permanent Employee') && (
                  <TableCell onClick={() => openForm(contact)}>
                    <div className="flex gap-1 flex-wrap">{contact.skillset?.slice(0, 3).map(s => (<Badge key={s} variant="secondary" className="text-xs">{s}</Badge>))}</div>
                  </TableCell>
                )}
                {(!typeFilter || typeFilter === 'Consultant' || typeFilter === 'Permanent Employee') && (
                  <TableCell onClick={() => openForm(contact)}>
                    {contact.isInterviewer ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" title="Interviewer" /> : '—'}
                  </TableCell>
                )}
                {(!typeFilter || typeFilter === 'Consultant' || typeFilter === 'Permanent Employee') && (
                  <TableCell onClick={() => openForm(contact)}>
                    {(contact.contactType === 'Consultant' || contact.contactType === 'Permanent Employee') && <span className={`inline-block h-2.5 w-2.5 rounded-full ${contact.available ? 'bg-emerald-500' : 'bg-red-400'}`} title={contact.available ? 'Yes' : 'No'} />}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selectedContact} onOpenChange={closeForm}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedContact && (
            <>
              <SheetHeader><SheetTitle>{isNew ? 'New Contact' : `${formData.firstName} ${formData.lastName}`}</SheetTitle></SheetHeader>
              {(() => {
                const ct = formData.contactType;
                const isConsultantOrEmployee = ct === 'Consultant' || ct === 'Permanent Employee';
                const showAccount = ct !== 'Permanent Employee';
                return (
                  <Tabs defaultValue="general" className="mt-6">
                    <TabsList>
                      <TabsTrigger value="general">General</TabsTrigger>
                      {isConsultantOrEmployee && <TabsTrigger value="professional">Professional</TabsTrigger>}
                      {isConsultantOrEmployee && <TabsTrigger value="skills">Skills ({contactSkills.length})</TabsTrigger>}
                      {isConsultantOrEmployee && <TabsTrigger value="cvs">CVs ({contactCvs.length})</TabsTrigger>}
                      {showAccount && <TabsTrigger value="contracts">Contracts ({contactContracts.length})</TabsTrigger>}
                      {isConsultantOrEmployee && <TabsTrigger value="timesheets">Timesheets ({contactTimesheets.length})</TabsTrigger>}
                    </TabsList>
                    <TabsContent value="general" className="mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <TextField label="First Name" value={formData.firstName} onChange={v => updateField('firstName', v)} required />
                        <TextField label="Last Name" value={formData.lastName} onChange={v => updateField('lastName', v)} required />
                        <EmailField label="Email" value={formData.email} onChange={v => updateField('email', v)} required />
                        <TextField label="Phone" value={formData.phone} onChange={v => updateField('phone', v)} />
                        <SelectField label="Type" value={formData.contactType} onChange={v => updateField('contactType', v)} required
                          options={contactTypes.map(t => ({ value: t, label: t }))} />
                        <TextField label="Country" value={formData.country} onChange={v => updateField('country', v)} />
                        <TextField label="Nationality" value={formData.nationality} onChange={v => updateField('nationality', v)} />
                        {showAccount && <TextField label="Account" value={formData.company} onChange={v => updateField('company', v)} />}
                      </div>
                    </TabsContent>
                    {isConsultantOrEmployee && (
                      <TabsContent value="professional" className="mt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <TextField label="Job Role" value={formData.jobRole} onChange={v => updateField('jobRole', v)} />
                          <div />
                          <SwitchField label="Interviewer" checked={formData.isInterviewer} onChange={v => updateField('isInterviewer', v)} />
                          <SwitchField label="Assigned" checked={formData.available} onChange={v => updateField('available', v)} />
                          <SwitchField label="Available" checked={formData.availableForWork} onChange={v => updateField('availableForWork', v)} />

                        </div>
                      </TabsContent>
                    )}
                    {isConsultantOrEmployee && (
                      <TabsContent value="skills" className="mt-4">
                        <div className="flex items-end gap-2 mb-4">
                          <div className="flex-1">
                            <LookupField label="Skill" value={addSkillId} onChange={setAddSkillId}
                              options={jdSkills.filter(s => !contactSkills.some(cs => cs.skillId === s.id)).map(s => ({ value: s.id, label: s.name }))} />
                          </div>
                          <div className="flex-1">
                            <LookupField label="Platform" value={addPlatformId} onChange={setAddPlatformId}
                              options={jdPlatforms.map(p => ({ value: p.id, label: p.name }))} />
                          </div>
                          <Button size="sm" disabled={!addSkillId || !addPlatformId} className="mb-0.5" onClick={() => {
                            setContactSkills(prev => [...prev, { skillId: addSkillId, platformId: addPlatformId }]);
                            setAddSkillId(''); setAddPlatformId('');
                          }}>
                            <Plus className="h-3.5 w-3.5 mr-1" />Add
                          </Button>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Skill</TableHead>
                              <TableHead>Platform</TableHead>
                              <TableHead className="w-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {contactSkills.length === 0 ? (
                              <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No skills assigned.</TableCell></TableRow>
                            ) : contactSkills.map((cs, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{jdSkills.find(s => s.id === cs.skillId)?.name || '—'}</TableCell>
                                <TableCell>{jdPlatforms.find(p => p.id === cs.platformId)?.name || '—'}</TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setContactSkills(prev => prev.filter((_, i) => i !== idx))}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TabsContent>
                    )}
                    {isConsultantOrEmployee && (
                      <TabsContent value="cvs" className="mt-4 space-y-3">
                        <div className="rounded-md border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground mb-2">
                            Upload one or more CVs for this contact. Mark one as <strong>primary</strong> — that's the default chosen when applying to opportunities. You can override the choice per opportunity.
                          </p>
                          <label className="inline-flex">
                            <input type="file" hidden onChange={(e) => { handleCvUpload(e.target.files?.[0] || null); e.currentTarget.value = ''; }} />
                            <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm cursor-pointer hover:bg-muted">
                              <Upload className="h-3.5 w-3.5" /> Upload CV
                            </span>
                          </label>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>File</TableHead>
                              <TableHead>Label</TableHead>
                              <TableHead>Uploaded</TableHead>
                              <TableHead className="w-24">Primary</TableHead>
                              <TableHead className="w-12"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {contactCvs.length === 0 ? (
                              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">No CVs uploaded yet.</TableCell></TableRow>
                            ) : contactCvs.map(cv => (
                              <TableRow key={cv.id}>
                                <TableCell className="text-sm flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-muted-foreground" />{cv.fileName}</TableCell>
                                <TableCell>
                                  <input
                                    value={cv.label || ''}
                                    onChange={(e) => updateCvLabel(cv.id, e.target.value)}
                                    placeholder="Optional label…"
                                    className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                                  />
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{cv.uploadedAt}</TableCell>
                                <TableCell>
                                  {cv.isPrimary ? (
                                    <Badge variant="secondary" className="gap-1 text-xs"><Star className="h-3 w-3 fill-current" /> Primary</Badge>
                                  ) : (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setPrimaryCv(cv.id)}>
                                      <Star className="h-3 w-3 mr-1" /> Set primary
                                    </Button>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCv(cv.id)}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TabsContent>
                    )}
                    {showAccount && (
                      <TabsContent value="contracts" className="mt-4">
                        <Table><TableHeader><TableRow><TableHead>Contract #</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                          <TableBody>{contactContracts.map(c => (<TableRow key={c.id}><TableCell className="font-mono text-xs">{c.contractNumber}</TableCell><TableCell>{c.name}</TableCell><TableCell><StatusBadge status={c.status} /></TableCell></TableRow>))}</TableBody>
                        </Table>
                      </TabsContent>
                    )}
                    {isConsultantOrEmployee && (
                      <TabsContent value="timesheets" className="mt-4">
                        <Table><TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Week</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                          <TableBody>{contactTimesheets.map(t => (<TableRow key={t.id}><TableCell className="font-mono text-xs">{t.reference}</TableCell><TableCell>{t.weekStart}</TableCell><TableCell>{t.totalHours}</TableCell><TableCell><StatusBadge status={t.status} /></TableCell></TableRow>))}</TableBody>
                        </Table>
                      </TabsContent>
                    )}
                  </Tabs>
                );
              })()}
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button variant="outline" onClick={closeForm}>Close</Button>
                <Button onClick={saveForm}>Save</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
