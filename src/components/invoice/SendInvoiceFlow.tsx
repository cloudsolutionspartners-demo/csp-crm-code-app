import * as React from 'react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Dialog, Sheet, useToast } from '../Layout';
import { StatusBadge, Spinner } from '../Shared';
import { TextField, SelectField, DateField, LookupField, TextAreaField } from '../FormFields';
import { FileText, Send, Eye, Mail, Loader2 } from '../Icons';
import { fetchInvoices, saveInvoice } from '../../services/invoiceService';
import { fetchLinesByInvoiceId, setUomCache } from '../../services/invoiceLineService';
import { fetchUnitsOfMeasure } from '../../services/unitOfMeasureService';
import { fetchContacts } from '../../services/contactService';
import { fetchBusinessUnits } from '../../services/businessUnitService';
import type { BusinessUnit } from '../../services/businessUnitService';
import { useDataverse } from '../../services/useDataverse';
import { sendOutlookEmail, blobToBase64 } from './sendEmail';
import { uploadFileField, listRecords } from '../../services/dataverseService';
import { Csp_invoicesService } from '../../generated/services/Csp_invoicesService';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { Invoice, InvoiceLine, CurrencyCode, UnitOfMeasure, Account, Contact } from '../../types/crm';
import { generateInvoicePdf, type PdfEntity, type PdfAccount, type PdfLine } from './generateInvoicePdf';

const ENTITY_CONFIG: Record<string, PdfEntity> = {
  Romania: {
    name: 'CLOUD SOLUTIONS PARTNERS S.R.L.',
    country: 'Romania',
    address: 'Str. Victoriei 100, Bucharest, Romania',
    email: 'accounting@csp-romania.com',
    phone: '+40 724 585 060',
    vatNumber: 'RO12345678',
    bankName: 'ING Bank Romania',
    iban: 'RO49AAAA1B31007593840000',
    swift: 'INGBROBU',
  },
  Bulgaria: {
    name: 'CLOUD SOLUTIONS PARTNERS EOOD',
    country: 'Bulgaria',
    address: 'Alexanderovski Boulevard, No. 97, Floor 5, Apartment 28, Ruse, Ruse, 7071, Bulgaria',
    email: 'accounts.svc@cloudsolutionspartners.ro',
    phone: '+359 888 123 456',
    vatNumber: 'BG207996481',
    bankName: 'Revolut',
    iban: 'LT38 3250 0037 2564 8717',
    swift: 'REVOLT21',
    intermediaryBic: 'CHASGB2L',
    ukBankName: 'Revolut UK',
    ukAccountNumber: '12345678',
    ukSortCode: '04-00-75',
    ukIban: 'GB29 REVO 0099 7012 3456 78',
    ukSwift: 'REVOGB21',
    ukIntermediaryBic: 'CHASGB2L',
  },
  US: {
    name: 'CLOUD SOLUTIONS PARTNERS LLC',
    country: 'US',
    address: '100 Main St, New York, NY 10001',
    email: 'accounting@csp-us.com',
    phone: '+1 212 555 0100',
    vatNumber: 'N/A',
    bankName: 'JPMorgan Chase',
    iban: 'N/A',
    swift: 'CHASUS33',
  },
};

const currencyOptions: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'RON'];
const uomOptions: UnitOfMeasure[] = ['Day', 'Hour', 'Month', 'Fixed'];

async function fetchAccountContacts(accountId: string): Promise<{ id: string; name: string; email: string }[]> {
  try {
    const records = await listRecords(
      `accounts(${accountId})/csp_Account_Contact_Contact`,
      'contactid,fullname,emailaddress1',
    );
    return records
      .map((r: any) => ({
        id: r.contactid || '',
        name: r.fullname || '',
        email: r.emailaddress1 || '',
      }))
      .filter(c => c.email);
  } catch (err) {
    console.error('[SendInvoice] Failed to fetch account contacts:', err);
    return [];
  }
}

interface SendInvoiceFlowProps {
  account: Account | null;
  open: boolean;
  onClose: () => void;
}

export function SendInvoiceFlow({ account, open, onClose }: SendInvoiceFlowProps) {
  const { toast } = useToast();
  const { data: allInvoices, refetch: refetchInvoices } = useDataverse<Invoice>(fetchInvoices, []);
  const { data: dvContacts } = useDataverse<Contact>(fetchContacts, []);
  const { data: businessUnits } = useDataverse<BusinessUnit>(fetchBusinessUnits, []);

  const buildPdfEntity = useCallback((entityId: string): PdfEntity => {
    const buName = businessUnits.find(bu => bu.id === entityId)?.name || 'Romania';
    return ENTITY_CONFIG[buName] || ENTITY_CONFIG.Romania;
  }, [businessUnits]);

  const buildPdfLines = useCallback((inv: Invoice, lines: InvoiceLine[]): PdfLine[] => {
    return lines.map(line => {
      const consultant = line.contactId ? dvContacts.find(c => c.id === line.contactId) : null;
      const consultantName = consultant ? `${consultant.firstName} ${consultant.lastName}` : undefined;
      const qty = line.quantity || 0;
      const rate = line.rate || (line.amount && qty ? line.amount / qty : 0);
      return {
        description: line.description || line.name || '',
        consultantName,
        quantity: qty,
        unitOfMeasure: line.unitOfMeasure || 'Day',
        rate,
        currencyCode: inv.currencyCode || 'EUR',
        amount: line.amount || 0,
      };
    });
  }, [dvContacts]);

  const draftInvoices = useMemo(() => {
    if (!account) return [];
    return allInvoices.filter(i => i.accountId === account.id && i.status === 'Draft');
  }, [allInvoices, account]);

  // Invoice detail sheet
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [viewInvoiceForm, setViewInvoiceForm] = useState<Record<string, any>>({});
  const [viewInvoiceLines, setViewInvoiceLines] = useState<InvoiceLine[]>([]);

  // Invoice line detail dialog
  const [viewLine, setViewLine] = useState<InvoiceLine | null>(null);
  const [lineForm, setLineForm] = useState<Record<string, any>>({});

  // Email compose
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [ccContactIds, setCcContactIds] = useState<string[]>([]);
  const [accountContacts, setAccountContacts] = useState<{ id: string; name: string; email: string }[]>([]);

  const [uomIdToName, setUomIdToName] = useState<Record<string, string>>({});

  // Sending progress
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendLabel, setSendLabel] = useState('');

  useEffect(() => {
    if (account?.id) {
      fetchAccountContacts(account.id).then(setAccountContacts).catch(() => setAccountContacts([]));
    } else {
      setAccountContacts([]);
    }
  }, [account?.id]);

  useEffect(() => {
    fetchUnitsOfMeasure().then(uoms => {
      const idToName: Record<string, string> = {};
      uoms.forEach(u => { if (u.id && u.name) idToName[u.id] = u.name; });
      setUomCache(idToName);
      setUomIdToName(idToName);
    }).catch(() => {});
  }, []);

  const consultantOptions = useMemo(() =>
    dvContacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })),
  [dvContacts]);

  const ccContactOptions = useMemo(() =>
    accountContacts.map(c => ({ value: c.id, label: c.name, email: c.email })),
  [accountContacts]);
  const getConsultantName = (id?: string): string => {
    if (!id) return '—';
    const c = dvContacts.find(ct => ct.id === id);
    return c ? `${c.firstName} ${c.lastName}` : '—';
  };

  const recipientEmail = account?.invoicingEmail || account?.email || '';

  const openInvoiceDetail = async (inv: Invoice) => {
    setViewInvoice(inv);
    setViewInvoiceLines([...(inv.lines || [])]);
    setViewInvoiceForm({
      invoiceNumber: inv.invoiceNumber,
      entityId: inv.entityId,
      accountId: inv.accountId,
      parentAccountId: inv.parentAccountId || '',
      contractId: inv.contractId || '',
      currencyCode: inv.currencyCode,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      vatRate: inv.vatRate?.toString() || '0',
      vatAmount: inv.vatAmount?.toString() || '0',
      total: inv.total?.toString() || '0',
      ronTotalValue: inv.ronTotal?.toString() || '',
      ronConversionRate: inv.ronConversionRate?.toString() || '',
      comments: inv.comments || '',
      status: inv.status,
      paymentReceivedDate: inv.paymentReceivedDate || '',
    });
    // Lines come from a separate Dataverse table; fetch them so the preview is real.
    try {
      const records = await fetchLinesByInvoiceId(inv.id);
      const lines: InvoiceLine[] = records.map(r => ({
        id: r.id,
        invoiceId: inv.id,
        name: r.name,
        description: r.description,
        quantity: r.quantity,
        rate: r.quantity > 0 ? r.lineTotal / r.quantity : 0,
        currencyCode: inv.currencyCode,
        amount: r.lineTotal,
        unitOfMeasure: (uomIdToName[r.unitOfMeasureId] || r.unitOfMeasure || 'Day') as InvoiceLine['unitOfMeasure'],
        contactId: r.consultantId || undefined,
        contractId: r.contractId || undefined,
      }));
      setViewInvoiceLines(lines);
    } catch (err) {
      console.error('[SendInvoice] Failed to fetch lines:', err);
      setViewInvoiceLines([]);
    }
  };

  const openLineDetail = (line: InvoiceLine) => {
    setViewLine(line);
    setLineForm({
      name: line.name || '',
      invoiceId: viewInvoiceForm.invoiceNumber || '',
      description: line.description || '',
      quantity: line.quantity?.toString() || '0',
      unitOfMeasure: line.unitOfMeasure || 'Day',
      contactId: line.contactId || '',
      lineTotal: line.amount?.toString() || '0',
    });
  };

  const handlePrepareEmail = () => {
    setEmailSubject(`Invoices from ${account?.name || 'Cloud Solutions Partners'}`);
    setEmailBody('');
    setCcContactIds([]);
    setEmailOpen(true);
  };

  const handlePreviewPdf = async (inv: Invoice) => {
    try {
      const records = await fetchLinesByInvoiceId(inv.id).catch(() => []);
      const lines: InvoiceLine[] = records.map(r => ({
        id: r.id,
        invoiceId: inv.id,
        name: r.name,
        description: r.description,
        quantity: r.quantity,
        rate: r.quantity > 0 ? r.lineTotal / r.quantity : 0,
        currencyCode: inv.currencyCode,
        amount: r.lineTotal,
        unitOfMeasure: (uomIdToName[r.unitOfMeasureId] || r.unitOfMeasure || 'Day') as InvoiceLine['unitOfMeasure'],
        contactId: r.consultantId || undefined,
        contractId: r.contractId || undefined,
      }));
      const pdfEntity = buildPdfEntity(inv.entityId);
      const pdfAccount: PdfAccount = {
        name: account?.name || 'Unknown',
        street1: account?.street1 || '',
        street2: account?.street2 || '',
        street3: account?.street3 || '',
        city: account?.city || '',
        stateProvince: account?.stateProvince || '',
        postalCode: account?.postalCode || '',
        country: account?.country || '',
        vatNumber: account?.vatNumber || '',
        invoiceFooter: account?.invoiceFooter || '',
      };
      const pdfLines = buildPdfLines(inv, lines);
      const pdfBlob = await generateInvoicePdf({ ...inv, lines }, pdfEntity, pdfAccount, pdfLines);
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
    } catch (err: any) {
      console.error('[SendInvoice] Preview failed:', err);
      toast.error('Failed to generate PDF preview');
    }
  };

  const handleSend = useCallback(async () => {
    if (!emailSubject.trim() || !emailBody.trim()) return;
    if (!recipientEmail) {
      toast.error('No recipient email configured on this account');
      return;
    }

    setSending(true);
    try {
      setSendProgress(15);
      setSendLabel('Validating invoices...');
      await new Promise(r => setTimeout(r, 200));

      setSendProgress(30);
      setSendLabel('Loading invoice lines...');

      // Lines live in the csp_invoicelines junction table — fetch them per invoice.
      const invoicesWithLines: Invoice[] = await Promise.all(
        draftInvoices.map(async (inv) => {
          try {
            const records = await fetchLinesByInvoiceId(inv.id);
            const lines: InvoiceLine[] = records.map(r => ({
              id: r.id,
              invoiceId: inv.id,
              name: r.name,
              description: r.description,
              quantity: r.quantity,
              rate: r.quantity > 0 ? r.lineTotal / r.quantity : 0,
              currencyCode: inv.currencyCode,
              amount: r.lineTotal,
              unitOfMeasure: (uomIdToName[r.unitOfMeasureId] || r.unitOfMeasure || 'Day') as InvoiceLine['unitOfMeasure'],
              contactId: r.consultantId || undefined,
              contractId: r.contractId || undefined,
            }));
            return { ...inv, lines };
          } catch (err) {
            console.error('[SendInvoice] Failed to fetch lines for', inv.invoiceNumber, err);
            return { ...inv, lines: [] };
          }
        }),
      );

      setSendProgress(40);
      setSendLabel('Generating PDF invoices...');

      const pdfAccount: PdfAccount = {
        name: account?.name || 'Unknown',
        street1: account?.street1 || '',
        street2: account?.street2 || '',
        street3: account?.street3 || '',
        city: account?.city || '',
        stateProvince: account?.stateProvince || '',
        postalCode: account?.postalCode || '',
        country: account?.country || '',
        vatNumber: account?.vatNumber || '',
        invoiceFooter: account?.invoiceFooter || '',
      };

      const attachments: { name: string; contentBytes: string }[] = [];
      for (const inv of invoicesWithLines) {
        try {
          const pdfEntity = buildPdfEntity(inv.entityId);
          const pdfLines = buildPdfLines(inv, inv.lines || []);
          const pdfBlob = await generateInvoicePdf(inv, pdfEntity, pdfAccount, pdfLines);
          const base64 = await blobToBase64(pdfBlob);
          attachments.push({
            name: `${inv.invoiceNumber || 'invoice'}.pdf`,
            contentBytes: base64,
          });
        } catch (pdfErr: any) {
          console.error('[SendInvoice] PDF generation failed for', inv.invoiceNumber, ':', pdfErr?.message);
        }
      }

      setSendProgress(60);
      setSendLabel(`Sending via Outlook to ${recipientEmail}...`);

      const htmlBody = emailBody
        .split('\n')
        .map(line => `<p>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;') || '&nbsp;'}</p>`)
        .join('');

      const ccEmails = ccContactIds
        .map(id => accountContacts.find(ct => ct.id === id)?.email)
        .filter((e): e is string => !!e);

      await sendOutlookEmail({
        to: recipientEmail,
        cc: ccEmails.length > 0 ? ccEmails.join('; ') : undefined,
        subject: emailSubject,
        htmlBody,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      setSendProgress(75);
      setSendLabel('Saving PDF to Dataverse...');

      for (let i = 0; i < invoicesWithLines.length; i++) {
        const inv = invoicesWithLines[i];
        if (attachments[i]) {
          try {
            const byteCharacters = atob(attachments[i].contentBytes);
            const byteNumbers = new Array(byteCharacters.length);
            for (let j = 0; j < byteCharacters.length; j++) {
              byteNumbers[j] = byteCharacters.charCodeAt(j);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const file = new File([blob], attachments[i].name, { type: 'application/pdf' });

            try {
              console.log('[SendInvoice] Upload attempt:', {
                invoiceId: inv.id,
                columnName: 'csp_invoicedocument',
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                isFile: file instanceof File,
                isBlob: file instanceof Blob,
              });

              const testContent = new Uint8Array([37, 80, 68, 70]); // "%PDF" header
              const testFile = new File([testContent], 'test.pdf', { type: 'application/pdf' });

              console.log('[SendInvoice] Trying minimal test file upload first...');
              await Csp_invoicesService.upload(inv.id, 'csp_invoicedocument', testFile, 'test.pdf');
              console.log('[SendInvoice] Test file upload SUCCEEDED — now uploading real PDF...');

              await Csp_invoicesService.upload(inv.id, 'csp_invoicedocument', file, attachments[i].name);
              console.log('[SendInvoice] Real PDF uploaded to Dataverse for', inv.invoiceNumber);
            } catch (genErr: any) {
              console.error('[SendInvoice] Upload failed. Full error:', JSON.stringify(genErr, null, 2));
              console.error('[SendInvoice] Error message:', genErr?.message);
              console.error('[SendInvoice] Error stack:', genErr?.stack);
              console.warn('[SendInvoice] PDF upload to Dataverse skipped due to platform limitation');
            }
          } catch (uploadErr: any) {
            console.error('[SendInvoice] PDF upload failed for', inv.invoiceNumber, ':', uploadErr?.message);
            // Best-effort — continue regardless.
          }
        }
      }

      setSendProgress(85);
      setSendLabel('Updating invoice statuses...');

      // Update each invoice to Sent
      for (const inv of invoicesWithLines) {
        try {
          await saveInvoice({ ...inv, status: 'Sent' as any }, inv.id);
        } catch (statusErr: any) {
          console.error('[SendInvoice] Status update failed for', inv.invoiceNumber, ':', statusErr?.message);
        }
      }

      setSendProgress(100);
      setSendLabel('Complete!');
      await new Promise(r => setTimeout(r, 300));

      setSending(false);
      setSendProgress(0);
      setSendLabel('');
      setEmailOpen(false);
      await refetchInvoices();
      onClose();
      toast.success(`${draftInvoices.length} invoice(s) sent to ${recipientEmail}`);
    } catch (err: any) {
      console.error('[SendInvoice] Send failed:', err);
      setSending(false);
      setSendProgress(0);
      setSendLabel('');
      toast.error(err?.message || 'Failed to send email');
    }
  }, [emailSubject, emailBody, ccContactIds, accountContacts, draftInvoices, recipientEmail, account, onClose, refetchInvoices, toast, buildPdfEntity, buildPdfLines, uomIdToName]);

  if (!account) return null;

  const sendDisabled = !emailSubject.trim() || !emailBody.trim();

  return (
    <>
      {/* ===== Main Dialog: Draft invoices ===== */}
      <Dialog open={open && !viewInvoice} onClose={onClose} title={`Send Invoices — ${account.name}`} maxWidth="48rem">
        {draftInvoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <span style={{ color: 'hsl(var(--muted-foreground))', opacity: 0.4 }}>
              <FileText className="csp-icon-lg" />
            </span>
            <p style={{ fontWeight: 500, marginTop: 12 }}>No draft invoices</p>
            <p className="csp-text-muted" style={{ fontSize: '0.875rem' }}>There are no invoices in Draft status for this account.</p>
          </div>
        ) : (
          <>
            {/* Draft invoices table */}
            <div className="csp-table-wrapper" style={{ marginBottom: 16 }}>
              <table className="csp-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Due Date</th>
                    <th>Currency</th>
                    <th className="csp-text-right">Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {draftInvoices.map(inv => (
                    <tr key={inv.id} className="csp-tr-clickable" onClick={() => openInvoiceDetail(inv)}>
                      <td className="csp-td-mono">{inv.invoiceNumber}</td>
                      <td>{formatDate(inv.invoiceDate)}</td>
                      <td>{formatDate(inv.dueDate)}</td>
                      <td>{inv.currencyCode}</td>
                      <td className="csp-text-right" style={{ fontWeight: 500 }}>{formatCurrency(inv.total, inv.currencyCode)}</td>
                      <td><StatusBadge status={inv.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Recipient info */}
            <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: 12 }}>
              Invoices will be sent to:{' '}
              <span style={{ fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                {recipientEmail || 'No email configured'}
              </span>
            </div>

            <div className="csp-form-footer">
              <button className="csp-btn csp-btn-outline" onClick={onClose}>Cancel</button>
              <button
                className="csp-btn csp-btn-primary"
                disabled={!recipientEmail}
                onClick={handlePrepareEmail}
              >
                <Send className="csp-icon-inline" /> Prepare Email
              </button>
            </div>
          </>
        )}
      </Dialog>

      {/* ===== Invoice Detail Sheet ===== */}
      <Sheet open={!!viewInvoice} onClose={() => setViewInvoice(null)}>
        {viewInvoice && (
          <>
            <div className="csp-sheet-header">
              <div className="csp-sheet-title">
                {viewInvoiceForm.invoiceNumber}
                <StatusBadge status={viewInvoiceForm.status} />
              </div>
            </div>

            <div className="csp-form-grid-2">
              <TextField label="Invoice Number" value={viewInvoiceForm.invoiceNumber} onChange={() => {}} readOnly />
              <DateField label="Invoice Date" value={viewInvoiceForm.invoiceDate} onChange={() => {}} />
              <DateField label="Due Date" value={viewInvoiceForm.dueDate} onChange={() => {}} />
              <SelectField label="Currency" value={viewInvoiceForm.currencyCode} onChange={() => {}} options={currencyOptions.map(c => ({ value: c, label: c }))} />
              <TextField label="Total" value={viewInvoiceForm.total} onChange={() => {}} type="number" readOnly />
              <TextField label="VAT Amount" value={viewInvoiceForm.vatAmount} onChange={() => {}} type="number" readOnly />
              <TextField label="VAT Rate %" value={viewInvoiceForm.vatRate} onChange={() => {}} type="number" readOnly />
              <TextField label="RON Total" value={viewInvoiceForm.ronTotalValue} onChange={() => {}} type="number" readOnly />
              <TextField label="RON Conversion Rate" value={viewInvoiceForm.ronConversionRate} onChange={() => {}} type="number" readOnly />
              <DateField label="Payment Received Date" value={viewInvoiceForm.paymentReceivedDate} onChange={() => {}} />
              <TextAreaField label="Comments" value={viewInvoiceForm.comments} onChange={() => {}} rows={2} readOnly className="csp-col-span-2" />
            </div>

            {/* Invoice Lines */}
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, margin: '1.5rem 0 0.5rem', color: 'hsl(var(--primary))' }}>Invoice Lines</h4>
            <div className="csp-table-wrapper">
              <table className="csp-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th className="csp-text-right">Qty</th>
                    <th>UoM</th>
                    <th>Consultant</th>
                    <th className="csp-text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewInvoiceLines.length === 0 ? (
                    <tr><td colSpan={6} className="csp-td-empty">No lines.</td></tr>
                  ) : viewInvoiceLines.map(line => (
                    <tr key={line.id} className="csp-tr-clickable" onClick={() => openLineDetail(line)}>
                      <td>{line.name}</td>
                      <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line.description}</td>
                      <td className="csp-text-right">{line.quantity}</td>
                      <td>{line.unitOfMeasure}</td>
                      <td>{getConsultantName(line.contactId)}</td>
                      <td className="csp-text-right" style={{ fontWeight: 500 }}>{formatCurrency(line.amount, line.currencyCode)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="csp-form-footer">
              <button className="csp-btn csp-btn-outline" onClick={() => setViewInvoice(null)}>Close</button>
            </div>
          </>
        )}
      </Sheet>

      {/* ===== Invoice Line Detail Dialog ===== */}
      <Dialog open={!!viewLine} onClose={() => setViewLine(null)} title="Invoice Line Details" maxWidth="36rem">
        {viewLine && (
          <>
            <div className="csp-form-grid-2">
              <TextField label="Name" value={lineForm.name || ''} onChange={() => {}} readOnly />
              <TextField label="Invoice" value={lineForm.invoiceId || ''} onChange={() => {}} readOnly />
              <TextAreaField label="Description" value={lineForm.description || ''} onChange={() => {}} rows={3} readOnly className="csp-col-span-2" />
              <LookupField label="Consultant" value={lineForm.contactId || ''} onChange={v => setLineForm(prev => ({ ...prev, contactId: v }))} options={consultantOptions} />
              <SelectField label="Unit of Measure" value={lineForm.unitOfMeasure || 'Day'} onChange={v => setLineForm(prev => ({ ...prev, unitOfMeasure: v }))} options={uomOptions.map(u => ({ value: u, label: u }))} />
              <TextField label="Quantity" value={lineForm.quantity || ''} onChange={() => {}} type="number" readOnly />
              <TextField label="Line Total" value={lineForm.lineTotal || ''} onChange={() => {}} type="number" readOnly />
            </div>
            <div className="csp-form-footer">
              <button className="csp-btn csp-btn-outline" onClick={() => setViewLine(null)}>Close</button>
            </div>
          </>
        )}
      </Dialog>

      {/* ===== Email Compose Dialog ===== */}
      <Dialog open={emailOpen} onClose={() => !sending && setEmailOpen(false)} title="Compose Email" maxWidth="42rem">
        {sending ? (
          <div style={{ padding: '2rem 0' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <span style={{ color: 'hsl(var(--primary))', display: 'inline-block' }}>
                <Send className="csp-icon-lg" />
              </span>
              <p style={{ fontWeight: 500, fontSize: '0.875rem', marginTop: 8 }}>{sendLabel}</p>
            </div>
            <div style={{ height: 12, backgroundColor: 'hsl(var(--muted))', borderRadius: 6, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${sendProgress}%`,
                  height: '100%',
                  backgroundColor: 'hsl(var(--primary))',
                  transition: 'width 300ms',
                }}
              />
            </div>
            <p className="csp-text-muted" style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: 6 }}>{sendProgress}%</p>
          </div>
        ) : (
          <>
            <div className="csp-form-grid-2" style={{ gridTemplateColumns: '1fr' }}>
              <TextField label="To" value={recipientEmail} onChange={() => {}} readOnly />

              {/* CC Contacts */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.6875rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))' }}>CC</label>
                <div style={{ border: '1px solid hsl(var(--border))', borderRadius: '0.375rem', padding: '0.5rem', minHeight: '2.5rem' }}>
                  {ccContactIds.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
                      {ccContactIds.map(id => {
                        const c = accountContacts.find(ct => ct.id === id);
                        if (!c) return null;
                        return (
                          <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.125rem 0.5rem', borderRadius: '0.25rem', backgroundColor: 'hsl(var(--muted))', fontSize: '0.75rem' }}>
                            {c.name}
                            <button onClick={() => setCcContactIds(prev => prev.filter(x => x !== id))} style={{ cursor: 'pointer', padding: 0, border: 'none', background: 'none', color: 'hsl(var(--muted-foreground))' }}>{'×'}</button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <select
                    value=""
                    onChange={e => { if (e.target.value && !ccContactIds.includes(e.target.value)) setCcContactIds(prev => [...prev, e.target.value]); }}
                    style={{ width: '100%', border: 'none', outline: 'none', fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', backgroundColor: 'transparent' }}
                  >
                    <option value="">Add contacts to CC...</option>
                    {ccContactOptions.filter(o => !ccContactIds.includes(o.value)).map(o => (
                      <option key={o.value} value={o.value}>{o.label} {'—'} {o.email}</option>
                    ))}
                  </select>
                </div>
                {ccContactIds.length > 0 && (
                  <p style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>
                    CC: {ccContactIds.map(id => accountContacts.find(ct => ct.id === id)?.email).filter(Boolean).join(', ')}
                  </p>
                )}
              </div>

              <TextField label="Subject" value={emailSubject} onChange={setEmailSubject} required placeholder="Invoice subject..." />
              <TextAreaField label="Body" value={emailBody} onChange={setEmailBody} rows={6} required placeholder="Write your email message..." />
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
                Attachments ({draftInvoices.length})
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {draftInvoices.map(inv => (
                  <div
                    key={inv.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 6, border: '1px solid hsl(var(--border))', padding: 10, backgroundColor: 'hsl(var(--muted) / 0.3)' }}
                  >
                    <span style={{ color: 'hsl(0, 84%, 60%)', flexShrink: 0 }}><FileText className="csp-icon-inline" /></span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, flex: 1 }}>{inv.invoiceNumber}.pdf</span>
                    <span className="csp-text-muted" style={{ fontSize: '0.75rem' }}>{formatCurrency(inv.total, inv.currencyCode)}</span>
                    <button className="csp-btn csp-btn-ghost csp-btn-sm" onClick={() => handlePreviewPdf(inv)}>
                      <Eye className="csp-icon-inline" /> Preview
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="csp-form-footer">
              <button className="csp-btn csp-btn-outline" onClick={() => setEmailOpen(false)}>Cancel</button>
              <button className="csp-btn csp-btn-primary" disabled={sendDisabled} onClick={handleSend}>
                {sending ? <Loader2 className="csp-icon-inline csp-animate-spin" /> : <Send className="csp-icon-inline" />}
                Send
              </button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
