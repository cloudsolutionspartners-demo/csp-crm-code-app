import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TextField, SelectField, EmailField, WebsiteField, TextAreaField, LookupField } from '@/components/FormField';
import { entities, accounts, contacts } from '@/data/mock-data';
import { countries } from '@/data/countries';
import type { Prospect, Account, Contact, AccountType, AccountStatus, PaymentTerms, ContactType } from '@/types/crm';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  prospect: Prospect | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (accountId: string, contactId: string) => void;
}

const accountTypes: AccountType[] = ['Direct Customer', 'Recruiter Client', 'Recruiter Agency', 'Partner B2B'];
const accountStatuses: AccountStatus[] = ['Active', 'Inactive'];
const paymentTerms: PaymentTerms[] = ['15 Days', '30 Days', '45 Days', '60 Days'];
// Business contact types only — never Consultant or Permanent Employee
const businessContactTypes: ContactType[] = ['Client Contact', 'Finance Contact', 'Middleman Contact'];

export function ConvertProspectDialog({ prospect, open, onClose, onConfirm }: Props) {
  const [step, setStep] = useState(1);
  const [account, setAccount] = useState<any>({});
  const [contact, setContact] = useState<any>({});

  useEffect(() => {
    if (prospect && open) {
      setStep(1);
      // Map ALL relevant Account fields from the Prospect
      setAccount({
        name: prospect.companyName,
        accountType: 'Direct Customer',
        entityId: entities[0]?.id || '',
        country: prospect.country || '',
        vatNumber: '',
        registrationNumber: '',
        paymentTerms: '30 Days',
        email: prospect.primaryContactEmail || '',
        invoicingEmail: prospect.primaryContactEmail || '',
        phone: prospect.primaryContactPhone || '',
        address: '',
        website: prospect.website || '',
        invoiceComments: '',
        status: 'Active' as AccountStatus,
      });
      // Map relevant business-contact fields from the Prospect's primary contact
      const [first, ...rest] = (prospect.primaryContactName || '').split(' ');
      setContact({
        firstName: first || '',
        lastName: rest.join(' ') || '',
        email: prospect.primaryContactEmail || '',
        phone: prospect.primaryContactPhone || '',
        contactType: 'Client Contact' as ContactType,
        country: prospect.country || '',
        jobRole: prospect.primaryContactRole || '',
        summary: prospect.needDescription || '',
      });
    }
  }, [prospect, open]);

  if (!prospect) return null;

  const updateAccount = (k: string, v: any) => setAccount({ ...account, [k]: v });
  const updateContact = (k: string, v: any) => setContact({ ...contact, [k]: v });

  const handleConfirm = () => {
    if (!account.name || !account.accountType || !account.entityId || !account.country || !account.paymentTerms) {
      toast.error('Please complete all required Account fields');
      setStep(1);
      return;
    }
    if (!contact.firstName || !contact.lastName || !contact.email) {
      toast.error('Contact first name, last name and email are required');
      setStep(2);
      return;
    }

    const newAccountId = `acc-conv-${Date.now()}`;
    const newContactId = `con-conv-${Date.now()}`;
    const accountNumber = `CSP-${String(accounts.length + 1).padStart(6, '0')}`;

    const newAccount: Account = {
      id: newAccountId,
      accountNumber,
      name: account.name,
      accountType: account.accountType as AccountType,
      entityId: account.entityId,
      country: account.country,
      vatNumber: account.vatNumber || undefined,
      registrationNumber: account.registrationNumber || undefined,
      paymentTerms: account.paymentTerms as PaymentTerms,
      invoiceComments: account.invoiceComments || undefined,
      invoicingEmail: account.invoicingEmail || undefined,
      address: account.address || undefined,
      phone: account.phone || undefined,
      email: account.email || undefined,
      website: account.website || undefined,
      status: account.status as AccountStatus,
      activeContracts: 0,
      sourceProspectId: prospect.id,
    };
    accounts.push(newAccount);

    const newContact: Contact = {
      id: newContactId,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone || undefined,
      accountId: newAccountId,
      company: account.name,
      contactType: contact.contactType as ContactType,
      country: contact.country || undefined,
      jobRole: contact.jobRole || undefined,
      summary: contact.summary || undefined,
    };
    contacts.push(newContact);

    toast.success(`Created account "${account.name}" and contact "${contact.firstName} ${contact.lastName}"`);
    onConfirm(newAccountId, newContactId);
    onClose();
  };

  const countryOpts = countries.map(c => ({ value: c, label: c }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert prospect to account — Step {step} of 3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">
              Review the new <strong>Account</strong> details. Values prefilled from the prospect — adjust as needed.
            </div>
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Account Name" value={account.name || ''} onChange={(v) => updateAccount('name', v)} required />
              <SelectField label="Type" value={account.accountType} onChange={(v) => updateAccount('accountType', v)} options={accountTypes.map(t => ({ value: t, label: t }))} required />
              <LookupField label="Country (Entity)" value={account.entityId} onChange={(v) => updateAccount('entityId', v)} options={entities.map(e => ({ value: e.id, label: e.country }))} required />
              <LookupField label="Account Country" value={account.country} onChange={(v) => updateAccount('country', v)} options={countryOpts} required />
              <TextField label="VAT Number" value={account.vatNumber || ''} onChange={(v) => updateAccount('vatNumber', v)} />
              <TextField label="Registration Number" value={account.registrationNumber || ''} onChange={(v) => updateAccount('registrationNumber', v)} />
              <SelectField label="Payment Terms" value={account.paymentTerms} onChange={(v) => updateAccount('paymentTerms', v)} options={paymentTerms.map(t => ({ value: t, label: t }))} required />
              <SelectField label="Status" value={account.status} onChange={(v) => updateAccount('status', v)} options={accountStatuses.map(s => ({ value: s, label: s }))} required />
              <EmailField label="Email" value={account.email || ''} onChange={(v) => updateAccount('email', v)} />
              <EmailField label="Invoicing Email" value={account.invoicingEmail || ''} onChange={(v) => updateAccount('invoicingEmail', v)} />
              <TextField label="Phone" value={account.phone || ''} onChange={(v) => updateAccount('phone', v)} />
              <WebsiteField label="Website" value={account.website || ''} onChange={(v) => updateAccount('website', v)} />
              <TextField label="Address" value={account.address || ''} onChange={(v) => updateAccount('address', v)} className="col-span-2" />
              <TextAreaField label="Invoice Comments" value={account.invoiceComments || ''} onChange={(v) => updateAccount('invoiceComments', v)} className="col-span-2" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">
              Review the new <strong>Account Contact</strong> (business contact at the customer).
            </div>
            <div className="grid grid-cols-2 gap-4">
              <TextField label="First Name" value={contact.firstName || ''} onChange={(v) => updateContact('firstName', v)} required />
              <TextField label="Last Name" value={contact.lastName || ''} onChange={(v) => updateContact('lastName', v)} required />
              <EmailField label="Email" value={contact.email || ''} onChange={(v) => updateContact('email', v)} required />
              <TextField label="Phone" value={contact.phone || ''} onChange={(v) => updateContact('phone', v)} />
              <SelectField label="Contact Type" value={contact.contactType} onChange={(v) => updateContact('contactType', v)} options={businessContactTypes.map(t => ({ value: t, label: t }))} required />
              <LookupField label="Country" value={contact.country || ''} onChange={(v) => updateContact('country', v)} options={countryOpts} />
              <TextField label="Job Role" value={contact.jobRole || ''} onChange={(v) => updateContact('jobRole', v)} className="col-span-2" />
              <TextAreaField label="Summary" value={contact.summary || ''} onChange={(v) => updateContact('summary', v)} className="col-span-2" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">Confirm and create both records.</div>
            <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-sm">
              <p className="font-semibold">New Account</p>
              <p className="text-muted-foreground">{account.name} · {account.accountType} · {account.country} · {account.paymentTerms}</p>
              {(account.vatNumber || account.email) && (
                <p className="text-xs text-muted-foreground">
                  {account.vatNumber && <>VAT: {account.vatNumber}</>}
                  {account.vatNumber && account.email && ' · '}
                  {account.email}
                </p>
              )}
            </div>
            <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-sm">
              <p className="font-semibold">New Account Contact</p>
              <p className="text-muted-foreground">{contact.firstName} {contact.lastName} · {contact.contactType} · {contact.email}</p>
              {contact.jobRole && <p className="text-xs text-muted-foreground">{contact.jobRole}</p>}
            </div>
            <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-sm text-emerald-800 dark:text-emerald-300">
              The prospect <strong>{prospect.companyName}</strong> will be marked as <strong>Won</strong> and linked to these new records.
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {step < 3 && (
              <Button onClick={() => setStep(step + 1)}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleConfirm} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Create Records
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
