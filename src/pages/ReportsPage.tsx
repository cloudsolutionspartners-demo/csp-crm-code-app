import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader } from '../components/Shared';
import { Tabs, useToast } from '../components/Layout';
import { Download } from '../components/Icons';
import { reportingSnapshots, contracts, entities, invoices, expenses, getEntityById } from '../data/mock-data';
import { formatCurrency, formatPercent } from '../lib/utils';

const ALL_COUNTRIES = ['All', ...entities.map(e => e.country)];

export default function ReportsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('revenue');
  const [countryFilter, setCountryFilter] = useState('All');

  // --- Filter snapshots by country ---
  const filteredSnapshots = useMemo(() => {
    if (countryFilter === 'All') return reportingSnapshots;
    const entityIds = entities.filter(e => e.country === countryFilter).map(e => e.id);
    return reportingSnapshots.filter(s => entityIds.includes(s.entityId));
  }, [countryFilter]);

  // --- Revenue data: aggregate by period (month/year) ---
  const revenueData = useMemo(() => {
    const map = new Map<string, { period: string; month: number; year: number; revenue: number; costs: number; grossProfit: number; marginPercent: number; invoices: number; contracts: number }>();
    filteredSnapshots.forEach(s => {
      const key = `${s.year}-${String(s.month).padStart(2, '0')}`;
      const existing = map.get(key);
      if (existing) {
        existing.revenue += s.revenue;
        existing.costs += s.costs;
        existing.grossProfit += s.grossProfit;
        existing.invoices += s.invoicesIssued;
        existing.contracts += s.activeContracts;
        existing.marginPercent = existing.revenue > 0 ? (existing.grossProfit / existing.revenue) * 100 : 0;
      } else {
        map.set(key, {
          period: key,
          month: s.month,
          year: s.year,
          revenue: s.revenue,
          costs: s.costs,
          grossProfit: s.grossProfit,
          marginPercent: s.revenue > 0 ? (s.grossProfit / s.revenue) * 100 : 0,
          invoices: s.invoicesIssued,
          contracts: s.activeContracts,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
  }, [filteredSnapshots]);

  // --- Max revenue for bar chart scaling ---
  const maxRevenue = useMemo(() => Math.max(...revenueData.map(d => d.revenue), 1), [revenueData]);

  // --- Profitability data: active contracts ---
  const profitabilityData = useMemo(() => {
    const activeContracts = contracts.filter(c => c.status === 'Active');
    if (countryFilter !== 'All') {
      const entityIds = entities.filter(e => e.country === countryFilter).map(e => e.id);
      return activeContracts.filter(c => entityIds.includes(c.entityId));
    }
    return activeContracts;
  }, [countryFilter]);

  // --- Cash flow data ---
  const cashFlowData = useMemo(() => {
    const filteredInvoices = countryFilter === 'All'
      ? invoices
      : invoices.filter(i => {
          const entity = getEntityById(i.entityId);
          return entity?.country === countryFilter;
        });
    const filteredExpenses = countryFilter === 'All'
      ? expenses
      : expenses.filter(e => {
          const entity = getEntityById(e.entityId);
          return entity?.country === countryFilter;
        });

    const unpaidInvoices = filteredInvoices.filter(i => i.status !== 'Paid' && i.status !== 'Cancelled' && i.status !== 'Credit Note');
    const unpaidExpenses = filteredExpenses.filter(e => e.status !== 'Paid' && e.status !== 'Rejected');

    const expectedInflows = unpaidInvoices.reduce((sum, i) => sum + i.total, 0);
    const expectedOutflows = unpaidExpenses.reduce((sum, e) => sum + e.totalAmount, 0);

    return { expectedInflows, expectedOutflows, unpaidInvoiceCount: unpaidInvoices.length, unpaidExpenseCount: unpaidExpenses.length };
  }, [countryFilter]);

  const handleExport = () => {
    toast.success('CSV export started. Your file will be ready shortly.');
  };

  const tabs = [
    { id: 'revenue', label: 'Revenue Report' },
    { id: 'profitability', label: 'Profitability' },
    { id: 'cashflow', label: 'Cash Flow' },
  ];

  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Financial reports and analytics"
        action={
          <div className="csp-flex-gap-2">
            <select className="csp-select" value={countryFilter} onChange={e => setCountryFilter(e.target.value)}>
              {ALL_COUNTRIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button className="csp-btn csp-btn-outline" onClick={handleExport}>
              <Download className="csp-icon-inline" /> Export CSV
            </button>
          </div>
        }
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab}>
        {activeTab === 'revenue' && (
          <div>
            {/* Bar chart */}
            <div className="csp-chart-container">
              <h3 className="csp-section-title">Monthly Revenue</h3>
              <div className="csp-bar-chart">
                {revenueData.map(d => (
                  <div key={d.period} className="csp-bar-chart-item">
                    <div className="csp-bar-chart-bar-wrapper">
                      <div
                        className="csp-bar-chart-bar csp-bar-chart-bar-revenue"
                        style={{ height: `${(d.revenue / maxRevenue) * 100}%` }}
                      />
                      <div
                        className="csp-bar-chart-bar csp-bar-chart-bar-cost"
                        style={{ height: `${(d.costs / maxRevenue) * 100}%` }}
                      />
                    </div>
                    <span className="csp-bar-chart-label">{monthNames[d.month]} {d.year}</span>
                  </div>
                ))}
              </div>
              <div className="csp-chart-legend">
                <span className="csp-legend-item"><span className="csp-legend-dot csp-legend-dot-revenue" /> Revenue</span>
                <span className="csp-legend-item"><span className="csp-legend-dot csp-legend-dot-cost" /> Costs</span>
              </div>
            </div>

            {/* Revenue table */}
            <div className="csp-table-wrapper csp-mt-4">
              <table className="csp-table">
                <thead>
                  <tr>
                    <th className="csp-th">Period</th>
                    <th className="csp-th csp-text-right">Revenue</th>
                    <th className="csp-th csp-text-right">Costs</th>
                    <th className="csp-th csp-text-right">Gross Profit</th>
                    <th className="csp-th csp-text-right">Margin %</th>
                    <th className="csp-th csp-text-right">Invoices</th>
                    <th className="csp-th csp-text-right">Contracts</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueData.map(d => (
                    <tr key={d.period} className="csp-tr">
                      <td className="csp-td">{monthNames[d.month]} {d.year}</td>
                      <td className="csp-td csp-text-right">{formatCurrency(d.revenue, 'EUR')}</td>
                      <td className="csp-td csp-text-right">{formatCurrency(d.costs, 'EUR')}</td>
                      <td className="csp-td csp-text-right">{formatCurrency(d.grossProfit, 'EUR')}</td>
                      <td className="csp-td csp-text-right">{formatPercent(d.marginPercent)}</td>
                      <td className="csp-td csp-text-right">{d.invoices}</td>
                      <td className="csp-td csp-text-right">{d.contracts}</td>
                    </tr>
                  ))}
                  {revenueData.length === 0 && (
                    <tr><td colSpan={7} className="csp-td csp-text-center csp-text-muted">No data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'profitability' && (
          <div className="csp-table-wrapper">
            <table className="csp-table">
              <thead>
                <tr>
                  <th className="csp-th">Contract</th>
                  <th className="csp-th">Country</th>
                  <th className="csp-th csp-text-right">Monthly Revenue</th>
                  <th className="csp-th csp-text-right">Monthly Cost</th>
                  <th className="csp-th csp-text-right">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {profitabilityData.map(c => {
                  const entity = getEntityById(c.entityId);
                  return (
                    <tr key={c.id} className="csp-tr">
                      <td className="csp-td">{c.contractNumber} - {c.name}</td>
                      <td className="csp-td">{entity?.country || '\u2014'}</td>
                      <td className="csp-td csp-text-right">{formatCurrency(c.sellRate, c.sellCurrency)}</td>
                      <td className="csp-td csp-text-right">{formatCurrency(c.buyRate, c.buyCurrency)}</td>
                      <td className="csp-td csp-text-right">{formatPercent(c.marginPercent)}</td>
                    </tr>
                  );
                })}
                {profitabilityData.length === 0 && (
                  <tr><td colSpan={5} className="csp-td csp-text-center csp-text-muted">No active contracts</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'cashflow' && (
          <div className="csp-card-grid csp-card-grid-2">
            <div className="csp-summary-card csp-summary-card-green">
              <div className="csp-summary-card-header">Expected Inflows</div>
              <div className="csp-summary-card-value">{formatCurrency(cashFlowData.expectedInflows, 'EUR')}</div>
              <div className="csp-summary-card-detail">{cashFlowData.unpaidInvoiceCount} unpaid invoice{cashFlowData.unpaidInvoiceCount !== 1 ? 's' : ''}</div>
            </div>
            <div className="csp-summary-card csp-summary-card-red">
              <div className="csp-summary-card-header">Expected Outflows</div>
              <div className="csp-summary-card-value">{formatCurrency(cashFlowData.expectedOutflows, 'EUR')}</div>
              <div className="csp-summary-card-detail">{cashFlowData.unpaidExpenseCount} unpaid expense{cashFlowData.unpaidExpenseCount !== 1 ? 's' : ''}</div>
            </div>
          </div>
        )}
      </Tabs>
    </div>
  );
}
