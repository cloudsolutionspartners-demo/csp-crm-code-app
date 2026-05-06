// Reports forecast logic — accepts live data as parameters (no mock-data imports).
// Adapted from the Lovable reference at C:\DEV\partner-port-pro\src\lib\reports-forecast.ts.

import type { Contract, Invoice, Expense, Timesheet, CurrencyCode } from '../types/crm';
import type { BusinessUnit } from '../services/businessUnitService';

export type MonthKey = { year: number; month: number; label: string }; // month 1-12

export function getMonthWindow(now = new Date()): {
  lastMonth: MonthKey;
  thisMonth: MonthKey;
  nextMonth: MonthKey;
  inTwoMonths: MonthKey;
} {
  const make = (offset: number): MonthKey => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
    };
  };
  return {
    lastMonth: make(-1),
    thisMonth: make(0),
    nextMonth: make(1),
    inTwoMonths: make(2),
  };
}

function workingDaysInMonth(year: number, month: number): number {
  let count = 0;
  const days = new Date(year, month, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

/** Average monthly hours from the last 2 months of timesheets for a contract. */
export function avgMonthlyHoursForContract(
  contractId: string,
  timesheets: Timesheet[],
  now = new Date(),
): number {
  const { lastMonth } = getMonthWindow(now);
  const twoBack = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const buckets: Record<string, number> = {};
  for (const ts of timesheets) {
    if (ts.contractId !== contractId) continue;
    for (const e of ts.entries) {
      if (!e.date) continue;
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const isLast = d.getFullYear() === lastMonth.year && d.getMonth() + 1 === lastMonth.month;
      const isPrev = d.getFullYear() === twoBack.getFullYear() && d.getMonth() === twoBack.getMonth();
      if (isLast || isPrev) {
        buckets[key] = (buckets[key] || 0) + e.hours;
      }
    }
  }
  const vals = Object.values(buckets);
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

export function actualMonthlyHoursForContract(
  contractId: string,
  m: { year: number; month: number },
  timesheets: Timesheet[],
): number {
  let total = 0;
  for (const ts of timesheets) {
    if (ts.contractId !== contractId) continue;
    for (const e of ts.entries) {
      if (!e.date) continue;
      const d = new Date(e.date);
      if (d.getFullYear() === m.year && d.getMonth() + 1 === m.month) total += e.hours;
    }
  }
  return total;
}

function contractActiveInMonth(c: Contract, m: { year: number; month: number }): boolean {
  if (c.status !== 'Active' && c.status !== 'Draft') return false;
  const monthStart = new Date(m.year, m.month - 1, 1);
  const monthEnd = new Date(m.year, m.month, 0);
  if (!c.startDate) return false;
  const start = new Date(c.startDate);
  const end = c.endDate ? new Date(c.endDate) : null;
  if (start > monthEnd) return false;
  if (end && end < monthStart) return false;
  return true;
}

export interface ContractMonthLine {
  contractId: string;
  contractNumber: string;
  contractName: string;
  contractor: string;
  parentAccountId: string;
  parentAccountName: string;
  country: string;
  hours: number;
  daysOrUnits: number;
  unitOfMeasure: Contract['unitOfMeasure'];
  sellAmount: number;
  sellCurrency: CurrencyCode;
  buyAmount: number;
  buyCurrency: CurrencyCode;
  source: 'invoice' | 'timesheet-actual' | 'timesheet-forecast' | 'fixed-monthly';
}

function monthsBetween(start: string, end?: string): number {
  if (!end) return 1;
  const s = new Date(start), e = new Date(end);
  return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1);
}

function buCountry(buId: string, businessUnits: BusinessUnit[]): string {
  const bu = businessUnits.find(b => b.id === buId);
  return bu?.name || 'Romania';
}

/** Compute per-contract billing + cost for a single month. */
export function computeContractMonth(
  c: Contract,
  m: { year: number; month: number },
  timesheets: Timesheet[],
  businessUnits: BusinessUnit[],
  accounts: { id: string; entityId: string }[],
  now = new Date(),
): ContractMonthLine | null {
  if (!contractActiveInMonth(c, m)) return null;
  const contractor = c.assignedToName || '—';
  const parentAccount = accounts.find(a => a.id === c.parentAccountId);
  const country = buCountry(parentAccount?.entityId || c.entityId, businessUnits);

  const isPastOrCurrent = (() => {
    const monthStart = new Date(m.year, m.month - 1, 1);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return monthStart <= currentMonthStart;
  })();

  // Fixed-price monthly contracts: use sellRate / buyRate as monthly amounts
  if (c.unitOfMeasure === 'Month' || c.billingType === 'Monthly Salary' || c.billingType === 'Fixed Price') {
    return {
      contractId: c.id,
      contractNumber: c.contractNumber,
      contractName: c.name,
      contractor,
      parentAccountId: c.parentAccountId,
      parentAccountName: c.parentAccountName || '',
      country,
      hours: 0,
      daysOrUnits: 1,
      unitOfMeasure: c.unitOfMeasure,
      sellAmount: c.unitOfMeasure === 'Fixed' ? c.sellRate / Math.max(1, monthsBetween(c.startDate, c.endDate)) : c.sellRate,
      sellCurrency: c.sellCurrency,
      buyAmount: c.unitOfMeasure === 'Fixed' ? c.buyRate / Math.max(1, monthsBetween(c.startDate, c.endDate)) : c.buyRate,
      buyCurrency: c.buyCurrency,
      source: 'fixed-monthly',
    };
  }

  // Hourly / daily contracts driven by timesheets
  const actualHours = actualMonthlyHoursForContract(c.id, m, timesheets);
  const useActual = isPastOrCurrent || actualHours > 0;
  const hours = useActual
    ? actualHours
    : avgMonthlyHoursForContract(c.id, timesheets, now) || workingDaysInMonth(m.year, m.month) * 8;

  const sellHourly = c.sellHourlyRate || (c.unitOfMeasure === 'Day' ? c.sellRate / 8 : c.sellRate);
  const buyHourly = c.buyHourlyRate || (c.unitOfMeasure === 'Day' ? c.buyRate / 8 : c.buyRate);

  return {
    contractId: c.id,
    contractNumber: c.contractNumber,
    contractName: c.name,
    contractor,
    parentAccountId: c.parentAccountId,
    parentAccountName: c.parentAccountName || '',
    country,
    hours,
    daysOrUnits: c.unitOfMeasure === 'Day' ? hours / 8 : hours,
    unitOfMeasure: c.unitOfMeasure,
    sellAmount: hours * sellHourly,
    sellCurrency: c.sellCurrency,
    buyAmount: hours * buyHourly,
    buyCurrency: c.buyCurrency,
    source: useActual ? 'timesheet-actual' : 'timesheet-forecast',
  };
}

export interface MonthBuckets {
  byCurrencyCountry: Map<string, { country: string; currency: CurrencyCode; billing: number; cost: number; profit: number }>;
  lines: ContractMonthLine[];
}

export function buildBillingForMonth(
  m: MonthKey,
  contracts: Contract[],
  timesheets: Timesheet[],
  businessUnits: BusinessUnit[],
  accounts: { id: string; entityId: string }[],
  now = new Date(),
): MonthBuckets {
  const lines: ContractMonthLine[] = [];
  for (const c of contracts) {
    const line = computeContractMonth(c, m, timesheets, businessUnits, accounts, now);
    if (line) lines.push(line);
  }
  const byCurrencyCountry = new Map<string, { country: string; currency: CurrencyCode; billing: number; cost: number; profit: number }>();
  for (const l of lines) {
    // Billing always goes to sell-currency bucket
    const sellKey = `${l.country}|${l.sellCurrency}`;
    const sellBucket = byCurrencyCountry.get(sellKey) ?? { country: l.country, currency: l.sellCurrency, billing: 0, cost: 0, profit: 0 };
    sellBucket.billing += l.sellAmount;
    sellBucket.profit += l.sellAmount;
    byCurrencyCountry.set(sellKey, sellBucket);

    // Cost goes to buy-currency bucket (may be same or different)
    const buyKey = `${l.country}|${l.buyCurrency}`;
    const buyBucket = byCurrencyCountry.get(buyKey) ?? { country: l.country, currency: l.buyCurrency, billing: 0, cost: 0, profit: 0 };
    buyBucket.cost += l.buyAmount;
    buyBucket.profit -= l.buyAmount;
    byCurrencyCountry.set(buyKey, buyBucket);
  }
  return { byCurrencyCountry, lines };
}

/**
 * Last-month profit using actual invoices minus expenses.
 * Dataverse mappers don't store periodMonth/periodYear, so derive from invoiceDate / dateIssued.
 */
export function buildLastMonthProfitFromInvoices(
  m: MonthKey,
  invoices: Invoice[],
  expenses: Expense[],
  businessUnits: BusinessUnit[],
): MonthBuckets['byCurrencyCountry'] {
  const out = new Map<string, { country: string; currency: CurrencyCode; billing: number; cost: number; profit: number }>();

  const inMonthStr = (s?: string) => {
    if (!s) return false;
    const d = new Date(s);
    return d.getFullYear() === m.year && d.getMonth() + 1 === m.month;
  };

  for (const inv of invoices) {
    const periodMatch = inv.periodMonth === m.month && inv.periodYear === m.year;
    if (!periodMatch && !inMonthStr(inv.invoiceDate)) continue;
    if (inv.status === 'Cancelled' || inv.status === 'Draft') continue;
    const country = buCountry(inv.entityId, businessUnits);
    const key = `${country}|${inv.currencyCode}`;
    const cur = out.get(key) ?? { country, currency: inv.currencyCode, billing: 0, cost: 0, profit: 0 };
    cur.billing += inv.total || 0;
    out.set(key, cur);
  }

  for (const exp of expenses) {
    const periodMatch = exp.periodMonth === m.month && exp.periodYear === m.year;
    if (!periodMatch && !inMonthStr(exp.dateIssued)) continue;
    const country = buCountry(exp.entityId, businessUnits);
    const key = `${country}|${exp.currencyCode}`;
    const cur = out.get(key) ?? { country, currency: exp.currencyCode, billing: 0, cost: 0, profit: 0 };
    cur.cost += exp.netAmount || 0;
    out.set(key, cur);
  }

  for (const v of out.values()) v.profit = v.billing - v.cost;
  return out;
}
