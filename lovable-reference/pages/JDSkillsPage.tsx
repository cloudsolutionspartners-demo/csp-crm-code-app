import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
import { jdSkills } from '@/data/mock-data';
import type { JDSkill } from '@/types/crm';
import { HeaderSelectionBar } from '@/components/HeaderSelectionBar';
import { TextField, TextAreaField, SelectField } from '@/components/FormField';
import { toast } from 'sonner';
import {
  ColumnFilters, ClearColumnFiltersButton,
} from '@/components/ColumnFilters';
import { SearchPill, MultiPill, FilterChip } from '@/components/FilterPills';

const aiOptions = [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }];

export default function JDSkillsPage() {
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selected, setSelected] = useState<JDSkill | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [aiFilter, setAiFilter] = useState<string[]>([]);

  const openForm = (skill: JDSkill) => {
    setIsNew(false);
    setSelected(skill);
    setFormData({ name: skill.name, description: skill.description || '', definedByAI: skill.definedByAI ? 'Yes' : 'No' });
  };

  const openNewForm = () => {
    setIsNew(true);
    setSelected({} as JDSkill);
    setFormData({ name: '', description: '', definedByAI: 'No' });
  };

  const closeForm = () => { setSelected(null); setIsNew(false); };
  const saveForm = () => { toast.success(isNew ? 'Skill created' : 'Skill saved'); closeForm(); };
  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const filtered = useMemo(() => {
    return jdSkills.filter(s => {
      if (aiFilter.length > 0) {
        const v = s.definedByAI ? 'Yes' : 'No';
        if (!aiFilter.includes(v)) return false;
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !(s.description || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [searchTerm, aiFilter]);

  const filteredIds = filtered.map(s => s.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  const hasActiveFilters = !!searchTerm || aiFilter.length > 0;

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="JD Skills" action={<Button size="sm" onClick={openNewForm}><Plus className="h-4 w-4 mr-1" />Add Skill</Button>} />

      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} showDelete />

      <div className="space-y-3 px-6 pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <SearchPill value={searchTerm} onChange={setSearchTerm} placeholder="Search name or description..." />
          <MultiPill label="Defined by AI" values={aiFilter} onChange={setAiFilter}
            options={['Yes', 'No'].map(v => ({ value: v, label: v, count: jdSkills.filter(s => (s.definedByAI ? 'Yes' : 'No') === v).length }))} />
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
        </div>
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {searchTerm && <FilterChip label={`Search: "${searchTerm}"`} onRemove={() => setSearchTerm('')} />}
            {aiFilter.length > 0 && <FilterChip label={`Defined by AI: ${aiFilter.join(', ')}`} onRemove={() => setAiFilter([])} />}
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => { setSearchTerm(''); setAiFilter([]); }}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
              <TableHead>JD Skill Name</TableHead>
              <TableHead>JD Skill Description</TableHead>
              <TableHead>Defined by AI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(s => (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => openForm(s)}>
                <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(s.id)} onCheckedChange={c => toggleOne(s.id, !!c)} /></TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.description || '—'}</TableCell>
                <TableCell>{s.definedByAI ? 'Yes' : 'No'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selected} onOpenChange={open => { if (!open) closeForm(); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{isNew ? 'New Skill' : 'Edit Skill'}</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <TextField label="JD Skill Name" value={formData.name} onChange={v => updateField('name', v)} required />
            <TextAreaField label="JD Skill Description" value={formData.description} onChange={v => updateField('description', v)} />
            <SelectField label="Defined by AI" value={formData.definedByAI} onChange={v => updateField('definedByAI', v)} options={aiOptions} />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button onClick={saveForm}>Save</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
