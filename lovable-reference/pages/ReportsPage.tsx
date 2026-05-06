import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { ChevronDown, ChevronRight, Download, TrendingUp, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';
import {
  getMonthWindow,
  buildBillingForMonth,
  buildLastMonthProfitFromInvoices,
  type MonthKey,
  type ContractMonthLine,
} from '@/lib/reports-forecast';
import { getAccountById } from '@/data/mock-data';

type MonthCol = { key: 'last' | 'this' | 'next' | 'in2'; m: MonthKey; isActual: boolean; isForecast: boolean };

export default function ReportsPage() {
  const window = getMonthWindow();
  const months: MonthCol[] = [
    { key: 'last', m: window.lastMonth, isActual: true, isForecast: false },
    { key: 'this', m: window.thisMonth, isActual: true, isForecast: false },
    { key: 'next', m: window.nextMonth, isActual: false, isForecast: true },
    { key: 'in2',  m: window.inTwoMonths, isActual: false, isForecast: true },
  ];

  const monthData = useMemo(() => months.map(c => buildBillingForMonth(c.m)), []);
  const lastMonthInvoiceProfit = useMemo(() => buildLastMonthProfitFromInvoices(window.lastMonth), []);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Headline totals per currency+country, per month
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
      return { key, country, currency: currency as any, cells };
    }).sort((a, b) => a.country.localeCompare(b.country) || a.currency.localeCompare(b.currency));
  }, [monthData, lastMonthInvoiceProfit]);

  // Chart data: sum per month assuming EUR-equivalent simplification (display currencies separately in tables)
  const chartData = months.map((c, i) => {
    let billing = 0, profit = 0;
    monthData[i].byCurrencyCountry.forEach(v => { billing += v.billing; profit += v.profit; });
    if (c.key === 'last') {
      let actualProfit = 0;
      lastMonthInvoiceProfit.forEach(v => { actualProfit += v.profit; });
      if (lastMonthInvoiceProfit.size > 0) profit = actualProfit;
    }
    return { month: c.m.label, billing: Math.round(billing), profit: Math.round(profit), kind: c.isForecast ? 'Forecast' : 'Actual' };
  });

  return (
    <div>
      <PageHeader
        title="Billing & Profit"
        subtitle="Last month actuals, current month run-rate, and 2-month forward forecast"
      />

      {/* KPI strip: 4 months × billing + profit broken down by country & currency */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {months.map((c, i) => {
          // Build per-country rows; each country may carry multiple currencies
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
            <Card key={c.key} className={c.key === 'this' ? 'border-primary' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {c.m.label}
                  </CardTitle>
                  <Badge variant={c.isActual ? 'secondary' : 'outline'} className="text-[10px]">
                    {c.isActual ? 'Actual' : 'Forecast'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {countries.length === 0 && (
                  <p className="text-xs text-muted-foreground">No activity</p>
                )}
                {countries.map(([country, rows]) => (
                  <div key={country} className="rounded-md bg-muted/40 border border-border/60 p-2 space-y-1.5">
                    <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">{country}</p>
                    <div className="grid grid-cols-[auto_1fr_1fr] gap-x-2 text-[10px] text-muted-foreground uppercase tracking-wide">
                      <span>Ccy</span>
                      <span className="text-right">Billing</span>
                      <span className="text-right">Profit</span>
                    </div>
                    {rows.map(r => (
                      <div key={r.currency} className="grid grid-cols-[auto_1fr_1fr] gap-x-2 items-baseline text-sm">
                        <span className="text-xs text-muted-foreground">{r.currency}</span>
                        <span className="font-semibold tabular-nums text-right">{formatCurrency(r.billing, r.currency as any)}</span>
                        <span className={`text-xs tabular-nums text-right ${r.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {r.profit >= 0 ? '+' : ''}{formatCurrency(r.profit, r.currency as any)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> 4-Month Trajectory (mixed currencies, indicative)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => v.toLocaleString()} />
              <Legend />
              <Bar dataKey="billing" fill="hsl(207,63%,44%)" name="Billing" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" fill="hsl(142,76%,36%)" name="Profit" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Tabs defaultValue="billing">
        <TabsList>
          <TabsTrigger value="billing">Billing by Country & Currency</TabsTrigger>
          <TabsTrigger value="profit">Profit by Country & Currency</TabsTrigger>
          <TabsTrigger value="accounts">Per-Account Detail</TabsTrigger>
        </TabsList>

        <TabsContent value="billing" className="mt-4">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead>Currency</TableHead>
                  {months.map(c => (
                    <TableHead key={c.key} className="text-right">
                      {c.m.label} <span className="text-xs text-muted-foreground">({c.isActual ? 'Actual' : 'Fcst'})</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {headlineRows.map(r => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">{r.country}</TableCell>
                    <TableCell>{r.currency}</TableCell>
                    {r.cells.map((cell, i) => (
                      <TableCell key={i} className="text-right">
                        {formatCurrency(cell.billing, r.currency)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="profit" className="mt-4">
          <p className="text-xs text-muted-foreground mb-2">
            Last month profit uses <strong>invoices − expenses</strong>. This/next/+2 months use timesheet hours × contract rates
            (forecasted from the last 2 months for active contracts).
          </p>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead>Currency</TableHead>
                  {months.map(c => (
                    <TableHead key={c.key} className="text-right">
                      {c.m.label} <span className="text-xs text-muted-foreground">({c.isActual ? 'Actual' : 'Fcst'})</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {headlineRows.map(r => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">{r.country}</TableCell>
                    <TableCell>{r.currency}</TableCell>
                    {r.cells.map((cell, i) => (
                      <TableCell key={i} className={`text-right ${cell.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(cell.profit, r.currency)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="accounts" className="mt-4 space-y-3">
          {months.map((c, i) => {
            const isOpen = expanded[c.key] ?? c.key === 'this';
            const accountGroups = groupByAccount(monthData[i].lines);
            return (
              <Collapsible key={c.key} open={isOpen} onOpenChange={(o) => setExpanded(s => ({ ...s, [c.key]: o }))}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {c.m.label} — {accountGroups.length} accounts ({monthData[i].lines.length} contracts)
                        </CardTitle>
                        <Badge variant={c.isActual ? 'secondary' : 'outline'} className="text-[10px]">
                          {c.isActual ? 'Actual' : 'Forecast'}
                        </Badge>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <AccountDetailTable groups={accountGroups} />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface AccountGroup {
  accountId: string;
  accountName: string;
  accountNumber: string;
  country: string;
  totals: Map<string, { currency: string; billing: number; cost: number; profit: number }>;
  lines: ContractMonthLine[];
}

function groupByAccount(lines: ContractMonthLine[]): AccountGroup[] {
  const map = new Map<string, AccountGroup>();
  for (const l of lines) {
    const acc = getAccountById(l.parentAccountId);
    const key = l.parentAccountId;
    let g = map.get(key);
    if (!g) {
      g = {
        accountId: key,
        accountName: acc?.name ?? '—',
        accountNumber: acc?.accountNumber ?? '',
        country: acc?.country ?? l.country,
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
    return <p className="text-sm text-muted-foreground">No active accounts in this month.</p>;
  }
  return (
    <div className="space-y-3">
      {groups.map(g => (
        <div key={g.accountId} className="rounded-lg border">
          <div className="flex items-center justify-between p-3 bg-muted/30 border-b">
            <div>
              <p className="font-medium text-sm">{g.accountName}</p>
              <p className="text-xs text-muted-foreground font-mono">{g.accountNumber} · {g.country}</p>
            </div>
            <div className="flex flex-wrap gap-3 text-right">
              {Array.from(g.totals.values()).map(t => (
                <div key={t.currency} className="text-xs">
                  <p className="text-muted-foreground">{t.currency}</p>
                  <p className="font-semibold">{formatCurrency(t.billing, t.currency as any)}</p>
                  <p className={`text-[11px] ${t.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    profit {formatCurrency(t.profit, t.currency as any)}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract</TableHead>
                <TableHead>Contractor</TableHead>
                <TableHead className="text-right">Hours / Units</TableHead>
                <TableHead className="text-right">Billing</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {g.lines.map(l => {
                const sameCcy = l.sellCurrency === l.buyCurrency;
                const profit = sameCcy ? l.sellAmount - l.buyAmount : l.sellAmount;
                return (
                  <TableRow key={l.contractId}>
                    <TableCell>
                      <div>
                        <p className="font-mono text-xs">{l.contractNumber}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[220px]">{l.contractName}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{l.contractor}</TableCell>
                    <TableCell className="text-right text-sm">
                      {l.unitOfMeasure === 'Hour' || l.unitOfMeasure === 'Day'
                        ? `${l.hours.toFixed(0)}h${l.unitOfMeasure === 'Day' ? ` (${l.daysOrUnits.toFixed(1)}d)` : ''}`
                        : l.unitOfMeasure}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(l.sellAmount, l.sellCurrency)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(l.buyAmount, l.buyCurrency)}</TableCell>
                    <TableCell className={`text-right font-medium ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {sameCcy ? formatCurrency(profit, l.sellCurrency) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {l.source === 'invoice' && 'Invoice'}
                        {l.source === 'timesheet-actual' && 'Actual TS'}
                        {l.source === 'timesheet-forecast' && 'Avg 2mo'}
                        {l.source === 'fixed-monthly' && 'Fixed'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}
