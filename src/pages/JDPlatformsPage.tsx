import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader, Spinner, PageLoading } from '../components/Shared';
import { Sheet, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField, TextAreaField, SelectField } from '../components/FormFields';
import { Plus } from '../components/Icons';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, setTextFilter, setMultiFilter,
} from '../components/ColumnFilters';
import { SearchPill, MultiPill, FilterChip } from '../components/FilterPills';
import { jdPlatforms as mockPlatforms } from '../data/mock-data';
import { fetchJDPlatforms, saveJDPlatform } from '../services/jdPlatformService';
import { useDataverse } from '../services/useDataverse';
import type { JDPlatform } from '../types/crm';

const aiOptions = [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }];

import { useConfirm } from '../components/ConfirmDialog';

export default function JDPlatformsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data: platforms, loading, refetch } = useDataverse(
    async () => (await fetchJDPlatforms()).map(r => ({ id: r.id, name: r.name, description: r.description, definedByAI: r.definedByAI } as JDPlatform)),
    mockPlatforms,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selected, setSelected] = useState<JDPlatform | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [aiFilter, setAiFilter] = useState<string[]>([]);

  const openForm = (platform: JDPlatform) => {
    setIsNew(false); setSelected(platform);
    setFormData({ name: platform.name, description: platform.description, definedByAI: platform.definedByAI ? 'Yes' : 'No' });
  };
  const openNewForm = () => {
    setIsNew(true); setSelected({} as JDPlatform);
    setFormData({ name: '', description: '', definedByAI: 'No' });
  };
  const closeForm = () => { setSelected(null); setIsNew(false); };
  const saveForm = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveJDPlatform(formData, isNew ? undefined : selected?.id);
      toast.success(isNew ? 'Platform created' : 'Platform saved');
      closeForm();
      await refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };
  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const filtered = useMemo(() => {
    return platforms.filter(p => {
      const name = getTextFilter(colFilters, 'name');
      if (name && !p.name.toLowerCase().includes(name.toLowerCase())) return false;
      const desc = getTextFilter(colFilters, 'description');
      if (desc && !p.description.toLowerCase().includes(desc.toLowerCase())) return false;
      const ai = getMultiFilter(colFilters, 'definedByAI');
      if (ai.length > 0 && !ai.includes(p.definedByAI ? 'Yes' : 'No')) return false;
      if (aiFilter.length > 0 && !aiFilter.includes(p.definedByAI ? 'Yes' : 'No')) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.description || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [platforms, colFilters, searchTerm, aiFilter]);

  const hasActiveFilters = !!searchTerm || aiFilter.length > 0;

  const filteredIds = filtered.map(p => p.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  if (loading && platforms.length === 0) return <PageLoading message="Loading platforms..." />;

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="platforms" showDelete showActivate={false} showDeactivate={false} onDelete={async () => {
        const ok = await confirm({ title: 'Delete platform(s)', description: `Are you sure you want to delete ${selectedIds.length} selected platform(s)? This action cannot be undone.` });
        if (!ok) return;
        const count = selectedIds.length;
        try {
          const { deleteRecord } = await import('../services/dataverseService');
          for (const id of selectedIds) await deleteRecord('csp_jdplatforms', id);
          toast.success(`${count} platform(s) deleted`);
          setSelectedIds([]);
          await refetch();
        } catch (err: any) { toast.error('Delete failed'); }
      }} />
      <PageHeader title="JD Platforms" subtitle={`${filtered.length} of ${platforms.length} platforms`}
        action={<div className="csp-flex-gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <button className="csp-btn csp-btn-primary" onClick={openNewForm}><Plus className="csp-icon-inline" />Add Platform</button>
        </div>} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search name or description..." />
          <MultiPill label="Defined by AI" values={aiFilter} onChange={setAiFilter}
            options={['Yes', 'No'].map(v => ({ value: v, label: v, count: platforms.filter(p => (p.definedByAI ? 'Yes' : 'No') === v).length }))} />
        </div>
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {aiFilter.length > 0 && <FilterChip label={`Defined by AI: ${aiFilter.join(', ')}`} onRemove={() => setAiFilter([])} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setSearchTerm(''); setAiFilter([]); }}>Clear all</button>
          </div>
        )}
      </div>

      <div className="csp-table-wrapper">
        <table className="csp-table">
          <thead><tr>
            <th className="csp-th-checkbox"><Checkbox checked={allSelected} onChange={toggleAll} /></th>
            <th>Platform Name <TextFilterPopover label="Platform Name" value={getTextFilter(colFilters, 'name')} onChange={v => setTextFilter(setColFilters, 'name', v)} /></th>
            <th>Platform Description <TextFilterPopover label="Platform Description" value={getTextFilter(colFilters, 'description')} onChange={v => setTextFilter(setColFilters, 'description', v)} /></th>
            <th>Defined by AI <MultiSelectFilterPopover label="Defined by AI" options={['Yes', 'No']} selected={getMultiFilter(colFilters, 'definedByAI')} onChange={v => setMultiFilter(setColFilters, 'definedByAI', v)} /></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={4} className="csp-td-empty">No platforms found.</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="csp-tr-clickable" onClick={() => openForm(p)}>
                <td onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(p.id)} onChange={c => toggleOne(p.id, c)} /></td>
                <td className="csp-td-bold">{p.name}</td>
                <td>{p.description}</td>
                <td>{p.definedByAI ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selected} onClose={closeForm}>
        <div className="csp-sheet-header"><div className="csp-sheet-title">{isNew ? 'New Platform' : 'Edit Platform'}</div></div>
        <div className="csp-form-grid-2">
          <TextField label="Platform Name" value={formData.name} onChange={v => updateField('name', v)} required className="csp-col-span-2" />
          <TextAreaField label="Platform Description" value={formData.description} onChange={v => updateField('description', v)} required className="csp-col-span-2" />
          <SelectField label="Defined by AI" value={formData.definedByAI} onChange={v => updateField('definedByAI', v)} options={aiOptions} />
        </div>
        <div className="csp-form-footer">
          <button className="csp-btn csp-btn-outline" onClick={closeForm}>Cancel</button>
          <button className={`csp-btn csp-btn-primary ${isSaving ? 'csp-btn-saving' : ''}`} disabled={isSaving} onClick={saveForm}>{isSaving ? <><Spinner size="sm" /> Saving...</> : 'Save'}</button>
        </div>
      </Sheet>
    </div>
  );
}
