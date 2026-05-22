import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader, PageLoading } from '../components/Shared';
import { Sheet, useToast } from '../components/Layout';
import { Calendar, AlertTriangle, KanbanSquare } from '../components/Icons';
import { cn, formatDate } from '../lib/utils';
import type { CorporateAction, CorporateActionStatus, CorporateActionPriority } from '../types/crm';
import { fetchCorporateActions, updateCorporateAction } from '../services/corporateActionService';

const STATUSES: CorporateActionStatus[] = ['New', 'In Progress', 'Closed', 'Cancelled'];

interface StatusStyle {
  bar: string;          // top bar gradient (linear-gradient)
  chipBg: string;
  chipFg: string;
  laneRing: string;
}

const STATUS_STYLES: Record<CorporateActionStatus, StatusStyle> = {
  'New':         { bar: 'linear-gradient(to right, #0ea5e9, #38bdf8)', chipBg: '#e0f2fe', chipFg: '#075985', laneRing: '#bae6fd' },
  'In Progress': { bar: 'linear-gradient(to right, #f59e0b, #fb923c)', chipBg: '#fef3c7', chipFg: '#92400e', laneRing: '#fcd34d' },
  'Closed':      { bar: 'linear-gradient(to right, #10b981, #34d399)', chipBg: '#d1fae5', chipFg: '#065f46', laneRing: '#a7f3d0' },
  'Cancelled':   { bar: 'linear-gradient(to right, #64748b, #94a3b8)', chipBg: '#e2e8f0', chipFg: '#334155', laneRing: '#cbd5e1' },
};

interface PriorityMeta {
  emoji: string;
  label: string;
  bg: string;
  ring: string;
  fg: string;
}

const PRIORITY_META: Record<CorporateActionPriority, PriorityMeta> = {
  Low:    { emoji: '🧊', label: 'Low',    bg: '#e0f2fe', ring: '#7dd3fc', fg: '#0369a1' },
  Medium: { emoji: '🚨', label: 'Medium', bg: '#fef3c7', ring: '#fcd34d', fg: '#b45309' },
  High:   { emoji: '🔥', label: 'High',   bg: '#ffe4e6', ring: '#fda4af', fg: '#be123c' },
};

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function dueLabel(action: CorporateAction): { text: string; color: string; fontWeight: number } | null {
  if (!action.dueDate) return null;
  const closed = action.status === 'Closed' || action.status === 'Cancelled';
  const days = daysUntil(action.dueDate)!;
  if (closed) return { text: formatDate(action.dueDate), color: 'hsl(var(--muted-foreground))', fontWeight: 400 };
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: '#be123c', fontWeight: 600 };
  if (days === 0) return { text: 'Due today', color: '#b45309', fontWeight: 600 };
  if (days <= 3) return { text: `Due in ${days}d`, color: '#b45309', fontWeight: 500 };
  return { text: formatDate(action.dueDate), color: 'hsl(var(--muted-foreground))', fontWeight: 400 };
}

export default function DashboardPage() {
  const { toast } = useToast();
  const [actions, setActions] = useState<CorporateAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<CorporateActionStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchCorporateActions();
        if (cancelled) return;
        console.log(`[Dashboard] Loaded ${rows.length} corporate actions from Dataverse.`);
        setActions(rows);
      } catch (err) {
        console.error('[Dashboard] Failed to load corporate actions:', err);
        if (!cancelled) {
          setActions([]);
          toast.error('Failed to load corporate actions. Please refresh.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
        if (!isNaN(m.getTime()) && ym(m) !== currentYm) continue;
      }
      g[a.status].push(a);
    }
    return g;
  }, [actions]);

  // Optimistic status mutation. Local state updates immediately; on service
  // error we revert and surface the failure via toast.
  const persistStatusChange = async (id: string, nextStatus: CorporateActionStatus, nextComments?: string) => {
    const prev = actions;
    const nowIso = new Date().toISOString();
    setActions(curr => curr.map(a => a.id === id
      ? { ...a, status: nextStatus, closingComments: nextComments !== undefined ? nextComments : a.closingComments, modifiedAt: nowIso }
      : a));
    try {
      await updateCorporateAction(id, {
        status: nextStatus,
        ...(nextComments !== undefined ? { closingComments: nextComments } : {}),
      });
    } catch (err: any) {
      console.error('[Dashboard] updateCorporateAction failed:', err);
      setActions(prev);
      toast.error(err?.message || 'Failed to save change');
      throw err;
    }
  };

  const moveTo = (id: string, status: CorporateActionStatus) => {
    const action = actions.find(a => a.id === id);
    if (!action || action.status === status) return;
    if (status === 'Cancelled' && !action.closingComments?.trim()) {
      toast.error('Closing Comments required before cancelling.');
      setOpenId(id);
      return;
    }
    persistStatusChange(id, status).then(
      () => toast.success(`Moved to ${status}`),
      () => {},
    );
  };

  const open = actions.find(a => a.id === openId) || null;

  if (loading) return <PageLoading message="Loading corporate actions..." />;

  return (
    <div>
      <PageHeader
        title="Corporate Actions"
        subtitle="AI-surfaced things to do — keep the operation tidy, leave a trail."
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '1rem',
      }}>
        {STATUSES.map(status => {
          const items = grouped[status];
          const styles = STATUS_STYLES[status];
          const isDragOver = dragOver === status;
          return (
            <div
              key={status}
              onDragOver={(e) => { e.preventDefault(); setDragOver(status); }}
              onDragLeave={() => setDragOver(prev => prev === status ? null : prev)}
              onDrop={() => {
                if (draggedId) moveTo(draggedId, status);
                setDraggedId(null);
                setDragOver(null);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 12,
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--muted) / 0.2)',
                outline: isDragOver ? '2px solid hsl(var(--primary) / 0.4)' : 'none',
                outlineOffset: -2,
                transition: 'outline 120ms ease',
              }}
            >
              <div style={{ padding: '0.75rem 0.75rem 0' }}>
                <div style={{ height: 6, width: '100%', borderRadius: 999, background: styles.bar }} />
              </div>
              <div style={{
                padding: '0.5rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{status}</span>
                  <span style={{
                    fontSize: 11,
                    borderRadius: 999,
                    padding: '1px 8px',
                    fontWeight: 500,
                    backgroundColor: styles.chipBg,
                    color: styles.chipFg,
                  }}>{items.length}</span>
                </div>
              </div>
              <div style={{
                flex: 1,
                padding: '0 0.5rem 0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                minHeight: '60vh',
              }}>
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
                  <div style={{
                    fontSize: 11,
                    color: 'hsl(var(--muted-foreground) / 0.6)',
                    textAlign: 'center',
                    padding: '1.5rem 0',
                    border: '1px dashed hsl(var(--border))',
                    borderRadius: 6,
                  }}>
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
        onSave={async (patch) => {
          if (!open) return false;
          if (patch.status === 'Cancelled' && !patch.closingComments?.trim()) {
            toast.error('Closing Comments required before cancelling.');
            return false;
          }
          try {
            await persistStatusChange(open.id, patch.status, patch.closingComments ?? '');
            toast.success('Changes saved');
            setOpenId(null);
            return true;
          } catch {
            return false;
          }
        }}
      />
    </div>
  );
}

interface ActionCardProps {
  action: CorporateAction;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function ActionCard({ action, onClick, onDragStart, onDragEnd }: ActionCardProps) {
  const p = PRIORITY_META[action.priority];
  const due = dueLabel(action);
  const [hover, setHover] = useState(false);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: 8,
        border: `1px solid ${hover ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--border))'}`,
        backgroundColor: 'hsl(var(--card))',
        padding: 12,
        cursor: 'grab',
        boxShadow: hover ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
        transition: 'box-shadow 120ms ease, border-color 120ms ease',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          title={`${p.label} priority`}
          style={{
            flexShrink: 0,
            height: 36,
            width: 36,
            borderRadius: 8,
            backgroundColor: p.bg,
            boxShadow: `inset 0 0 0 1px ${p.ring}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          {p.emoji}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            fontSize: '0.875rem',
            fontWeight: 500,
            lineHeight: 1.35,
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          } as React.CSSProperties}>
            {action.actionSummarizedTitle}
          </p>
          <div style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}>
            <span style={{
              fontSize: 10,
              borderRadius: 4,
              padding: '1px 6px',
              fontWeight: 500,
              backgroundColor: p.bg,
              color: p.fg,
            }}>{p.label}</span>
            {due && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                color: due.color,
                fontWeight: due.fontWeight,
              }}>
                <Calendar className="csp-icon-inline" />{due.text}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ActionSheetProps {
  action: CorporateAction | null;
  onClose: () => void;
  onSave: (patch: { status: CorporateActionStatus; closingComments?: string }) => Promise<boolean>;
}

function ActionSheet({ action, onClose, onSave }: ActionSheetProps) {
  const { toast } = useToast();
  const [draftStatus, setDraftStatus] = useState<CorporateActionStatus>('New');
  const [draftComments, setDraftComments] = useState('');
  const [saving, setSaving] = useState(false);

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

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({ status: draftStatus, closingComments: draftComments });
    } finally {
      setSaving(false);
    }
  };
  const handleCancel = () => {
    setDraftStatus(action.status);
    setDraftComments(action.closingComments ?? '');
    onClose();
  };

  return (
    <Sheet open={!!action} onClose={handleCancel} width="640px">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ padding: '1.5rem 1.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              height: 36,
              width: 36,
              borderRadius: 8,
              backgroundColor: p.bg,
              boxShadow: `inset 0 0 0 1px ${p.ring}`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}>{p.emoji}</span>
            <span className="csp-badge-outline" style={{ color: p.fg, fontWeight: 500 }}>{p.label} priority</span>
          </div>
          <h2 style={{ margin: '0.5rem 0 0', fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.3 }}>
            {action.actionSummarizedTitle}
          </h2>
          <p className="csp-text-muted" style={{ fontSize: '0.8125rem', marginTop: 4 }}>
            {action.dueDate ? `Due ${formatDate(action.dueDate)}` : 'No due date set'}
            {' · '}Created {formatDate(action.createdAt.slice(0, 10))}
          </p>
        </div>

        {/* Sticky status switcher */}
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem 1.5rem',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'hsl(var(--background) / 0.95)',
          backdropFilter: 'blur(6px)',
          borderTop: '1px solid hsl(var(--border))',
          borderBottom: '1px solid hsl(var(--border))',
        }}>
          <div style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'hsl(var(--muted-foreground))',
            marginBottom: 6,
          }}>Status Reason</div>
          <div style={{
            display: 'inline-flex',
            width: '100%',
            borderRadius: 8,
            border: '1px solid hsl(var(--border))',
            backgroundColor: 'hsl(var(--muted) / 0.4)',
            padding: 4,
            gap: 4,
          }}>
            {STATUSES.map(s => {
              const active = draftStatus === s;
              const blocked = s === 'Cancelled' && !draftComments.trim();
              const ss = STATUS_STYLES[s];
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
                  className={cn(blocked && !active && 'csp-disabled')}
                  title={blocked ? 'Add Closing Comments to enable' : `Set status to ${s}`}
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 6,
                    padding: '6px 8px',
                    border: 'none',
                    cursor: blocked && !active ? 'not-allowed' : 'pointer',
                    transition: 'all 120ms ease',
                    backgroundColor: active ? ss.chipBg : 'transparent',
                    color: active ? ss.chipFg : 'hsl(var(--muted-foreground))',
                    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.05), inset 0 0 0 1px hsl(var(--border))' : 'none',
                    opacity: blocked && !active ? 0.5 : 1,
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {cancelBlocked && (
            <p style={{ marginTop: 6, fontSize: 11, color: '#b45309', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle className="csp-icon-inline" />
              Add Closing Comments below to confirm Cancelled.
            </p>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'hsl(var(--muted-foreground))',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <LockGlyph />
              <span>Action Details</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'hsl(var(--muted-foreground) / 0.7)' }}>
                AI generated · read only
              </span>
            </div>
            <div style={{
              borderRadius: 6,
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'hsl(var(--muted) / 0.3)',
              padding: 12,
              fontSize: 14,
              whiteSpace: 'pre-wrap',
              lineHeight: 1.5,
              minHeight: 200,
              maxHeight: '40vh',
              overflowY: 'auto',
            }}>
              {action.actionDetails}
            </div>
          </div>

          <div>
            <label htmlFor="closing-comments" style={{
              display: 'block',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'hsl(var(--muted-foreground))',
              marginBottom: 6,
            }}>
              Closing Comments
              <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'hsl(var(--muted-foreground) / 0.7)' }}>
                Required to cancel
              </span>
            </label>
            <textarea
              id="closing-comments"
              value={draftComments}
              onChange={e => setDraftComments(e.target.value)}
              placeholder="Notes on what was done, why this was cancelled, or context for the next person…"
              style={{
                width: '100%',
                minHeight: 140,
                fontSize: 14,
                padding: 10,
                borderRadius: 6,
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--background))',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Sticky footer */}
        <div style={{
          borderTop: '1px solid hsl(var(--border))',
          backgroundColor: 'hsl(var(--background))',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          flexShrink: 0,
        }}>
          <button className="csp-btn csp-btn-outline" onClick={handleCancel} disabled={saving}>Cancel</button>
          <button
            className="csp-btn csp-btn-primary"
            onClick={handleSave}
            disabled={!dirty || cancelBlocked || saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

// Local "lock" glyph — small inline SVG since Icons.tsx doesn't ship one.
function LockGlyph() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// KanbanSquare is imported for future use if we want to brand the header.
// Currently unused — keeping the import wired so the sidebar's icon resolves
// the same icon module without surprise. (Tree-shaken if not referenced.)
void KanbanSquare;
