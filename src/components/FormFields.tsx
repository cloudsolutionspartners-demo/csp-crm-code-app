import * as React from 'react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import { Search, Check, ChevronsUpDown, CalendarIcon, X } from './Icons';

interface FormFieldLabelProps {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  error?: string;
}

export function FormField({ label, required, className, children, error }: FormFieldLabelProps) {
  return (
    <div className={cn('csp-form-field', className)}>
      <label
        className="csp-field-label"
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'hsl(var(--muted-foreground))',
          marginBottom: 6,
          display: 'block',
        }}
      >
        {label}
        {required && (
          <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>
        )}
      </label>
      {children}
      {error && <p className="csp-field-error">{error}</p>}
    </div>
  );
}

const INPUT_HEIGHT_STYLE: React.CSSProperties = { height: 36 };

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  type?: string;
  min?: string;
  max?: string;
}

export function TextField({ label, value, onChange, required, placeholder, className, readOnly, type = 'text', min, max }: TextFieldProps) {
  return (
    <FormField label={label} required={required} className={className}>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        min={min}
        max={max}
        className={cn('csp-input', readOnly && 'csp-input-readonly')}
        style={INPUT_HEIGHT_STYLE}
      />
    </FormField>
  );
}

interface EmailFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  externalError?: string;
}

export function EmailField({ label, value, onChange, required, placeholder, className, externalError }: EmailFieldProps) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const formatError = value.length > 0 && !emailRegex.test(value);
  const errorMsg = externalError || (formatError ? 'Enter a valid email address' : undefined);
  return (
    <FormField label={label} required={required} className={className} error={errorMsg}>
      <input
        type="email"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'email@example.com'}
        className={cn('csp-input', errorMsg && 'csp-input-error')}
        style={INPUT_HEIGHT_STYLE}
      />
    </FormField>
  );
}

interface WebsiteFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export function WebsiteField({ label, value, onChange, required, placeholder, className }: WebsiteFieldProps) {
  const websiteRegex = /^(https?:\/\/)?(www\.)?[\w.-]+\.[a-z]{2,}/i;
  const hasError = value.length > 0 && !websiteRegex.test(value);
  return (
    <FormField label={label} required={required} className={className} error={hasError ? 'Enter a valid domain (e.g. example.co.uk)' : undefined}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'www.example.com'}
        className={cn('csp-input', hasError && 'csp-input-error')}
        style={INPUT_HEIGHT_STYLE}
      />
    </FormField>
  );
}

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

export function DateField({ label, value, onChange, required, className, placeholder }: DateFieldProps) {
  const isEmpty = !value;
  return (
    <FormField label={label} required={required} className={className}>
      <input
        type="date"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className={`csp-input csp-date-input${isEmpty ? ' csp-date-input-empty' : ''}`}
        data-empty={isEmpty ? 'true' : 'false'}
        onFocus={e => { e.currentTarget.classList.remove('csp-date-input-empty'); }}
        onBlur={e => { if (!e.currentTarget.value) e.currentTarget.classList.add('csp-date-input-empty'); }}
        style={INPUT_HEIGHT_STYLE}
      />
    </FormField>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export function SelectField({ label, value, onChange, options, required, placeholder, className }: SelectFieldProps) {
  const showClear = !!value && !required;
  return (
    <FormField label={label} required={required} className={className}>
      <select value={value} onChange={e => onChange(e.target.value)} className="csp-select" style={INPUT_HEIGHT_STYLE}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {showClear && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onChange('');
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '11px',
            color: 'hsl(var(--muted-foreground))',
            padding: '2px 0 0 0',
            lineHeight: 1,
            textDecoration: 'underline',
            opacity: 0.7,
            alignSelf: 'flex-start',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; }}
        >
          Clear selection
        </button>
      )}
    </FormField>
  );
}

interface SwitchFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function SwitchField({ label, checked, onChange, className }: SwitchFieldProps) {
  return (
    <FormField label={label} className={className}>
      <div className="csp-switch-wrapper">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={cn('csp-switch', checked && 'csp-switch-on')}
        >
          <span className="csp-switch-thumb" />
        </button>
      </div>
    </FormField>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  rows?: number;
  readOnly?: boolean;
}

export function TextAreaField({ label, value, onChange, required, placeholder, className, rows = 3, readOnly }: TextAreaFieldProps) {
  return (
    <FormField label={label} required={required} className={className}>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        readOnly={readOnly}
        className={cn('csp-textarea', readOnly && 'csp-input-readonly')}
      />
    </FormField>
  );
}

interface LookupFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; sublabel?: string }[];
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export function LookupField({ label, value, onChange, options, required, placeholder, className }: LookupFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(lower));
  }, [options, search]);

  const selectedLabel = options.find(o => o.value === value)?.label;
  const showClear = !!value && !required;

  return (
    <FormField label={label} required={required} className={className}>
      <div ref={ref} className="csp-lookup-wrapper">
        <button
          type="button"
          className={cn('csp-lookup-trigger', !value && 'csp-text-muted')}
          onClick={() => setOpen(!open)}
          style={INPUT_HEIGHT_STYLE}
        >
          <span className="csp-lookup-text">{selectedLabel || placeholder || `Select ${label.toLowerCase()}`}</span>
          <ChevronsUpDown className="csp-lookup-chevron" />
        </button>
        {open && (
          <div className="csp-lookup-dropdown">
            <div className="csp-lookup-search-wrap">
              <Search className="csp-lookup-search-icon" />
              <input
                className="csp-lookup-search"
                placeholder={`Search ${label.toLowerCase()}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="csp-lookup-options">
              {filtered.length === 0 ? (
                <div className="csp-lookup-empty">No results found</div>
              ) : filtered.map(o => (
                <button
                  key={o.value}
                  className={cn('csp-lookup-option', value === o.value && 'csp-lookup-option-selected')}
                  onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                >
                  <Check className={cn('csp-lookup-check', value === o.value ? 'csp-visible' : 'csp-invisible')} />
                  <span className="csp-lookup-option-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                    <span>{o.label}</span>
                    {o.sublabel && (
                      <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                        {o.sublabel}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {showClear && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onChange('');
            setOpen(false);
            setSearch('');
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '11px',
            color: 'hsl(var(--muted-foreground))',
            padding: '2px 0 0 0',
            lineHeight: 1,
            textDecoration: 'underline',
            opacity: 0.7,
            alignSelf: 'flex-start',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; }}
        >
          Clear selection
        </button>
      )}
    </FormField>
  );
}
