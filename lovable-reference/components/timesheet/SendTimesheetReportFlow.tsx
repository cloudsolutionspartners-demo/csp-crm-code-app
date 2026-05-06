import { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

import { FileSpreadsheet, Send, Mail, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import { accounts, contacts, contracts, timesheets, getAccountById, getContactById, getContractById } from '@/data/mock-data';
import { sendOutlookEmail, blobToBase64 } from '@/components/invoice/sendEmail';

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
  // Step 1 selections
  const [parentAccountId, setParentAccountId] = useState<string>('');
  const [month, setMonth] = useState<string>(String(new Date().getMonth()));
  const [year, setYear] = useState<string>(String(currentYear));
  const [contactId, setContactId] = useState<string>('');
  const [selectedConsultantIds, setSelectedConsultantIds] = useState<Set<string>>(new Set());
  const [contactEmail, setContactEmail] = useState<string>('');

  // Email step
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [reportBlob, setReportBlob] = useState<Blob | null>(null);
  const [reportFileName, setReportFileName] = useState('');
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);

  // Sending state
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendLabel, setSendLabel] = useState('');

  // Parent accounts: any account that is referenced as parentAccountId on at least one contract
  const parentAccountOptions = useMemo(() => {
    const ids = new Set(contracts.map(c => c.parentAccountId));
    return accounts
      .filter(a => ids.has(a.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(a => ({ value: a.id, label: a.name }));
  }, []);

  // Contacts associated with selected parent account (excluding consultants)
  const contactOptions = useMemo(() => {
    if (!parentAccountId) return [];
    return contacts
      .filter(c => c.accountId === parentAccountId && c.contactType !== 'Consultant')
      .map(c => ({
        value: c.id,
        label: `${c.firstName} ${c.lastName} — ${c.contactType}`,
        email: c.email,
      }));
  }, [parentAccountId]);

  // Consultants assigned to any contract (parent or child) under the selected parent account
  const consultantOptions = useMemo(() => {
    if (!parentAccountId) return [];
    const parentContracts = contracts.filter(
      c => c.parentAccountId === parentAccountId || c.childAccountId === parentAccountId
    );
    const consultantIds = Array.from(new Set(parentContracts.map(c => c.contactId)));
    return consultantIds
      .map(id => getContactById(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
      .map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }));
  }, [parentAccountId]);

  const selectedAccount = parentAccountId ? getAccountById(parentAccountId) : undefined;

  const buildReportRows = useCallback((): ReportRow[] => {
    if (!parentAccountId) return [];
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    // Find contracts for this parent account (parent or child link)
    const parentContractIds = new Set(
      contracts
        .filter(c => c.parentAccountId === parentAccountId || c.childAccountId === parentAccountId)
        .map(c => c.id)
    );

    // Filter timesheets whose week START or END falls in this month/year
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
      const contract = getContractById(ts.contractId);
      const consultant = getContactById(ts.contactId);
      const childAccount = contract?.childAccountId
        ? getAccountById(contract.childAccountId)
        : getAccountById(contract?.parentAccountId || '');

      // Day order in entries is contiguous from weekStart (Mon - Sun based on Monday week)
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
  }, [parentAccountId, month, year, selectedConsultantIds]);

  const generateExcel = (rows: ReportRow[], fileName: string): Blob => {
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

  const handlePrepare = () => {
    if (!parentAccountId || !contactId) return;
    const rows = buildReportRows();
    if (rows.length === 0) {
      toast.warning('No timesheets found for this account in the selected period.');
      return;
    }
    const account = getAccountById(parentAccountId)!;
    const periodLabel = `${monthNames[parseInt(month, 10)]} ${year}`;
    const fileName = `Timesheet_Report_${account.name.replace(/\s+/g, '_')}_${monthNames[parseInt(month, 10)]}_${year}.xlsx`;
    const blob = generateExcel(rows, fileName);
    setReportRows(rows);
    setReportBlob(blob);
    setReportFileName(fileName);
    setEmailSubject(`Timesheet Report — ${account.name} — ${periodLabel}`);
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
    const recipient = selectedAccount?.email || selectedAccount?.invoicingEmail || '';
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
        cc: contactEmail ? contactEmail : undefined,
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
      // reset
      setParentAccountId(''); setContactId(''); setContactEmail(''); setSelectedConsultantIds(new Set()); setReportBlob(null); setReportRows([]);
    } catch (error) {
      console.error(error);
      setSending(false); setSendProgress(0); setSendLabel('');
      toast.error(`Failed to send: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [emailSubject, emailBody, reportBlob, reportFileName, selectedAccount, contactId, contactOptions, onOpenChange]);

  const prepareDisabled = !parentAccountId;
  const sendDisabled = !emailSubject.trim() || !emailBody.trim();

  return (
    <>
      {/* Step 1: Selection dialog */}
      <Dialog open={open && !emailOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Send Timesheet Report
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Parent Account *</label>
              <Select value={parentAccountId} onValueChange={v => { setParentAccountId(v); setContactId(''); setContactEmail(''); setSelectedConsultantIds(new Set()); }}>
                <SelectTrigger><SelectValue placeholder="Select a parent account..." /></SelectTrigger>
                <SelectContent>
                  {parentAccountOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Month *</label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {monthNames.map((n, i) => (<SelectItem key={i} value={String(i)}>{n}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Year *</label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(y => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Consultants
              </label>
              <div className="rounded-md border max-h-48 overflow-y-auto p-2 space-y-1 bg-background">
                {!parentAccountId ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                    Select a parent account first
                  </div>
                ) : consultantOptions.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                    No consultants assigned to this account.
                  </div>
                ) : (
                  <>
                    <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-sm">
                      <Checkbox
                        checked={selectedConsultantIds.size === consultantOptions.length && consultantOptions.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedConsultantIds(new Set(consultantOptions.map(o => o.value)));
                          else setSelectedConsultantIds(new Set());
                        }}
                      />
                      <span className="font-medium">All consultants</span>
                      <span className="ml-auto text-xs text-muted-foreground">{consultantOptions.length}</span>
                    </label>
                    <div className="h-px bg-border my-1" />
                    {consultantOptions.map(o => (
                      <label key={o.value} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-sm">
                        <Checkbox
                          checked={selectedConsultantIds.has(o.value)}
                          onCheckedChange={(checked) => {
                            setSelectedConsultantIds(prev => {
                              const next = new Set(prev);
                              if (checked) next.add(o.value); else next.delete(o.value);
                              return next;
                            });
                          }}
                        />
                        <span>{o.label}</span>
                      </label>
                    ))}
                  </>
                )}
              </div>
              {parentAccountId && consultantOptions.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedConsultantIds.size === 0
                    ? 'No selection — report will include all consultants.'
                    : `${selectedConsultantIds.size} of ${consultantOptions.length} selected`}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Contact (recipient on CC)
              </label>
              <Select value={contactId} onValueChange={(v) => { setContactId(v); const c = contactOptions.find(o => o.value === v); setContactEmail(c?.email || ''); }} disabled={!parentAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder={parentAccountId ? 'Select a contact (optional)...' : 'Select a parent account first'} />
                </SelectTrigger>
                <SelectContent>
                  {contactOptions.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                      No non-consultant contacts associated with this account.
                    </div>
                  ) : contactOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="email"
                className="mt-2"
                placeholder="Type or override CC email address"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Pre-fills from selected contact, but you can edit or enter any email.
              </p>
            </div>

            {selectedAccount && (
              <div className="text-sm text-muted-foreground rounded-md bg-muted/40 p-3">
                Email will be sent to: <span className="font-medium text-foreground">{selectedAccount.email || selectedAccount.invoicingEmail || 'No email configured'}</span>
                {contactEmail && (
                  <> · CC: <span className="font-medium text-foreground">{contactEmail}</span></>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => {
              if (!parentAccountId) return;
              const rows = buildReportRows();
              if (rows.length === 0) { toast.warning('No timesheets found for this account in the selected period.'); return; }
              const account = getAccountById(parentAccountId)!;
              const fileName = `Timesheet_Report_${account.name.replace(/\s+/g, '_')}_${monthNames[parseInt(month, 10)]}_${year}.xlsx`;
              const blob = generateExcel(rows, fileName);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = fileName; a.click();
              URL.revokeObjectURL(url);
              toast.success(`Downloaded ${fileName}`);
            }} disabled={!parentAccountId}>
              <Download className="h-4 w-4 mr-2" />Download Only
            </Button>
            <Button onClick={handlePrepare} disabled={prepareDisabled}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />Generate Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: Email compose dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />Compose Email
            </DialogTitle>
          </DialogHeader>

          {sending ? (
            <div className="py-8 space-y-4">
              <div className="text-center">
                <Send className="h-8 w-8 mx-auto mb-3 text-primary animate-pulse" />
                <p className="font-medium text-sm">{sendLabel}</p>
              </div>
              <Progress value={sendProgress} className="h-3" />
              <p className="text-xs text-center text-muted-foreground">{sendProgress}%</p>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">To</label>
                  <Input value={selectedAccount?.email || selectedAccount?.invoicingEmail || ''} readOnly className="bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Subject *</label>
                  <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Body *</label>
                  <Textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={6} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Attachment</label>
                  <div className="flex items-center gap-3 rounded-md border p-2.5 bg-muted/30">
                    <FileSpreadsheet className="h-5 w-5 text-green-600 shrink-0" />
                    <span className="text-sm font-medium flex-1 truncate">{reportFileName}</span>
                    <span className="text-xs text-muted-foreground">{reportRows.length} row{reportRows.length === 1 ? '' : 's'}</span>
                    <Button size="sm" variant="ghost" className="h-7" onClick={handlePreview}>
                      <Download className="h-3.5 w-3.5 mr-1" />Download
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEmailOpen(false)}>Back</Button>
                <Button onClick={handleSend} disabled={sendDisabled}>
                  <Send className="h-4 w-4 mr-2" />Send
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
