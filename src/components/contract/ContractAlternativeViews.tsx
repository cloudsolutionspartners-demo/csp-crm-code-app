import * as React from 'react';
import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown } from '../Icons';
import { StatusBadge } from '../Shared';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { Contract, Account, Contact } from '../../types/crm';

type Props = {
  contracts: Contract[];
  onOpen: (c: Contract) => void;
  accounts?: Account[];
  contacts?: Contact[];
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

function ContractRow({ c, onOpen }: { c: Contract; onOpen: (c: Contract) => void }) {
  const dates = [c.startDate ? formatDate(c.startDate) : '', c.endDate ? formatDate(c.endDate) : '']
    .filter(Boolean).join(' → ') || '—';
  return (
    <div onClick={() => onOpen(c)} style={subRowStyle}>
      <span style={{ gridColumn: 'span 2', fontFamily: 'monospace', fontSize: 11 }}>{c.contractNumber}</span>
      <span style={{ gridColumn: 'span 2', fontSize: 11 }}>{c.contractType}</span>
      <span style={{ gridColumn: 'span 2', fontSize: 11 }}>{c.billingType}</span>
      <span style={{ gridColumn: 'span 3', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{dates}</span>
      <span style={{ gridColumn: 'span 2', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
        {c.sellRate != null ? formatCurrency(c.sellRate, c.sellCurrency) : '—'}
      </span>
      <span style={{ gridColumn: 'span 1', display: 'flex', justifyContent: 'flex-end' }}><StatusBadge status={c.status} /></span>
    </div>
  );
}

type Group = { id: string; title: string; subtitle: string; total: number; currency: string; items: Contract[] };

function GroupedShell({ groups, onOpen }: { groups: Group[]; onOpen: (c: Contract) => void }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(groups.slice(0, 3).map(g => g.id)));
  const toggle = (id: string) => {
    const n = new Set(openIds);
    if (n.has(id)) n.delete(id); else n.add(id);
    setOpenIds(n);
  };

  if (groups.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem 0', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}>No contracts.</div>;
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
                {g.items.map(c => <ContractRow key={c.id} c={c} onOpen={onOpen} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 1. BY ACCOUNT
export function ByAccountView({ contracts, onOpen, accounts = [] }: Props) {
  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, Contract[]>();
    contracts.forEach(c => {
      const k = c.parentAccountId || '__unknown__';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    });
    return Array.from(m.entries()).map(([id, items]) => {
      const name = id === '__unknown__'
        ? '—'
        : (accounts.find(a => a.id === id)?.name || items[0]?.parentAccountName || '—');
      const total = items.reduce((s, c) => s + (c.grossValue ?? 0), 0);
      return {
        id,
        title: name,
        subtitle: `${items.length} contract${items.length !== 1 ? 's' : ''}`,
        total,
        currency: items[0]?.sellCurrency || 'EUR',
        items: items.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')),
      };
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [contracts, accounts]);

  return <GroupedShell groups={groups} onOpen={onOpen} />;
}

// 2. BY CHILD ACCOUNT
export function ByChildAccountView({ contracts, onOpen, accounts = [] }: Props) {
  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, Contract[]>();
    contracts.forEach(c => {
      const k = c.childAccountId || '__no_child__';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    });
    return Array.from(m.entries()).map(([id, items]) => {
      const title = id === '__no_child__'
        ? '(no child account)'
        : (accounts.find(a => a.id === id)?.name || items[0]?.childAccountName || '—');
      const total = items.reduce((s, c) => s + (c.grossValue ?? 0), 0);
      return {
        id,
        title,
        subtitle: `${items.length} contract${items.length !== 1 ? 's' : ''}`,
        total,
        currency: items[0]?.sellCurrency || 'EUR',
        items: items.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')),
      };
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [contracts, accounts]);

  return <GroupedShell groups={groups} onOpen={onOpen} />;
}

// 3. BY CONTRACTOR
export function ByContractorView({ contracts, onOpen, contacts = [] }: Props) {
  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, Contract[]>();
    contracts.forEach(c => {
      const k = c.contactId || '__unknown__';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    });
    return Array.from(m.entries()).map(([id, items]) => {
      let title = '—';
      if (id !== '__unknown__') {
        const ct = contacts.find(x => x.id === id);
        title = ct ? `${ct.firstName} ${ct.lastName}` : (items[0]?.assignedToName || '—');
      }
      const total = items.reduce((s, c) => s + (c.grossValue ?? 0), 0);
      return {
        id,
        title,
        subtitle: `${items.length} contract${items.length !== 1 ? 's' : ''}`,
        total,
        currency: items[0]?.sellCurrency || 'EUR',
        items: items.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')),
      };
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [contracts, contacts]);

  return <GroupedShell groups={groups} onOpen={onOpen} />;
}
