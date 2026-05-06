import { ReactNode, useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ChevronsUpDown, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parse, isValid } from 'date-fns';

interface FormFieldLabelProps {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
  error?: string;
}

export function FormField({ label, required, className, children, error }: FormFieldLabelProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        {label}
        {required && <span className="text-destructive text-sm leading-none">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
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
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={cn('h-9 text-sm', readOnly && 'bg-muted/50 cursor-default')}
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
      <Input
        type="email"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'email@example.com'}
        className={cn('h-9 text-sm', hasError && 'border-destructive focus-visible:ring-destructive')}
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
      <Input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'www.example.com'}
        className={cn('h-9 text-sm', hasError && 'border-destructive focus-visible:ring-destructive')}
      />
    </FormField>
  );
}

interface DateFieldProps {
  label: string;
  value: string; // yyyy-MM-dd string
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

export function DateField({ label, value, onChange, required, className, placeholder }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const dateValue = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;
  const validDate = dateValue && isValid(dateValue) ? dateValue : undefined;

  return (
    <FormField label={label} required={required} className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full h-9 justify-start text-left text-sm font-normal',
              !value && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-50" />
            {validDate ? format(validDate, 'dd MMM yyyy') : <span>{placeholder || 'Pick a date'}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={validDate}
            onSelect={(date) => {
              onChange(date ? format(date, 'yyyy-MM-dd') : '');
              setOpen(false);
            }}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
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
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder={placeholder || `Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
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
      <div className="pt-1">
        <Switch checked={checked} onCheckedChange={onChange} />
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
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        readOnly={readOnly}
        className={cn('text-sm', readOnly && 'bg-muted/50 cursor-default')}
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

  const filtered = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(lower));
  }, [options, search]);

  const selectedLabel = options.find(o => o.value === value)?.label;

  return (
    <FormField label={label} required={required} className={className}>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(''); }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full h-9 justify-between text-sm font-normal',
              !value && 'text-muted-foreground'
            )}
          >
            <span className="truncate">{selectedLabel || placeholder || `Select ${label.toLowerCase()}`}</span>
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder={`Search ${label.toLowerCase()}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">No results found</div>
            ) : filtered.map(o => (
              <button
                key={o.value}
                className={cn(
                  'flex w-full items-center rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground',
                  value === o.value && 'bg-accent text-accent-foreground'
                )}
                onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
              >
                <Check className={cn('mr-2 h-4 w-4', value === o.value ? 'opacity-100' : 'opacity-0')} />
                <span className="truncate">{o.label}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </FormField>
  );
}
