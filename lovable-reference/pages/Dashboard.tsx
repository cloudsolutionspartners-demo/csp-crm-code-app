import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { KpiCard, PageHeader, StatusBadge } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import {
  Users, UserCheck, UserX, Target, TrendingUp, Receipt, AlertCircle, Calendar, Plane,
} from 'lucide-react';
import {
  onboardingCandidates, prospects, invoices, expenses, contracts, leaveRequests,
  getAccountById, getContactById,
} from '@/data/mock-data';
import type { ProspectStatus, CurrencyCode, LeaveType, Expense } from '@/types/crm';
import { ExpenseFormSheet } from '@/components/expense/ExpenseFormSheet';
import { useState } from 'react';

const PIPELINE_STAGES: ProspectStatus[] = [
  'We Reached Out', 'Customer Reached Out', 'Discussing', 'Proposal Sent', 'Won',
];

const STAGE_COLORS: Record<string, string> = {
  'We Reached Out': 'hsl(220, 60%, 45%)',
  'Customer Reached Out': 'hsl(207, 63%, 44%)',
  'Discussing': 'hsl(38, 92%, 50%)',
  'Proposal Sent': 'hsl(270, 60%, 50%)',
  'Won': 'hsl(142, 76%, 36%)',
  'Lost': 'hsl(0, 70%, 55%)',
};

function inMonth(dateStr: string, year: number, month: number): boolean {
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}

function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}
function endOfMonth(year: number, month: number) {
  return new Date(year, month + 1, 0);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const prevY = m === 0 ? y - 1 : y;
  const prevM = m === 0 ? 11 : m - 1;
  const nextY = m === 11 ? y + 1 : y;
  const nextM = m === 11 ? 0 : m + 1;

  const [expenseDialog, setExpenseDialog] = useState<{ open: boolean; expense: Expense | null }>({
    open: false,
    expense: null,
  });
  const [refreshTick, setRefreshTick] = useState(0);

  const monthLabel = (yy: number, mm: number) =>
    new Date(yy, mm, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });

  // ============ ONBOARDING ============
  const onboardingStats = useMemo(() => {
    const buckets = [
      { key: 'last', y: prevY, m: prevM, label: monthLabel(prevY, prevM) },
      { key: 'this', y, m, label: monthLabel(y, m) },
      { key: 'next', y: nextY, m: nextM, label: monthLabel(nextY, nextM) },
    ];
    return buckets.map((b) => {
      const inBucket = onboardingCandidates.filter((c) => inMonth(c.appliedDate, b.y, b.m));
      return {
        ...b,
        total: inBucket.length,
        fit: inBucket.filter((c) => c.status === 'Fit').length,
        notFit: inBucket.filter((c) => c.status === 'Not Fit').length,
        scheduled: inBucket.filter((c) => c.status === 'Scheduled').length,
        applied: inBucket.filter((c) => c.status === 'Applied').length,
      };
    });
  }, [y, m, prevY, prevM, nextY, nextM]);

  const onboardingChartData = onboardingStats.map((b) => ({
    month: b.label.split(' ')[0],
    Fit: b.fit,
    'Not Fit': b.notFit,
    Pending: b.scheduled + b.applied,
  }));

  // ============ PROSPECTS ============
  const prospectStats = useMemo(() => {
    const byStage = PIPELINE_STAGES.map((s) => ({
      stage: s,
      count: prospects.filter((p) => p.status === s).length,
      value: prospects
        .filter((p) => p.status === s)
        .reduce((sum, p) => sum + (p.estimatedValue ?? 0), 0),
    }));
    const lostCount = prospects.filter((p) => p.status === 'Lost').length;
    const wonThisMonth = prospects.filter(
      (p) => p.status === 'Won' && p.lastActivityDate && inMonth(p.lastActivityDate, y, m),
    ).length;
    const activePipelineValue = prospects
      .filter((p) => !['Won', 'Lost'].includes(p.status))
      .reduce((sum, p) => sum + (p.estimatedValue ?? 0), 0);
    return { byStage, lostCount, wonThisMonth, activePipelineValue };
  }, [y, m]);

  const prospectChartData = prospectStats.byStage.map((s) => ({
    name: s.stage,
    value: s.count,
  }));

  // ============ INVOICES — incoming this month ============
  const invoiceCash = useMemo(() => {
    const monthStart = startOfMonth(y, m);
    const monthEnd = endOfMonth(y, m);
    const incoming = invoices.filter((inv) => {
      if (inv.status !== 'Sent' && inv.status !== 'Overdue') return false;
      const due = new Date(inv.dueDate);
      return due >= monthStart && due <= monthEnd;
    });

    // Aggregate per currency
    const byCurrency = new Map<CurrencyCode, { billing: number; profit: number; count: number }>();
    let totalBillingEur = 0;
    let totalProfitEur = 0;
    // Naive FX → EUR for display rollup
    const toEur: Record<CurrencyCode, number> = { EUR: 1, USD: 0.92, GBP: 1.17, RON: 0.2 };

    for (const inv of incoming) {
      const billing = inv.subtotal;
      // Estimate cost from contract buyRate vs sellRate ratio if we can map
      let estCost = billing * 0.78; // fallback ~22% margin
      if (inv.contractId) {
        const c = contracts.find((cc) => cc.id === inv.contractId);
        if (c && c.sellRate > 0) {
          estCost = billing * (c.buyRate / c.sellRate);
        }
      }
      const profit = billing - estCost;
      const cur = byCurrency.get(inv.currencyCode) ?? { billing: 0, profit: 0, count: 0 };
      cur.billing += billing;
      cur.profit += profit;
      cur.count += 1;
      byCurrency.set(inv.currencyCode, cur);
      totalBillingEur += billing * (toEur[inv.currencyCode] ?? 1);
      totalProfitEur += profit * (toEur[inv.currencyCode] ?? 1);
    }

    // Weekly schedule within month
    const weeks: { label: string; billing: number; profit: number }[] = [];
    let cursor = new Date(monthStart);
    let weekIdx = 1;
    while (cursor <= monthEnd) {
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const cap = weekEnd > monthEnd ? monthEnd : weekEnd;
      const inWeek = incoming.filter((inv) => {
        const d = new Date(inv.dueDate);
        return d >= cursor && d <= cap;
      });
      const billing = inWeek.reduce(
        (s, inv) => s + inv.subtotal * (toEur[inv.currencyCode] ?? 1), 0,
      );
      const profit = inWeek.reduce((s, inv) => {
        let estCost = inv.subtotal * 0.78;
        if (inv.contractId) {
          const c = contracts.find((cc) => cc.id === inv.contractId);
          if (c && c.sellRate > 0) estCost = inv.subtotal * (c.buyRate / c.sellRate);
        }
        return s + (inv.subtotal - estCost) * (toEur[inv.currencyCode] ?? 1);
      }, 0);
      weeks.push({
        label: `W${weekIdx} (${cursor.getDate()}–${cap.getDate()})`,
        billing: Math.round(billing),
        profit: Math.round(profit),
      });
      cursor = new Date(cap);
      cursor.setDate(cursor.getDate() + 1);
      weekIdx++;
    }

    return {
      incoming,
      byCurrency: Array.from(byCurrency.entries()),
      totalBillingEur,
      totalProfitEur,
      weeks,
    };
  }, [y, m]);

  // ============ EXPENSES — unpaid due this month ============
  const expenseDue = useMemo(() => {
    const monthEnd = endOfMonth(y, m);
    const unpaid = expenses.filter((e) => {
      if (e.status === 'Paid') return false;
      const due = new Date(e.dueDate);
      return due <= monthEnd;
    });
    const toEur: Record<CurrencyCode, number> = { EUR: 1, USD: 0.92, GBP: 1.17, RON: 0.2 };
    const byCurrency = new Map<CurrencyCode, { amount: number; count: number }>();
    let totalEur = 0;
    let overdueCount = 0;
    for (const e of unpaid) {
      const cur = byCurrency.get(e.currencyCode) ?? { amount: 0, count: 0 };
      cur.amount += e.totalAmount;
      cur.count += 1;
      byCurrency.set(e.currencyCode, cur);
      totalEur += e.totalAmount * (toEur[e.currencyCode] ?? 1);
      if (new Date(e.dueDate) < now) overdueCount++;
    }
    // Top 5 to pay (largest first, then earliest due)
    const top = [...unpaid]
      .sort((a, b) => {
        const dueDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (dueDiff !== 0) return dueDiff;
        return b.totalAmount - a.totalAmount;
      })
      .slice(0, 6);
    return { unpaid, byCurrency: Array.from(byCurrency.entries()), totalEur, overdueCount, top };
  }, [y, m, refreshTick]);

  // ============ LEAVE — last/this/next month ============
  const leaveStats = useMemo(() => {
    // A leave entry belongs to a bucket if it overlaps that calendar month.
    const overlaps = (l: { startDate: string; endDate: string }, yy: number, mm: number) => {
      const ms = startOfMonth(yy, mm);
      const me = endOfMonth(yy, mm);
      const ls = new Date(l.startDate);
      const le = new Date(l.endDate);
      return le >= ms && ls <= me;
    };
    const buckets = [
      { key: 'last', y: prevY, m: prevM, label: monthLabel(prevY, prevM) },
      { key: 'this', y, m, label: monthLabel(y, m) },
      { key: 'next', y: nextY, m: nextM, label: monthLabel(nextY, nextM) },
    ];
    return buckets.map((b) => {
      const list = leaveRequests
        .filter((l) => l.status !== 'Rejected' && overlaps(l, b.y, b.m))
        .sort((a, b2) => new Date(a.startDate).getTime() - new Date(b2.startDate).getTime());
      return { ...b, list };
    });
  }, [y, m, prevY, prevM, nextY, nextM]);

  const leaveTypeColor: Record<LeaveType, string> = {
    'Annual Leave': 'bg-sky-100 text-sky-800',
    'Sick Leave': 'bg-rose-100 text-rose-800',
    'Personal Leave': 'bg-amber-100 text-amber-800',
    'Public Holiday': 'bg-violet-100 text-violet-800',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={`Operational snapshot — ${monthLabel(y, m)}`}
      />

      {/* ============ ONBOARDING ============ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Candidate Onboarding
          </h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/onboarding/candidates')}>
            View all
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {onboardingStats.map((b) => (
            <Card key={b.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {b.key === 'last' ? 'Last month' : b.key === 'this' ? 'This month' : 'Next month'}
                  <span className="ml-2 text-xs font-normal">({b.label})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{b.total}</div>
                <div className="text-xs text-muted-foreground mb-3">candidates</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-100 text-emerald-800">
                    <UserCheck className="h-3 w-3" /> {b.fit} Fit
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-100 text-rose-800">
                    <UserX className="h-3 w-3" /> {b.notFit} Not Fit
                  </span>
                  {(b.scheduled + b.applied) > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted text-muted-foreground">
                      {b.scheduled + b.applied} Pending
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">3-month outcome</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={onboardingChartData}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="Fit" stackId="a" fill="hsl(142, 76%, 36%)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Not Fit" stackId="a" fill="hsl(0, 70%, 55%)" />
                  <Bar dataKey="Pending" stackId="a" fill="hsl(220, 14%, 75%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ============ PROSPECTS ============ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Prospects Pipeline
          </h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/prospecting/prospects')}>
            Open Kanban
          </Button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard
              title="Active pipeline"
              value={String(
                prospects.filter((p) => !['Won', 'Lost'].includes(p.status)).length,
              )}
              subtitle={`${formatCurrency(prospectStats.activePipelineValue, 'EUR')} estimated`}
            />
            <KpiCard
              title="Won this month"
              value={String(prospectStats.wonThisMonth)}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KpiCard title="Lost (all time)" value={String(prospectStats.lostCount)} />
            {prospectStats.byStage.map((s) => (
              <Card key={s.stage}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">{s.stage}</span>
                    <Badge
                      style={{ backgroundColor: STAGE_COLORS[s.stage], color: 'white' }}
                      className="text-xs"
                    >
                      {s.count}
                    </Badge>
                  </div>
                  <div className="text-sm font-semibold">
                    {s.value > 0 ? formatCurrency(s.value, 'EUR') : '—'}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Stage distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={prospectChartData.filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={35}
                    dataKey="value"
                    label={({ name, value }) => `${value}`}
                  >
                    {prospectChartData.map((d, i) => (
                      <Cell key={i} fill={STAGE_COLORS[d.name] ?? 'hsl(220, 14%, 60%)'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ============ INVOICES INCOMING ============ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Incoming Invoice Cash — {monthLabel(y, m)}
          </h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/invoices')}>
            View invoices
          </Button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Expected this month
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">Total billing (EUR equiv.)</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(invoiceCash.totalBillingEur, 'EUR')}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Estimated profit</div>
                <div className="text-xl font-semibold text-emerald-700">
                  {formatCurrency(invoiceCash.totalProfitEur, 'EUR')}
                </div>
              </div>
              <div className="pt-2 border-t space-y-1">
                {invoiceCash.byCurrency.length === 0 && (
                  <div className="text-sm text-muted-foreground">No invoices due this month.</div>
                )}
                {invoiceCash.byCurrency.map(([cur, v]) => (
                  <div key={cur} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {cur} · {v.count} invoice{v.count > 1 ? 's' : ''}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(v.billing, cur)} · profit {formatCurrency(v.profit, cur)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">When the cash lands (by week)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={invoiceCash.weeks}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => formatCurrency(v, 'EUR')}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="billing" fill="hsl(207, 63%, 44%)" name="Billing" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" fill="hsl(142, 76%, 36%)" name="Profit" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ============ EXPENSES UNPAID ============ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" /> Expenses to Pay — {monthLabel(y, m)}
          </h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/expenses')}>
            View expenses
          </Button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Unpaid &amp; due this month
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">Total to pay (EUR equiv.)</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(expenseDue.totalEur, 'EUR')}
                </div>
              </div>
              {expenseDue.overdueCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {expenseDue.overdueCount} already overdue
                </Badge>
              )}
              <div className="pt-2 border-t space-y-1">
                {expenseDue.byCurrency.length === 0 && (
                  <div className="text-sm text-muted-foreground">Nothing due — all clear!</div>
                )}
                {expenseDue.byCurrency.map(([cur, v]) => (
                  <div key={cur} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {cur} · {v.count} item{v.count > 1 ? 's' : ''}
                    </span>
                    <span className="font-medium">{formatCurrency(v.amount, cur)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Top items to settle
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expenseDue.top.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  No unpaid expenses.
                </div>
              ) : (
                <div className="divide-y">
                  {expenseDue.top.map((e) => {
                    const acct = getAccountById(e.accountId);
                    const overdue = new Date(e.dueDate) < now;
                    return (
                      <button
                        key={e.id}
                        onClick={() => setExpenseDialog({ open: true, expense: e })}
                        className="w-full flex items-center justify-between py-2 text-sm text-left hover:bg-muted/50 rounded px-2 -mx-2 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{acct?.name ?? e.reference}</div>
                          <div className="text-xs text-muted-foreground">
                            {e.expenseType} · due {new Date(e.dueDate).toLocaleDateString('en-GB')}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={overdue ? 'Overdue' : e.status} />
                          <div className="text-right font-semibold">
                            {formatCurrency(e.totalAmount, e.currencyCode)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ============ LEAVE ============ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Plane className="h-5 w-5 text-primary" /> Leave Schedule
          </h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/leave')}>
            View all
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {leaveStats.map((b) => {
            const totalDays = b.list.reduce((s, l) => s + l.totalDays, 0);
            return (
              <Card key={b.key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                    <span>
                      {b.key === 'last' ? 'Last month' : b.key === 'this' ? 'This month' : 'Next month'}
                      <span className="ml-2 text-xs font-normal">({b.label})</span>
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {b.list.length} · {totalDays}d
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {b.list.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-4 text-center">
                      No leave scheduled.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {b.list.map((l) => {
                        const c = getContactById(l.contactId);
                        const name = c ? `${c.firstName} ${c.lastName}` : 'Unknown';
                        const start = new Date(l.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                        const end = new Date(l.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                        return (
                          <div key={l.id} className="py-2 text-sm">
                            <div className="font-medium truncate">{name}</div>
                            <div className="text-xs text-muted-foreground">
                              {start === end ? start : `${start} – ${end}`} · {l.totalDays}d
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <ExpenseFormSheet
        expense={expenseDialog.expense}
        open={expenseDialog.open}
        onOpenChange={(o) => {
          setExpenseDialog((s) => ({ ...s, open: o }));
          if (!o) setRefreshTick((t) => t + 1);
        }}
      />
    </div>
  );
}
