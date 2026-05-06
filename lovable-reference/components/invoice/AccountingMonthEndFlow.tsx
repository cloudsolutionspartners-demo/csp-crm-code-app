import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared';
import { FileText, Send, AlertCircle, Mail } from 'lucide-react';
import { invoices, entities, accounts, contracts, contacts, getEntityById, getAccountById, getContractById } from '@/data/mock-data';
import type { Invoice, InvoiceLine, CurrencyCode, UnitOfMeasure } from '@/types/crm';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { SelectField, TextField, DateField, LookupField, TextAreaField } from '@/components/FormField';
import { generateInvoicePdf } from './generateInvoicePdf';
import { sendOutlookEmail, blobToBase64 } from './sendEmail';

const currencyOptions: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'RON'];
const uomOptions: UnitOfMeasure[] = ['Day', 'Hour', 'Month', 'Fixed'];
const consultantOptions = contacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }));

const months = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
  { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
  { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => {
  const y = String(currentYear - 2 + i);
  return { value: y, label: y };
});

const entityOptions = entities.map(e => ({ value: e.id, label: `${e.country} (${e.shortName})` }));

interface AccountingMonthEndFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountingMonthEndFlow({ open, onOpenChange }: AccountingMonthEndFlowProps) {
  // Filter state
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(currentYear));
  const [entityId, setEntityId] = useState('');
  const [showList, setShowList] = useState(false);

  // Invoice detail
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [viewInvoiceForm, setViewInvoiceForm] = useState<Record<string, any>>({});
  const [viewInvoiceLines, setViewInvoiceLines] = useState<InvoiceLine[]>([]);
  const [viewLine, setViewLine] = useState<InvoiceLine | null>(null);
  const [lineForm, setLineForm] = useState<Record<string, any>>({});

  // Email compose
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Sending progress
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendLabel, setSendLabel] = useState('');

  // Generated PDFs cache
  const [generatedPdfs, setGeneratedPdfs] = useState<Map<string, Blob>>(new Map());

  const filteredInvoices = useMemo(() => {
    if (!showList || !entityId) return [];
    const m = Number(month);
    const y = Number(year);
    return invoices.filter(inv => {
      if (inv.entityId !== entityId) return false;
      // Match by invoice date month/year
      const d = new Date(inv.invoiceDate);
      return d.getMonth() + 1 === m && d.getFullYear() === y;
    });
  }, [showList, entityId, month, year]);

  const entity = entityId ? getEntityById(entityId) : null;

  const handleShowInvoices = () => {
    if (!entityId) {
      toast.error('Please select a country');
      return;
    }
    setShowList(true);
  };

  const openInvoiceDetail = (inv: Invoice) => {
    setViewInvoice(inv);
    setViewInvoiceLines([...(inv.lines || [])]);
    setViewInvoiceForm({
      invoiceNumber: inv.invoiceNumber, entityId: inv.entityId, accountId: inv.accountId,
      parentAccountId: inv.parentAccountId || '', contractId: inv.contractId || '',
      currencyCode: inv.currencyCode, invoiceDate: inv.invoiceDate, dueDate: inv.dueDate,
      vatRate: inv.vatRate.toString(), vatAmount: inv.vatAmount.toString(),
      total: inv.total.toString(), ronTotalValue: inv.ronTotal?.toString() || '',
      ronConversionRate: inv.ronConversionRate?.toString() || '',
      comments: inv.comments || '', status: inv.status,
      paymentReceivedDate: inv.paymentReceivedDate || '',
    });
  };

  const openLineDetail = (line: InvoiceLine) => {
    setViewLine(line);
    setLineForm({
      name: line.name,
      invoiceId: viewInvoiceForm.invoiceNumber || '',
      description: line.description,
      quantity: line.quantity.toString(),
      unitOfMeasure: line.unitOfMeasure,
      contactId: line.contactId || '',
      lineTotal: line.amount.toString(),
    });
  };

  const handlePrepareEmail = async () => {
    setSendLabel('Generating PDFs...');
    const pdfs = new Map<string, Blob>();
    for (const inv of filteredInvoices) {
      try {
        const blob = await generateInvoicePdf(inv);
        pdfs.set(inv.id, blob);
      } catch (e) {
        console.error('PDF generation failed for', inv.invoiceNumber, e);
      }
    }
    setGeneratedPdfs(pdfs);
    setSendLabel('');

    const entityName = entity?.name || 'Cloud Solutions Partners';
    const monthLabel = months.find(m => m.value === month)?.label || month;
    setEmailSubject(`${monthLabel} ${year} Invoices — ${entityName}`);
    setEmailBody('');
    setEmailOpen(true);
  };

  const handlePreviewPdf = async (inv: Invoice) => {
    let blob = generatedPdfs.get(inv.id);
    if (!blob) {
      blob = await generateInvoicePdf(inv);
      setGeneratedPdfs(prev => new Map(prev).set(inv.id, blob!));
    }
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleSend = useCallback(async () => {
    if (!emailSubject.trim() || !emailBody.trim()) return;

    setSending(true);
    const recipientEmail = entity?.accountantEmail || '';

    try {
      setSendProgress(10);
      setSendLabel('Validating invoices...');
      await new Promise(r => setTimeout(r, 400));

      setSendProgress(25);
      setSendLabel('Generating PDF attachments...');
      const attachments: { name: string; contentBytes: string }[] = [];
      for (const inv of filteredInvoices) {
        let blob = generatedPdfs.get(inv.id);
        if (!blob) {
          blob = await generateInvoicePdf(inv);
        }
        const base64 = await blobToBase64(blob);
        attachments.push({ name: `${inv.invoiceNumber}.pdf`, contentBytes: base64 });
      }

      setSendProgress(50);
      setSendLabel(`Sending email via Outlook to ${recipientEmail}...`);

      const htmlBody = `<p>${emailBody.replace(/\n/g, '<br/>')}</p>`;

      await sendOutlookEmail({
        to: recipientEmail,
        subject: emailSubject,
        htmlBody,
        attachments,
      });

      setSendProgress(75);
      setSendLabel('Updating invoice statuses...');
      await new Promise(r => setTimeout(r, 400));

      filteredInvoices.forEach(inv => {
        (inv as any).status = 'Sent';
      });

      setSendProgress(100);
      setSendLabel('Complete!');
      await new Promise(r => setTimeout(r, 500));

      setSending(false);
      setSendProgress(0);
      setSendLabel('');
      setEmailOpen(false);
      setShowList(false);
      onOpenChange(false);
      toast.success(`${filteredInvoices.length} invoice(s) sent via Outlook to ${recipientEmail}`);
    } catch (error) {
      console.error('Failed to send email:', error);
      setSending(false);
      setSendProgress(0);
      setSendLabel('');
      toast.error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [emailSubject, emailBody, filteredInvoices, entity, onOpenChange, generatedPdfs]);

  const handleClose = () => {
    setShowList(false);
    onOpenChange(false);
  };

  const sendDisabled = !emailSubject.trim() || !emailBody.trim();

  return (
    <>
      {/* Main Dialog: Month/Year/Country picker + invoice list */}
      <Dialog open={open && !viewInvoice} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Accounting Month End
            </DialogTitle>
          </DialogHeader>

          {!showList ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-4">
                <SelectField label="Month" value={month} onChange={setMonth} required
                  options={months} />
                <SelectField label="Year" value={year} onChange={setYear} required
                  options={years} />
                <SelectField label="Country" value={entityId} onChange={setEntityId} required
                  options={entityOptions} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleShowInvoices}>Show Invoices</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Badge variant="outline">{months.find(m => m.value === month)?.label} {year}</Badge>
                <Badge variant="outline">{entity?.country} ({entity?.shortName})</Badge>
                <Button variant="link" size="sm" className="ml-auto text-xs" onClick={() => setShowList(false)}>Change filters</Button>
              </div>

              {filteredInvoices.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No invoices found</p>
                  <p className="text-sm">No invoices match the selected month, year, and country.</p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Currency</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInvoices.map(inv => (
                          <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openInvoiceDetail(inv)}>
                            <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                            <TableCell>{getAccountById(inv.accountId)?.name}</TableCell>
                            <TableCell>{formatDate(inv.invoiceDate)}</TableCell>
                            <TableCell>{formatDate(inv.dueDate)}</TableCell>
                            <TableCell>{inv.currencyCode}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(inv.total, inv.currencyCode)}</TableCell>
                            <TableCell><StatusBadge status={inv.status} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Checklist */}
                  <div className="mt-4 rounded-lg border bg-muted/30 p-4 space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Pre-send Checklist
                    </h4>
                    <ChecklistItem text="Ensure that the correct consultants have been assigned to the invoices" />
                    <ChecklistItem text="Ensure that the invoice lines have the correct descriptions" />
                    <ChecklistItem text="Ensure that the amounts are correct" />
                    <ChecklistItem text="If sending to a Romanian vendor, ensure that you have the correct RON Exchange and RON total" />
                  </div>

                  <div className="mt-3 text-sm text-muted-foreground">
                    Email will be sent to: <span className="font-medium text-foreground">{entity?.accountantEmail || 'No accountant email configured'}</span>
                  </div>

                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={handleClose}>Cancel</Button>
                    <Button onClick={handlePrepareEmail} disabled={!entity?.accountantEmail}>
                      <Send className="h-4 w-4 mr-2" />Prepare Email
                    </Button>
                  </DialogFooter>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Sheet */}
      <Sheet open={!!viewInvoice} onOpenChange={() => setViewInvoice(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {viewInvoice && (
            <>
              <SheetHeader>
                <SheetTitle>{viewInvoiceForm.invoiceNumber}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</span>
                <Badge variant="secondary">{viewInvoiceForm.status}</Badge>
              </div>
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <LookupField label="Account" value={viewInvoiceForm.accountId} onChange={() => {}}
                    options={accounts.map(a => ({ value: a.id, label: a.name }))} />
                  <LookupField label="Parent Account" value={viewInvoiceForm.parentAccountId} onChange={() => {}}
                    options={accounts.map(a => ({ value: a.id, label: a.name }))} />
                  <LookupField label="Contract" value={viewInvoiceForm.contractId} onChange={() => {}}
                    options={contracts.map(c => ({ value: c.id, label: c.contractNumber }))} />
                  <DateField label="Payment Received Date" value={viewInvoiceForm.paymentReceivedDate} onChange={() => {}} />
                  <DateField label="Invoice Date" value={viewInvoiceForm.invoiceDate} onChange={() => {}} />
                  <SelectField label="Currency" value={viewInvoiceForm.currencyCode} onChange={() => {}}
                    options={currencyOptions.map(c => ({ value: c, label: c }))} />
                  <DateField label="Due Date" value={viewInvoiceForm.dueDate} onChange={() => {}} />
                  <TextField label="Total" value={viewInvoiceForm.total} onChange={() => {}} type="number" readOnly />
                  <TextField label="VAT Amount" value={viewInvoiceForm.vatAmount} onChange={() => {}} type="number" readOnly />
                  <TextField label="RON Total Value" value={viewInvoiceForm.ronTotalValue} onChange={() => {}} type="number" readOnly />
                  <TextField label="VAT Rate %" value={viewInvoiceForm.vatRate} onChange={() => {}} type="number" readOnly />
                  <TextField label="RON Conversion Rate" value={viewInvoiceForm.ronConversionRate} onChange={() => {}} type="number" readOnly />
                  <TextAreaField label="Comments" value={viewInvoiceForm.comments} onChange={() => {}} rows={2} />
                  <LookupField label="Country" value={viewInvoiceForm.entityId} onChange={() => {}}
                    options={entities.map(e => ({ value: e.id, label: e.country }))} />
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">Invoice Lines</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>UoM</TableHead>
                        <TableHead>Consultant</TableHead>
                        <TableHead className="text-right">Line Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewInvoiceLines.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground text-sm">No lines.</TableCell></TableRow>
                      ) : viewInvoiceLines.map(line => (
                        <TableRow key={line.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openLineDetail(line)}>
                          <TableCell>{line.name}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{line.description}</TableCell>
                          <TableCell>{line.quantity}</TableCell>
                          <TableCell>{line.unitOfMeasure}</TableCell>
                          <TableCell>{line.contactId ? consultantOptions.find(c => c.value === line.contactId)?.label || '—' : '—'}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(line.amount, line.currencyCode)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="flex justify-end mt-6 pt-4 border-t">
                <Button variant="outline" onClick={() => setViewInvoice(null)}>Close</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Invoice Line Detail Dialog */}
      <Dialog open={!!viewLine} onOpenChange={() => setViewLine(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Invoice Line Details</DialogTitle></DialogHeader>
          {viewLine && (
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 py-4">
              <TextField label="Name" value={lineForm.name || ''} onChange={() => {}} readOnly />
              <TextField label="Invoice" value={lineForm.invoiceId || ''} onChange={() => {}} readOnly />
              <TextAreaField label="Description" value={lineForm.description || ''} onChange={() => {}} rows={4} />
              <LookupField label="Consultant" value={lineForm.contactId || ''} onChange={() => {}}
                options={consultantOptions} />
              <TextField label="Quantity" value={lineForm.quantity || ''} onChange={() => {}} type="number" readOnly />
              <TextField label="Line Total" value={lineForm.lineTotal || ''} onChange={() => {}} type="number" readOnly />
              <SelectField label="Unit of Measure" value={lineForm.unitOfMeasure || 'Day'} onChange={() => {}}
                options={uomOptions.map(u => ({ value: u, label: u }))} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewLine(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Compose Dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Compose Email
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
                  <Input value={entity?.email || ''} readOnly className="bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    Subject <span className="text-destructive text-sm leading-none">*</span>
                  </label>
                  <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Email subject..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    Body <span className="text-destructive text-sm leading-none">*</span>
                  </label>
                  <Textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Email body..." rows={6} />
                </div>

                {/* PDF Attachments */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Attachments</label>
                  <div className="flex flex-wrap gap-2">
                    {filteredInvoices.map(inv => (
                      <Button key={inv.id} variant="outline" size="sm" className="gap-1.5" onClick={() => handlePreviewPdf(inv)}>
                        <FileText className="h-3.5 w-3.5 text-destructive" />
                        {inv.invoiceNumber}.pdf
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEmailOpen(false)}>Cancel</Button>
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

function ChecklistItem({ text }: { text: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <label className="flex items-start gap-2 cursor-pointer text-sm">
      <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}
        className="mt-0.5 rounded border-muted-foreground" />
      <span className={checked ? 'line-through text-muted-foreground' : ''}>{text}</span>
    </label>
  );
}
