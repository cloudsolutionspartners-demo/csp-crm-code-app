import * as React from 'react';
import { useState } from 'react';
import { PageHeader, StatusBadge } from '../components/Shared';
import { useToast } from '../components/Layout';
import { bankStatements } from '../data/mock-data';
import { formatCurrency, formatDate } from '../lib/utils';

export default function BankReconciliationPage() {
  const { toast } = useToast();
  const [selectedStatement, setSelectedStatement] = useState(bankStatements[0]);

  const lines = selectedStatement?.lines || [];
  const totalCredits = lines.reduce((s, l) => s + (l.credit || 0), 0);
  const totalDebits = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const matched = lines.filter(l => l.reconciled).length;
  const matchPct = lines.length > 0 ? Math.round((matched / lines.length) * 100) : 0;

  return (
    <div>
      <PageHeader title="Bank Reconciliation" action={<button className="csp-btn csp-btn-primary" onClick={() => toast.success('Smart matching complete \u2014 2 transactions matched')}>Smart Match</button>} />

      <div className="csp-kpi-grid csp-kpi-grid-4 csp-mb-6">
        <div className="csp-card"><div className="csp-card-content csp-pt-4"><p className="csp-text-muted csp-text-sm">Total Credits</p><p className="csp-text-xl csp-text-bold csp-text-green">{formatCurrency(totalCredits, 'EUR')}</p></div></div>
        <div className="csp-card"><div className="csp-card-content csp-pt-4"><p className="csp-text-muted csp-text-sm">Total Debits</p><p className="csp-text-xl csp-text-bold csp-text-red">{formatCurrency(totalDebits, 'EUR')}</p></div></div>
        <div className="csp-card"><div className="csp-card-content csp-pt-4"><p className="csp-text-muted csp-text-sm">Matched</p><p className="csp-text-xl csp-text-bold">{matchPct}%</p></div></div>
        <div className="csp-card"><div className="csp-card-content csp-pt-4"><p className="csp-text-muted csp-text-sm">Unmatched</p><p className="csp-text-xl csp-text-bold">{lines.length - matched}</p></div></div>
      </div>

      <div className="csp-bank-layout">
        <div className="csp-bank-statements">
          <div className="csp-card">
            <div className="csp-card-header"><h3 className="csp-card-title">Statements</h3></div>
            <div className="csp-card-content">
              {bankStatements.map(bs => (
                <button key={bs.id} onClick={() => setSelectedStatement(bs)}
                  className={`csp-statement-btn ${selectedStatement?.id === bs.id ? 'csp-statement-btn-active' : ''}`}>
                  <p className="csp-text-bold csp-text-sm">{formatDate(bs.periodStart)} {'\u2014'} {formatDate(bs.periodEnd)}</p>
                  <p className="csp-text-xs csp-text-muted">{bs.lines.length} transactions</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="csp-bank-transactions">
          <div className="csp-table-wrapper">
            <table className="csp-table">
              <thead><tr>
                <th>Date</th><th>Reference</th><th className="csp-text-right">Debit</th><th className="csp-text-right">Credit</th><th>Matched</th><th>Reconciled</th>
              </tr></thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.id}>
                    <td>{formatDate(l.transactionDate)}</td>
                    <td>{l.reference}</td>
                    <td className="csp-text-right">{l.debit ? formatCurrency(l.debit, 'EUR') : '\u2014'}</td>
                    <td className="csp-text-right">{l.credit ? formatCurrency(l.credit, 'EUR') : '\u2014'}</td>
                    <td>{l.explanation || <span className="csp-text-muted csp-text-xs">Unmatched</span>}</td>
                    <td><span className={`csp-status-badge ${l.reconciled ? 'csp-badge-green' : 'csp-badge-slate'}`}>{l.reconciled ? 'Yes' : 'No'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
