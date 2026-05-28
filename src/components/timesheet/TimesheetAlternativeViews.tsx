import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown } from '../Icons';
import { StatusBadge } from '../Shared';

type FilterRange = { from: string | null; to: string | null } | null | undefined;

type Props = {
  timesheets: any[];
  onOpen: (ts: any) => void;
  contracts?: any[];
  accounts?: any[];
  contacts?: any[];
  filterRange?: FilterRange;
};

type ByConsultantProps = Props & {
  selectedContractIds?: Set<string>;
  onSelectionChange?: (next: Set<string>) => void;
};

const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtMonth = (m: string) => new Date(m + '-01').toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
const fmtMonthLong = (m: string) => new Date(m + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

// For split weeks (Mon-Sun spanning two months), only count days that fall within targetMonth ('YYYY-MM').
function hoursForMonth(ts: any, targetMonth: string): number {
  if (!ts.entries || ts.entries.length === 0) return ts.totalHours || 0;
  return ts.entries
    .filter((e: any) => e.date && String(e.date).startsWith(targetMonth))
    .reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
}

// Hours for a timesheet within an arbitrary [from, to] (YYYY-MM-DD) range.
// When both bounds are null/undefined, returns the full week total — keeps "All time" behavior.
export function hoursInRange(ts: any, from: string | null | undefined, to: string | null | undefined): number {
  if (!from && !to) return ts.totalHours || 0;
  if (!ts.entries || ts.entries.length === 0) return ts.totalHours || 0;
  return ts.entries
    .filter((e: any) => {
      if (!e.date) return false;
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      return true;
    })
    .reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
}

// Hours within a specific month bucket AND within an optional [from, to] range.
// When range is not set, falls back to hoursForMonth (full month split).
function hoursForMonthInRange(ts: any, monthKey: string, from: string | null | undefined, to: string | null | undefined): number {
  if (!ts.entries || ts.entries.length === 0) {
    return (!from && !to) ? (ts.totalHours || 0) : 0;
  }
  return ts.entries
    .filter((e: any) => {
      if (!e.date) return false;
      if (!String(e.date).startsWith(monthKey)) return false;
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      return true;
    })
    .reduce((sum: number, e: any) => sum + (e.hours || 0), 0);
}

const cardStyle: React.CSSProperties = {
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  background: 'hsl(var(--card))',
  marginBottom: '0.5rem',
  overflow: 'hidden',
};

const headerBtnStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.75rem',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
};

const subRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '0.5rem 1rem',
  borderTop: '1px solid hsl(var(--border))',
  fontSize: '0.875rem',
  cursor: 'pointer',
};

// ============================================================
// 1. GROUPED BY ACCOUNT (Parent → Child → Consultant)
// ============================================================
export function GroupedByAccountView({ timesheets, onOpen, contracts = [], accounts = [], contacts = [], filterRange }: Props) {
  const from = filterRange?.from ?? null;
  const to = filterRange?.to ?? null;
  const hierarchy = useMemo(() => {
    type TSItem = (typeof timesheets)[number];
    const parentMap = new Map<string, Map<string, Map<string, TSItem[]>>>();

    timesheets.forEach(ts => {
      const ctr = contracts.find(c => c.id === ts.contractId);
      const parentId = ctr?.parentAccountId || '__unknown__';
      const childId = ctr?.childAccountId || '__direct__';
      const consultantId = ts.contactId || '__unknown__';

      if (!parentMap.has(parentId)) parentMap.set(parentId, new Map());
      const childMap = parentMap.get(parentId)!;
      if (!childMap.has(childId)) childMap.set(childId, new Map());
      const consultantMap = childMap.get(childId)!;
      if (!consultantMap.has(consultantId)) consultantMap.set(consultantId, []);
      consultantMap.get(consultantId)!.push(ts);
    });

    return Array.from(parentMap.entries()).map(([parentId, childMap]) => {
      const parentAcc = accounts.find(a => a.id === parentId);
      const parentName = parentAcc?.name || contracts.find(c => c.parentAccountId === parentId)?.parentAccountName || 'Unknown';
      const children = Array.from(childMap.entries()).map(([childId, consultantMap]) => {
        const childAcc = accounts.find(a => a.id === childId);
        const childName = childId === '__direct__' ? 'Direct' : (childAcc?.name || 'Unknown');
        const consultants = Array.from(consultantMap.entries()).map(([conId, tsList]) => {
          const con = contacts.find(c => c.id === conId);
          const conName = con ? `${con.firstName} ${con.lastName}` : 'Unknown';
          const totalHours = tsList.reduce((s, t) => s + hoursInRange(t, from, to), 0);
          return { conId, conName, timesheets: tsList, totalHours };
        }).sort((a, b) => a.conName.localeCompare(b.conName));
        const totalHours = consultants.reduce((s, c) => s + c.totalHours, 0);
        const allTs = consultants.flatMap(c => c.timesheets);
        return { childId, childName, consultants, totalHours, count: allTs.length, approved: allTs.filter(t => t.status === 'Approved').length };
      }).sort((a, b) => a.childName.localeCompare(b.childName));
      const totalHours = children.reduce((s, c) => s + c.totalHours, 0);
      const allTs = children.flatMap(c => c.consultants.flatMap(co => co.timesheets));
      return { parentId, parentName, children, totalHours, count: allTs.length, approved: allTs.filter(t => t.status === 'Approved').length };
    }).sort((a, b) => a.parentName.localeCompare(b.parentName));
  }, [timesheets, contracts, accounts, contacts, from, to]);

  const [openParents, setOpenParents] = useState<Set<string>>(new Set(hierarchy.slice(0, 3).map(h => h.parentId)));
  const [openChildren, setOpenChildren] = useState<Set<string>>(new Set());
  const [openConsultants, setOpenConsultants] = useState<Set<string>>(new Set());
  const toggleParent = (id: string) => { const n = new Set(openParents); n.has(id) ? n.delete(id) : n.add(id); setOpenParents(n); };
  const toggleChild = (id: string) => { const n = new Set(openChildren); n.has(id) ? n.delete(id) : n.add(id); setOpenChildren(n); };
  const toggleConsultant = (id: string) => { const n = new Set(openConsultants); n.has(id) ? n.delete(id) : n.add(id); setOpenConsultants(n); };

  if (hierarchy.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem 0', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}>No timesheets.</div>;
  }

  return (
    <div>
      {hierarchy.map(parent => {
        const pOpen = openParents.has(parent.parentId);
        return (
          <div key={parent.parentId} style={cardStyle}>
            {/* Level 1: Parent Account */}
            <button onClick={() => toggleParent(parent.parentId)} style={headerBtnStyle}>
              {pOpen ? <ChevronDown className="csp-icon-sm" /> : <ChevronRight className="csp-icon-sm" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{parent.parentName}</div>
                <div className="csp-text-muted" style={{ fontSize: '0.75rem' }}>{parent.count} timesheet{parent.count !== 1 ? 's' : ''} {'·'} {parent.approved} approved</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="csp-text-muted" style={{ fontSize: '0.75rem' }}>Total Hours</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{parent.totalHours}h</div>
              </div>
            </button>
            {pOpen && parent.children.map(child => {
              const cKey = `${parent.parentId}|${child.childId}`;
              const cOpen = openChildren.has(cKey);
              return (
                <div key={child.childId} style={{ marginLeft: '1.5rem', borderLeft: '2px solid hsl(var(--border))' }}>
                  {/* Level 2: Child Account */}
                  <button onClick={() => toggleChild(cKey)} style={{ ...headerBtnStyle, padding: '0.5rem 0.75rem', backgroundColor: 'transparent' }}>
                    {cOpen ? <ChevronDown className="csp-icon-sm" /> : <ChevronRight className="csp-icon-sm" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.childName}</div>
                      <div className="csp-text-muted" style={{ fontSize: '0.7rem' }}>{child.count} ts {'·'} {child.consultants.length} consultant{child.consultants.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, flexShrink: 0 }}>{child.totalHours}h</div>
                  </button>
                  {cOpen && child.consultants.map(consultant => {
                    const coKey = `${cKey}|${consultant.conId}`;
                    const coOpen = openConsultants.has(coKey);
                    return (
                      <div key={consultant.conId} style={{ marginLeft: '1.5rem' }}>
                        {/* Level 3: Consultant */}
                        <button onClick={() => toggleConsultant(coKey)} style={{ ...headerBtnStyle, padding: '0.375rem 0.75rem', backgroundColor: 'transparent' }}>
                          {coOpen ? <ChevronDown className="csp-icon-sm" /> : <ChevronRight className="csp-icon-sm" />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{consultant.conName}</span>
                          </div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 500, flexShrink: 0 }}>{consultant.totalHours}h</div>
                        </button>
                        {coOpen && consultant.timesheets.map(ts => {
                          const ctr = contracts.find(c => c.id === ts.contractId);
                          return (
                            <div key={ts.id} onClick={() => onOpen(ts)} style={{ ...subRowStyle, marginLeft: '1.5rem', overflow: 'hidden' }}>
                              <span className="csp-td-mono" style={{ width: 100, flexShrink: 0, fontSize: '0.75rem' }}>{ts.reference}</span>
                              <span className="csp-text-muted" style={{ flex: 1, minWidth: 0, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctr?.contractNumber || '—'}</span>
                              <span style={{ width: 130, flexShrink: 0, fontSize: '0.75rem' }}>Week {fmtDate(ts.weekStart)}</span>
                              <span style={{ width: 60, flexShrink: 0, textAlign: 'right', fontWeight: 500 }}>{hoursInRange(ts, from, to)}h</span>
                              <span style={{ width: 90, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}><StatusBadge status={ts.status} /></span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// 2. MONTHLY TIMELINE (heatmap by status)
// ============================================================
export function MonthlyTimelineView({ timesheets, onOpen }: Props) {
  const { months, statuses, matrix, monthTotals } = useMemo(() => {
    const sts = ['Draft', 'Submitted', 'Approved'] as const;
    const monthsSet = new Set<string>();
    timesheets.forEach(t => {
      if (t.weekStart) {
        monthsSet.add(t.weekStart.slice(0, 7));
        const endDate = new Date(t.weekStart);
        endDate.setDate(endDate.getDate() + 6);
        monthsSet.add(`${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`);
      }
    });
    const months = Array.from(monthsSet).sort();
    const matrix: Record<string, Record<string, any[]>> = {};
    const monthTotals: Record<string, number> = {};
    months.forEach(m => { matrix[m] = {}; sts.forEach(s => matrix[m][s] = []); monthTotals[m] = 0; });
    timesheets.forEach(t => {
      const startMonth = (t.weekStart || '').slice(0, 7);
      const weekEndDate = new Date(t.weekStart);
      weekEndDate.setDate(weekEndDate.getDate() + 6);
      const endMonth = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, '0')}`;

      if (matrix[startMonth]) {
        const bucket = matrix[startMonth][t.status] || (matrix[startMonth][t.status] = []);
        bucket.push(t);
        monthTotals[startMonth] = (monthTotals[startMonth] || 0) + hoursForMonth(t, startMonth);
      }

      if (endMonth !== startMonth) {
        if (!matrix[endMonth]) {
          matrix[endMonth] = {};
          sts.forEach(s => matrix[endMonth][s] = []);
          monthTotals[endMonth] = 0;
          months.push(endMonth);
        }
        const bucket2 = matrix[endMonth][t.status] || (matrix[endMonth][t.status] = []);
        bucket2.push(t);
        monthTotals[endMonth] = (monthTotals[endMonth] || 0) + hoursForMonth(t, endMonth);
      }
    });
    months.sort();
    return { months, statuses: sts, matrix, monthTotals };
  }, [timesheets]);

  const maxCount = Math.max(1, ...months.flatMap(m => statuses.map(s => matrix[m][s].length)));
  const cellBg = (n: number) => {
    if (n === 0) return 'hsl(var(--muted) / 0.3)';
    const r = n / maxCount;
    if (r > 0.66) return 'hsl(var(--primary))';
    if (r > 0.33) return 'hsl(var(--primary) / 0.6)';
    return 'hsl(var(--primary) / 0.25)';
  };
  const cellFg = (n: number) => (n / maxCount > 0.33 ? 'hsl(var(--primary-foreground))' : 'inherit');

  return (
    <div className="csp-table-wrapper" style={{ overflowX: 'auto' }}>
      <table className="csp-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Month</th>
            {statuses.map(s => <th key={s} style={{ textAlign: 'center' }}>{s}</th>)}
            <th style={{ textAlign: 'right' }}>Total Hours</th>
          </tr>
        </thead>
        <tbody>
          {months.length === 0 ? (
            <tr><td colSpan={statuses.length + 2} style={{ textAlign: 'center', padding: '2rem 0', color: 'hsl(var(--muted-foreground))' }}>No timesheets.</td></tr>
          ) : months.map(m => (
            <tr key={m}>
              <td style={{ fontWeight: 500 }}>{fmtMonth(m)}</td>
              {statuses.map(s => {
                const cell = matrix[m][s] || [];
                const hours = cell.reduce((sum, t) => sum + hoursForMonth(t, m), 0);
                return (
                  <td key={s} style={{ textAlign: 'center', padding: '0.25rem' }}>
                    {cell.length > 0 ? (
                      <div
                        style={{ borderRadius: 6, padding: '0.5rem', cursor: 'pointer', background: cellBg(cell.length), color: cellFg(cell.length) }}
                        onClick={() => cell.length === 1 && onOpen(cell[0])}
                        title={cell.map(t => `${t.reference} — ${t.totalHours}h`).join('\n')}
                      >
                        <div style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1 }}>{cell.length}</div>
                        <div style={{ fontSize: '0.625rem', marginTop: 4, opacity: 0.9 }}>{hours}h</div>
                      </div>
                    ) : (
                      <span className="csp-text-muted" style={{ fontSize: '0.75rem' }}>—</span>
                    )}
                  </td>
                );
              })}
              <td style={{ textAlign: 'right', fontWeight: 500 }}>{monthTotals[m]}h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// 3. BY CONSULTANT (Consultant -> Account -> Month/Year)
// ============================================================
export function ByConsultantView({ timesheets, onOpen, contracts = [], accounts = [], contacts = [], filterRange, selectedContractIds, onSelectionChange }: ByConsultantProps) {
  const selection = selectedContractIds ?? new Set<string>();
  const setSelection = onSelectionChange ?? (() => {});
  const from = filterRange?.from ?? null;
  const to = filterRange?.to ?? null;

  const toggleContracts = (ids: string[], checked: boolean) => {
    const n = new Set(selection);
    ids.forEach(id => checked ? n.add(id) : n.delete(id));
    setSelection(n);
  };
  const groupCheckState = (ids: string[]): boolean | 'indeterminate' => {
    const sel = ids.filter(id => selection.has(id)).length;
    if (sel === 0) return false;
    if (sel === ids.length) return true;
    return 'indeterminate';
  };

  const consultantGroups = useMemo(() => {
    const cm = new Map<string, any[]>();
    timesheets.forEach(t => {
      if (!cm.has(t.contactId)) cm.set(t.contactId, []);
      cm.get(t.contactId)!.push(t);
    });
    return Array.from(cm.entries()).map(([cid, items]) => {
      const contact = contacts.find(c => c.id === cid);
      const name = contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown';

      const am = new Map<string, any[]>();
      items.forEach(t => {
        const ctr = contracts.find(c => c.id === t.contractId);
        const k = ctr?.parentAccountId || '__unknown__';
        if (!am.has(k)) am.set(k, []);
        am.get(k)!.push(t);
      });
      const accountList = Array.from(am.entries()).map(([aid, aitems]) => {
        const mm = new Map<string, any[]>();
        aitems.forEach(t => {
          const startMonth = (t.weekStart || '').slice(0, 7);
          if (!mm.has(startMonth)) mm.set(startMonth, []);
          mm.get(startMonth)!.push(t);
          if (t.weekStart) {
            const weekEndDate = new Date(t.weekStart);
            weekEndDate.setDate(weekEndDate.getDate() + 6);
            const endMonth = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, '0')}`;
            if (endMonth !== startMonth) {
              if (!mm.has(endMonth)) mm.set(endMonth, []);
              mm.get(endMonth)!.push(t);
            }
          }
        });
        const months = Array.from(mm.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([mk, mitems]) => ({
            monthKey: mk,
            items: mitems.sort((a, b) => (a.weekStart || '').localeCompare(b.weekStart || '')),
            totalHours: mitems.reduce((s, t) => s + hoursForMonthInRange(t, mk, from, to), 0),
          }));
        const acc = accounts.find(a => a.id === aid);
        const fallbackContract = aitems[0] && contracts.find(c => c.id === aitems[0].contractId);
        const contractIds = Array.from(new Set(aitems.map(t => t.contractId).filter(Boolean) as string[]));
        return {
          accountId: aid,
          accountName: aid === '__unknown__'
            ? 'Unknown'
            : (acc?.name || fallbackContract?.parentAccountName || 'Unknown'),
          months,
          contractIds,
          totalHours: aitems.reduce((s, t) => s + hoursInRange(t, from, to), 0),
          count: aitems.length,
        };
      }).sort((a, b) => a.accountName.localeCompare(b.accountName));

      const allContractIds = Array.from(new Set(items.map(t => t.contractId).filter(Boolean) as string[]));

      return {
        id: cid,
        name,
        accounts: accountList,
        allContractIds,
        totalHours: items.reduce((s, t) => s + hoursInRange(t, from, to), 0),
        count: items.length,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [timesheets, contracts, accounts, contacts, from, to]);

  const [openConsultants, setOpenConsultants] = useState<Set<string>>(new Set(consultantGroups.slice(0, 2).map(c => c.id)));
  const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set());
  const toggleC = (id: string) => { const n = new Set(openConsultants); n.has(id) ? n.delete(id) : n.add(id); setOpenConsultants(n); };
  const toggleA = (id: string) => { const n = new Set(openAccounts); n.has(id) ? n.delete(id) : n.add(id); setOpenAccounts(n); };

  if (consultantGroups.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem 0', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}>No timesheets.</div>;
  }

  return (
    <div>
      {consultantGroups.map(c => {
        const cOpen = openConsultants.has(c.id);
        const cState = groupCheckState(c.allContractIds);
        return (
          <div key={c.id} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem' }}>
              <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={cState === true}
                  ref={el => { if (el) el.indeterminate = cState === 'indeterminate'; }}
                  onChange={e => toggleContracts(c.allContractIds, e.target.checked)}
                  aria-label={`Select all contracts for ${c.name}`}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
              </span>
              <button onClick={() => toggleC(c.id)} style={{ ...headerBtnStyle, flex: 1, padding: 0 }}>
                {cOpen ? <ChevronDown className="csp-icon-sm" /> : <ChevronRight className="csp-icon-sm" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div className="csp-text-muted" style={{ fontSize: '0.75rem' }}>{c.accounts.length} account{c.accounts.length !== 1 ? 's' : ''} · {c.count} timesheet{c.count !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="csp-text-muted" style={{ fontSize: '0.75rem' }}>Total Hours</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{c.totalHours}h</div>
                </div>
              </button>
            </div>
            {cOpen && (
              <div style={{ borderTop: '1px solid hsl(var(--border))' }}>
                {c.accounts.map(a => {
                  const akey = `${c.id}::${a.accountId}`;
                  const aOpen = openAccounts.has(akey);
                  const aState = groupCheckState(a.contractIds);
                  return (
                    <div key={akey} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: '2.5rem', paddingRight: '0.75rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                        <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={aState === true}
                            ref={el => { if (el) el.indeterminate = aState === 'indeterminate'; }}
                            onChange={e => toggleContracts(a.contractIds, e.target.checked)}
                            aria-label={`Select contracts for ${a.accountName}`}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                          />
                        </span>
                        <button onClick={() => toggleA(akey)} style={{ ...headerBtnStyle, flex: 1, padding: 0 }}>
                          {aOpen ? <ChevronDown className="csp-icon-sm" /> : <ChevronRight className="csp-icon-sm" />}
                          <div style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>{a.accountName}</div>
                          <div className="csp-text-muted" style={{ fontSize: '0.75rem' }}>{a.months.length} month{a.months.length !== 1 ? 's' : ''} · {a.count} ts</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{a.totalHours}h</div>
                        </button>
                      </div>
                      {aOpen && (
                        <div style={{ paddingLeft: '4rem', paddingRight: '0.75rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', background: 'hsl(var(--background) / 0.4)' }}>
                          {a.months.map(mo => (
                            <div key={mo.monthKey} style={{ border: '1px solid hsl(var(--border))', borderRadius: 6, marginBottom: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.375rem 0.75rem', background: 'hsl(var(--muted) / 0.3)', borderBottom: '1px solid hsl(var(--border))' }}>
                                <span className="csp-text-muted" style={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{fmtMonthLong(mo.monthKey)}</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{mo.totalHours}h</span>
                              </div>
                              {mo.items.map(t => {
                                const ctr = contracts.find(c => c.id === t.contractId);
                                return (
                                  <div key={t.id} onClick={() => onOpen(t)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0.375rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer', borderTop: '1px solid hsl(var(--border))' }}>
                                    <span className="csp-td-mono" style={{ width: 100, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.reference}</span>
                                    <span className="csp-text-muted" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctr?.contractNumber || '—'}</span>
                                    <span style={{ width: 140, flexShrink: 0 }}>Week {fmtDate(t.weekStart)}</span>
                                    <span style={{ width: 60, flexShrink: 0, textAlign: 'right', fontWeight: 500 }}>{hoursForMonthInRange(t, mo.monthKey, from, to)}h</span>
                                    <span style={{ width: 90, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}><StatusBadge status={t.status} /></span>
                                  </div>
                                );
                              })}
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
    </div>
  );
}
