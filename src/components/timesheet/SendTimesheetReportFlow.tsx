import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, useToast } from '../Layout';
import { SelectField, TextField, TextAreaField } from '../FormFields';
import { FileSpreadsheet, Send, Mail, Download, Loader2 } from '../Icons';
import { sendOutlookEmail, blobToBase64 } from '../invoice/sendEmail';
import { fetchAccounts } from '../../services/accountService';
import { fetchContacts } from '../../services/contactService';
import { fetchContracts } from '../../services/contractService';
import { fetchTimesheets } from '../../services/timesheetService';
import { useDataverse } from '../../services/useDataverse';
import type { Account, Contact, Contract, Timesheet } from '../../types/crm';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const currentYear = new Date().getFullYear();
const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

interface ReportRow {
  consultantName: string;
  clientName: string;
  weekStart: string;
  weekEnd: string;
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  fri: number;
  sat: number;
  sun: number;
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

export function SendTimesheetReportFlow({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { data: accounts } = useDataverse<Account>(fetchAccounts, []);
  const { data: contacts } = useDataverse<Contact>(fetchContacts, []);
  const { data: contracts } = useDataverse<Contract>(fetchContracts, []);
  const { data: timesheets } = useDataverse<Timesheet>(fetchTimesheets, []);

  const [parentAccountId, setParentAccountId] = useState<string>('');
  const [month, setMonth] = useState<string>(String(new Date().getMonth()));
  const [year, setYear] = useState<string>(String(currentYear));
  const [contactId, setContactId] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [selectedConsultantIds, setSelectedConsultantIds] = useState<Set<string>>(new Set());

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [reportBlob, setReportBlob] = useState<Blob | null>(null);
  const [reportFileName, setReportFileName] = useState('');
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);

  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendLabel, setSendLabel] = useState('');

  const parentAccountOptions = useMemo(() => {
    const ids = new Set(contracts.map(c => c.parentAccountId));
    return accounts
      .filter(a => ids.has(a.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(a => ({ value: a.id, label: a.name }));
  }, [accounts, contracts]);

  const contactOptions = useMemo(() => {
    if (!parentAccountId) return [];
    return contacts
      .filter(c => c.accountId === parentAccountId && c.contactType !== 'Consultant')
      .map(c => ({
        value: c.id,
        label: `${c.firstName} ${c.lastName} ${'—'} ${c.contactType}`,
        email: c.email,
      }));
  }, [parentAccountId, contacts]);

  const consultantOptions = useMemo(() => {
    if (!parentAccountId) return [] as { value: string; label: string }[];
    const parentContracts = contracts.filter(
      c => c.parentAccountId === parentAccountId || c.childAccountId === parentAccountId
    );
    const consultantIds = Array.from(new Set(parentContracts.map(c => c.contactId).filter(Boolean) as string[]));
    return consultantIds
      .map(id => contacts.find(c => c.id === id))
      .filter((c): c is Contact => !!c)
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
      .map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }));
  }, [parentAccountId, contracts, contacts]);

  const selectedAccount = parentAccountId ? accounts.find(a => a.id === parentAccountId) : undefined;
  const recipient = selectedAccount?.email || selectedAccount?.invoicingEmail || '';

  const buildReportRows = useCallback((): ReportRow[] => {
    if (!parentAccountId) return [];
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    const parentContractIds = new Set(
      contracts
        .filter(c => c.parentAccountId === parentAccountId || c.childAccountId === parentAccountId)
        .map(c => c.id)
    );

    const matching = timesheets.filter(ts => {
      if (!parentContractIds.has(ts.contractId)) return false;
      if (selectedConsultantIds.size > 0 && !selectedConsultantIds.has(ts.contactId)) return false;
      const start = new Date(ts.weekStart);
      const end = new Date(getWeekEnd(ts.weekStart));
      return (
        (start.getFullYear() === y && start.getMonth() === m) ||
        (end.getFullYear() === y && end.getMonth() === m)
      );
    });

    return matching.map(ts => {
      const contract = contracts.find(c => c.id === ts.contractId);
      const consultant = contacts.find(c => c.id === ts.contactId);
      const childAccount = contract?.childAccountId
        ? accounts.find(a => a.id === contract.childAccountId)
        : accounts.find(a => a.id === contract?.parentAccountId);

      const hours = [0, 0, 0, 0, 0, 0, 0];
      ts.entries.forEach(e => {
        const d = new Date(e.date);
        const start = new Date(ts.weekStart);
        const idx = Math.round((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (idx >= 0 && idx < 7) hours[idx] = e.hours;
      });

      return {
        consultantName: consultant ? `${consultant.firstName} ${consultant.lastName}` : '—',
        clientName: childAccount?.name || '—',
        weekStart: ts.weekStart,
        weekEnd: getWeekEnd(ts.weekStart),
        mon: hours[0], tue: hours[1], wed: hours[2], thu: hours[3], fri: hours[4], sat: hours[5], sun: hours[6],
      };
    }).sort((a, b) => a.weekStart.localeCompare(b.weekStart) || a.consultantName.localeCompare(b.consultantName));
  }, [parentAccountId, month, year, contracts, timesheets, contacts, accounts, selectedConsultantIds]);

  const generateExcel = (rows: ReportRow[]): Blob => {
    const aoa: (string | number)[][] = [
      ['Consultant Name', 'Client Name', 'Week Start Date', 'Week End Date', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      ...rows.map(r => [r.consultantName, r.clientName, r.weekStart, r.weekEnd, r.mon, r.tue, r.wed, r.thu, r.fri, r.sat, r.sun]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timesheets');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };

  const handleDownloadOnly = () => {
    if (!parentAccountId) return;
    const rows = buildReportRows();
    if (rows.length === 0) {
      toast.error('No timesheets found for this account in the selected period.');
      return;
    }
    const account = accounts.find(a => a.id === parentAccountId);
    if (!account) return;
    const fileName = `Timesheet_Report_${account.name.replace(/\s+/g, '_')}_${monthNames[parseInt(month, 10)]}_${year}.xlsx`;
    const blob = generateExcel(rows);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${fileName}`);
  };

  const handlePrepare = () => {
    if (!parentAccountId) return;
    const rows = buildReportRows();
    if (rows.length === 0) {
      toast.error('No timesheets found for this account in the selected period.');
      return;
    }
    const account = accounts.find(a => a.id === parentAccountId);
    if (!account) return;
    const periodLabel = `${monthNames[parseInt(month, 10)]} ${year}`;
    const fileName = `Timesheet_Report_${account.name.replace(/\s+/g, '_')}_${monthNames[parseInt(month, 10)]}_${year}.xlsx`;
    const blob = generateExcel(rows);
    setReportRows(rows);
    setReportBlob(blob);
    setReportFileName(fileName);
    setEmailSubject(`Timesheet Report ${'—'} ${account.name} ${'—'} ${periodLabel}`);
    setEmailBody(`Hi,\n\nPlease find attached the timesheet report for ${account.name} covering ${periodLabel}.\n\nKind regards,`);
    setEmailOpen(true);
  };

  const handlePreview = () => {
    if (!reportBlob) return;
    const url = URL.createObjectURL(reportBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = reportFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSend = useCallback(async () => {
    if (!emailSubject.trim() || !emailBody.trim() || !reportBlob) return;
    if (!recipient) {
      toast.error('Selected account has no email address configured.');
      return;
    }

    setSending(true);
    try {
      setSendProgress(20); setSendLabel('Preparing attachment...');
      const base64 = await blobToBase64(reportBlob);

      setSendProgress(50); setSendLabel(`Sending email via Outlook to ${recipient}...`);
      await sendOutlookEmail({
        to: recipient,
        cc: contactEmail || undefined,
        subject: emailSubject,
        htmlBody: `<p>${emailBody.replace(/\n/g, '<br/>')}</p>`,
        attachments: [{ name: reportFileName, contentBytes: base64 }],
      });

      setSendProgress(100); setSendLabel('Complete!');
      await new Promise(r => setTimeout(r, 400));
      toast.success(`Timesheet report sent to ${recipient}`);
      setSending(false); setSendProgress(0); setSendLabel('');
      setEmailOpen(false);
      onOpenChange(false);
      setParentAccountId(''); setContactId(''); setContactEmail(''); setSelectedConsultantIds(new Set()); setReportBlob(null); setReportRows([]);
    } catch (error: any) {
      console.error('[SendTimesheetReport] Send failed:', error);
      setSending(false); setSendProgress(0); setSendLabel('');
      toast.error(`Failed to send: ${error?.message || 'Unknown error'}`);
    }
  }, [emailSubject, emailBody, reportBlob, reportFileName, recipient, contactEmail, onOpenChange, toast]);

  const prepareDisabled = !parentAccountId;
  const sendDisabled = !emailSubject.trim() || !emailBody.trim();

  return (
    <>
      {/* Step 1: Selection dialog */}
      <Dialog open={open && !emailOpen} onClose={() => onOpenChange(false)} title="Send Timesheet Report" maxWidth="42rem">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SelectField
            label="Parent Account"
            value={parentAccountId}
            onChange={v => { setParentAccountId(v); setContactId(''); setContactEmail(''); setSelectedConsultantIds(new Set()); }}
            options={parentAccountOptions}
            placeholder="Select a parent account..."
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <SelectField
              label="Month"
              value={month}
              onChange={setMonth}
              options={monthNames.map((n, i) => ({ value: String(i), label: n }))}
              required
            />
            <SelectField
              label="Year"
              value={year}
              onChange={setYear}
              options={yearOptions.map(y => ({ value: String(y), label: String(y) }))}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 6 }}>
              Consultants
            </label>
            <div style={{ borderRadius: 6, border: '1px solid hsl(var(--border))', maxHeight: 192, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4, backgroundColor: 'hsl(var(--background))' }}>
              {!parentAccountId ? (
                <div style={{ padding: '8px 10px', fontSize: 12, color: 'hsl(var(--muted-foreground))', textAlign: 'center' }}>
                  Select a parent account first
                </div>
              ) : consultantOptions.length === 0 ? (
                <div style={{ padding: '8px 10px', fontSize: 12, color: 'hsl(var(--muted-foreground))', textAlign: 'center' }}>
                  No consultants assigned to this account.
                </div>
              ) : (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={selectedConsultantIds.size === consultantOptions.length && consultantOptions.length > 0}
                      onChange={e => {
                        if (e.target.checked) setSelectedConsultantIds(new Set(consultantOptions.map(o => o.value)));
                        else setSelectedConsultantIds(new Set());
                      }}
                      style={{ width: 16, height: 16 }}
                    />
                    <span style={{ fontWeight: 500 }}>All consultants</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{consultantOptions.length}</span>
                  </label>
                  <div style={{ height: 1, backgroundColor: 'hsl(var(--border))', margin: '4px 0' }} />
                  {consultantOptions.map(o => (
                    <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={selectedConsultantIds.has(o.value)}
                        onChange={e => {
                          setSelectedConsultantIds(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(o.value); else next.delete(o.value);
                            return next;
                          });
                        }}
                        style={{ width: 16, height: 16 }}
                      />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </>
              )}
            </div>
            {parentAccountId && consultantOptions.length > 0 && (
              <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
                {selectedConsultantIds.size === 0
                  ? 'No selection — report will include all consultants.'
                  : `${selectedConsultantIds.size} of ${consultantOptions.length} selected`}
              </p>
            )}
          </div>

          <div>
            <SelectField
              label="Contact (recipient on CC)"
              value={contactId}
              onChange={v => {
                setContactId(v);
                const c = contactOptions.find(o => o.value === v);
                setContactEmail(c?.email || '');
              }}
              options={contactOptions.map(o => ({ value: o.value, label: o.label }))}
              placeholder={parentAccountId ? (contactOptions.length === 0 ? 'No non-consultant contacts for this account' : 'Select a contact (optional)...') : 'Select a parent account first'}
            />
            <input
              type="email"
              placeholder="Type or override CC email address"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              style={{ marginTop: 8, width: '100%', height: 36, padding: '0 12px', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 14 }}
            />
            <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
              Pre-fills from selected contact, but you can edit or enter any email.
            </p>
          </div>

          {selectedAccount && (
            <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', borderRadius: 6, backgroundColor: 'hsl(var(--muted) / 0.4)', padding: 12 }}>
              Email will be sent to: <span style={{ fontWeight: 500, color: 'hsl(var(--foreground))' }}>{recipient || 'No email configured'}</span>
              {contactEmail && (
                <> {'·'} CC: <span style={{ fontWeight: 500, color: 'hsl(var(--foreground))' }}>{contactEmail}</span></>
              )}
            </div>
          )}
        </div>

        <div className="csp-form-footer" style={{ marginTop: '1rem' }}>
          <button className="csp-btn csp-btn-outline" onClick={() => onOpenChange(false)}>Cancel</button>
          <button className="csp-btn csp-btn-outline" disabled={!parentAccountId} onClick={handleDownloadOnly}>
            <Download className="csp-icon-inline" /> Download Only
          </button>
          <button className="csp-btn csp-btn-primary" onClick={handlePrepare} disabled={prepareDisabled}>
            <FileSpreadsheet className="csp-icon-inline" /> Generate Report
          </button>
        </div>
      </Dialog>

      {/* Step 2: Email compose dialog */}
      <Dialog open={emailOpen} onClose={() => !sending && setEmailOpen(false)} title="Compose Email" maxWidth="48rem">
        {sending ? (
          <div style={{ padding: '2rem 0' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <span style={{ color: 'hsl(var(--primary))', display: 'inline-block' }}>
                <Send className="csp-icon-lg" />
              </span>
              <p style={{ fontWeight: 500, fontSize: '0.875rem', marginTop: 8 }}>{sendLabel}</p>
            </div>
            <div style={{ height: 12, backgroundColor: 'hsl(var(--muted))', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${sendProgress}%`, height: '100%', backgroundColor: 'hsl(var(--primary))', transition: 'width 300ms' }} />
            </div>
            <p className="csp-text-muted" style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: 6 }}>{sendProgress}%</p>
          </div>
        ) : (
          <>
            <div className="csp-form-grid-2" style={{ gridTemplateColumns: '1fr' }}>
              <TextField label="To" value={recipient} onChange={() => {}} readOnly />
              <TextField label="Subject" value={emailSubject} onChange={setEmailSubject} required />
              <TextAreaField label="Body" value={emailBody} onChange={setEmailBody} rows={6} required />
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
                Attachment
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 6, border: '1px solid hsl(var(--border))', padding: 10, backgroundColor: 'hsl(var(--muted) / 0.3)' }}>
                <span style={{ color: 'hsl(142, 76%, 36%)', flexShrink: 0 }}><FileSpreadsheet className="csp-icon-inline" /></span>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reportFileName}</span>
                <span className="csp-text-muted" style={{ fontSize: '0.75rem' }}>{reportRows.length} row{reportRows.length === 1 ? '' : 's'}</span>
                <button className="csp-btn csp-btn-ghost csp-btn-sm" onClick={handlePreview}>
                  <Download className="csp-icon-inline" /> Download
                </button>
              </div>
            </div>

            <div className="csp-form-footer" style={{ marginTop: '1rem' }}>
              <button className="csp-btn csp-btn-outline" onClick={() => setEmailOpen(false)}>Back</button>
              <button className="csp-btn csp-btn-primary" disabled={sendDisabled} onClick={handleSend}>
                <Send className="csp-icon-inline" /> Send
              </button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
