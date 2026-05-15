import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared';
import { corporateActions as seedActions } from '@/data/mock-data';
import type { CorporateAction, CorporateActionPriority, CorporateActionStatus } from '@/types/crm';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, Sparkles, AlertTriangle, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';

const STATUSES: CorporateActionStatus[] = ['New', 'In Progress', 'Closed', 'Cancelled'];

const STATUS_STYLES: Record<CorporateActionStatus, { ring: string; bar: string; chip: string; glow: string }> = {
  'New':         { ring: 'ring-sky-200',    bar: 'from-sky-500 to-sky-400',           chip: 'bg-sky-100 text-sky-800',       glow: 'shadow-[0_0_0_1px_hsl(var(--border))]' },
  'In Progress': { ring: 'ring-amber-200',  bar: 'from-amber-500 to-orange-400',      chip: 'bg-amber-100 text-amber-800',   glow: 'shadow-[0_0_0_1px_hsl(var(--border))]' },
  'Closed':      { ring: 'ring-emerald-200',bar: 'from-emerald-500 to-emerald-400',   chip: 'bg-emerald-100 text-emerald-800', glow: 'shadow-[0_0_0_1px_hsl(var(--border))]' },
  'Cancelled':   { ring: 'ring-slate-200',  bar: 'from-slate-500 to-slate-400',       chip: 'bg-slate-200 text-slate-700',   glow: 'shadow-[0_0_0_1px_hsl(var(--border))]' },
};

const PRIORITY_META: Record<CorporateActionPriority, { emoji: string; label: string; ring: string; bg: string; text: string }> = {
  Low:    { emoji: '🧊', label: 'Low',    ring: 'ring-sky-300',     bg: 'bg-sky-50',     text: 'text-sky-700' },
  Medium: { emoji: '🚨', label: 'Medium', ring: 'ring-amber-300',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  High:   { emoji: '🔥', label: 'High',   ring: 'ring-rose-300',    bg: 'bg-rose-50',    text: 'text-rose-700' },
};

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function dueLabel(action: CorporateAction): { text: string; tone: string } | null {
  if (!action.dueDate) return null;
  const closed = action.status === 'Closed' || action.status === 'Cancelled';
  const days = daysUntil(action.dueDate)!;
  if (closed) return { text: formatDate(action.dueDate), tone: 'text-muted-foreground' };
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, tone: 'text-rose-700 font-semibold' };
  if (days === 0) return { text: 'Due today', tone: 'text-amber-700 font-semibold' };
  if (days <= 3) return { text: `Due in ${days}d`, tone: 'text-amber-700 font-medium' };
  return { text: formatDate(action.dueDate), tone: 'text-muted-foreground' };
}

export default function Dashboard() {
  const [actions, setActions] = useState<CorporateAction[]>(() => [...seedActions]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<CorporateActionStatus | null>(null);

  const grouped = useMemo(() => {
    const g: Record<CorporateActionStatus, CorporateAction[]> = {
      'New': [], 'In Progress': [], 'Closed': [], 'Cancelled': [],
    };
    const now = new Date();
    const ym = (d: Date) => d.getFullYear() * 12 + d.getMonth();
    const currentYm = ym(now);
    for (const a of actions) {
      if (a.status === 'Closed') {
        const m = new Date(a.modifiedAt);
        if (ym(m) !== currentYm) continue;
      }
      g[a.status].push(a);
    }
    return g;
  }, [actions]);

  const moveTo = (id: string, status: CorporateActionStatus) => {
    const action = actions.find(a => a.id === id);
    if (!action) return;
    if (status === 'Cancelled' && !action.closingComments?.trim()) {
      toast.error('Closing Comments required before cancelling.');
      setOpenId(id);
      return;
    }
    setActions(prev => prev.map(a => a.id === id ? { ...a, status, modifiedAt: new Date().toISOString() } : a));
    toast.success(`Moved to ${status}`);
  };

  const updateAction = (id: string, patch: Partial<CorporateAction>) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, ...patch, modifiedAt: new Date().toISOString() } : a));
  };

  const open = actions.find(a => a.id === openId) || null;

  return (
    <div>
      <PageHeader
        title="Corporate Actions"
        subtitle="AI-surfaced things to do — keep the operation tidy, leave a trail."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUSES.map(status => {
          const items = grouped[status];
          const styles = STATUS_STYLES[status];
          const isDragOver = dragOver === status;
          return (
            <div
              key={status}
              onDragOver={(e) => { e.preventDefault(); setDragOver(status); }}
              onDragLeave={() => setDragOver(prev => prev === status ? null : prev)}
              onDrop={() => { if (draggedId) moveTo(draggedId, status); setDraggedId(null); setDragOver(null); }}
              className={cn(
                'flex flex-col rounded-xl border bg-muted/20 transition-all',
                isDragOver && 'ring-2 ring-primary/40 bg-primary/5'
              )}
            >
              <div className="px-3 pt-3">
                <div className={cn('h-1.5 w-full rounded-full bg-gradient-to-r', styles.bar)} />
              </div>
              <div className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{status}</span>
                  <span className={cn('text-[11px] rounded-full px-2 py-0.5 font-medium', styles.chip)}>{items.length}</span>
                </div>
              </div>
              <div className="flex-1 px-2 pb-2 space-y-2 min-h-[60vh]">
                {items.map(a => (
                  <ActionCard
                    key={a.id}
                    action={a}
                    onClick={() => setOpenId(a.id)}
                    onDragStart={() => setDraggedId(a.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOver(null); }}
                  />
                ))}
                {items.length === 0 && (
                  <div className="text-[11px] text-muted-foreground/60 text-center py-6 border border-dashed rounded-md">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ActionSheet
        action={open}
        onClose={() => setOpenId(null)}
        onSave={(patch) => {
          if (!open) return false;
          if (patch.status === 'Cancelled' && !patch.closingComments?.trim()) {
            toast.error('Closing Comments required before cancelling.');
            return false;
          }
          updateAction(open.id, patch);
          toast.success('Changes saved');
          setOpenId(null);
          return true;
        }}
      />
    </div>
  );
}

function KpiPill({ icon, label, value, tone }: { icon?: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
      {icon && <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', tone)}>{icon}</div>}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

function ActionCard({
  action, onClick, onDragStart, onDragEnd,
}: {
  action: CorporateAction;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const p = PRIORITY_META[action.priority];
  const due = dueLabel(action);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'group rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing',
        'hover:shadow-md hover:border-primary/40 transition'
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className={cn(
          'shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-lg ring-1',
          p.bg, p.ring
        )} title={`${p.label} priority`}>
          {p.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug line-clamp-3">{action.actionSummarizedTitle}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className={cn('text-[10px] rounded px-1.5 py-0.5 font-medium', p.bg, p.text)}>
              {p.label}
            </span>
            {due && (
              <span className={cn('inline-flex items-center gap-1 text-[11px]', due.tone)}>
                <Calendar className="h-3 w-3" />{due.text}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionSheet({
  action, onClose, onSave,
}: {
  action: CorporateAction | null;
  onClose: () => void;
  onSave: (patch: { status: CorporateActionStatus; closingComments?: string }) => boolean;
}) {
  const [draftStatus, setDraftStatus] = useState<CorporateActionStatus>('New');
  const [draftComments, setDraftComments] = useState('');

  // Reset draft when opening a different action.
  useEffect(() => {
    if (action) {
      setDraftStatus(action.status);
      setDraftComments(action.closingComments ?? '');
    }
  }, [action?.id]);

  if (!action) return null;
  const p = PRIORITY_META[action.priority];
  const dirty = draftStatus !== action.status || draftComments !== (action.closingComments ?? '');
  const cancelBlocked = draftStatus === 'Cancelled' && !draftComments.trim();

  const handleSave = () => {
    onSave({ status: draftStatus, closingComments: draftComments });
  };
  const handleCancel = () => {
    setDraftStatus(action.status);
    setDraftComments(action.closingComments ?? '');
    onClose();
  };

  return (
    <Sheet open={!!action} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto flex flex-col p-0">
        <div className="px-6 pt-6">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <span className={cn('h-9 w-9 rounded-lg flex items-center justify-center text-lg ring-1', p.bg, p.ring)}>{p.emoji}</span>
              <Badge variant="outline" className={cn('font-medium', p.text)}>{p.label} priority</Badge>
            </div>
            <SheetTitle className="text-left mt-2">{action.actionSummarizedTitle}</SheetTitle>
            <SheetDescription className="text-left">
              {action.dueDate ? `Due ${formatDate(action.dueDate)}` : 'No due date set'}
              {' · '}Created {formatDate(action.createdAt.slice(0, 10))}
            </SheetDescription>
          </SheetHeader>

          {/* Sticky status switcher */}
          <div className="mt-4 -mx-6 px-6 py-3 sticky top-0 z-10 bg-background/95 backdrop-blur border-y">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Status Reason</Label>
            <div className="mt-1.5 inline-flex w-full rounded-lg border bg-muted/40 p-1 gap-1">
              {STATUSES.map(s => {
                const active = draftStatus === s;
                const blocked = s === 'Cancelled' && !draftComments.trim();
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      if (blocked) {
                        toast.error('Closing Comments required to set Cancelled.');
                        return;
                      }
                      setDraftStatus(s);
                    }}
                    className={cn(
                      'flex-1 text-xs font-medium rounded-md px-2 py-1.5 transition-all',
                      active
                        ? cn(STATUS_STYLES[s].chip, 'shadow-sm ring-1 ring-border')
                        : 'text-muted-foreground hover:bg-background/80',
                      blocked && !active && 'opacity-50 cursor-not-allowed'
                    )}
                    title={blocked ? 'Add Closing Comments to enable' : `Set status to ${s}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            {cancelBlocked && (
              <p className="mt-1.5 text-[11px] text-amber-700">
                Add Closing Comments below to confirm Cancelled.
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <Lock className="h-3 w-3" />
              Action Details
              <span className="text-[10px] font-normal normal-case ml-auto text-muted-foreground/70">AI generated · read only</span>
            </Label>
            <div className="mt-1.5 rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap leading-relaxed min-h-[360px] max-h-[60vh] overflow-y-auto">
              {action.actionDetails}
            </div>
          </div>

          <div>
            <Label htmlFor="closing" className="text-xs uppercase tracking-wide text-muted-foreground">
              Closing Comments
              <span className="text-[10px] font-normal normal-case ml-2 text-muted-foreground/70">
                Required to cancel
              </span>
            </Label>
            <Textarea
              id="closing"
              className="mt-1.5 min-h-[140px]"
              placeholder="Notes on what was done, why this was cancelled, or context for the next person…"
              value={draftComments}
              onChange={(e) => setDraftComments(e.target.value)}
            />
          </div>
        </div>

        {/* Sticky footer actions */}
        <div className="border-t bg-background px-6 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSave} disabled={!dirty || cancelBlocked}>Save</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
