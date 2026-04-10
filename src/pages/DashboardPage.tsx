import * as React from 'react';
import { useState } from 'react';
import { PageHeader, KpiCard, StatusBadge } from '../components/Shared';
import { DollarSign, TrendingUp, FileText, Receipt, Clock, AlertTriangle } from '../components/Icons';
import { formatCurrency } from '../lib/utils';
import { entities, invoices, contracts, expenses, timesheets, reportingSnapshots } from '../data/mock-data';

const COLORS = ['#1e3a5f', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

// Simple Bar Chart component
function BarChart({ data, bars, height = 260 }: { data: { [key: string]: any }[]; bars: { key: string; color: string; label: string }[]; height?: number }) {
  const maxVal = Math.max(...data.flatMap(d => bars.map(b => Number(d[b.key]) || 0)));
  const barWidth = Math.floor(80 / (data.length * bars.length));
  return (
    <div className="csp-chart-container" style={{ height }}>
      <div className="csp-chart-bars">
        {data.map((d, i) => (
          <div key={i} className="csp-chart-bar-group">
            {bars.map((b, j) => {
              const val = Number(d[b.key]) || 0;
              const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
              return (
                <div key={j} className="csp-chart-bar" style={{ height: `${pct}%`, backgroundColor: b.color }} title={`${b.label}: ${val.toLocaleString()}`} />
              );
            })}
            <span className="csp-chart-bar-label">{d.label || d.month}</span>
          </div>
        ))}
      </div>
      <div className="csp-chart-legend">
        {bars.map((b, i) => (
          <span key={i} className="csp-chart-legend-item">
            <span className="csp-chart-legend-dot" style={{ backgroundColor: b.color }} />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Simple Line Chart
function LineChart({ data, dataKey, height = 200 }: { data: { [key: string]: any }[]; dataKey: string; height?: number }) {
  const values = data.map(d => Number(d[dataKey]) || 0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 80 - 10;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="csp-chart-container" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="csp-line-chart-svg">
        <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {values.map((v, i) => {
          const x = (i / (values.length - 1)) * 100;
          const y = 100 - ((v - min) / range) * 80 - 10;
          return <circle key={i} cx={x} cy={y} r="1.5" fill="#3b82f6" />;
        })}
      </svg>
      <div className="csp-chart-x-labels">
        {data.map((d, i) => <span key={i}>{d.label || d.month}</span>)}
      </div>
    </div>
  );
}

// Donut Chart
function DonutChart({ data, height = 200 }: { data: { name: string; value: number; color: string }[]; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let cumulative = 0;
  const segments = data.map(d => {
    const start = cumulative;
    cumulative += d.value;
    return { ...d, start, end: cumulative };
  });

  return (
    <div className="csp-chart-container csp-donut-wrap" style={{ height }}>
      <svg viewBox="0 0 100 100" className="csp-donut-svg">
        {segments.map((seg, i) => {
          const startAngle = (seg.start / total) * 360 - 90;
          const endAngle = (seg.end / total) * 360 - 90;
          const largeArc = endAngle - startAngle > 180 ? 1 : 0;
          const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
          const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
          const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
          const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
          const ix1 = 50 + 20 * Math.cos((endAngle * Math.PI) / 180);
          const iy1 = 50 + 20 * Math.sin((endAngle * Math.PI) / 180);
          const ix2 = 50 + 20 * Math.cos((startAngle * Math.PI) / 180);
          const iy2 = 50 + 20 * Math.sin((startAngle * Math.PI) / 180);
          return (
            <path key={i}
              d={`M ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A 20 20 0 ${largeArc} 0 ${ix2} ${iy2} Z`}
              fill={seg.color}
            />
          );
        })}
      </svg>
      <div className="csp-donut-labels">
        {data.map((d, i) => (
          <span key={i} className="csp-chart-legend-item">
            <span className="csp-chart-legend-dot" style={{ backgroundColor: d.color }} />
            {d.name}: {d.value}
          </span>
        ))}
      </div>
    </div>
  );
}

// Horizontal Bar Chart
function HorizontalBarChart({ data, height = 200 }: { data: { name: string; value: number }[]; height?: number }) {
  const maxVal = Math.max(...data.map(d => d.value));
  return (
    <div className="csp-chart-container" style={{ height }}>
      <div className="csp-hbar-chart">
        {data.map((d, i) => (
          <div key={i} className="csp-hbar-row">
            <span className="csp-hbar-label">{d.name}</span>
            <div className="csp-hbar-track">
              <div className="csp-hbar-fill" style={{ width: `${(d.value / maxVal) * 100}%` }} title={d.value.toLocaleString()} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [countryFilter, setCountryFilter] = useState('all');

  const activeContracts = contracts.filter(c => c.status === 'Active').length;
  const overdueInvoices = invoices.filter(i => i.status === 'Overdue').length;
  const pendingTimesheets = timesheets.filter(t => t.status === 'Submitted').length;

  const filteredSnapshots = reportingSnapshots.filter(s =>
    countryFilter === 'all' || s.entityId === countryFilter
  );
  const totalRevenue = filteredSnapshots.reduce((s, r) => s + r.revenue, 0);
  const totalCosts = filteredSnapshots.reduce((s, r) => s + r.costs, 0);
  const grossProfit = totalRevenue - totalCosts;
  const marginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const revenueVsCosts = [
    { month: 'Oct', revenue: 42000, costs: 33000 },
    { month: 'Nov', revenue: 45000, costs: 35000 },
    { month: 'Dec', revenue: 52800, costs: 42086 },
    { month: 'Jan', revenue: 69080, costs: 53258 },
    { month: 'Feb', revenue: 61530, costs: 47800 },
    { month: 'Mar', revenue: 65000, costs: 50000 },
  ];

  const revenueByCountry = [
    { month: 'Oct', Romania: 25000, Bulgaria: 9000, US: 8000 },
    { month: 'Nov', Romania: 27000, Bulgaria: 9500, US: 8500 },
    { month: 'Dec', Romania: 28600, Bulgaria: 9000, US: 15200 },
    { month: 'Jan', Romania: 31460, Bulgaria: 20900, US: 16720 },
    { month: 'Feb', Romania: 30030, Bulgaria: 19950, US: 15200 },
    { month: 'Mar', Romania: 32000, Bulgaria: 21000, US: 16000 },
  ];

  const marginTrend = [
    { month: 'Oct', margin: 21.4 },
    { month: 'Nov', margin: 22.2 },
    { month: 'Dec', margin: 20.3 },
    { month: 'Jan', margin: 22.9 },
    { month: 'Feb', margin: 22.3 },
    { month: 'Mar', margin: 23.1 },
  ];

  const invoiceStatusData = [
    { name: 'Paid', value: invoices.filter(i => i.status === 'Paid').length, color: COLORS[2] },
    { name: 'Sent', value: invoices.filter(i => i.status === 'Sent').length, color: COLORS[1] },
    { name: 'Draft', value: invoices.filter(i => i.status === 'Draft').length, color: '#94a3b8' },
    { name: 'Overdue', value: invoices.filter(i => i.status === 'Overdue').length, color: COLORS[4] },
    { name: 'Cancelled', value: invoices.filter(i => i.status === 'Cancelled').length, color: '#cbd5e1' },
  ].filter(d => d.value > 0);

  const top5Contracts = contracts
    .filter(c => c.status === 'Active')
    .map(c => ({ name: c.name.split(' - ')[0], value: c.sellRate * 22 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const expiringContracts = contracts.filter(c => {
    if (!c.endDate || c.status !== 'Active') return false;
    const end = new Date(c.endDate);
    const now = new Date();
    const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 30 && diff > 0;
  });

  return (
    <div>
      <div className="csp-dashboard-header">
        <PageHeader title="Dashboard" subtitle="Overview of your business performance" />
        <div className="csp-dashboard-filters">
          <select className="csp-select csp-select-sm" value={countryFilter} onChange={e => setCountryFilter(e.target.value)}>
            <option value="all">All Countries</option>
            {entities.map(e => <option key={e.id} value={e.id}>{e.country}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="csp-kpi-grid csp-kpi-grid-7">
        <KpiCard title="Revenue" value={formatCurrency(totalRevenue, 'EUR')} icon={<DollarSign className="csp-icon-sm" />} trend={{ value: 8.2, positive: true }} />
        <KpiCard title="Costs" value={formatCurrency(totalCosts, 'EUR')} icon={<TrendingUp className="csp-icon-sm" />} />
        <KpiCard title="Gross Profit" value={formatCurrency(grossProfit, 'EUR')} trend={{ value: 12.1, positive: true }} />
        <KpiCard title="Margin %" value={`${marginPct.toFixed(1)}%`} trend={{ value: 1.5, positive: true }} />
        <KpiCard title="Active Contracts" value={String(activeContracts)} icon={<FileText className="csp-icon-sm" />} />
        <KpiCard title="Overdue Invoices" value={String(overdueInvoices)} icon={<Receipt className="csp-icon-sm" />} />
        <KpiCard title="Pending Timesheets" value={String(pendingTimesheets)} icon={<Clock className="csp-icon-sm" />} />
      </div>

      {/* Charts Row 1 */}
      <div className="csp-grid-2 csp-mb-4">
        <div className="csp-card">
          <div className="csp-card-header"><h3 className="csp-card-title">Revenue vs Costs</h3></div>
          <div className="csp-card-content">
            <BarChart data={revenueVsCosts} bars={[
              { key: 'revenue', color: '#3b82f6', label: 'Revenue' },
              { key: 'costs', color: '#1e3a5f', label: 'Costs' },
            ]} />
          </div>
        </div>
        <div className="csp-card">
          <div className="csp-card-header"><h3 className="csp-card-title">Revenue by Country</h3></div>
          <div className="csp-card-content">
            <BarChart data={revenueByCountry} bars={[
              { key: 'Romania', color: COLORS[0], label: 'Romania' },
              { key: 'Bulgaria', color: COLORS[1], label: 'Bulgaria' },
              { key: 'US', color: COLORS[2], label: 'US' },
            ]} />
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="csp-grid-3 csp-mb-4">
        <div className="csp-card">
          <div className="csp-card-header"><h3 className="csp-card-title">Margin % Trend</h3></div>
          <div className="csp-card-content">
            <LineChart data={marginTrend} dataKey="margin" />
          </div>
        </div>
        <div className="csp-card">
          <div className="csp-card-header"><h3 className="csp-card-title">Invoice Status</h3></div>
          <div className="csp-card-content">
            <DonutChart data={invoiceStatusData} />
          </div>
        </div>
        <div className="csp-card">
          <div className="csp-card-header"><h3 className="csp-card-title">Top Contracts (Monthly)</h3></div>
          <div className="csp-card-content">
            <HorizontalBarChart data={top5Contracts} />
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="csp-card">
        <div className="csp-card-header">
          <h3 className="csp-card-title csp-flex-center"><AlertTriangle className="csp-icon-sm" /> Quick Alerts</h3>
        </div>
        <div className="csp-card-content">
          <div className="csp-alerts-list">
            {overdueInvoices > 0 && (
              <div className="csp-alert-item">
                <span className="csp-badge-inline csp-badge-red">{overdueInvoices}</span>
                <span>Overdue invoices require attention</span>
              </div>
            )}
            {expiringContracts.length > 0 && (
              <div className="csp-alert-item">
                <span className="csp-badge-inline csp-badge-amber">{expiringContracts.length}</span>
                <span>Contracts expiring within 30 days</span>
              </div>
            )}
            {pendingTimesheets > 0 && (
              <div className="csp-alert-item">
                <span className="csp-badge-inline csp-badge-blue">{pendingTimesheets}</span>
                <span>Timesheets pending approval</span>
              </div>
            )}
            {overdueInvoices === 0 && expiringContracts.length === 0 && pendingTimesheets === 0 && (
              <p className="csp-text-muted">No alerts — everything looks good!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
