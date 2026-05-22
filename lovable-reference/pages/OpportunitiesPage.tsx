import { useMemo, useState, useRef } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Plus, Briefcase, FileText, Trash2, Upload, ExternalLink, Send, X, Building2, Sparkles, UserPlus, ChevronsUpDown, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { HeaderSelectionBar } from '@/components/HeaderSelectionBar';
import { TextField, TextAreaField, DateField, SelectField } from '@/components/FormField';
import { SearchPill, SinglePill, FilterChip } from '@/components/FilterPills';
import { opportunities as initialOpps, opportunityMaterials as initialMats, onboardingCandidates, contacts as allContacts, accounts, prospects, getAccountById, getContactById, getProspectById } from '@/data/mock-data';
import type { Opportunity, OpportunityStatus, OpportunitySource, OpportunityMaterial, RateUnit, CurrencyCode, ContactCvSelection, ContactRateLine, CandidateRateLine, OpportunityClientLinkType, ApplicantStatus } from '@/types/crm';
import { AddOpportunityWizard, computeMargin } from '@/components/opportunity/AddOpportunityWizard';
import { SendOpportunityProfilesDialog } from '@/components/opportunity/SendOpportunityProfilesDialog';
import { TutorialVideoButton } from '@/components/TutorialVideoDialog';
import { useConfirm } from '@/components/ConfirmDialog';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STATUSES: OpportunityStatus[] = ['New', 'Interview Booked', 'Won', 'Lost'];
const SOURCES: OpportunitySource[] = ['From Prospect', 'From Existing Client', 'From New Client', 'From Existing Consultant'];
const RATE_UNITS: RateUnit[] = ['Hour', 'Day'];
const CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'RON'];

const statusRowColor: Record<OpportunityStatus, string> = {
  'New': 'bg-muted/30',
  'Interview Booked': 'bg-blue-50 dark:bg-blue-950/20',
  'Won': 'bg-emerald-50 dark:bg-emerald-950/20',
  'Lost': 'bg-red-50 dark:bg-red-950/20',
};

function clientLabel(o: Opportunity): string {
  if (o.clientLinkType === 'Account') return getAccountById(o.accountId || '')?.name || '—';
  if (o.clientLinkType === 'Prospect') {
    const p = getProspectById(o.prospectId || '');
    return p ? `${p.companyName} (Prospect)` : '—';
  }
  if (o.clientLinkType === 'Contact') {
    const c = getContactById(o.sourceContactId || '');
    return c ? `${c.firstName} ${c.lastName} (Contact)` : '—';
  }
  return o.freeClientName || '—';
}

export default function OpportunitiesPage() {
  const [items, setItems] = useState<Opportunity[]>([...initialOpps]);
  const [materials, setMaterials] = useState<OpportunityMaterial[]>([...initialMats]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => setExpandedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [form, setForm] = useState<any>({});
  const [activeTab, setActiveTab] = useState('details');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendOpp, setSendOpp] = useState<Opportunity | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newMaterial, setNewMaterial] = useState<{ fileName: string; sharedDate: string; description: string; document?: string; documentMimeType?: string; documentSize?: number }>({ fileName: '', sharedDate: format(new Date(), 'yyyy-MM-dd'), description: '' });
  const confirm = useConfirm();

  const openSendFor = (o: Opportunity) => { setSendOpp(o); setSendOpen(true); };
  const persistCvSelections = (oppId: string, selections: ContactCvSelection[]) => {
    setItems(prev => prev.map(o => o.id === oppId ? { ...o, contactCvSelections: selections } : o));
    const idx = initialOpps.findIndex(o => o.id === oppId);
    if (idx >= 0) initialOpps[idx] = { ...initialOpps[idx], contactCvSelections: selections };
    if (selected?.id === oppId) setForm((f: any) => ({ ...f, contactCvSelections: selections }));
  };

  const filtered = useMemo(() => items.filter(o => {
    if (statusFilter !== 'All' && o.status !== statusFilter) return false;
    if (sourceFilter && o.source !== sourceFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!`${o.opportunityNumber} ${o.role} ${clientLabel(o)}`.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [items, statusFilter, sourceFilter, searchTerm]);

  const filteredIds = filtered.map(o => o.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (c: boolean) => setSelectedIds(c ? filteredIds : []);
  const toggleOne = (id: string, c: boolean) => setSelectedIds(c ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const openForm = (o: Opportunity) => {
    setSelected(o);
    setForm({ ...o });
    setActiveTab('details');
  };
  const closeForm = () => setSelected(null);
  const saveForm = () => {
    if (!selected) return;
    setItems(prev => prev.map(o => o.id === selected.id ? { ...o, ...form } : o));
    // mutate the underlying mock array so other pages see changes
    const idx = initialOpps.findIndex(o => o.id === selected.id);
    if (idx >= 0) initialOpps[idx] = { ...initialOpps[idx], ...form };
    toast.success('Opportunity saved');
    closeForm();
  };
  const updateField = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const updateApplicantStatus = (oppId: string, kind: 'candidate' | 'contact', applicantId: string, status: ApplicantStatus) => {
    setItems(prev => prev.map(o => {
      if (o.id !== oppId) return o;
      if (kind === 'candidate') {
        const existing = o.candidateRates || [];
        const has = existing.some(l => l.candidateId === applicantId);
        const candidateRates: CandidateRateLine[] = has
          ? existing.map(l => l.candidateId === applicantId ? { ...l, applicantStatus: status } : l)
          : [...existing, { candidateId: applicantId, unit: 'Hour', applicantStatus: status }];
        return { ...o, candidateRates };
      }
      const existing = o.contactRates || [];
      const has = existing.some(l => l.contactId === applicantId);
      const contactRates: ContactRateLine[] = has
        ? existing.map(l => l.contactId === applicantId ? { ...l, applicantStatus: status } : l)
        : [...existing, { contactId: applicantId, unit: 'Hour', applicantStatus: status }];
      return { ...o, contactRates };
    }));
    const idx = initialOpps.findIndex(o => o.id === oppId);
    if (idx >= 0) {
      const o = initialOpps[idx];
      if (kind === 'candidate') {
        const existing = o.candidateRates || [];
        const has = existing.some(l => l.candidateId === applicantId);
        initialOpps[idx] = { ...o, candidateRates: has
          ? existing.map(l => l.candidateId === applicantId ? { ...l, applicantStatus: status } : l)
          : [...existing, { candidateId: applicantId, unit: 'Hour', applicantStatus: status }] };
      } else {
        const existing = o.contactRates || [];
        const has = existing.some(l => l.contactId === applicantId);
        initialOpps[idx] = { ...o, contactRates: has
          ? existing.map(l => l.contactId === applicantId ? { ...l, applicantStatus: status } : l)
          : [...existing, { contactId: applicantId, unit: 'Hour', applicantStatus: status }] };
      }
    }
    if (selected?.id === oppId) {
      setForm((f: any) => {
        if (kind === 'candidate') {
          const existing: CandidateRateLine[] = f.candidateRates || [];
          const has = existing.some(l => l.candidateId === applicantId);
          return { ...f, candidateRates: has
            ? existing.map(l => l.candidateId === applicantId ? { ...l, applicantStatus: status } : l)
            : [...existing, { candidateId: applicantId, unit: 'Hour', applicantStatus: status }] };
        }
        const existing: ContactRateLine[] = f.contactRates || [];
        const has = existing.some(l => l.contactId === applicantId);
        return { ...f, contactRates: has
          ? existing.map(l => l.contactId === applicantId ? { ...l, applicantStatus: status } : l)
          : [...existing, { contactId: applicantId, unit: 'Hour', applicantStatus: status }] };
      });
    }
  };

  const opportunityMats = selected ? materials.filter(m => m.opportunityId === selected.id) : [];

  const handleFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewMaterial(p => ({ ...p, fileName: p.fileName || file.name, document: reader.result as string, documentMimeType: file.type, documentSize: file.size }));
    reader.readAsDataURL(file);
  };

  const addMaterial = () => {
    if (!selected || !newMaterial.fileName) return;
    const m: OpportunityMaterial = {
      id: `om-${Date.now()}`,
      opportunityId: selected.id,
      fileName: newMaterial.fileName,
      sharedDate: newMaterial.sharedDate,
      description: newMaterial.description,
      document: newMaterial.document,
      documentMimeType: newMaterial.documentMimeType,
      documentSize: newMaterial.documentSize,
    };
    setMaterials(prev => [m, ...prev]);
    initialMats.push(m);
    setNewMaterial({ fileName: '', sharedDate: format(new Date(), 'yyyy-MM-dd'), description: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast.success('Material added');
  };

  const removeMaterial = async (id: string) => {
    const ok = await confirm({ title: 'Delete material', description: 'Are you sure you want to delete this material? This action cannot be undone.' });
    if (!ok) return;
    setMaterials(prev => prev.filter(m => m.id !== id));
    const i = initialMats.findIndex(m => m.id === id);
    if (i >= 0) initialMats.splice(i, 1);
    toast.success('Material removed');
  };

  const previewMaterial = (m: OpportunityMaterial) => {
    try {
      let blob: Blob;
      if (m.document) {
        const [meta, b64] = m.document.split(',');
        const mime = m.documentMimeType || /data:(.*?);base64/.exec(meta)?.[1] || 'application/octet-stream';
        const byteString = atob(b64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        blob = new Blob([ab], { type: mime });
      } else {
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${m.fileName}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#f3f4f6;color:#0f172a}
.page{max-width:800px;margin:32px auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:48px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
h1{font-size:20px;margin:0 0 8px}.muted{color:#64748b;font-size:13px}
.banner{margin-top:24px;padding:12px 16px;border:1px dashed #cbd5e1;border-radius:6px;color:#475569;font-size:13px}
.body{margin-top:24px;line-height:1.6;font-size:14px}</style></head><body>
<div class="page"><h1>${m.fileName}</h1>
<div class="muted">Shared on ${m.sharedDate}</div>
${m.description ? `<div class="body">${m.description}</div>` : ''}
<div class="banner">Preview placeholder — this prototype item does not have a real file attached. Uploaded files will preview inline in the browser.</div>
</div></body></html>`;
        blob = new Blob([html], { type: 'text/html' });
      }
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank', 'noopener,noreferrer');
      if (!w) toast.error('Unable to open preview — please allow pop-ups');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error(err);
      toast.error('Could not preview file');
    }
  };

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="opportunities" />
      <PageHeader title="Opportunities" subtitle={`${filtered.length} of ${items.length} opportunities`}
        action={
          <div className="flex items-center gap-2">
            <Button onClick={() => setWizardOpen(true)}><Plus className="h-4 w-4 mr-2" />Add New Opportunity</Button>
            <Button variant="default" disabled={selectedIds.length !== 1}
              title={selectedIds.length === 1 ? 'Send candidate + contact CVs to the client' : 'Select a single opportunity to enable'}
              onClick={() => {
                const o = items.find(x => x.id === selectedIds[0]);
                if (o) openSendFor(o);
              }}>
              <Send className="h-4 w-4 mr-2" /> Send Profiles
            </Button>
            <TutorialVideoButton
              entityLabel="Opportunities"
              videos={[{
                id: 'opportunities-overview',
                title: 'How to Create, Manage and Progress Opportunities',
                description: 'Sources, the wizard, applicant lifecycle, CV library, margin and Outlook send',
                duration: '10:49',
                videoUrl: '/tutorials/opportunities.mp4',
              }]}
            />
          </div>
        } />

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search number, role, client..." />
          <SinglePill label="Status" value={statusFilter === 'All' ? '' : statusFilter} onChange={v => setStatusFilter(v || 'All')}
            options={STATUSES.map(s => ({ value: s, label: s, count: items.filter(o => o.status === s).length }))} />
          <SinglePill label="Source" value={sourceFilter} onChange={setSourceFilter}
            options={SOURCES.map(s => ({ value: s, label: s, count: items.filter(o => o.source === s).length }))} />
        </div>
        {(searchTerm || statusFilter !== 'All' || sourceFilter) && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter !== 'All' && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('All')} />}
            {sourceFilter && <FilterChip label={`Source: ${sourceFilter}`} onRemove={() => setSourceFilter('')} />}
          </div>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
              <TableHead className="w-8"></TableHead>
              <TableHead>Opportunity #</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Candidates / Contacts</TableHead>
              <TableHead>Opp. Rate</TableHead>
              <TableHead>Margin</TableHead>
              <TableHead>Closing</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No opportunities yet. Click "Add New Opportunity" to start.</TableCell></TableRow>
            ) : filtered.map(o => {
              const m = computeMargin(o.opportunityRate, o.opportunityRateUnit, o.candidateRate, o.candidateRateUnit);
              const isExpanded = expandedIds.has(o.id);
              const totalApplicants = o.candidateIds.length + o.contactIds.length;
              return (
                <>
                <TableRow key={o.id} className={`cursor-pointer hover:bg-muted/50 ${statusRowColor[o.status]}`}>
                  <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(o.id)} onCheckedChange={c => toggleOne(o.id, !!c)} /></TableCell>
                  <TableCell onClick={e => { e.stopPropagation(); toggleExpand(o.id); }}>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={totalApplicants === 0} aria-label={isExpanded ? 'Collapse' : 'Expand'}>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                  <TableCell className="font-mono text-xs" onClick={() => openForm(o)}>{o.opportunityNumber}</TableCell>
                  <TableCell className="font-medium" onClick={() => openForm(o)}>{o.role || '—'}</TableCell>
                  <TableCell className="text-sm" onClick={() => openForm(o)}>{clientLabel(o)}</TableCell>
                  <TableCell className="text-xs" onClick={() => openForm(o)}><Badge variant="outline">{o.source}</Badge></TableCell>
                  <TableCell className="text-xs" onClick={() => openForm(o)}>{o.candidateIds.length}c / {o.contactIds.length}p</TableCell>
                  <TableCell className="text-sm" onClick={() => openForm(o)}>{o.opportunityRate != null ? `${o.opportunityRate} ${o.currencyCode}/${o.opportunityRateUnit.toLowerCase()}` : '—'}</TableCell>
                  <TableCell className="text-xs" onClick={() => openForm(o)}>
                    {m.hour != null ? (
                      <div className="flex flex-col">
                        <span className={m.hour < 0 ? 'text-destructive' : 'text-emerald-600'}>{m.hour.toFixed(2)} /h</span>
                        <span className={m.day! < 0 ? 'text-destructive' : 'text-emerald-600'}>{m.day!.toFixed(2)} /d</span>
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-sm" onClick={() => openForm(o)}>{o.closingDate || '—'}</TableCell>
                  <TableCell onClick={() => openForm(o)}><StatusBadge status={o.status} /></TableCell>
                </TableRow>
                {isExpanded && totalApplicants > 0 && (
                  <TableRow key={`${o.id}-exp`} className="bg-muted/20 hover:bg-muted/20">
                    <TableCell colSpan={11} className="p-0">
                      <ApplicantsExpandedView opportunity={o} onChangeStatus={(kind, applicantId, status) => updateApplicantStatus(o.id, kind, applicantId, status)} />
                    </TableCell>
                  </TableRow>
                )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AddOpportunityWizard open={wizardOpen} onOpenChange={setWizardOpen} onCreated={(o) => setItems(prev => [o, ...prev])} />
      <SendOpportunityProfilesDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        opportunity={sendOpp}
        onCvSelectionChange={(sel) => sendOpp && persistCvSelections(sendOpp.id, sel)}
        onSent={() => {
          if (!sendOpp) return;
          (sendOpp.candidateIds || []).forEach(id => updateApplicantStatus(sendOpp.id, 'candidate', id, 'Sent'));
          (sendOpp.contactIds || []).forEach(id => updateApplicantStatus(sendOpp.id, 'contact', id, 'Sent'));
        }}
      />

      <Sheet open={!!selected} onOpenChange={(open) => !open && closeForm()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-muted-foreground">{selected.opportunityNumber}</span>
                    <span>· {form.role || 'Opportunity'}</span>
                  </div>
                  <Button size="sm" variant="default" className="mr-8" onClick={() => openSendFor(selected)}>
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Send Profiles
                  </Button>
                </SheetTitle>
              </SheetHeader>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="linked">Applicants</TabsTrigger>
                  <TabsTrigger value="materials">Materials ({opportunityMats.length})</TabsTrigger>
                  <TabsTrigger value="outcome">Outcome</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-4 space-y-4">
                  <ClientEditor form={form} updateField={updateField} />
                  <div className="grid grid-cols-2 gap-4">
                    <TextField label="Role" value={form.role || ''} onChange={(v) => updateField('role', v)} className="col-span-2" />
                    <TextField label="Opportunity Rate" type="number" value={form.opportunityRate?.toString() || ''} onChange={(v) => updateField('opportunityRate', v ? Number(v) : undefined)} />
                    <SelectField label="Rate Unit" value={form.opportunityRateUnit} onChange={(v) => updateField('opportunityRateUnit', v)}
                      options={RATE_UNITS.map(u => ({ value: u, label: `Per ${u}` }))} />
                    <SelectField label="Currency" value={form.currencyCode} onChange={(v) => updateField('currencyCode', v)}
                      options={CURRENCIES.map(c => ({ value: c, label: c }))} />
                    <div />
                    <DateField label="Start Date" value={form.startDate || ''} onChange={(v) => updateField('startDate', v)} />
                    <DateField label="Closing Date" value={form.closingDate || ''} onChange={(v) => updateField('closingDate', v)} />
                    <SelectField label="Status" value={form.status} onChange={(v) => updateField('status', v)}
                      options={STATUSES.map(s => ({ value: s, label: s }))} className="col-span-2" />
                    <TextAreaField label="Opportunity Details" value={form.details || ''} onChange={(v) => updateField('details', v)} rows={4} className="col-span-2" />
                  </div>
                </TabsContent>

                <TabsContent value="linked" className="mt-4 space-y-6">
                  <CandidatesEditor form={form} updateField={updateField} />
                  <ContactsEditor form={form} updateField={updateField} />
                </TabsContent>

                <TabsContent value="materials" className="mt-4 space-y-4">
                  <div className="rounded-md border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Add a new material</p>
                      <span className="text-xs text-muted-foreground">One file per material · add as many as you need</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <TextField label="File Name" value={newMaterial.fileName} onChange={(v) => setNewMaterial({ ...newMaterial, fileName: v })} placeholder="e.g. Capability_Deck.pdf" required />
                      <DateField label="Shared Date" value={newMaterial.sharedDate} onChange={(v) => setNewMaterial({ ...newMaterial, sharedDate: v })} required />
                    </div>
                    <TextField label="Description" value={newMaterial.description} onChange={(v) => setNewMaterial({ ...newMaterial, description: v })} />
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Document <span className="text-destructive">*</span></label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={(e) => handleFile(e.target.files?.[0] || null)}
                        className="block w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                      />
                      {newMaterial.document && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Attached: {newMaterial.fileName}
                          {newMaterial.documentSize ? ` · ${(newMaterial.documentSize / 1024).toFixed(1)} KB` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button size="sm" variant="ghost" onClick={() => { setNewMaterial({ fileName: '', sharedDate: format(new Date(), 'yyyy-MM-dd'), description: '' }); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Clear</Button>
                      <Button size="sm" onClick={addMaterial} disabled={!newMaterial.fileName || !newMaterial.document}><Plus className="h-3 w-3 mr-1" /> Add material</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shared materials ({opportunityMats.length})</p>
                    {opportunityMats.map(m => (
                      <div key={m.id} className="rounded-md border p-3 flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <button
                              type="button"
                              onClick={() => previewMaterial(m)}
                              className="font-medium text-sm text-primary hover:underline text-left"
                            >
                              {m.fileName}
                            </button>
                          </div>
                          {m.description && <p className="text-xs text-muted-foreground mt-1">{m.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{m.sharedDate}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeMaterial(m.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {opportunityMats.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No materials shared yet</p>}
                  </div>
                </TabsContent>

                <TabsContent value="outcome" className="mt-4 space-y-4">
                  <SelectField label="Status" value={form.status} onChange={(v) => updateField('status', v)}
                    options={STATUSES.map(s => ({ value: s, label: s }))} />
                  <TextAreaField label="Outcome Comments" value={form.outcomeComments || ''} onChange={(v) => updateField('outcomeComments', v)} rows={6}
                    placeholder="Capture why this was won/lost, what feedback was given, next steps…" />
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
    </div>
  );
}

// ============================================================
// Editor sub-components for the Linked Records tab
// ============================================================

const RATE_UNITS_LIST: RateUnit[] = ['Hour', 'Day'];

function MultiPickerInline({
  label, values, onChange, options, placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string; sub?: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1" />
          {placeholder || `Add ${label}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map(o => (
                <CommandItem key={o.value} value={`${o.label} ${o.sub || ''}`} onSelect={() => toggle(o.value)}>
                  <div className={cn('mr-2 h-3.5 w-3.5 rounded-sm border flex items-center justify-center', values.includes(o.value) ? 'bg-primary border-primary text-primary-foreground' : 'border-input')}>
                    {values.includes(o.value) && <span className="text-[10px]">✓</span>}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm">{o.label}</span>
                    {o.sub && <span className="text-xs text-muted-foreground">{o.sub}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ClientEditor({ form, updateField }: { form: any; updateField: (k: string, v: any) => void }) {
  const linkType: OpportunityClientLinkType = form.clientLinkType || 'Free Text';
  const cards: { id: OpportunityClientLinkType; icon: any; title: string; blurb: string }[] = [
    { id: 'Account', icon: Building2, title: 'Existing Client', blurb: 'Link to an Account.' },
    { id: 'Prospect', icon: Sparkles, title: 'Prospect', blurb: 'Link to a qualified Prospect.' },
    { id: 'Free Text', icon: UserPlus, title: 'New Client', blurb: 'Free-text client name.' },
    { id: 'Contact', icon: Users, title: 'Contact', blurb: 'Referred by an existing consultant.' },
  ];
  const setMode = (m: OpportunityClientLinkType) => {
    updateField('clientLinkType', m);
    if (m !== 'Account') updateField('accountId', undefined);
    if (m !== 'Prospect') updateField('prospectId', undefined);
    if (m !== 'Free Text') updateField('freeClientName', undefined);
    if (m !== 'Contact') updateField('sourceContactId', undefined);
    // also update source to keep them coherent
    if (m === 'Account') updateField('source', 'From Existing Client');
    if (m === 'Prospect') updateField('source', 'From Prospect');
    if (m === 'Free Text') updateField('source', 'From New Client');
    if (m === 'Contact') updateField('source', 'From Existing Consultant');
  };
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Source</h4>
      <div className="grid grid-cols-4 gap-2 mb-2">
        {cards.map(c => {
          const I = c.icon;
          const active = linkType === c.id;
          return (
            <button key={c.id} type="button" onClick={() => setMode(c.id)}
              className={cn('rounded-md border p-2.5 text-left transition', active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50')}>
              <div className="flex items-center gap-1.5 text-sm font-medium"><I className="h-3.5 w-3.5" />{c.title}</div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{c.blurb}</p>
            </button>
          );
        })}
      </div>
      {linkType === 'Account' && (
        <SelectField label="Account" value={form.accountId || ''} onChange={(v) => updateField('accountId', v)}
          options={accounts.map(a => ({ value: a.id, label: a.name }))} />
      )}
      {linkType === 'Prospect' && (
        <SelectField label="Prospect" value={form.prospectId || ''} onChange={(v) => updateField('prospectId', v)}
          options={prospects.map(p => ({ value: p.id, label: p.companyName }))} />
      )}
      {linkType === 'Free Text' && (
        <TextField label="Client Name" value={form.freeClientName || ''} onChange={(v) => updateField('freeClientName', v)} />
      )}
      {linkType === 'Contact' && (
        <SelectField label="Contact" value={form.sourceContactId || ''} onChange={(v) => updateField('sourceContactId', v)}
          options={allContacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}${c.jobRole ? ' — ' + c.jobRole : ''}` }))} />
      )}
    </div>
  );
}

function CandidatesEditor({ form, updateField }: { form: any; updateField: (k: string, v: any) => void }) {
  const ids: string[] = form.candidateIds || [];
  const lines: CandidateRateLine[] = form.candidateRates || [];
  const cvFileRef = useRef<Record<string, HTMLInputElement | null>>({});

  const setIds = (next: string[]) => {
    updateField('candidateIds', next);
    // prune lines for removed candidates
    updateField('candidateRates', lines.filter(l => next.includes(l.candidateId)));
  };
  const remove = (id: string) => setIds(ids.filter(x => x !== id));
  const getLine = (id: string): CandidateRateLine => {
    const c = onboardingCandidates.find(x => x.id === id);
    return lines.find(l => l.candidateId === id) || { candidateId: id, rate: c?.hourlyRateEur, unit: 'Hour', currency: form.currencyCode };
  };
  const setLine = (id: string, patch: Partial<CandidateRateLine>) => {
    const exists = lines.find(l => l.candidateId === id);
    const next = exists
      ? lines.map(l => l.candidateId === id ? { ...l, ...patch } : l)
      : [...lines, { ...getLine(id), ...patch }];
    updateField('candidateRates', next);
  };
  const handleCvUpload = (id: string, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLine(id, {
      cvOverrideFileName: file.name,
      cvOverrideDocument: reader.result as string,
      cvOverrideMimeType: file.type,
    });
    reader.readAsDataURL(file);
  };

  const options = onboardingCandidates
    .filter(c => !ids.includes(c.id))
    .map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}`, sub: c.candidateRole || '' }));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold">Candidates ({ids.length})</h4>
        <MultiPickerInline label="candidate" values={ids} onChange={setIds} options={options} placeholder="Add candidate" />
      </div>
      {ids.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <div className="space-y-2">
          {ids.map(id => {
            const c = onboardingCandidates.find(x => x.id === id);
            if (!c) return null;
            const line = getLine(id);
            const lineCurrency = line.currency || form.currencyCode;
            const sameCurrency = lineCurrency === form.currencyCode;
            const m = sameCurrency ? computeMargin(form.opportunityRate, form.opportunityRateUnit, line.rate, line.unit) : { hour: null, day: null };
            const cvName = line.cvOverrideFileName || c.cvFileName || '—';
            return (
              <div key={id} className="rounded border px-3 py-2 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{c.firstName} {c.lastName} <span className="text-muted-foreground font-normal">· {c.candidateRole || '—'}</span></span>
                  <div className="flex items-center gap-2">
                    {line.rate != null && (
                      <span className="text-xs text-muted-foreground">
                        Rate <strong className="text-foreground">{(line.unit === 'Hour' ? line.rate : line.rate / 8).toFixed(2)}</strong>/h · <strong className="text-foreground">{(line.unit === 'Day' ? line.rate : line.rate * 8).toFixed(2)}</strong>/d
                      </span>
                    )}
                    {m.hour != null ? (
                      <span className={`text-xs ${m.hour < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                        Margin <strong>{m.hour.toFixed(2)}</strong>/h · <strong>{m.day!.toFixed(2)}</strong>/d
                      </span>
                    ) : !sameCurrency && line.rate != null && form.opportunityRate != null && (
                      <span className="text-xs text-muted-foreground" title={`Cost in ${lineCurrency} · Sell in ${form.currencyCode}`}>Margin —  (FX)</span>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => remove(id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <TextField label="Candidate Rate" type="number" value={line.rate?.toString() || ''}
                    onChange={(v) => setLine(id, { rate: v ? Number(v) : undefined })} />
                  <SelectField label="Unit" value={line.unit}
                    onChange={(v) => setLine(id, { unit: v as RateUnit })}
                    options={RATE_UNITS_LIST.map(u => ({ value: u, label: `Per ${u}` }))} />
                  <SelectField label="Currency" value={lineCurrency}
                    onChange={(v) => setLine(id, { currency: v as CurrencyCode })}
                    options={CURRENCIES.map(c => ({ value: c, label: c }))} />
                  <SelectField label="Applicant Status" value={line.applicantStatus || 'Drafted'}
                    onChange={(v) => setLine(id, { applicantStatus: v as ApplicantStatus })}
                    options={(['Drafted', 'Sent', 'Accepted', 'Rejected'] as ApplicantStatus[]).map(s => ({ value: s, label: s }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">CV to apply with</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 text-xs rounded border px-2 py-1.5 bg-muted/30 truncate">
                      <FileText className="h-3 w-3 inline mr-1" />
                      {cvName}
                      {line.cvOverrideFileName && <span className="ml-2 text-[10px] uppercase tracking-wider text-primary">override</span>}
                    </div>
                    <input
                      ref={(el) => { cvFileRef.current[id] = el; }}
                      type="file"
                      className="hidden"
                      accept="application/pdf,.pdf,.doc,.docx"
                      onChange={(e) => handleCvUpload(id, e.target.files?.[0] || null)}
                    />
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => cvFileRef.current[id]?.click()}>
                      <Upload className="h-3 w-3 mr-1" /> Replace
                    </Button>
                    {line.cvOverrideFileName && (
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setLine(id, { cvOverrideFileName: undefined, cvOverrideDocument: undefined, cvOverrideMimeType: undefined })}>
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ContactsEditor({ form, updateField }: { form: any; updateField: (k: string, v: any) => void }) {
  const ids: string[] = form.contactIds || [];
  const rates: ContactRateLine[] = form.contactRates || [];
  const cvSelections: ContactCvSelection[] = form.contactCvSelections || [];

  const setIds = (next: string[]) => {
    updateField('contactIds', next);
    updateField('contactRates', rates.filter(r => next.includes(r.contactId)));
    updateField('contactCvSelections', cvSelections.filter(s => next.includes(s.contactId)));
  };
  const remove = (id: string) => setIds(ids.filter(x => x !== id));
  const setRate = (id: string, patch: Partial<ContactRateLine>) => {
    const exists = rates.find(r => r.contactId === id);
    const next = exists
      ? rates.map(r => r.contactId === id ? { ...r, ...patch } : r)
      : [...rates, { contactId: id, rate: undefined, unit: 'Hour' as RateUnit, ...patch }];
    updateField('contactRates', next);
  };
  const setCv = (id: string, cvId: string) => {
    const exists = cvSelections.find(s => s.contactId === id);
    const next = exists
      ? cvSelections.map(s => s.contactId === id ? { ...s, cvId } : s)
      : [...cvSelections, { contactId: id, cvId }];
    updateField('contactCvSelections', next);
  };

  const consultantOptions = allContacts
    .filter(c => c.contactType === 'Consultant' && !ids.includes(c.id))
    .map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}`, sub: c.email }));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold">Contacts ({ids.length}) <span className="text-xs font-normal text-muted-foreground">— our consultants</span></h4>
        <MultiPickerInline label="contact" values={ids} onChange={setIds} options={consultantOptions} placeholder="Add contact" />
      </div>
      {ids.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <div className="space-y-2">
          {ids.map(id => {
            const c = getContactById(id);
            if (!c) return null;
            const line: ContactRateLine = rates.find(r => r.contactId === id) || { contactId: id, rate: undefined, unit: 'Hour' as RateUnit, currency: form.currencyCode };
            const lineCurrency = line.currency || form.currencyCode;
            const sameCurrency = lineCurrency === form.currencyCode;
            const m = sameCurrency ? computeMargin(form.opportunityRate, form.opportunityRateUnit, line.rate, line.unit) : { hour: null, day: null };
            const cvs = c.cvs || [];
            const currentCvId = cvSelections.find(s => s.contactId === id)?.cvId
              || cvs.find(cv => cv.isPrimary)?.id || cvs[0]?.id || '';
            return (
              <div key={id} className="rounded border px-3 py-2 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{c.firstName} {c.lastName} <span className="text-muted-foreground font-normal">· {c.contactType}</span></span>
                  <div className="flex items-center gap-2">
                    {m.hour != null ? (
                      <span className={`text-xs ${m.hour < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                        Margin <strong>{m.hour.toFixed(2)}</strong>/h · <strong>{m.day!.toFixed(2)}</strong>/d
                      </span>
                    ) : !sameCurrency && line.rate != null && form.opportunityRate != null && (
                      <span className="text-xs text-muted-foreground" title={`Cost in ${lineCurrency} · Sell in ${form.currencyCode}`}>Margin —  (FX)</span>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => remove(id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <TextField label="Contact Rate" type="number" value={line.rate?.toString() || ''}
                    onChange={(v) => setRate(id, { rate: v ? Number(v) : undefined })} />
                  <SelectField label="Unit" value={line.unit}
                    onChange={(v) => setRate(id, { unit: v as RateUnit })}
                    options={RATE_UNITS_LIST.map(u => ({ value: u, label: `Per ${u}` }))} />
                  <SelectField label="Currency" value={lineCurrency}
                    onChange={(v) => setRate(id, { currency: v as CurrencyCode })}
                    options={CURRENCIES.map(c => ({ value: c, label: c }))} />
                  <SelectField label="Applicant Status" value={line.applicantStatus || 'Drafted'}
                    onChange={(v) => setRate(id, { applicantStatus: v as ApplicantStatus })}
                    options={(['Drafted', 'Sent', 'Accepted', 'Rejected'] as ApplicantStatus[]).map(s => ({ value: s, label: s }))} />
                </div>
                {cvs.length === 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">No CV on file for this contact — add one on the Contact's record so it can be sent.</p>
                ) : (
                  <SelectField label="CV to apply with" value={currentCvId} onChange={(v) => setCv(id, v)}
                    options={cvs.map(cv => ({ value: cv.id, label: `${cv.fileName}${cv.label ? ' — ' + cv.label : ''}${cv.isPrimary ? ' ★' : ''}` }))} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const APPLICANT_STATUSES: ApplicantStatus[] = ['Drafted', 'Sent', 'Accepted', 'Rejected'];

const APPLICANT_STATUS_BADGE: Record<ApplicantStatus, string> = {
  Drafted: 'bg-muted text-foreground/80 border-border',
  Sent: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900',
  Accepted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
  Rejected: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-900',
};

function ApplicantsExpandedView({ opportunity, onChangeStatus }: {
  opportunity: Opportunity;
  onChangeStatus: (kind: 'candidate' | 'contact', applicantId: string, status: ApplicantStatus) => void;
}) {
  const rows: Array<{
    kind: 'candidate' | 'contact';
    id: string;
    name: string;
    type: string;
    rate?: number;
    unit: RateUnit;
    currency: CurrencyCode;
    status: ApplicantStatus;
  }> = [];

  for (const cid of opportunity.candidateIds) {
    const c = onboardingCandidates.find(x => x.id === cid);
    if (!c) continue;
    const line = opportunity.candidateRates?.find(l => l.candidateId === cid);
    rows.push({
      kind: 'candidate',
      id: cid,
      name: `${c.firstName} ${c.lastName}`,
      type: 'Candidate',
      rate: line?.rate ?? c.hourlyRateEur,
      unit: line?.unit ?? 'Hour',
      currency: line?.currency ?? opportunity.currencyCode,
      status: line?.applicantStatus ?? 'Drafted',
    });
  }
  for (const conId of opportunity.contactIds) {
    const c = getContactById(conId);
    if (!c) continue;
    const line = opportunity.contactRates?.find(l => l.contactId === conId);
    rows.push({
      kind: 'contact',
      id: conId,
      name: `${c.firstName} ${c.lastName}`,
      type: 'Contact (Consultant)',
      rate: line?.rate,
      unit: line?.unit ?? 'Hour',
      currency: line?.currency ?? opportunity.currencyCode,
      status: line?.applicantStatus ?? 'Drafted',
    });
  }

  return (
    <div className="px-12 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 uppercase tracking-wider">
        <Users className="h-3.5 w-3.5" /> Applicants ({rows.length})
      </div>
      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Full Name</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Rate</TableHead>
              <TableHead className="text-xs">Unit</TableHead>
              <TableHead className="text-xs">Currency</TableHead>
              <TableHead className="text-xs">Margin</TableHead>
              <TableHead className="text-xs w-44">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => {
              const sameCurrency = r.currency === opportunity.currencyCode;
              const m = sameCurrency ? computeMargin(opportunity.opportunityRate, opportunity.opportunityRateUnit, r.rate, r.unit) : { hour: null as number | null, day: null as number | null };
              return (
                <TableRow key={`${r.kind}-${r.id}`}>
                  <TableCell className="text-sm font-medium">{r.name}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="font-normal">{r.type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{r.rate != null ? r.rate : '—'}</TableCell>
                  <TableCell className="text-sm">{r.unit}</TableCell>
                  <TableCell className="text-sm">{r.currency}</TableCell>
                  <TableCell className="text-xs">
                    {m.hour != null ? (
                      <div className="flex flex-col">
                        <span className={m.hour < 0 ? 'text-destructive' : 'text-emerald-600'}>{m.hour.toFixed(2)} /h</span>
                        <span className={m.day! < 0 ? 'text-destructive' : 'text-emerald-600'}>{m.day!.toFixed(2)} /d</span>
                      </div>
                    ) : !sameCurrency && r.rate != null && opportunity.opportunityRate != null
                      ? <span className="text-muted-foreground" title={`Cost in ${r.currency} · Sell in ${opportunity.currencyCode}`}>— (FX)</span>
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <select
                      value={r.status}
                      onChange={(e) => onChangeStatus(r.kind, r.id, e.target.value as ApplicantStatus)}
                      className={cn(
                        'text-xs rounded-md border px-2 py-1 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary',
                        APPLICANT_STATUS_BADGE[r.status],
                      )}
                    >
                      {APPLICANT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
