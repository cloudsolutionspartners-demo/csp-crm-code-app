import { useEffect, useRef, useState } from 'react';

// Click-based single-select dropdown.
// Replaces native <select> in places where the Power Apps runtime overlay
// intercepts mouse clicks. Auto-closes on outside-click and on Escape.

export interface PickerOption {
  value: string;
  label: string;
}

export interface PickerProps {
  value: string;
  onChange: (v: string) => void;
  options: PickerOption[];
  placeholder?: string;
  triggerStyle?: React.CSSProperties;
  disabled?: boolean;
}

const defaultTriggerStyle: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 10px', fontSize: 14,
  border: '1px solid hsl(var(--border))', borderRadius: 6, background: 'white',
  boxSizing: 'border-box',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  textAlign: 'left', cursor: 'pointer',
};

export function Picker({ value, onChange, options, placeholder, triggerStyle, disabled }: PickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        style={{ ...defaultTriggerStyle, ...triggerStyle, opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <span style={{
          color: selected ? 'inherit' : 'hsl(var(--muted-foreground))',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {selected ? selected.label : (placeholder || '—')}
        </span>
        <span style={{ marginLeft: 8, color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
          background: 'white', border: '1px solid hsl(var(--border))', borderRadius: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 240, overflowY: 'auto',
        }}>
          {options.length === 0 && (
            <div style={{ padding: 12, fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>No options.</div>
          )}
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 12px', border: 'none',
                background: o.value === value ? 'hsl(var(--muted) / 0.4)' : 'transparent',
                cursor: 'pointer', fontSize: 13, borderBottom: '1px solid hsl(var(--border))',
                fontWeight: o.value === value ? 600 : 400,
              }}
              onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = 'hsl(var(--muted) / 0.3)'; }}
              onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = 'transparent'; }}
            >{o.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
