import { useState } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { bankStatements } from '@/data/mock-data';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';

export default function BankReconciliationPage() {
  const [selectedStatement, setSelectedStatement] = useState(bankStatements[0]);

  const lines = selectedStatement?.lines || [];
  const totalCredits = lines.reduce((s, l) => s + (l.credit || 0), 0);
  const totalDebits = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const matched = lines.filter(l => l.reconciled).length;
  const matchPct = lines.length > 0 ? Math.round((matched / lines.length) * 100) : 0;

  return (
    <div>
      <PageHeader title="Bank Reconciliation" action={<Button onClick={() => toast.success('Smart matching complete — 2 transactions matched')}>Smart Match</Button>} />

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total Credits</p><p className="text-xl font-bold text-emerald-600">{formatCurrency(totalCredits, 'EUR')}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total Debits</p><p className="text-xl font-bold text-red-600">{formatCurrency(totalDebits, 'EUR')}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Matched</p><p className="text-xl font-bold">{matchPct}%</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Unmatched</p><p className="text-xl font-bold">{lines.length - matched}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Left: statements */}
        <div className="col-span-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Statements</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {bankStatements.map(bs => (
                <button key={bs.id} onClick={() => setSelectedStatement(bs)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedStatement?.id === bs.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                  <p className="font-medium">{formatDate(bs.periodStart)} — {formatDate(bs.periodEnd)}</p>
                  <p className="text-xs opacity-80">{bs.lines.length} transactions</p>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right: transaction lines */}
        <div className="col-span-9">
          <div className="rounded-lg border">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead>Matched</TableHead><TableHead>Reconciled</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {lines.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>{formatDate(l.transactionDate)}</TableCell>
                    <TableCell className="text-sm">{l.reference}</TableCell>
                    <TableCell className="text-right">{l.debit ? formatCurrency(l.debit, 'EUR') : '—'}</TableCell>
                    <TableCell className="text-right">{l.credit ? formatCurrency(l.credit, 'EUR') : '—'}</TableCell>
                    <TableCell>{l.explanation || <span className="text-muted-foreground text-xs">Unmatched</span>}</TableCell>
                    <TableCell><Badge variant={l.reconciled ? 'default' : 'outline'} className="text-xs">{l.reconciled ? 'Yes' : 'No'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
