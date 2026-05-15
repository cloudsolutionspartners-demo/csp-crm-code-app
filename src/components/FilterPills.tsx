import * as React from 'react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, ArrowRight, X } from './Icons';

const pillButtonStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  height: 36,
  padding: '0 16px',
  borderRadius: 9999,
  fontSize: 13,
  fontWeight: 400,
  cursor: 'pointer',
  border: '1px solid hsl(var(--border))',
  background: active ? 'hsl(var(--primary) / 0.06)' : 'hsl(var(--background))',
  color: 'hsl(var(--foreground))',
});

const popoverStyle: React.CSSProperties = {
  position: 'absolute',
  zIndex: 50,
  marginTop: 4,
  background: 'hsl(var(--background))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
  padding: 4,
  minWidth: 224,
};

function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);
  return ref;
}

export function SearchPill({ value, onChange, placeholder = 'Search...' }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))', pointerEvents: 'none' }}>
        <Search className="csp-icon-sm" />
      </span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          height: 36,
          paddingLeft: 36,
          paddingRight: 12,
          width: 256,
          borderRadius: 9999,
          background: 'hsl(var(--muted) / 0.4)',
          border: '1px solid hsl(var(--border))',
          fontSize: 13,
          outline: 'none',
        }}
      />
    </div>
  );
}

type Option = { value: string; label: string; count?: number };

export function SinglePill({ label, value, onChange, options, allLabel = 'All' }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const selected = options.find(o => o.value === value);
  const display = selected ? selected.label : allLabel;
  const isActive = !!value;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={pillButtonStyle(isActive)}>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>{label}</span>
        <span style={{ fontWeight: 500, color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--foreground))' }}>{display}</span>
        <ChevronDown className="csp-icon-sm" />
      </button>
      {open && (
        <div style={{ ...popoverStyle, width: 224 }}>
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            style={{
              width: '100%', textAlign: 'left', padding: '6px 8px', border: 'none',
              borderRadius: 4, fontSize: 13, cursor: 'pointer',
              background: !value ? 'hsl(var(--muted))' : 'transparent',
              fontWeight: !value ? 500 : 400,
            }}
          >{allLabel}</button>
          <div style={{ maxHeight: 256, overflowY: 'auto' }}>
            {options.map(opt => {
              const isSel = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  style={{
                    width: '100%', padding: '6px 8px', border: 'none',
                    borderRadius: 4, fontSize: 13, cursor: 'pointer',
                    background: isSel ? 'hsl(var(--muted))' : 'transparent',
                    fontWeight: isSel ? 500 : 400,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, textAlign: 'left',
                  }}
                >
                  <span>{opt.label}</span>
                  {opt.count !== undefined && <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{opt.count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function MultiPill({ label, values, onChange, options, allLabel = 'All' }: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  options: Option[];
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const isActive = values.length > 0;
  const display =
    values.length === 0 ? allLabel
      : values.length === 1 ? (options.find(o => o.value === values[0])?.label ?? values[0])
        : `${values.length} selected`;

  const toggle = (v: string) => {
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={pillButtonStyle(isActive)}>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>{label}</span>
        <span style={{ fontWeight: 500, color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--foreground))' }}>{display}</span>
        <ChevronDown className="csp-icon-sm" />
      </button>
      {open && (
        <div style={{ ...popoverStyle, width: 224, padding: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, padding: '0 4px' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>{label}</span>
            {isActive && (
              <button type="button" onClick={() => onChange([])} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'hsl(var(--muted-foreground))', padding: '2px 4px' }}>Clear</button>
            )}
          </div>
          <div style={{ maxHeight: 256, overflowY: 'auto' }}>
            {options.map(opt => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={values.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                  style={{ width: 14, height: 14, cursor: 'pointer' }}
                />
                <span style={{ flex: 1 }}>{opt.label}</span>
                {opt.count !== undefined && <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{opt.count}</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 28, paddingLeft: 12, paddingRight: 4,
      borderRadius: 9999, background: 'hsl(var(--muted) / 0.6)',
      border: '1px solid hsl(var(--border))', fontSize: 11,
    }}>
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        style={{
          height: 20, width: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 9999, background: 'transparent', border: 'none', cursor: 'pointer',
        }}
      ><X className="csp-icon-sm" /></button>
    </div>
  );
}

// ============================================================
// DatePill — relative date filter
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

function mondayOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  const mon = new Date(d);
  mon.setDate(mon.getDate() + diff);
  return startOfDay(mon);
}

function sundayOfWeek(d: Date): Date {
  const mon = mondayOfWeek(d);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  return startOfDay(sun);
}

function weekModeMonthRange(year: number, month: number): { from: Date; to: Date } {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return { from: mondayOfWeek(firstDay), to: sundayOfWeek(lastDay) };
}

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

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

function HistogramRangeSlider({ dates, fromDay, toDay, onChange, onFutureDays, weekMode = false }: {
  dates: (string | Date)[];
  fromDay: number;
  toDay: number;
  onChange: (fromDay: number, toDay: number) => void;
  onFutureDays?: (days: number) => void;
  weekMode?: boolean;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const BUCKETS = 52;
  const bucketDays = WINDOW_DAYS / BUCKETS;

  const { counts, futureDays } = useMemo(() => {
    const arr = new Array(BUCKETS).fill(0);
    let maxFutureDays = 0;
    for (const raw of dates) {
      const d = typeof raw === 'string'
        ? fromISO(raw.length > 10 ? raw.slice(0, 10) : raw)
        : startOfDay(raw);
      if (isNaN(d.getTime())) continue;
      const ageDays = Math.floor((today.getTime() - d.getTime()) / DAY_MS);
      // Track how far into the future dates go
      if (ageDays < 0) maxFutureDays = Math.max(maxFutureDays, Math.abs(ageDays));
      if (ageDays > WINDOW_DAYS) continue;
      // Allow future dates (negative ageDays) — clamp to bucket 0 (rightmost = today/future)
      const effectiveAgeDays = Math.max(0, ageDays);
      const bucket = Math.min(BUCKETS - 1, Math.floor((WINDOW_DAYS - effectiveAgeDays) / bucketDays));
      arr[bucket]++;
    }
    return { counts: arr, futureDays: maxFutureDays };
  }, [dates, today]);

  useEffect(() => {
    onFutureDays?.(futureDays);
  }, [futureDays, onFutureDays]);

  const maxCount = Math.max(1, ...counts);
  const sliderFrom = WINDOW_DAYS - toDay;
  const sliderTo = WINDOW_DAYS - fromDay;

  const fromDate = new Date(today.getTime() - toDay * DAY_MS);
  // When slider is at the right edge (fromDay = 0), extend the displayed "to" date
  // by futureDays so the label reflects the full range of dates in the data set.
  const toDate = new Date(today.getTime() + (futureDays - fromDay) * DAY_MS);
  const weeks = Math.max(1, Math.round((toDay - fromDay) / 7));
  const recordsInRange = counts.reduce((sum, c, i) => {
    const center = (i + 0.5) * bucketDays;
    return center >= sliderFrom && center <= sliderTo ? sum + c : sum;
  }, 0);

  // Custom dual-thumb slider drag state
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);

  const posToValue = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(pct * WINDOW_DAYS);
  };

  const startDragLeft = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragging('left');
  };
  const startDragRight = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragging('right');
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const val = posToValue(clientX);
      if (dragging === 'left') {
        const clamped = Math.min(val, sliderTo - 7);
        onChange(WINDOW_DAYS - sliderTo, WINDOW_DAYS - clamped);
      } else {
        const clamped = Math.max(val, sliderFrom + 7);
        onChange(WINDOW_DAYS - clamped, WINDOW_DAYS - sliderFrom);
      }
    };
    const handleUp = () => setDragging(null);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };
  }, [dragging, sliderFrom, sliderTo, onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>
          {shortDate(fromDate)} <ArrowRight className="csp-icon-sm" /> {shortDate(toDate)}
        </span>
        <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
          {weeks} week{weeks === 1 ? '' : 's'} {'·'} ~{recordsInRange} record{recordsInRange === 1 ? '' : 's'}
        </span>
      </div>

      <div style={{ position: 'relative', paddingTop: 4, paddingBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64, paddingLeft: 2, paddingRight: 2, pointerEvents: 'none' }}>
          {counts.map((c, i) => {
            const h = (c / maxCount) * 100;
            const center = (i + 0.5) * bucketDays;
            const inRange = center >= sliderFrom && center <= sliderTo;
            return (
              <div
                key={i}
                style={{
                  flex: 1, borderRadius: 2,
                  background: inRange ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground) / 0.25)',
                  height: `${Math.max(6, h)}%`,
                }}
              />
            );
          })}
        </div>

        <div
          ref={trackRef}
          style={{
            position: 'relative', height: 20, marginTop: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            touchAction: 'none',
          }}
        >
          {/* Track background */}
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 2,
            borderRadius: 1, background: 'hsl(var(--muted))',
          }} />
          {/* Active range highlight */}
          <div style={{
            position: 'absolute', height: 2, borderRadius: 1,
            background: 'hsl(var(--foreground))',
            left: `${(sliderFrom / WINDOW_DAYS) * 100}%`,
            width: `${((sliderTo - sliderFrom) / WINDOW_DAYS) * 100}%`,
          }} />
          {/* Left thumb */}
          <div
            onMouseDown={startDragLeft}
            onTouchStart={startDragLeft}
            style={{
              position: 'absolute', width: 16, height: 16, borderRadius: '50%',
              border: '2px solid hsl(var(--foreground))', background: 'hsl(var(--background))',
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              cursor: dragging === 'left' ? 'grabbing' : 'grab',
              left: `calc(${(sliderFrom / WINDOW_DAYS) * 100}% - 8px)`,
              zIndex: 2,
              boxSizing: 'border-box',
            }}
          />
          {/* Right thumb */}
          <div
            onMouseDown={startDragRight}
            onTouchStart={startDragRight}
            style={{
              position: 'absolute', width: 16, height: 16, borderRadius: '50%',
              border: '2px solid hsl(var(--foreground))', background: 'hsl(var(--background))',
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              cursor: dragging === 'right' ? 'grabbing' : 'grab',
              left: `calc(${(sliderTo / WINDOW_DAYS) * 100}% - 8px)`,
              zIndex: 2,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'hsl(var(--muted-foreground))', pointerEvents: 'none' }}>
          <span>1 yr ago</span><span>9 mo</span><span>6 mo</span><span>3 mo</span><span>Today</span>{futureDays > 0 && <span>End of month</span>}
        </div>
      </div>
    </div>
  );
}

export function DatePill({ label, value, onChange, dates = [], weekMode = false }: {
  label: string;
  value: RelativeDateValue;
  onChange: (v: RelativeDateValue) => void;
  dates?: (string | Date)[];
  weekMode?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
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
  const [futureDaysVal, setFutureDaysVal] = useState(0);

  useEffect(() => {
    if (open) setRange(computeInitial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const presets: RelativeDateValue[] = weekMode
    ? [
        { type: 'this_week' }, { type: 'last_week' },
        { type: 'this_month' }, { type: 'last_month' },
      ]
    : [
        { type: 'this_week' }, { type: 'last_week' },
        { type: 'this_month' }, { type: 'last_month' },
        { type: 'last_n_weeks', n: 4 }, { type: 'last_n_months', n: 3 },
        { type: 'last_n_months', n: 6 }, { type: 'last_n_months', n: 12 },
      ];

  const selectPreset = (p: RelativeDateValue) => {
    if (weekMode && p.type !== 'all' && p.type !== 'custom') {
      const now = new Date();
      let from: Date | null = null;
      let to: Date | null = null;
      if (p.type === 'this_week') {
        from = mondayOfWeek(now); to = sundayOfWeek(now);
      } else if (p.type === 'last_week') {
        const lastWeek = new Date(now); lastWeek.setDate(now.getDate() - 7);
        from = mondayOfWeek(lastWeek); to = sundayOfWeek(lastWeek);
      } else if (p.type === 'this_month') {
        const r = weekModeMonthRange(now.getFullYear(), now.getMonth());
        from = r.from; to = r.to;
      } else if (p.type === 'last_month') {
        const r = weekModeMonthRange(now.getFullYear(), now.getMonth() - 1);
        from = r.from; to = r.to;
      }
      if (from && to) {
        onChange({ type: 'custom', from: toISO(from), to: toISO(to) });
        setOpen(false);
        return;
      }
    }
    onChange(p);
    setOpen(false);
  };

  const applyRange = () => {
    const today = startOfDay(new Date());
    const from = new Date(today.getTime() - range.toDay * DAY_MS);
    // When slider is at rightmost position (fromDay = 0), extend by futureDays
    // so the pill label matches the slider's "→ to" date exactly.
    const to = new Date(today.getTime() + (futureDaysVal - range.fromDay) * DAY_MS);
    onChange({ type: 'custom', from: toISO(from), to: toISO(to) });
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={pillButtonStyle(isActive)}>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>{label}</span>
        <span style={{ fontWeight: 500, color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--foreground))' }}>{relativeDateLabel(value)}</span>
        <ChevronDown className="csp-icon-sm" />
      </button>
      {open && (
        <div style={{ ...popoverStyle, width: 560, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Presets</span>
            {isActive && (
              <button type="button" onClick={() => { onChange({ type: 'all' }); setOpen(false); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Clear</button>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {([{ type: 'all' } as RelativeDateValue, ...presets]).map((p, i) => {
              const isSel = JSON.stringify(value) === JSON.stringify(p);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectPreset(p)}
                  style={{
                    padding: '0 12px', height: 28, borderRadius: 9999,
                    border: '1px solid hsl(var(--border))', fontSize: 11, cursor: 'pointer',
                    background: isSel ? 'hsl(var(--foreground))' : 'transparent',
                    color: isSel ? 'hsl(var(--background))' : 'hsl(var(--foreground))',
                  }}
                >{relativeDateLabel(p)}</button>
              );
            })}
          </div>

          <div style={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))', padding: 12 }}>
            <HistogramRangeSlider
              dates={dates}
              fromDay={range.fromDay}
              toDay={range.toDay}
              weekMode={weekMode}
              onChange={(fromDay, toDay) => {
                if (weekMode) {
                  const snappedFrom = Math.round(fromDay / 7) * 7;
                  const snappedTo = Math.round(toDay / 7) * 7;
                  setRange({ fromDay: snappedFrom, toDay: Math.max(snappedTo, snappedFrom + 7) });
                } else {
                  setRange({ fromDay, toDay });
                }
              }}
              onFutureDays={setFutureDaysVal}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" onClick={applyRange} className="csp-btn csp-btn-primary csp-btn-sm">Apply range</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
