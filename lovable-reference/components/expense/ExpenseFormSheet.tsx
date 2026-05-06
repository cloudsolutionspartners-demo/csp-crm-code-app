import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { TextField, SelectField, DateField, LookupField } from '@/components/FormField';
import { FileText, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { entities, accounts, contracts, expenses, getAccountById, getContactById } from '@/data/mock-data';
import type { Expense, ExpenseStatus, ExpenseType, CurrencyCode } from '@/types/crm';

const expenseTypes: ExpenseType[] = ['Contractor Payment', 'Supplier Invoice', 'Tax', 'Employee Salary', 'Operating Cost', 'Software / Subscription'];
const expenseStatuses: ExpenseStatus[] = ['Received', 'Paid', 'Overdue'];
const currencyOptions: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'RON'];

interface Props {
  expense: Expense | null;
  isNew?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (formData: Record<string, any>) => void;
}

function buildInitial(expense: Expense | null, isNew: boolean): Record<string, any> {
  if (isNew || !expense) {
    return {
      reference: `EXP-NEW`, entityId: entities[0]?.id || '',
      accountId: '', expenseType: 'Supplier Invoice', contractId: '',
      currencyCode: 'EUR',
      totalAmount: '', vatAmount: '', netAmount: '', dateIssued: '', dueDate: '',
      paymentDate: '', vendorInvoiceNumber: '', status: 'Received', evidenceFile: '',
      periodMonth: '', periodYear: '',
    };
  }
  return {
    reference: expense.reference, entityId: expense.entityId, accountId: expense.accountId,
    expenseType: expense.expenseType, contractId: expense.contractId || '',
    currencyCode: expense.currencyCode,
    totalAmount: expense.totalAmount.toString(), vatAmount: expense.vatAmount.toString(),
    netAmount: expense.netAmount.toString(), dateIssued: expense.dateIssued,
    dueDate: expense.dueDate, paymentDate: expense.paymentDate || '',
    vendorInvoiceNumber: expense.vendorInvoiceNumber || '', status: expense.status,
    evidenceFile: expense.vendorInvoiceNumber ? `${expense.reference}_evidence.pdf` : '',
    periodMonth: expense.periodMonth.toString(), periodYear: expense.periodYear.toString(),
  };
}

export function ExpenseFormSheet({ expense, isNew = false, open, onOpenChange, onSaved }: Props) {
  const [formData, setFormData] = useState<Record<string, any>>(() => buildInitial(expense, isNew));

  useEffect(() => {
    if (open) setFormData(buildInitial(expense, isNew));
  }, [open, expense, isNew]);

  const updateField = (key: string, value: any) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const close = () => onOpenChange(false);

  const saveForm = () => {
    if (!isNew && expense) {
      const idx = expenses.findIndex(e => e.id === expense.id);
      if (idx !== -1) {
        expenses[idx] = {
          ...expenses[idx],
          status: formData.status as ExpenseStatus,
          expenseType: formData.expenseType as ExpenseType,
          accountId: formData.accountId,
          contractId: formData.contractId || undefined,
          currencyCode: formData.currencyCode as CurrencyCode,
          totalAmount: parseFloat(formData.totalAmount) || 0,
          vatAmount: parseFloat(formData.vatAmount) || 0,
          netAmount: parseFloat(formData.netAmount) || 0,
          dateIssued: formData.dateIssued,
          dueDate: formData.dueDate,
          paymentDate: formData.paymentDate || undefined,
          vendorInvoiceNumber: formData.vendorInvoiceNumber || undefined,
          entityId: formData.entityId,
          periodMonth: parseInt(formData.periodMonth) || expenses[idx].periodMonth,
          periodYear: parseInt(formData.periodYear) || expenses[idx].periodYear,
        };
      }
    }
    toast.success(isNew ? `Expense "${formData.reference}" created` : `Expense "${formData.reference}" saved`);
    onSaved?.(formData);
    close();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            {isNew ? 'New Expense' : formData.reference}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</span>
          <ToggleGroup type="single" value={formData.status} onValueChange={v => { if (v) updateField('status', v); }} className="border rounded-md p-0.5">
            {expenseStatuses.map(s => (
              <ToggleGroupItem key={s} value={s} className="text-xs px-3 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-sm">{s}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-primary mb-3 border-b pb-1">General</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <TextField label="Reference" value={formData.reference} onChange={v => updateField('reference', v)} required readOnly />
              <SelectField label="Type" value={formData.expenseType} onChange={v => updateField('expenseType', v)} required
                options={expenseTypes.map(t => ({ value: t, label: t }))} />
              <LookupField label="Vendor" value={formData.accountId} onChange={v => updateField('accountId', v)} required
                options={accounts.map(a => ({ value: a.id, label: a.name }))} />
              <div className="col-span-2">
                <LookupField label="Contract" value={formData.contractId} onChange={v => updateField('contractId', v)}
                  options={contracts.map(c => {
                    const account = getAccountById(c.parentAccountId);
                    const contact = getContactById(c.contactId);
                    const contactName = contact ? `${contact.firstName} ${contact.lastName}` : '';
                    return { value: c.id, label: `${c.contractNumber} — ${c.name} — ${contactName}${account ? ` (${account.name})` : ''}` };
                  })} />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-primary mb-3 border-b pb-1">Financials</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <TextField label="Total Amount" value={formData.totalAmount} onChange={v => updateField('totalAmount', v)} required type="number" />
              <TextField label="VAT" value={formData.vatAmount} onChange={v => updateField('vatAmount', v)} type="number" />
              <TextField label="Net Amount" value={formData.netAmount} onChange={v => updateField('netAmount', v)} type="number" />
              <SelectField label="Currency" value={formData.currencyCode} onChange={v => updateField('currencyCode', v)} required
                options={currencyOptions.map(c => ({ value: c, label: c }))} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-primary mb-3 border-b pb-1">Dates</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DateField label="Date Issued" value={formData.dateIssued} onChange={v => updateField('dateIssued', v)} required />
              <DateField label="Due Date" value={formData.dueDate} onChange={v => updateField('dueDate', v)} />
              <DateField label="Payment Date" value={formData.paymentDate} onChange={v => updateField('paymentDate', v)} />
              <TextField label="Vendor Invoice #" value={formData.vendorInvoiceNumber} onChange={v => updateField('vendorInvoiceNumber', v)} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-primary mb-3 border-b pb-1">Period</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <LookupField label="Country" value={formData.entityId} onChange={v => updateField('entityId', v)} required
                options={entities.map(e => ({ value: e.id, label: e.country }))} />
              <TextField label="Period Month" value={formData.periodMonth} onChange={v => updateField('periodMonth', v)} required type="number" />
              <TextField label="Period Year" value={formData.periodYear} onChange={v => updateField('periodYear', v)} required type="number" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-primary mb-3 border-b pb-1">Evidence</h3>
            <div>
              {formData.evidenceFile ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{formData.evidenceFile}</p>
                    <p className="text-xs text-muted-foreground">PDF document</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => updateField('evidenceFile', '')}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-colors">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click to upload PDF evidence</span>
                  <span className="text-xs text-muted-foreground/60">PDF files only</span>
                  <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) updateField('evidenceFile', file.name);
                  }} />
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button onClick={saveForm}>Save</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
