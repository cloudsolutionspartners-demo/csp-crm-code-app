import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader, StatusBadge } from '../components/Shared';
import { ToggleGroup, ToggleGroupItem, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import {
  ColumnFilters, TextFilterPopover, MultiSelectFilterPopover, DateRangeFilterPopover, NumberRangeFilterPopover, ClearColumnFiltersButton,
  getTextFilter, getMultiFilter, getDateFilter, getNumberFilter, setTextFilter, setMultiFilter, setDateFilter, setNumberFilter,
  matchDateRange,
} from '../components/ColumnFilters';
import { leaveRequests, getContactById } from '../data/mock-data';
import type { LeaveStatus, LeaveType } from '../types/crm';

const leaveStatuses: LeaveStatus[] = ['Pending', 'Approved', 'Rejected'];
const leaveTypes: LeaveType[] = ['Annual Leave', 'Sick Leave', 'Personal Leave', 'Public Holiday'];

export default function LeavePage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return leaveRequests.filter(lr => {
      if (statusFilter && lr.status !== statusFilter) return false;
      if (typeFilter && lr.leaveType !== typeFilter) return false;
      const consultant = getTextFilter(colFilters, 'consultant');
      if (consultant) { const con = getContactById(lr.contactId); if (!con || !`${con.firstName} ${con.lastName}`.toLowerCase().includes(consultant.toLowerCase())) return false; }
      const typeCol = getMultiFilter(colFilters, 'type');
      if (typeCol.length > 0 && !typeCol.includes(lr.leaveType)) return false;
      const startRange = getDateFilter(colFilters, 'start');
      if (!matchDateRange(lr.startDate, startRange.from, startRange.to)) return false;
      const endRange = getDateFilter(colFilters, 'end');
      if (!matchDateRange(lr.endDate, endRange.from, endRange.to)) return false;
      const days = getNumberFilter(colFilters, 'days');
      if (days.min && lr.totalDays < Number(days.min)) return false;
      if (days.max && lr.totalDays > Number(days.max)) return false;
      return true;
    });
  }, [statusFilter, typeFilter, colFilters]);

  const filteredIds = filtered.map(lr => lr.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="leave requests"
        showActivate={false} showDeactivate={false}
        extraActions={selectedIds.length > 0 ? <>
          <button className="csp-btn csp-btn-primary csp-btn-sm" onClick={() => { toast.success(`${selectedIds.length} leave requests approved`); setSelectedIds([]); }}>Approve Selected</button>
          <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { toast.success(`${selectedIds.length} leave requests rejected`); setSelectedIds([]); }}>Reject Selected</button>
        </> : undefined} />
      <PageHeader title="Leave Requests" subtitle={`${filtered.length} of ${leaveRequests.length} leave requests`}
        action={<div className="csp-flex-gap-2">
          <ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />
        </div>} />

      <div className="csp-filter-bar">
        <div className="csp-filter-group">
          <span className="csp-filter-group-label">Status</span>
          <ToggleGroup value={statusFilter} onChange={setStatusFilter}>
            <ToggleGroupItem value="">All</ToggleGroupItem>
            {leaveStatuses.map(s => <ToggleGroupItem key={s} value={s}>{s}<span className="csp-toggle-count">{leaveRequests.filter(lr => lr.status === s).length}</span></ToggleGroupItem>)}
          </ToggleGroup>
        </div>
        <div className="csp-filter-group">
          <span className="csp-filter-group-label">Type</span>
          <ToggleGroup value={typeFilter} onChange={setTypeFilter}>
            <ToggleGroupItem value="">All</ToggleGroupItem>
            {leaveTypes.map(t => <ToggleGroupItem key={t} value={t}>{t}<span className="csp-toggle-count">{leaveRequests.filter(lr => lr.leaveType === t).length}</span></ToggleGroupItem>)}
          </ToggleGroup>
        </div>
      </div>

      <div className="csp-table-wrapper">
        <table className="csp-table">
          <thead>
            <tr>
              <th className="csp-th-checkbox"><Checkbox checked={allSelected} onChange={toggleAll} /></th>
              <th>Consultant <TextFilterPopover label="Consultant" value={getTextFilter(colFilters, 'consultant')} onChange={v => setTextFilter(setColFilters, 'consultant', v)} /></th>
              <th>Type <MultiSelectFilterPopover label="Type" options={leaveTypes} selected={getMultiFilter(colFilters, 'type')} onChange={v => setMultiFilter(setColFilters, 'type', v)} /></th>
              <th>Start <DateRangeFilterPopover label="Start" from={getDateFilter(colFilters, 'start').from} to={getDateFilter(colFilters, 'start').to} onChange={(from, to) => setDateFilter(setColFilters, 'start', from, to)} /></th>
              <th>End <DateRangeFilterPopover label="End" from={getDateFilter(colFilters, 'end').from} to={getDateFilter(colFilters, 'end').to} onChange={(from, to) => setDateFilter(setColFilters, 'end', from, to)} /></th>
              <th>Days <NumberRangeFilterPopover label="Days" min={getNumberFilter(colFilters, 'days').min} max={getNumberFilter(colFilters, 'days').max} onChange={(min, max) => setNumberFilter(setColFilters, 'days', min, max)} /></th>
              <th>Reason</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="csp-td-empty">No leave requests match the current filters.</td></tr>
            ) : filtered.map(lr => {
              const con = getContactById(lr.contactId);
              return (
                <tr key={lr.id}>
                  <td><Checkbox checked={selectedIds.includes(lr.id)} onChange={c => toggleOne(lr.id, c)} /></td>
                  <td>{con ? `${con.firstName} ${con.lastName}` : '\u2014'}</td>
                  <td>{lr.leaveType}</td>
                  <td>{lr.startDate}</td>
                  <td>{lr.endDate}</td>
                  <td>{lr.totalDays}</td>
                  <td>{lr.reason || '\u2014'}</td>
                  <td><StatusBadge status={lr.status} /></td>
                  <td>
                    {lr.status === 'Pending' ? (
                      <div className="csp-flex-gap-1">
                        <button className="csp-btn csp-btn-primary csp-btn-xs" onClick={() => toast.success(`Leave request approved`)}>Approve</button>
                        <button className="csp-btn csp-btn-outline csp-btn-xs" onClick={() => toast.success(`Leave request rejected`)}>Reject</button>
                      </div>
                    ) : '\u2014'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
