import { CurrencyCode, CURRENCY_SYMBOLS } from '../types/crm';

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? '';
  const safeAmount = Number.isFinite(amount as any) ? Number(amount) : 0;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount);
  return `${symbol}${formatted}`;
}

/**
 * Format a Dataverse opportunity primary id for display.
 * Converts "OPPORTUNITY-0000000003" → "OPP-0003". Falls back to original string
 * if format unrecognized. Underlying storage value is never modified — display only.
 */
export function formatOppNumber(raw: string | undefined | null): string {
  if (!raw) return '';
  const match = String(raw).match(/OPPORTUNITY-0*(\d+)/i);
  if (!match) return String(raw);
  const n = parseInt(match[1], 10);
  return `OPP-${String(n).padStart(4, '0')}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
