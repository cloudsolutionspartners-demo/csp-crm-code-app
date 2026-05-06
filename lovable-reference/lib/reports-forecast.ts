import {
  contracts as allContracts,
  invoices as allInvoices,
  expenses as allExpenses,
  timesheets as allTimesheets,
  getEntityById,
  getContactById,
} from '@/data/mock-data';
import type { Contract, CurrencyCode, Country } from '@/types/crm';

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

function monthEq(a: { year: number; month: number }, b: { year: number; month: number }) {
  return a.year === b.year && a.month === b.month;
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
export function avgMonthlyHoursForContract(contractId: string, now = new Date()): number {
  const { lastMonth } = getMonthWindow(now);
  const twoBack = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const buckets: Record<string, number> = {};
  for (const ts of allTimesheets) {
    if (ts.contractId !== contractId) continue;
    for (const e of ts.entries) {
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
): number {
  let total = 0;
  for (const ts of allTimesheets) {
    if (ts.contractId !== contractId) continue;
    for (const e of ts.entries) {
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
  country: Country;
  hours: number;            // forecasted or actual hours used
  daysOrUnits: number;      // for Day/Month/Fixed contracts
  unitOfMeasure: Contract['unitOfMeasure'];
  sellAmount: number;       // in sellCurrency
  sellCurrency: CurrencyCode;
  buyAmount: number;        // in buyCurrency
  buyCurrency: CurrencyCode;
  source: 'invoice' | 'timesheet-actual' | 'timesheet-forecast' | 'fixed-monthly';
}

/** Compute per-contract billing + cost for a single month. */
export function computeContractMonth(c: Contract, m: { year: number; month: number }, now = new Date()): ContractMonthLine | null {
  if (!contractActiveInMonth(c, m)) return null;
  const contact = getContactById(c.contactId);
  const entity = getEntityById(c.entityId);
  const contractor = contact ? `${contact.firstName} ${contact.lastName}` : '—';
  const country = (entity?.country ?? 'Romania') as Country;

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
  const actualHours = actualMonthlyHoursForContract(c.id, m);
  const useActual = isPastOrCurrent || actualHours > 0;
  const hours = useActual ? actualHours : avgMonthlyHoursForContract(c.id, now) || workingDaysInMonth(m.year, m.month) * 8;

  const sellHourly = c.sellHourlyRate ?? (c.unitOfMeasure === 'Day' ? c.sellRate / 8 : c.sellRate);
  const buyHourly = c.buyHourlyRate ?? (c.unitOfMeasure === 'Day' ? c.buyRate / 8 : c.buyRate);

  return {
    contractId: c.id,
    contractNumber: c.contractNumber,
    contractName: c.name,
    contractor,
    parentAccountId: c.parentAccountId,
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

function monthsBetween(start: string, end?: string): number {
  if (!end) return 1;
  const s = new Date(start), e = new Date(end);
  return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1);
}

export interface MonthBuckets {
  byCurrencyCountry: Map<string, { country: Country; currency: CurrencyCode; billing: number; cost: number; profit: number }>;
  lines: ContractMonthLine[];
}

export function buildBillingForMonth(m: MonthKey, now = new Date()): MonthBuckets {
  const lines: ContractMonthLine[] = [];
  for (const c of allContracts) {
    const line = computeContractMonth(c, m, now);
    if (line) lines.push(line);
  }
  const byCurrencyCountry = new Map<string, { country: Country; currency: CurrencyCode; billing: number; cost: number; profit: number }>();
  for (const l of lines) {
    const key = `${l.country}|${l.sellCurrency}`;
    const cur = byCurrencyCountry.get(key) ?? { country: l.country, currency: l.sellCurrency, billing: 0, cost: 0, profit: 0 };
    cur.billing += l.sellAmount;
    // cost in same currency only if same; otherwise tracked separately later
    if (l.buyCurrency === l.sellCurrency) {
      cur.cost += l.buyAmount;
      cur.profit += l.sellAmount - l.buyAmount;
    } else {
      cur.profit += l.sellAmount; // cost will be reflected in the buy-currency bucket
    }
    byCurrencyCountry.set(key, cur);
  }
  return { byCurrencyCountry, lines };
}

/** Last-month profit override using actual invoices minus expenses, grouped by country+currency. */
export function buildLastMonthProfitFromInvoices(m: MonthKey): MonthBuckets['byCurrencyCountry'] {
  const out = new Map<string, { country: Country; currency: CurrencyCode; billing: number; cost: number; profit: number }>();
  for (const inv of allInvoices) {
    if (inv.periodMonth !== m.month || inv.periodYear !== m.year) continue;
    if (inv.status === 'Cancelled' || inv.status === 'Draft') continue;
    const entity = getEntityById(inv.entityId);
    const country = (entity?.country ?? 'Romania') as Country;
    const key = `${country}|${inv.currencyCode}`;
    const cur = out.get(key) ?? { country, currency: inv.currencyCode, billing: 0, cost: 0, profit: 0 };
    cur.billing += inv.subtotal;
    out.set(key, cur);
  }
  for (const exp of allExpenses) {
    if (exp.periodMonth !== m.month || exp.periodYear !== m.year) continue;
    const entity = getEntityById(exp.entityId);
    const country = (entity?.country ?? 'Romania') as Country;
    const key = `${country}|${exp.currencyCode}`;
    const cur = out.get(key) ?? { country, currency: exp.currencyCode, billing: 0, cost: 0, profit: 0 };
    cur.cost += exp.netAmount;
    out.set(key, cur);
  }
  for (const v of out.values()) v.profit = v.billing - v.cost;
  return out;
}
