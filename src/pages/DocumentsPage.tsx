import * as React from 'react';
import { useState, useRef, useMemo } from 'react';
import { PageHeader, EmptyState, StatusBadge } from '../components/Shared';
import { Sheet, useToast } from '../components/Layout';
import { TextField, SelectField, DateField, TextAreaField, LookupField } from '../components/FormFields';
import { Plus, FileText, FileStack, Upload, X, Download } from '../components/Icons';
import { useDataverse } from '../services/useDataverse';
import { fetchDocuments, saveDocument, uploadDocumentFile, downloadDocumentFile } from '../services/documentService';
import { fetchAccounts } from '../services/accountService';
import { Csp_companydocumentsService } from '../generated/services/Csp_companydocumentsService';
import { getOrgUrl } from '../services/dataverseService';
import { formatDate } from '../lib/utils';
import { matchDateRange } from '../components/ColumnFilters';
import { SearchPill, MultiPill, FilterChip, DatePill, dateRangeFor, relativeDateLabel, type RelativeDateValue } from '../components/FilterPills';
import type { CompanyDocument, DocumentType, Account } from '../types/crm';

const documentTypeOptions = [
  { value: 'Contract', label: 'Contract' },
  { value: 'Certificate', label: 'Certificate' },
  { value: 'Invoice', label: 'Invoice' },
  { value: 'Policy', label: 'Policy' },
  { value: 'Report', label: 'Report' },
  { value: 'Other', label: 'Other' },
];

// accountOptions built inside component from Dataverse data

const mockDocuments: CompanyDocument[] = [
  { id: 'doc-1', documentName: 'CSP-RO Operating License', documentType: 'Certificate', relatedAccountId: 'acc-6', issuedDate: '2023-01-15', expirationDate: '2026-01-15', description: 'Business operating license for Romania entity', instructions: 'Renew 60 days before expiration' },
  { id: 'doc-2', documentName: 'TechCorp MSA', documentType: 'Contract', relatedAccountId: 'acc-1', issuedDate: '2024-03-01', description: 'Master Service Agreement with TechCorp International' },
  { id: 'doc-3', documentName: 'Data Protection Policy', documentType: 'Policy', issuedDate: '2024-06-01', description: 'GDPR compliance policy document' },
];

const emptyForm: CompanyDocument = {
  id: '', documentName: '', documentType: 'Other', relatedAccountId: '', issuedDate: '', expirationDate: '', description: '', instructions: '', fileName: '',
};

export default function DocumentsPage() {
  const { toast } = useToast();

  // --- Data: Dataverse with mock fallback ---
  const { data: documents, loading, refetch, isLive } = useDataverse(fetchDocuments, mockDocuments);
  const { data: dvAccounts, refetch: refetchAccounts } = useDataverse<Account>(fetchAccounts, []);
  const [isSaving, setIsSaving] = useState(false);

  const accountOptions = dvAccounts.map(a => ({ value: a.id, label: a.name }));
  const getAccountName = (id?: string) => id ? dvAccounts.find(a => a.id === id)?.name || '\u2014' : '\u2014';

  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<CompanyDocument>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [accountFilter, setAccountFilter] = useState<string[]>([]);
  const [issuedDateFilter, setIssuedDateFilter] = useState<RelativeDateValue>({ type: 'all' });
  const [expirationDateFilter, setExpirationDateFilter] = useState<RelativeDateValue>({ type: 'all' });

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
          !((doc.relatedAccountId ? dvAccounts.find(a => a.id === doc.relatedAccountId)?.name : '') || '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [documents, searchTerm, typeFilter, accountFilter, issuedDateFilter, expirationDateFilter, dvAccounts]);

  const hasActiveFilters = !!searchTerm || typeFilter.length > 0 || accountFilter.length > 0 || issuedDateFilter.type !== 'all' || expirationDateFilter.type !== 'all';

  const openNew = () => { refetchAccounts(); setFormData({ ...emptyForm, id: `doc-${Date.now()}` }); setEditId(null); setPendingFile(null); setOpen(true); };
  const openEdit = (doc: CompanyDocument) => { refetchAccounts(); setFormData({ ...doc }); setEditId(doc.id); setPendingFile(null); setOpen(true); };
  const close = () => { setOpen(false); setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; };
  const set = (key: keyof CompanyDocument, value: any) => setFormData(f => ({ ...f, [key]: value }));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      set('fileName', file.name);
    }
  };

  const clearFile = () => {
    setPendingFile(null);
    set('fileName', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async () => {
    if (!editId || !formData.fileName) return;
    try {
      await downloadDocumentFile(editId, formData.fileName);
    } catch (err: any) {
      console.error('Download failed:', err);
      toast.error(err?.message || 'Download failed');
    }
  };

  const save = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const recordId = await saveDocument(formData, editId || undefined);
      if (pendingFile && recordId) {
        try {
          await Csp_companydocumentsService.upload(recordId, 'csp_maindocument', pendingFile, pendingFile.name);
          console.log('[Documents] File uploaded for', recordId);
        } catch (err: any) {
          console.error('Upload failed:', err);
          toast.error(err?.message || 'File upload failed');
          return;
        }
      }
      toast.success(editId ? 'Document updated' : 'Document uploaded');
      close();
      await refetch();
    } catch (err: any) {
      console.error('Save failed:', err);
      toast.error(err?.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Company Documents" subtitle={loading ? 'Loading...' : `${filtered.length} of ${documents.length} documents${isLive ? '' : ' (mock data)'}`}
        action={<button className="csp-btn csp-btn-primary" onClick={openNew}><Plus className="csp-icon-inline" /> Upload Document</button>} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search name, description, account..." />
          <MultiPill label="Type" values={typeFilter} onChange={setTypeFilter}
            options={documentTypeOptions.map(t => ({ value: t.value, label: t.label, count: documents.filter(d => d.documentType === t.value).length }))} />
          <MultiPill label="Account" values={accountFilter} onChange={setAccountFilter}
            options={accountOptions.map(a => ({ value: a.value, label: a.label, count: documents.filter(d => d.relatedAccountId === a.value).length }))} />
          <DatePill label="Issued Date" value={issuedDateFilter} onChange={setIssuedDateFilter} dates={documents.map(d => d.issuedDate).filter(Boolean) as string[]} />
          <DatePill label="Expiration Date" value={expirationDateFilter} onChange={setExpirationDateFilter} dates={documents.map(d => d.expirationDate).filter(Boolean) as string[]} />
        </div>
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {typeFilter.length > 0 && <FilterChip label={`Type: ${typeFilter.join(', ')}`} onRemove={() => setTypeFilter([])} />}
            {accountFilter.length > 0 && <FilterChip label={`Account: ${accountFilter.map(id => accountOptions.find(a => a.value === id)?.label).filter(Boolean).join(', ')}`} onRemove={() => setAccountFilter([])} />}
            {issuedDateFilter.type !== 'all' && <FilterChip label={`Issued: ${relativeDateLabel(issuedDateFilter)}`} onRemove={() => setIssuedDateFilter({ type: 'all' })} />}
            {expirationDateFilter.type !== 'all' && <FilterChip label={`Expiration: ${relativeDateLabel(expirationDateFilter)}`} onRemove={() => setExpirationDateFilter({ type: 'all' })} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setSearchTerm(''); setTypeFilter([]); setAccountFilter([]); setIssuedDateFilter({ type: 'all' }); setExpirationDateFilter({ type: 'all' }); }}>Clear all</button>
          </div>
        )}
      </div>

      {documents.length === 0 ? (
        <EmptyState icon={<FileStack className="csp-icon-xl" />} title="No documents yet" description="Upload company documents, certificates, and other files."
          action={<button className="csp-btn csp-btn-primary" onClick={openNew}>Upload Document</button>} />
      ) : (
        <div className="csp-table-wrapper">
          <table className="csp-table">
            <thead><tr>
              <th>Document Name</th>
              <th>Type</th>
              <th>Related Account</th>
              <th>Issued Date</th>
              <th>Expiration Date</th>
              <th>File</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="csp-td-empty">No documents match the current filters.</td></tr>
              ) : filtered.map(doc => (
                <tr key={doc.id} className="csp-tr-clickable" onClick={() => openEdit(doc)}>
                  <td className="csp-td-bold">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText className="csp-icon-sm csp-text-muted" />
                      {doc.documentName}
                    </span>
                  </td>
                  <td><StatusBadge status={doc.documentType} /></td>
                  <td>{getAccountName(doc.relatedAccountId)}</td>
                  <td>{doc.issuedDate ? formatDate(doc.issuedDate) : '\u2014'}</td>
                  <td>{doc.expirationDate ? formatDate(doc.expirationDate) : '\u2014'}</td>
                  <td>{doc.fileName || '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={open} onClose={close}>
        <div className="csp-sheet-header">
          <div className="csp-sheet-title">{editId ? 'Edit Document' : 'Upload Document'}</div>
        </div>
        <div style={{ marginTop: '1.5rem' }}>
          <h3 className="csp-section-title" style={{ marginBottom: '1rem' }}>Details</h3>
          <div className="csp-form-grid-2">
            <TextField label="Document Name" value={formData.documentName} onChange={v => set('documentName', v)} required />
            <SelectField label="Document Type" value={formData.documentType} onChange={v => set('documentType', v as DocumentType)} options={documentTypeOptions} />
            <LookupField label="Related Account" value={formData.relatedAccountId || ''} onChange={v => set('relatedAccountId', v)} options={accountOptions} />
            <DateField label="Issued Date" value={formData.issuedDate || ''} onChange={v => set('issuedDate', v)} />
            <DateField label="Expiration Date" value={formData.expirationDate || ''} onChange={v => set('expirationDate', v)} />
            <TextField label="Description" value={formData.description || ''} onChange={v => set('description', v)} />
          </div>
          <div style={{ marginTop: '1rem' }}>
            <TextAreaField label="Instructions" value={formData.instructions || ''} onChange={v => set('instructions', v)} rows={3} />
          </div>

          {/* File upload zone */}
          <div style={{ marginTop: '1rem' }}>
            <label className="csp-field-label">Main Document</label>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg"
              onChange={handleFileSelect} />
            {formData.fileName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', background: 'hsl(var(--muted) / 0.3)', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                <FileText className="csp-icon-sm csp-text-muted" />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formData.fileName}</span>
                {editId && !pendingFile && (
                  <>
                    <button
                      type="button"
                      className="csp-btn csp-btn-outline csp-btn-sm"
                      style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={() => {
                        const orgUrl = getOrgUrl();
                        const url = `${orgUrl}/api/data/v9.2/csp_companydocuments(${editId})/csp_maindocument/$value`;
                        window.open(url, '_blank');
                      }}
                      title="View file"
                    >View File</button>
                    <button className="csp-btn csp-btn-ghost csp-btn-icon-sm" onClick={handleDownload} title="Download">
                      <Download className="csp-icon-sm" />
                    </button>
                  </>
                )}
                <button onClick={clearFile} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }} title="Remove">
                  <X className="csp-icon-sm" />
                </button>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed hsl(var(--muted-foreground) / 0.25)', borderRadius: 'var(--radius)', padding: '1.5rem', textAlign: 'center', cursor: 'pointer' }}>
                <Upload className="csp-icon-xl csp-text-muted" />
                <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>Click to upload a document</p>
                <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground) / 0.7)', marginTop: '0.25rem' }}>PDF, DOCX, XLSX or other files</p>
              </div>
            )}
          </div>

          <div className="csp-form-footer" style={{ marginTop: '1.5rem' }}>
            <button className="csp-btn csp-btn-outline" onClick={close}>Cancel</button>
            <button className="csp-btn csp-btn-primary" disabled={isSaving || !formData.documentName} onClick={save}>{isSaving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
