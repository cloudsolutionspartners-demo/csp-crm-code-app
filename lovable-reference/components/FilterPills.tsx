import { useState, useMemo } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, ChevronDown, ArrowRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SearchPill({ value, onChange, placeholder = 'Search...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-9 w-64 rounded-full bg-muted/40 border-muted focus-visible:ring-1"
      />
    </div>
  );
}

type Option = { value: string; label: string; count?: number };

/** Single-select pill (with "All" option). */
export function SinglePill({ label, value, onChange, options, allLabel = 'All' }:
  { label: string; value: string; onChange: (v: string) => void; options: Option[]; allLabel?: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  const display = selected ? selected.label : allLabel;
  const isActive = !!value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn(
          "h-9 rounded-full gap-2 px-4 font-normal hover:bg-muted/60 hover:text-foreground",
          isActive && "border-primary/40 bg-primary/5 hover:bg-primary/10"
        )}>
          <span className="text-muted-foreground text-sm">{label}</span>
          <span className={cn("text-sm font-medium", isActive ? "text-primary" : "text-foreground")}>{display}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <button
          onClick={() => { onChange(''); setOpen(false); }}
          className={cn("w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted", !value && "bg-muted font-medium")}
        >
          {allLabel}
        </button>
        <div className="max-h-64 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted flex items-center justify-between",
                value === opt.value && "bg-muted font-medium"
              )}
            >
              <span>{opt.label}</span>
              {opt.count !== undefined && <span className="text-xs text-muted-foreground">{opt.count}</span>}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Multi-select pill. */
export function MultiPill({ label, values, onChange, options, allLabel = 'All' }:
  { label: string; values: string[]; onChange: (v: string[]) => void; options: Option[]; allLabel?: string }) {
  const [open, setOpen] = useState(false);
  const isActive = values.length > 0;
  const display = values.length === 0
    ? allLabel
    : values.length === 1
      ? (options.find(o => o.value === values[0])?.label ?? values[0])
      : `${values.length} selected`;

  const toggle = (v: string) => {
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn(
          "h-9 rounded-full gap-2 px-4 font-normal hover:bg-muted/60 hover:text-foreground",
          isActive && "border-primary/40 bg-primary/5 hover:bg-primary/10"
        )}>
          <span className="text-muted-foreground text-sm">{label}</span>
          <span className={cn("text-sm font-medium", isActive ? "text-primary" : "text-foreground")}>{display}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="flex items-center justify-between mb-1 px-1">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {isActive && (
            <Button variant="ghost" size="sm" className="h-5 text-xs px-1" onClick={() => onChange([])}>Clear</Button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {options.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
              <Checkbox checked={values.includes(opt.value)} onCheckedChange={() => toggle(opt.value)} className="h-3.5 w-3.5" />
              <span className="flex-1">{opt.label}</span>
              {opt.count !== undefined && <span className="text-xs text-muted-foreground">{opt.count}</span>}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div className="inline-flex items-center gap-1.5 h-7 pl-3 pr-1 rounded-full bg-muted/60 border text-xs">
      <span>{label}</span>
      <button onClick={onRemove} className="h-5 w-5 inline-flex items-center justify-center rounded-full hover:bg-muted-foreground/20">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ============================================================
// DatePill — relative date filter with histogram + range slider
// ============================================================

export type RelativeDateValue =
  | { type: 'all' }
  | { type: 'this_week' }
  | { type: 'last_week' }
  | { type: 'this_month' }
  | { type: 'last_month' }
  | { type: 'last_n_weeks'; n: number }
  | { type: 'last_n_months'; n: number }
  | { type: 'custom'; from: string; to: string };

export const ALL_DATES: RelativeDateValue = { type: 'all' };

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 365;

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function fromISO(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function toISO(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

export function dateRangeFor(v: RelativeDateValue): { from?: Date; to?: Date } {
  const now = new Date();
  const d0 = startOfDay(now);
  switch (v.type) {
    case 'all': return {};
    case 'this_week': {
      const day = d0.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const from = new Date(d0); from.setDate(d0.getDate() + diff);
      const to = new Date(from); to.setDate(from.getDate() + 6);
      return { from, to };
    }
    case 'last_week': {
      const day = d0.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const thisMonday = new Date(d0); thisMonday.setDate(d0.getDate() + diff);
      const from = new Date(thisMonday); from.setDate(thisMonday.getDate() - 7);
      const to = new Date(from); to.setDate(from.getDate() + 6);
      return { from, to };
    }
    case 'this_month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from, to };
    }
    case 'last_month': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from, to };
    }
    case 'last_n_weeks': {
      const to = new Date(d0);
      const from = new Date(d0); from.setDate(d0.getDate() - 7 * v.n);
      return { from, to };
    }
    case 'last_n_months': {
      const to = new Date(d0);
      const from = new Date(now.getFullYear(), now.getMonth() - v.n, now.getDate());
      return { from, to };
    }
    case 'custom': {
      return { from: fromISO(v.from), to: fromISO(v.to) };
    }
  }
}

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function shortDate(d: Date) { return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`; }

export function relativeDateLabel(v: RelativeDateValue): string {
  switch (v.type) {
    case 'all': return 'All time';
    case 'this_week': return 'This Week';
    case 'last_week': return 'Last Week';
    case 'this_month': return 'This Month';
    case 'last_month': return 'Last Month';
    case 'last_n_weeks': return `Last ${v.n} Weeks`;
    case 'last_n_months': return `Last ${v.n} Months`;
    case 'custom': return `${shortDate(fromISO(v.from))} → ${shortDate(fromISO(v.to))}`;
  }
}

function HistogramRangeSlider({ dates, fromDay, toDay, onChange }: {
  dates: (string | Date)[]; fromDay: number; toDay: number;
  onChange: (fromDay: number, toDay: number) => void;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const BUCKETS = 52;
  const bucketDays = WINDOW_DAYS / BUCKETS;

  const counts = useMemo(() => {
    const arr = new Array(BUCKETS).fill(0);
    for (const raw of dates) {
      const d = typeof raw === 'string'
        ? fromISO(raw.length > 10 ? raw.slice(0, 10) : raw)
        : startOfDay(raw);
      const ageDays = Math.floor((today.getTime() - d.getTime()) / DAY_MS);
      if (ageDays < 0 || ageDays > WINDOW_DAYS) continue;
      const bucket = Math.min(BUCKETS - 1, Math.floor((WINDOW_DAYS - ageDays) / bucketDays));
      arr[bucket]++;
    }
    return arr;
  }, [dates, today]);

  const maxCount = Math.max(1, ...counts);
  const sliderFrom = WINDOW_DAYS - toDay;
  const sliderTo = WINDOW_DAYS - fromDay;

  const fromDate = new Date(today.getTime() - toDay * DAY_MS);
  const toDate = new Date(today.getTime() - fromDay * DAY_MS);
  const weeks = Math.max(1, Math.round((toDay - fromDay) / 7));
  const recordsInRange = counts.reduce((sum, c, i) => {
    const center = (i + 0.5) * bucketDays;
    return center >= sliderFrom && center <= sliderTo ? sum + c : sum;
  }, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-base font-semibold text-foreground">
          {shortDate(fromDate)} <ArrowRight className="inline h-3.5 w-3.5 -mt-0.5" /> {shortDate(toDate)}
        </span>
        <span className="text-xs text-muted-foreground">
          {weeks} week{weeks === 1 ? '' : 's'} · ~{recordsInRange} record{recordsInRange === 1 ? '' : 's'}
        </span>
      </div>

      <div className="relative pt-1 pb-6">
        <div className="flex items-end gap-[2px] h-16 px-0.5 pointer-events-none">
          {counts.map((c, i) => {
            const h = (c / maxCount) * 100;
            const center = (i + 0.5) * bucketDays;
            const inRange = center >= sliderFrom && center <= sliderTo;
            return (
              <div
                key={i}
                className={cn("flex-1 rounded-sm transition-colors",
                  inRange ? "bg-foreground" : "bg-muted-foreground/25")}
                style={{ height: `${Math.max(6, h)}%` }}
              />
            );
          })}
        </div>

        <SliderPrimitive.Root
          className="relative z-10 flex w-full touch-none select-none items-center mt-3"
          min={0} max={WINDOW_DAYS} step={1} minStepsBetweenThumbs={7}
          value={[sliderFrom, sliderTo]}
          onValueChange={(vals) => {
            const [a, b] = vals;
            onChange(WINDOW_DAYS - b, WINDOW_DAYS - a);
          }}
        >
          <SliderPrimitive.Track className="relative h-[2px] w-full grow overflow-hidden rounded-full bg-muted">
            <SliderPrimitive.Range className="absolute h-full bg-foreground" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="relative z-20 block h-4 w-4 rounded-full border-2 border-foreground bg-background shadow cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <SliderPrimitive.Thumb className="relative z-20 block h-4 w-4 rounded-full border-2 border-foreground bg-background shadow cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </SliderPrimitive.Root>

        <div className="absolute left-0 right-0 bottom-0 flex justify-between text-[10px] text-muted-foreground pointer-events-none">
          <span>1 yr ago</span><span>9 mo</span><span>6 mo</span><span>3 mo</span><span>Today</span>
        </div>
      </div>
    </div>
  );
}

export function DatePill({ label, value, onChange, dates = [] }:
  { label: string; value: RelativeDateValue; onChange: (v: RelativeDateValue) => void; dates?: (string | Date)[] }) {
  const [open, setOpen] = useState(false);
  const isActive = value.type !== 'all';

  const computeInitial = (): { fromDay: number; toDay: number } => {
    const today = startOfDay(new Date());
    if (value.type === 'custom') {
      return {
        fromDay: Math.max(0, Math.min(WINDOW_DAYS, Math.floor((today.getTime() - fromISO(value.to).getTime()) / DAY_MS))),
        toDay: Math.max(0, Math.min(WINDOW_DAYS, Math.floor((today.getTime() - fromISO(value.from).getTime()) / DAY_MS))),
      };
    }
    if (value.type !== 'all') {
      const r = dateRangeFor(value);
      if (r.from && r.to) {
        return {
          fromDay: Math.max(0, Math.min(WINDOW_DAYS, Math.floor((today.getTime() - r.to.getTime()) / DAY_MS))),
          toDay: Math.max(0, Math.min(WINDOW_DAYS, Math.floor((today.getTime() - r.from.getTime()) / DAY_MS))),
        };
      }
    }
    return { fromDay: 0, toDay: 90 };
  };

  const [range, setRange] = useState(computeInitial);
  const handleOpen = (o: boolean) => {
    if (o) setRange(computeInitial());
    setOpen(o);
  };

  const presets: RelativeDateValue[] = [
    { type: 'this_week' }, { type: 'last_week' },
    { type: 'this_month' }, { type: 'last_month' },
    { type: 'last_n_weeks', n: 4 }, { type: 'last_n_months', n: 3 },
    { type: 'last_n_months', n: 6 }, { type: 'last_n_months', n: 12 },
  ];

  const applyRange = () => {
    const today = startOfDay(new Date());
    const from = new Date(today.getTime() - range.toDay * DAY_MS);
    const to = new Date(today.getTime() - range.fromDay * DAY_MS);
    onChange({ type: 'custom', from: toISO(from), to: toISO(to) });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn(
          "h-9 rounded-full gap-2 px-4 font-normal hover:bg-muted/60 hover:text-foreground",
          isActive && "border-primary/40 bg-primary/5 hover:bg-primary/10"
        )}>
          <span className="text-muted-foreground text-sm">{label}</span>
          <span className={cn("text-sm font-medium", isActive ? "text-primary" : "text-foreground")}>
            {relativeDateLabel(value)}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[560px] p-3" align="start">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Presets</span>
          {isActive && (
            <Button variant="ghost" size="sm" className="h-6 text-xs"
              onClick={() => { onChange({ type: 'all' }); setOpen(false); }}>
              Clear
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            onClick={() => { onChange({ type: 'all' }); setOpen(false); }}
            className={cn("px-3 h-7 rounded-full border text-xs hover:bg-muted",
              value.type === 'all' && "bg-foreground text-background border-foreground hover:bg-foreground")}
          >
            All time
          </button>
          {presets.map((p, i) => (
            <button
              key={i}
              onClick={() => { onChange(p); setOpen(false); }}
              className={cn("px-3 h-7 rounded-full border text-xs hover:bg-muted",
                JSON.stringify(value) === JSON.stringify(p) && "bg-foreground text-background border-foreground hover:bg-foreground")}
            >
              {relativeDateLabel(p)}
            </button>
          ))}
        </div>

        <div className="rounded-lg border bg-background p-3">
          <HistogramRangeSlider
            dates={dates}
            fromDay={range.fromDay}
            toDay={range.toDay}
            onChange={(fromDay, toDay) => setRange({ fromDay, toDay })}
          />
          <div className="flex justify-end mt-2">
            <Button size="sm" className="h-7 text-xs" onClick={applyRange}>Apply range</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
