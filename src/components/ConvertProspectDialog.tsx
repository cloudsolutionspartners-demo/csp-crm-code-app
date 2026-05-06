import * as React from 'react';
import { useState, useEffect } from 'react';
import { Dialog, useToast } from './Layout';
import { TextField, SelectField, EmailField } from './FormFields';
import { cn } from '../lib/utils';
import { entities } from '../data/mock-data';
import type { Prospect, AccountType, PaymentTerms, ContactType } from '../types/crm';

const ACCOUNT_TYPES: AccountType[] = ['Direct Customer', 'Recruiter Client', 'Recruiter Agency', 'Partner B2B', 'Contractor', 'Supplier', 'Legal Taxes'];
const PAYMENT_TERMS: PaymentTerms[] = ['15 Days', '30 Days', '45 Days', '60 Days'];
const CONTACT_TYPES: ContactType[] = ['Consultant', 'Client Contact', 'Middleman Contact', 'Finance Contact', 'Permanent Employee'];

interface ConvertProspectDialogProps {
  prospect: Prospect | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (accountId: string, contactId: string) => void;
}

export function ConvertProspectDialog({ prospect, open, onClose, onConfirm }: ConvertProspectDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  // Account form
  const [accountForm, setAccountForm] = useState({
    companyName: '',
    accountType: 'Direct Customer' as AccountType,
    entityId: '',
    country: '',
    website: '',
    paymentTerms: '30 Days' as PaymentTerms,
    email: '',
  });

  // Contact form
  const [contactForm, setContactForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    contactType: 'Client Contact' as ContactType,
    jobRole: '',
  });

  // Reset when prospect/open changes
  useEffect(() => {
    if (prospect && open) {
      setStep(1);

      // Split the primary contact name into first/last
      const nameParts = (prospect.primaryContactName || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      setAccountForm({
        companyName: prospect.companyName || '',
        accountType: 'Direct Customer',
        entityId: entities[0]?.id || '',
        country: prospect.country || '',
        website: prospect.website || '',
        paymentTerms: '30 Days',
        email: prospect.primaryContactEmail || '',
      });

      setContactForm({
        firstName,
        lastName,
        email: prospect.primaryContactEmail || '',
        phone: prospect.primaryContactPhone || '',
        contactType: 'Client Contact',
        jobRole: prospect.primaryContactRole || '',
      });
    }
  }, [prospect, open]);

  const updateAccount = (key: string, value: string) => setAccountForm(prev => ({ ...prev, [key]: value }));
  const updateContact = (key: string, value: string) => setContactForm(prev => ({ ...prev, [key]: value }));

  const entityOptions = entities.map(e => ({ value: e.id, label: e.shortName }));

  const handleConfirm = () => {
    const accountId = `acc-${Date.now()}`;
    const contactId = `con-${Date.now()}`;
    toast.success(`Account "${accountForm.companyName}" and Contact "${contactForm.firstName} ${contactForm.lastName}" created`);
    onConfirm(accountId, contactId);
    onClose();
  };

  const stepTitle = step === 1
    ? 'Convert Prospect - Step 1: Account Details'
    : step === 2
    ? 'Convert Prospect - Step 2: Contact Details'
    : 'Convert Prospect - Step 3: Confirm';

  return (
    <Dialog open={open} onClose={onClose} title={stepTitle} maxWidth="42rem">
      {step === 1 && (
        <div className="csp-form-grid-2">
          <TextField label="Company Name" value={accountForm.companyName} onChange={v => updateAccount('companyName', v)} required />
          <SelectField label="Account Type" value={accountForm.accountType} onChange={v => updateAccount('accountType', v)} options={ACCOUNT_TYPES.map(t => ({ value: t, label: t }))} />
          <SelectField label="Business Entity" value={accountForm.entityId} onChange={v => updateAccount('entityId', v)} options={entityOptions} />
          <TextField label="Country" value={accountForm.country} onChange={v => updateAccount('country', v)} />
          <TextField label="Website" value={accountForm.website} onChange={v => updateAccount('website', v)} />
          <SelectField label="Payment Terms" value={accountForm.paymentTerms} onChange={v => updateAccount('paymentTerms', v)} options={PAYMENT_TERMS.map(t => ({ value: t, label: t }))} />
          <EmailField label="Email" value={accountForm.email} onChange={v => updateAccount('email', v)} className="csp-col-span-2" />
        </div>
      )}

      {step === 2 && (
        <div className="csp-form-grid-2">
          <TextField label="First Name" value={contactForm.firstName} onChange={v => updateContact('firstName', v)} required />
          <TextField label="Last Name" value={contactForm.lastName} onChange={v => updateContact('lastName', v)} required />
          <EmailField label="Email" value={contactForm.email} onChange={v => updateContact('email', v)} required />
          <TextField label="Phone" value={contactForm.phone} onChange={v => updateContact('phone', v)} />
          <SelectField label="Contact Type" value={contactForm.contactType} onChange={v => updateContact('contactType', v)} options={CONTACT_TYPES.map(t => ({ value: t, label: t }))} />
          <TextField label="Job Role" value={contactForm.jobRole} onChange={v => updateContact('jobRole', v)} />
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="csp-card" style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Account</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 1rem', fontSize: '0.8125rem' }}>
              <div><span className="csp-text-muted">Company:</span> {accountForm.companyName}</div>
              <div><span className="csp-text-muted">Type:</span> {accountForm.accountType}</div>
              <div><span className="csp-text-muted">Country:</span> {accountForm.country || '\u2014'}</div>
              <div><span className="csp-text-muted">Payment Terms:</span> {accountForm.paymentTerms}</div>
              <div><span className="csp-text-muted">Website:</span> {accountForm.website || '\u2014'}</div>
              <div><span className="csp-text-muted">Email:</span> {accountForm.email || '\u2014'}</div>
            </div>
          </div>

          <div className="csp-card" style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Contact</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 1rem', fontSize: '0.8125rem' }}>
              <div><span className="csp-text-muted">Name:</span> {contactForm.firstName} {contactForm.lastName}</div>
              <div><span className="csp-text-muted">Type:</span> {contactForm.contactType}</div>
              <div><span className="csp-text-muted">Email:</span> {contactForm.email}</div>
              <div><span className="csp-text-muted">Phone:</span> {contactForm.phone || '\u2014'}</div>
              <div><span className="csp-text-muted">Job Role:</span> {contactForm.jobRole || '\u2014'}</div>
            </div>
          </div>

          <div style={{
            backgroundColor: 'hsla(160, 84%, 39%, 0.1)',
            border: '1px solid hsla(160, 84%, 39%, 0.3)',
            borderRadius: '0.375rem',
            padding: '0.75rem 1rem',
            color: 'hsl(160, 84%, 29%)',
            fontSize: '0.875rem',
            textAlign: 'center',
          }}>
            Both records will be created and linked to this prospect.
          </div>
        </div>
      )}

      <div className="csp-dialog-footer">
        <button className="csp-btn csp-btn-ghost" onClick={onClose}>Cancel</button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {step > 1 && (
            <button className="csp-btn csp-btn-outline" onClick={() => setStep(s => s - 1)}>Back</button>
          )}
          {step < 3 && (
            <button className="csp-btn csp-btn-primary" onClick={() => setStep(s => s + 1)}>Next</button>
          )}
          {step === 3 && (
            <button className="csp-btn csp-btn-primary" style={{ backgroundColor: 'hsl(160, 84%, 39%)' }} onClick={handleConfirm}>
              Create Records
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
