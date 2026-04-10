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
      <label className="csp-field-label">
        {label}
        {required && <span className="csp-required">*</span>}
      </label>
      {children}
      {error && <p className="csp-field-error">{error}</p>}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  type?: string;
}

export function TextField({ label, value, onChange, required, placeholder, className, readOnly, type = 'text' }: TextFieldProps) {
  return (
    <FormField label={label} required={required} className={className}>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={cn('csp-input', readOnly && 'csp-input-readonly')}
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
}

export function EmailField({ label, value, onChange, required, placeholder, className }: EmailFieldProps) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const hasError = value.length > 0 && !emailRegex.test(value);
  return (
    <FormField label={label} required={required} className={className} error={hasError ? 'Enter a valid email address' : undefined}>
      <input
        type="email"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'email@example.com'}
        className={cn('csp-input', hasError && 'csp-input-error')}
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
  const websiteRegex = /^(https?:\/\/|www\.)[^\s]+\.[^\s]{2,}$/i;
  const hasError = value.length > 0 && !websiteRegex.test(value);
  return (
    <FormField label={label} required={required} className={className} error={hasError ? 'Must start with www. or http(s)://' : undefined}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'www.example.com'}
        className={cn('csp-input', hasError && 'csp-input-error')}
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
  return (
    <FormField label={label} required={required} className={className}>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="csp-input csp-date-input"
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
  return (
    <FormField label={label} required={required} className={className}>
      <select value={value} onChange={e => onChange(e.target.value)} className="csp-select">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
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
  options: { value: string; label: string }[];
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

  return (
    <FormField label={label} required={required} className={className}>
      <div ref={ref} className="csp-lookup-wrapper">
        <button
          type="button"
          className={cn('csp-lookup-trigger', !value && 'csp-text-muted')}
          onClick={() => setOpen(!open)}
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
                  <span className="csp-lookup-option-text">{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </FormField>
  );
}
