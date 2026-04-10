import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge } from '../components/Shared';
import { ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import {
  ColumnFilters, TextFilterPopover, NumberRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getNumberFilter, setTextFilter, setNumberFilter,
} from '../components/ColumnFilters';
import { timesheets, getContactById, getContractById } from '../data/mock-data';
import type { TimesheetStatus } from '../types/crm';

const tsStatuses: TimesheetStatus[] = ['Draft', 'Submitted', 'Approved', 'Rejected'];

export default function TimesheetsPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return timesheets.filter(t => {
      if (statusFilter && t.status !== statusFilter) return false;
      const ref = getTextFilter(colFilters, 'reference');
      if (ref && !t.reference.toLowerCase().includes(ref.toLowerCase())) return false;
      const consultant = getTextFilter(colFilters, 'consultant');
      if (consultant) { const con = getContactById(t.contactId); if (!con || !`${con.firstName} ${con.lastName}`.toLowerCase().includes(consultant.toLowerCase())) return false; }
      const contract = getTextFilter(colFilters, 'contract');
      if (contract) { const ctr = getContractById(t.contractId); if (!ctr || !ctr.contractNumber.toLowerCase().includes(contract.toLowerCase())) return false; }
      const hours = getNumberFilter(colFilters, 'hours');
      if (hours.min && t.totalHours < Number(hours.min)) return false;
      if (hours.max && t.totalHours > Number(hours.max)) return false;
      return true;
    });
  }, [statusFilter, colFilters]);

  const filteredIds = filtered.map(t => t.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="timesheets"
        showActivate={false} showDeactivate={false}
        extraActions={selectedIds.length > 0 ? <button className="csp-btn csp-btn-primary csp-btn-sm" onClick={() => { toast.success(`${selectedIds.length} timesheets approved`); setSelectedIds([]); }}>Approve Selected</button> : undefined} />
      <PageHeader title="Timesheets" subtitle={`${filtered.length} of ${timesheets.length} timesheets`}
        action={<div className="csp-flex-gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
          <button className="csp-btn csp-btn-outline" onClick={() => toast.success('Timesheets generated for next month')}>Generate Timesheets</button>
        </div>} />

      <div className="csp-filter-bar">
        <div className="csp-filter-group">
          <span className="csp-filter-group-label">Status</span>
          <ToggleGroup value={statusFilter} onChange={setStatusFilter}>
            <ToggleGroupItem value="">All</ToggleGroupItem>
            {tsStatuses.map(s => <ToggleGroupItem key={s} value={s}>{s}<span className="csp-toggle-count">{timesheets.filter(t => t.status === s).length}</span></ToggleGroupItem>)}
          </ToggleGroup>
        </div>
      </div>

      <div className="csp-table-wrapper">
        <table className="csp-table">
          <thead>
            <tr>
              <th className="csp-th-checkbox"><Checkbox checked={allSelected} onChange={toggleAll} /></th>
              <th>Reference <TextFilterPopover label="Reference" value={getTextFilter(colFilters, 'reference')} onChange={v => setTextFilter(setColFilters, 'reference', v)} /></th>
              <th>Consultant <TextFilterPopover label="Consultant" value={getTextFilter(colFilters, 'consultant')} onChange={v => setTextFilter(setColFilters, 'consultant', v)} /></th>
              <th>Contract <TextFilterPopover label="Contract" value={getTextFilter(colFilters, 'contract')} onChange={v => setTextFilter(setColFilters, 'contract', v)} /></th>
              <th>Week Start</th>
              <th>Hours <NumberRangeFilterPopover label="Hours" min={getNumberFilter(colFilters, 'hours').min} max={getNumberFilter(colFilters, 'hours').max} onChange={(min, max) => setNumberFilter(setColFilters, 'hours', min, max)} /></th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="csp-td-empty">No timesheets match the current filters.</td></tr>
            ) : filtered.map(t => {
              const con = getContactById(t.contactId);
              const ctr = getContractById(t.contractId);
              return (
                <tr key={t.id}>
                  <td><Checkbox checked={selectedIds.includes(t.id)} onChange={c => toggleOne(t.id, c)} /></td>
                  <td className="csp-td-mono">{t.reference}</td>
                  <td>{con ? `${con.firstName} ${con.lastName}` : '\u2014'}</td>
                  <td className="csp-td-mono">{ctr?.contractNumber}</td>
                  <td>{t.weekStart}</td>
                  <td>{t.totalHours}</td>
                  <td><StatusBadge status={t.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
