import * as React from 'react';
import { cn } from '../lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusColorMap: Record<string, string> = {
  Active: 'csp-badge-green',
  Paid: 'csp-badge-green',
  Approved: 'csp-badge-green',
  Fit: 'csp-badge-green',
  Available: 'csp-badge-green',
  Sent: 'csp-badge-blue',
  Submitted: 'csp-badge-blue',
  Scheduled: 'csp-badge-blue',
  Draft: 'csp-badge-slate',
  Applied: 'csp-badge-slate',
  Cancelled: 'csp-badge-slate-dim',
  Inactive: 'csp-badge-slate-dim',
  Expired: 'csp-badge-slate-dim',
  Completed: 'csp-badge-slate-dark',
  Pending: 'csp-badge-amber',
  'On Hold': 'csp-badge-amber',
  'Fully Booked': 'csp-badge-amber',
  Reviewed: 'csp-badge-amber',
  Overdue: 'csp-badge-red',
  Rejected: 'csp-badge-red',
  'Not Fit': 'csp-badge-red',
  Terminated: 'csp-badge-red-light',
  Prospect: 'csp-badge-purple',
  'Credit Note': 'csp-badge-indigo',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn('csp-status-badge', statusColorMap[status] || 'csp-badge-slate', className)}>
      {status}
    </span>
  );
}

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
}

export function KpiCard({ title, value, subtitle, icon, trend }: KpiCardProps) {
  return (
    <div className="csp-card csp-kpi-card">
      <div className="csp-kpi-header">
        <p className="csp-kpi-title">{title}</p>
        {icon && <div className="csp-kpi-icon">{icon}</div>}
      </div>
      <p className="csp-kpi-value">{value}</p>
      {(subtitle || trend) && (
        <div className="csp-kpi-footer">
          {trend && (
            <span className={trend.positive ? 'csp-trend-positive' : 'csp-trend-negative'}>
              {trend.positive ? '\u2191' : '\u2193'} {Math.abs(trend.value)}%
            </span>
          )}
          {subtitle && <span className="csp-text-muted">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="csp-page-header">
      <div>
        <h1 className="csp-page-title">{title}</h1>
        {subtitle && <p className="csp-page-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="csp-empty-state">
      {icon && <div className="csp-empty-icon">{icon}</div>}
      <h3 className="csp-empty-title">{title}</h3>
      <p className="csp-empty-description">{description}</p>
      {action && <div className="csp-empty-action">{action}</div>}
    </div>
  );
}
