import * as React from 'react';
import { useState } from 'react';
import { PageHeader, StatusBadge } from '../components/Shared';
import { Tabs } from '../components/Layout';
import { Plus } from '../components/Icons';
import { entities, publicHolidays, exchangeRates } from '../data/mock-data';
import { formatDate } from '../lib/utils';

const UOM_DATA = [
  { name: 'Day', description: 'Standard working day (8 hours)' },
  { name: 'Hour', description: 'Hourly billing unit' },
  { name: 'Month', description: 'Full calendar month' },
  { name: 'Fixed', description: 'Fixed price / lump sum' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('countries');

  const tabs = [
    { id: 'countries', label: 'Countries' },
    { id: 'holidays', label: 'Public Holidays' },
    { id: 'uom', label: 'Units of Measure' },
    { id: 'rates', label: 'Exchange Rates' },
    { id: 'users', label: 'Users' },
  ];

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage application configuration" />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab}>
        {activeTab === 'countries' && (
          <div>
            <div className="csp-section-header csp-mb-4">
              <button className="csp-btn csp-btn-primary">
                <Plus className="csp-icon-inline" /> Add Country
              </button>
            </div>
            <div className="csp-card-grid csp-card-grid-3">
              {entities.map(entity => (
                <div key={entity.id} className="csp-card">
                  <div className="csp-card-header">
                    <h3 className="csp-card-title">{entity.country}</h3>
                    <StatusBadge status="Active" />
                  </div>
                  <div className="csp-card-body">
                    <div className="csp-detail-row">
                      <span className="csp-detail-label">Full Name</span>
                      <span className="csp-detail-value">{entity.name}</span>
                    </div>
                    <div className="csp-detail-row">
                      <span className="csp-detail-label">Currency</span>
                      <span className="csp-detail-value">{entity.baseCurrencyCode}</span>
                    </div>
                    <div className="csp-detail-row">
                      <span className="csp-detail-label">VAT</span>
                      <span className="csp-detail-value">{entity.vatNumber}</span>
                    </div>
                    <div className="csp-detail-row">
                      <span className="csp-detail-label">Bank</span>
                      <span className="csp-detail-value">{entity.bankName}</span>
                    </div>
                    <div className="csp-detail-row">
                      <span className="csp-detail-label">IBAN</span>
                      <span className="csp-detail-value csp-text-mono">{entity.iban}</span>
                    </div>
                    <div className="csp-detail-row">
                      <span className="csp-detail-label">Invoice Prefix</span>
                      <span className="csp-detail-value csp-text-mono">{entity.invoicePrefix}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'holidays' && (
          <div>
            <div className="csp-section-header csp-mb-4">
              <button className="csp-btn csp-btn-primary">
                <Plus className="csp-icon-inline" /> Add Holiday
              </button>
            </div>
            <div className="csp-table-wrapper">
              <table className="csp-table">
                <thead>
                  <tr>
                    <th className="csp-th">Name</th>
                    <th className="csp-th">Date</th>
                    <th className="csp-th">Country</th>
                    <th className="csp-th">Year</th>
                  </tr>
                </thead>
                <tbody>
                  {publicHolidays.map(h => (
                    <tr key={h.id} className="csp-tr">
                      <td className="csp-td">{h.name}</td>
                      <td className="csp-td">{formatDate(h.date)}</td>
                      <td className="csp-td"><StatusBadge status={h.country} /></td>
                      <td className="csp-td">{h.year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'uom' && (
          <div className="csp-table-wrapper">
            <table className="csp-table">
              <thead>
                <tr>
                  <th className="csp-th">Unit</th>
                  <th className="csp-th">Description</th>
                </tr>
              </thead>
              <tbody>
                {UOM_DATA.map(u => (
                  <tr key={u.name} className="csp-tr">
                    <td className="csp-td csp-td-bold">{u.name}</td>
                    <td className="csp-td">{u.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'rates' && (
          <div>
            <div className="csp-section-header csp-mb-4">
              <button className="csp-btn csp-btn-primary">
                <Plus className="csp-icon-inline" /> Add Rate
              </button>
            </div>
            <div className="csp-table-wrapper">
              <table className="csp-table">
                <thead>
                  <tr>
                    <th className="csp-th">From</th>
                    <th className="csp-th">To</th>
                    <th className="csp-th">Rate</th>
                    <th className="csp-th">Effective Date</th>
                    <th className="csp-th">Period</th>
                  </tr>
                </thead>
                <tbody>
                  {exchangeRates.map(r => (
                    <tr key={r.id} className="csp-tr">
                      <td className="csp-td">{r.fromCurrencyCode}</td>
                      <td className="csp-td">{r.toCurrencyCode}</td>
                      <td className="csp-td csp-text-mono">{r.rate.toFixed(4)}</td>
                      <td className="csp-td">{formatDate(r.effectiveDate)}</td>
                      <td className="csp-td">{String(r.month).padStart(2, '0')}/{r.year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="csp-card">
            <div className="csp-card-body">
              <p className="csp-text-muted">User management will be available when backend is connected.</p>
            </div>
          </div>
        )}
      </Tabs>
    </div>
  );
}
