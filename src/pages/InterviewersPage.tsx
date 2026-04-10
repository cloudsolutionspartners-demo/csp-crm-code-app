import * as React from 'react';
import { useState, useMemo } from 'react';
import { PageHeader } from '../components/Shared';
import { Sheet, Checkbox, useToast, HeaderSelectionBar } from '../components/Layout';
import { TextField } from '../components/FormFields';
import { cn } from '../lib/utils';
import {
  ColumnFilters, TextFilterPopover, ClearColumnFiltersButton,
  getTextFilter, setTextFilter,
} from '../components/ColumnFilters';
import { contacts, availabilitySlots } from '../data/mock-data';
import type { Contact } from '../types/crm';

export default function InterviewersPage() {
  const { toast } = useToast();
  const [colFilters, setColFilters] = useState<ColumnFilters>({});
  const [selectedInterviewer, setSelectedInterviewer] = useState<Contact | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const interviewers = useMemo(() => contacts.filter(c => c.isInterviewer), []);

  const slotCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    availabilitySlots.forEach(s => {
      if (s.interviewerId) {
        counts[s.interviewerId] = (counts[s.interviewerId] || 0) + 1;
      }
    });
    return counts;
  }, []);

  const openForm = (interviewer: Contact) => {
    setSelectedInterviewer(interviewer);
    setFormData({
      firstName: interviewer.firstName, lastName: interviewer.lastName,
      email: interviewer.email, phone: interviewer.phone || '',
      jobRole: interviewer.jobRole || '', country: interviewer.country || '',
    });
  };

  const closeForm = () => setSelectedInterviewer(null);

  const saveForm = () => {
    const name = `${formData.firstName} ${formData.lastName}`.trim();
    toast.success(`Interviewer "${name}" saved`);
    closeForm();
  };

  const filtered = useMemo(() => {
    return interviewers.filter(c => {
      const name = getTextFilter(colFilters, 'name');
      if (name && !`${c.firstName} ${c.lastName}`.toLowerCase().includes(name.toLowerCase())) return false;
      const email = getTextFilter(colFilters, 'email');
      if (email && !c.email.toLowerCase().includes(email.toLowerCase())) return false;
      const role = getTextFilter(colFilters, 'role');
      if (role && !(c.jobRole || '').toLowerCase().includes(role.toLowerCase())) return false;
      return true;
    });
  }, [interviewers, colFilters]);

  const filteredIds = filtered.map(c => c.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? filteredIds : []);
  const toggleOne = (id: string, checked: boolean) => setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(x => x !== id));

  return (
    <div>
      <HeaderSelectionBar count={selectedIds.length} onClearSelection={() => setSelectedIds([])} entityLabel="interviewers" />
      <PageHeader title="Interviewers" subtitle={`${filtered.length} of ${interviewers.length} interviewers`}
        action={<ClearColumnFiltersButton filters={colFilters} setFilters={setColFilters} />} />

      <div className="csp-table-wrapper">
        <table className="csp-table">
          <thead>
            <tr>
              <th className="csp-th-checkbox"><Checkbox checked={allSelected} onChange={toggleAll} /></th>
              <th>Name <TextFilterPopover label="Name" value={getTextFilter(colFilters, 'name')} onChange={v => setTextFilter(setColFilters, 'name', v)} /></th>
              <th>Email <TextFilterPopover label="Email" value={getTextFilter(colFilters, 'email')} onChange={v => setTextFilter(setColFilters, 'email', v)} /></th>
              <th>Role <TextFilterPopover label="Role" value={getTextFilter(colFilters, 'role')} onChange={v => setTextFilter(setColFilters, 'role', v)} /></th>
              <th>Country</th>
              <th>Assigned Slots</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="csp-td-empty">No interviewers match the current filters.</td></tr>
            ) : filtered.map(interviewer => (
              <tr key={interviewer.id} className="csp-tr-clickable" onClick={() => openForm(interviewer)}>
                <td onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.includes(interviewer.id)} onChange={c => toggleOne(interviewer.id, c)} /></td>
                <td className="csp-td-bold">{interviewer.firstName} {interviewer.lastName}</td>
                <td>{interviewer.email}</td>
                <td>{interviewer.jobRole || '\u2014'}</td>
                <td>{interviewer.country || '\u2014'}</td>
                <td>
                  <span className="csp-badge">{slotCounts[interviewer.id] || 0}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selectedInterviewer} onClose={closeForm}>
        {selectedInterviewer && (
          <>
            <div className="csp-sheet-header">
              <div className="csp-sheet-title">{formData.firstName} {formData.lastName}</div>
            </div>
            <div className="csp-form-grid-2">
              <TextField label="First Name" value={formData.firstName} onChange={() => {}} readOnly />
              <TextField label="Last Name" value={formData.lastName} onChange={() => {}} readOnly />
              <TextField label="Email" value={formData.email} onChange={() => {}} readOnly />
              <TextField label="Phone" value={formData.phone || '\u2014'} onChange={() => {}} readOnly />
              <TextField label="Job Role" value={formData.jobRole || '\u2014'} onChange={() => {}} readOnly />
              <TextField label="Country" value={formData.country || '\u2014'} onChange={() => {}} readOnly />
            </div>
            <div className="csp-mt-4">
              <p className="csp-text-muted csp-text-sm">
                Availability calendar is managed on the Availability page. This interviewer has {slotCounts[selectedInterviewer.id] || 0} assigned slot(s).
              </p>
            </div>
            <div className="csp-form-footer">
              <button className="csp-btn csp-btn-outline" onClick={closeForm}>Close</button>
              <button className="csp-btn csp-btn-primary" onClick={saveForm}>Save</button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
