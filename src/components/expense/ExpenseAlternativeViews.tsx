import * as React from 'react';
import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown } from '../Icons';
import { StatusBadge } from '../Shared';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { Expense, Account, Contract } from '../../types/crm';

type Props = {
  expenses: Expense[];
  onOpen: (e: Expense) => void;
  accounts?: Account[];
  contracts?: Contract[];
};

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
  gap: 12,
  padding: 12,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
};

const subRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(12, 1fr)',
  gap: 12,
  padding: '8px 16px',
  fontSize: 13,
  alignItems: 'center',
  cursor: 'pointer',
  borderTop: '1px solid hsl(var(--border))',
};

function ExpenseRow({ e, onOpen, accounts = [], contracts = [] }: {
  e: Expense; onOpen: (e: Expense) => void; accounts?: Account[]; contracts?: Contract[];
}) {
  const contract = e.contractId ? contracts.find(c => c.id === e.contractId) || null : null;
  const parent = contract ? accounts.find(a => a.id === contract.parentAccountId) || null : null;
  const child = contract?.childAccountId ? accounts.find(a => a.id === contract.childAccountId) || null : null;
  return (
    <div onClick={() => onOpen(e)} style={subRowStyle}>
      <span style={{ gridColumn: 'span 2', fontFamily: 'monospace', fontSize: 11 }}>{e.reference}</span>
      <span style={{ gridColumn: 'span 2', fontSize: 11 }}>{e.expenseType}</span>
      <span style={{ gridColumn: 'span 3', fontSize: 11 }}>
        {contract ? (
          <>
            <div style={{ fontWeight: 500 }}>{contract.contractNumber}</div>
            {parent && <div style={{ color: 'hsl(var(--muted-foreground))' }}>{parent.name}</div>}
            {child && <div style={{ color: 'hsl(var(--muted-foreground))' }}>{child.name}</div>}
          </>
        ) : <span style={{ color: 'hsl(var(--muted-foreground))' }}>{'—'}</span>}
      </span>
      <span style={{ gridColumn: 'span 2', fontSize: 11 }}>{formatDate(e.dateIssued)}</span>
      <span style={{ gridColumn: 'span 2', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(e.totalAmount, e.currencyCode)}</span>
      <span style={{ gridColumn: 'span 1', display: 'flex', justifyContent: 'flex-end' }}><StatusBadge status={e.status} /></span>
    </div>
  );
}

type Group = { id: string; title: string; subtitle: string; total: number; currency: string; items: Expense[] };

function GroupedShell({ groups, onOpen, accounts = [], contracts = [] }: {
  groups: Group[];
  onOpen: (e: Expense) => void;
  accounts?: Account[];
  contracts?: Contract[];
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(groups.slice(0, 3).map(g => g.id)));
  const toggle = (id: string) => {
    const n = new Set(openIds);
    if (n.has(id)) n.delete(id); else n.add(id);
    setOpenIds(n);
  };

  if (groups.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem 0', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}>No expenses.</div>;
  }

  return (
    <div>
      {groups.map(g => {
        const isOpen = openIds.has(g.id);
        return (
          <div key={g.id} style={cardStyle}>
            <button onClick={() => toggle(g.id)} style={headerBtnStyle}>
              {isOpen ? <ChevronDown className="csp-icon-sm" /> : <ChevronRight className="csp-icon-sm" />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{g.title}</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{g.subtitle}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Total</div>
                <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(g.total, g.currency as any)}</div>
              </div>
            </button>
            {isOpen && (
              <div>
                {g.items.map(e => <ExpenseRow key={e.id} e={e} onOpen={onOpen} accounts={accounts} contracts={contracts} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 1. BY VENDOR
export function ByVendorView({ expenses, onOpen, accounts = [], contracts = [] }: Props) {
  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, Expense[]>();
    expenses.forEach(e => {
      const k = e.accountId || '__unknown__';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    });
    return Array.from(m.entries()).map(([id, items]) => {
      const name = id === '__unknown__' ? 'Unknown' : (accounts.find(a => a.id === id)?.name || 'Unknown');
      const total = items.reduce((s, e) => s + (e.totalAmount || 0), 0);
      const paid = items.filter(e => e.status === 'Paid').length;
      return {
        id, title: name,
        subtitle: `${items.length} expense${items.length !== 1 ? 's' : ''} · ${paid} paid`,
        total,
        currency: items[0]?.currencyCode || 'EUR',
        items: items.sort((a, b) => (b.dateIssued || '').localeCompare(a.dateIssued || '')),
      };
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [expenses, accounts]);

  return <GroupedShell groups={groups} onOpen={onOpen} accounts={accounts} contracts={contracts} />;
}

// 2. BY TYPE
export function ByTypeView({ expenses, onOpen, accounts = [], contracts = [] }: Props) {
  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, Expense[]>();
    expenses.forEach(e => {
      if (!m.has(e.expenseType)) m.set(e.expenseType, []);
      m.get(e.expenseType)!.push(e);
    });
    return Array.from(m.entries()).map(([type, items]) => {
      const total = items.reduce((s, e) => s + (e.totalAmount || 0), 0);
      const paid = items.filter(e => e.status === 'Paid').length;
      return {
        id: type, title: type,
        subtitle: `${items.length} expense${items.length !== 1 ? 's' : ''} · ${paid} paid`,
        total,
        currency: items[0]?.currencyCode || 'EUR',
        items: items.sort((a, b) => (b.dateIssued || '').localeCompare(a.dateIssued || '')),
      };
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [expenses]);

  return <GroupedShell groups={groups} onOpen={onOpen} accounts={accounts} contracts={contracts} />;
}

// 3. BY CONTRACT
export function ByContractView({ expenses, onOpen, accounts = [], contracts = [] }: Props) {
  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, Expense[]>();
    expenses.forEach(e => {
      const k = e.contractId || '__no_contract__';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    });
    return Array.from(m.entries()).map(([id, items]) => {
      const total = items.reduce((s, e) => s + (e.totalAmount || 0), 0);
      let title = 'No Contract';
      let subtitle = `${items.length} expense${items.length !== 1 ? 's' : ''}`;
      if (id !== '__no_contract__') {
        const ctr = contracts.find(c => c.id === id) || null;
        const parent = ctr ? accounts.find(a => a.id === ctr.parentAccountId) || null : null;
        const child = ctr?.childAccountId ? accounts.find(a => a.id === ctr.childAccountId) || null : null;
        title = ctr?.contractNumber || 'Unknown';
        const parts = [parent?.name, child?.name].filter(Boolean).join(' › ');
        subtitle = `${parts || '—'} · ${items.length} expense${items.length !== 1 ? 's' : ''}`;
      }
      return {
        id, title, subtitle, total,
        currency: items[0]?.currencyCode || 'EUR',
        items: items.sort((a, b) => (b.dateIssued || '').localeCompare(a.dateIssued || '')),
      };
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [expenses, accounts, contracts]);

  return <GroupedShell groups={groups} onOpen={onOpen} accounts={accounts} contracts={contracts} />;
}
