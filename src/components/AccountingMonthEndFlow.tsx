import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { Dialog, Sheet, useToast } from './Layout';
import { StatusBadge } from './Shared';
import { SelectField, TextField, DateField, LookupField, TextAreaField } from './FormFields';
import { FileText, Send, AlertCircle, Mail } from './Icons';
import { sendOutlookEmail, blobToBase64 } from './invoice/sendEmail';
import { generateInvoicePdf, type PdfEntity, type PdfAccount, type PdfLine } from './invoice/generateInvoicePdf';
import { fetchLinesByInvoiceId } from '../services/invoiceLineService';
import { fetchInvoices } from '../services/invoiceService';
import { fetchAccounts } from '../services/accountService';
import { fetchContacts } from '../services/contactService';
import { fetchContracts } from '../services/contractService';
import { fetchBusinessUnits } from '../services/businessUnitService';
import type { BusinessUnit } from '../services/businessUnitService';
import { useDataverse } from '../services/useDataverse';
import { formatCurrency, formatDate } from '../lib/utils';
import type { Invoice, InvoiceLine, Account, Contact, Contract, CurrencyCode, UnitOfMeasure } from '../types/crm';

const currencyOptions: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'RON'];
const uomOptions: UnitOfMeasure[] = ['Day', 'Hour', 'Month', 'Fixed'];

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

interface AccountingMonthEndFlowProps {
  open: boolean;
  onClose: () => void;
}

function ChecklistItem({ text }: { text: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <label className="csp-checklist-item" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: '0.875rem' }}>
      <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ marginTop: 2 }} />
      <span style={checked ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}>{text}</span>
    </label>
  );
}

export function AccountingMonthEndFlow({ open, onClose }: AccountingMonthEndFlowProps) {
  const { toast } = useToast();

  const { data: dvInvoices } = useDataverse<Invoice>(fetchInvoices, []);
  const { data: dvAccounts } = useDataverse<Account>(fetchAccounts, []);
  const { data: dvContacts } = useDataverse<Contact>(fetchContacts, []);
  const { data: dvContracts } = useDataverse<Contract>(fetchContracts, []);
  const { data: dvBusinessUnits } = useDataverse<BusinessUnit>(fetchBusinessUnits, []);

  const consultantOptions = useMemo(() =>
    dvContacts.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })),
  [dvContacts]);

  const entityOptions = useMemo(() =>
    dvBusinessUnits.filter(b => !b.isRoot).map(b => ({ value: b.id, label: b.name })),
  [dvBusinessUnits]);

  const defaultEntityId = useMemo(() => {
    const romania = dvBusinessUnits.find(b => (b.name || '').toLowerCase().includes('romania'));
    return romania?.id || dvBusinessUnits.find(b => !b.isRoot)?.id || '';
  }, [dvBusinessUnits]);

  // Filter state
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(currentYear));
  const [entityId, setEntityId] = useState('');
  React.useEffect(() => { if (!entityId && defaultEntityId) setEntityId(defaultEntityId); }, [defaultEntityId, entityId]);
  const [showList, setShowList] = useState(false);

  // Invoice detail
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [viewInvoiceForm, setViewInvoiceForm] = useState<Record<string, any>>({});
  const [viewInvoiceLines, setViewInvoiceLines] = useState<InvoiceLine[]>([]);

  // Line detail dialog
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

  const filteredInvoices = useMemo(() => {
    if (!showList || !entityId) return [];
    const m = Number(month);
    const y = Number(year);
    return dvInvoices.filter(inv => {
      if (inv.entityId !== entityId) return false;
      const d = new Date(inv.invoiceDate);
      return d.getMonth() + 1 === m && d.getFullYear() === y;
    });
  }, [showList, entityId, month, year, dvInvoices]);

  const entity = entityId ? dvBusinessUnits.find(b => b.id === entityId) : null;
  const entityName = entity?.name || '';
  const entityEmail = useMemo(() => {
    if (!entity) return '';
    const raw = (entity.raw || {}) as Record<string, any>;
    const name = (entity.name || '').toLowerCase();
    if (name.includes('bulgaria')) return raw.csp_bgaccountantemail || raw.csp_bgemail || '';
    if (name.includes('us')) return raw.csp_usaccountantemail || raw.csp_usemail || '';
    return raw.csp_roaccountantemail || raw.csp_roemail || '';
  }, [entity]);

  const handleShowInvoices = () => {
    if (!entityId) {
      toast.error('Please select a country');
      return;
    }
    setShowList(true);
  };

  const openInvoiceDetail = async (inv: Invoice) => {
    setViewInvoice(inv);
    setViewInvoiceLines([...(inv.lines || [])]);
    setViewInvoiceForm({
      invoiceNumber: inv.invoiceNumber, entityId: inv.entityId, accountId: inv.accountId,
      contractId: inv.contractId || '', currencyCode: inv.currencyCode,
      invoiceDate: inv.invoiceDate, dueDate: inv.dueDate,
      vatRate: inv.vatRate.toString(), vatAmount: inv.vatAmount.toString(),
      total: inv.total.toString(), ronTotalValue: inv.ronTotal?.toString() || '',
      ronConversionRate: inv.ronConversionRate?.toString() || '',
      comments: inv.comments || '', status: inv.status,
      paymentReceivedDate: inv.paymentReceivedDate || '',
    });
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
        unitOfMeasure: 'Day' as InvoiceLine['unitOfMeasure'],
        contactId: r.consultantId || undefined,
        contractId: r.contractId || undefined,
      }));
      setViewInvoiceLines(lines);
    } catch (err) {
      console.error('[AccountingMonthEnd] Failed to fetch lines:', err);
      setViewInvoiceLines([]);
    }
  };

  const openLineDetail = (line: InvoiceLine) => {
    setViewLine(line);
    setLineForm({
      name: line.name || line.description?.substring(0, 30) || 'Line',
      invoiceId: viewInvoiceForm.invoiceNumber || '',
      description: line.description,
      quantity: line.quantity.toString(),
      unitOfMeasure: line.unitOfMeasure,
      contactId: line.contactId || '',
      lineTotal: line.amount.toString(),
    });
  };

  const handlePrepareEmail = () => {
    const monthLabel = months.find(m => m.value === month)?.label || month;
    setEmailSubject(`${monthLabel} ${year} Invoices — ${entityName || 'Cloud Solutions Partners'}`);
    setEmailBody('');
    setEmailOpen(true);
  };

  const buildPdfEntity = useCallback((buId: string): PdfEntity => {
    const bu = dvBusinessUnits.find(b => b.id === buId);
    if (!bu) return { name: '', country: '', address: '', email: '', phone: '', vatNumber: '', bankName: '', iban: '', swift: '' };
    const raw = (bu.raw || {}) as Record<string, any>;
    const name = (bu.name || '').toLowerCase();
    if (name.includes('bulgaria')) {
      return {
        name: raw.csp_bglegalname || 'CLOUD SOLUTIONS PARTNERS EOOD',
        country: 'Bulgaria',
        address: raw.csp_bgaddress || '',
        email: raw.csp_bgemail || '',
        phone: raw.csp_bgphone || '',
        vatNumber: raw.csp_bgvatnumber || '',
        bankName: raw.csp_bgeubankname || '',
        iban: raw.csp_bgeuiban || '',
        swift: raw.csp_bgeuswiftbic || '',
        intermediaryBic: raw.csp_bgukintermediarybic || '',
        ukBankName: raw.csp_bgukbankname || '',
        ukAccountNumber: raw.csp_bgukaccountnumber || '',
        ukSortCode: raw.csp_bguksortcode || '',
        ukIban: raw.csp_bgukiban || '',
        ukSwift: raw.csp_bgukswiftbic || '',
        ukIntermediaryBic: raw.csp_bgukintermediarybic || '',
      };
    }
    if (name.includes('us')) {
      return {
        name: raw.csp_uslegalname || 'CLOUD SOLUTIONS PARTNERS LLC',
        country: 'US',
        address: raw.csp_usaddress || '',
        email: raw.csp_usemail || '',
        phone: raw.csp_usphone || '',
        vatNumber: raw.csp_usvatnumber || '',
        bankName: raw.csp_usbankname || '',
        iban: '',
        swift: '',
        usAccountNumber: raw.csp_usaccountnumber || '',
        usAchRoutingNumber: raw.csp_usachroutingnumber || '',
        usWireRoutingNumber: raw.csp_uswireroutingnumber || '',
      };
    }
    return {
      name: raw.csp_rolegalname || 'CLOUD SOLUTIONS PARTNERS S.R.L.',
      country: 'Romania',
      address: raw.csp_roaddress || '',
      email: raw.csp_roemail || '',
      phone: raw.csp_rophone || '',
      vatNumber: raw.csp_rovatnumber || '',
      bankName: raw.csp_robankname || '',
      iban: raw.csp_roiban || '',
      swift: raw.csp_roswiftbic || '',
    };
  }, [dvBusinessUnits]);

  const handleSend = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) return;
    const recipient = entityEmail;
    if (!recipient) {
      toast.error('No recipient email configured on the entity');
      return;
    }

    setSending(true);
    try {
      const total = filteredInvoices.length;
      const attachments: { name: string; contentBytes: string }[] = [];

      for (let i = 0; i < total; i++) {
        const inv = filteredInvoices[i];
        setSendProgress(Math.round((i / total) * 60));
        setSendLabel(`Generating PDF ${i + 1}/${total}: ${inv.invoiceNumber}...`);

        const pdfEntity = buildPdfEntity(inv.entityId);
        const acc = dvAccounts.find(a => a.id === inv.accountId);
        const pdfAccount: PdfAccount = {
          name: acc?.name || 'Unknown',
          street1: acc?.street1 || '',
          street2: acc?.street2 || '',
          street3: acc?.street3 || '',
          city: acc?.city || '',
          stateProvince: acc?.stateProvince || '',
          postalCode: acc?.postalCode || '',
          country: acc?.country || '',
          vatNumber: acc?.vatNumber || '',
          registrationNumber: acc?.registrationNumber || '',
          invoiceFooter: acc?.invoiceFooter || '',
        };

        const lines = await fetchLinesByInvoiceId(inv.id);
        const pdfLines: PdfLine[] = lines.map(line => {
          const consultant = line.consultantId ? dvContacts.find(c => c.id === line.consultantId) : null;
          const consultantName = consultant ? `${consultant.firstName} ${consultant.lastName}` : '';
          const qty = line.quantity || 0;
          const rate = qty > 0 ? line.lineTotal / qty : 0;
          return {
            description: line.description || line.name || '',
            consultantName,
            quantity: qty,
            unitOfMeasure: line.unitOfMeasure || 'Day',
            rate,
            currencyCode: inv.currencyCode || 'EUR',
            amount: line.lineTotal || 0,
          };
        });

        const pdfBlob = await generateInvoicePdf(inv, pdfEntity, pdfAccount, pdfLines);
        const base64 = await blobToBase64(pdfBlob);
        attachments.push({ name: `${inv.invoiceNumber}.pdf`, contentBytes: base64 });
      }

      setSendProgress(70);
      setSendLabel(`Sending via Outlook to ${recipient}...`);

      const htmlBody = emailBody
        .split('\n')
        .map(line => `<p>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;') || '&nbsp;'}</p>`)
        .join('');

      await sendOutlookEmail({
        to: recipient,
        subject: emailSubject,
        htmlBody,
        attachments,
      });

      setSendProgress(100);
      setSendLabel('Complete!');
      await new Promise(r => setTimeout(r, 400));
      toast.success(`${total} invoice(s) sent to ${recipient}`);
      setSending(false);
      setSendProgress(0);
      setSendLabel('');
      setEmailOpen(false);
      setShowList(false);
      onClose();
    } catch (error: any) {
      console.error('[AccountingMonthEnd] Send failed:', error);
      setSending(false);
      setSendProgress(0);
      setSendLabel('');
      toast.error(`Failed: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleClose = () => {
    setShowList(false);
    onClose();
  };

  const sendDisabled = !emailSubject.trim() || !emailBody.trim();

  return (
    <>
      {/* Main Dialog: Month/Year/Country picker + invoice list */}
      <Dialog open={open && !viewInvoice} onClose={handleClose} title="Accounting Month End" maxWidth="800px">
        {!showList ? (
          <div>
            <div className="csp-form-grid csp-form-grid-3">
              <SelectField label="Month" value={month} onChange={setMonth} required options={months} />
              <SelectField label="Year" value={year} onChange={setYear} required options={years} />
              <SelectField label="Country" value={entityId} onChange={setEntityId} required options={entityOptions} />
            </div>
            <div className="csp-dialog-footer">
              <button className="csp-btn csp-btn-outline" onClick={handleClose}>Cancel</button>
              <button className="csp-btn csp-btn-primary" onClick={handleShowInvoices}>Show Invoices</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: '0.875rem' }}>
              <span className="csp-badge csp-badge-outline">{months.find(m => m.value === month)?.label} {year}</span>
              <span className="csp-badge csp-badge-outline">{entityName}</span>
              <button className="csp-btn csp-btn-ghost csp-btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowList(false)}>Change filters</button>
            </div>

            {filteredInvoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }} className="csp-text-muted">
                <span style={{ display: 'block', margin: '0 auto 12px', opacity: 0.4 }}><FileText className="csp-icon-lg" /></span>
                <p style={{ fontWeight: 500 }}>No invoices found</p>
                <p style={{ fontSize: '0.875rem' }}>No invoices match the selected month, year, and country.</p>
              </div>
            ) : (
              <>
                <div className="csp-table-wrapper">
                  <table className="csp-table">
                    <thead>
                      <tr>
                        <th className="csp-th">Invoice #</th>
                        <th className="csp-th">Account</th>
                        <th className="csp-th">Date</th>
                        <th className="csp-th">Due Date</th>
                        <th className="csp-th">Currency</th>
                        <th className="csp-th csp-text-right">Total</th>
                        <th className="csp-th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map(inv => (
                        <tr key={inv.id} className="csp-tr" style={{ cursor: 'pointer' }} onClick={() => openInvoiceDetail(inv)}>
                          <td className="csp-td csp-td-link" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{inv.invoiceNumber}</td>
                          <td className="csp-td">{dvAccounts.find(a => a.id === inv.accountId)?.name}</td>
                          <td className="csp-td">{formatDate(inv.invoiceDate)}</td>
                          <td className="csp-td">{formatDate(inv.dueDate)}</td>
                          <td className="csp-td">{inv.currencyCode}</td>
                          <td className="csp-td csp-text-right" style={{ fontWeight: 500 }}>{formatCurrency(inv.total, inv.currencyCode)}</td>
                          <td className="csp-td"><StatusBadge status={inv.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pre-send Checklist */}
                <div className="csp-checklist-box">
                  <h4 className="csp-checklist-title">
                    <span style={{ color: '#f59e0b' }}><AlertCircle className="csp-icon-inline" /></span>
                    Pre-send Checklist
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <ChecklistItem text="Ensure that the correct consultants have been assigned to the invoices" />
                    <ChecklistItem text="Ensure that the invoice lines have the correct descriptions" />
                    <ChecklistItem text="Ensure that the amounts are correct" />
                    <ChecklistItem text="If sending to a Romanian vendor, ensure that you have the correct RON Exchange and RON total" />
                  </div>
                </div>

                <div style={{ marginTop: 12, fontSize: '0.875rem' }} className="csp-text-muted">
                  Email will be sent to: <span style={{ fontWeight: 500 }} className="csp-text-foreground">{entityEmail || 'No email configured'}</span>
                </div>

                <div className="csp-dialog-footer">
                  <button className="csp-btn csp-btn-outline" onClick={handleClose}>Cancel</button>
                  <button className="csp-btn csp-btn-primary" onClick={handlePrepareEmail}>
                    <Send className="csp-icon-inline" /> Prepare Email
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Dialog>

      {/* Invoice Detail Sheet (read-only) */}
      <Sheet open={!!viewInvoice} onClose={() => setViewInvoice(null)} title={viewInvoiceForm.invoiceNumber || 'Invoice Detail'} width="42rem">
        {viewInvoice && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '1rem', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }} className="csp-text-muted">Status</span>
              <StatusBadge status={viewInvoiceForm.status} />
            </div>
            <div className="csp-form-grid-2" style={{ gap: '1rem 2rem' }}>
              <LookupField label="Account" value={viewInvoiceForm.accountId} onChange={() => {}} options={dvAccounts.map(a => ({ value: a.id, label: a.name }))} />
              <LookupField label="Parent Account" value={viewInvoiceForm.parentAccountId || ''} onChange={() => {}} options={dvAccounts.map(a => ({ value: a.id, label: a.name }))} />
              <LookupField label="Contract" value={viewInvoiceForm.contractId} onChange={() => {}} options={dvContracts.map(c => ({ value: c.id, label: c.contractNumber }))} />
              <DateField label="Payment Received Date" value={viewInvoiceForm.paymentReceivedDate} onChange={() => {}} />
              <DateField label="Invoice Date" value={viewInvoiceForm.invoiceDate} onChange={() => {}} />
              <SelectField label="Currency" value={viewInvoiceForm.currencyCode} onChange={() => {}} options={currencyOptions.map(c => ({ value: c, label: c }))} />
              <DateField label="Due Date" value={viewInvoiceForm.dueDate} onChange={() => {}} />
              <TextField label="Total" value={viewInvoiceForm.total} onChange={() => {}} type="number" readOnly />
              <TextField label="VAT Amount" value={viewInvoiceForm.vatAmount} onChange={() => {}} type="number" readOnly />
              <TextField label="RON Total Value" value={viewInvoiceForm.ronTotalValue} onChange={() => {}} type="number" readOnly />
              <TextField label="VAT Rate %" value={viewInvoiceForm.vatRate} onChange={() => {}} type="number" readOnly />
              <TextField label="RON Conversion Rate" value={viewInvoiceForm.ronConversionRate} onChange={() => {}} type="number" readOnly />
              <TextAreaField label="Comments" value={viewInvoiceForm.comments} onChange={() => {}} rows={2} readOnly />
              <LookupField label="Country" value={viewInvoiceForm.entityId} onChange={() => {}} options={entityOptions} />
            </div>

            {/* Invoice Lines */}
            <div className="csp-form-section csp-mt-4">
              <h3 className="csp-section-title">Invoice Lines</h3>
              <div className="csp-table-wrapper">
                <table className="csp-table csp-table-compact">
                  <thead>
                    <tr>
                      <th className="csp-th">Name</th>
                      <th className="csp-th">Description</th>
                      <th className="csp-th">Qty</th>
                      <th className="csp-th">UoM</th>
                      <th className="csp-th">Consultant</th>
                      <th className="csp-th csp-text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewInvoiceLines.length === 0 ? (
                      <tr><td colSpan={6} className="csp-td csp-text-center csp-text-muted" style={{ padding: '1rem' }}>No lines.</td></tr>
                    ) : viewInvoiceLines.map(line => (
                      <tr key={line.id} className="csp-tr" style={{ cursor: 'pointer' }} onClick={() => openLineDetail(line)}>
                        <td className="csp-td">{line.name || `Line`}</td>
                        <td className="csp-td" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line.description}</td>
                        <td className="csp-td">{line.quantity}</td>
                        <td className="csp-td">{line.unitOfMeasure}</td>
                        <td className="csp-td">{line.contactId ? consultantOptions.find(c => c.value === line.contactId)?.label || '—' : '—'}</td>
                        <td className="csp-td csp-text-right" style={{ fontWeight: 500 }}>{formatCurrency(line.amount, line.currencyCode)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="csp-sheet-footer">
              <button className="csp-btn csp-btn-outline" onClick={() => setViewInvoice(null)}>Close</button>
            </div>
          </>
        )}
      </Sheet>

      {/* Invoice Line Detail Dialog (read-only) */}
      <Dialog open={!!viewLine} onClose={() => setViewLine(null)} title="Invoice Line Details" maxWidth="42rem">
        {viewLine && (
          <div className="csp-form-grid-2" style={{ gap: '1rem 2rem', padding: '1rem 0' }}>
            <TextField label="Name" value={lineForm.name || ''} onChange={() => {}} readOnly />
            <TextField label="Invoice" value={lineForm.invoiceId || ''} onChange={() => {}} readOnly />
            <TextAreaField label="Description" value={lineForm.description || ''} onChange={() => {}} rows={4} readOnly />
            <LookupField label="Consultant" value={lineForm.contactId || ''} onChange={() => {}} options={consultantOptions} />
            <TextField label="Quantity" value={lineForm.quantity || ''} onChange={() => {}} type="number" readOnly />
            <TextField label="Line Total" value={lineForm.lineTotal || ''} onChange={() => {}} type="number" readOnly />
            <SelectField label="Unit of Measure" value={lineForm.unitOfMeasure || 'Day'} onChange={() => {}} options={uomOptions.map(u => ({ value: u, label: u }))} />
          </div>
        )}
        <div className="csp-dialog-footer">
          <button className="csp-btn csp-btn-outline" onClick={() => setViewLine(null)}>Close</button>
        </div>
      </Dialog>

      {/* Email Compose Dialog */}
      <Dialog open={emailOpen} onClose={() => setEmailOpen(false)} title="Compose Email" maxWidth="700px">
        {sending ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <span style={{ display: 'block', margin: '0 auto 12px', animation: 'pulse 1.5s infinite' }}><Send className="csp-icon-lg" /></span>
            <p style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: 12 }}>{sendLabel}</p>
            <div className="csp-progress" style={{ height: 10 }}>
              <div className="csp-progress-bar" style={{ width: `${sendProgress}%` }}></div>
            </div>
            <p style={{ fontSize: '0.75rem', marginTop: 8 }} className="csp-text-muted">{sendProgress}%</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="csp-form-field">
                <label className="csp-field-label">To</label>
                <input className="csp-input csp-input-readonly" value={entityEmail} readOnly />
              </div>
              <div className="csp-form-field">
                <label className="csp-field-label">Subject <span className="csp-required">*</span></label>
                <input className="csp-input" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Email subject..." />
              </div>
              <div className="csp-form-field">
                <label className="csp-field-label">Body <span className="csp-required">*</span></label>
                <textarea className="csp-textarea" value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Email body..." rows={6} />
              </div>

              {/* PDF Attachment placeholders */}
              <div className="csp-form-field">
                <label className="csp-field-label">Attachments</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {filteredInvoices.map(inv => (
                    <span key={inv.id} className="csp-badge csp-badge-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}>
                      <span style={{ color: '#ef4444' }}><FileText className="csp-icon-inline" /></span>
                      {inv.invoiceNumber}.pdf
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="csp-dialog-footer">
              <button className="csp-btn csp-btn-outline" onClick={() => setEmailOpen(false)}>Cancel</button>
              <button className="csp-btn csp-btn-primary" onClick={handleSend} disabled={sendDisabled}>
                <Send className="csp-icon-inline" /> Send
              </button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
