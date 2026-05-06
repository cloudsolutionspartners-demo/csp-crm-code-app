import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Expense } from '@/types/crm';
import { getAccountById, getContractById } from '@/data/mock-data';
import { StatusBadge } from '@/components/shared';
import { formatCurrency, formatDate } from '@/lib/format';

type Props = {
  expenses: Expense[];
  onOpen: (e: Expense) => void;
};

// ============================================================
// Shared sub-row renderer (one expense row inside a group)
// ============================================================
function ExpenseRow({ e, onOpen }: { e: Expense; onOpen: (e: Expense) => void }) {
  const contract = e.contractId ? getContractById(e.contractId) : null;
  const parent = contract ? getAccountById(contract.parentAccountId) : null;
  const child = contract?.childAccountId ? getAccountById(contract.childAccountId) : null;
  return (
    <div onClick={() => onOpen(e)} className="grid grid-cols-12 gap-3 px-4 py-2 text-sm hover:bg-muted/30 cursor-pointer items-center">
      <span className="col-span-2 font-mono text-xs">{e.reference}</span>
      <span className="col-span-2 text-xs">{e.expenseType}</span>
      <span className="col-span-3 text-xs">
        {contract ? (
          <>
            <div className="font-medium">{contract.contractNumber}</div>
            {parent && <div className="text-muted-foreground">{parent.name}</div>}
            {child && <div className="text-muted-foreground">{child.name}</div>}
          </>
        ) : <span className="text-muted-foreground">—</span>}
      </span>
      <span className="col-span-2 text-xs">{formatDate(e.dateIssued)}</span>
      <span className="col-span-2 text-right font-medium tabular-nums">{formatCurrency(e.totalAmount, e.currencyCode)}</span>
      <span className="col-span-1 flex justify-end"><StatusBadge status={e.status} /></span>
    </div>
  );
}

// ============================================================
// Generic grouping shell
// ============================================================
function GroupedShell({
  groups, onOpen,
}: {
  groups: { id: string; title: string; subtitle: string; total: number; currency: string; items: Expense[] }[];
  onOpen: (e: Expense) => void;
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(groups.slice(0, 3).map(g => g.id)));
  const toggle = (id: string) => { const n = new Set(openIds); n.has(id) ? n.delete(id) : n.add(id); setOpenIds(n); };

  return (
    <div className="space-y-2">
      {groups.map(g => {
        const isOpen = openIds.has(g.id);
        return (
          <div key={g.id} className="rounded-lg border bg-card">
            <button onClick={() => toggle(g.id)} className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 text-left">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <div className="flex-1">
                <div className="font-semibold">{g.title}</div>
                <div className="text-xs text-muted-foreground">{g.subtitle}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-sm font-semibold tabular-nums">{formatCurrency(g.total, g.currency as any)}</div>
              </div>
            </button>
            {isOpen && (
              <div className="border-t divide-y">
                {g.items.map(e => <ExpenseRow key={e.id} e={e} onOpen={onOpen} />)}
              </div>
            )}
          </div>
        );
      })}
      {groups.length === 0 && <div className="text-center py-8 text-muted-foreground border rounded-lg">No expenses.</div>}
    </div>
  );
}

// ============================================================
// 1. BY VENDOR
// ============================================================
export function ByVendorView({ expenses, onOpen }: Props) {
  const groups = useMemo(() => {
    const m = new Map<string, Expense[]>();
    expenses.forEach(e => {
      const k = e.accountId || '__unknown__';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    });
    return Array.from(m.entries()).map(([id, items]) => {
      const name = id === '__unknown__' ? 'Unknown' : (getAccountById(id)?.name || 'Unknown');
      const total = items.reduce((s, e) => s + e.totalAmount, 0);
      const paid = items.filter(e => e.status === 'Paid').length;
      return {
        id, title: name,
        subtitle: `${items.length} expense${items.length !== 1 ? 's' : ''} · ${paid} paid`,
        total, currency: items[0]?.currencyCode || 'EUR',
        items: items.sort((a, b) => b.dateIssued.localeCompare(a.dateIssued)),
      };
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [expenses]);

  return <GroupedShell groups={groups} onOpen={onOpen} />;
}

// ============================================================
// 2. BY TYPE
// ============================================================
export function ByTypeView({ expenses, onOpen }: Props) {
  const groups = useMemo(() => {
    const m = new Map<string, Expense[]>();
    expenses.forEach(e => {
      if (!m.has(e.expenseType)) m.set(e.expenseType, []);
      m.get(e.expenseType)!.push(e);
    });
    return Array.from(m.entries()).map(([type, items]) => {
      const total = items.reduce((s, e) => s + e.totalAmount, 0);
      const paid = items.filter(e => e.status === 'Paid').length;
      return {
        id: type, title: type,
        subtitle: `${items.length} expense${items.length !== 1 ? 's' : ''} · ${paid} paid`,
        total, currency: items[0]?.currencyCode || 'EUR',
        items: items.sort((a, b) => b.dateIssued.localeCompare(a.dateIssued)),
      };
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [expenses]);

  return <GroupedShell groups={groups} onOpen={onOpen} />;
}

// ============================================================
// 3. BY CONTRACT
// ============================================================
export function ByContractView({ expenses, onOpen }: Props) {
  const groups = useMemo(() => {
    const m = new Map<string, Expense[]>();
    expenses.forEach(e => {
      const k = e.contractId || '__no_contract__';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    });
    return Array.from(m.entries()).map(([id, items]) => {
      const total = items.reduce((s, e) => s + e.totalAmount, 0);
      let title = 'No Contract';
      let subtitle = `${items.length} expense${items.length !== 1 ? 's' : ''}`;
      if (id !== '__no_contract__') {
        const ctr = getContractById(id);
        const parent = ctr ? getAccountById(ctr.parentAccountId) : null;
        const child = ctr?.childAccountId ? getAccountById(ctr.childAccountId) : null;
        title = ctr?.contractNumber || 'Unknown';
        const parts = [parent?.name, child?.name].filter(Boolean).join(' › ');
        subtitle = `${parts || '—'} · ${items.length} expense${items.length !== 1 ? 's' : ''}`;
      }
      return {
        id, title, subtitle, total,
        currency: items[0]?.currencyCode || 'EUR',
        items: items.sort((a, b) => b.dateIssued.localeCompare(a.dateIssued)),
      };
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [expenses]);

  return <GroupedShell groups={groups} onOpen={onOpen} />;
}
