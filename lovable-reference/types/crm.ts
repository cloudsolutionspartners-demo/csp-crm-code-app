// ===== ENUMS =====
export type Country = 'Romania' | 'Bulgaria' | 'US' | 'UK';
export type CurrencyCode = 'USD' | 'EUR' | 'RON' | 'GBP';
export type AccountType = 'Direct Customer' | 'Recruiter Client' | 'Recruiter Agency' | 'Partner B2B' | 'Contractor' | 'Supplier' | 'Legal Taxes';
export type AccountStatus = 'Active' | 'Inactive' | 'Prospect';
export type PaymentTerms = '15 Days' | '30 Days' | '45 Days' | '60 Days';
export type ContactType = 'Consultant' | 'Client Contact' | 'Middleman Contact' | 'Finance Contact' | 'Permanent Employee';
export type ContractType = 'Standard Contracting' | 'Permanent Employee' | 'Fixed Price';
export type ContractStatus = 'Draft' | 'Active' | 'On Hold' | 'Completed' | 'Terminated';
export type BillingType = 'Time & Material' | 'Fixed Price' | 'Monthly Salary' | 'Standard Contracting';
export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Cancelled' | 'Credit Note';
export type ExpenseType = 'Contractor Payment' | 'Supplier Invoice' | 'Tax' | 'Employee Salary' | 'Operating Cost' | 'Software / Subscription';
export type ExpenseStatus = 'Received' | 'Paid' | 'Overdue';
export type TimesheetStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
export type LeaveType = 'Annual Leave' | 'Sick Leave' | 'Personal Leave' | 'Public Holiday';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';
export type UnitOfMeasure = 'Day' | 'Hour' | 'Month' | 'Fixed';
export type SnapshotType = 'Actual' | 'Forecast';
export type UserRole = 'Admin' | 'Owner';

// ===== ENTITIES =====
export interface BusinessEntity {
  id: string;
  name: string;          // Legal Name
  shortName: string;
  country: Country;
  baseCurrencyCode: CurrencyCode;
  vatNumber: string;
  registrationNumber: string;
  address: string;
  phone?: string;
  email?: string;
  // EU / default bank details
  bankName: string;
  iban: string;
  swift: string;
  intermediaryBic?: string;
  // BG-specific: UK bank details
  ukBankName?: string;
  ukAccountNumber?: string;
  ukSortCode?: string;
  ukIban?: string;
  ukSwift?: string;
  ukIntermediaryBic?: string;
  // US-specific
  usAccountNumber?: string;
  usAchRoutingNumber?: string;
  usWireRoutingNumber?: string;
  // Invoice
  invoicePrefix: string;
  invoiceFooter: string;
  // Accountant
  accountantEmail?: string;
}

export interface Account {
  id: string;
  accountNumber: string;
  name: string;
  accountType: AccountType;
  entityId: string;
  country: string;
  vatNumber?: string;
  registrationNumber?: string;
  paymentTerms: PaymentTerms;
  invoiceComments?: string;
  invoicingEmail?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  status: AccountStatus;
  activeContracts: number;
  // Lookup back to the originating Prospect (set when account was created via Convert)
  sourceProspectId?: string;
  // Optional parent account for grouping in the Accounts hierarchy view.
  // NOTE: Only single-level hierarchy is supported for now (no grandchildren).
  // To extend to multi-level later, remove the "child cannot also be parent" guard
  // in AccountsPage and update the hierarchy builder to recurse.
  parentAccountId?: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  accountId?: string;
  contactType: ContactType;
  nationality?: string;
  country?: string;
  skillset?: string[];
  jobRole?: string;
  summary?: string;
  available?: boolean;
  availableForWork?: boolean;
  isInterviewer?: boolean;
  lastIncreaseDate?: string;
  lastIncreaseAmount?: number;
}

export interface Contract {
  id: string;
  contractNumber: string;
  name: string;
  contractType: ContractType;
  billingType: BillingType;
  entityId: string;
  parentAccountId: string;
  childAccountId?: string;
  contactId: string; // contractor / assigned to
  sellRate: number;
  sellHourlyRate?: number;
  sellCurrency: CurrencyCode;
  buyRate: number;
  buyHourlyRate?: number;
  buyCurrency: CurrencyCode;
  unitOfMeasure: UnitOfMeasure;
  payTerms: PaymentTerms;
  margin: number;
  marginPercent: number;
  grossValue?: number;
  monthlySalary?: number;
  monthlySalaryCurrency?: CurrencyCode;
  startDate: string;
  endDate?: string;
  actualEndDate?: string;
  noticePeriod?: string;
  hasTimesheet: boolean;
  hasMilestones: boolean;
  calendarType?: string;
  status: ContractStatus;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  entityId: string;
  accountId: string;
  parentAccountId?: string;
  contractId?: string;
  currencyCode: CurrencyCode;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  ronConversionRate?: number;
  ronTotal?: number;
  comments?: string;
  status: InvoiceStatus;
  paymentReceivedDate?: string;
  periodMonth: number;
  periodYear: number;
  lines: InvoiceLine[];
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  name: string;
  description: string;
  quantity: number;
  unitOfMeasure: UnitOfMeasure;
  contactId?: string;
  rate: number;
  currencyCode: CurrencyCode;
  amount: number;
  contractId?: string;
}

export interface Expense {
  id: string;
  reference: string;
  entityId: string;
  accountId: string;
  expenseType: ExpenseType;
  relatedInvoiceId?: string;
  contractId?: string;
  currencyCode: CurrencyCode;
  totalAmount: number;
  vatAmount: number;
  netAmount: number;
  ronEquivalent?: number;
  dateIssued: string;
  dueDate: string;
  paymentDate?: string;
  vendorInvoiceNumber?: string;
  status: ExpenseStatus;
  periodMonth: number;
  periodYear: number;
}

export interface Timesheet {
  id: string;
  reference: string;
  contactId: string;
  contractId: string;
  weekStart: string;
  totalHours: number;
  status: TimesheetStatus;
  entries: TimesheetEntry[];
}

export interface TimesheetEntry {
  date: string;
  hours: number;
  comment?: string;
  description?: string;
}

export interface LeaveRequest {
  id: string;
  name: string;
  contactId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: LeaveStatus;
  reason?: string;
  clientNotified: boolean;
}

export interface Dividend {
  id: string;
  name: string;
  entityId: string;
  amount: number;
  currencyCode: CurrencyCode;
  paymentDate: string;
  taxWithheld: number;
  documentFile?: string;
}

export interface BankStatement {
  id: string;
  entityId: string;
  periodStart: string;
  periodEnd: string;
  lines: BankStatementLine[];
}

export interface BankStatementLine {
  id: string;
  bankStatementId: string;
  transactionDate: string;
  reference: string;
  debit?: number;
  credit?: number;
  matchedInvoiceId?: string;
  matchedExpenseId?: string;
  explanation?: string;
  reconciled: boolean;
}

export interface ExchangeRate {
  id: string;
  fromCurrencyCode: CurrencyCode;
  toCurrencyCode: CurrencyCode;
  rate: number;
  effectiveDate: string;
  month: number;
  year: number;
}

export interface PublicHoliday {
  id: string;
  name: string;
  date: string;
  country: Country;
  year: number;
}

export interface ReportingSnapshot {
  id: string;
  entityId: string;
  contractId?: string;
  month: number;
  year: number;
  revenue: number;
  revenueRon: number;
  costs: number;
  costsRon: number;
  grossProfit: number;
  grossProfitRon: number;
  marginPercent: number;
  activeContracts: number;
  invoicesIssued: number;
  currencyCode: CurrencyCode;
  snapshotType: SnapshotType;
}

export interface PaymentDetail {
  id: string;
  accountId: string;
  currencyCode: CurrencyCode;
  iban: string;
  swift: string;
  bankName: string;
  isPrimary: boolean;
}

// ===== ONBOARDING =====
export type CandidatePath = 'CIM to B2B' | 'B2B seeking Contracts';
export type CandidateStatus = 'Applied' | 'Scheduled' | 'Fit' | 'Not Fit';

export interface OnboardingCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  path: CandidatePath;
  cvFileName: string;
  hourlyRateEur: number;
  b2bEntityName?: string;
  selectedSlots: string[];
  confirmedSlotId?: string;
  reviewerNotes?: string;
  status: CandidateStatus;
  appliedDate: string;
  reviewedBy?: string;
  createdContactId?: string;
  createdAccountId?: string;
}

export type SlotStatus = 'New' | 'Booked' | 'Cancelled' | 'Completed';

export interface AvailabilitySlot {
  id: string;
  candidateId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  date: string;
  teamsLink: string;
  isActive: boolean;
  status: SlotStatus;
  interviewerId?: string;
  confirmedAt?: string;
}

// ===== MILESTONES =====
export type MilestoneStatus = 'Pending' | 'Invoiced' | 'Paid';

export interface ContractMilestone {
  id: string;
  milestoneId: string;
  contractId: string;
  description: string;
  value: number;
  currencyCode: CurrencyCode;
  startDate: string;
  endDate: string;
  status: MilestoneStatus;
}

// ===== METADATA =====
export interface JDSkill {
  id: string;
  name: string;
  description?: string;
  definedByAI: boolean;
}

export interface JDPlatform {
  id: string;
  name: string;
  description: string;
  definedByAI: boolean;
}

// ===== PROSPECTING =====
export type ProspectStatus = 'New' | 'Contacted' | 'Discussing' | 'Proposal' | 'Won' | 'Lost' | 'We Reached Out' | 'Customer Reached Out' | 'Proposal Sent';
export type ProspectSource = 'Phone' | 'LinkedIn' | 'Email' | 'Internal Referral';
export type InteractionType = 'Call' | 'Email' | 'Meeting' | 'LinkedIn';
export type ProspectKind = 'New Business' | 'Existing Account';

export interface Prospect {
  id: string;
  prospectNumber: string;
  // Kind: brand new company vs new opportunity with existing account
  kind?: ProspectKind;
  existingAccountId?: string; // set when kind = 'Existing Account'
  // Identity
  companyName: string;
  country: string;
  industry?: string;
  website?: string;
  companySize?: string;
  ownerContactId: string; // internal consultant
  // Source & contact
  source: ProspectSource;
  referredByContactId?: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone?: string;
  primaryContactRole?: string;
  // Existing-account variant
  prospectingContactId?: string; // lookup into contacts when kind = 'Existing Account'
  // Opportunity
  needDescription?: string;
  servicesDiscussed?: string;
  estimatedValue?: number;
  currencyCode?: CurrencyCode;
  expectedCloseDate?: string;
  // Status & dates
  status: ProspectStatus;
  firstContactDate: string;
  lastActivityDate?: string;
  lostReason?: string;
  // Conversion
  convertedAccountId?: string;
  convertedContactId?: string;
  convertedDate?: string;
}

export interface ProspectInteraction {
  id: string;
  prospectId: string;
  type: InteractionType;
  date: string;
  summary: string;
  durationMinutes?: number;
  createdBy: string;
}

export interface ProspectMaterial {
  id: string;
  prospectId: string;
  fileName: string;
  sharedDate: string;
  description?: string;
  /** Dataverse file column "Document" — stored here as a base64 data URL for the prototype */
  document?: string;
  documentMimeType?: string;
  documentSize?: number;
}

// ===== DOCUMENTS =====
export type DocumentType = 'Contract' | 'Certificate' | 'Invoice' | 'Policy' | 'Report' | 'Other';

export interface CompanyDocument {
  id: string;
  documentName: string;
  documentType: DocumentType;
  relatedAccountId?: string;
  issuedDate?: string;
  expirationDate?: string;
  description?: string;
  instructions?: string;
  fileName?: string;
}

// ===== CURRENCY MAP =====
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  EUR: '€',
  RON: 'lei',
  GBP: '£',
};
