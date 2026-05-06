import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared';
import { prospects as mockProspects, getContactById } from '@/data/mock-data';
import type { Prospect, ProspectStatus } from '@/types/crm';
import { toast } from 'sonner';

const stages: ProspectStatus[] = ['We Reached Out', 'Customer Reached Out', 'Discussing', 'Proposal Sent', 'Won', 'Lost'];

const stageStyles: Record<ProspectStatus, { header: string; bar: string }> = {
  'New': { header: 'bg-slate-100 dark:bg-slate-800', bar: 'bg-slate-400' },
  'Contacted': { header: 'bg-blue-100 dark:bg-blue-950/40', bar: 'bg-blue-500' },
  'Discussing': { header: 'bg-amber-100 dark:bg-amber-950/40', bar: 'bg-amber-500' },
  'Proposal': { header: 'bg-purple-100 dark:bg-purple-950/40', bar: 'bg-purple-500' },
  'Won': { header: 'bg-emerald-100 dark:bg-emerald-950/40', bar: 'bg-emerald-500' },
  'Lost': { header: 'bg-red-100 dark:bg-red-950/40', bar: 'bg-red-500' },
  'We Reached Out': { header: 'bg-sky-100 dark:bg-sky-950/40', bar: 'bg-sky-500' },
  'Customer Reached Out': { header: 'bg-indigo-100 dark:bg-indigo-950/40', bar: 'bg-indigo-500' },
  'Proposal Sent': { header: 'bg-purple-100 dark:bg-purple-950/40', bar: 'bg-purple-500' },
};

function fmt(value?: number, ccy?: string) {
  if (!value || !ccy) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy, maximumFractionDigits: 0, notation: value >= 100000 ? 'compact' : 'standard' }).format(value);
}

export default function ProspectPipelinePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Prospect[]>([...mockProspects]);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const onDrop = (status: ProspectStatus) => {
    if (!draggedId) return;
    setItems(items.map(i => i.id === draggedId ? { ...i, status } : i));
    toast.success(`Moved to ${status}`);
    setDraggedId(null);
  };

  const ownerName = (id?: string) => {
    if (!id) return '—';
    const c = getContactById(id);
    return c ? `${c.firstName} ${c.lastName}` : '—';
  };

  return (
    <div>
      <PageHeader title="Pipeline" subtitle="Drag prospects between stages — totals shown per column" />

      <div className="grid grid-cols-6 gap-3 min-h-[60vh]">
        {stages.map(stage => {
          const inStage = items.filter(i => i.status === stage);
          const totals = inStage.reduce<Record<string, number>>((acc, p) => {
            const ccy = p.currencyCode || 'EUR';
            acc[ccy] = (acc[ccy] || 0) + (p.estimatedValue || 0);
            return acc;
          }, {});
          const styles = stageStyles[stage];
          return (
            <div
              key={stage}
              className="flex flex-col rounded-md border bg-muted/20"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(stage)}
            >
              <div className={`px-3 py-2 rounded-t-md ${styles.header}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{stage}</span>
                  <span className="text-xs bg-background/60 rounded px-1.5 py-0.5">{inStage.length}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
                  {Object.keys(totals).length === 0 ? <span>—</span> : Object.entries(totals).map(([c, v]) => (
                    <div key={c}>{fmt(v, c)}</div>
                  ))}
                </div>
              </div>
              <div className={`h-1 ${styles.bar}`} />
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {inStage.map(p => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => setDraggedId(p.id)}
                    onClick={() => navigate(`/prospecting/prospects?open=${p.id}`)}
                    className="rounded-md border bg-card p-2.5 cursor-grab active:cursor-grabbing hover:shadow-sm hover:border-primary/40 transition"
                  >
                    <p className="text-sm font-medium leading-tight">{p.companyName}</p>
                    <p className="text-[11px] text-muted-foreground">{p.country}{p.industry ? ` · ${p.industry}` : ''}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground truncate max-w-[60%]">{ownerName(p.ownerContactId)}</span>
                      <span className="font-semibold tabular-nums">{fmt(p.estimatedValue, p.currencyCode)}</span>
                    </div>
                    {p.lastActivityDate && <p className="text-[10px] text-muted-foreground mt-1">Last: {p.lastActivityDate}</p>}
                  </div>
                ))}
                {inStage.length === 0 && (
                  <div className="text-[11px] text-muted-foreground/60 text-center py-4 border border-dashed rounded">Drop here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
