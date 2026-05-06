import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown } from '../Icons';
import { StatusBadge } from '../Shared';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { CurrencyCode } from '../../types/crm';

type Props = {
  invoices: any[];
  onOpen: (inv: any) => void;
};

function sumByCurrency(list: any[]): Record<string, number> {
  const map: Record<string, number> = {};
  list.forEach(i => { map[i.currencyCode] = (map[i.currencyCode] || 0) + (i.total || 0); });
  return map;
}

function CurrencyTotals({ totals, color }: { totals: Record<string, number>; color?: string }) {
  const entries = Object.entries(totals);
  if (entries.length === 0) return <span className="csp-text-muted">—</span>;
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.875rem', color }}>
      {entries.map(([c, v]) => (
        <span key={c} style={{ fontWeight: 500 }}>{formatCurrency(v, c as CurrencyCode)}</span>
      ))}
    </span>
  );
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
// 1. GROUPED BY ACCOUNT
// ============================================================
export function GroupedByAccountView({ invoices, onOpen }: Props) {
  const groups = useMemo(() => {
    const m = new Map<string, any[]>();
    invoices.forEach(inv => {
      const k = inv.accountId || '__unknown__';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(inv);
    });
    return Array.from(m.entries())
      .map(([accountId, items]) => ({
        accountId,
        accountName: items[0]?.accountName || items[0]?.company || 'Unknown',
        items,
        totals: sumByCurrency(items),
        outstanding: sumByCurrency(items.filter(i => i.status === 'Sent' || i.status === 'Overdue')),
      }))
      .sort((a, b) => a.accountName.localeCompare(b.accountName));
  }, [invoices]);

  const [openIds, setOpenIds] = useState<Set<string>>(new Set(groups.slice(0, 3).map(g => g.accountId)));
  const toggle = (id: string) => { const n = new Set(openIds); n.has(id) ? n.delete(id) : n.add(id); setOpenIds(n); };

  if (groups.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem 0', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}>No invoices.</div>;
  }

  return (
    <div>
      {groups.map(g => {
        const isOpen = openIds.has(g.accountId);
        return (
          <div key={g.accountId} style={cardStyle}>
            <button onClick={() => toggle(g.accountId)} style={headerBtnStyle}>
              {isOpen ? <ChevronDown className="csp-icon-sm" /> : <ChevronRight className="csp-icon-sm" />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{g.accountName}</div>
                <div className="csp-text-muted" style={{ fontSize: '0.75rem' }}>{g.items.length} invoice{g.items.length !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="csp-text-muted" style={{ fontSize: '0.75rem' }}>Outstanding</div>
                <CurrencyTotals totals={g.outstanding} color="hsl(38, 92%, 45%)" />
              </div>
              <div style={{ textAlign: 'right', minWidth: 140 }}>
                <div className="csp-text-muted" style={{ fontSize: '0.75rem' }}>Total Billed</div>
                <CurrencyTotals totals={g.totals} />
              </div>
            </button>
            {isOpen && (
              <div>
                {g.items.map(inv => (
                  <div key={inv.id} onClick={() => onOpen(inv)} style={subRowStyle}>
                    <span className="csp-td-mono" style={{ width: 110, flexShrink: 0, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.invoiceNumber}</span>
                    <span className="csp-text-muted" style={{ flex: 1, minWidth: 0, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.contractNumber || '—'}</span>
                    <span style={{ width: 110, flexShrink: 0, fontSize: '0.75rem' }}>{inv.invoiceDate ? formatDate(inv.invoiceDate) : '—'}</span>
                    <span style={{ width: 130, flexShrink: 0, fontSize: '0.75rem' }}>Due {inv.dueDate ? formatDate(inv.dueDate) : '—'}</span>
                    <span style={{ width: 110, flexShrink: 0, textAlign: 'right', fontWeight: 500 }}>{formatCurrency(inv.total || 0, inv.currencyCode)}</span>
                    <span style={{ width: 90, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}><StatusBadge status={inv.status} /></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
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
    invoices.forEach(i => { if (i.invoiceDate) monthsSet.add(i.invoiceDate.slice(0, 7)); });
    const months = Array.from(monthsSet).sort();
    const matrix: Record<string, Record<string, any[]>> = {};
    const monthTotals: Record<string, Record<string, number>> = {};
    months.forEach(m => { matrix[m] = {}; sts.forEach(s => matrix[m][s] = []); monthTotals[m] = {}; });
    invoices.forEach(i => {
      const m = (i.invoiceDate || '').slice(0, 7);
      if (!matrix[m]) return;
      const bucket = matrix[m][i.status] || (matrix[m][i.status] = []);
      bucket.push(i);
      monthTotals[m][i.currencyCode] = (monthTotals[m][i.currencyCode] || 0) + (i.total || 0);
    });
    return { months, statuses: sts, matrix, monthTotals };
  }, [invoices]);

  const maxCount = Math.max(1, ...months.flatMap(m => statuses.map(s => matrix[m][s].length)));
  const cellBg = (n: number) => {
    if (n === 0) return 'hsl(var(--muted) / 0.3)';
    const r = n / maxCount;
    if (r > 0.66) return 'hsl(var(--primary))';
    if (r > 0.33) return 'hsl(var(--primary) / 0.6)';
    return 'hsl(var(--primary) / 0.25)';
  };
  const cellFg = (n: number) => (n / maxCount > 0.33 ? 'hsl(var(--primary-foreground))' : 'inherit');
  const fmtMonth = (m: string) => new Date(m + '-01').toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

  return (
    <div className="csp-table-wrapper" style={{ overflowX: 'auto' }}>
      <table className="csp-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Month</th>
            {statuses.map(s => <th key={s} style={{ textAlign: 'center' }}>{s}</th>)}
            <th style={{ textAlign: 'right' }}>Total Billed</th>
          </tr>
        </thead>
        <tbody>
          {months.length === 0 ? (
            <tr><td colSpan={statuses.length + 2} style={{ textAlign: 'center', padding: '2rem 0', color: 'hsl(var(--muted-foreground))' }}>No invoices.</td></tr>
          ) : months.map(m => (
            <tr key={m}>
              <td style={{ fontWeight: 500 }}>{fmtMonth(m)}</td>
              {statuses.map(s => {
                const cell = matrix[m][s] || [];
                const totals = sumByCurrency(cell);
                const firstTotal = Object.entries(totals)[0];
                return (
                  <td key={s} style={{ textAlign: 'center', padding: '0.25rem' }}>
                    {cell.length > 0 ? (
                      <div
                        style={{ borderRadius: 6, padding: '0.5rem', cursor: 'pointer', background: cellBg(cell.length), color: cellFg(cell.length) }}
                        onClick={() => cell.length === 1 && onOpen(cell[0])}
                        title={cell.map(i => `${i.invoiceNumber} — ${formatCurrency(i.total || 0, i.currencyCode)}`).join('\n')}
                      >
                        <div style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1 }}>{cell.length}</div>
                        <div style={{ fontSize: '0.625rem', marginTop: 4, opacity: 0.9 }}>
                          {firstTotal ? formatCurrency(firstTotal[1], firstTotal[0] as CurrencyCode) : ''}
                        </div>
                      </div>
                    ) : (
                      <span className="csp-text-muted" style={{ fontSize: '0.75rem' }}>—</span>
                    )}
                  </td>
                );
              })}
              <td style={{ textAlign: 'right' }}>
                <CurrencyTotals totals={monthTotals[m]} />
              </td>
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
export function ByConsultantView({ invoices, onOpen }: Props) {
  type Row = { invoice: any; lineAmount: number; consultantId: string | null; consultantName: string; accountId: string };
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    invoices.forEach(inv => {
      const lines: any[] = inv.lines || [];
      const withConsultant = lines.filter(l => l.contactId);
      if (withConsultant.length === 0) {
        out.push({ invoice: inv, lineAmount: inv.total || 0, consultantId: null, consultantName: 'Unassigned', accountId: inv.accountId || '__unknown__' });
      } else {
        withConsultant.forEach(l => {
          out.push({
            invoice: inv,
            lineAmount: l.amount || 0,
            consultantId: l.contactId || null,
            consultantName: l.consultantName || l.name || 'Consultant',
            accountId: inv.accountId || '__unknown__',
          });
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
      const name = cid === '__unassigned__' ? 'Unassigned' : (items[0]?.consultantName || 'Consultant');
      const am = new Map<string, Row[]>();
      items.forEach(r => {
        if (!am.has(r.accountId)) am.set(r.accountId, []);
        am.get(r.accountId)!.push(r);
      });
      const accountList = Array.from(am.entries()).map(([aid, aitems]) => {
        const mm = new Map<string, Row[]>();
        aitems.forEach(r => {
          const k = (r.invoice.invoiceDate || '').slice(0, 7);
          if (!mm.has(k)) mm.set(k, []);
          mm.get(k)!.push(r);
        });
        const months = Array.from(mm.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([mk, mitems]) => {
            const totals: Record<string, number> = {};
            mitems.forEach(r => { totals[r.invoice.currencyCode] = (totals[r.invoice.currencyCode] || 0) + r.lineAmount; });
            return { monthKey: mk, items: mitems, totals };
          });
        const accTotals: Record<string, number> = {};
        aitems.forEach(r => { accTotals[r.invoice.currencyCode] = (accTotals[r.invoice.currencyCode] || 0) + r.lineAmount; });
        return {
          accountId: aid,
          accountName: aitems[0]?.invoice.accountName || aitems[0]?.invoice.company || 'Unknown',
          months,
          totals: accTotals,
        };
      }).sort((a, b) => a.accountName.localeCompare(b.accountName));
      const consultantTotals: Record<string, number> = {};
      items.forEach(r => { consultantTotals[r.invoice.currencyCode] = (consultantTotals[r.invoice.currencyCode] || 0) + r.lineAmount; });
      return { id: cid, name, accounts: accountList, totals: consultantTotals, count: items.length };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const [openConsultants, setOpenConsultants] = useState<Set<string>>(new Set(consultantGroups.slice(0, 2).map(c => c.id)));
  const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set());
  const toggleC = (id: string) => { const n = new Set(openConsultants); n.has(id) ? n.delete(id) : n.add(id); setOpenConsultants(n); };
  const toggleA = (id: string) => { const n = new Set(openAccounts); n.has(id) ? n.delete(id) : n.add(id); setOpenAccounts(n); };
  const fmtMonth = (m: string) => new Date(m + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  if (consultantGroups.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem 0', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}>No invoices.</div>;
  }

  return (
    <div>
      {consultantGroups.map(c => {
        const cOpen = openConsultants.has(c.id);
        return (
          <div key={c.id} style={cardStyle}>
            <button onClick={() => toggleC(c.id)} style={headerBtnStyle}>
              {cOpen ? <ChevronDown className="csp-icon-sm" /> : <ChevronRight className="csp-icon-sm" />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div className="csp-text-muted" style={{ fontSize: '0.75rem' }}>{c.accounts.length} account{c.accounts.length !== 1 ? 's' : ''} · {c.count} line{c.count !== 1 ? 's' : ''}</div>
              </div>
              <CurrencyTotals totals={c.totals} />
            </button>
            {cOpen && (
              <div style={{ borderTop: '1px solid hsl(var(--border))' }}>
                {c.accounts.map(a => {
                  const akey = `${c.id}::${a.accountId}`;
                  const aOpen = openAccounts.has(akey);
                  return (
                    <div key={akey} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                      <button onClick={() => toggleA(akey)} style={{ ...headerBtnStyle, paddingLeft: '2.5rem', paddingRight: '0.75rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                        {aOpen ? <ChevronDown className="csp-icon-sm" /> : <ChevronRight className="csp-icon-sm" />}
                        <div style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>{a.accountName}</div>
                        <div className="csp-text-muted" style={{ fontSize: '0.75rem' }}>{a.months.length} month{a.months.length !== 1 ? 's' : ''}</div>
                        <CurrencyTotals totals={a.totals} />
                      </button>
                      {aOpen && (
                        <div style={{ paddingLeft: '4rem', paddingRight: '0.75rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', background: 'hsl(var(--background) / 0.4)' }}>
                          {a.months.map(mo => (
                            <div key={mo.monthKey} style={{ border: '1px solid hsl(var(--border))', borderRadius: 6, marginBottom: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.375rem 0.75rem', background: 'hsl(var(--muted) / 0.3)', borderBottom: '1px solid hsl(var(--border))' }}>
                                <span className="csp-text-muted" style={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{fmtMonth(mo.monthKey)}</span>
                                <CurrencyTotals totals={mo.totals} />
                              </div>
                              {mo.items.map((r, idx) => (
                                <div key={`${r.invoice.id}-${idx}`} onClick={() => onOpen(r.invoice)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0.375rem 0.75rem', fontSize: '0.75rem', cursor: 'pointer', borderTop: '1px solid hsl(var(--border))' }}>
                                  <span className="csp-td-mono" style={{ width: 110, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.invoice.invoiceNumber}</span>
                                  <span className="csp-text-muted" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.invoice.contractNumber || '—'}</span>
                                  <span style={{ width: 110, flexShrink: 0 }}>{r.invoice.invoiceDate ? formatDate(r.invoice.invoiceDate) : '—'}</span>
                                  <span style={{ width: 110, flexShrink: 0, textAlign: 'right', fontWeight: 500 }}>{formatCurrency(r.lineAmount, r.invoice.currencyCode)}</span>
                                  <span style={{ width: 90, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}><StatusBadge status={r.invoice.status} /></span>
                                </div>
                              ))}
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
