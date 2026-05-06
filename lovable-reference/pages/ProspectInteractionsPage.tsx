import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { prospectInteractions, prospects } from '@/data/mock-data';
import type { InteractionType } from '@/types/crm';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, DateRangeFilterPopover,
  ClearColumnFiltersButton, getTextFilter, getMultiFilter, getDateFilter,
  setTextFilter, setMultiFilter, setDateFilter, matchDateRange,
} from '@/components/ColumnFilters';

const types: InteractionType[] = ['Call', 'Email', 'Meeting', 'LinkedIn'];

export default function ProspectInteractionsPage() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [filters, setFilters] = useState<ColumnFilters>({});

  const prospectName = (id: string) => prospects.find(p => p.id === id)?.companyName || '—';

  const filtered = useMemo(() => {
    return [...prospectInteractions].sort((a, b) => b.date.localeCompare(a.date)).filter(i => {
      if (typeFilter && i.type !== typeFilter) return false;
      const t = getTextFilter(filters, 'summary');
      if (t && !i.summary.toLowerCase().includes(t.toLowerCase())) return false;
      const tm = getMultiFilter(filters, 'type');
      if (tm.length && !tm.includes(i.type)) return false;
      const pn = getTextFilter(filters, 'prospect');
      if (pn && !prospectName(i.prospectId).toLowerCase().includes(pn.toLowerCase())) return false;
      const d = getDateFilter(filters, 'date');
      if ((d.from || d.to) && !matchDateRange(i.date, d.from, d.to)) return false;
      return true;
    });
  }, [typeFilter, filters]);

  return (
    <div>
      <PageHeader title="Interactions" subtitle="All prospect touchpoints across the team" />

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Type</p>
          <ToggleGroup type="single" value={typeFilter} onValueChange={(v) => setTypeFilter(v || '')} variant="outline" size="sm">
            {types.map(t => <ToggleGroupItem key={t} value={t}>{t}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
        <ClearColumnFiltersButton filters={filters} setFilters={setFilters} />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <div className="flex items-center gap-1">Date <DateRangeFilterPopover label="Date" from={getDateFilter(filters, 'date').from} to={getDateFilter(filters, 'date').to} onChange={(f, t) => setDateFilter(setFilters, 'date', f, t)} /></div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1">Prospect <TextFilterPopover label="Prospect" value={getTextFilter(filters, 'prospect')} onChange={(v) => setTextFilter(setFilters, 'prospect', v)} /></div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1">Type <MultiSelectFilterPopover label="Type" options={types} selected={getMultiFilter(filters, 'type')} onChange={(v) => setMultiFilter(setFilters, 'type', v)} /></div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1">Summary <TextFilterPopover label="Summary" value={getTextFilter(filters, 'summary')} onChange={(v) => setTextFilter(setFilters, 'summary', v)} /></div>
              </TableHead>
              <TableHead>Created By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(i => (
              <TableRow key={i.id} className="cursor-pointer" onClick={() => navigate(`/prospecting/prospects?open=${i.prospectId}&tab=timeline`)}>
                <TableCell className="text-sm whitespace-nowrap">{i.date}</TableCell>
                <TableCell className="font-medium">{prospectName(i.prospectId)}</TableCell>
                <TableCell><StatusBadge status={i.type === 'Call' ? 'Active' : i.type === 'Email' ? 'Sent' : 'Scheduled'} /> <span className="ml-1 text-xs">{i.type}</span></TableCell>
                <TableCell className="text-sm max-w-md truncate">{i.summary}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{i.createdBy}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No interactions match the current filters</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
