import { useState, useMemo, useEffect, useRef } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, FileText, Trophy, MessageSquare, FileStack, ArrowRightCircle, CheckCircle2, Building2, Sparkles, Link2, Trash2 } from 'lucide-react';
import { prospects as mockProspects, prospectInteractions as mockInteractions, prospectMaterials as mockMaterials, contacts, accounts, getContactById, getAccountById } from '@/data/mock-data';
import type { Prospect, ProspectStatus, ProspectSource, ProspectInteraction, ProspectMaterial, InteractionType, CurrencyCode, ProspectKind } from '@/types/crm';
import { HeaderSelectionBar } from '@/components/HeaderSelectionBar';
import { useConfirm } from '@/components/ConfirmDialog';
import { TextField, TextAreaField, EmailField, DateField, SelectField, LookupField } from '@/components/FormField';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ConvertProspectDialog } from '@/components/prospect/ConvertProspectDialog';
import { ProspectAgingTimeline } from '@/components/prospect/ProspectAgingTimeline';
import { TutorialVideoButton } from '@/components/TutorialVideoDialog';
import { useNavigate, useLocation } from 'react-router-dom';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, NumberRangeFilterPopover,
  ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getNumberFilter,
  setTextFilter, setMultiFilter, setNumberFilter,
} from '@/components/ColumnFilters';
import { SearchPill, SinglePill, FilterChip } from '@/components/FilterPills';

const statuses: ProspectStatus[] = ['We Reached Out', 'Customer Reached Out', 'Discussing', 'Proposal Sent', 'Won', 'Lost'];
const sources: ProspectSource[] = ['Phone', 'LinkedIn', 'Email', 'Internal Referral'];
const interactionTypes: InteractionType[] = ['Call', 'Email', 'Meeting', 'LinkedIn'];
const currencies: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'RON'];

function fmtCurrency(value?: number, ccy?: string) {
  if (value == null || !ccy) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy, maximumFractionDigits: 0 }).format(value);
}

// Aging buckets — drives row tinting + legend
type AgingBucket = { key: string; label: string; row: string; dot: string; match: (days: number) => boolean };
const AGING_BUCKETS: AgingBucket[] = [
  { key: 'fresh',   label: '≤ 7 days (fresh)',       row: 'bg-emerald-50 dark:bg-emerald-950/20', dot: 'bg-emerald-500',  match: (d) => d <= 7 },
  { key: 'active',  label: '8–14 days (active)',     row: 'bg-sky-50 dark:bg-sky-950/20',         dot: 'bg-sky-500',      match: (d) => d > 7 && d <= 14 },
  { key: 'aging',   label: '15–30 days (aging)',     row: 'bg-amber-50 dark:bg-amber-950/20',     dot: 'bg-amber-500',    match: (d) => d > 14 && d <= 30 },
  { key: 'stalled', label: '31–60 days (stalled)',   row: 'bg-orange-50 dark:bg-orange-950/20',   dot: 'bg-orange-500',   match: (d) => d > 30 && d <= 60 },
  { key: 'cold',    label: '> 60 days (cold)',       row: 'bg-red-50 dark:bg-red-950/20',         dot: 'bg-red-500',      match: (d) => d > 60 },
];

function daysSince(dateStr?: string): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function bucketForProspect(p: { status: ProspectStatus; firstContactDate: string; lastActivityDate?: string }): AgingBucket | null {
  if (p.status === 'Won' || p.status === 'Lost') return null;
  const ref = p.lastActivityDate || p.firstContactDate;
  const days = daysSince(ref);
  return AGING_BUCKETS.find(b => b.match(days)) || null;
}

export default function ProspectsPage() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<Prospect[]>([...mockProspects]);
  const [interactions, setInteractions] = useState<ProspectInteraction[]>([...mockInteractions]);
  const [materials, setMaterials] = useState<ProspectMaterial[]>([...mockMaterials]);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [kindFilter, setKindFilter] = useState<string>('All');
  const [conversionFilter, setConversionFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<any>({});
  const [activeTab, setActiveTab] = useState('general');
  const [convertOpen, setConvertOpen] = useState(false);
  const [kindDialogOpen, setKindDialogOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [newInteraction, setNewInteraction] = useState<{ type: InteractionType; date: string; summary: string }>({ type: 'Call', date: format(new Date(), 'yyyy-MM-dd'), summary: '' });
  const [newMaterial, setNewMaterial] = useState<{ fileName: string; sharedDate: string; description: string; document?: string; documentMimeType?: string; documentSize?: number }>({ fileName: '', sharedDate: format(new Date(), 'yyyy-MM-dd'), description: '' });
  const materialFileInputRef = useRef<HTMLInputElement>(null);

  // Open from query param (e.g. from interactions page)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openId = params.get('open');
    const tab = params.get('tab');
    if (openId) {
      const p = items.find(i => i.id === openId);
      if (p) {
        openForm(p);
        if (tab) setActiveTab(tab);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const internalConsultants = contacts.filter(c => c.contactType === 'Consultant' || c.contactType === 'Permanent Employee');

  const openForm = (p: Prospect) => {
    setIsNew(false);
    setSelected(p);
    setActiveTab('general');
    setForm({ ...p });
  };

  const openNewForm = (kind: ProspectKind, existingAccountId?: string) => {
    setIsNew(true);
    setActiveTab('general');
    const linkedAccount = existingAccountId ? getAccountById(existingAccountId) : undefined;
    setForm({
      id: `pro-${Date.now()}`,
      prospectNumber: `PRO-${String(items.length + 1).padStart(4, '0')}`,
      kind,
      existingAccountId: existingAccountId || undefined,
      companyName: linkedAccount?.name || '',
      country: linkedAccount?.country || '',
      ownerContactId: internalConsultants[0]?.id || '',
      source: 'LinkedIn',
      primaryContactName: '',
      primaryContactEmail: '',
      status: 'New',
      firstContactDate: format(new Date(), 'yyyy-MM-dd'),
      currencyCode: 'EUR',
    });
    setSelected({} as Prospect);
    setKindDialogOpen(false);
  };

  const closeForm = () => { setSelected(null); setForm({}); };

  const saveForm = () => {
    if (!form.companyName || !form.primaryContactName || !form.primaryContactEmail) {
      toast.error('Company, contact name and email are required');
      return;
    }
    if (isNew) {
      setItems([{ ...form } as Prospect, ...items]);
      toast.success('Prospect created');
    } else {
      setItems(items.map(i => i.id === form.id ? { ...form } as Prospect : i));
      toast.success('Prospect updated');
    }
    closeForm();
  };

  const updateField = (k: string, v: any) => setForm({ ...form, [k]: v });

  const handleConfirmConversion = (accountId: string, contactId: string) => {
    setItems(items.map(i => i.id === selected?.id ? { ...i, status: 'Won', convertedAccountId: accountId, convertedContactId: contactId, convertedDate: format(new Date(), 'yyyy-MM-dd') } : i));
    setForm({ ...form, status: 'Won', convertedAccountId: accountId, convertedContactId: contactId, convertedDate: format(new Date(), 'yyyy-MM-dd') });
  };

  const addInteraction = () => {
    if (!newInteraction.summary || !selected) return;
    const entry: ProspectInteraction = {
      id: `pi-${Date.now()}`,
      prospectId: selected.id,
      type: newInteraction.type,
      date: newInteraction.date,
      summary: newInteraction.summary,
      createdBy: 'Admin User',
    };
    setInteractions([entry, ...interactions]);
    setNewInteraction({ type: 'Call', date: format(new Date(), 'yyyy-MM-dd'), summary: '' });
    toast.success('Interaction logged');
  };

  const deleteInteraction = async (id: string) => {
    const ok = await confirm({ title: 'Delete interaction', description: 'Are you sure you want to delete this interaction? This action cannot be undone.' });
    if (!ok) return;
    setInteractions(interactions.filter(i => i.id !== id));
    toast.success('Interaction removed');
  };

  const addMaterial = () => {
    if (!newMaterial.fileName || !selected) return;
    const m: ProspectMaterial = { id: `pm-${Date.now()}`, prospectId: selected.id, ...newMaterial };
    setMaterials([m, ...materials]);
    setNewMaterial({ fileName: '', sharedDate: format(new Date(), 'yyyy-MM-dd'), description: '' });
    if (materialFileInputRef.current) materialFileInputRef.current.value = '';
    toast.success('Material added');
  };

  const deleteMaterial = async (id: string) => {
    const ok = await confirm({ title: 'Delete material', description: 'Are you sure you want to delete this material? This action cannot be undone.' });
    if (!ok) return;
    setMaterials(materials.filter(m => m.id !== id));
    toast.success('Material removed');
  };

  const handleMaterialFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setNewMaterial(prev => ({
        ...prev,
        fileName: prev.fileName || file.name,
        document: dataUrl,
        documentMimeType: file.type,
        documentSize: file.size,
      }));
    };
    reader.readAsDataURL(file);
  };

  const deleteSelected = () => {
    setItems(items.filter(i => !selectedIds.includes(i.id)));
    setSelectedIds([]);
    toast.success('Deleted');
  };

  // Map prospectId -> account that lists it as sourceProspectId (or via prospect.convertedAccountId fallback)
  const accountByProspectId = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    for (const a of accounts) {
      if (a.sourceProspectId) m.set(a.sourceProspectId, { id: a.id, name: a.name });
    }
    for (const p of items) {
      if (p.convertedAccountId && !m.has(p.id)) {
        const a = getAccountById(p.convertedAccountId);
        if (a) m.set(p.id, { id: a.id, name: a.name });
      }
    }
    return m;
  }, [items]);

  const isConverted = (p: Prospect) => accountByProspectId.has(p.id);

  const filtered = useMemo(() => {
    return items.filter(p => {
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (kindFilter === 'Existing Account' && p.kind !== 'Existing Account') return false;
      if (kindFilter === 'New Business' && p.kind === 'Existing Account') return false;
      if (conversionFilter === 'Converted' && !isConverted(p)) return false;
      if (conversionFilter === 'Not Converted' && isConverted(p)) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!p.companyName.toLowerCase().includes(q)) return false;
      }
      const t = getTextFilter(colFilters, 'company');
      if (t && !p.companyName.toLowerCase().includes(t.toLowerCase())) return false;
      const statusMulti = getMultiFilter(colFilters, 'status');
      if (statusMulti.length && !statusMulti.includes(p.status)) return false;
      const val = getNumberFilter(colFilters, 'value');
      if (val.min && (p.estimatedValue || 0) < Number(val.min)) return false;
      if (val.max && (p.estimatedValue || 0) > Number(val.max)) return false;
      return true;
    });
  }, [items, statusFilter, kindFilter, conversionFilter, searchTerm, colFilters, accountByProspectId]);

  const toggleAll = (c: boolean) => setSelectedIds(c ? filtered.map(p => p.id) : []);
  const toggleOne = (id: string, c: boolean) => setSelectedIds(c ? [...selectedIds, id] : selectedIds.filter(i => i !== id));

  const ownerName = (id?: string) => {
    if (!id) return '—';
    const c = getContactById(id);
    return c ? `${c.firstName} ${c.lastName}` : '—';
  };

  const myInteractions = selected ? interactions.filter(i => i.prospectId === selected.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const myMaterials = selected ? materials.filter(m => m.prospectId === selected.id).sort((a, b) => b.sharedDate.localeCompare(a.sharedDate)) : [];

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="prospect" showDelete showDownload />
      <PageHeader
        title="Prospects"
        subtitle="Track new business opportunities through to signed contract"
        action={
          <div className="flex items-center gap-2">
            <TutorialVideoButton
              entityLabel="Prospects"
              videos={[{
                id: 'prospects-overview',
                title: 'How to Manage Prospects End-to-End',
                description: 'Statuses, account types, drag & drop, aging, conversion, and best practices',
                duration: '6:48',
                videoUrl: '/tutorials/prospects-overview.mp4',
              }]}
            />
            <Button onClick={() => setKindDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Prospect</Button>
          </div>
        }
      />

      <div className="space-y-3 mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search company..." />
          <SinglePill label="Status" value={statusFilter === 'All' ? '' : statusFilter} onChange={v => setStatusFilter(v || 'All')}
            options={statuses.map(s => ({ value: s, label: s, count: items.filter(p => p.status === s).length }))} />
          <SinglePill label="Account Type" value={kindFilter === 'All' ? '' : kindFilter} onChange={v => setKindFilter(v || 'All')}
            options={[
              { value: 'New Business', label: 'New Business' },
              { value: 'Existing Account', label: 'Existing Account' },
            ]} />
          <SinglePill label="Conversion" value={conversionFilter === 'All' ? '' : conversionFilter} onChange={v => setConversionFilter(v || 'All')}
            options={[
              { value: 'Converted', label: 'Converted' },
              { value: 'Not Converted', label: 'Not Converted' },
            ]} />
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
        </div>
        {(searchTerm || statusFilter !== 'All' || kindFilter !== 'All' || conversionFilter !== 'All') && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {statusFilter !== 'All' && <FilterChip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter('All')} />}
            {kindFilter !== 'All' && <FilterChip label={`Account Type: ${kindFilter}`} onRemove={() => setKindFilter('All')} />}
            {conversionFilter !== 'All' && <FilterChip label={`Conversion: ${conversionFilter}`} onRemove={() => setConversionFilter('All')} />}
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setSearchTerm(''); setStatusFilter('All'); setKindFilter('All'); setConversionFilter('All'); }}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* Aging legend */}
      <div className="flex flex-wrap items-center gap-3 mb-3 px-3 py-2 rounded-md border bg-muted/30">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aging</span>
        {AGING_BUCKETS.map(b => (
          <span key={b.key} className="flex items-center gap-1.5 text-xs">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${b.dot}`} />
            <span className="text-muted-foreground">{b.label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-xs ml-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
          <span className="text-muted-foreground">Won / Lost (closed)</span>
        </span>
      </div>

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setDraggingId(String(e.active.id))}
        onDragCancel={() => setDraggingId(null)}
        onDragEnd={(e: DragEndEvent) => {
          const id = String(e.active.id);
          const overStage = e.over?.id as ProspectStatus | undefined;
          setDraggingId(null);
          if (!overStage) return;
          const target = items.find(i => i.id === id);
          if (target && target.status !== overStage) {
            setItems(items.map(i => i.id === id ? { ...i, status: overStage, lastActivityDate: format(new Date(), 'yyyy-MM-dd') } : i));
            toast.success(`Moved to "${overStage}"`);
          }
        }}
      >
        <div className="flex gap-3 overflow-x-auto pb-3">
          {statuses.map(stage => {
            const cards = filtered.filter(p => p.status === stage);
            const totalValue = cards.reduce((s, p) => s + (p.estimatedValue || 0), 0);
            return (
              <KanbanColumn key={stage} stage={stage} count={cards.length} totalValue={totalValue} isDragActive={draggingId !== null}>
                {cards.map(p => {
                  const bucket = bucketForProspect(p);
                  const ref = p.lastActivityDate || p.firstContactDate;
                  const days = daysSince(ref);
                  const closed = p.status === 'Won' || p.status === 'Lost';
                  const cardTone = closed
                    ? (p.status === 'Won' ? 'bg-emerald-50/60 dark:bg-emerald-950/10' : 'bg-card')
                    : (bucket?.row || 'bg-card');
                  return (
                    <KanbanCard
                      key={p.id}
                      prospect={p}
                      tone={cardTone}
                      bucketDot={bucket?.dot}
                      days={days}
                      closed={closed}
                      ownerLabel={ownerName(p.ownerContactId)}
                      contactLabel={ownerName(p.prospectingContactId) !== '—' ? ownerName(p.prospectingContactId) : (p.primaryContactName || '')}
                      linkedAccount={accountByProspectId.get(p.id)}
                      isHidden={draggingId === p.id}
                      onOpen={() => openForm(p)}
                    />
                  );
                })}
                {cards.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-6">No prospects</div>
                )}
              </KanbanColumn>
            );
          })}
        </div>
        <DragOverlay>
          {draggingId ? (() => {
            const p = items.find(i => i.id === draggingId);
            if (!p) return null;
            return (
              <div className="bg-card rounded-md border-2 border-primary p-2.5 shadow-lg w-56 cursor-grabbing">
                <div className="font-medium text-sm leading-tight mb-1">{p.companyName}</div>
                <div className="text-[11px] text-muted-foreground">{p.country}{p.industry ? ` · ${p.industry}` : ''}</div>
                <div className="text-[11px] font-medium tabular-nums mt-1">{fmtCurrency(p.estimatedValue, p.currencyCode)}</div>
              </div>
            );
          })() : null}
        </DragOverlay>
      </DndContext>


      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && closeForm()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {isNew ? 'New Prospect' : form.companyName}
              {!isNew && form.status && <StatusBadge status={form.status} />}
              {!isNew && form.convertedAccountId && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Converted
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList>
              <TabsTrigger value="general"><FileText className="h-3 w-3 mr-1" /> General</TabsTrigger>
              <TabsTrigger value="timeline" disabled={isNew}><MessageSquare className="h-3 w-3 mr-1" /> Timeline</TabsTrigger>
              <TabsTrigger value="materials" disabled={isNew}><FileStack className="h-3 w-3 mr-1" /> Materials</TabsTrigger>
              {!isNew && form.status === 'Won' && (
                <TabsTrigger value="conversion"><Trophy className="h-3 w-3 mr-1" /> Conversion</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              {/* Aging timeline */}
              {!isNew && form.firstContactDate && (
                <ProspectAgingTimeline
                  firstContactDate={form.firstContactDate}
                  status={form.status}
                  lastActivityDate={form.lastActivityDate}
                  expectedCloseDate={form.expectedCloseDate}
                />
              )}

              {/* Status toggle at top */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Status</p>
                <ToggleGroup
                  type="single"
                  value={form.status}
                  onValueChange={(v) => v && updateField('status', v)}
                  variant="outline"
                  size="sm"
                  className="flex-wrap justify-start"
                >
                  {(['We Reached Out','Customer Reached Out','Discussing','Proposal Sent','Won','Lost'] as ProspectStatus[]).map(s => (
                    <ToggleGroupItem key={s} value={s} className="text-xs">{s}</ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              {form.kind === 'Existing Account' && form.existingAccountId && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-start gap-2 text-sm">
                  <Link2 className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-primary">New opportunity with existing account</p>
                    <p className="text-xs text-muted-foreground">
                      Linked to <span className="font-medium text-foreground">{getAccountById(form.existingAccountId)?.name || form.companyName}</span>
                    </p>
                  </div>
                </div>
              )}
              {form.kind === 'New Business' && isNew && (
                <div className="rounded-md border bg-muted/40 p-3 flex items-start gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <p className="text-xs text-muted-foreground">New business prospect — will create a new Account on conversion.</p>
                </div>
              )}

              {/* Owner + Prospect # at top */}
              <div className="grid grid-cols-2 gap-3">
                <LookupField label="Owner (internal)" value={form.ownerContactId || ''} onChange={(v) => updateField('ownerContactId', v)} options={internalConsultants.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))} required />
                <TextField label="Prospect #" value={form.prospectNumber || ''} onChange={() => {}} readOnly />
              </div>

              {/* Identity */}
              {form.kind === 'Existing Account' ? (
                <div className="grid grid-cols-2 gap-3">
                  <LookupField label="Account" value={form.existingAccountId || ''} onChange={() => {}} options={accounts.map(a => ({ value: a.id, label: a.name }))} required />
                  <TextField label="Country" value={form.country || ''} onChange={(v) => updateField('country', v)} required />
                  <TextField label="Industry" value={form.industry || ''} onChange={(v) => updateField('industry', v)} className="col-span-2" />
                  <LookupField
                    label="Prospecting Contact"
                    value={form.prospectingContactId || ''}
                    onChange={(v) => {
                      const c = getContactById(v);
                      setForm({
                        ...form,
                        prospectingContactId: v,
                        primaryContactName: c ? `${c.firstName} ${c.lastName}` : '',
                        primaryContactEmail: c?.email || '',
                        primaryContactPhone: c?.phone || '',
                        primaryContactRole: c?.jobRole || '',
                      });
                    }}
                    options={contacts
                      .filter(c => c.accountId === form.existingAccountId || c.contactType === 'Client Contact' || c.contactType === 'Finance Contact')
                      .map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}${c.jobRole ? ' — ' + c.jobRole : ''}` }))}
                    className="col-span-2"
                    required
                  />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Company Name" value={form.companyName || ''} onChange={(v) => updateField('companyName', v)} required />
                    <TextField label="Country" value={form.country || ''} onChange={(v) => updateField('country', v)} required />
                    <TextField label="Industry" value={form.industry || ''} onChange={(v) => updateField('industry', v)} />
                    <TextField label="Website" value={form.website || ''} onChange={(v) => updateField('website', v)} />
                    <TextField label="Company Size" value={form.companySize || ''} onChange={(v) => updateField('companySize', v)} placeholder="e.g. 200-500" />
                    <SelectField label="Source" value={form.source} onChange={(v) => updateField('source', v)} options={sources.map(s => ({ value: s, label: s }))} required />
                    <LookupField label="Referred By" value={form.referredByContactId || ''} onChange={(v) => updateField('referredByContactId', v)} options={contacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))} className="col-span-2" />
                  </div>

                  <div className="pt-2">
                    <h4 className="text-sm font-semibold text-primary mb-2">Prospecting Contact</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <TextField label="Name" value={form.primaryContactName || ''} onChange={(v) => updateField('primaryContactName', v)} required />
                      <TextField label="Role" value={form.primaryContactRole || ''} onChange={(v) => updateField('primaryContactRole', v)} />
                      <EmailField label="Email" value={form.primaryContactEmail || ''} onChange={(v) => updateField('primaryContactEmail', v)} required />
                      <TextField label="Phone" value={form.primaryContactPhone || ''} onChange={(v) => updateField('primaryContactPhone', v)} />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-2">
                <h4 className="text-sm font-semibold text-primary mb-2">Opportunity</h4>
                <div className="grid grid-cols-2 gap-3">
                  <TextAreaField label="Need Description" value={form.needDescription || ''} onChange={(v) => updateField('needDescription', v)} className="col-span-2" rows={2} />
                  <TextAreaField label="Services Discussed" value={form.servicesDiscussed || ''} onChange={(v) => updateField('servicesDiscussed', v)} className="col-span-2" rows={2} />
                  <TextField label="Estimated Value" value={form.estimatedValue?.toString() || ''} onChange={(v) => updateField('estimatedValue', Number(v) || 0)} type="number" />
                  <SelectField label="Currency" value={form.currencyCode || 'EUR'} onChange={(v) => updateField('currencyCode', v)} options={currencies.map(c => ({ value: c, label: c }))} />
                  <DateField label="First Contact" value={form.firstContactDate || ''} onChange={(v) => updateField('firstContactDate', v)} required />
                  <DateField label="Expected Close" value={form.expectedCloseDate || ''} onChange={(v) => updateField('expectedCloseDate', v)} />
                  {form.status === 'Lost' && (
                    <TextAreaField label="Lost Reason" value={form.lostReason || ''} onChange={(v) => updateField('lostReason', v)} className="col-span-2" rows={2} />
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={closeForm}>Cancel</Button>
                <Button onClick={saveForm}>{isNew ? 'Create' : 'Save'}</Button>
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="mt-4 space-y-4">
              <div className="rounded-md border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Log a new interaction</p>
                  <span className="text-xs text-muted-foreground">Add as many as you need</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Type" value={newInteraction.type} onChange={(v) => setNewInteraction({ ...newInteraction, type: v as InteractionType })} options={interactionTypes.map(t => ({ value: t, label: t }))} required />
                  <DateField label="Date" value={newInteraction.date} onChange={(v) => setNewInteraction({ ...newInteraction, date: v })} required />
                </div>
                <TextAreaField label="Summary" value={newInteraction.summary} onChange={(v) => setNewInteraction({ ...newInteraction, summary: v })} rows={2} required />
                <div className="flex justify-end gap-2 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => setNewInteraction({ type: 'Call', date: format(new Date(), 'yyyy-MM-dd'), summary: '' })}>Clear</Button>
                  <Button size="sm" onClick={addInteraction} disabled={!newInteraction.summary}><Plus className="h-3 w-3 mr-1" /> Add interaction</Button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Interactions ({myInteractions.length})</p>
                {myInteractions.map(i => (
                  <div key={i.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={i.type === 'Call' ? 'Active' : i.type === 'Email' ? 'Sent' : 'Scheduled'} />
                        <span className="text-xs font-medium">{i.type}</span>
                        <span className="text-xs text-muted-foreground">· {i.date}</span>
                        {i.durationMinutes && <span className="text-xs text-muted-foreground">· {i.durationMinutes}min</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{i.createdBy}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteInteraction(i.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm mt-1">{i.summary}</p>
                  </div>
                ))}
                {myInteractions.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No interactions yet</p>}
              </div>
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
                    ref={materialFileInputRef}
                    type="file"
                    onChange={(e) => handleMaterialFile(e.target.files?.[0] || null)}
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
                  <Button size="sm" variant="ghost" onClick={() => { setNewMaterial({ fileName: '', sharedDate: format(new Date(), 'yyyy-MM-dd'), description: '' }); if (materialFileInputRef.current) materialFileInputRef.current.value = ''; }}>Clear</Button>
                  <Button size="sm" onClick={addMaterial} disabled={!newMaterial.fileName || !newMaterial.document}><Plus className="h-3 w-3 mr-1" /> Add material</Button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shared materials ({myMaterials.length})</p>
                {myMaterials.map(m => (
                  <div key={m.id} className="rounded-md border p-3 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {m.document ? (
                          <a href={m.document} download={m.fileName} className="font-medium text-sm text-primary hover:underline">{m.fileName}</a>
                        ) : (
                          <span className="font-medium text-sm">{m.fileName}</span>
                        )}
                      </div>
                      {m.description && <p className="text-xs text-muted-foreground mt-1">{m.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{m.sharedDate}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteMaterial(m.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {myMaterials.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No materials shared yet</p>}
              </div>
            </TabsContent>

            {!isNew && form.status === 'Won' && (
              <TabsContent value="conversion" className="mt-4 space-y-3">
                {form.kind === 'Existing Account' ? (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm flex items-start gap-2">
                    <Link2 className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">Existing account opportunity</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This prospect is already linked to <strong>{getAccountById(form.existingAccountId)?.name}</strong>. No new account needs to be created.
                      </p>
                    </div>
                  </div>
                ) : form.convertedAccountId ? (
                  <div className="space-y-3">
                    <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 p-4">
                      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-semibold">Converted on {form.convertedDate}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">This prospect has been turned into an Account and primary Contact.</p>
                    </div>
                    <div className="rounded-md border p-3 space-y-1 text-sm">
                      <p>
                        <strong>Linked Account:</strong>{' '}
                        <button
                          className="text-primary hover:underline"
                          onClick={() => navigate(`/accounts?open=${form.convertedAccountId}`)}
                        >
                          {getAccountById(form.convertedAccountId)?.name || form.convertedAccountId}
                        </button>
                      </p>
                      <p>
                        <strong>Linked Contact:</strong>{' '}
                        <span className="text-muted-foreground">
                          {getContactById(form.convertedContactId)
                            ? `${getContactById(form.convertedContactId)?.firstName} ${getContactById(form.convertedContactId)?.lastName}`
                            : form.convertedContactId}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm">
                      Ready to convert this Won prospect into a customer Account and primary Contact.
                    </div>
                    <Button onClick={() => setConvertOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      <ArrowRightCircle className="h-4 w-4 mr-1" /> Convert to Account
                    </Button>
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </SheetContent>
      </Sheet>

      <ConvertProspectDialog
        prospect={selected && form.status === 'Won' ? form as Prospect : null}
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        onConfirm={handleConfirmConversion}
      />

      <ProspectKindDialog
        open={kindDialogOpen}
        onClose={() => setKindDialogOpen(false)}
        onSelect={openNewForm}
      />
    </div>
  );
}

// ===== Kind selection dialog =====
function ProspectKindDialog({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (kind: ProspectKind, accountId?: string) => void }) {
  const [step, setStep] = useState<'choose' | 'pickAccount'>('choose');
  const [accountId, setAccountId] = useState<string>('');

  useEffect(() => {
    if (open) { setStep('choose'); setAccountId(''); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Prospect</DialogTitle>
          <DialogDescription>
            {step === 'choose' ? 'Is this a new company, or a new opportunity with an existing customer?' : 'Select the existing account this opportunity is with.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'choose' && (
          <div className="grid grid-cols-2 gap-3 mt-2">
            <button
              onClick={() => onSelect('New Business')}
              className="text-left rounded-md border p-4 hover:border-primary hover:bg-primary/5 transition"
            >
              <Sparkles className="h-5 w-5 text-primary mb-2" />
              <p className="font-semibold text-sm">New Business</p>
              <p className="text-xs text-muted-foreground mt-1">Brand new company we haven't worked with before. Will create a new Account on Won.</p>
            </button>
            <button
              onClick={() => setStep('pickAccount')}
              className="text-left rounded-md border p-4 hover:border-primary hover:bg-primary/5 transition"
            >
              <Building2 className="h-5 w-5 text-primary mb-2" />
              <p className="font-semibold text-sm">Existing Account</p>
              <p className="text-xs text-muted-foreground mt-1">A new opportunity, project or engagement with one of our existing customers.</p>
            </button>
          </div>
        )}

        {step === 'pickAccount' && (
          <div className="space-y-3 mt-2">
            <LookupField
              label="Account"
              value={accountId}
              onChange={setAccountId}
              options={accounts.filter(a => a.status !== 'Prospect').map(a => ({ value: a.id, label: `${a.name} (${a.country})` }))}
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep('choose')}>Back</Button>
              <Button disabled={!accountId} onClick={() => onSelect('Existing Account', accountId)}>Continue</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ===== Kanban DnD components =====
function KanbanColumn({ stage, count, totalValue, isDragActive, children }: { stage: ProspectStatus; count: number; totalValue: number; isDragActive: boolean; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-56 rounded-md border bg-muted/30 flex flex-col transition-colors ${isOver ? 'border-primary border-2 bg-primary/5' : ''} ${isDragActive && !isOver ? 'border-dashed' : ''}`}
    >
      <div className="px-3 py-2 border-b bg-card rounded-t-md flex items-center justify-between sticky top-0">
        <div className="flex items-center gap-2">
          <StatusBadge status={stage} />
          <span className="text-xs text-muted-foreground">{count}</span>
        </div>
        {totalValue > 0 && (
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
            {new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(totalValue)}
          </span>
        )}
      </div>
      <div className="p-2 space-y-2 min-h-[120px]">{children}</div>
    </div>
  );
}

function KanbanCard({ prospect, tone, bucketDot, days, closed, ownerLabel, contactLabel, linkedAccount, isHidden, onOpen }: { prospect: Prospect; tone: string; bucketDot?: string; days: number; closed: boolean; ownerLabel: string; contactLabel: string; linkedAccount?: { id: string; name: string }; isHidden: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: prospect.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => { if (!isDragging) onOpen(); }}
      className={`${tone} rounded-md border p-2.5 cursor-grab active:cursor-grabbing hover:shadow-sm hover:border-primary/40 transition-all ${isHidden || isDragging ? 'opacity-30' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-medium text-sm leading-tight">{prospect.companyName}</div>
        {prospect.kind === 'Existing Account' && (
          <span title="Existing account opportunity" className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary bg-primary/10 rounded px-1 py-0.5 shrink-0">
            <Link2 className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      <div className="text-[11px] text-muted-foreground mb-2">
        {prospect.country}{prospect.industry ? ` · ${prospect.industry}` : ''}
      </div>
      {linkedAccount && (
        <div className="mb-2 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/40 rounded px-1.5 py-0.5 max-w-full">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span className="truncate" title={`Converted to account: ${linkedAccount.name}`}>→ {linkedAccount.name}</span>
        </div>
      )}
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium tabular-nums">{prospect.estimatedValue ? new Intl.NumberFormat('en-US', { style: 'currency', currency: prospect.currencyCode || 'EUR', maximumFractionDigits: 0 }).format(prospect.estimatedValue) : '—'}</span>
        {!closed && (
          <span className="inline-flex items-center gap-1">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${bucketDot || 'bg-muted'}`} />
            <span className="font-semibold tabular-nums">{days}d</span>
          </span>
        )}
      </div>
      <div className="mt-1.5 pt-1.5 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">{ownerLabel}</span>
        {contactLabel && <span className="truncate ml-2 max-w-[50%] text-right">{contactLabel}</span>}
      </div>
    </div>
  );
}

