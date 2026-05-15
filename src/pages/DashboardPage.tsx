import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader, KpiCard, StatusBadge, PageLoading } from '../components/Shared';
import { Users, UserCheck, UserX, Target, TrendingUp, Receipt, AlertCircle, Calendar, Plane } from '../components/Icons';
import { formatCurrency } from '../lib/utils';
import type { CurrencyCode, Expense, Invoice, Contract, Prospect, Account, Contact, Timesheet } from '../types/crm';
import { ExpenseFormSheet } from '../components/ExpenseFormSheet';
import { fetchCandidates } from '../services/candidateService';
import type { CandidateRecord } from '../services/candidateService';
import { fetchInvoices } from '../services/invoiceService';
import { fetchExpenses } from '../services/expenseService';
import { fetchContracts } from '../services/contractService';
import { fetchTimesheets } from '../services/timesheetService';
import { fetchLeaveRequests } from '../services/leaveService';
import { fetchProspects } from '../services/prospectService';
import { fetchAccounts } from '../services/accountService';
import { fetchContacts } from '../services/contactService';
import type { LeaveRequest } from '../types/crm';


const PIPELINE_STAGES = ['New', 'Contacted', 'Discussing', 'Proposal', 'Won'] as const;

const STAGE_COLORS: Record<string, string> = {
  New: 'hsl(220, 60%, 45%)',
  Contacted: 'hsl(207, 63%, 44%)',
  Discussing: 'hsl(38, 92%, 50%)',
  Proposal: 'hsl(270, 60%, 50%)',
  Won: 'hsl(142, 76%, 36%)',
  Lost: 'hsl(0, 70%, 55%)',
};

function inMonth(dateStr: string, year: number, month: number): boolean {
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}
function startOfMonth(year: number, month: number) { return new Date(year, month, 1); }
function endOfMonth(year: number, month: number) { return new Date(year, month + 1, 0); }
function startOfMonthStr(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}
function endOfMonthStr(year: number, month: number): string {
  const d = new Date(year, month + 1, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ===== CSS-only stacked bar chart =====
function StackedBarChart({ data, height = 120 }: { data: { label: string; segments: { value: number; color: string }[] }[]; height?: number }) {
  const maxVal = Math.max(...data.map(d => d.segments.reduce((s, seg) => s + seg.value, 0)), 1);
  return (
    <div style={{ height, display: 'flex', alignItems: 'flex-end', gap: 8, paddingBottom: 20 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%' }}>
          <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column-reverse', gap: 1, borderRadius: 4, overflow: 'hidden' }}>
            {d.segments.map((seg, j) => (
              <div key={j} style={{ height: `${maxVal > 0 ? (seg.value / maxVal) * 100 : 0}%`, backgroundColor: seg.color, minHeight: seg.value > 0 ? 2 : 0 }} />
            ))}
          </div>
          <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ===== CSS-only grouped bar chart =====
function GroupedBarChart({ data, bars, height = 220 }: { data: { label: string; [key: string]: any }[]; bars: { key: string; color: string; name: string }[]; height?: number }) {
  const maxVal = Math.max(...data.flatMap(d => bars.map(b => Number(d[b.key]) || 0)), 1);
  return (
    <div>
      <div style={{ height, display: 'flex', gap: 4, alignItems: 'flex-end', paddingBottom: 20 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%' }}>
            <div style={{ flex: 1, display: 'flex', gap: 2, alignItems: 'flex-end', width: '100%' }}>
              {bars.map((b, j) => {
                const val = Number(d[b.key]) || 0;
                return <div key={j} className="csp-chart-bar-interactive" style={{ flex: 1, height: `${(val / maxVal) * 100}%`, backgroundColor: b.color, borderRadius: '4px 4px 0 0', minHeight: val > 0 ? 2 : 0 }} title={`${b.name}: ${formatCurrency(val, 'EUR')}`} />;
              })}
            </div>
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', textAlign: 'center', lineHeight: 1.2 }}>{d.label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 }}>
        {bars.map((b, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: b.color, display: 'inline-block' }} />
            {b.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ===== CSS-only donut chart =====
function DonutChart({ data, height = 220 }: { data: { name: string; value: number; color: string }[]; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let cumulative = 0;
  const segments = data.map(d => {
    const start = cumulative;
    cumulative += d.value;
    return { ...d, start, end: cumulative };
  });
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg viewBox="0 0 100 100" style={{ width: height * 0.65, height: height * 0.65, flexShrink: 0 }}>
        {segments.map((seg, i) => {
          if (seg.value === 0) return null;
          const startAngle = (seg.start / total) * 360 - 90;
          const endAngle = (seg.end / total) * 360 - 90;
          const largeArc = endAngle - startAngle > 180 ? 1 : 0;
          const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
          const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
          const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
          const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
          const ix1 = 50 + 20 * Math.cos((endAngle * Math.PI) / 180);
          const iy1 = 50 + 20 * Math.sin((endAngle * Math.PI) / 180);
          const ix2 = 50 + 20 * Math.cos((startAngle * Math.PI) / 180);
          const iy2 = 50 + 20 * Math.sin((startAngle * Math.PI) / 180);
          return <path key={i} d={`M ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A 20 20 0 ${largeArc} 0 ${ix2} ${iy2} Z`} fill={seg.color} />;
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
        {data.filter(d => d.value > 0).map((d, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: d.color, display: 'inline-block', flexShrink: 0 }} />
            {d.name}: {d.value}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const prevY = m === 0 ? y - 1 : y;
  const prevM = m === 0 ? 11 : m - 1;
  const nextY = m === 11 ? y + 1 : y;
  const nextM = m === 11 ? 0 : m + 1;

  const [expenseDialog, setExpenseDialog] = useState<{ open: boolean; expense: Expense | null }>({ open: false, expense: null });

  // === Live Dataverse data ===
  const [onboardingCandidates, setOnboardingCandidates] = useState<CandidateRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cands, invs, exps, ctrs, leaves, prosps, accs, conts, tses] = await Promise.all([
          fetchCandidates().catch(() => []),
          fetchInvoices().catch(() => []),
          fetchExpenses().catch(() => []),
          fetchContracts().catch(() => []),
          fetchLeaveRequests().catch(() => []),
          fetchProspects().catch(() => []),
          fetchAccounts().catch(() => []),
          fetchContacts().catch(() => []),
          fetchTimesheets().catch(() => []),
        ]);
        if (cancelled) return;
        setOnboardingCandidates(cands as CandidateRecord[]);
        setInvoices(invs as Invoice[]);
        setExpenses(exps as Expense[]);
        setContracts(ctrs as Contract[]);
        setLeaveRequests(leaves as LeaveRequest[]);
        setProspects(prosps as Prospect[]);
        setAccounts(accs as Account[]);
        setContacts(conts as Contact[]);
        setTimesheets(tses as Timesheet[]);
      } catch (err) {
        console.error('[Dashboard] Failed to load data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const monthLbl = (yy: number, mm: number) =>
    new Date(yy, mm, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });

  // ============ ONBOARDING ============
  const onboardingStats = useMemo(() => {
    const buckets = [
      { key: 'last', y: prevY, m: prevM, label: monthLbl(prevY, prevM) },
      { key: 'this', y, m, label: monthLbl(y, m) },
      { key: 'next', y: nextY, m: nextM, label: monthLbl(nextY, nextM) },
    ];
    return buckets.map(b => {
      const inBucket = onboardingCandidates.filter(c => inMonth(c.appliedDate, b.y, b.m));
      return {
        ...b, total: inBucket.length,
        fit: inBucket.filter(c => c.status === 'Fit').length,
        notFit: inBucket.filter(c => c.status === 'Not Fit').length,
        scheduled: inBucket.filter(c => c.status === 'Scheduled').length,
        applied: inBucket.filter(c => c.status === 'Applied').length,
      };
    });
  }, [onboardingCandidates, prevY, prevM, y, m, nextY, nextM]);

  // ============ PROSPECTS ============
  const prospectStats = useMemo(() => {
    const byStage = PIPELINE_STAGES.map(s => ({
      stage: s,
      count: prospects.filter(p => p.status === s).length,
      value: prospects.filter(p => p.status === s).reduce((sum, p) => sum + (p.estimatedValue ?? 0), 0),
    }));
    const lostCount = prospects.filter(p => p.status === 'Lost').length;
    const wonThisMonth = prospects.filter(p => p.status === 'Won' && p.lastActivityDate && inMonth(p.lastActivityDate, y, m)).length;
    const activePipelineValue = prospects.filter(p => !['Won', 'Lost'].includes(p.status)).reduce((sum, p) => sum + (p.estimatedValue ?? 0), 0);
    return { byStage, lostCount, wonThisMonth, activePipelineValue };
  }, [prospects, y, m]);

  const prospectChartData = prospectStats.byStage.map(s => ({ name: s.stage, value: s.count, color: STAGE_COLORS[s.stage] || 'hsl(220, 14%, 60%)' }));

  // ============ INVOICES ============
  const invoiceCash = useMemo(() => {
    // Dataverse invoices don't store a subtotal field, derive it as total - VAT.
    const subtotalOf = (inv: Invoice) => (inv.subtotal && inv.subtotal > 0)
      ? inv.subtotal
      : Math.max(0, (inv.total || 0) - (inv.vatAmount || 0));
    const ms = startOfMonth(y, m); const me = endOfMonth(y, m);
    const msStr = startOfMonthStr(y, m); const meStr = endOfMonthStr(y, m);
    const toEur: Record<CurrencyCode, number> = { EUR: 1, USD: 0.92, GBP: 1.17, RON: 0.2 };
    const incoming = invoices.filter(inv => (inv.status === 'Sent' || inv.status === 'Overdue') && inv.dueDate >= msStr && inv.dueDate <= meStr);
    // Profit per invoice = sum(timesheet hours) × (sellHourly − buyHourly) for the
    // invoice's contract within its period. Status of the contract is ignored.
    const profitForInvoice = (inv: Invoice): number => {
      if (!inv.contractId) return 0;
      const c = contracts.find(cc => cc.id === inv.contractId);
      if (!c) return 0;
      const sellHourly = c.sellHourlyRate || (c.unitOfMeasure === 'Day' ? c.sellRate / 8 : c.sellRate);
      const buyHourly = c.buyHourlyRate || (c.unitOfMeasure === 'Day' ? c.buyRate / 8 : c.buyRate);
      const periodKey = `${inv.periodYear}-${String(inv.periodMonth).padStart(2, '0')}`;
      const hours = timesheets
        .filter(t => t.contractId === inv.contractId && (t.weekStart || '').startsWith(periodKey))
        .reduce((s, t) => s + (t.totalHours || 0), 0);
      return hours * (sellHourly - buyHourly);
    };
    let totalBillingEur = 0; let totalProfitEur = 0;
    const byCurrency = new Map<CurrencyCode, { billing: number; profit: number; count: number }>();
    for (const inv of incoming) {
      const billing = subtotalOf(inv);
      const profit = profitForInvoice(inv);
      const cur = byCurrency.get(inv.currencyCode) ?? { billing: 0, profit: 0, count: 0 };
      cur.billing += billing; cur.profit += profit; cur.count += 1; byCurrency.set(inv.currencyCode, cur);
      totalBillingEur += billing * (toEur[inv.currencyCode] ?? 1);
      totalProfitEur += profit * (toEur[inv.currencyCode] ?? 1);
    }
    const weeks: { label: string; billing: number; profit: number }[] = [];
    let cursor = new Date(ms); let weekIdx = 1;
    while (cursor <= me) {
      const weekEnd = new Date(cursor); weekEnd.setDate(weekEnd.getDate() + 6);
      const cap = weekEnd > me ? me : weekEnd;
      const cursorStr = dateToStr(cursor); const capStr = dateToStr(cap);
      const inWeek = incoming.filter(inv => inv.dueDate >= cursorStr && inv.dueDate <= capStr);
      weeks.push({
        label: `W${weekIdx} (${cursor.getDate()}-${cap.getDate()})`,
        billing: Math.round(inWeek.reduce((s, inv) => s + subtotalOf(inv) * (toEur[inv.currencyCode] ?? 1), 0)),
        profit: Math.round(inWeek.reduce((s, inv) => s + profitForInvoice(inv) * (toEur[inv.currencyCode] ?? 1), 0)),
      });
      cursor = new Date(cap); cursor.setDate(cursor.getDate() + 1); weekIdx++;
    }
    return { byCurrency: Array.from(byCurrency.entries()), totalBillingEur, totalProfitEur, weeks };
  }, [invoices, contracts, timesheets, y, m]);

  // ============ EXPENSES ============
  const expenseDue = useMemo(() => {
    const meStr = endOfMonthStr(y, m);
    const todayStr = dateToStr(now);
    const toEur: Record<CurrencyCode, number> = { EUR: 1, USD: 0.92, GBP: 1.17, RON: 0.2 };
    const unpaid = expenses.filter(e => e.status !== 'Paid' && e.dueDate <= meStr);
    const byCurrency = new Map<CurrencyCode, { amount: number; count: number }>();
    let totalEur = 0; let overdueCount = 0;
    for (const e of unpaid) {
      const cur = byCurrency.get(e.currencyCode) ?? { amount: 0, count: 0 };
      cur.amount += e.totalAmount; cur.count += 1; byCurrency.set(e.currencyCode, cur);
      totalEur += e.totalAmount * (toEur[e.currencyCode] ?? 1);
      if (e.dueDate < todayStr) overdueCount++;
    }
    const top = [...unpaid].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')).slice(0, 6);
    return { byCurrency: Array.from(byCurrency.entries()), totalEur, overdueCount, top };
  }, [expenses, y, m, now]);

  // ============ LEAVE ============
  const leaveStats = useMemo(() => {
    const overlaps = (l: { startDate: string; endDate: string }, yy: number, mm: number) => {
      const msStr = startOfMonthStr(yy, mm); const meStr = endOfMonthStr(yy, mm);
      return l.endDate >= msStr && l.startDate <= meStr;
    };
    return [
      { key: 'last', y: prevY, m: prevM, label: monthLbl(prevY, prevM) },
      { key: 'this', y, m, label: monthLbl(y, m) },
      { key: 'next', y: nextY, m: nextM, label: monthLbl(nextY, nextM) },
    ].map(b => ({
      ...b,
      list: leaveRequests.filter(l => l.status !== 'Rejected' && overlaps(l, b.y, b.m)).sort((a, b2) => (a.startDate || '').localeCompare(b2.startDate || '')),
    }));
  }, [leaveRequests, prevY, prevM, y, m, nextY, nextM]);

  if (loading) {
    return <PageLoading message="Loading dashboard..." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <PageHeader title="Dashboard" subtitle={`Operational snapshot — ${monthLbl(y, m)}`} />

      {/* ============ ONBOARDING ============ */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'hsl(var(--primary))' }}><Users className="csp-icon-inline" /></span> Candidate Onboarding
          </h2>
          <button className="csp-btn csp-btn-outline csp-btn-sm">View all</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {onboardingStats.map(b => (
            <div key={b.key} className="csp-card csp-dash-card" style={{ padding: 0 }}>
              <div style={{ padding: '1rem 1rem 0.5rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>
                  {b.key === 'last' ? 'Last month' : b.key === 'this' ? 'This month' : 'Next month'}
                  <span style={{ marginLeft: 8, fontSize: '0.75rem', fontWeight: 400 }}>({b.label})</span>
                </div>
              </div>
              <div style={{ padding: '0 1rem 1rem' }}>
                <div style={{ fontSize: '1.875rem', fontWeight: 700 }}>{b.total}</div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginBottom: 12 }}>candidates</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: '0.75rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, backgroundColor: '#d1fae5', color: '#065f46' }}>
                    <UserCheck className="csp-icon-inline" /> {b.fit} Fit
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, backgroundColor: '#ffe4e6', color: '#9f1239' }}>
                    <UserX className="csp-icon-inline" /> {b.notFit} Not Fit
                  </span>
                  {(b.scheduled + b.applied) > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                      {b.scheduled + b.applied} Pending
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {/* 3-month outcome chart */}
          <div className="csp-card csp-dash-card" style={{ padding: 0 }}>
            <div style={{ padding: '1rem 1rem 0.5rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>3-month outcome</div>
            </div>
            <div style={{ padding: '0 1rem 1rem' }}>
              <StackedBarChart height={120} data={onboardingStats.map(b => ({
                label: b.label.split(' ')[0],
                segments: [
                  { value: b.fit, color: 'hsl(142, 76%, 36%)' },
                  { value: b.notFit, color: 'hsl(0, 70%, 55%)' },
                  { value: b.scheduled + b.applied, color: 'hsl(220, 14%, 75%)' },
                ],
              }))} />
            </div>
          </div>
        </div>
      </section>

      {/* ============ PROSPECTS ============ */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'hsl(var(--primary))' }}><Target className="csp-icon-inline" /></span> Prospects Pipeline
          </h2>
          <button className="csp-btn csp-btn-outline csp-btn-sm">Open Kanban</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <KpiCard title="Active pipeline" value={String(prospects.filter(p => !['Won', 'Lost'].includes(p.status)).length)} subtitle={`${formatCurrency(prospectStats.activePipelineValue, 'EUR')} estimated`} />
            <KpiCard title="Won this month" value={String(prospectStats.wonThisMonth)} icon={<TrendingUp className="csp-icon-sm" />} />
            <KpiCard title="Lost (all time)" value={String(prospectStats.lostCount)} />
            {prospectStats.byStage.map(s => (
              <div key={s.stage} className="csp-card csp-dash-stage-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>{s.stage}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '1px 6px', borderRadius: 4, color: '#fff', backgroundColor: STAGE_COLORS[s.stage] }}>{s.count}</span>
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{s.value > 0 ? formatCurrency(s.value, 'EUR') : '—'}</div>
              </div>
            ))}
          </div>
          {/* Stage distribution donut */}
          <div className="csp-card csp-dash-card" style={{ padding: '1rem' }}>
            <div style={{ padding: '0 0 0.5rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Stage distribution</div>
            </div>
            <DonutChart data={prospectChartData.filter(d => d.value > 0)} />
          </div>
        </div>
      </section>

      {/* ============ INVOICES INCOMING ============ */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'hsl(var(--primary))' }}><Receipt className="csp-icon-inline" /></span> Incoming Invoice Cash — {monthLbl(y, m)}
          </h2>
          <button className="csp-btn csp-btn-outline csp-btn-sm">View invoices</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
          <div className="csp-card csp-dash-card" style={{ padding: 0 }}>
            <div style={{ padding: '1rem 1rem 0.5rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>Expected this month</div>
            </div>
            <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Total billing (EUR equiv.)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatCurrency(invoiceCash.totalBillingEur, 'EUR')}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Estimated profit</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#15803d' }}>{formatCurrency(invoiceCash.totalProfitEur, 'EUR')}</div>
              </div>
              <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {invoiceCash.byCurrency.length === 0 && <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>No invoices due this month.</div>}
                {invoiceCash.byCurrency.map(([cur, v]) => (
                  <div key={cur} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>{cur} · {v.count} invoice{v.count > 1 ? 's' : ''}</span>
                    <span style={{ fontWeight: 500 }}>{formatCurrency(v.billing, cur)} · profit {formatCurrency(v.profit, cur)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="csp-card csp-dash-card" style={{ padding: 0 }}>
            <div style={{ padding: '1rem 1rem 0.5rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>When the cash lands (by week)</div>
            </div>
            <div style={{ padding: '0 1rem 1rem' }}>
              <GroupedBarChart data={invoiceCash.weeks.map(w => ({ label: w.label, billing: w.billing, profit: w.profit }))} bars={[
                { key: 'billing', color: 'hsl(207, 63%, 44%)', name: 'Billing' },
                { key: 'profit', color: 'hsl(142, 76%, 36%)', name: 'Profit' },
              ]} />
            </div>
          </div>
        </div>
      </section>

      {/* ============ EXPENSES UNPAID ============ */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'hsl(var(--primary))' }}><AlertCircle className="csp-icon-inline" /></span> Expenses to Pay — {monthLbl(y, m)}
          </h2>
          <button className="csp-btn csp-btn-outline csp-btn-sm">View expenses</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
          <div className="csp-card csp-dash-card" style={{ padding: 0 }}>
            <div style={{ padding: '1rem 1rem 0.5rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>Unpaid &amp; due this month</div>
            </div>
            <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Total to pay (EUR equiv.)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatCurrency(expenseDue.totalEur, 'EUR')}</div>
              </div>
              {expenseDue.overdueCount > 0 && (
                <span className="csp-badge csp-badge-red" style={{ alignSelf: 'flex-start', fontSize: '0.75rem' }}>{expenseDue.overdueCount} already overdue</span>
              )}
              <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {expenseDue.byCurrency.length === 0 && <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>Nothing due — all clear!</div>}
                {expenseDue.byCurrency.map(([cur, v]) => (
                  <div key={cur} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>{cur} · {v.count} item{v.count > 1 ? 's' : ''}</span>
                    <span style={{ fontWeight: 500 }}>{formatCurrency(v.amount, cur)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="csp-card csp-dash-card" style={{ padding: 0 }}>
            <div style={{ padding: '1rem 1rem 0.5rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar className="csp-icon-inline" /> Top items to settle
              </div>
            </div>
            <div style={{ padding: '0 1rem 1rem' }}>
              {expenseDue.top.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0', fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>No unpaid expenses.</div>
              ) : (
                <div>
                  {expenseDue.top.map(e => {
                    const acct = accounts.find(a => a.id === e.accountId);
                    const overdue = (e.dueDate || '') < dateToStr(now);
                    return (
                      <button
                        key={e.id}
                        onClick={() => setExpenseDialog({ open: true, expense: e })}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 8px', marginLeft: -8, marginRight: -8, fontSize: '0.875rem', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 4, borderBottom: '1px solid hsl(var(--border))' }}
                        className="csp-expense-row"
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acct?.name ?? e.reference}</div>
                          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                            {e.expenseType} · due {new Date(e.dueDate).toLocaleDateString('en-GB')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <StatusBadge status={overdue ? 'Overdue' : e.status} />
                          <div style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(e.totalAmount, e.currencyCode)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ LEAVE ============ */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'hsl(var(--primary))' }}><Plane className="csp-icon-inline" /></span> Leave Schedule
          </h2>
          <button className="csp-btn csp-btn-outline csp-btn-sm">View all</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {leaveStats.map(b => {
            const totalDays = b.list.reduce((s, l) => s + l.totalDays, 0);
            return (
              <div key={b.key} className="csp-card csp-dash-card" style={{ padding: 0 }}>
                <div style={{ padding: '1rem 1rem 0.5rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>
                      {b.key === 'last' ? 'Last month' : b.key === 'this' ? 'This month' : 'Next month'}
                      <span style={{ marginLeft: 8, fontSize: '0.75rem', fontWeight: 400 }}>({b.label})</span>
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>{b.list.length} · {totalDays}d</span>
                  </div>
                </div>
                <div style={{ padding: '0 1rem 1rem' }}>
                  {b.list.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center', padding: '1rem 0' }}>No leave scheduled.</div>
                  ) : (
                    <div>
                      {b.list.map(l => {
                        const c = contacts.find(ct => ct.id === l.contactId);
                        const name = c ? `${c.firstName} ${c.lastName}` : 'Unknown';
                        const start = new Date(l.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                        const end = new Date(l.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                        return (
                          <div key={l.id} style={{ padding: '6px 0', borderBottom: '1px solid hsl(var(--border))', fontSize: '0.875rem' }}>
                            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{start === end ? start : `${start} – ${end}`} · {l.totalDays}d</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Expense Detail Sheet */}
      <ExpenseFormSheet
        expense={expenseDialog.expense}
        open={expenseDialog.open}
        onClose={() => setExpenseDialog({ open: false, expense: null })}
      />
    </div>
  );
}
