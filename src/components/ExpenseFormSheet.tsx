import * as React from 'react';
import { useState, useEffect } from 'react';
import { Sheet, ToggleGroup, ToggleGroupItem } from './Layout';
import { useToast } from './Layout';
import { TextField, SelectField, DateField, LookupField } from './FormFields';
import { FileText, Upload, X } from './Icons';
import { entities, accounts, contracts, getAccountById, getContactById, getContractLookupLabel } from '../data/mock-data';
import type { Expense, ExpenseStatus, ExpenseType, CurrencyCode } from '../types/crm';

const expenseTypes: ExpenseType[] = [
  'Contractor Payment', 'Supplier Invoice', 'Tax', 'Permanent Employee',
  'Operating Cost', 'Office Rent', 'Software Subscription',
];
const expenseStatuses: ExpenseStatus[] = ['Pending', 'Approved', 'Paid', 'Rejected'];
const currencyOptions: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'RON'];

interface Props {
  expense: Expense | null;
  isNew?: boolean;
  open: boolean;
  onClose: () => void;
  onSaved?: (formData: Record<string, any>) => void;
}

function buildInitial(expense: Expense | null, isNew: boolean): Record<string, any> {
  if (isNew || !expense) {
    return {
      reference: 'EXP-NEW',
      entityId: entities[0]?.id || '',
      accountId: '',
      expenseType: 'Supplier Invoice' as ExpenseType,
      contractId: '',
      currencyCode: 'EUR' as CurrencyCode,
      totalAmount: '',
      vatAmount: '',
      netAmount: '',
      dateIssued: '',
      dueDate: '',
      paymentDate: '',
      vendorInvoiceNumber: '',
      status: 'Pending' as ExpenseStatus,
      evidenceFile: '',
      periodMonth: '',
      periodYear: '',
    };
  }
  let periodMonth = expense.periodMonth || 0;
  let periodYear = expense.periodYear || 0;
  if ((!periodMonth || !periodYear) && expense.dateIssued) {
    const d = new Date(expense.dateIssued);
    if (!isNaN(d.getTime())) {
      if (!periodMonth) periodMonth = d.getMonth() + 1;
      if (!periodYear) periodYear = d.getFullYear();
    }
  }
  return {
    reference: expense.reference,
    entityId: expense.entityId,
    accountId: expense.accountId,
    expenseType: expense.expenseType,
    contractId: expense.contractId || '',
    currencyCode: expense.currencyCode,
    totalAmount: expense.totalAmount.toString(),
    vatAmount: expense.vatAmount.toString(),
    netAmount: expense.netAmount.toString(),
    dateIssued: expense.dateIssued,
    dueDate: expense.dueDate,
    paymentDate: expense.paymentDate || '',
    vendorInvoiceNumber: expense.vendorInvoiceNumber || '',
    status: expense.status,
    evidenceFile: expense.vendorInvoiceNumber ? `${expense.reference}_evidence.pdf` : '',
    periodMonth: periodMonth.toString(),
    periodYear: periodYear.toString(),
  };
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'hsl(var(--primary))',
  borderBottom: '1px solid hsl(var(--border))',
  paddingBottom: '0.25rem',
  marginBottom: '0.75rem',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '1rem 2rem',
};

export function ExpenseFormSheet({ expense, isNew = false, open, onClose, onSaved }: Props) {
  const [formData, setFormData] = useState<Record<string, any>>(() => buildInitial(expense, isNew));
  const { toast } = useToast();

  useEffect(() => {
    if (open) setFormData(buildInitial(expense, isNew));
  }, [open, expense, isNew]);

  const updateField = (key: string, value: any) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleDueDateChange = (value: string) => {
    updateField('dueDate', value);
    if (value && formData.dateIssued && new Date(value) < new Date(formData.dateIssued)) {
      toast.error('Due Date is before Date Issued');
    }
  };

  const handleDateIssuedChange = (value: string) => {
    setFormData(prev => {
      const next: Record<string, any> = { ...prev, dateIssued: value };
      if (value) {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
          next.periodMonth = String(d.getMonth() + 1);
          next.periodYear = String(d.getFullYear());
        }
      }
      return next;
    });
    if (value && formData.dueDate && new Date(formData.dueDate) < new Date(value)) {
      toast.error('Due Date is before Date Issued — please update Due Date');
    }
  };

  const saveForm = () => {
    if (formData.dueDate && formData.dateIssued && new Date(formData.dueDate) < new Date(formData.dateIssued)) {
      toast.error('Due Date cannot be before Date Issued');
      return;
    }
    let { periodMonth, periodYear } = formData;
    if ((!periodMonth || !periodYear || periodMonth === '0' || periodYear === '0') && formData.dateIssued) {
      const d = new Date(formData.dateIssued);
      if (!isNaN(d.getTime())) {
        if (!periodMonth || periodMonth === '0') periodMonth = String(d.getMonth() + 1);
        if (!periodYear || periodYear === '0') periodYear = String(d.getFullYear());
      }
    }
    const payload: Record<string, any> = { ...formData, periodMonth, periodYear };
    toast.success(isNew ? `Expense "${payload.reference}" created` : `Expense "${payload.reference}" saved`);
    onSaved?.(payload);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={isNew ? 'New Expense' : formData.reference} width="42rem">
      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <span className="csp-text-xs csp-text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>Status</span>
        <ToggleGroup value={formData.status} onChange={(v) => updateField('status', v)}>
          {expenseStatuses.map((s) => (
            <ToggleGroupItem key={s} value={s}>{s}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* General */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={sectionHeaderStyle}>General</h3>
        <div style={gridStyle}>
          <TextField label="Reference" value={formData.reference} onChange={(v) => updateField('reference', v)} required readOnly />
          <SelectField
            label="Type"
            value={formData.expenseType}
            onChange={(v) => updateField('expenseType', v)}
            required
            options={expenseTypes.map((t) => ({ value: t, label: t }))}
          />
          <LookupField
            label="Vendor"
            value={formData.accountId}
            onChange={(v) => {
              updateField('accountId', v);
              // Clear contract if it doesn't belong to new vendor
              if (formData.contractId) {
                const curr = contracts.find(c => c.id === formData.contractId);
                if (curr && curr.parentAccountId !== v && curr.childAccountId !== v) {
                  updateField('contractId', '');
                }
              }
            }}
            required
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          />
          <div style={{ gridColumn: 'span 2' }}>
            <LookupField
              label="Contract"
              value={formData.contractId}
              onChange={(v) => updateField('contractId', v)}
              options={contracts
                .filter(c => !formData.accountId || c.parentAccountId === formData.accountId || c.childAccountId === formData.accountId)
                .map(c => ({ value: c.id, label: getContractLookupLabel(c) }))}
            />
          </div>
        </div>
      </div>

      {/* Financials */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={sectionHeaderStyle}>Financials</h3>
        <div style={gridStyle}>
          <TextField label="Total Amount" value={formData.totalAmount} onChange={(v) => updateField('totalAmount', v)} required type="number" />
          <TextField label="VAT" value={formData.vatAmount} onChange={(v) => updateField('vatAmount', v)} type="number" />
          <TextField label="Net Amount" value={formData.netAmount} onChange={(v) => updateField('netAmount', v)} type="number" />
          <SelectField
            label="Currency"
            value={formData.currencyCode}
            onChange={(v) => updateField('currencyCode', v)}
            required
            options={currencyOptions.map((c) => ({ value: c, label: c }))}
          />
        </div>
      </div>

      {/* Dates */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={sectionHeaderStyle}>Dates</h3>
        <div style={gridStyle}>
          <DateField label="Date Issued" value={formData.dateIssued} onChange={handleDateIssuedChange} required />
          <DateField label="Due Date" value={formData.dueDate} onChange={handleDueDateChange} />
          <DateField label="Payment Date" value={formData.paymentDate} onChange={(v) => updateField('paymentDate', v)} />
          <TextField label="Vendor Invoice #" value={formData.vendorInvoiceNumber} onChange={(v) => updateField('vendorInvoiceNumber', v)} />
        </div>
      </div>

      {/* Period */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={sectionHeaderStyle}>Period</h3>
        <div style={gridStyle}>
          <LookupField
            label="Country"
            value={formData.entityId}
            onChange={(v) => updateField('entityId', v)}
            required
            options={entities.map((e) => ({ value: e.id, label: e.country }))}
          />
          <TextField label="Period Month" value={formData.periodMonth} onChange={() => {}} readOnly type="number" />
          <TextField label="Period Year" value={formData.periodYear} onChange={() => {}} readOnly type="number" />
        </div>
      </div>

      {/* Evidence */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={sectionHeaderStyle}>Evidence</h3>
        {formData.evidenceFile ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid hsl(var(--border))',
              backgroundColor: 'hsl(var(--muted) / 0.3)',
            }}
          >
            <span style={{ color: 'hsl(var(--primary))', display: 'flex', flexShrink: 0 }}>
              <FileText className="csp-icon" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {formData.evidenceFile}
              </p>
              <p className="csp-text-xs csp-text-muted">PDF document</p>
            </div>
            <button
              className="csp-btn-ghost"
              style={{ width: '1.75rem', height: '1.75rem', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              onClick={() => updateField('evidenceFile', '')}
            >
              <X className="csp-icon" />
            </button>
          </div>
        ) : (
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '1.5rem',
              borderRadius: '0.5rem',
              border: '2px dashed hsl(var(--muted-foreground) / 0.3)',
              cursor: 'pointer',
              transition: 'border-color 0.2s, background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)';
              e.currentTarget.style.backgroundColor = 'hsl(var(--muted) / 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'hsl(var(--muted-foreground) / 0.3)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span className="csp-text-muted" style={{ display: 'flex' }}>
              <Upload className="csp-icon" />
            </span>
            <span className="csp-text-muted" style={{ fontSize: '0.875rem' }}>Click to upload PDF evidence</span>
            <span className="csp-text-muted" style={{ fontSize: '0.75rem', opacity: 0.6 }}>PDF files only</span>
            <input
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) updateField('evidenceFile', file.name);
              }}
            />
          </label>
        )}
      </div>

      {/* Footer */}
      <div className="csp-sheet-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid hsl(var(--border))' }}>
        <button className="csp-btn csp-btn-secondary" onClick={onClose}>Cancel</button>
        <button className="csp-btn csp-btn-primary" onClick={saveForm}>Save</button>
      </div>
    </Sheet>
  );
}
