import { useMemo, useState, useEffect } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Timesheet } from '@/types/crm';
import { getAccountById, getContractById, getContactById } from '@/data/mock-data';
import { StatusBadge } from '@/components/shared';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

type Props = {
  timesheets: Timesheet[];
  onOpen: (ts: Timesheet) => void;
};

type ByConsultantProps = Props & {
  selectedContractIds?: Set<string>;
  onSelectionChange?: (next: Set<string>) => void;
};

const fmtDate = (s: string) => new Date(s).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
const fmtMonth = (m: string) => new Date(m + '-01').toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
const fmtMonthLong = (m: string) => new Date(m + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

// ============================================================
// 1. GROUPED BY ACCOUNT (Contract Account)
// ============================================================
export function GroupedByAccountView({ timesheets, onOpen }: Props) {
  const groups = useMemo(() => {
    const m = new Map<string, Timesheet[]>();
    timesheets.forEach(ts => {
      const ctr = getContractById(ts.contractId);
      const k = ctr?.parentAccountId || '__unknown__';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(ts);
    });
    return Array.from(m.entries())
      .map(([accountId, items]) => {
        const totalHours = items.reduce((s, t) => s + t.totalHours, 0);
        const approved = items.filter(t => t.status === 'Approved').length;
        const submitted = items.filter(t => t.status === 'Submitted').length;
        return {
          accountId,
          accountName: accountId === '__unknown__' ? 'Unknown' : (getAccountById(accountId)?.name || 'Unknown'),
          items,
          totalHours,
          approved,
          submitted,
        };
      })
      .sort((a, b) => a.accountName.localeCompare(b.accountName));
  }, [timesheets]);

  const [openIds, setOpenIds] = useState<Set<string>>(new Set(groups.slice(0, 3).map(g => g.accountId)));
  const toggle = (id: string) => { const n = new Set(openIds); n.has(id) ? n.delete(id) : n.add(id); setOpenIds(n); };

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
                <div className="text-xs text-muted-foreground">{g.items.length} timesheet{g.items.length !== 1 ? 's' : ''} · {g.approved} approved · {g.submitted} pending</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Total Hours</div>
                <div className="text-sm font-semibold tabular-nums">{g.totalHours}h</div>
              </div>
            </button>
            {isOpen && (
              <div className="border-t divide-y">
                {g.items.map(ts => {
                  const con = getContactById(ts.contactId);
                  const ctr = getContractById(ts.contractId);
                  return (
                    <div key={ts.id} onClick={() => onOpen(ts)} className="grid grid-cols-12 gap-3 px-4 py-2 text-sm hover:bg-muted/30 cursor-pointer items-center">
                      <span className="col-span-2 font-mono text-xs">{ts.reference}</span>
                      <span className="col-span-3">{con ? `${con.firstName} ${con.lastName}` : '—'}</span>
                      <span className="col-span-3 text-xs text-muted-foreground">{ctr?.contractNumber}</span>
                      <span className="col-span-2 text-xs">Week {fmtDate(ts.weekStart)}</span>
                      <span className="col-span-1 text-right font-medium tabular-nums">{ts.totalHours}h</span>
                      <span className="col-span-1 flex justify-end"><StatusBadge status={ts.status} /></span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {groups.length === 0 && <div className="text-center py-8 text-muted-foreground border rounded-lg">No timesheets.</div>}
    </div>
  );
}

// ============================================================
// 2. MONTHLY TIMELINE (heatmap by status)
// ============================================================
export function MonthlyTimelineView({ timesheets, onOpen }: Props) {
  const { months, statuses, matrix, monthTotals } = useMemo(() => {
    const sts = ['Draft', 'Approved'] as const;
    const monthsSet = new Set<string>();
    timesheets.forEach(t => monthsSet.add(t.weekStart.slice(0, 7)));
    const months = Array.from(monthsSet).sort();
    const matrix: Record<string, Record<string, Timesheet[]>> = {};
    const monthTotals: Record<string, number> = {};
    months.forEach(m => { matrix[m] = {}; sts.forEach(s => matrix[m][s] = []); monthTotals[m] = 0; });
    timesheets.forEach(t => {
      const m = t.weekStart.slice(0, 7);
      if (matrix[m]?.[t.status]) matrix[m][t.status].push(t);
      monthTotals[m] = (monthTotals[m] || 0) + t.totalHours;
    });
    return { months, statuses: sts, matrix, monthTotals };
  }, [timesheets]);

  const maxCount = Math.max(1, ...months.flatMap(m => statuses.map(s => matrix[m][s].length)));
  const intensity = (n: number) => {
    if (n === 0) return 'bg-muted/30';
    const r = n / maxCount;
    if (r > 0.66) return 'bg-primary text-primary-foreground';
    if (r > 0.33) return 'bg-primary/60 text-primary-foreground';
    return 'bg-primary/25';
  };

  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="text-left p-3 font-medium sticky left-0 bg-muted/40">Month</th>
            {statuses.map(s => <th key={s} className="p-3 text-center font-medium">{s}</th>)}
            <th className="p-3 text-right font-medium">Total Hours</th>
          </tr>
        </thead>
        <tbody>
          {months.map(m => (
            <tr key={m} className="border-t">
              <td className="p-3 font-medium sticky left-0 bg-card">{fmtMonth(m)}</td>
              {statuses.map(s => {
                const cell = matrix[m][s];
                const hours = cell.reduce((sum, t) => sum + t.totalHours, 0);
                return (
                  <td key={s} className="p-2 text-center">
                    {cell.length > 0 ? (
                      <div className={cn('rounded-md p-2 cursor-pointer hover:ring-2 hover:ring-primary transition', intensity(cell.length))}
                        onClick={() => cell.length === 1 && onOpen(cell[0])}
                        title={cell.map(t => `${t.reference} — ${t.totalHours}h`).join('\n')}>
                        <div className="text-base font-bold leading-none">{cell.length}</div>
                        <div className="text-[10px] mt-1 opacity-90">{hours}h</div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">—</div>
                    )}
                  </td>
                );
              })}
              <td className="p-3 text-right font-medium tabular-nums">{monthTotals[m]}h</td>
            </tr>
          ))}
          {months.length === 0 && (
            <tr><td colSpan={statuses.length + 2} className="text-center py-8 text-muted-foreground">No timesheets.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// 3. BY CONSULTANT (Consultant -> Account -> Month/Year)
// ============================================================
export function ByConsultantView({ timesheets, onOpen, selectedContractIds, onSelectionChange }: ByConsultantProps) {
  const selection = selectedContractIds ?? new Set<string>();
  const setSelection = onSelectionChange ?? (() => {});

  const consultantGroups = useMemo(() => {
    const cm = new Map<string, Timesheet[]>();
    timesheets.forEach(t => {
      if (!cm.has(t.contactId)) cm.set(t.contactId, []);
      cm.get(t.contactId)!.push(t);
    });
    return Array.from(cm.entries()).map(([cid, items]) => {
      const contact = getContactById(cid);
      const name = contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown';

      const am = new Map<string, Timesheet[]>();
      items.forEach(t => {
        const ctr = getContractById(t.contractId);
        const k = ctr?.parentAccountId || '__unknown__';
        if (!am.has(k)) am.set(k, []);
        am.get(k)!.push(t);
      });
      const accounts = Array.from(am.entries()).map(([aid, aitems]) => {
        const mm = new Map<string, Timesheet[]>();
        aitems.forEach(t => {
          const k = t.weekStart.slice(0, 7);
          if (!mm.has(k)) mm.set(k, []);
          mm.get(k)!.push(t);
        });
        const months = Array.from(mm.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([mk, mitems]) => ({
            monthKey: mk,
            items: mitems.sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
            totalHours: mitems.reduce((s, t) => s + t.totalHours, 0),
          }));
        const contractIds = Array.from(new Set(aitems.map(t => t.contractId)));
        return {
          accountId: aid,
          accountName: aid === '__unknown__' ? 'Unknown' : (getAccountById(aid)?.name || 'Unknown'),
          months,
          contractIds,
          totalHours: aitems.reduce((s, t) => s + t.totalHours, 0),
          count: aitems.length,
        };
      }).sort((a, b) => a.accountName.localeCompare(b.accountName));

      const allContractIds = Array.from(new Set(items.map(t => t.contractId)));

      return {
        id: cid,
        name,
        accounts,
        allContractIds,
        totalHours: items.reduce((s, t) => s + t.totalHours, 0),
        count: items.length,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [timesheets]);

  const [openConsultants, setOpenConsultants] = useState<Set<string>>(new Set(consultantGroups.slice(0, 2).map(c => c.id)));
  const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set());
  const toggleC = (id: string) => { const n = new Set(openConsultants); n.has(id) ? n.delete(id) : n.add(id); setOpenConsultants(n); };
  const toggleA = (id: string) => { const n = new Set(openAccounts); n.has(id) ? n.delete(id) : n.add(id); setOpenAccounts(n); };

  const toggleContracts = (ids: string[], checked: boolean) => {
    const n = new Set(selection);
    ids.forEach(id => checked ? n.add(id) : n.delete(id));
    setSelection(n);
  };
  const consultantCheckState = (ids: string[]): boolean | 'indeterminate' => {
    const sel = ids.filter(id => selection.has(id)).length;
    if (sel === 0) return false;
    if (sel === ids.length) return true;
    return 'indeterminate';
  };

  return (
    <div className="space-y-2">
      {consultantGroups.map(c => {
        const cOpen = openConsultants.has(c.id);
        const cState = consultantCheckState(c.allContractIds);
        return (
          <div key={c.id} className="rounded-lg border bg-card">
            <div className="w-full flex items-center gap-3 p-3 hover:bg-muted/50">
              <div onClick={e => e.stopPropagation()} className="flex items-center">
                <Checkbox
                  checked={cState}
                  onCheckedChange={(v) => toggleContracts(c.allContractIds, !!v)}
                  aria-label={`Select all contracts for ${c.name}`}
                />
              </div>
              <button onClick={() => toggleC(c.id)} className="flex-1 flex items-center gap-3 text-left">
                {cOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <div className="flex-1">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.accounts.length} account{c.accounts.length !== 1 ? 's' : ''} · {c.count} timesheet{c.count !== 1 ? 's' : ''}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Total Hours</div>
                  <div className="text-sm font-semibold tabular-nums">{c.totalHours}h</div>
                </div>
              </button>
            </div>
            {cOpen && (
              <div className="border-t bg-muted/10">
                {c.accounts.map(a => {
                  const akey = `${c.id}::${a.accountId}`;
                  const aOpen = openAccounts.has(akey);
                  const aState = consultantCheckState(a.contractIds);
                  return (
                    <div key={akey} className="border-b last:border-b-0">
                      <div className="w-full flex items-center gap-3 pl-10 pr-3 py-2 hover:bg-muted/40">
                        <div onClick={e => e.stopPropagation()} className="flex items-center">
                          <Checkbox
                            checked={aState}
                            onCheckedChange={(v) => toggleContracts(a.contractIds, !!v)}
                            aria-label={`Select contracts for ${a.accountName}`}
                          />
                        </div>
                        <button onClick={() => toggleA(akey)} className="flex-1 flex items-center gap-3 text-left">
                          {aOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          <div className="flex-1 text-sm font-medium">{a.accountName}</div>
                          <div className="text-xs text-muted-foreground">{a.months.length} month{a.months.length !== 1 ? 's' : ''} · {a.count} ts</div>
                          <div className="text-xs font-semibold tabular-nums">{a.totalHours}h</div>
                        </button>
                      </div>
                      {aOpen && (
                        <div className="pl-16 pr-3 py-2 space-y-2 bg-background/40">
                          {a.months.map(mo => (
                            <div key={mo.monthKey} className="rounded border bg-card">
                              <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b">
                                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{fmtMonthLong(mo.monthKey)}</span>
                                <span className="text-xs font-semibold tabular-nums">{mo.totalHours}h</span>
                              </div>
                              <div className="divide-y">
                                {mo.items.map(t => {
                                  const ctr = getContractById(t.contractId);
                                  return (
                                    <div key={t.id} onClick={() => onOpen(t)} className="grid grid-cols-12 gap-2 px-3 py-1.5 text-xs hover:bg-muted/30 cursor-pointer items-center">
                                      <span className="col-span-3 font-mono">{t.reference}</span>
                                      <span className="col-span-3 text-muted-foreground">{ctr?.contractNumber}</span>
                                      <span className="col-span-3">Week {fmtDate(t.weekStart)}</span>
                                      <span className="col-span-1 text-right font-medium tabular-nums">{t.totalHours}h</span>
                                      <span className="col-span-2 flex justify-end"><StatusBadge status={t.status} /></span>
                                    </div>
                                  );
                                })}
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
      {consultantGroups.length === 0 && <div className="text-center py-8 text-muted-foreground border rounded-lg">No timesheets.</div>}
    </div>
  );
}

