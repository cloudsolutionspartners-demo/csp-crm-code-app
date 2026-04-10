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
  bankName: string;
  iban: string;
  swift: string;
  intermediaryBic?: string;
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
  invoicingEmail?: string;
  address?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressPostalCode?: string;
  addressCountry?: string;
  phone?: string;
  email?: string;
  website?: string;
  invoiceFooter?: string;
  paymentDetails?: string;
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
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  entityId: string;
  accountId: string;
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
  contactId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: LeaveStatus;
  reason?: string;
}

export interface Dividend {
  id: string;
  entityId: string;
  accountId?: string;
  contactId?: string;
  amount: number;
  currencyCode: CurrencyCode;
  paymentDate: string;
  taxWithheld: number;
  netAmount: number;
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

// ===== CURRENCY MAP =====
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  EUR: '€',
  RON: 'lei',
  GBP: '£',
};
