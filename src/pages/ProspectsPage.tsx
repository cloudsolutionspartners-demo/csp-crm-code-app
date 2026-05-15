import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge } from '../components/Shared';
import { Sheet, Dialog, Tabs, ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, TextAreaField, EmailField, DateField, SelectField, LookupField, WebsiteField } from '../components/FormFields';
import { Plus, LayoutList, KanbanSquare, Building2, Sparkles, Link2, Loader2, FileText, Trash2 } from '../components/Icons';
import { TutorialVideoButton } from '../components/TutorialVideoDialog';
import { cn } from '../lib/utils';
import { fetchAccounts } from '../services/accountService';
import { useDataverse } from '../services/useDataverse';
import { fetchProspects, saveProspect, removeProspect } from '../services/prospectService';
import { fetchAllInteractions, saveInteraction, removeInteraction } from '../services/prospectInteractionService';
import { fetchAllMaterials, saveMaterial, removeMaterial } from '../services/prospectMaterialService';
import { Csp_prospectmaterialsService } from '../generated/services/Csp_prospectmaterialsService';
import { getOrgUrl } from '../services/dataverseService';
import { fetchContacts } from '../services/contactService';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getNumberFilter, setTextFilter, setMultiFilter, setNumberFilter,
} from '../components/ColumnFilters';
import { SearchPill, SinglePill, FilterChip } from '../components/FilterPills';
import type { Prospect, ProspectInteraction, ProspectMaterial, ProspectStatus, ProspectSource, InteractionType, CurrencyCode, ProspectKind, Account } from '../types/crm';
import { ConvertProspectDialog } from '../components/ConvertProspectDialog';
import { RaiseOpportunityForm } from '../components/opportunity/RaiseOpportunityForm';
import { fetchCandidates } from '../services/candidateService';
import { fetchUnitsOfMeasure } from '../services/unitOfMeasureService';
import { listRecords as listRec } from '../services/dataverseService';
import type { OnboardingCandidate } from '../types/crm';
import { ProspectAgingTimeline } from '../components/ProspectAgingTimeline';

const STATUSES: ProspectStatus[] = ['New', 'Contacted', 'Discussing', 'Proposal', 'Won', 'Lost'];
const SOURCES: ProspectSource[] = ['Phone', 'LinkedIn', 'Email', 'Internal Referral'];
const INTERACTION_TYPES: InteractionType[] = ['Call', 'Email', 'Meeting', 'LinkedIn'];
const CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'RON'];

// Aging buckets
const AGING_BUCKETS = [
  { key: 'fresh',   label: '\u2264 7 days (fresh)',     color: '#22c55e', bg: 'hsla(142, 71%, 45%, 0.06)' },
  { key: 'active',  label: '8\u201314 days (active)',   color: '#3b82f6', bg: 'hsla(217, 91%, 60%, 0.06)' },
  { key: 'aging',   label: '15\u201330 days (aging)',   color: '#eab308', bg: 'hsla(45, 93%, 47%, 0.06)' },
  { key: 'stalled', label: '31\u201360 days (stalled)', color: '#f97316', bg: 'hsla(25, 95%, 53%, 0.06)' },
  { key: 'cold',    label: '> 60 days (cold)',          color: '#ef4444', bg: 'hsla(0, 84%, 60%, 0.06)' },
];

function daysSince(dateStr?: string): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function getAgingBucket(p: Prospect) {
  if (p.status === 'Won' || p.status === 'Lost') return null;
  const days = daysSince(p.lastActivityDate || p.firstContactDate);
  if (days <= 7) return AGING_BUCKETS[0];
  if (days <= 14) return AGING_BUCKETS[1];
  if (days <= 30) return AGING_BUCKETS[2];
  if (days <= 60) return AGING_BUCKETS[3];
  return AGING_BUCKETS[4];
}

function formatValue(value?: number, currency?: string): string {
  if (value == null) return '\u2014';
  const c = currency || 'EUR';
  if (value >= 1000000) return `${c} ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${c} ${(value / 1000).toFixed(0)}K`;
  return `${c} ${value.toLocaleString()}`;
}

const ROW_BG: Record<ProspectStatus, string> = {
  New: 'hsl(var(--muted) / 0.3)',
  Contacted: 'hsla(217, 91%, 60%, 0.08)',
  Discussing: 'hsla(45, 93%, 47%, 0.08)',
  Proposal: 'hsla(271, 91%, 65%, 0.08)',
  Won: 'hsla(160, 84%, 39%, 0.08)',
  Lost: 'hsla(0, 84%, 60%, 0.08)',
};

const KANBAN_COL_COLORS: Record<ProspectStatus, string> = {
  New: 'hsl(var(--muted) / 0.4)',
  Contacted: 'hsla(217, 91%, 60%, 0.08)',
  Discussing: 'hsla(45, 93%, 47%, 0.08)',
  Proposal: 'hsla(271, 91%, 65%, 0.08)',
  Won: 'hsla(160, 84%, 39%, 0.08)',
  Lost: 'hsla(0, 84%, 60%, 0.08)',
};

function emptyProspect(count: number): Prospect {
  const ts = Date.now();
  return {
    id: `pro-${ts}`,
    prospectNumber: `PRO-${String(count + 1).padStart(4, '0')}`,
    companyName: '',
    country: '',
    ownerContactId: '',
    source: 'LinkedIn',
    primaryContactName: '',
    primaryContactEmail: '',
    status: 'New',
    firstContactDate: new Date().toISOString().substring(0, 10),
  };
}

import { useConfirm } from '../components/ConfirmDialog';

export default function ProspectsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();

  // Dataverse-backed prospects, interactions, materials
  const { data: prospects, refetch: refetchProspects } = useDataverse<Prospect>(fetchProspects, []);
  const { data: interactions, refetch: refetchInteractions } = useDataverse<ProspectInteraction>(fetchAllInteractions, []);
  const { data: materials, refetch: refetchMaterials } = useDataverse<ProspectMaterial>(fetchAllMaterials, []);
  const { data: dvContacts } = useDataverse<any>(fetchContacts, []);

  // View mode
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('kanban');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [conversionFilter, setConversionFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [colFilters, setColFilters] = useState<ColumnFilters>({});

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [raiseOppOpen, setRaiseOppOpen] = useState(false);
  const [oppCandidates, setOppCandidates] = useState<OnboardingCandidate[]>([]);
  const [oppUoms, setOppUoms] = useState<{ id: string; name: string }[]>([]);
  const [oppCurrencies, setOppCurrencies] = useState<{ id: string; code: string }[]>([]);
  React.useEffect(() => {
    (async () => {
      try {
        const [cands, uomRecs, curRecs] = await Promise.all([
          fetchCandidates(),
          fetchUnitsOfMeasure(),
          listRec('transactioncurrencies', 'transactioncurrencyid,isocurrencycode,currencyname', undefined, 'isocurrencycode asc'),
        ]);
        setOppCandidates(cands.map(c => ({
          id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone,
          path: (c.path as any) || 'B2B seeking Contracts',
          candidateRole: c.candidateRole, cvFileName: c.cvFileName, hourlyRateEur: c.hourlyRateEur,
          b2bEntityName: c.b2bEntityName, selectedSlots: [], status: c.status as any, appliedDate: c.appliedDate,
        })));
        setOppUoms(uomRecs.map(u => ({ id: u.id, name: u.name })));
        setOppCurrencies(curRecs
          .map(r => ({ id: String(r.transactioncurrencyid).replace(/[{}]/g, ''), code: (r.isocurrencycode || '').toUpperCase(), name: r.currencyname || '' }))
          .filter(c => !!c.code));
      } catch (err) {
        console.error('[ProspectsPage] opp reference data load failed:', err);
      }
    })();
  }, []);

  // Sheet state
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState('general');

  // Interaction form
  const [intForm, setIntForm] = useState({ type: 'Call' as InteractionType, date: '', summary: '' });
  // Material form
  const [matForm, setMatForm] = useState({ fileName: '', sharedDate: '', description: '' });
  const [matFile, setMatFile] = useState<File | null>(null);
  const matFileRef = React.useRef<HTMLInputElement>(null);
  // Convert dialog
  const [showConvert, setShowConvert] = useState(false);

  // Kind dialog (choose New Business vs Existing Account)
  const [kindDialogOpen, setKindDialogOpen] = useState(false);

  // Saving state for Save button
  const [isSaving, setIsSaving] = useState(false);

  // Drag and drop (Kanban)
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ProspectStatus | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };
  const handleDragOver = (e: React.DragEvent, status: ProspectStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStatus !== status) setDragOverStatus(status);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (!related || !e.currentTarget.contains(related)) setDragOverStatus(null);
  };
  const handleDrop = async (e: React.DragEvent, status: ProspectStatus) => {
    e.preventDefault();
    const id = draggedId || e.dataTransfer.getData('text/plain');
    setDragOverStatus(null);
    setDraggedId(null);
    if (!id) return;
    const p = prospects.find(x => x.id === id);
    if (!p || p.status === status) return;
    try {
      await saveProspect({ status }, p.id);
      toast.success(`"${p.companyName}" moved to ${status}`);
      await refetchProspects();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    }
  };
  const handleDragEnd = () => { setDraggedId(null); setDragOverStatus(null); };

  // Dataverse accounts for Existing Account picker
  const { data: dvAccounts } = useDataverse<Account>(fetchAccounts, []);

  const consultantOptions = useMemo(() =>
    (dvContacts || []).filter((c: any) => c.contactType === 'Consultant').map((c: any) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })),
  [dvContacts]);

  const contactLookupOptions = useMemo(() =>
    (dvContacts || []).map((c: any) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })),
  [dvContacts]);

  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const openForm = (p: Prospect) => {
    setIsNew(false);
    setSelectedProspect(p);
    setActiveTab('general');
    setFormData({
      companyName: p.companyName, prospectNumber: p.prospectNumber, country: p.country,
      industry: p.industry || '', website: p.website || '', companySize: p.companySize || '',
      status: p.status, source: p.source, ownerContactId: p.ownerContactId,
      referredByContactId: p.referredByContactId || '',
      primaryContactName: p.primaryContactName, primaryContactRole: p.primaryContactRole || '',
      primaryContactEmail: p.primaryContactEmail, primaryContactPhone: p.primaryContactPhone || '',
      title: (p as any).title || '',
      needDescription: p.needDescription || '', servicesDiscussed: p.servicesDiscussed || '',
      estimatedValue: p.estimatedValue != null ? String(p.estimatedValue) : '',
      currencyCode: p.currencyCode || 'EUR',
      firstContactDate: p.firstContactDate || '', expectedCloseDate: p.expectedCloseDate || '',
      lostReason: p.lostReason || '', lastActivityDate: p.lastActivityDate || '',
    });
    setIntForm({ type: 'Call', date: new Date().toISOString().substring(0, 10), summary: '' });
    setMatForm({ fileName: '', sharedDate: new Date().toISOString().substring(0, 10), description: '' });
  };

  const openNewForm = (kind: ProspectKind = 'New Business', existingAccountId?: string) => {
    const p = emptyProspect(prospects.length);
    const linkedAccount = existingAccountId ? dvAccounts.find(a => a.id === existingAccountId) : undefined;
    setIsNew(true);
    setSelectedProspect({ ...p, kind, existingAccountId });
    setActiveTab('general');
    setFormData({
      companyName: linkedAccount?.name || '',
      prospectNumber: p.prospectNumber,
      country: linkedAccount?.country || '',
      industry: '',
      website: '',
      companySize: '',
      status: 'New',
      source: 'LinkedIn',
      ownerContactId: '',
      referredByContactId: '',
      primaryContactName: '',
      primaryContactRole: '',
      primaryContactEmail: '',
      primaryContactPhone: '',
      title: '',
      needDescription: '',
      servicesDiscussed: '',
      estimatedValue: '',
      currencyCode: 'EUR',
      firstContactDate: p.firstContactDate,
      expectedCloseDate: '',
      lostReason: '',
      kind,
      existingAccountId: existingAccountId || '',
    });
    setIntForm({ type: 'Call', date: new Date().toISOString().substring(0, 10), summary: '' });
    setMatForm({ fileName: '', sharedDate: new Date().toISOString().substring(0, 10), description: '' });
    setKindDialogOpen(false);
  };

  const closeForm = () => { setSelectedProspect(null); setIsNew(false); };

  const saveForm = async () => {
    if (isSaving) return;
    if (!formData.companyName) { toast.error('Company Name is required'); return; }
    if (!formData.primaryContactName) { toast.error('Primary Contact Name is required'); return; }
    if (!formData.primaryContactEmail) { toast.error('Primary Contact Email is required'); return; }
    setIsSaving(true);

    const payload: Partial<Prospect> = {
      companyName: formData.companyName,
      country: formData.country,
      industry: formData.industry || undefined,
      website: formData.website || undefined,
      companySize: formData.companySize || undefined,
      status: formData.status,
      source: formData.source,
      ownerContactId: formData.ownerContactId,
      referredByContactId: formData.referredByContactId || undefined,
      primaryContactName: formData.primaryContactName,
      primaryContactRole: formData.primaryContactRole || undefined,
      primaryContactEmail: formData.primaryContactEmail,
      primaryContactPhone: formData.primaryContactPhone || undefined,
      ...({ title: formData.title || undefined } as any),
      needDescription: formData.needDescription || undefined,
      servicesDiscussed: formData.servicesDiscussed || undefined,
      estimatedValue: formData.estimatedValue ? Number(formData.estimatedValue) : undefined,
      currencyCode: formData.currencyCode || undefined,
      firstContactDate: formData.firstContactDate,
      expectedCloseDate: formData.expectedCloseDate || undefined,
      convertedAccountId: formData.existingAccountId || undefined,
    };

    try {
      const existingId = !isNew ? (selectedProspect as Prospect).id : undefined;
      await saveProspect(payload, existingId);
      await refetchProspects();
      toast.success(`Prospect "${payload.companyName}" ${isNew ? 'created' : 'saved'}`);
      closeForm();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save prospect');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtering
  const isConverted = (p: Prospect) => !!p.convertedAccountId;

  const filtered = useMemo(() => {
    return prospects.filter(p => {
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (conversionFilter === 'Converted' && !isConverted(p)) return false;
      if (conversionFilter === 'Not Converted' && isConverted(p)) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (
          !(p.companyName || '').toLowerCase().includes(q) &&
          !(p.primaryContactName || '').toLowerCase().includes(q) &&
          !(p.primaryContactEmail || '').toLowerCase().includes(q)
        ) return false;
      }
      const company = getTextFilter(colFilters, 'company');
      if (company && !p.companyName.toLowerCase().includes(company.toLowerCase())) return false;
      const statusCol = getMultiFilter(colFilters, 'status');
      if (statusCol.length > 0 && !statusCol.includes(p.status)) return false;
      const valueRange = getNumberFilter(colFilters, 'value');
      if (valueRange.min && (p.estimatedValue || 0) < Number(valueRange.min)) return false;
      if (valueRange.max && (p.estimatedValue || 0) > Number(valueRange.max)) return false;
      return true;
    });
  }, [prospects, statusFilter, conversionFilter, searchTerm, colFilters]);

  const hasActiveFilters = !!searchTerm || (statusFilter && statusFilter !== 'All') || (conversionFilter && conversionFilter !== 'All');

  const filteredIds = filtered.map(p => p.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const getOwnerName = (contactId: string) => {
    const c = (dvContacts || []).find((ct: any) => ct.id === contactId);
    return c ? `${c.firstName} ${c.lastName}` :'\u2014';
  };

  const prospectInteractions = selectedProspect
    ? interactions.filter(i => i.prospectId === selectedProspect.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const prospectMaterials = selectedProspect
    ? materials.filter(m => m.prospectId === selectedProspect.id).sort((a, b) => b.sharedDate.localeCompare(a.sharedDate))
    : [];

  const addInteraction = async () => {
    if (!intForm.summary) { toast.error('Summary is required'); return; }
    if (!selectedProspect) return;
    try {
      await saveInteraction({
        prospectId: selectedProspect.id,
        type: intForm.type,
        date: intForm.date || new Date().toISOString().substring(0, 10),
        summary: intForm.summary,
      });
      await refetchInteractions();
      setIntForm({ type: 'Call', date: new Date().toISOString().substring(0, 10), summary: '' });
      toast.success('Interaction logged');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to log interaction');
    }
  };

  const addMaterial = async () => {
    if (!matForm.fileName) { toast.error('File Name is required'); return; }
    if (!selectedProspect) return;
    try {
      const materialId = await saveMaterial({
        prospectId: selectedProspect.id,
        fileName: matForm.fileName,
        sharedDate: matForm.sharedDate || new Date().toISOString().substring(0, 10),
        description: matForm.description || undefined,
      });
      if (matFile && materialId) {
        try {
          await Csp_prospectmaterialsService.upload(materialId, 'csp_document', matFile, matFile.name);
          console.log('[Material] Document uploaded for', materialId);
        } catch (uploadErr: any) {
          console.error('[Material] Document upload failed:', uploadErr?.message);
          toast.error('Material saved but file upload failed');
        }
      }
      await refetchMaterials();
      setMatForm({ fileName: '', sharedDate: new Date().toISOString().substring(0, 10), description: '' });
      setMatFile(null);
      if (matFileRef.current) matFileRef.current.value = '';
      toast.success('Material added');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add material');
    }
  };

  const previewMaterial = async (materialId: string, fileName: string) => {
    const orgUrl = getOrgUrl();
    const fileUrl = `${orgUrl}/api/data/v9.2/csp_prospectmaterials(${materialId})/csp_document/$value`;
    try {
      const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
      const mimeMap: Record<string, string> = {
        pdf: 'application/pdf',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        txt: 'text/plain',
        html: 'text/html',
        htm: 'text/html',
        csv: 'text/csv',
        json: 'application/json',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
      const mimeType = mimeMap[ext] || 'application/octet-stream';
      const { MicrosoftDataverseService } = await import('../generated/services/MicrosoftDataverseService');
      const result = await MicrosoftDataverseService.GetEntityFileImageFieldContentWithOrganization(
        'bytes=0-', orgUrl, 'csp_prospectmaterials', materialId, 'csp_document',
      ) as any;
      const base64 = result?.data ?? result;
      if (typeof base64 !== 'string' || !base64) {
        toast.error('Preview not available — opening file');
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      const w = window.open(blobUrl, '_blank', 'noopener,noreferrer');
      if (!w) toast.error('Unable to open preview — please allow pop-ups');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err: any) {
      console.error('[Material] Preview failed:', err?.message);
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleConvert = async (accountId: string, contactId: string) => {
    if (!selectedProspect) return;
    try {
      await saveProspect({
        convertedAccountId: accountId,
        status: 'Won',
      }, selectedProspect.id);
      await refetchProspects();
      setFormData(prev => ({ ...prev, status: 'Won' }));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to convert prospect');
    }
  };

  const tabs = useMemo(() => {
    const t = [
      { id: 'general', label: 'General' },
      { id: 'timeline', label: `Timeline (${prospectInteractions.length})` },
      { id: 'materials', label: `Materials (${prospectMaterials.length})` },
    ];
    if (formData.status === 'Won') {
      t.push({ id: 'conversion', label: 'Conversion' });
    }
    return t;
  }, [formData.status, prospectInteractions.length, prospectMaterials.length]);

  const currentProspect = selectedProspect ? prospects.find(p => p.id === selectedProspect.id) || selectedProspect : null;

  // Kanban: group filtered prospects by status
  const kanbanColumns = useMemo(() => {
    return STATUSES.map(status => {
      const items = filtered.filter(p => p.status === status);
      const totalValue = items.reduce((sum, p) => sum + (p.estimatedValue || 0), 0);
      return { status, items, totalValue };
    });
  }, [filtered]);

  return (
    <div>
      <HeaderSelectionBar
        count={selectedIds.length}
        onClearSelection={() => setSelectedIds([])}
        entityLabel="prospects"
        showActivate={false}
        showDeactivate={false}
        onDelete={async () => {
          const count = selectedIds.length;
          const ok = await confirm({ title: 'Delete prospect(s)', description: `Are you sure you want to delete ${count} selected prospect(s)? This action cannot be undone.` });
          if (!ok) return;
          try {
            for (const id of selectedIds) {
              await removeProspect(id);
            }
            await refetchProspects();
            await refetchInteractions();
            await refetchMaterials();
            toast.success(`${count} prospect(s) deleted`);
            setSelectedIds([]);
          } catch (err: any) {
            toast.error(err?.message || 'Failed to delete prospect(s)');
          }
        }}
      />

      <PageHeader
        title="Prospects"
        subtitle="Track new business opportunities through to signed contract"
        action={
          <div className="csp-flex-gap-2">
            <div className="csp-view-toggle">
              <button className={cn('csp-view-toggle-btn', viewMode === 'table' && 'csp-view-toggle-btn-active')} onClick={() => setViewMode('table')}>
                <LayoutList className="csp-icon-inline" /> Table
              </button>
              <button className={cn('csp-view-toggle-btn', viewMode === 'kanban' && 'csp-view-toggle-btn-active')} onClick={() => setViewMode('kanban')}>
                <KanbanSquare className="csp-icon-inline" /> Kanban
              </button>
            </div>
            <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
            <button
              className="csp-btn csp-btn-outline csp-btn-sm"
              disabled={selectedIds.length !== 1}
              onClick={() => setRaiseOppOpen(true)}
              title={selectedIds.length === 1 ? 'Raise opportunity for the selected prospect' : 'Select a single prospect to enable'}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >💼 Raise Opportunity</button>
            <TutorialVideoButton moduleLabel="Prospecting" entityLabel="Prospects" />
            <button className="csp-btn csp-btn-primary" onClick={() => setKindDialogOpen(true)}>
              <Plus className="csp-icon-inline" />Add Prospect
            </button>
          </div>
        }
      />

      {/* ===== Filter rows ===== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search company, contact, email..." />
          <SinglePill label="Status" value={statusFilter === 'All' ? '' : statusFilter} onChange={v => setStatusFilter(v || 'All')}
            options={STATUSES.map(s => ({ value: s, label: s, count: prospects.filter(p => p.status === s).length }))} />
          <SinglePill label="Conversion" value={conversionFilter === 'All' ? '' : conversionFilter} onChange={v => setConversionFilter(v || 'All')}
            options={[
              { value: 'Converted', label: 'Converted', count: prospects.filter(p => isConverted(p)).length },
              { value: 'Not Converted', label: 'Not Converted', count: prospects.filter(p => !isConverted(p)).length },
            ]} />
        </div>
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter && statusFilter !== 'All' && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('All')} />}
            {conversionFilter && conversionFilter !== 'All' && <FilterChip label={`Conversion: ${conversionFilter}`} onRemove={() => setConversionFilter('All')} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setSearchTerm(''); setStatusFilter('All'); setConversionFilter('All'); }}>Clear all</button>
          </div>
        )}
      </div>

      {/* ===== Aging legend ===== */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12, padding: '8px 12px', borderRadius: 6, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--muted) / 0.3)' }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))' }}>Aging</span>
        {AGING_BUCKETS.map(b => (
          <span key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.6875rem' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: b.color }} />
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>{b.label}</span>
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.6875rem', marginLeft: 8 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: '#94a3b8' }} />
          <span style={{ color: 'hsl(var(--muted-foreground))' }}>Won / Lost (closed)</span>
        </span>
      </div>

      {/* ===== TABLE VIEW ===== */}
      {viewMode === 'table' && (
        <div className="csp-table-wrapper">
          <table className="csp-table">
            <thead>
              <tr>
                <th className="csp-th-checkbox"><Checkbox checked={allSelected} onChange={toggleAll} /></th>
                <th>Company <TextFilterPopover label="Company" value={getTextFilter(colFilters, 'company')} onChange={v => setTextFilter(setColFilters, 'company', v)} /></th>
                <th>Status <MultiSelectFilterPopover label="Status" options={STATUSES} selected={getMultiFilter(colFilters, 'status')} onChange={v => setMultiFilter(setColFilters, 'status', v)} /></th>
                <th>Source</th>
                <th>Owner</th>
                <th className="csp-text-right">Est. Value <NumberRangeFilterPopover label="Value" min={getNumberFilter(colFilters, 'value').min} max={getNumberFilter(colFilters, 'value').max} onChange={(min, max) => setNumberFilter(setColFilters, 'value', min, max)} /></th>
                <th>Aging</th>
                <th>Expected Close</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="csp-td-empty">No prospects match the current filters.</td></tr>
              ) : filtered.map(p => {
                const bucket = getAgingBucket(p);
                const days = daysSince(p.lastActivityDate || p.firstContactDate);
                return (
                  <tr key={p.id} className="csp-tr-clickable" style={{ backgroundColor: bucket?.bg || ROW_BG[p.status] }}>
                    <td className="csp-td-check" onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.includes(p.id)} onChange={c => toggleOne(p.id, c)} />
                    </td>
                    <td onClick={() => openForm(p)}>
                      <div className="csp-td-bold">{p.companyName}</div>
                      <div className="csp-text-muted" style={{ fontSize: '0.75rem' }}>{[p.country, p.industry].filter(Boolean).join(' \u00B7 ')}</div>
                    </td>
                    <td onClick={() => openForm(p)}><StatusBadge status={p.status} /></td>
                    <td onClick={() => openForm(p)}>{p.source}</td>
                    <td onClick={() => openForm(p)}>{getOwnerName(p.ownerContactId)}</td>
                    <td className="csp-text-right" onClick={() => openForm(p)}>
                      {p.estimatedValue != null ? formatValue(p.estimatedValue, p.currencyCode) : '\u2014'}
                    </td>
                    <td onClick={() => openForm(p)}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: bucket?.color || '#94a3b8' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: bucket?.color || '#94a3b8' }} />
                        {days}d
                      </span>
                    </td>
                    <td onClick={() => openForm(p)}>{p.expectedCloseDate || '\u2014'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== KANBAN VIEW ===== */}
      {viewMode === 'kanban' && (
        <div className="csp-kanban">
          {kanbanColumns.map(col => {
            const isOver = dragOverStatus === col.status;
            return (
            <div
              key={col.status}
              className="csp-kanban-col"
              onDragOver={e => handleDragOver(e, col.status)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.status)}
              style={{
                border: isOver ? '2px solid hsl(var(--primary))' : undefined,
                backgroundColor: isOver ? 'hsl(var(--primary) / 0.06)' : undefined,
                transition: 'border-color 150ms, background-color 150ms',
              }}
            >
              <div className="csp-kanban-col-header" style={{ backgroundColor: KANBAN_COL_COLORS[col.status] }}>
                <div className="csp-kanban-col-title">
                  {col.status}
                  <span className="csp-kanban-col-count">{col.items.length}</span>
                </div>
                <span className="csp-kanban-col-value">{formatValue(col.totalValue)}</span>
              </div>
              <div className="csp-kanban-col-body">
                {col.items.length === 0 ? (
                  <div className="csp-kanban-empty">Drop here</div>
                ) : col.items.map(p => {
                  const bucket = getAgingBucket(p);
                  const days = daysSince(p.lastActivityDate || p.firstContactDate);
                  const isDragging = draggedId === p.id;
                  return (
                    <div
                      key={p.id}
                      className="csp-kanban-card"
                      draggable
                      onDragStart={e => handleDragStart(e, p.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => { if (!isDragging) openForm(p); }}
                      style={{
                        backgroundColor: bucket?.bg,
                        cursor: isDragging ? 'grabbing' : 'grab',
                        opacity: isDragging ? 0.4 : 1,
                        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
                        transition: 'opacity 150ms, transform 150ms',
                        userSelect: 'none',
                      }}
                    >
                      <div className="csp-kanban-card-company">{p.companyName}</div>
                      {(p as any).title && (
                        <div
                          title={(p as any).title}
                          style={{ fontSize: 12, color: 'hsl(var(--foreground) / 0.8)', lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                        >{(p as any).title}</div>
                      )}
                      <div className="csp-kanban-card-meta">
                        {[p.country, p.industry].filter(Boolean).join(' \u00B7 ') || '\u2014'}
                      </div>
                      <div className="csp-kanban-card-row">
                        <span className="csp-kanban-card-value">
                          {p.estimatedValue != null ? formatValue(p.estimatedValue, p.currencyCode) : '\u2014'}
                        </span>
                        <span style={{ fontSize: '0.6875rem', color: bucket?.color || '#94a3b8', fontWeight: 500 }}>
                          <span className="csp-kanban-aging-dot" style={{ backgroundColor: bucket?.color || '#94a3b8' }} />
                          {days}d
                        </span>
                      </div>
                      <div className="csp-kanban-card-row" style={{ marginTop: 4 }}>
                        <span className="csp-kanban-card-owner">{getOwnerName(p.ownerContactId)}</span>
                        <span className="csp-kanban-card-owner">{p.primaryContactName || '\u2014'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* ===== Detail Sheet ===== */}
      <Sheet open={!!selectedProspect} onClose={closeForm}>
        {selectedProspect && (
          <>
            <div className="csp-sheet-header">
              <div className="csp-sheet-title">
                {isNew ? 'New Prospect' : (formData.companyName || selectedProspect.companyName)}
                {!isNew && <StatusBadge status={formData.status} />}
              </div>
            </div>

            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab}>
              {activeTab === 'general' && (
                <div>
                  {/* Aging Timeline */}
                  {!isNew && formData.firstContactDate && (
                    <div style={{ marginBottom: '1rem' }}>
                      <ProspectAgingTimeline
                        firstContactDate={formData.firstContactDate}
                        status={formData.status}
                        lastActivityDate={formData.lastActivityDate}
                        expectedCloseDate={formData.expectedCloseDate}
                      />
                    </div>
                  )}

                  {/* Existing Account banner */}
                  {formData.kind === 'Existing Account' && formData.existingAccountId && (
                    <div style={{
                      borderRadius: 6, border: '1px solid hsl(var(--primary) / 0.3)',
                      backgroundColor: 'hsl(var(--primary) / 0.05)', padding: 12,
                      display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16,
                    }}>
                      <span style={{ color: 'hsl(var(--primary))', marginTop: 2 }}><Link2 className="csp-icon-inline" /></span>
                      <div>
                        <p style={{ fontWeight: 500, color: 'hsl(var(--primary))', fontSize: '0.875rem', margin: '0 0 2px' }}>
                          New opportunity with existing account
                        </p>
                        <p className="csp-text-muted" style={{ fontSize: '0.75rem', margin: 0 }}>
                          Linked to <span style={{ fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                            {dvAccounts.find(a => a.id === formData.existingAccountId)?.name || formData.companyName}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* New Business banner (only when creating new) */}
                  {formData.kind === 'New Business' && isNew && (
                    <div style={{
                      borderRadius: 6, border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--muted) / 0.4)', padding: 12,
                      display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16,
                    }}>
                      <span style={{ color: 'hsl(var(--muted-foreground))', marginTop: 2 }}><Sparkles className="csp-icon-inline" /></span>
                      <p className="csp-text-muted" style={{ fontSize: '0.75rem', margin: 0 }}>
                        New business prospect — will create a new Account on conversion.
                      </p>
                    </div>
                  )}

                  {/* Status toggle */}
                  <div style={{ marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: 6, display: 'block' }}>Status</span>
                    <ToggleGroup value={formData.status} onChange={v => updateField('status', v)}>
                      {STATUSES.map(s => <ToggleGroupItem key={s} value={s}>{s}</ToggleGroupItem>)}
                    </ToggleGroup>
                  </div>

                  {/* Owner + Prospect # */}
                  <div className="csp-form-grid-2">
                    <LookupField label="Owner" value={formData.ownerContactId} onChange={v => updateField('ownerContactId', v)} options={consultantOptions} />
                    <TextField label="Prospect #" value={formData.prospectNumber} onChange={() => {}} readOnly />
                  </div>

                  {/* Company info */}
                  <div className="csp-form-grid-2">
                    <TextField label="Company Name" value={formData.companyName} onChange={v => updateField('companyName', v)} required />
                    <TextField label="Country" value={formData.country} onChange={v => updateField('country', v)} />
                    <TextField label="Industry" value={formData.industry} onChange={v => updateField('industry', v)} />
                    <WebsiteField label="Website" value={formData.website} onChange={v => updateField('website', v)} />
                    <TextField label="Company Size" value={formData.companySize} onChange={v => updateField('companySize', v)} placeholder="e.g. 200-500" />
                    <SelectField label="Source" value={formData.source} onChange={v => updateField('source', v)} options={SOURCES.map(s => ({ value: s, label: s }))} />
                    <LookupField label="Referred By" value={formData.referredByContactId} onChange={v => updateField('referredByContactId', v)} options={contactLookupOptions} />
                  </div>

                  <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: '1.5rem 0 0.75rem', color: 'hsl(var(--primary))' }}>Prospecting Contact</h3>
                  <div className="csp-form-grid-2">
                    <TextField label="Name" value={formData.primaryContactName} onChange={v => updateField('primaryContactName', v)} required />
                    <TextField label="Role" value={formData.primaryContactRole} onChange={v => updateField('primaryContactRole', v)} />
                    <EmailField label="Email" value={formData.primaryContactEmail} onChange={v => updateField('primaryContactEmail', v)} required />
                    <TextField label="Phone" value={formData.primaryContactPhone} onChange={v => updateField('primaryContactPhone', v)} />
                  </div>

                  <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: '1.5rem 0 0.75rem', color: 'hsl(var(--primary))' }}>Opportunity</h3>
                  <div className="csp-form-grid-2">
                    <TextField label="Title" value={formData.title || ''} onChange={v => updateField('title', v)} placeholder="Short opportunity title (e.g. Q3 Data Platform Rollout)" className="csp-col-span-2" />
                    <TextAreaField label="Need Description" value={formData.needDescription} onChange={v => updateField('needDescription', v)} className="csp-col-span-2" />
                    <TextAreaField label="Services Discussed" value={formData.servicesDiscussed} onChange={v => updateField('servicesDiscussed', v)} className="csp-col-span-2" />
                    <TextField label="Estimated Value" value={formData.estimatedValue} onChange={v => updateField('estimatedValue', v)} type="number" />
                    <SelectField label="Currency" value={formData.currencyCode} onChange={v => updateField('currencyCode', v)} options={CURRENCIES.map(c => ({ value: c, label: c }))} />
                    <DateField label="First Contact Date" value={formData.firstContactDate} onChange={v => updateField('firstContactDate', v)} />
                    <DateField label="Expected Close" value={formData.expectedCloseDate} onChange={v => updateField('expectedCloseDate', v)} />
                    {formData.status === 'Lost' && (
                      <TextAreaField label="Lost Reason" value={formData.lostReason} onChange={v => updateField('lostReason', v)} className="csp-col-span-2" />
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'timeline' && (
                <div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
                    <SelectField label="Type" value={intForm.type} onChange={v => setIntForm(prev => ({ ...prev, type: v as InteractionType }))} options={INTERACTION_TYPES.map(t => ({ value: t, label: t }))} />
                    <DateField label="Date" value={intForm.date} onChange={v => setIntForm(prev => ({ ...prev, date: v }))} />
                    <div style={{ flex: 1 }}>
                      <TextAreaField label="Summary" value={intForm.summary} onChange={v => setIntForm(prev => ({ ...prev, summary: v }))} rows={1} />
                    </div>
                    <button className="csp-btn csp-btn-primary" onClick={addInteraction}>Add</button>
                  </div>

                  {prospectInteractions.length === 0 ? (
                    <p className="csp-text-muted csp-text-center">No interactions yet.</p>
                  ) : prospectInteractions.map(int => (
                    <div key={int.id} className="csp-card" style={{ marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <StatusBadge status={int.type === 'Call' ? 'Active' : int.type === 'Email' ? 'Sent' : 'Scheduled'} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{int.type}</span>
                          <span className="csp-text-muted" style={{ fontSize: '0.75rem' }}>{'\u00B7'} {int.date}</span>
                        </div>
                        <span className="csp-text-muted" style={{ fontSize: '0.75rem' }}>{int.createdBy}</span>
                      </div>
                      <p style={{ fontSize: '0.875rem', margin: 0 }}>{int.summary}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'materials' && (
                <div>
                  {/* Add form */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Add a new material</h4>
                      <span className="csp-text-muted" style={{ fontSize: '0.75rem' }}>One file per material {'\u00B7'} add as many as you need</span>
                    </div>
                    <div className="csp-form-grid-2" style={{ marginBottom: '0.75rem' }}>
                      <TextField label="File Name" value={matForm.fileName} onChange={v => setMatForm(prev => ({ ...prev, fileName: v }))} required placeholder="e.g. Capability_Deck.pdf" />
                      <DateField label="Shared Date" value={matForm.sharedDate} onChange={v => setMatForm(prev => ({ ...prev, sharedDate: v }))} required />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <TextAreaField label="Description" value={matForm.description} onChange={v => setMatForm(prev => ({ ...prev, description: v }))} rows={2} />
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--foreground))' }}>Document</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <button type="button" className="csp-btn csp-btn-primary csp-btn-sm" onClick={() => matFileRef.current?.click()}>Choose File</button>
                        <span style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>{matFile ? matFile.name : 'No file chosen'}</span>
                        <input ref={matFileRef} type="file" style={{ display: 'none' }} onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setMatFile(file);
                          if (file && !matForm.fileName) {
                            setMatForm(prev => ({ ...prev, fileName: file.name }));
                          }
                        }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button className="csp-btn csp-btn-outline" onClick={() => { setMatForm({ fileName: '', sharedDate: new Date().toISOString().substring(0, 10), description: '' }); setMatFile(null); if (matFileRef.current) matFileRef.current.value = ''; }}>Clear</button>
                      <button className="csp-btn csp-btn-primary" onClick={addMaterial}>
                        <Plus className="csp-icon-inline" /> Add material
                      </button>
                    </div>
                  </div>

                  {/* Materials list */}
                  <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: '1rem' }}>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }} className="csp-text-muted">
                      Shared Materials ({prospectMaterials.length})
                    </h4>
                    {prospectMaterials.length === 0 ? (
                      <p className="csp-text-muted csp-text-center" style={{ padding: '1rem 0' }}>No materials yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {prospectMaterials.map(m => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid hsl(var(--border))' }}>
                            <button
                              type="button"
                              title="View document"
                              onClick={() => {
                                const orgUrl = getOrgUrl();
                                window.open(`${orgUrl}/api/data/v9.2/csp_prospectmaterials(${m.id})/csp_document/$value`, '_blank');
                              }}
                              style={{ flexShrink: 0, color: 'hsl(var(--primary))', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                            ><FileText className="csp-icon-inline" /></button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{m.fileName}</div>
                              {m.description && <div className="csp-text-muted" style={{ fontSize: '0.75rem' }}>{m.description}</div>}
                            </div>
                            <span className="csp-text-muted" style={{ fontSize: '0.75rem', flexShrink: 0 }}>{m.sharedDate}</span>
                            <button
                              type="button"
                              className="csp-btn csp-btn-outline csp-btn-sm"
                              style={{ fontSize: 11, padding: '2px 8px', flexShrink: 0 }}
                              onClick={(e) => { e.stopPropagation(); previewMaterial(m.id, m.fileName); }}
                            >Preview</button>
                            <button className="csp-btn csp-btn-ghost csp-btn-sm" style={{ color: 'hsl(0, 84%, 60%)', flexShrink: 0 }}
                              onClick={async () => {
                                try {
                                  await removeMaterial(m.id);
                                  await refetchMaterials();
                                  toast.success('Material removed');
                                } catch (err: any) { toast.error(err?.message || 'Failed to remove'); }
                              }}>
                              <Trash2 className="csp-icon-inline" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'conversion' && formData.status === 'Won' && (
                <div>
                  {currentProspect?.convertedAccountId ? (
                    <div className="csp-card" style={{ textAlign: 'center', padding: '2rem' }}>
                      <p style={{ color: 'hsl(142, 76%, 36%)', fontWeight: 600, fontSize: '1rem', marginBottom: '0.5rem' }}>
                        Successfully Converted
                      </p>
                      <p className="csp-text-muted" style={{ fontSize: '0.875rem' }}>
                        Account: {(currentProspect as any).convertedAccountName || currentProspect.convertedAccountId}<br />
                        Contact: {(currentProspect as any).convertedContactName || currentProspect.convertedContactId}<br />
                        Converted on: {currentProspect.convertedDate}
                      </p>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                      <p className="csp-text-muted" style={{ marginBottom: '1rem' }}>
                        This prospect has not been converted yet.
                      </p>
                      <button className="csp-btn csp-btn-primary" style={{ backgroundColor: 'hsl(160, 84%, 39%)' }} onClick={() => setShowConvert(true)}>
                        Convert to Account
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Tabs>

            <div className="csp-sheet-footer">
              <div className="csp-sheet-footer-right">
                <button className="csp-btn csp-btn-outline" onClick={closeForm} disabled={isSaving}>Cancel</button>
                <button className="csp-btn csp-btn-primary" onClick={saveForm} disabled={isSaving}>
                  {isSaving && <Loader2 className="csp-icon-inline csp-animate-spin" />}
                  {isSaving ? (isNew ? 'Creating...' : 'Saving...') : (isNew ? 'Create' : 'Save')}
                </button>
              </div>
            </div>
          </>
        )}
      </Sheet>

      <ConvertProspectDialog
        prospect={currentProspect || null}
        open={showConvert}
        onClose={() => setShowConvert(false)}
        onConfirm={handleConvert}
      />

      <ProspectKindDialog
        open={kindDialogOpen}
        onClose={() => setKindDialogOpen(false)}
        onSelect={openNewForm}
        accounts={dvAccounts}
      />

      <RaiseOpportunityForm
        open={raiseOppOpen}
        onClose={() => setRaiseOppOpen(false)}
        origin={selectedIds.length === 1
          ? { kind: 'prospect', record: (prospects.find(p => p.id === selectedIds[0]) as Prospect) }
          : null}
        onCreated={() => { setRaiseOppOpen(false); setSelectedIds([]); }}
        accounts={dvAccounts as any}
        prospects={prospects as any}
        contacts={dvContacts as any}
        candidates={oppCandidates}
        uoms={oppUoms}
        currencies={oppCurrencies}
      />
    </div>
  );
}

// ===== Kind selection dialog =====
function ProspectKindDialog({ open, onClose, onSelect, accounts }: {
  open: boolean;
  onClose: () => void;
  onSelect: (kind: ProspectKind, accountId?: string) => void;
  accounts: Account[];
}) {
  const [step, setStep] = useState<'choose' | 'pickAccount'>('choose');
  const [accountId, setAccountId] = useState<string>('');

  React.useEffect(() => {
    if (open) { setStep('choose'); setAccountId(''); }
  }, [open]);

  const accountOptions = accounts.map(a => ({ value: a.id, label: `${a.name}${a.country ? ` (${a.country})` : ''}` }));

  return (
    <Dialog open={open} onClose={onClose} title="Add Prospect" maxWidth="32rem">
      <p className="csp-text-muted" style={{ fontSize: '0.875rem', marginBottom: 16 }}>
        {step === 'choose'
          ? 'Is this a new company, or a new opportunity with an existing customer?'
          : 'Select the existing account this opportunity is with.'}
      </p>

      {step === 'choose' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button
            onClick={() => onSelect('New Business')}
            style={{
              textAlign: 'left', borderRadius: 8, border: '1px solid hsl(var(--border))',
              padding: 16, background: 'hsl(var(--background))', cursor: 'pointer',
              transition: 'border-color 150ms, background-color 150ms',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'hsl(var(--primary))'; e.currentTarget.style.backgroundColor = 'hsl(var(--primary) / 0.05)'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'hsl(var(--border))'; e.currentTarget.style.backgroundColor = 'hsl(var(--background))'; }}
          >
            <span style={{ color: 'hsl(var(--primary))', display: 'block', marginBottom: 8 }}>
              <Sparkles className="csp-icon-lg" />
            </span>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: '0 0 4px' }}>New Business</p>
            <p className="csp-text-muted" style={{ fontSize: '0.75rem', margin: 0, lineHeight: 1.4 }}>
              Brand new company we haven't worked with before. Will create a new Account on Won.
            </p>
          </button>
          <button
            onClick={() => setStep('pickAccount')}
            style={{
              textAlign: 'left', borderRadius: 8, border: '1px solid hsl(var(--border))',
              padding: 16, background: 'hsl(var(--background))', cursor: 'pointer',
              transition: 'border-color 150ms, background-color 150ms',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'hsl(var(--primary))'; e.currentTarget.style.backgroundColor = 'hsl(var(--primary) / 0.05)'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'hsl(var(--border))'; e.currentTarget.style.backgroundColor = 'hsl(var(--background))'; }}
          >
            <span style={{ color: 'hsl(var(--primary))', display: 'block', marginBottom: 8 }}>
              <Building2 className="csp-icon-lg" />
            </span>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: '0 0 4px' }}>Existing Account</p>
            <p className="csp-text-muted" style={{ fontSize: '0.75rem', margin: 0, lineHeight: 1.4 }}>
              A new opportunity, project or engagement with one of our existing customers.
            </p>
          </button>
        </div>
      )}

      {step === 'pickAccount' && (
        <div>
          <LookupField label="Account" value={accountId} onChange={setAccountId} options={accountOptions} required />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="csp-btn csp-btn-outline" onClick={() => setStep('choose')}>Back</button>
            <button className="csp-btn csp-btn-primary" disabled={!accountId} onClick={() => onSelect('Existing Account', accountId)}>
              Continue
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
