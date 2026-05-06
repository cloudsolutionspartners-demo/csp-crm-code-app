import * as React from 'react';
import type { ProspectStatus } from '../types/crm';
import { Clock, AlertTriangle, CheckCircle2, XCircle } from './Icons';

interface Props {
  firstContactDate: string;
  status: ProspectStatus;
  lastActivityDate?: string;
  expectedCloseDate?: string;
}

const STAGES: ProspectStatus[] = ['New', 'Contacted', 'Discussing', 'Proposal', 'Won'];

function daysBetween(from: string, to: Date): number {
  const d = new Date(from);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((to.getTime() - d.getTime()) / 86400000);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '\u2014';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ProspectAgingTimeline({ firstContactDate, status, lastActivityDate, expectedCloseDate }: Props) {
  const today = new Date();
  const ageDays = daysBetween(firstContactDate, today);
  const sinceActivity = lastActivityDate ? daysBetween(lastActivityDate, today) : ageDays;

  const isLost = status === 'Lost';
  const isWon = status === 'Won';
  const isStalled = !isWon && !isLost && sinceActivity > 14;
  const isHot = !isWon && !isLost && sinceActivity <= 7;

  const currentIdx = isWon
    ? STAGES.length - 1
    : isLost
    ? -1
    : Math.max(0, STAGES.indexOf(status));

  /* Border + background tone */
  const toneStyle: React.CSSProperties = isLost
    ? { borderColor: 'hsl(0 72% 51% / 0.4)', backgroundColor: 'hsl(0 72% 51% / 0.05)' }
    : isWon
    ? { borderColor: 'hsl(152 69% 47% / 0.4)', backgroundColor: 'hsl(152 69% 97%)' }
    : isStalled
    ? { borderColor: 'hsl(38 92% 50% / 0.5)', backgroundColor: 'hsl(38 92% 97%)' }
    : isHot
    ? { borderColor: 'hsl(var(--primary) / 0.3)', backgroundColor: 'hsl(var(--primary) / 0.05)' }
    : { borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--muted) / 0.3)' };

  /* Icon color */
  const iconColor = isLost
    ? 'hsl(0 72% 51%)'
    : isWon
    ? 'hsl(152 69% 37%)'
    : isStalled
    ? 'hsl(38 75% 40%)'
    : 'hsl(var(--primary))';

  const Icon = isLost ? XCircle : isWon ? CheckCircle2 : isStalled ? AlertTriangle : Clock;

  const headline = isLost
    ? `Lost after ${ageDays} days`
    : isWon
    ? `Won in ${ageDays} days`
    : isStalled
    ? `Stalled \u2014 ${sinceActivity} days since last activity`
    : isHot
    ? `Active \u2014 ${sinceActivity} days since last activity`
    : `${ageDays} days in pipeline \u00B7 ${sinceActivity} days since last activity`;

  return (
    <div
      style={{
        border: '1px solid',
        borderRadius: '0.375rem',
        padding: '0.75rem',
        ...toneStyle,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: iconColor, display: 'flex', flexShrink: 0 }}>
            <Icon className="csp-icon" />
          </span>
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{headline}</p>
            <p className="csp-text-muted csp-text-xs">
              First contact {formatDate(firstContactDate)}
              {expectedCloseDate ? ` \u00B7 expected close ${formatDate(expectedCloseDate)}` : ''}
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{ageDays}</p>
          <p className="csp-text-muted" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>days old</p>
        </div>
      </div>

      {/* Stage rail */}
      {!isLost && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {STAGES.map((s, i) => {
            const reached = i <= currentIdx;
            const current = i === currentIdx && !isWon;
            const barColor = reached
              ? (isWon ? 'hsl(152 69% 47%)' : 'hsl(var(--primary))')
              : 'hsl(var(--muted))';
            return (
              <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', minWidth: 0 }}>
                <div style={{ height: '0.375rem', width: '100%', borderRadius: '9999px', backgroundColor: barColor }} />
                <span
                  className={current ? 'csp-text-xs' : 'csp-text-xs csp-text-muted'}
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: current ? 600 : 400,
                    color: current ? 'hsl(var(--foreground))' : undefined,
                  }}
                >
                  {s}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {isLost && (
        <div className="csp-text-xs" style={{ color: 'hsl(0 72% 51% / 0.8)' }}>
          Marked as Lost &mdash; no further stage progression.
        </div>
      )}
    </div>
  );
}
