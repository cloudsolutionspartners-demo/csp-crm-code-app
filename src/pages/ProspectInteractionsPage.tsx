import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge } from '../components/Shared';
import { ToggleGroup, ToggleGroupItem } from '../components/Layout';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, DateRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getDateFilter, setTextFilter, setMultiFilter, setDateFilter, matchDateRange,
} from '../components/ColumnFilters';
import {
  prospects as mockProspects, prospectInteractions as mockInteractions,
} from '../data/mock-data';
import type { InteractionType } from '../types/crm';

const INTERACTION_TYPES: InteractionType[] = ['Call', 'Email', 'Meeting', 'LinkedIn'];

// For StatusBadge coloring, we use the interaction type directly.
// The StatusBadge will render with default slate color for unmapped types.

export default function ProspectInteractionsPage() {
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [colFilters, setColFilters] = useState<ColumnFilters>({});

  const interactions = useMemo(() => {
    return [...mockInteractions].sort((a, b) => b.date.localeCompare(a.date));
  }, []);

  const getProspectName = (prospectId: string) => {
    const p = mockProspects.find(pr => pr.id === prospectId);
    return p ? p.companyName : '\u2014';
  };

  const filtered = useMemo(() => {
    return interactions.filter(i => {
      // Type toggle filter
      if (typeFilter && i.type !== typeFilter) return false;
      // Column filters
      const dateRange = getDateFilter(colFilters, 'date');
      if (!matchDateRange(i.date, dateRange.from, dateRange.to)) return false;
      const prospectText = getTextFilter(colFilters, 'prospect');
      if (prospectText && !getProspectName(i.prospectId).toLowerCase().includes(prospectText.toLowerCase())) return false;
      const typeCol = getMultiFilter(colFilters, 'type');
      if (typeCol.length > 0 && !typeCol.includes(i.type)) return false;
      const summaryText = getTextFilter(colFilters, 'summary');
      if (summaryText && !i.summary.toLowerCase().includes(summaryText.toLowerCase())) return false;
      return true;
    });
  }, [interactions, typeFilter, colFilters]);

  return (
    <div>
      <PageHeader
        title="All Interactions"
        subtitle={`${filtered.length} of ${interactions.length} interactions`}
        action={
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
        }
      />

      <div className="csp-filter-bar">
        <div className="csp-filter-group">
          <span className="csp-filter-group-label">Type</span>
          <ToggleGroup value={typeFilter} onChange={setTypeFilter}>
            <ToggleGroupItem value="">All<span className="csp-toggle-count">{interactions.length}</span></ToggleGroupItem>
            {INTERACTION_TYPES.map(t => (
              <ToggleGroupItem key={t} value={t}>{t}<span className="csp-toggle-count">{interactions.filter(i => i.type === t).length}</span></ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <div className="csp-table-wrapper">
        <table className="csp-table">
          <thead>
            <tr>
              <th>Date <DateRangeFilterPopover label="Date" from={getDateFilter(colFilters, 'date').from} to={getDateFilter(colFilters, 'date').to} onChange={(from, to) => setDateFilter(setColFilters, 'date', from, to)} /></th>
              <th>Prospect <TextFilterPopover label="Prospect" value={getTextFilter(colFilters, 'prospect')} onChange={v => setTextFilter(setColFilters, 'prospect', v)} /></th>
              <th>Type <MultiSelectFilterPopover label="Type" options={INTERACTION_TYPES} selected={getMultiFilter(colFilters, 'type')} onChange={v => setMultiFilter(setColFilters, 'type', v)} /></th>
              <th>Summary <TextFilterPopover label="Summary" value={getTextFilter(colFilters, 'summary')} onChange={v => setTextFilter(setColFilters, 'summary', v)} /></th>
              <th>Created By</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="csp-td-empty">No interactions match the current filters.</td></tr>
            ) : filtered.map(i => (
              <tr
                key={i.id}
                className="csp-tr-clickable"
                onClick={() => { /* cross-page nav not supported yet */ }}
              >
                <td>{i.date}</td>
                <td className="csp-td-bold">{getProspectName(i.prospectId)}</td>
                <td><StatusBadge status={i.type} /></td>
                <td>{i.summary}</td>
                <td>{i.createdBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
