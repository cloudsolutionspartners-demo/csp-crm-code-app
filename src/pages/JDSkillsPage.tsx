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
import { jdSkills as mockSkills } from '../data/mock-data';
import { fetchJDSkills, saveJDSkill } from '../services/jdSkillService';
import { useDataverse } from '../services/useDataverse';
import type { JDSkill } from '../types/crm';

const aiOptions = [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }];

import { useConfirm } from '../components/ConfirmDialog';

export default function JDSkillsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data: skills, loading, refetch } = useDataverse(
    async () => (await fetchJDSkills()).map(r => ({ id: r.id, name: r.name, description: r.description, definedByAI: r.definedByAI } as JDSkill)),
    mockSkills,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selected, setSelected] = useState<JDSkill | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [aiFilter, setAiFilter] = useState<string[]>([]);

  const openForm = (skill: JDSkill) => {
    setIsNew(false); setSelected(skill);
    setFormData({ name: skill.name, description: skill.description || '', definedByAI: skill.definedByAI ? 'Yes' : 'No' });
  };
  const openNewForm = () => {
    setIsNew(true); setSelected({} as JDSkill);
    setFormData({ name: '', description: '', definedByAI: 'No' });
  };
  const closeForm = () => { setSelected(null); setIsNew(false); };
  const saveForm = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveJDSkill(formData, isNew ? undefined : selected?.id);
      toast.success(isNew ? 'Skill created' : 'Skill saved');
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
    return skills.filter(s => {
      const name = getTextFilter(colFilters, 'name');
      if (name && !s.name.toLowerCase().includes(name.toLowerCase())) return false;
      const desc = getTextFilter(colFilters, 'description');
      if (desc && !(s.description || '').toLowerCase().includes(desc.toLowerCase())) return false;
      const ai = getMultiFilter(colFilters, 'definedByAI');
      if (ai.length > 0 && !ai.includes(s.definedByAI ? 'Yes' : 'No')) return false;
      if (aiFilter.length > 0 && !aiFilter.includes(s.definedByAI ? 'Yes' : 'No')) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !(s.description || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [skills, colFilters, searchTerm, aiFilter]);

  const hasActiveFilters = !!searchTerm || aiFilter.length > 0;

  const filteredIds = filtered.map(s => s.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  if (loading && skills.length === 0) return <PageLoading message="Loading skills..." />;

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="skills" showDelete showActivate={false} showDeactivate={false} onDelete={async () => {
        const count = selectedIds.length;
        const ok = await confirm({ title: 'Delete skill(s)', description: `Are you sure you want to delete ${count} selected skill(s)? This action cannot be undone.` });
        if (!ok) return;
        try {
          const { deleteRecord } = await import('../services/dataverseService');
          for (const id of selectedIds) await deleteRecord('csp_jdskills', id);
          toast.success(`${count} skill(s) deleted`);
          setSelectedIds([]);
          await refetch();
        } catch (err: any) { toast.error('Delete failed'); }
      }} />
      <PageHeader title="JD Skills" subtitle={`${filtered.length} of ${skills.length} skills`}
        action={<div className="csp-flex-gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <button className="csp-btn csp-btn-primary" onClick={openNewForm}><Plus className="csp-icon-inline" />Add Skill</button>
        </div>} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search name or description..." />
          <MultiPill label="Defined by AI" values={aiFilter} onChange={setAiFilter}
            options={['Yes', 'No'].map(v => ({ value: v, label: v, count: skills.filter(s => (s.definedByAI ? 'Yes' : 'No') === v).length }))} />
        </div>
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {aiFilter.length > 0 && <FilterChip label={`Defined by AI: ${aiFilter.join(', ')}`} onRemove={() => setAiFilter([])} />}
            <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { setSearchTerm(''); setAiFilter([]); }}>Clear all</button>
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="csp-table" style={{ width: '100%' }}>
          <thead><tr>
            <th style={{ width: 32, padding: '10px 8px' }}><Checkbox checked={allSelected} onChange={toggleAll} /></th>
            <th style={{ padding: '10px 12px' }}>JD Skill Name <TextFilterPopover label="JD Skill Name" value={getTextFilter(colFilters, 'name')} onChange={v => setTextFilter(setColFilters, 'name', v)} /></th>
            <th style={{ padding: '10px 12px' }}>JD Skill Description <TextFilterPopover label="JD Skill Description" value={getTextFilter(colFilters, 'description')} onChange={v => setTextFilter(setColFilters, 'description', v)} /></th>
            <th style={{ padding: '10px 12px' }}>Defined by AI <MultiSelectFilterPopover label="Defined by AI" options={['Yes', 'No']} selected={getMultiFilter(colFilters, 'definedByAI')} onChange={v => setMultiFilter(setColFilters, 'definedByAI', v)} /></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={4} className="csp-text-center csp-text-muted" style={{ padding: '24px 12px' }}>No skills found.</td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} className="csp-tr-clickable" onClick={() => openForm(s)}>
                <td style={{ width: 32, padding: '10px 8px' }} onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(s.id)} onChange={c => toggleOne(s.id, c)} /></td>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{s.name}</td>
                <td style={{ padding: '10px 12px' }}>{s.description || '\u2014'}</td>
                <td style={{ padding: '10px 12px' }}>{s.definedByAI ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selected} onClose={closeForm}>
        <button
          type="button"
          onClick={closeForm}
          style={{
            position: 'absolute', right: 16, top: 16,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, color: 'hsl(var(--muted-foreground))',
            lineHeight: 1, padding: 4, zIndex: 5,
          }}
          aria-label="Close"
        >{'×'}</button>

        <div className="csp-sheet-header"><div className="csp-sheet-title">{isNew ? 'New Skill' : 'Edit Skill'}</div></div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TextField label="JD Skill Name" value={formData.name} onChange={v => updateField('name', v)} required />
          <TextAreaField label="JD Skill Description" value={formData.description} onChange={v => updateField('description', v)} />
          <SelectField label="Defined by AI" value={formData.definedByAI} onChange={v => updateField('definedByAI', v)} options={aiOptions} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="csp-btn csp-btn-outline" onClick={closeForm}>Cancel</button>
          <button className={`csp-btn csp-btn-primary ${isSaving ? 'csp-btn-saving' : ''}`} disabled={isSaving} onClick={saveForm}>{isSaving ? <><Spinner size="sm" /> Saving...</> : 'Save'}</button>
        </div>
      </Sheet>
    </div>
  );
}
