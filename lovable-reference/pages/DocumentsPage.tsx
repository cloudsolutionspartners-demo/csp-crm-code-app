import { useState, useMemo } from 'react';
import { PageHeader, EmptyState, StatusBadge } from '@/components/shared';
import { FileStack, Plus, X, FileText, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TextField, SelectField, DateField, TextAreaField, LookupField } from '@/components/FormField';
import { accounts } from '@/data/mock-data';
import type { CompanyDocument, DocumentType } from '@/types/crm';
import { format, parse, isValid } from 'date-fns';
import { matchDateRange } from '@/components/ColumnFilters';
import { SearchPill, MultiPill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, type RelativeDateValue } from '@/components/FilterPills';

const documentTypeOptions: { value: string; label: string }[] = [
  { value: 'Contract', label: 'Contract' },
  { value: 'Certificate', label: 'Certificate' },
  { value: 'Invoice', label: 'Invoice' },
  { value: 'Policy', label: 'Policy' },
  { value: 'Report', label: 'Report' },
  { value: 'Other', label: 'Other' },
];

const accountOptions = accounts.map(a => ({ value: a.id, label: a.name }));

const initialDocs: CompanyDocument[] = [
  { id: 'doc-1', documentName: 'CSP-RO Operating License', documentType: 'Certificate', relatedAccountId: 'acc-6', issuedDate: '2023-01-15', expirationDate: '2026-01-15', description: 'Business operating license for Romania entity', instructions: 'Renew 60 days before expiration' },
  { id: 'doc-2', documentName: 'TechCorp MSA', documentType: 'Contract', relatedAccountId: 'acc-1', issuedDate: '2024-03-01', description: 'Master Service Agreement with TechCorp International' },
  { id: 'doc-3', documentName: 'Data Protection Policy', documentType: 'Policy', issuedDate: '2024-06-01', description: 'GDPR compliance policy document' },
];

const emptyForm: CompanyDocument = {
  id: '', documentName: '', documentType: 'Other', relatedAccountId: '', issuedDate: '', expirationDate: '', description: '', instructions: '', fileName: '',
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<CompanyDocument[]>(initialDocs);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<CompanyDocument>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [accountFilter, setAccountFilter] = useState<string[]>([]);
  const [issuedDateFilter, setIssuedDateFilter] = useState<RelativeDateValue>({ type: 'all' });
  const [expirationDateFilter, setExpirationDateFilter] = useState<RelativeDateValue>({ type: 'all' });

  const openNew = () => { setFormData({ ...emptyForm, id: `doc-${Date.now()}` }); setEditId(null); setOpen(true); };
  const openEdit = (doc: CompanyDocument) => { setFormData({ ...doc }); setEditId(doc.id); setOpen(true); };
  const close = () => setOpen(false);
  const set = <K extends keyof CompanyDocument>(k: K, v: CompanyDocument[K]) => setFormData(f => ({ ...f, [k]: v }));

  const save = () => {
    if (editId) {
      setDocuments(d => d.map(x => x.id === editId ? formData : x));
    } else {
      setDocuments(d => [...d, formData]);
    }
    close();
  };

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    const parsed = parse(d, 'yyyy-MM-dd', new Date());
    return isValid(parsed) ? format(parsed, 'dd MMM yyyy') : '—';
  };

  const getAccountName = (id?: string) => id ? accounts.find(a => a.id === id)?.name || '—' : '—';

  const filtered = useMemo(() => {
    const issuedRange = dateRangeFor(issuedDateFilter);
    const expRange = dateRangeFor(expirationDateFilter);
    return documents.filter(doc => {
      if (typeFilter.length > 0 && !typeFilter.includes(doc.documentType)) return false;
      if (accountFilter.length > 0 && (!doc.relatedAccountId || !accountFilter.includes(doc.relatedAccountId))) return false;
      if (issuedDateFilter.type !== 'all' && (!doc.issuedDate || !matchDateRange(doc.issuedDate, issuedRange.from, issuedRange.to))) return false;
      if (expirationDateFilter.type !== 'all' && (!doc.expirationDate || !matchDateRange(doc.expirationDate, expRange.from, expRange.to))) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (
          !doc.documentName.toLowerCase().includes(q) &&
          !(doc.description || '').toLowerCase().includes(q) &&
          !getAccountName(doc.relatedAccountId).toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [documents, searchTerm, typeFilter, accountFilter, issuedDateFilter, expirationDateFilter]);

  const hasActiveFilters = !!searchTerm || typeFilter.length > 0 || accountFilter.length > 0 || issuedDateFilter.type !== 'all' || expirationDateFilter.type !== 'all';

  return (
    <div>
      <PageHeader title="Company Documents" subtitle={`${filtered.length} of ${documents.length} documents`} action={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Upload Document</Button>} />

      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search name, description, account..." />
          <MultiPill label="Type" values={typeFilter} onChange={setTypeFilter}
            options={documentTypeOptions.map(t => ({ value: t.value, label: t.label, count: documents.filter(d => d.documentType === t.value).length }))} />
          <MultiPill label="Account" values={accountFilter} onChange={setAccountFilter}
            options={accountOptions.map(a => ({ value: a.value, label: a.label, count: documents.filter(d => d.relatedAccountId === a.value).length }))} />
          <DatePill label="Issued Date" value={issuedDateFilter} onChange={setIssuedDateFilter} dates={documents.map(d => d.issuedDate).filter(Boolean) as string[]} />
          <DatePill label="Expiration Date" value={expirationDateFilter} onChange={setExpirationDateFilter} dates={documents.map(d => d.expirationDate).filter(Boolean) as string[]} />
        </div>
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {typeFilter.length > 0 && <FilterChip label={`Type: ${typeFilter.join(', ')}`} onRemove={() => setTypeFilter([])} />}
            {accountFilter.length > 0 && <FilterChip label={`Account: ${accountFilter.map(id => accountOptions.find(a => a.value === id)?.label).filter(Boolean).join(', ')}`} onRemove={() => setAccountFilter([])} />}
            {issuedDateFilter.type !== 'all' && <FilterChip label={`Issued: ${relativeDateLabel(issuedDateFilter)}`} onRemove={() => setIssuedDateFilter({ type: 'all' })} />}
            {expirationDateFilter.type !== 'all' && <FilterChip label={`Expiration: ${relativeDateLabel(expirationDateFilter)}`} onRemove={() => setExpirationDateFilter({ type: 'all' })} />}
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setSearchTerm(''); setTypeFilter([]); setAccountFilter([]); setIssuedDateFilter({ type: 'all' }); setExpirationDateFilter({ type: 'all' }); }}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      {documents.length === 0 ? (
        <EmptyState icon={<FileStack className="h-12 w-12" />} title="No documents yet" description="Upload company documents, certificates, and other files." action={<Button onClick={openNew}>Upload Document</Button>} />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Related Account</TableHead>
                <TableHead>Issued Date</TableHead>
                <TableHead>Expiration Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No documents match the current filters.</TableCell></TableRow>
              ) : filtered.map(doc => (
                <TableRow key={doc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(doc)}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {doc.documentName}
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={doc.documentType} /></TableCell>
                  <TableCell>{getAccountName(doc.relatedAccountId)}</TableCell>
                  <TableCell>{fmtDate(doc.issuedDate)}</TableCell>
                  <TableCell>{fmtDate(doc.expirationDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editId ? 'Edit Document' : 'Upload Document'}</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Document Name" value={formData.documentName} onChange={v => set('documentName', v)} required placeholder="Enter document name" />
              <SelectField label="Document Type" value={formData.documentType} onChange={v => set('documentType', v as DocumentType)} options={documentTypeOptions} />
              <LookupField label="Related Account" value={formData.relatedAccountId || ''} onChange={v => set('relatedAccountId', v)} options={accountOptions} placeholder="Search accounts..." />
              <DateField label="Issued Date" value={formData.issuedDate || ''} onChange={v => set('issuedDate', v)} />
              <DateField label="Expiration Date" value={formData.expirationDate || ''} onChange={v => set('expirationDate', v)} />
              <TextField label="Description" value={formData.description || ''} onChange={v => set('description', v)} placeholder="Brief description" />
            </div>
            <TextAreaField label="Instructions" value={formData.instructions || ''} onChange={v => set('instructions', v)} placeholder="Any special instructions..." rows={3} />

            {/* Main Document upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                Main Document <span className="text-destructive text-sm leading-none">*</span>
              </label>
              {formData.fileName ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{formData.fileName}</span>
                  <button onClick={() => set('fileName', '')} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 py-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">Click to upload a document</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">PDF, DOCX, XLSX or other files</p>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) set('fileName', file.name);
                    }}
                  />
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={close}>Cancel</Button>
              <Button onClick={save} disabled={!formData.documentName}>Save</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
