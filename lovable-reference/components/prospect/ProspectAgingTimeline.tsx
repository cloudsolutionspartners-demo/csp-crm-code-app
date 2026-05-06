import { differenceInDays, parseISO, format } from 'date-fns';
import type { ProspectStatus } from '@/types/crm';
import { Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  firstContactDate: string;
  status: ProspectStatus;
  lastActivityDate?: string;
  expectedCloseDate?: string;
}

const STAGES: ProspectStatus[] = ['We Reached Out', 'Customer Reached Out', 'Discussing', 'Proposal Sent', 'Won'];

function safeDate(d?: string) {
  if (!d) return null;
  try { return parseISO(d); } catch { return null; }
}

export function ProspectAgingTimeline({ firstContactDate, status, lastActivityDate, expectedCloseDate }: Props) {
  const start = safeDate(firstContactDate);
  const today = new Date();
  const ageDays = start ? differenceInDays(today, start) : 0;
  const lastAct = safeDate(lastActivityDate);
  const sinceActivity = lastAct ? differenceInDays(today, lastAct) : ageDays;

  const isLost = status === 'Lost';
  const isWon = status === 'Won';
  const isStalled = !isWon && !isLost && sinceActivity > 14;
  const isHot = !isWon && !isLost && sinceActivity <= 7;

  const currentIdx = isWon ? STAGES.length - 1 : isLost ? -1 : Math.max(0, STAGES.indexOf(status as ProspectStatus));

  const tone = isLost
    ? 'border-destructive/40 bg-destructive/5'
    : isWon
    ? 'border-emerald-400/40 bg-emerald-50 dark:bg-emerald-950/20'
    : isStalled
    ? 'border-amber-400/50 bg-amber-50 dark:bg-amber-950/20'
    : isHot
    ? 'border-primary/30 bg-primary/5'
    : 'border-border bg-muted/30';

  const Icon = isLost ? XCircle : isWon ? CheckCircle2 : isStalled ? AlertTriangle : Clock;
  const iconTone = isLost
    ? 'text-destructive'
    : isWon
    ? 'text-emerald-600 dark:text-emerald-400'
    : isStalled
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-primary';

  const headline = isLost
    ? `Lost after ${ageDays} days`
    : isWon
    ? `Won in ${ageDays} days`
    : isStalled
    ? `Stalled — ${sinceActivity} days since last activity`
    : isHot
    ? `Active — ${sinceActivity} days since last activity`
    : `${ageDays} days in pipeline · ${sinceActivity} days since last activity`;

  return (
    <div className={`rounded-md border p-3 ${tone}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconTone}`} />
          <div>
            <p className="text-sm font-semibold">{headline}</p>
            <p className="text-xs text-muted-foreground">
              First contact {start ? format(start, 'MMM d, yyyy') : '—'}
              {expectedCloseDate ? ` · expected close ${format(parseISO(expectedCloseDate), 'MMM d, yyyy')}` : ''}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold leading-none tabular-nums">{ageDays}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">days old</p>
        </div>
      </div>

      {/* Stage rail */}
      {!isLost && (
        <div className="flex items-center gap-1">
          {STAGES.map((s, i) => {
            const reached = i <= currentIdx;
            const current = i === currentIdx && !isWon;
            return (
              <div key={s} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div className={`h-1.5 w-full rounded-full ${reached ? (isWon ? 'bg-emerald-500' : 'bg-primary') : 'bg-muted'}`} />
                <span className={`text-[10px] truncate w-full text-center ${current ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {isLost && (
        <div className="text-xs text-destructive/80">Marked as Lost — no further stage progression.</div>
      )}
    </div>
  );
}
