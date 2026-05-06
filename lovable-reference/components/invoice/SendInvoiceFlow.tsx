import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared';
import { FileText, Send, Trash2, Plus, Eye, AlertCircle, CheckCircle2, Mail, X } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { invoices, entities, accounts, contracts, contacts, getEntityById, getAccountById, getContractById, getContactById } from '@/data/mock-data';
import type { Invoice, InvoiceLine, InvoiceStatus, CurrencyCode, UnitOfMeasure } from '@/types/crm';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { TextField, SelectField, DateField, LookupField, TextAreaField } from '@/components/FormField';
import { generateInvoicePdf } from './generateInvoicePdf';
import { sendOutlookEmail, blobToBase64 } from './sendEmail';

const invoiceStatuses: InvoiceStatus[] = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled', 'Credit Note'];
const currencyOptions: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'RON'];
const uomOptions: UnitOfMeasure[] = ['Day', 'Hour', 'Month', 'Fixed'];
const consultantOptions = contacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }));

interface SendInvoiceFlowProps {
  accountId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendInvoiceFlow({ accountId, open, onOpenChange }: SendInvoiceFlowProps) {
  const account = getAccountById(accountId);
  const draftInvoices = useMemo(
    () => invoices.filter(i => i.accountId === accountId && i.status === 'Draft'),
    [accountId]
  );

  // Sub-dialog states
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [viewInvoiceForm, setViewInvoiceForm] = useState<Record<string, any>>({});
  const [viewInvoiceLines, setViewInvoiceLines] = useState<InvoiceLine[]>([]);
  const [viewLine, setViewLine] = useState<InvoiceLine | null>(null);
  const [lineForm, setLineForm] = useState<Record<string, any>>({});

  // Email compose
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [ccContactIds, setCcContactIds] = useState<string[]>([]);

  // Contacts available for CC: anyone whose contactType is NOT Consultant
  const ccContactOptions = useMemo(
    () =>
      contacts
        .filter(c => c.contactType !== 'Consultant' && !!c.email)
        .map(c => ({
          value: c.id,
          label: `${c.firstName} ${c.lastName} (${c.contactType}) — ${c.email}`,
        })),
    []
  );

  // Sending progress
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendLabel, setSendLabel] = useState('');

  // Generated PDFs cache
  const [generatedPdfs, setGeneratedPdfs] = useState<Map<string, Blob>>(new Map());

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
    // Pre-generate PDFs
    setSendLabel('Generating PDFs...');
    const pdfs = new Map<string, Blob>();
    for (const inv of draftInvoices) {
      try {
        const blob = await generateInvoicePdf(inv);
        pdfs.set(inv.id, blob);
      } catch (e) {
        console.error('PDF generation failed for', inv.invoiceNumber, e);
      }
    }
    setGeneratedPdfs(pdfs);
    setSendLabel('');

    setEmailSubject(`Invoices from ${getEntityById(draftInvoices[0]?.entityId)?.name || 'Cloud Solutions Partners'}`);
    setEmailBody('');
    setCcContactIds([]);
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
    const total = draftInvoices.length;
    const recipientEmail = account?.invoicingEmail || account?.email || '';
    const ccEmails = ccContactIds
      .map(id => getContactById(id)?.email)
      .filter((e): e is string => !!e);

    try {
      setSendProgress(10);
      setSendLabel('Validating invoices...');
      await new Promise(r => setTimeout(r, 400));

      setSendProgress(25);
      setSendLabel('Generating PDF attachments...');
      const attachments: { name: string; contentBytes: string }[] = [];
      for (const inv of draftInvoices) {
        let blob = generatedPdfs.get(inv.id);
        if (!blob) {
          blob = await generateInvoicePdf(inv);
        }
        const base64 = await blobToBase64(blob);
        attachments.push({ name: `${inv.invoiceNumber}.pdf`, contentBytes: base64 });
      }

      setSendProgress(50);
      setSendLabel(`Sending email via Outlook to ${recipientEmail}...`);

      // Build HTML body
      const htmlBody = `<p>${emailBody.replace(/\n/g, '<br/>')}</p>`;

      await sendOutlookEmail({
        to: recipientEmail,
        cc: ccEmails,
        subject: emailSubject,
        htmlBody,
        attachments,
      });

      setSendProgress(75);
      setSendLabel('Updating invoice statuses...');
      await new Promise(r => setTimeout(r, 400));

      // Update invoice statuses to Sent (mock)
      draftInvoices.forEach(inv => {
        (inv as any).status = 'Sent';
      });

      setSendProgress(100);
      setSendLabel('Complete!');
      await new Promise(r => setTimeout(r, 500));

      setSending(false);
      setSendProgress(0);
      setSendLabel('');
      setEmailOpen(false);
      onOpenChange(false);
      toast.success(`${total} invoice${total > 1 ? 's' : ''} sent via Outlook to ${recipientEmail}`);
    } catch (error) {
      console.error('Failed to send email:', error);
      setSending(false);
      setSendProgress(0);
      setSendLabel('');
      toast.error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [emailSubject, emailBody, draftInvoices, account, onOpenChange, generatedPdfs, ccContactIds]);

  if (!account) return null;

  const sendDisabled = !emailSubject.trim() || !emailBody.trim();

  return (
    <>
      {/* Main Dialog: Draft invoices for account */}
      <Dialog open={open && !viewInvoice} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Invoices — {account.name}
            </DialogTitle>
          </DialogHeader>

          {draftInvoices.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No draft invoices</p>
              <p className="text-sm">There are no invoices in Draft status for this account.</p>
            </div>
          ) : (
            <>
              {/* Draft invoices table */}
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draftInvoices.map(inv => (
                      <TableRow
                        key={inv.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => openInvoiceDetail(inv)}
                      >
                        <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
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

              {/* Sending to info */}
              <div className="mt-3 text-sm text-muted-foreground">
                Invoices will be sent to: <span className="font-medium text-foreground">{account.invoicingEmail || account.email || 'No email configured'}</span>
              </div>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={handlePrepareEmail} disabled={!account.invoicingEmail && !account.email}>
                  <Send className="h-4 w-4 mr-2" />Prepare Email
                </Button>
              </DialogFooter>
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

                {/* Invoice Lines */}
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
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    To
                  </label>
                  <Input value={account?.invoicingEmail || account?.email || ''} readOnly className="bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    CC
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full min-h-10 rounded-md border border-input bg-background px-3 py-2 text-left text-sm hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {ccContactIds.length === 0 ? (
                          <span className="text-muted-foreground">Add contacts to CC...</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {ccContactIds.map(id => {
                              const c = getContactById(id);
                              if (!c) return null;
                              return (
                                <Badge key={id} variant="secondary" className="gap-1">
                                  {c.firstName} {c.lastName}
                                  <span
                                    role="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCcContactIds(prev => prev.filter(x => x !== id));
                                    }}
                                    className="ml-0.5 rounded-sm hover:bg-muted-foreground/20"
                                  >
                                    <X className="h-3 w-3" />
                                  </span>
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search contacts..." />
                        <CommandList>
                          <CommandEmpty>No contacts found.</CommandEmpty>
                          <CommandGroup>
                            {ccContactOptions.map(opt => {
                              const selected = ccContactIds.includes(opt.value);
                              return (
                                <CommandItem
                                  key={opt.value}
                                  value={opt.label}
                                  onSelect={() => {
                                    setCcContactIds(prev =>
                                      selected ? prev.filter(x => x !== opt.value) : [...prev, opt.value]
                                    );
                                  }}
                                >
                                  <Checkbox checked={selected} className="mr-2" />
                                  <span className="text-sm">{opt.label}</span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {ccContactIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      CC: {ccContactIds.map(id => getContactById(id)?.email).filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    Subject <span className="text-destructive text-sm leading-none">*</span>
                  </label>
                  <Input
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    placeholder="Invoice subject..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    Body <span className="text-destructive text-sm leading-none">*</span>
                  </label>
                  <Textarea
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    placeholder="Write your email message..."
                    rows={6}
                  />
                </div>

                {/* PDF Attachments */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Attachments ({draftInvoices.length})
                  </label>
                  <div className="space-y-2">
                    {draftInvoices.map(inv => (
                      <div key={inv.id} className="flex items-center gap-3 rounded-md border p-2.5 bg-muted/30">
                        <FileText className="h-5 w-5 text-red-500 shrink-0" />
                        <span className="text-sm font-medium flex-1">{inv.invoiceNumber}.pdf</span>
                        <span className="text-xs text-muted-foreground">{formatCurrency(inv.total, inv.currencyCode)}</span>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => handlePreviewPdf(inv)}>
                          <Eye className="h-3.5 w-3.5 mr-1" />Preview
                        </Button>
                      </div>
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
    <label className="flex items-start gap-3 cursor-pointer group">
      <Checkbox checked={checked} onCheckedChange={c => setChecked(!!c)} className="mt-0.5" />
      <span className={`text-sm leading-relaxed ${checked ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{text}</span>
      {checked && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
    </label>
  );
}
