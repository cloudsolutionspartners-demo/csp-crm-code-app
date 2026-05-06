import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader, PageLoading } from '../components/Shared';
import { Tabs } from '../components/Layout';
import { TrendingUp, Calendar, ChevronDown, ChevronRight } from '../components/Icons';
import { formatCurrency } from '../lib/utils';
import {
  getMonthWindow,
  buildBillingForMonth,
  buildLastMonthProfitFromInvoices,
  type MonthKey,
  type ContractMonthLine,
} from '../lib/reports-forecast';
import { fetchContracts } from '../services/contractService';
import { fetchInvoices } from '../services/invoiceService';
import { fetchExpenses } from '../services/expenseService';
import { fetchTimesheets } from '../services/timesheetService';
import { fetchBusinessUnits } from '../services/businessUnitService';
import type { BusinessUnit } from '../services/businessUnitService';
import { fetchAccounts } from '../services/accountService';
import type { Contract, Invoice, Expense, Timesheet, CurrencyCode, Account } from '../types/crm';

type MonthCol = { key: 'last' | 'this' | 'next' | 'in2'; m: MonthKey; isActual: boolean; isForecast: boolean };

// CSS-only grouped bar chart (same approach as DashboardPage)
function GroupedBarChart({
  data,
  bars,
  height = 240,
}: {
  data: { label: string; [key: string]: any }[];
  bars: { key: string; color: string; name: string }[];
  height?: number;
}) {
  const maxVal = Math.max(...data.flatMap(d => bars.map(b => Number(d[b.key]) || 0)), 1);
  return (
    <div>
      <div style={{ height, display: 'flex', gap: 8, alignItems: 'flex-end', paddingBottom: 20 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%' }}>
            <div style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'flex-end', width: '100%' }}>
              {bars.map((b, j) => {
                const val = Number(d[b.key]) || 0;
                return (
                  <div
                    key={j}
                    className="csp-chart-bar-interactive"
                    style={{
                      flex: 1,
                      height: `${(val / maxVal) * 100}%`,
                      backgroundColor: b.color,
                      borderRadius: '4px 4px 0 0',
                      minHeight: val > 0 ? 2 : 0,
                    }}
                    title={`${b.name}: ${val.toLocaleString()}`}
                  />
                );
              })}
            </div>
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', textAlign: 'center', lineHeight: 1.2 }}>
              {d.label}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4 }}>
        {bars.map((b, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: b.color, display: 'inline-block' }} />
            {b.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function fmt(n: number, currency: CurrencyCode) {
  return formatCurrency(n, currency);
}

interface AccountGroup {
  accountId: string;
  accountName: string;
  country: string;
  totals: Map<string, { currency: CurrencyCode; billing: number; cost: number; profit: number }>;
  lines: ContractMonthLine[];
}

function groupByAccount(lines: ContractMonthLine[]): AccountGroup[] {
  const map = new Map<string, AccountGroup>();
  for (const l of lines) {
    const key = l.parentAccountId || `__${l.contractId}`;
    let g = map.get(key);
    if (!g) {
      g = {
        accountId: key,
        accountName: l.parentAccountName || '—',
        country: l.country,
        totals: new Map(),
        lines: [],
      };
      map.set(key, g);
    }
    g.lines.push(l);
    const tk = l.sellCurrency;
    const cur = g.totals.get(tk) ?? { currency: tk, billing: 0, cost: 0, profit: 0 };
    cur.billing += l.sellAmount;
    if (l.buyCurrency === l.sellCurrency) {
      cur.cost += l.buyAmount;
      cur.profit += l.sellAmount - l.buyAmount;
    } else {
      cur.profit += l.sellAmount;
    }
    g.totals.set(tk, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.accountName.localeCompare(b.accountName));
}

function AccountDetailTable({ groups }: { groups: AccountGroup[] }) {
  if (groups.length === 0) {
    return <p className="csp-text-muted csp-text-sm">No active accounts in this month.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {groups.map(g => (
        <div key={g.accountId} style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'hsl(var(--muted) / 0.3)', borderBottom: '1px solid hsl(var(--border))', gap: '1rem' }}>
            <div>
              <p style={{ fontWeight: 500, fontSize: '0.875rem' }}>{g.accountName}</p>
              <p className="csp-text-muted" style={{ fontSize: '0.75rem' }}>{g.country}</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', textAlign: 'right' }}>
              {Array.from(g.totals.values()).map(t => (
                <div key={t.currency} style={{ fontSize: '0.75rem' }}>
                  <p className="csp-text-muted">{t.currency}</p>
                  <p style={{ fontWeight: 600 }}>{fmt(t.billing, t.currency)}</p>
                  <p style={{ fontSize: '0.6875rem', color: t.profit >= 0 ? '#15803d' : '#b91c1c' }}>
                    profit {fmt(t.profit, t.currency)}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <table className="csp-table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Contractor</th>
                <th style={{ textAlign: 'right' }}>Hours / Units</th>
                <th style={{ textAlign: 'right' }}>Billing</th>
                <th style={{ textAlign: 'right' }}>Cost</th>
                <th style={{ textAlign: 'right' }}>Profit</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {g.lines.map(l => {
                const sameCcy = l.sellCurrency === l.buyCurrency;
                const profit = sameCcy ? l.sellAmount - l.buyAmount : l.sellAmount;
                return (
                  <tr key={l.contractId}>
                    <td>
                      <div className="csp-td-mono" style={{ fontSize: '0.75rem' }}>{l.contractNumber}</div>
                      <div className="csp-text-muted" style={{ fontSize: '0.75rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.contractName}</div>
                    </td>
                    <td style={{ fontSize: '0.875rem' }}>{l.contractor}</td>
                    <td style={{ textAlign: 'right', fontSize: '0.875rem' }}>
                      {l.unitOfMeasure === 'Hour' || l.unitOfMeasure === 'Day'
                        ? `${l.hours.toFixed(0)}h${l.unitOfMeasure === 'Day' ? ` (${l.daysOrUnits.toFixed(1)}d)` : ''}`
                        : l.unitOfMeasure}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(l.sellAmount, l.sellCurrency)}</td>
                    <td className="csp-text-muted" style={{ textAlign: 'right' }}>{fmt(l.buyAmount, l.buyCurrency)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500, color: profit >= 0 ? '#15803d' : '#b91c1c' }}>
                      {sameCcy ? fmt(profit, l.sellCurrency) : '—'}
                    </td>
                    <td>
                      <span className="csp-badge-outline" style={{ fontSize: '0.6875rem' }}>
                        {l.source === 'invoice' && 'Invoice'}
                        {l.source === 'timesheet-actual' && 'Actual TS'}
                        {l.source === 'timesheet-forecast' && 'Avg 2mo'}
                        {l.source === 'fixed-monthly' && 'Fixed'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [dvAccounts, setDvAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('billing');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ this: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ctrs, invs, exps, tss, bus, accs] = await Promise.all([
          fetchContracts().catch(() => [] as Contract[]),
          fetchInvoices().catch(() => [] as Invoice[]),
          fetchExpenses().catch(() => [] as Expense[]),
          fetchTimesheets().catch(() => [] as Timesheet[]),
          fetchBusinessUnits().catch(() => [] as BusinessUnit[]),
          fetchAccounts().catch(() => [] as Account[]),
        ]);
        if (cancelled) return;
        setContracts(ctrs);
        setInvoices(invs);
        setExpenses(exps);
        setTimesheets(tss);
        setBusinessUnits(bus);
        setDvAccounts(accs);
      } catch (err) {
        console.error('[Reports] Load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const window = useMemo(() => getMonthWindow(), []);
  const months: MonthCol[] = useMemo(() => ([
    { key: 'last', m: window.lastMonth, isActual: true,  isForecast: false },
    { key: 'this', m: window.thisMonth, isActual: true,  isForecast: false },
    { key: 'next', m: window.nextMonth, isActual: false, isForecast: true  },
    { key: 'in2',  m: window.inTwoMonths, isActual: false, isForecast: true },
  ]), [window]);

  const monthData = useMemo(() => {
    return months.map((c, idx) => {
      if (idx === 0) {
        // Rule 1: Last month uses invoices + expenses for actuals
        const byCurrencyCountry = buildLastMonthProfitFromInvoices(c.m, invoices, expenses, businessUnits);
        return { byCurrencyCountry, lines: [] as ContractMonthLine[] };
      }
      // Rules 2 & 3: Current month = timesheet actuals, future = forecast
      return buildBillingForMonth(c.m, contracts, timesheets, businessUnits, dvAccounts);
    });
  }, [months, contracts, timesheets, invoices, expenses, businessUnits, dvAccounts]);
  const lastMonthInvoiceProfit = useMemo(
    () => buildLastMonthProfitFromInvoices(window.lastMonth, invoices, expenses, businessUnits),
    [window.lastMonth, invoices, expenses, businessUnits],
  );

  const headlineRows = useMemo(() => {
    const allKeys = new Set<string>();
    monthData.forEach(d => d.byCurrencyCountry.forEach((_, k) => allKeys.add(k)));
    return Array.from(allKeys).map(key => {
      const [country, currency] = key.split('|');
      const cells = monthData.map((d, i) => {
        const bucket = d.byCurrencyCountry.get(key);
        const billing = bucket?.billing ?? 0;
        let profit = bucket?.profit ?? 0;
        if (months[i].key === 'last') {
          const actual = lastMonthInvoiceProfit.get(key);
          if (actual) profit = actual.profit;
        }
        return { billing, profit };
      });
      return { key, country, currency: currency as CurrencyCode, cells };
    }).sort((a, b) => a.country.localeCompare(b.country) || a.currency.localeCompare(b.currency));
  }, [monthData, lastMonthInvoiceProfit, months]);

  const chartData = useMemo(() => months.map((c, i) => {
    let billing = 0, profit = 0;
    monthData[i].byCurrencyCountry.forEach(v => { billing += v.billing; profit += v.profit; });
    if (c.key === 'last') {
      let actualProfit = 0;
      lastMonthInvoiceProfit.forEach(v => { actualProfit += v.profit; });
      if (lastMonthInvoiceProfit.size > 0) profit = actualProfit;
    }
    return { label: c.m.label, billing: Math.round(billing), profit: Math.round(profit) };
  }), [months, monthData, lastMonthInvoiceProfit]);

  if (loading) return <PageLoading message="Loading reports..." />;

  const tabs = [
    { id: 'billing', label: 'Billing by Country & Currency' },
    { id: 'profit',  label: 'Profit by Country & Currency' },
    { id: 'accounts', label: 'Per-Account Detail' },
  ];

  return (
    <div>
      <PageHeader
        title="Billing & Profit"
        subtitle="Last month actuals, current month run-rate, and 2-month forward forecast"
      />

      {/* KPI strip: 4 month cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {months.map((c, i) => {
          const byCountry = new Map<string, Array<{ currency: string; billing: number; profit: number }>>();
          monthData[i].byCurrencyCountry.forEach((v, key) => {
            const arr = byCountry.get(v.country) ?? [];
            let profit = v.profit;
            if (c.key === 'last') {
              const actual = lastMonthInvoiceProfit.get(key);
              if (actual) profit = actual.profit;
            }
            arr.push({ currency: v.currency, billing: v.billing, profit });
            byCountry.set(v.country, arr);
          });
          const countries = Array.from(byCountry.entries()).sort((a, b) => a[0].localeCompare(b[0]));
          return (
            <div
              key={c.key}
              className="csp-card"
              style={{ padding: '0.75rem 1rem 1rem', border: c.key === 'this' ? '2px solid hsl(var(--primary))' : undefined }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', fontWeight: 600 }}>
                  <Calendar className="csp-icon-sm csp-text-muted" />
                  {c.m.label}
                </div>
                <span className="csp-badge-outline" style={{ fontSize: '0.625rem' }}>
                  {c.isActual ? 'Actual' : 'Forecast'}
                </span>
              </div>
              {countries.length === 0 && (
                <p className="csp-text-muted" style={{ fontSize: '0.75rem' }}>No activity</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {countries.map(([country, rows]) => (
                  <div key={country} style={{ borderRadius: 6, background: 'hsl(var(--muted) / 0.4)', border: '1px solid hsl(var(--border) / 0.6)', padding: '0.5rem' }}>
                    <p style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{country}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', columnGap: '0.5rem', fontSize: '0.625rem', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', letterSpacing: '0.05em' }}>
                      <span>Ccy</span>
                      <span style={{ textAlign: 'right' }}>Billing</span>
                      <span style={{ textAlign: 'right' }}>Profit</span>
                    </div>
                    {rows.map(r => (
                      <div key={r.currency} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', columnGap: '0.5rem', alignItems: 'baseline', fontSize: '0.875rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{r.currency}</span>
                        <span style={{ fontWeight: 600, textAlign: 'right' }}>{fmt(r.billing, r.currency as CurrencyCode)}</span>
                        <span style={{ fontSize: '0.75rem', textAlign: 'right', color: r.profit >= 0 ? '#15803d' : '#b91c1c' }}>
                          {r.profit >= 0 ? '+' : ''}{fmt(r.profit, r.currency as CurrencyCode)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4-Month Trajectory chart */}
      <div className="csp-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>
          <TrendingUp className="csp-icon-sm" />
          4-Month Trajectory (mixed currencies, indicative)
        </div>
        <GroupedBarChart
          data={chartData}
          bars={[
            { key: 'billing', color: 'hsl(207,63%,44%)', name: 'Billing' },
            { key: 'profit',  color: 'hsl(142,76%,36%)', name: 'Profit'  },
          ]}
        />
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab}>
        {activeTab === 'billing' && (
          <div className="csp-table-wrapper">
            <table className="csp-table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Currency</th>
                  {months.map(c => (
                    <th key={c.key} style={{ textAlign: 'right' }}>
                      {c.m.label} <span className="csp-text-muted" style={{ fontSize: '0.75rem' }}>({c.isActual ? 'Actual' : 'Fcst'})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {headlineRows.length === 0 ? (
                  <tr><td colSpan={2 + months.length} className="csp-td-empty">No data.</td></tr>
                ) : headlineRows.map(r => (
                  <tr key={r.key}>
                    <td style={{ fontWeight: 500 }}>{r.country}</td>
                    <td>{r.currency}</td>
                    {r.cells.map((cell, i) => (
                      <td key={i} style={{ textAlign: 'right' }}>{fmt(cell.billing, r.currency)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'profit' && (
          <>
            <p className="csp-text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
              Last month profit uses <strong>invoices − expenses</strong>. This/next/+2 months use timesheet hours × contract rates
              (forecasted from the last 2 months for active contracts).
            </p>
            <div className="csp-table-wrapper">
              <table className="csp-table">
                <thead>
                  <tr>
                    <th>Country</th>
                    <th>Currency</th>
                    {months.map(c => (
                      <th key={c.key} style={{ textAlign: 'right' }}>
                        {c.m.label} <span className="csp-text-muted" style={{ fontSize: '0.75rem' }}>({c.isActual ? 'Actual' : 'Fcst'})</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {headlineRows.length === 0 ? (
                    <tr><td colSpan={2 + months.length} className="csp-td-empty">No data.</td></tr>
                  ) : headlineRows.map(r => (
                    <tr key={r.key}>
                      <td style={{ fontWeight: 500 }}>{r.country}</td>
                      <td>{r.currency}</td>
                      {r.cells.map((cell, i) => (
                        <td key={i} style={{ textAlign: 'right', color: cell.profit >= 0 ? '#15803d' : '#b91c1c' }}>
                          {fmt(cell.profit, r.currency)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'accounts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {months.map((c, i) => {
              const isOpen = expanded[c.key] ?? c.key === 'this';
              const accountGroups = groupByAccount(monthData[i].lines);
              return (
                <div key={c.key} className="csp-card" style={{ padding: 0 }}>
                  <button
                    onClick={() => setExpanded(s => ({ ...s, [c.key]: !isOpen }))}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', fontWeight: 600 }}>
                      {isOpen ? <ChevronDown className="csp-icon-sm" /> : <ChevronRight className="csp-icon-sm" />}
                      {c.m.label} — {accountGroups.length} accounts ({monthData[i].lines.length} contracts)
                    </span>
                    <span className="csp-badge-outline" style={{ fontSize: '0.625rem' }}>
                      {c.isActual ? 'Actual' : 'Forecast'}
                    </span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 1rem 1rem' }}>
                      <AccountDetailTable groups={accountGroups} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Tabs>
    </div>
  );
}
