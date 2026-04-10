import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import { Filter, X } from './Icons';
import { Checkbox } from './Layout';

// --- Types ---
export type TextFilter = { type: 'text'; value: string };
export type MultiSelectFilter = { type: 'multiselect'; selected: string[] };
export type NumberRangeFilter = { type: 'number'; min: string; max: string };
export type DateRangeFilter = { type: 'date'; from: string; to: string };
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
export function getDateFilter(filters: ColumnFilters, col: string): { from: string; to: string } {
  const f = filters[col];
  return f?.type === 'date' ? { from: f.from, to: f.to } : { from: '', to: '' };
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
export function setDateFilter(setFilters: React.Dispatch<React.SetStateAction<ColumnFilters>>, col: string, from: string, to: string) {
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

export function matchDateRange(dateStr: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  if (from && d < new Date(from)) return false;
  if (to) {
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);
    if (d > toEnd) return false;
  }
  return true;
}

// --- Popover wrapper ---
function FilterPopover({ active, children }: { active: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="csp-filter-popover-wrap">
      <button
        className={cn('csp-filter-icon-btn', active && 'csp-filter-icon-active')}
        onClick={() => setOpen(!open)}
      >
        <Filter className="csp-icon-xs" />
      </button>
      {open && <div className="csp-filter-popover">{children}</div>}
    </div>
  );
}

// --- Filter Components ---
export function TextFilterPopover({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <FilterPopover active={!!value}>
      <div className="csp-filter-row">
        <input className="csp-input csp-input-sm" placeholder={`Search ${label}...`} value={value} onChange={e => onChange(e.target.value)} autoFocus />
        {value && (
          <button className="csp-btn csp-btn-ghost csp-btn-icon-sm" onClick={() => onChange('')}>
            <X className="csp-icon-xs" />
          </button>
        )}
      </div>
    </FilterPopover>
  );
}

export function MultiSelectFilterPopover({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const hasFilter = selected.length > 0;
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  };
  return (
    <FilterPopover active={hasFilter}>
      <div className="csp-filter-header">
        <span className="csp-filter-label">{label}</span>
        {hasFilter && <button className="csp-btn csp-btn-ghost csp-btn-xs" onClick={() => onChange([])}>Clear</button>}
      </div>
      <div className="csp-filter-options">
        {options.map(opt => (
          <label key={opt} className="csp-filter-option">
            <Checkbox checked={selected.includes(opt)} onChange={() => toggle(opt)} className="csp-checkbox-sm" />
            {opt}
          </label>
        ))}
      </div>
    </FilterPopover>
  );
}

export function NumberRangeFilterPopover({ label, min, max, onChange }: { label: string; min: string; max: string; onChange: (min: string, max: string) => void }) {
  const hasFilter = !!min || !!max;
  return (
    <FilterPopover active={hasFilter}>
      <div className="csp-filter-header">
        <span className="csp-filter-label">{label}</span>
        {hasFilter && <button className="csp-btn csp-btn-ghost csp-btn-xs" onClick={() => onChange('', '')}>Clear</button>}
      </div>
      <div className="csp-filter-range">
        <input type="number" placeholder="Min" value={min} onChange={e => onChange(e.target.value, max)} className="csp-input csp-input-xs" />
        <input type="number" placeholder="Max" value={max} onChange={e => onChange(min, e.target.value)} className="csp-input csp-input-xs" />
      </div>
    </FilterPopover>
  );
}

export function DateRangeFilterPopover({ label, from, to, onChange }: { label: string; from: string; to: string; onChange: (from: string, to: string) => void }) {
  const hasFilter = !!from || !!to;
  return (
    <FilterPopover active={hasFilter}>
      <div className="csp-filter-header">
        <span className="csp-filter-label">{label}</span>
        {hasFilter && <button className="csp-btn csp-btn-ghost csp-btn-xs" onClick={() => onChange('', '')}>Clear</button>}
      </div>
      <div className="csp-filter-date-range">
        <div>
          <span className="csp-filter-sublabel">From</span>
          <input type="date" value={from} onChange={e => onChange(e.target.value, to)} className="csp-input csp-input-xs" />
        </div>
        <div>
          <span className="csp-filter-sublabel">To</span>
          <input type="date" value={to} onChange={e => onChange(from, e.target.value)} className="csp-input csp-input-xs" />
        </div>
      </div>
    </FilterPopover>
  );
}

export function ClearColumnFiltersButton({ filters, setFilters }: { filters: ColumnFilters; setFilters: React.Dispatch<React.SetStateAction<ColumnFilters>> }) {
  const count = countActiveFilters(filters);
  if (count === 0) return null;
  return (
    <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => setFilters({})}>
      <X className="csp-icon-inline" /> Clear {count} column filter{count > 1 ? 's' : ''}
    </button>
  );
}
