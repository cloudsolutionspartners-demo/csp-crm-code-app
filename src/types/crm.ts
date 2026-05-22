// ===== ENUMS =====
export type Country = 'Romania' | 'Bulgaria' | 'US' | 'UK';
export type CurrencyCode = 'USD' | 'EUR' | 'RON' | 'GBP';
export type AccountType = 'Direct Customer' | 'Recruiter Client' | 'Recruiter Agency' | 'Partner B2B' | 'Contractor' | 'Supplier' | 'Legal Taxes';
export type AccountStatus = 'Active' | 'Inactive';
export type PaymentTerms = '15 Days' | '30 Days' | '45 Days' | '60 Days';
export type ContactType = 'Consultant' | 'Client Contact' | 'Middleman Contact' | 'Finance Contact' | 'Permanent Employee';
export type ContractType = 'Standard Contracting' | 'Permanent Employee' | 'Fixed Price';
export type ContractStatus = 'Draft' | 'Active' | 'On Hold' | 'Completed' | 'Terminated';
export type BillingType = 'Time & Material' | 'Fixed Price' | 'Monthly Salary' | 'Standard Contracting';
export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Cancelled' | 'Credit Note';
export type ExpenseType = 'Contractor Payment' | 'Supplier Invoice' | 'Tax' | 'Permanent Employee' | 'Operating Cost' | 'Office Rent' | 'Software Subscription';
export type ExpenseStatus = 'Pending' | 'Approved' | 'Paid' | 'Rejected';
export type TimesheetStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
export type LeaveType = 'Annual Leave' | 'Sick Leave' | 'Personal Leave' | 'Public Holiday';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';
export type UnitOfMeasure = 'Day' | 'Hour' | 'Month' | 'Fixed';
export type SnapshotType = 'Actual' | 'Forecast';
export type UserRole = 'Admin' | 'Owner';

// ===== ENTITIES =====
export interface BusinessEntity {
  id: string;
  name: string;
  shortName: string;
  country: Country;
  baseCurrencyCode: CurrencyCode;
  vatNumber: string;
  registrationNumber: string;
  address: string;
  phone?: string;
  email?: string;
  accountantEmail?: string;
  bankName: string;
  iban: string;
  swift: string;
  intermediaryBic?: string;
  // Bulgaria UK Bank Details
  ukBankName?: string;
  ukAccountNumber?: string;
  ukSortCode?: string;
  ukIban?: string;
  ukSwift?: string;
  ukIntermediaryBic?: string;
  // US Banking Details
  usAccountNumber?: string;
  usAchRoutingNumber?: string;
  usWireRoutingNumber?: string;
  invoicePrefix: string;
  invoiceFooter: string;
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
  invoiceFooter?: string;
  invoicingEmail?: string;
  address?: string;
  street1?: string;
  street2?: string;
  street3?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  primaryContactId?: string;
  parentAccountId?: string;
  status: AccountStatus;
  activeContracts: number;
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
  status?: 'Active' | 'Inactive';
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
  contactId: string;
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
  // Display names from Dataverse FormattedValues (for dropdowns)
  parentAccountName?: string;
  childAccountName?: string;
  assignedToName?: string;
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
  // Display names from Dataverse FormattedValues
  accountName?: string;
  parentAccountName?: string;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  name?: string;
  contactId?: string;
  description: string;
  quantity: number;
  rate: number;
  currencyCode: CurrencyCode;
  amount: number;
  unitOfMeasure: UnitOfMeasure;
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
  name?: string;
  entityId: string;
  accountId?: string;
  contactId?: string;
  amount: number;
  currencyCode: CurrencyCode;
  paymentDate: string;
  taxWithheld: number;
  netAmount: number;
  fileName?: string;
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
export type CandidateSource = 'Website' | 'Recruiter' | 'Referral';

export interface OnboardingCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  path: CandidatePath;
  candidateRole?: string;
  source?: CandidateSource;
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

export type SlotStatus = 'Available' | 'Fully Booked' | 'Expired';

export interface AvailabilitySlot {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  weekStart: string;
  weekEnd: string;
  teamsLink: string;
  isActive: boolean;
  status: SlotStatus;
  interviewerId?: string;
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

// ===== JD SKILLS & PLATFORMS =====
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

// ===== COMPANY DOCUMENTS =====
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

// ===== PROSPECTS =====
export type ProspectStatus = 'New' | 'Contacted' | 'Discussing' | 'Proposal' | 'Won' | 'Lost';
export type ProspectSource = 'Phone' | 'LinkedIn' | 'Email' | 'Internal Referral';
export type InteractionType = 'Call' | 'Email' | 'Meeting' | 'LinkedIn';

export interface Prospect {
  id: string;
  prospectNumber: string;
  companyName: string;
  country: string;
  industry?: string;
  website?: string;
  companySize?: string;
  ownerContactId: string;
  source: ProspectSource;
  referredByContactId?: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone?: string;
  primaryContactRole?: string;
  needDescription?: string;
  servicesDiscussed?: string;
  estimatedValue?: number;
  currencyCode?: CurrencyCode;
  expectedCloseDate?: string;
  status: ProspectStatus;
  firstContactDate: string;
  lastActivityDate?: string;
  lostReason?: string;
  convertedAccountId?: string;
  convertedContactId?: string;
  convertedDate?: string;
  kind?: ProspectKind;
  existingAccountId?: string;
  prospectingContactId?: string;
}

export type ProspectKind = 'New Business' | 'Existing Account';

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
}

// ===== CONTACT CVs =====
export interface ContactCv {
  id: string;
  fileName: string;
  label?: string;
  uploadedAt: string;
  isPrimary?: boolean;
}

// ===== OPPORTUNITIES =====
export type OpportunityStatus = 'New' | 'Interview Booked' | 'Won' | 'Lost';
export type OpportunitySource = 'From Existing Client' | 'From Prospect' | 'From New Client' | 'From Existing Consultant';
export type OpportunityClientLinkType = 'Account' | 'Prospect' | 'Free Text' | 'Contact';
export type RateUnit = 'Hour' | 'Day';
export type ApplicantStatus = 'Drafted' | 'Sent' | 'Accepted' | 'Rejected';

export interface OpportunityMaterial {
  id: string;
  opportunityId: string;
  fileName: string;
  sharedDate?: string;
  description?: string;
  documentFileName?: string;
}

export interface OpportunityApplicant {
  id: string;
  opportunityId: string;
  candidateId?: string;
  contactId?: string;
  rate?: number;
  rateUnit?: string;
  rateCurrency?: string;
  status: ApplicantStatus;
  documentFileName?: string;
}

export interface ContactRateLine {
  contactId: string;
  rate?: number;
  unit: RateUnit;
  currency?: CurrencyCode;
}

export interface ContactCvSelection {
  contactId: string;
  cvId: string;
}

export interface CandidateRateLine {
  candidateId: string;
  rate?: number;
  unit: RateUnit;
  currency?: CurrencyCode;
  applicantStatus?: ApplicantStatus;
  cvOverrideFileName?: string;
}

export interface Opportunity {
  id: string;
  opportunityNumber: string;
  source: OpportunitySource;
  clientLinkType: OpportunityClientLinkType;
  accountId?: string;
  accountName?: string;
  prospectId?: string;
  prospectName?: string;
  freeClientName?: string;
  sourceContactId?: string;
  sourceContactName?: string;
  role: string;
  opportunityRate?: number;
  opportunityRateUnit?: string;
  opportunityCurrency?: string;
  startDate?: string;
  closingDate?: string;
  details?: string;
  outcomeComments?: string;
  status: OpportunityStatus;
  ownerContactId?: string;
  createdAt: string;
  applicants?: OpportunityApplicant[];
  materials?: OpportunityMaterial[];
}

// ===== CORPORATE ACTIONS =====
export type CorporateActionStatus = 'New' | 'In Progress' | 'Closed' | 'Cancelled';
export type CorporateActionPriority = 'Low' | 'Medium' | 'High';

export interface CorporateAction {
  id: string;
  actionSummarizedTitle: string;
  actionDetails: string;
  closingComments?: string;
  priority: CorporateActionPriority;
  status: CorporateActionStatus;
  dueDate?: string;          // ISO date 'YYYY-MM-DD'
  createdAt: string;         // ISO datetime
  modifiedAt: string;        // ISO datetime
}

// ===== CURRENCY MAP =====
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  EUR: '€',
  RON: 'lei',
  GBP: '£',
};
