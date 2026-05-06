import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Filter, X, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// --- Types ---
export type TextFilter = { type: 'text'; value: string };
export type MultiSelectFilter = { type: 'multiselect'; selected: string[] };
export type NumberRangeFilter = { type: 'number'; min: string; max: string };
export type DateRangeFilter = { type: 'date'; from?: Date; to?: Date };

export type ColumnFilterValue = TextFilter | MultiSelectFilter | NumberRangeFilter | DateRangeFilter;
export type ColumnFilters = Record<string, ColumnFilterValue>;

// --- Helpers ---
export function getTextFilter(filters: ColumnFilters, col: string): string {
  const f = filters[col];
  return f?.type === 'text' ? f.value : '';
}
export function getMultiFilter(filters: ColumnFilters, col: string): string[] {
  const f = filters[col];
  return f?.type === 'multiselect' ? f.selected : [];
}
export function getNumberFilter(filters: ColumnFilters, col: string): { min: string; max: string } {
  const f = filters[col];
  return f?.type === 'number' ? { min: f.min, max: f.max } : { min: '', max: '' };
}
export function getDateFilter(filters: ColumnFilters, col: string): { from?: Date; to?: Date } {
  const f = filters[col];
  return f?.type === 'date' ? { from: f.from, to: f.to } : {};
}

export function setTextFilter(setFilters: React.Dispatch<React.SetStateAction<ColumnFilters>>, col: string, value: string) {
  setFilters(prev => ({ ...prev, [col]: { type: 'text', value } }));
}
export function setMultiFilter(setFilters: React.Dispatch<React.SetStateAction<ColumnFilters>>, col: string, selected: string[]) {
  setFilters(prev => ({ ...prev, [col]: { type: 'multiselect', selected } }));
}
export function setNumberFilter(setFilters: React.Dispatch<React.SetStateAction<ColumnFilters>>, col: string, min: string, max: string) {
  setFilters(prev => ({ ...prev, [col]: { type: 'number', min, max } }));
}
export function setDateFilter(setFilters: React.Dispatch<React.SetStateAction<ColumnFilters>>, col: string, from?: Date, to?: Date) {
  setFilters(prev => ({ ...prev, [col]: { type: 'date', from, to } }));
}

export function countActiveFilters(filters: ColumnFilters): number {
  return Object.values(filters).filter(f => {
    if (f.type === 'text') return !!f.value;
    if (f.type === 'multiselect') return f.selected.length > 0;
    if (f.type === 'number') return !!f.min || !!f.max;
    if (f.type === 'date') return !!f.from || !!f.to;
    return false;
  }).length;
}

// --- Filter Popover Components ---

function FilterIcon({ active }: { active: boolean }) {
  return <Filter className="h-3 w-3" />;
}

export function TextFilterPopover({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={`h-5 w-5 ml-1 inline-flex ${value ? 'text-primary' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}>
          <FilterIcon active={!!value} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="flex items-center gap-1">
          <Input placeholder={`Search ${label}...`} value={value} onChange={e => onChange(e.target.value)} className="h-8 text-xs" autoFocus />
          {value && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { onChange(''); setOpen(false); }}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MultiSelectFilterPopover({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const hasFilter = selected.length > 0;

  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={`h-5 w-5 ml-1 inline-flex ${hasFilter ? 'text-primary' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}>
          <FilterIcon active={hasFilter} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {hasFilter && (
            <Button variant="ghost" size="sm" className="h-5 text-xs px-1" onClick={() => onChange([])}>
              Clear
            </Button>
          )}
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-xs">
              <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)} className="h-3.5 w-3.5" />
              {opt}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function NumberRangeFilterPopover({ label, min, max, onChange }: { label: string; min: string; max: string; onChange: (min: string, max: string) => void }) {
  const [open, setOpen] = useState(false);
  const hasFilter = !!min || !!max;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={`h-5 w-5 ml-1 inline-flex ${hasFilter ? 'text-primary' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}>
          <FilterIcon active={hasFilter} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {hasFilter && (
            <Button variant="ghost" size="sm" className="h-5 text-xs px-1" onClick={() => { onChange('', ''); setOpen(false); }}>
              Clear
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Input type="number" placeholder="Min" value={min} onChange={e => onChange(e.target.value, max)} className="h-7 text-xs" />
          <Input type="number" placeholder="Max" value={max} onChange={e => onChange(min, e.target.value)} className="h-7 text-xs" />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DateRangeFilterPopover({ label, from, to, onChange }: { label: string; from?: Date; to?: Date; onChange: (from?: Date, to?: Date) => void }) {
  const [open, setOpen] = useState(false);
  const hasFilter = !!from || !!to;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={`h-5 w-5 ml-1 inline-flex ${hasFilter ? 'text-primary' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}>
          <FilterIcon active={hasFilter} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {hasFilter && (
            <Button variant="ghost" size="sm" className="h-5 text-xs px-1" onClick={() => { onChange(undefined, undefined); setOpen(false); }}>
              Clear
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <div>
            <span className="text-xs text-muted-foreground">From</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-full justify-start text-left text-xs h-7 mt-1", !from && "text-muted-foreground")}>
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {from ? format(from, 'dd/MM/yyyy') : 'Pick date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={from} onSelect={(d) => onChange(d, to)} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">To</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-full justify-start text-left text-xs h-7 mt-1", !to && "text-muted-foreground")}>
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {to ? format(to, 'dd/MM/yyyy') : 'Pick date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={to} onSelect={(d) => onChange(from, d)} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// --- ClearColumnFilters button ---
export function ClearColumnFiltersButton({ filters, setFilters }: { filters: ColumnFilters; setFilters: React.Dispatch<React.SetStateAction<ColumnFilters>> }) {
  const count = countActiveFilters(filters);
  if (count === 0) return null;
  return (
    <Button variant="outline" size="sm" onClick={() => setFilters({})}>
      <X className="h-3 w-3 mr-1" /> Clear {count} column filter{count > 1 ? 's' : ''}
    </Button>
  );
}

// --- Date string match helper ---
export function matchDateRange(dateStr: string, from?: Date, to?: Date): boolean {
  if (!from && !to) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  if (from && d < from) return false;
  if (to) {
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);
    if (d > toEnd) return false;
  }
  return true;
}
