import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Invoice } from '@/types/crm';
import { getAccountById, getContractById, getContactById } from '@/data/mock-data';
import { formatCurrency, formatDate } from '@/lib/format';
import { StatusBadge } from '@/components/shared';
import { cn } from '@/lib/utils';

type Props = {
  invoices: Invoice[];
  onOpen: (inv: Invoice) => void;
};

// ---------- Helper ----------
function sumByCurrency(list: Invoice[]) {
  const map: Record<string, number> = {};
  list.forEach(i => { map[i.currencyCode] = (map[i.currencyCode] || 0) + i.total; });
  return map;
}
function CurrencyTotals({ totals, className }: { totals: Record<string, number>; className?: string }) {
  const entries = Object.entries(totals);
  if (entries.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn('inline-flex flex-wrap gap-x-3 gap-y-0.5', className)}>
      {entries.map(([c, v]) => (
        <span key={c} className="font-medium tabular-nums">{formatCurrency(v, c as any)}</span>
      ))}
    </span>
  );
}

// ============================================================
// 1. GROUPED BY ACCOUNT
// ============================================================
export function GroupedByAccountView({ invoices, onOpen }: Props) {
  const groups = useMemo(() => {
    const m = new Map<string, Invoice[]>();
    invoices.forEach(inv => {
      const k = inv.accountId;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(inv);
    });
    return Array.from(m.entries())
      .map(([accountId, items]) => ({
        accountId,
        accountName: getAccountById(accountId)?.name || 'Unknown',
        items,
        totals: sumByCurrency(items),
        outstanding: sumByCurrency(items.filter(i => i.status === 'Sent' || i.status === 'Overdue')),
      }))
      .sort((a, b) => a.accountName.localeCompare(b.accountName));
  }, [invoices]);

  const [openIds, setOpenIds] = useState<Set<string>>(new Set(groups.slice(0, 3).map(g => g.accountId)));
  const toggle = (id: string) => {
    const n = new Set(openIds);
    n.has(id) ? n.delete(id) : n.add(id);
    setOpenIds(n);
  };

  return (
    <div className="space-y-2">
      {groups.map(g => {
        const isOpen = openIds.has(g.accountId);
        return (
          <div key={g.accountId} className="rounded-lg border bg-card">
            <button onClick={() => toggle(g.accountId)} className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 text-left">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <div className="flex-1">
                <div className="font-semibold">{g.accountName}</div>
                <div className="text-xs text-muted-foreground">{g.items.length} invoice{g.items.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Outstanding</div>
                <CurrencyTotals totals={g.outstanding} className="text-amber-600 dark:text-amber-400 text-sm" />
              </div>
              <div className="text-right min-w-[140px]">
                <div className="text-xs text-muted-foreground">Total Billed</div>
                <CurrencyTotals totals={g.totals} className="text-sm" />
              </div>
            </button>
            {isOpen && (
              <div className="border-t divide-y">
                {g.items.map(inv => (
                  <div key={inv.id} onClick={() => onOpen(inv)} className="grid grid-cols-12 gap-3 px-4 py-2 text-sm hover:bg-muted/30 cursor-pointer items-center">
                    <span className="col-span-2 font-mono text-xs">{inv.invoiceNumber}</span>
                    <span className="col-span-3 text-xs text-muted-foreground">{inv.contractId ? getContractById(inv.contractId)?.contractNumber : '—'}</span>
                    <span className="col-span-2 text-xs">{formatDate(inv.invoiceDate)}</span>
                    <span className="col-span-2 text-xs">Due {formatDate(inv.dueDate)}</span>
                    <span className="col-span-2 text-right font-medium tabular-nums">{formatCurrency(inv.total, inv.currencyCode)}</span>
                    <span className="col-span-1 flex justify-end"><StatusBadge status={inv.status} /></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {groups.length === 0 && <div className="text-center py-8 text-muted-foreground border rounded-lg">No invoices.</div>}
    </div>
  );
}

// ============================================================
// 2. MONTHLY TIMELINE (heatmap)
// ============================================================
export function MonthlyTimelineView({ invoices, onOpen }: Props) {
  const { months, statuses, matrix, monthTotals } = useMemo(() => {
    const sts = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled', 'Credit Note'] as const;
    const monthsSet = new Set<string>();
    invoices.forEach(i => monthsSet.add(i.invoiceDate.slice(0, 7)));
    const months = Array.from(monthsSet).sort();
    const matrix: Record<string, Record<string, Invoice[]>> = {};
    const monthTotals: Record<string, Record<string, number>> = {};
    months.forEach(m => { matrix[m] = {}; sts.forEach(s => matrix[m][s] = []); monthTotals[m] = {}; });
    invoices.forEach(i => {
      const m = i.invoiceDate.slice(0, 7);
      matrix[m][i.status].push(i);
      monthTotals[m][i.currencyCode] = (monthTotals[m][i.currencyCode] || 0) + i.total;
    });
    return { months, statuses: sts, matrix, monthTotals };
  }, [invoices]);

  const maxCount = Math.max(1, ...months.flatMap(m => statuses.map(s => matrix[m][s].length)));
  const intensity = (n: number) => {
    if (n === 0) return 'bg-muted/30';
    const r = n / maxCount;
    if (r > 0.66) return 'bg-primary text-primary-foreground';
    if (r > 0.33) return 'bg-primary/60 text-primary-foreground';
    return 'bg-primary/25';
  };

  const fmtMonth = (m: string) => new Date(m + '-01').toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="text-left p-3 font-medium sticky left-0 bg-muted/40">Month</th>
            {statuses.map(s => <th key={s} className="p-3 text-center font-medium">{s}</th>)}
            <th className="p-3 text-right font-medium">Total Billed</th>
          </tr>
        </thead>
        <tbody>
          {months.map(m => (
            <tr key={m} className="border-t">
              <td className="p-3 font-medium sticky left-0 bg-card">{fmtMonth(m)}</td>
              {statuses.map(s => {
                const cell = matrix[m][s];
                return (
                  <td key={s} className="p-2 text-center">
                    {cell.length > 0 ? (
                      <div className={cn('rounded-md p-2 cursor-pointer hover:ring-2 hover:ring-primary transition', intensity(cell.length))}
                        onClick={() => cell.length === 1 && onOpen(cell[0])}
                        title={cell.map(i => `${i.invoiceNumber} — ${formatCurrency(i.total, i.currencyCode)}`).join('\n')}>
                        <div className="text-base font-bold leading-none">{cell.length}</div>
                        <div className="text-[10px] mt-1 opacity-90">
                          {Object.entries(sumByCurrency(cell)).slice(0, 1).map(([c, v]) => formatCurrency(v, c as any))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">—</div>
                    )}
                  </td>
                );
              })}
              <td className="p-3 text-right">
                <CurrencyTotals totals={monthTotals[m]} className="text-xs" />
              </td>
            </tr>
          ))}
          {months.length === 0 && (
            <tr><td colSpan={statuses.length + 2} className="text-center py-8 text-muted-foreground">No invoices.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// 3. BY CONSULTANT (Consultant -> Account -> Month/Year)
// ============================================================
export function ByConsultantView({ invoices, onOpen }: Props) {
  // Each invoice may have multiple lines, each with its own consultant.
  // We'll attribute each line to a consultant. Invoices without consultant lines fall under "Unassigned".
  type Row = { invoice: Invoice; lineAmount: number; consultantId: string | null; accountId: string };
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    invoices.forEach(inv => {
      const lines = inv.lines || [];
      const withConsultant = lines.filter(l => l.contactId);
      if (withConsultant.length === 0) {
        out.push({ invoice: inv, lineAmount: inv.total, consultantId: null, accountId: inv.accountId });
      } else {
        withConsultant.forEach(l => {
          out.push({ invoice: inv, lineAmount: l.amount, consultantId: l.contactId!, accountId: inv.accountId });
        });
      }
    });
    return out;
  }, [invoices]);

  const consultantGroups = useMemo(() => {
    const cm = new Map<string, Row[]>();
    rows.forEach(r => {
      const k = r.consultantId || '__unassigned__';
      if (!cm.has(k)) cm.set(k, []);
      cm.get(k)!.push(r);
    });
    return Array.from(cm.entries()).map(([cid, items]) => {
      const contact = cid === '__unassigned__' ? null : getContactById(cid);
      const name = contact ? `${contact.firstName} ${contact.lastName}` : 'Unassigned';
      // by account
      const am = new Map<string, Row[]>();
      items.forEach(r => {
        if (!am.has(r.accountId)) am.set(r.accountId, []);
        am.get(r.accountId)!.push(r);
      });
      const accounts = Array.from(am.entries()).map(([aid, aitems]) => {
        // by month
        const mm = new Map<string, Row[]>();
        aitems.forEach(r => {
          const k = r.invoice.invoiceDate.slice(0, 7);
          if (!mm.has(k)) mm.set(k, []);
          mm.get(k)!.push(r);
        });
        const months = Array.from(mm.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([mk, mitems]) => ({
            monthKey: mk,
            items: mitems,
            totals: (() => {
              const t: Record<string, number> = {};
              mitems.forEach(r => { t[r.invoice.currencyCode] = (t[r.invoice.currencyCode] || 0) + r.lineAmount; });
              return t;
            })(),
          }));
        const accTotals: Record<string, number> = {};
        aitems.forEach(r => { accTotals[r.invoice.currencyCode] = (accTotals[r.invoice.currencyCode] || 0) + r.lineAmount; });
        return {
          accountId: aid,
          accountName: getAccountById(aid)?.name || 'Unknown',
          months,
          totals: accTotals,
        };
      }).sort((a, b) => a.accountName.localeCompare(b.accountName));
      const consultantTotals: Record<string, number> = {};
      items.forEach(r => { consultantTotals[r.invoice.currencyCode] = (consultantTotals[r.invoice.currencyCode] || 0) + r.lineAmount; });
      return { id: cid, name, accounts, totals: consultantTotals, count: items.length };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const [openConsultants, setOpenConsultants] = useState<Set<string>>(new Set(consultantGroups.slice(0, 2).map(c => c.id)));
  const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set());
  const toggleC = (id: string) => { const n = new Set(openConsultants); n.has(id) ? n.delete(id) : n.add(id); setOpenConsultants(n); };
  const toggleA = (id: string) => { const n = new Set(openAccounts); n.has(id) ? n.delete(id) : n.add(id); setOpenAccounts(n); };
  const fmtMonth = (m: string) => new Date(m + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-2">
      {consultantGroups.map(c => {
        const cOpen = openConsultants.has(c.id);
        return (
          <div key={c.id} className="rounded-lg border bg-card">
            <button onClick={() => toggleC(c.id)} className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 text-left">
              {cOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <div className="flex-1">
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.accounts.length} account{c.accounts.length !== 1 ? 's' : ''} · {c.count} line{c.count !== 1 ? 's' : ''}</div>
              </div>
              <CurrencyTotals totals={c.totals} className="text-sm" />
            </button>
            {cOpen && (
              <div className="border-t bg-muted/10">
                {c.accounts.map(a => {
                  const akey = `${c.id}::${a.accountId}`;
                  const aOpen = openAccounts.has(akey);
                  return (
                    <div key={akey} className="border-b last:border-b-0">
                      <button onClick={() => toggleA(akey)} className="w-full flex items-center gap-3 pl-10 pr-3 py-2 hover:bg-muted/40 text-left">
                        {aOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        <div className="flex-1 text-sm font-medium">{a.accountName}</div>
                        <div className="text-xs text-muted-foreground">{a.months.length} month{a.months.length !== 1 ? 's' : ''}</div>
                        <CurrencyTotals totals={a.totals} className="text-xs" />
                      </button>
                      {aOpen && (
                        <div className="pl-16 pr-3 py-2 space-y-2 bg-background/40">
                          {a.months.map(mo => (
                            <div key={mo.monthKey} className="rounded border bg-card">
                              <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b">
                                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{fmtMonth(mo.monthKey)}</span>
                                <CurrencyTotals totals={mo.totals} className="text-xs" />
                              </div>
                              <div className="divide-y">
                                {mo.items.map((r, idx) => (
                                  <div key={`${r.invoice.id}-${idx}`} onClick={() => onOpen(r.invoice)} className="grid grid-cols-12 gap-2 px-3 py-1.5 text-xs hover:bg-muted/30 cursor-pointer items-center">
                                    <span className="col-span-3 font-mono">{r.invoice.invoiceNumber}</span>
                                    <span className="col-span-3 text-muted-foreground">{r.invoice.contractId ? getContractById(r.invoice.contractId)?.contractNumber : '—'}</span>
                                    <span className="col-span-2">{formatDate(r.invoice.invoiceDate)}</span>
                                    <span className="col-span-2 text-right font-medium tabular-nums">{formatCurrency(r.lineAmount, r.invoice.currencyCode)}</span>
                                    <span className="col-span-2 flex justify-end"><StatusBadge status={r.invoice.status} /></span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {consultantGroups.length === 0 && <div className="text-center py-8 text-muted-foreground border rounded-lg">No invoices.</div>}
    </div>
  );
}
