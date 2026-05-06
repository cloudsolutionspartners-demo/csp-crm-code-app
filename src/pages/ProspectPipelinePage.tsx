import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader } from '../components/Shared';
import { useToast } from '../components/Layout';
import { prospects as mockProspects, contacts as mockContacts } from '../data/mock-data';
import type { Prospect, ProspectStatus } from '../types/crm';

const STATUSES: ProspectStatus[] = ['New', 'Contacted', 'Discussing', 'Proposal', 'Won', 'Lost'];

const COLUMN_COLORS: Record<ProspectStatus, { bg: string; bar: string }> = {
  New: { bg: 'hsl(215, 16%, 47%)', bar: 'hsl(215, 16%, 47%)' },
  Contacted: { bg: 'hsl(217, 91%, 60%)', bar: 'hsl(217, 91%, 60%)' },
  Discussing: { bg: 'hsl(45, 93%, 47%)', bar: 'hsl(45, 93%, 47%)' },
  Proposal: { bg: 'hsl(271, 91%, 65%)', bar: 'hsl(271, 91%, 65%)' },
  Won: { bg: 'hsl(160, 84%, 39%)', bar: 'hsl(160, 84%, 39%)' },
  Lost: { bg: 'hsl(0, 84%, 60%)', bar: 'hsl(0, 84%, 60%)' },
};

export default function ProspectPipelinePage() {
  const { toast } = useToast();
  const [prospects, setProspects] = useState<Prospect[]>(() => [...mockProspects]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ProspectStatus | null>(null);

  const columns = useMemo(() => {
    const map: Record<ProspectStatus, Prospect[]> = {
      New: [], Contacted: [], Discussing: [], Proposal: [], Won: [], Lost: [],
    };
    prospects.forEach(p => {
      if (map[p.status]) map[p.status].push(p);
    });
    return map;
  }, [prospects]);

  const getOwnerName = (contactId: string) => {
    const c = mockContacts.find(ct => ct.id === contactId);
    return c ? `${c.firstName} ${c.lastName}` : '—';
  };

  const getTotals = (items: Prospect[]) => {
    const totals: Record<string, number> = {};
    items.forEach(p => {
      if (p.estimatedValue) {
        const cur = p.currencyCode || 'EUR';
        totals[cur] = (totals[cur] || 0) + p.estimatedValue;
      }
    });
    return totals;
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Critical: some browsers require setData to initiate drag
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, status: ProspectStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStatus !== status) setDragOverStatus(status);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the column (not entering a child)
    const related = e.relatedTarget as Node | null;
    if (!related || !e.currentTarget.contains(related)) {
      setDragOverStatus(null);
    }
  };

  const handleDrop = (e: React.DragEvent, status: ProspectStatus) => {
    e.preventDefault();
    // Use dataTransfer as fallback if draggedId state was lost
    const id = draggedId || e.dataTransfer.getData('text/plain');
    setDragOverStatus(null);
    setDraggedId(null);
    if (!id) return;
    const prospect = prospects.find(p => p.id === id);
    if (!prospect || prospect.status === status) return;
    setProspects(prev => prev.map(p =>
      p.id === id ? { ...p, status, lastActivityDate: new Date().toISOString().substring(0, 10) } : p
    ));
    toast.success(`"${prospect.companyName}" moved to ${status}`);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverStatus(null);
  };

  return (
    <div>
      <PageHeader title="Prospect Pipeline" subtitle="Drag prospects between stages — totals shown per column" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem', minHeight: '60vh' }}>
        {STATUSES.map(status => {
          const items = columns[status];
          const totals = getTotals(items);
          const isOver = dragOverStatus === status;
          return (
            <div
              key={status}
              onDragOver={e => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, status)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: isOver ? 'hsl(var(--primary) / 0.06)' : 'hsl(var(--card))',
                borderRadius: '0.5rem',
                border: isOver ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                overflow: 'hidden',
                transition: 'background-color 150ms, border-color 150ms',
              }}
            >
              {/* Column header */}
              <div style={{
                padding: '0.75rem',
                color: '#fff',
                backgroundColor: COLUMN_COLORS[status].bg,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{status}</span>
                  <span style={{
                    backgroundColor: 'rgba(255,255,255,0.25)',
                    borderRadius: '9999px',
                    padding: '0.125rem 0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}>{items.length}</span>
                </div>
                {Object.keys(totals).length > 0 && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', opacity: 0.9 }}>
                    {Object.entries(totals).map(([cur, val]) => (
                      <div key={cur}>{cur} {val.toLocaleString()}</div>
                    ))}
                  </div>
                )}
              </div>
              {/* Color bar */}
              <div style={{ height: '3px', backgroundColor: COLUMN_COLORS[status].bar }} />

              {/* Cards */}
              <div style={{ padding: '0.5rem', flex: 1, overflowY: 'auto', minHeight: '120px' }}>
                {items.length === 0 ? (
                  <div style={{
                    border: '2px dashed hsl(var(--border))',
                    borderRadius: '0.375rem',
                    padding: '2rem 0.5rem',
                    textAlign: 'center',
                    color: 'hsl(var(--muted-foreground))',
                    fontSize: '0.75rem',
                  }}>
                    Drop here
                  </div>
                ) : items.map(p => {
                  const isDragging = draggedId === p.id;
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={e => handleDragStart(e, p.id)}
                      onDragEnd={handleDragEnd}
                      className="csp-card"
                      style={{
                        marginBottom: '0.5rem',
                        padding: '0.625rem 0.75rem',
                        cursor: isDragging ? 'grabbing' : 'grab',
                        opacity: isDragging ? 0.4 : 1,
                        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
                        transition: 'opacity 150ms, transform 150ms, box-shadow 150ms',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '0.25rem' }}>{p.companyName}</div>
                      <div className="csp-text-muted" style={{ fontSize: '0.6875rem', marginBottom: '0.25rem' }}>
                        {[p.country, p.industry].filter(Boolean).join(' · ')}
                      </div>
                      {p.estimatedValue != null && (
                        <div style={{ fontWeight: 600, fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                          {p.currencyCode || 'EUR'} {p.estimatedValue.toLocaleString()}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="csp-text-muted" style={{ fontSize: '0.6875rem' }}>
                          {getOwnerName(p.ownerContactId)}
                        </span>
                        {p.lastActivityDate && (
                          <span className="csp-text-muted" style={{ fontSize: '0.625rem' }}>
                            {p.lastActivityDate}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
