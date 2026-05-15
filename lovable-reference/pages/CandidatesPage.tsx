import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, CheckCircle2, FileText, X, User, Mail, Phone, Briefcase, MapPin, Upload } from 'lucide-react';

import { RaiseOpportunityForm } from '@/components/opportunity/RaiseOpportunityForm';
import { onboardingCandidates, contacts } from '@/data/mock-data';
import type { OnboardingCandidate, CandidateStatus, CandidatePath, CandidateSource, Contact } from '@/types/crm';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { HeaderSelectionBar } from '@/components/HeaderSelectionBar';
import { TextField, TextAreaField, EmailField, DateField, SelectField, LookupField } from '@/components/FormField';
import { toast } from 'sonner';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover, DateRangeFilterPopover,
  ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getNumberFilter, getDateFilter,
  setTextFilter, setMultiFilter, setNumberFilter, setDateFilter, matchDateRange,
} from '@/components/ColumnFilters';
import { SearchPill, SinglePill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, type RelativeDateValue } from '@/components/FilterPills';

const candidateStatuses: CandidateStatus[] = ['Applied', 'Scheduled', 'Fit', 'Not Fit'];

const statusRowColors: Record<string, string> = {
  Applied: 'bg-muted/40',
  Scheduled: 'bg-amber-50 dark:bg-amber-950/20',
  Fit: 'bg-emerald-50 dark:bg-emerald-950/20',
  'Not Fit': 'bg-red-50 dark:bg-red-950/20',
};

const statusLegendColors: Record<string, string> = {
  Applied: 'bg-muted-foreground/30',
  Scheduled: 'bg-amber-400',
  Fit: 'bg-emerald-500',
  'Not Fit': 'bg-red-500',
};
const candidatePaths: CandidatePath[] = ['CIM to B2B', 'B2B seeking Contracts'];
const candidateSources: CandidateSource[] = ['Website', 'Recruiter', 'Referral'];

const dayOrder: Record<string, number> = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<OnboardingCandidate[]>([...onboardingCandidates]);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [pathFilter, setPathFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [appliedDateFilter, setAppliedDateFilter] = useState<RelativeDateValue>({ type: 'all' });
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedCandidate, setSelectedCandidate] = useState<OnboardingCandidate | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  
  const [viewInterviewer, setViewInterviewer] = useState<Contact | null>(null);
  
  const [oppWizardOpen, setOppWizardOpen] = useState(false);

  const openForm = (candidate: OnboardingCandidate) => {
    setIsNew(false);
    setSelectedCandidate(candidate);
    setFormData({
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone || '',
      path: candidate.path,
      candidateRole: candidate.candidateRole || '',
      cvFileName: candidate.cvFileName,
      cvDocument: candidate.cvDocument || '',
      cvMimeType: candidate.cvMimeType || '',
      cvSize: candidate.cvSize || 0,
      hourlyRateEur: candidate.hourlyRateEur,
      b2bEntityName: candidate.b2bEntityName || '',
      appliedDate: candidate.appliedDate,
      selectedSlots: candidate.selectedSlots,
      confirmedSlotId: candidate.confirmedSlotId || '',
      reviewerNotes: candidate.reviewerNotes || '',
      reviewedBy: candidate.reviewedBy || '',
      status: candidate.status,
      source: candidate.source || 'Website',
      createdContactId: candidate.createdContactId || '',
      createdAccountId: candidate.createdAccountId || '',
    });
  };

  const openNewForm = () => {
    setIsNew(true);
    setSelectedCandidate({} as OnboardingCandidate);
    setFormData({
      firstName: '', lastName: '', email: '', phone: '',
      path: 'B2B seeking Contracts', candidateRole: '', cvFileName: '', cvDocument: '', cvMimeType: '', cvSize: 0, hourlyRateEur: 0,
      b2bEntityName: '', appliedDate: new Date().toISOString().split('T')[0],
      selectedSlots: [], confirmedSlotId: '', reviewerNotes: '',
      reviewedBy: '', status: 'Applied', source: 'Website', createdContactId: '', createdAccountId: '',
    });
  };

  const closeForm = () => { setSelectedCandidate(null); setIsNew(false); };
  const saveForm = () => {
    if (selectedCandidate && selectedCandidate.id) {
      const dataToSave = { ...formData };
      // Ensure status reflects slot assignment at save time
      if (dataToSave.confirmedSlotId) {
        dataToSave.status = 'Scheduled';
      } else if (dataToSave.status === 'Scheduled') {
        dataToSave.status = 'Applied';
      }
      setCandidates(prev => prev.map(c => c.id === selectedCandidate.id ? { ...c, ...dataToSave } as OnboardingCandidate : c));
    }
    toast.success(isNew ? 'Candidate created' : 'Candidate saved');
    closeForm();
  };
  const updateField = (key: string, value: any) => setFormData(prev => {
    const updated = { ...prev, [key]: value };
    // Auto-set status based on slot assignment
    if (key === 'confirmedSlotId') {
      if (value) {
        updated.status = 'Scheduled';
      } else if (prev.status === 'Scheduled') {
        updated.status = 'Applied';
      }
    }
    return updated;
  });

  const handleCvFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setFormData(prev => ({
        ...prev,
        cvFileName: file.name,
        cvDocument: dataUrl,
        cvMimeType: file.type,
        cvSize: file.size,
      }));
    };
    reader.readAsDataURL(file);
  };

  const previewCv = () => {
    try {
      const fileName = formData.cvFileName || (selectedCandidate?.cvFileName ?? '');
      const dataUrl = formData.cvDocument || selectedCandidate?.cvDocument;
      const mime = formData.cvMimeType || selectedCandidate?.cvMimeType || 'application/pdf';
      let blob: Blob;
      if (dataUrl && typeof dataUrl === 'string' && dataUrl.includes(',')) {
        const b64 = dataUrl.split(',')[1];
        const byteString = atob(b64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        blob = new Blob([ab], { type: mime });
      } else {
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${fileName || 'CV'}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#f3f4f6;color:#0f172a}
.page{max-width:800px;margin:32px auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:48px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
h1{font-size:20px;margin:0 0 8px}.muted{color:#64748b;font-size:13px}
.banner{margin-top:24px;padding:12px 16px;border:1px dashed #cbd5e1;border-radius:6px;color:#475569;font-size:13px}</style></head><body>
<div class="page"><h1>${fileName || 'Candidate CV'}</h1>
<div class="muted">Mock candidate file</div>
<div class="banner">Preview placeholder — this prototype candidate does not have a real CV attached. Uploaded files will preview inline in the browser.</div>
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

  const handleApproveCreate = () => {
    toast.success(`Contact and Account created for ${formData.firstName} ${formData.lastName}`);
    updateField('createdContactId', `con-new-${Date.now()}`);
    updateField('createdAccountId', `acc-new-${Date.now()}`);
    setShowApproveDialog(false);
  };

  const filtered = useMemo(() => {
    return candidates.filter(c => {
      if (statusFilter && statusFilter !== 'All' && c.status !== statusFilter) return false;
      if (pathFilter && c.path !== pathFilter) return false;
      if (sourceFilter && (c.source || '') !== sourceFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const m = `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.b2bEntityName || '').toLowerCase().includes(q);
        if (!m) return false;
      }
      if (appliedDateFilter.type !== 'all') {
        const r = dateRangeFor(appliedDateFilter);
        if (!matchDateRange(c.appliedDate, r.from, r.to)) return false;
      }
      const name = getTextFilter(colFilters, 'name');
      if (name && !`${c.firstName} ${c.lastName}`.toLowerCase().includes(name.toLowerCase())) return false;
      const role = getTextFilter(colFilters, 'role');
      if (role && !(c.candidateRole || '').toLowerCase().includes(role.toLowerCase())) return false;
      const email = getTextFilter(colFilters, 'email');
      if (email && !c.email.toLowerCase().includes(email.toLowerCase())) return false;
      const pathCol = getMultiFilter(colFilters, 'path');
      if (pathCol.length > 0 && !pathCol.includes(c.path)) return false;
      const sourceCol = getMultiFilter(colFilters, 'source');
      if (sourceCol.length > 0 && !sourceCol.includes(c.source || '')) return false;
      const rate = getNumberFilter(colFilters, 'rate');
      if (rate.min && c.hourlyRateEur < Number(rate.min)) return false;
      if (rate.max && c.hourlyRateEur > Number(rate.max)) return false;
      const dateF = getDateFilter(colFilters, 'appliedDate');
      if (!matchDateRange(c.appliedDate, dateF.from, dateF.to)) return false;
      const entity = getTextFilter(colFilters, 'b2bEntity');
      if (entity && !(c.b2bEntityName || '').toLowerCase().includes(entity.toLowerCase())) return false;
      return true;
    });
  }, [statusFilter, pathFilter, sourceFilter, searchTerm, appliedDateFilter, colFilters, candidates]);

  const filteredIds = filtered.map(c => c.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const interviewerOptions = useMemo(() =>
    contacts.filter(c => c.isInterviewer).map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })),
  []);

  const getInterviewerName = (interviewerId?: string) => {
    if (!interviewerId) return 'Unassigned';
    const c = contacts.find(con => con.id === interviewerId);
    return c ? `${c.firstName} ${c.lastName}` : interviewerId;
  };

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="candidates" />
      <PageHeader title="Candidates" subtitle={`${filtered.length} of ${candidates.length} candidates`}
        action={
          <div className="flex items-center gap-2">
            <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
            <Button onClick={openNewForm}><Plus className="h-4 w-4 mr-2" />Add Candidate</Button>
            <Button
              variant="secondary"
              onClick={() => setOppWizardOpen(true)}
              disabled={selectedIds.length !== 1}
              title={selectedIds.length === 1 ? 'Raise an opportunity for the selected candidate' : 'Select a single candidate to enable'}
            >
              <Briefcase className="h-4 w-4 mr-2" />
              Raise Opportunity
            </Button>
          </div>
        } />

      {(() => {
        const c = candidates.find(x => x.id === selectedIds[0]);
        return (
          <RaiseOpportunityForm
            open={oppWizardOpen}
            onOpenChange={setOppWizardOpen}
            origin={c ? { kind: 'candidate', record: c } : null}
            onCreated={() => setSelectedIds([])}
          />
        );
      })()}

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Legend</span>
        {candidateStatuses.map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${statusLegendColors[s]}`} />
            <span className="text-xs text-muted-foreground">{s}</span>
          </div>
        ))}
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search name, email, B2B entity..." />
          <SinglePill label="Status" value={statusFilter === 'All' ? '' : statusFilter} onChange={v => setStatusFilter(v || 'All')}
            options={candidateStatuses.map(s => ({ value: s, label: s, count: candidates.filter(c => c.status === s).length }))} />
          <SinglePill label="Path" value={pathFilter} onChange={setPathFilter}
            options={candidatePaths.map(p => ({ value: p, label: p, count: candidates.filter(c => c.path === p).length }))} />
          <SinglePill label="Source" value={sourceFilter} onChange={setSourceFilter}
            options={candidateSources.map(s => ({ value: s, label: s, count: candidates.filter(c => c.source === s).length }))} />
          <DatePill label="Applied" value={appliedDateFilter} onChange={setAppliedDateFilter} dates={candidates.map(c => c.appliedDate)} />
        </div>
        {(searchTerm || (statusFilter && statusFilter !== 'All') || pathFilter || sourceFilter || appliedDateFilter.type !== 'all') && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter && statusFilter !== 'All' && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('All')} />}
            {pathFilter && <FilterChip label={`Path: ${pathFilter}`} onRemove={() => setPathFilter('')} />}
            {sourceFilter && <FilterChip label={`Source: ${sourceFilter}`} onRemove={() => setSourceFilter('')} />}
            {appliedDateFilter.type !== 'all' && <FilterChip label={`Applied: ${relativeDateLabel(appliedDateFilter)}`} onRemove={() => setAppliedDateFilter({ type: 'all' })} />}
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setSearchTerm(''); setStatusFilter('All'); setPathFilter(''); setSourceFilter(''); setAppliedDateFilter({ type: 'all' }); }}>
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
              <TableHead>Role <TextFilterPopover label="Role" value={getTextFilter(colFilters, 'role')} onChange={v => setTextFilter(setColFilters, 'role', v)} /></TableHead>
              <TableHead>Email <TextFilterPopover label="Email" value={getTextFilter(colFilters, 'email')} onChange={v => setTextFilter(setColFilters, 'email', v)} /></TableHead>
              <TableHead>Source <MultiSelectFilterPopover label="Source" options={candidateSources} selected={getMultiFilter(colFilters, 'source')} onChange={v => setMultiFilter(setColFilters, 'source', v)} /></TableHead>
              <TableHead>Path <MultiSelectFilterPopover label="Path" options={candidatePaths} selected={getMultiFilter(colFilters, 'path')} onChange={v => setMultiFilter(setColFilters, 'path', v)} /></TableHead>
              <TableHead>Rate (€/h) <NumberRangeFilterPopover label="Rate" min={getNumberFilter(colFilters, 'rate').min} max={getNumberFilter(colFilters, 'rate').max} onChange={(min, max) => setNumberFilter(setColFilters, 'rate', min, max)} /></TableHead>
              <TableHead>Daily Rate (€)</TableHead>
              <TableHead>B2B Entity <TextFilterPopover label="B2B Entity" value={getTextFilter(colFilters, 'b2bEntity')} onChange={v => setTextFilter(setColFilters, 'b2bEntity', v)} /></TableHead>
              <TableHead>Applied <DateRangeFilterPopover label="Applied" from={getDateFilter(colFilters, 'appliedDate').from} to={getDateFilter(colFilters, 'appliedDate').to} onChange={(f, t) => setDateFilter(setColFilters, 'appliedDate', f, t)} /></TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No candidates match the current filters.</TableCell></TableRow>
            ) : filtered.map(candidate => (
              <TableRow key={candidate.id} className={`cursor-pointer hover:bg-muted/50 ${statusRowColors[candidate.status] || ''}`}>
                <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(candidate.id)} onCheckedChange={c => toggleOne(candidate.id, !!c)} /></TableCell>
                <TableCell className="font-medium" onClick={() => openForm(candidate)}>{candidate.firstName} {candidate.lastName}</TableCell>
                <TableCell className="text-sm" onClick={() => openForm(candidate)}>{candidate.candidateRole || '—'}</TableCell>
                <TableCell className="text-sm" onClick={() => openForm(candidate)}>{candidate.email}</TableCell>
                <TableCell className="text-sm" onClick={() => openForm(candidate)}>{candidate.source || '—'}</TableCell>
                <TableCell className="text-sm" onClick={() => openForm(candidate)}>{candidate.path}</TableCell>
                <TableCell onClick={() => openForm(candidate)}>€{candidate.hourlyRateEur}</TableCell>
                <TableCell onClick={() => openForm(candidate)}>€{candidate.hourlyRateEur * 8}</TableCell>
                <TableCell className="text-sm" onClick={() => openForm(candidate)}>{candidate.b2bEntityName || '—'}</TableCell>
                <TableCell onClick={() => openForm(candidate)}>{candidate.appliedDate}</TableCell>
                <TableCell onClick={() => openForm(candidate)}><StatusBadge status={candidate.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selectedCandidate} onOpenChange={closeForm}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedCandidate && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  {isNew ? 'New Candidate' : `${formData.firstName} ${formData.lastName}`}
                  {!isNew && <StatusBadge status={formData.status} />}
                </SheetTitle>
              </SheetHeader>
              <Tabs defaultValue="general" className="mt-6">
                <TabsList>
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
                  <TabsTrigger value="review">Review</TabsTrigger>
                  {formData.status === 'Fit' && <TabsTrigger value="created">Created Records</TabsTrigger>}
                </TabsList>

                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Source</span>
                  <ToggleGroup type="single" value={formData.source || 'Website'} onValueChange={v => { if (v) updateField('source', v); }} className="border rounded-md p-0.5">
                    {candidateSources.map(s => (
                      <ToggleGroupItem key={s} value={s} className="text-xs px-3 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm">{s}</ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  {formData.source === 'Recruiter' && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">Outreach must go through the recruiter.</span>
                  )}
                </div>

                <TabsContent value="general" className="mt-4 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    {isNew ? (
                      <>
                        <TextField label="First Name" value={formData.firstName} onChange={v => updateField('firstName', v)} required />
                        <TextField label="Last Name" value={formData.lastName} onChange={v => updateField('lastName', v)} required />
                        <EmailField label="Email" value={formData.email} onChange={v => updateField('email', v)} required />
                        <TextField label="Phone" value={formData.phone} onChange={v => updateField('phone', v)} />
                        <SelectField label="Path" value={formData.path} onChange={v => updateField('path', v)} required
                          options={candidatePaths.map(p => ({ value: p, label: p }))} />
                        <TextField label="Candidate Role" value={formData.candidateRole} onChange={v => updateField('candidateRole', v)} />
                        <TextField label="Hourly Rate (€)" value={String(formData.hourlyRateEur)} onChange={v => updateField('hourlyRateEur', Number(v) || 0)} required type="number" />
                        {formData.path === 'B2B seeking Contracts' && (
                          <TextField label="B2B Entity Name" value={formData.b2bEntityName} onChange={v => updateField('b2bEntityName', v)} required />
                        )}
                        <DateField label="Applied Date" value={formData.appliedDate} onChange={v => updateField('appliedDate', v)} required />
                      </>
                    ) : (
                      <>
                        <TextField label="First Name" value={formData.firstName} onChange={() => {}} readOnly />
                        <TextField label="Last Name" value={formData.lastName} onChange={() => {}} readOnly />
                        <TextField label="Email" value={formData.email} onChange={() => {}} readOnly />
                        <TextField label="Phone" value={formData.phone} onChange={() => {}} readOnly />
                        <TextField label="Path" value={formData.path} onChange={() => {}} readOnly />
                        <TextField label="Candidate Role" value={formData.candidateRole || ''} onChange={v => updateField('candidateRole', v)} />
                        <TextField label="Hourly Rate (€)" value={`€${formData.hourlyRateEur}`} onChange={() => {}} readOnly />
                        <TextField label="Daily Rate (€)" value={`€${(formData.hourlyRateEur || 0) * 8}`} onChange={() => {}} readOnly />
                        {formData.b2bEntityName && (
                          <TextField label="B2B Entity Name" value={formData.b2bEntityName} onChange={() => {}} readOnly />
                        )}
                        <TextField label="Applied Date" value={formData.appliedDate} onChange={() => {}} readOnly />
                      </>
                    )}
                  </div>

                  {/* Candidate CV Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-3 border-b pb-1">Candidate CV</h3>
                    {formData.cvFileName ? (
                      <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                        <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{formData.cvFileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formData.cvMimeType || 'Document'}
                            {formData.cvSize ? ` · ${(formData.cvSize / 1024).toFixed(0)} KB` : ''}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={previewCv}>View</Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => {
                          updateField('cvFileName', '');
                          updateField('cvDocument', '');
                          updateField('cvMimeType', '');
                          updateField('cvSize', 0);
                        }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-colors">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Click to upload candidate CV</span>
                        <span className="text-xs text-muted-foreground/60">PDF, DOC, DOCX</span>
                        <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => handleCvFile(e.target.files?.[0] || null)} />
                      </label>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="scheduling" className="mt-4">
                  <div className="space-y-4">
                    <LookupField
                      label="Assigned Interviewer"
                      value={formData.confirmedSlotId || ''}
                      onChange={v => updateField('confirmedSlotId', v)}
                      options={interviewerOptions}
                      placeholder="Search and select an interviewer..."
                    />
                    {formData.confirmedSlotId && (
                      <div className="rounded-md border p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          <button
                            className="text-sm font-medium text-primary underline hover:text-primary/80"
                            onClick={() => {
                              const c = contacts.find(x => x.id === formData.confirmedSlotId);
                              if (c) setViewInterviewer(c);
                            }}
                          >
                            {getInterviewerName(formData.confirmedSlotId)}
                          </button>
                          <StatusBadge status="Scheduled" />
                        </div>
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => updateField('confirmedSlotId', '')}>
                          <X className="h-3 w-3 mr-1" /> Remove
                        </Button>
                      </div>
                    )}
                    {!formData.confirmedSlotId && (
                      <p className="text-sm text-muted-foreground italic">No interviewer assigned yet. Use the search above to find and assign one.</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="review" className="mt-4">
                  <div className="space-y-4">
                    <TextField label="Reviewed By" value={formData.reviewedBy} onChange={() => {}} readOnly />
                    <TextAreaField label="Reviewer Notes" value={formData.reviewerNotes} onChange={() => {}} rows={8} readOnly />
                  </div>
                  {formData.status === 'Fit' && !formData.createdContactId && (
                    <div className="mt-6">
                      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
                        <AlertDialogTrigger asChild>
                          <Button className="w-full" size="lg">
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Approve & Create Contact + Account
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Approve & Create Records</AlertDialogTitle>
                            <AlertDialogDescription className="space-y-3">
                              <p>This will create the following records:</p>
                              <div className="rounded-md border p-3 space-y-2 text-sm">
                                <div><strong>Contact:</strong> {formData.firstName} {formData.lastName}</div>
                                <div><strong>Email:</strong> {formData.email}</div>
                                <div><strong>Type:</strong> Consultant</div>
                                <div><strong>Day Rate:</strong> €{(formData.hourlyRateEur * 8).toFixed(0)} (€{formData.hourlyRateEur}/h × 8h)</div>
                              </div>
                              <div className="rounded-md border p-3 space-y-2 text-sm">
                                <div><strong>Account:</strong> {formData.path === 'B2B seeking Contracts' ? formData.b2bEntityName : `${formData.firstName} ${formData.lastName}`}</div>
                                <div><strong>Type:</strong> Contractor</div>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleApproveCreate}>Create Records</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </TabsContent>

                {formData.status === 'Fit' && (
                  <TabsContent value="created" className="mt-4">
                    <div className="space-y-4">
                      {formData.createdContactId ? (
                        <div className="rounded-md border p-4 space-y-2">
                          <h4 className="text-sm font-medium">Created Records</h4>
                          <div className="text-sm"><strong>Contact ID:</strong> {formData.createdContactId}</div>
                          <div className="text-sm"><strong>Account ID:</strong> {formData.createdAccountId}</div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Records not yet created. Use the "Approve & Create" button on the Review tab.</p>
                      )}
                    </div>
                  </TabsContent>
                )}
              </Tabs>
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button variant="outline" onClick={closeForm}>Close</Button>
                <Button onClick={saveForm}>Save</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>


      {/* Interviewer Profile Popup */}
      <Dialog open={!!viewInterviewer} onOpenChange={() => setViewInterviewer(null)}>
        <DialogContent className="sm:max-w-md">
          {viewInterviewer && (
            <>
              <DialogHeader>
                <DialogTitle>{viewInterviewer.firstName} {viewInterviewer.lastName}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 mt-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase">Role</span>
                    <p className="text-sm">{viewInterviewer.jobRole || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase">Email</span>
                    <p className="text-sm">{viewInterviewer.email}</p>
                  </div>
                </div>
                {viewInterviewer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase">Phone</span>
                      <p className="text-sm">{viewInterviewer.phone}</p>
                    </div>
                  </div>
                )}
                {viewInterviewer.country && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase">Country</span>
                      <p className="text-sm">{viewInterviewer.country}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase">Type</span>
                    <p className="text-sm">{viewInterviewer.contactType}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}