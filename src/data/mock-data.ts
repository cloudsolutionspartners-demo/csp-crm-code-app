import {
  BusinessEntity, Account, Contact, Contract, Invoice, InvoiceLine,
  Expense, Timesheet, TimesheetEntry, LeaveRequest, Dividend,
  BankStatement, BankStatementLine, ExchangeRate, PublicHoliday,
  ReportingSnapshot, PaymentDetail, OnboardingCandidate, AvailabilitySlot,
  ContractMilestone,
} from '../types/crm';

// ===== BUSINESS ENTITIES =====
export const entities: BusinessEntity[] = [
  {
    id: 'ent-1', name: 'Cloud Solutions Partners Romania', shortName: 'CSP-RO',
    country: 'Romania', baseCurrencyCode: 'EUR', vatNumber: 'RO12345678',
    registrationNumber: 'J40/1234/2020', address: 'Str. Victoriei 100, Bucharest',
    bankName: 'ING Bank Romania', iban: 'RO49AAAA1B31007593840000',
    swift: 'INGBROBU', invoicePrefix: 'CSP-RO-', invoiceFooter: 'Payment due within terms. VAT registered in Romania.',
  },
  {
    id: 'ent-2', name: 'Cloud Solutions Partners Bulgaria', shortName: 'CSP-BG',
    country: 'Bulgaria', baseCurrencyCode: 'EUR', vatNumber: 'BG987654321',
    registrationNumber: 'BG-2021-5678', address: 'ul. Vitosha 50, Sofia',
    bankName: 'UniCredit Bulbank', iban: 'BG80BNBG96611020345678',
    swift: 'UNCRBGSF', invoicePrefix: 'CSP-BG-', invoiceFooter: 'Payment due within terms. VAT registered in Bulgaria.',
  },
  {
    id: 'ent-3', name: 'Cloud Solutions Partners US', shortName: 'CSP-US',
    country: 'US', baseCurrencyCode: 'USD', vatNumber: 'N/A',
    registrationNumber: 'US-EIN-12-3456789', address: '100 Main St, New York, NY 10001',
    bankName: 'JPMorgan Chase', iban: 'N/A',
    swift: 'CHASUS33', invoicePrefix: 'CSP-US-', invoiceFooter: 'Payment due within terms.',
  },
];

// ===== ACCOUNTS =====
export const accounts: Account[] = [
  { id: 'acc-1', accountNumber: 'CSP-000001', name: 'TechCorp International', accountType: 'Direct Customer', entityId: 'ent-1', country: 'Germany', vatNumber: 'DE123456789', paymentTerms: '30 Days', status: 'Active', activeContracts: 3, email: 'finance@techcorp.de', invoicingEmail: 'invoices@techcorp.de' },
  { id: 'acc-2', accountNumber: 'CSP-000002', name: 'Nordic Staffing AB', accountType: 'Recruiter Agency', entityId: 'ent-1', country: 'Sweden', vatNumber: 'SE556677889901', paymentTerms: '45 Days', status: 'Active', activeContracts: 2, email: 'contact@nordicstaffing.se' },
  { id: 'acc-3', accountNumber: 'CSP-000003', name: 'FinanceHub Ltd', accountType: 'Direct Customer', entityId: 'ent-2', country: 'UK', vatNumber: 'GB123456789', paymentTerms: '30 Days', status: 'Active', activeContracts: 1, email: 'ap@financehub.co.uk' },
  { id: 'acc-4', accountNumber: 'CSP-000004', name: 'DataFlow Systems', accountType: 'Direct Customer', entityId: 'ent-3', country: 'US', paymentTerms: '30 Days', status: 'Active', activeContracts: 1, email: 'billing@dataflow.com' },
  { id: 'acc-5', accountNumber: 'CSP-000005', name: 'Alpine Consulting GmbH', accountType: 'Partner B2B', entityId: 'ent-1', country: 'Austria', vatNumber: 'ATU12345678', paymentTerms: '30 Days', status: 'Active', activeContracts: 1, email: 'info@alpineconsulting.at' },
  { id: 'acc-6', accountNumber: 'CSP-000006', name: 'Ion Popescu SRL', accountType: 'Contractor', entityId: 'ent-1', country: 'Romania', vatNumber: 'RO44556677', registrationNumber: 'J40/9999/2022', paymentTerms: '15 Days', status: 'Active', activeContracts: 2, email: 'ion@popescu.ro' },
  { id: 'acc-7', accountNumber: 'CSP-000007', name: 'Maria Ivanova EOOD', accountType: 'Contractor', entityId: 'ent-2', country: 'Bulgaria', vatNumber: 'BG111222333', paymentTerms: '15 Days', status: 'Active', activeContracts: 1, email: 'maria@ivanova.bg' },
  { id: 'acc-8', accountNumber: 'CSP-000008', name: 'Smith Dev LLC', accountType: 'Contractor', entityId: 'ent-3', country: 'US', paymentTerms: '15 Days', status: 'Active', activeContracts: 1, email: 'john@smithdev.com' },
  { id: 'acc-9', accountNumber: 'CSP-000009', name: 'AWS Romania', accountType: 'Supplier', entityId: 'ent-1', country: 'Romania', paymentTerms: '30 Days', status: 'Active', activeContracts: 0, email: 'support@aws.com' },
  { id: 'acc-10', accountNumber: 'CSP-000010', name: 'ANAF Romania', accountType: 'Legal Taxes', entityId: 'ent-1', country: 'Romania', paymentTerms: '30 Days', status: 'Active', activeContracts: 0 },
  { id: 'acc-11', accountNumber: 'CSP-000011', name: 'GlobalTech Inc', accountType: 'Recruiter Client', entityId: 'ent-3', country: 'US', paymentTerms: '30 Days', status: 'Active', activeContracts: 1, email: 'hr@globaltech.com' },
  { id: 'acc-12', accountNumber: 'CSP-000012', name: 'Innovate Solutions', accountType: 'Direct Customer', entityId: 'ent-1', country: 'Netherlands', vatNumber: 'NL123456789B01', paymentTerms: '30 Days', status: 'Prospect', activeContracts: 0, email: 'info@innovate.nl' },
  { id: 'acc-13', accountNumber: 'CSP-000013', name: 'Office Hub SRL', accountType: 'Supplier', entityId: 'ent-1', country: 'Romania', paymentTerms: '15 Days', status: 'Active', activeContracts: 0, email: 'office@officehub.ro' },
  { id: 'acc-14', accountNumber: 'CSP-000014', name: 'Legacy Systems Corp', accountType: 'Direct Customer', entityId: 'ent-3', country: 'US', paymentTerms: '60 Days', status: 'Inactive', activeContracts: 0, email: 'ap@legacy.com' },
  { id: 'acc-15', accountNumber: 'CSP-000015', name: 'Balkan Tech OOD', accountType: 'Direct Customer', entityId: 'ent-2', country: 'Bulgaria', vatNumber: 'BG999888777', paymentTerms: '30 Days', status: 'Active', activeContracts: 1, email: 'finance@balkantech.bg' },
];

// ===== CONTACTS =====
export const contacts: Contact[] = [
  { id: 'con-1', firstName: 'Ion', lastName: 'Popescu', email: 'ion@popescu.ro', phone: '+40721000001', accountId: 'acc-6', contactType: 'Consultant', nationality: 'Romanian', country: 'Romania', skillset: ['React', 'TypeScript', 'Node.js'], jobRole: 'Senior Full-Stack Developer', available: false, isInterviewer: true },
  { id: 'con-2', firstName: 'Maria', lastName: 'Ivanova', email: 'maria@ivanova.bg', phone: '+359888000002', accountId: 'acc-7', contactType: 'Consultant', nationality: 'Bulgarian', country: 'Bulgaria', skillset: ['Java', 'Spring Boot', 'AWS'], jobRole: 'Backend Developer', available: false },
  { id: 'con-3', firstName: 'John', lastName: 'Smith', email: 'john@smithdev.com', phone: '+12125550003', accountId: 'acc-8', contactType: 'Consultant', nationality: 'American', country: 'US', skillset: ['Python', 'ML', 'Data Engineering'], jobRole: 'Data Engineer', available: false },
  { id: 'con-4', firstName: 'Elena', lastName: 'Dragomir', email: 'elena.d@email.com', phone: '+40721000004', contactType: 'Consultant', nationality: 'Romanian', country: 'Romania', skillset: ['Azure', 'DevOps', 'Terraform'], jobRole: 'Cloud Architect', available: true, isInterviewer: true },
  { id: 'con-5', firstName: 'Georgi', lastName: 'Petrov', email: 'georgi.p@email.com', phone: '+359888000005', contactType: 'Consultant', nationality: 'Bulgarian', country: 'Bulgaria', skillset: ['Angular', 'C#', '.NET'], jobRole: 'Full-Stack Developer', available: true },
  { id: 'con-6', firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.j@techcorp.de', phone: '+49170000006', company: 'TechCorp International', accountId: 'acc-1', contactType: 'Client Contact', country: 'Germany' },
  { id: 'con-7', firstName: 'Michael', lastName: 'Brown', email: 'michael.b@dataflow.com', phone: '+12125550007', company: 'DataFlow Systems', accountId: 'acc-4', contactType: 'Client Contact', country: 'US' },
  { id: 'con-8', firstName: 'Ana', lastName: 'Georgescu', email: 'ana.g@email.com', phone: '+40721000008', contactType: 'Consultant', nationality: 'Romanian', country: 'Romania', skillset: ['React', 'Vue.js', 'UX Design'], jobRole: 'Frontend Developer', available: false, isInterviewer: true },
  { id: 'con-9', firstName: 'Dimitar', lastName: 'Kolev', email: 'dimitar.k@email.com', phone: '+359888000009', contactType: 'Consultant', nationality: 'Bulgarian', country: 'Bulgaria', skillset: ['Kubernetes', 'Docker', 'Go'], jobRole: 'Platform Engineer', available: true },
  { id: 'con-10', firstName: 'Robert', lastName: 'Davis', email: 'robert.d@globaltech.com', phone: '+12125550010', company: 'GlobalTech Inc', accountId: 'acc-11', contactType: 'Finance Contact', country: 'US' },
];

// ===== CONTRACTS =====
export const contracts: Contract[] = [
  { id: 'ctr-1', contractNumber: 'CTR-2024-001', name: 'TechCorp - Ion Popescu - React Dev', contractType: 'Standard Contracting', billingType: 'Time & Material', entityId: 'ent-1', parentAccountId: 'acc-1', contactId: 'con-1', sellRate: 500, sellHourlyRate: 62.5, sellCurrency: 'EUR', buyRate: 350, buyHourlyRate: 43.75, buyCurrency: 'EUR', unitOfMeasure: 'Day', payTerms: '30 Days', margin: 150, marginPercent: 30, grossValue: 132000, startDate: '2024-01-15', endDate: '2026-12-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  { id: 'ctr-2', contractNumber: 'CTR-2024-002', name: 'TechCorp - Ana Georgescu - Frontend', contractType: 'Standard Contracting', billingType: 'Time & Material', entityId: 'ent-1', parentAccountId: 'acc-1', contactId: 'con-8', sellRate: 450, sellHourlyRate: 56.25, sellCurrency: 'EUR', buyRate: 320, buyHourlyRate: 40, buyCurrency: 'EUR', unitOfMeasure: 'Day', payTerms: '30 Days', margin: 130, marginPercent: 28.9, grossValue: 118800, startDate: '2024-03-01', endDate: '2026-06-30', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  { id: 'ctr-3', contractNumber: 'CTR-2024-003', name: 'Nordic - Ion Popescu - Node.js', contractType: 'Standard Contracting', billingType: 'Time & Material', entityId: 'ent-1', parentAccountId: 'acc-2', childAccountId: 'acc-6', contactId: 'con-1', sellRate: 480, sellHourlyRate: 60, sellCurrency: 'EUR', buyRate: 350, buyHourlyRate: 43.75, buyCurrency: 'EUR', unitOfMeasure: 'Day', payTerms: '45 Days', margin: 130, marginPercent: 27.1, grossValue: 126720, startDate: '2024-06-01', endDate: '2025-05-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  { id: 'ctr-4', contractNumber: 'CTR-2024-004', name: 'FinanceHub - Maria Ivanova - Java', contractType: 'Standard Contracting', billingType: 'Time & Material', entityId: 'ent-2', parentAccountId: 'acc-3', contactId: 'con-2', sellRate: 450, sellHourlyRate: 56.25, sellCurrency: 'GBP', buyRate: 300, buyHourlyRate: 37.5, buyCurrency: 'EUR', unitOfMeasure: 'Day', payTerms: '30 Days', margin: 150, marginPercent: 33.3, grossValue: 118800, startDate: '2024-02-01', endDate: '2026-01-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  { id: 'ctr-5', contractNumber: 'CTR-2024-005', name: 'DataFlow - John Smith - Data Eng', contractType: 'Standard Contracting', billingType: 'Time & Material', entityId: 'ent-3', parentAccountId: 'acc-4', contactId: 'con-3', sellRate: 760, sellHourlyRate: 95, sellCurrency: 'USD', buyRate: 600, buyHourlyRate: 75, buyCurrency: 'USD', unitOfMeasure: 'Hour', payTerms: '30 Days', margin: 20, marginPercent: 21.1, grossValue: 200640, startDate: '2024-04-01', endDate: '2026-03-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  { id: 'ctr-6', contractNumber: 'CTR-2024-006', name: 'BalkanTech - Dimitar Kolev - Platform', contractType: 'Standard Contracting', billingType: 'Time & Material', entityId: 'ent-2', parentAccountId: 'acc-15', contactId: 'con-9', sellRate: 500, sellHourlyRate: 62.5, sellCurrency: 'EUR', buyRate: 350, buyHourlyRate: 43.75, buyCurrency: 'EUR', unitOfMeasure: 'Day', payTerms: '30 Days', margin: 150, marginPercent: 30, grossValue: 132000, startDate: '2025-01-01', endDate: '2025-12-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  { id: 'ctr-7', contractNumber: 'CTR-2024-007', name: 'Alpine - Elena Dragomir - Cloud', contractType: 'Fixed Price', billingType: 'Fixed Price', entityId: 'ent-1', parentAccountId: 'acc-5', contactId: 'con-4', sellRate: 9000, sellCurrency: 'EUR', buyRate: 8800, buyCurrency: 'EUR', unitOfMeasure: 'Month', payTerms: '30 Days', margin: 200, marginPercent: 2.2, grossValue: 54000, monthlySalary: 8800, monthlySalaryCurrency: 'EUR', startDate: '2025-02-01', endDate: '2025-07-31', hasTimesheet: false, hasMilestones: true, status: 'Draft' },
  { id: 'ctr-8', contractNumber: 'CTR-2023-001', name: 'GlobalTech - Georgi Petrov - .NET', contractType: 'Standard Contracting', billingType: 'Time & Material', entityId: 'ent-3', parentAccountId: 'acc-11', childAccountId: 'acc-7', contactId: 'con-5', sellRate: 550, sellHourlyRate: 68.75, sellCurrency: 'USD', buyRate: 280, buyHourlyRate: 35, buyCurrency: 'EUR', unitOfMeasure: 'Day', payTerms: '30 Days', margin: 270, marginPercent: 49.1, grossValue: 145200, startDate: '2023-09-01', endDate: '2024-08-31', actualEndDate: '2024-08-31', hasTimesheet: true, hasMilestones: false, status: 'Completed' },
];

// ===== INVOICES =====
const makeLines = (invoiceId: string, contactId: string, desc: string, qty: number, rate: number, currency: 'EUR' | 'GBP' | 'USD' | 'RON', uom: 'Day' | 'Hour' | 'Month' | 'Fixed', contractId?: string): InvoiceLine[] => [
  { id: `${invoiceId}-l1`, invoiceId, contactId, description: desc, quantity: qty, rate, currencyCode: currency, amount: qty * rate, unitOfMeasure: uom, contractId },
];

export const invoices: Invoice[] = [
  { id: 'inv-1', invoiceNumber: 'CSP-RO-2026-001', entityId: 'ent-1', accountId: 'acc-1', contractId: 'ctr-1', currencyCode: 'EUR', invoiceDate: '2026-01-05', dueDate: '2026-02-04', subtotal: 10000, vatRate: 19, vatAmount: 1900, total: 11900, status: 'Paid', paymentReceivedDate: '2026-01-28', periodMonth: 12, periodYear: 2025, lines: makeLines('inv-1', 'con-1', 'React Development - Dec 2025', 20, 500, 'EUR', 'Day', 'ctr-1') },
  { id: 'inv-2', invoiceNumber: 'CSP-RO-2026-002', entityId: 'ent-1', accountId: 'acc-1', contractId: 'ctr-2', currencyCode: 'EUR', invoiceDate: '2026-01-05', dueDate: '2026-02-04', subtotal: 9000, vatRate: 19, vatAmount: 1710, total: 10710, status: 'Paid', paymentReceivedDate: '2026-02-01', periodMonth: 12, periodYear: 2025, lines: makeLines('inv-2', 'con-8', 'Frontend Development - Dec 2025', 20, 450, 'EUR', 'Day', 'ctr-2') },
  { id: 'inv-3', invoiceNumber: 'CSP-RO-2026-003', entityId: 'ent-1', accountId: 'acc-2', contractId: 'ctr-3', currencyCode: 'EUR', invoiceDate: '2026-01-10', dueDate: '2026-02-24', subtotal: 9600, vatRate: 0, vatAmount: 0, total: 9600, status: 'Paid', paymentReceivedDate: '2026-02-20', periodMonth: 12, periodYear: 2025, lines: makeLines('inv-3', 'con-1', 'Node.js Development - Dec 2025', 20, 480, 'EUR', 'Day', 'ctr-3') },
  { id: 'inv-4', invoiceNumber: 'CSP-BG-2026-001', entityId: 'ent-2', accountId: 'acc-3', contractId: 'ctr-4', currencyCode: 'GBP', invoiceDate: '2026-01-05', dueDate: '2026-02-04', subtotal: 9000, vatRate: 20, vatAmount: 1800, total: 10800, status: 'Paid', paymentReceivedDate: '2026-01-30', periodMonth: 12, periodYear: 2025, lines: makeLines('inv-4', 'con-2', 'Java Development - Dec 2025', 20, 450, 'GBP', 'Day', 'ctr-4') },
  { id: 'inv-5', invoiceNumber: 'CSP-US-2026-001', entityId: 'ent-3', accountId: 'acc-4', contractId: 'ctr-5', currencyCode: 'USD', invoiceDate: '2026-01-05', dueDate: '2026-02-04', subtotal: 15200, vatRate: 0, vatAmount: 0, total: 15200, status: 'Paid', paymentReceivedDate: '2026-01-29', periodMonth: 12, periodYear: 2025, lines: makeLines('inv-5', 'con-3', 'Data Engineering - Dec 2025', 160, 95, 'USD', 'Hour', 'ctr-5') },
  { id: 'inv-6', invoiceNumber: 'CSP-RO-2026-004', entityId: 'ent-1', accountId: 'acc-1', contractId: 'ctr-1', currencyCode: 'EUR', invoiceDate: '2026-02-05', dueDate: '2026-03-07', subtotal: 11000, vatRate: 19, vatAmount: 2090, total: 13090, status: 'Paid', paymentReceivedDate: '2026-03-05', periodMonth: 1, periodYear: 2026, lines: makeLines('inv-6', 'con-1', 'React Development - Jan 2026', 22, 500, 'EUR', 'Day', 'ctr-1') },
  { id: 'inv-7', invoiceNumber: 'CSP-RO-2026-005', entityId: 'ent-1', accountId: 'acc-1', contractId: 'ctr-2', currencyCode: 'EUR', invoiceDate: '2026-02-05', dueDate: '2026-03-07', subtotal: 9900, vatRate: 19, vatAmount: 1881, total: 11781, status: 'Paid', paymentReceivedDate: '2026-03-03', periodMonth: 1, periodYear: 2026, lines: makeLines('inv-7', 'con-8', 'Frontend Development - Jan 2026', 22, 450, 'EUR', 'Day', 'ctr-2') },
  { id: 'inv-8', invoiceNumber: 'CSP-BG-2026-002', entityId: 'ent-2', accountId: 'acc-3', contractId: 'ctr-4', currencyCode: 'GBP', invoiceDate: '2026-02-05', dueDate: '2026-03-07', subtotal: 9900, vatRate: 20, vatAmount: 1980, total: 11880, status: 'Sent', periodMonth: 1, periodYear: 2026, lines: makeLines('inv-8', 'con-2', 'Java Development - Jan 2026', 22, 450, 'GBP', 'Day', 'ctr-4') },
  { id: 'inv-9', invoiceNumber: 'CSP-US-2026-002', entityId: 'ent-3', accountId: 'acc-4', contractId: 'ctr-5', currencyCode: 'USD', invoiceDate: '2026-02-05', dueDate: '2026-03-07', subtotal: 16720, vatRate: 0, vatAmount: 0, total: 16720, status: 'Sent', periodMonth: 1, periodYear: 2026, lines: makeLines('inv-9', 'con-3', 'Data Engineering - Jan 2026', 176, 95, 'USD', 'Hour', 'ctr-5') },
  { id: 'inv-10', invoiceNumber: 'CSP-RO-2026-006', entityId: 'ent-1', accountId: 'acc-2', contractId: 'ctr-3', currencyCode: 'EUR', invoiceDate: '2026-02-10', dueDate: '2026-03-27', subtotal: 10560, vatRate: 0, vatAmount: 0, total: 10560, status: 'Sent', periodMonth: 1, periodYear: 2026, lines: makeLines('inv-10', 'con-1', 'Node.js Development - Jan 2026', 22, 480, 'EUR', 'Day', 'ctr-3') },
  { id: 'inv-11', invoiceNumber: 'CSP-BG-2026-003', entityId: 'ent-2', accountId: 'acc-15', contractId: 'ctr-6', currencyCode: 'EUR', invoiceDate: '2026-02-05', dueDate: '2026-03-07', subtotal: 11000, vatRate: 20, vatAmount: 2200, total: 13200, status: 'Sent', periodMonth: 1, periodYear: 2026, lines: makeLines('inv-11', 'con-9', 'Platform Engineering - Jan 2026', 22, 500, 'EUR', 'Day', 'ctr-6') },
  { id: 'inv-12', invoiceNumber: 'CSP-RO-2026-007', entityId: 'ent-1', accountId: 'acc-1', contractId: 'ctr-1', currencyCode: 'EUR', invoiceDate: '2026-03-05', dueDate: '2026-04-04', subtotal: 10500, vatRate: 19, vatAmount: 1995, total: 12495, status: 'Sent', periodMonth: 2, periodYear: 2026, lines: makeLines('inv-12', 'con-1', 'React Development - Feb 2026', 21, 500, 'EUR', 'Day', 'ctr-1') },
  { id: 'inv-13', invoiceNumber: 'CSP-RO-2026-008', entityId: 'ent-1', accountId: 'acc-1', contractId: 'ctr-2', currencyCode: 'EUR', invoiceDate: '2026-03-05', dueDate: '2026-04-04', subtotal: 9450, vatRate: 19, vatAmount: 1795.5, total: 11245.5, status: 'Draft', periodMonth: 2, periodYear: 2026, lines: makeLines('inv-13', 'con-8', 'Frontend Development - Feb 2026', 21, 450, 'EUR', 'Day', 'ctr-2') },
  { id: 'inv-14', invoiceNumber: 'CSP-US-2026-003', entityId: 'ent-3', accountId: 'acc-4', contractId: 'ctr-5', currencyCode: 'USD', invoiceDate: '2026-03-05', dueDate: '2026-04-04', subtotal: 15200, vatRate: 0, vatAmount: 0, total: 15200, status: 'Draft', periodMonth: 2, periodYear: 2026, lines: makeLines('inv-14', 'con-3', 'Data Engineering - Feb 2026', 160, 95, 'USD', 'Hour', 'ctr-5') },
  { id: 'inv-15', invoiceNumber: 'CSP-RO-2026-009', entityId: 'ent-1', accountId: 'acc-2', contractId: 'ctr-3', currencyCode: 'EUR', invoiceDate: '2026-03-10', dueDate: '2026-04-24', subtotal: 10080, vatRate: 0, vatAmount: 0, total: 10080, status: 'Overdue', periodMonth: 2, periodYear: 2026, lines: makeLines('inv-15', 'con-1', 'Node.js Development - Feb 2026', 21, 480, 'EUR', 'Day', 'ctr-3') },
  { id: 'inv-16', invoiceNumber: 'CSP-BG-2026-004', entityId: 'ent-2', accountId: 'acc-3', contractId: 'ctr-4', currencyCode: 'GBP', invoiceDate: '2026-03-05', dueDate: '2026-04-04', subtotal: 9450, vatRate: 20, vatAmount: 1890, total: 11340, status: 'Overdue', periodMonth: 2, periodYear: 2026, lines: makeLines('inv-16', 'con-2', 'Java Development - Feb 2026', 21, 450, 'GBP', 'Day', 'ctr-4') },
  { id: 'inv-17', invoiceNumber: 'CSP-RO-2026-010', entityId: 'ent-1', accountId: 'acc-1', contractId: 'ctr-1', currencyCode: 'EUR', invoiceDate: '2026-04-03', dueDate: '2026-05-03', subtotal: 11500, vatRate: 19, vatAmount: 2185, total: 13685, status: 'Draft', periodMonth: 3, periodYear: 2026, lines: makeLines('inv-17', 'con-1', 'React Development - Mar 2026', 23, 500, 'EUR', 'Day', 'ctr-1') },
  { id: 'inv-18', invoiceNumber: 'CSP-BG-2026-005', entityId: 'ent-2', accountId: 'acc-15', contractId: 'ctr-6', currencyCode: 'EUR', invoiceDate: '2026-03-05', dueDate: '2026-04-04', subtotal: 10500, vatRate: 20, vatAmount: 2100, total: 12600, status: 'Sent', periodMonth: 2, periodYear: 2026, lines: makeLines('inv-18', 'con-9', 'Platform Engineering - Feb 2026', 21, 500, 'EUR', 'Day', 'ctr-6') },
  { id: 'inv-19', invoiceNumber: 'CSP-US-2026-004', entityId: 'ent-3', accountId: 'acc-11', contractId: 'ctr-8', currencyCode: 'USD', invoiceDate: '2024-07-05', dueDate: '2024-08-04', subtotal: 12100, vatRate: 0, vatAmount: 0, total: 12100, status: 'Cancelled', periodMonth: 6, periodYear: 2024, lines: makeLines('inv-19', 'con-5', '.NET Development - Jun 2024', 22, 550, 'USD', 'Day', 'ctr-8') },
  { id: 'inv-20', invoiceNumber: 'CSP-RO-2025-050', entityId: 'ent-1', accountId: 'acc-5', contractId: 'ctr-7', currencyCode: 'EUR', invoiceDate: '2025-11-05', dueDate: '2025-12-05', subtotal: 9000, vatRate: 19, vatAmount: 1710, total: 10710, status: 'Paid', paymentReceivedDate: '2025-11-28', periodMonth: 10, periodYear: 2025, lines: makeLines('inv-20', 'con-4', 'Cloud Architecture - Oct 2025', 1, 9000, 'EUR', 'Month', 'ctr-7') },
];

// ===== EXPENSES =====
export const expenses: Expense[] = [
  { id: 'exp-1', reference: 'EXP-000001', entityId: 'ent-1', accountId: 'acc-6', expenseType: 'Contractor Payment', contractId: 'ctr-1', currencyCode: 'EUR', totalAmount: 8330, vatAmount: 1330, netAmount: 7000, dateIssued: '2026-01-10', dueDate: '2026-01-25', paymentDate: '2026-01-20', status: 'Paid', periodMonth: 12, periodYear: 2025 },
  { id: 'exp-2', reference: 'EXP-000002', entityId: 'ent-1', accountId: 'acc-6', expenseType: 'Contractor Payment', contractId: 'ctr-2', currencyCode: 'EUR', totalAmount: 7616, vatAmount: 1216, netAmount: 6400, dateIssued: '2026-01-10', dueDate: '2026-01-25', paymentDate: '2026-01-20', status: 'Paid', periodMonth: 12, periodYear: 2025 },
  { id: 'exp-3', reference: 'EXP-000003', entityId: 'ent-2', accountId: 'acc-7', expenseType: 'Contractor Payment', contractId: 'ctr-4', currencyCode: 'EUR', totalAmount: 7140, vatAmount: 1140, netAmount: 6000, dateIssued: '2026-01-10', dueDate: '2026-01-25', paymentDate: '2026-01-22', status: 'Paid', periodMonth: 12, periodYear: 2025 },
  { id: 'exp-4', reference: 'EXP-000004', entityId: 'ent-3', accountId: 'acc-8', expenseType: 'Contractor Payment', contractId: 'ctr-5', currencyCode: 'USD', totalAmount: 12000, vatAmount: 0, netAmount: 12000, dateIssued: '2026-01-10', dueDate: '2026-01-25', paymentDate: '2026-01-23', status: 'Paid', periodMonth: 12, periodYear: 2025 },
  { id: 'exp-5', reference: 'EXP-000005', entityId: 'ent-1', accountId: 'acc-9', expenseType: 'Software Subscription', currencyCode: 'USD', totalAmount: 1500, vatAmount: 0, netAmount: 1500, dateIssued: '2026-01-15', dueDate: '2026-02-14', paymentDate: '2026-02-10', status: 'Paid', periodMonth: 1, periodYear: 2026 },
  { id: 'exp-6', reference: 'EXP-000006', entityId: 'ent-1', accountId: 'acc-10', expenseType: 'Tax', currencyCode: 'RON', totalAmount: 15000, vatAmount: 0, netAmount: 15000, dateIssued: '2026-01-25', dueDate: '2026-02-25', paymentDate: '2026-02-20', status: 'Paid', periodMonth: 1, periodYear: 2026 },
  { id: 'exp-7', reference: 'EXP-000007', entityId: 'ent-1', accountId: 'acc-13', expenseType: 'Office Rent', currencyCode: 'EUR', totalAmount: 2380, vatAmount: 380, netAmount: 2000, dateIssued: '2026-02-01', dueDate: '2026-02-15', paymentDate: '2026-02-10', status: 'Paid', periodMonth: 2, periodYear: 2026 },
  { id: 'exp-8', reference: 'EXP-000008', entityId: 'ent-1', accountId: 'acc-6', expenseType: 'Contractor Payment', contractId: 'ctr-1', currencyCode: 'EUR', totalAmount: 9163, vatAmount: 1463, netAmount: 7700, dateIssued: '2026-02-10', dueDate: '2026-02-25', status: 'Approved', periodMonth: 1, periodYear: 2026 },
  { id: 'exp-9', reference: 'EXP-000009', entityId: 'ent-1', accountId: 'acc-6', expenseType: 'Contractor Payment', contractId: 'ctr-2', currencyCode: 'EUR', totalAmount: 8377.6, vatAmount: 1337.6, netAmount: 7040, dateIssued: '2026-02-10', dueDate: '2026-02-25', status: 'Approved', periodMonth: 1, periodYear: 2026 },
  { id: 'exp-10', reference: 'EXP-000010', entityId: 'ent-2', accountId: 'acc-7', expenseType: 'Contractor Payment', contractId: 'ctr-4', currencyCode: 'EUR', totalAmount: 7854, vatAmount: 1254, netAmount: 6600, dateIssued: '2026-02-10', dueDate: '2026-02-25', status: 'Approved', periodMonth: 1, periodYear: 2026 },
  { id: 'exp-11', reference: 'EXP-000011', entityId: 'ent-3', accountId: 'acc-8', expenseType: 'Contractor Payment', contractId: 'ctr-5', currencyCode: 'USD', totalAmount: 13200, vatAmount: 0, netAmount: 13200, dateIssued: '2026-02-10', dueDate: '2026-02-25', status: 'Approved', periodMonth: 1, periodYear: 2026 },
  { id: 'exp-12', reference: 'EXP-000012', entityId: 'ent-1', accountId: 'acc-6', expenseType: 'Contractor Payment', contractId: 'ctr-1', currencyCode: 'EUR', totalAmount: 8747, vatAmount: 1397, netAmount: 7350, dateIssued: '2026-03-10', dueDate: '2026-03-25', status: 'Pending', periodMonth: 2, periodYear: 2026 },
  { id: 'exp-13', reference: 'EXP-000013', entityId: 'ent-2', accountId: 'acc-7', expenseType: 'Contractor Payment', contractId: 'ctr-6', currencyCode: 'EUR', totalAmount: 9163, vatAmount: 1463, netAmount: 7700, dateIssued: '2026-02-10', dueDate: '2026-02-25', status: 'Approved', periodMonth: 1, periodYear: 2026 },
  { id: 'exp-14', reference: 'EXP-000014', entityId: 'ent-1', accountId: 'acc-9', expenseType: 'Software Subscription', currencyCode: 'USD', totalAmount: 1500, vatAmount: 0, netAmount: 1500, dateIssued: '2026-02-15', dueDate: '2026-03-14', status: 'Pending', periodMonth: 2, periodYear: 2026 },
  { id: 'exp-15', reference: 'EXP-000015', entityId: 'ent-1', accountId: 'acc-13', expenseType: 'Office Rent', currencyCode: 'EUR', totalAmount: 2380, vatAmount: 380, netAmount: 2000, dateIssued: '2026-03-01', dueDate: '2026-03-15', status: 'Pending', periodMonth: 3, periodYear: 2026 },
];

// ===== TIMESHEETS =====
function generateWeekEntries(weekStart: string, hours: number[]): TimesheetEntry[] {
  const start = new Date(weekStart);
  return hours.map((h, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return { date: d.toISOString().split('T')[0], hours: h };
  });
}

export const timesheets: Timesheet[] = [
  { id: 'ts-1', reference: 'TS-2026-001', contactId: 'con-1', contractId: 'ctr-1', weekStart: '2026-03-02', totalHours: 40, status: 'Approved', entries: generateWeekEntries('2026-03-02', [8, 8, 8, 8, 8, 0, 0]) },
  { id: 'ts-2', reference: 'TS-2026-002', contactId: 'con-1', contractId: 'ctr-1', weekStart: '2026-03-09', totalHours: 40, status: 'Approved', entries: generateWeekEntries('2026-03-09', [8, 8, 8, 8, 8, 0, 0]) },
  { id: 'ts-3', reference: 'TS-2026-003', contactId: 'con-1', contractId: 'ctr-1', weekStart: '2026-03-16', totalHours: 40, status: 'Approved', entries: generateWeekEntries('2026-03-16', [8, 8, 8, 8, 8, 0, 0]) },
  { id: 'ts-4', reference: 'TS-2026-004', contactId: 'con-1', contractId: 'ctr-1', weekStart: '2026-03-23', totalHours: 40, status: 'Submitted', entries: generateWeekEntries('2026-03-23', [8, 8, 8, 8, 8, 0, 0]) },
  { id: 'ts-5', reference: 'TS-2026-005', contactId: 'con-8', contractId: 'ctr-2', weekStart: '2026-03-02', totalHours: 40, status: 'Approved', entries: generateWeekEntries('2026-03-02', [8, 8, 8, 8, 8, 0, 0]) },
  { id: 'ts-6', reference: 'TS-2026-006', contactId: 'con-8', contractId: 'ctr-2', weekStart: '2026-03-09', totalHours: 40, status: 'Approved', entries: generateWeekEntries('2026-03-09', [8, 8, 8, 8, 8, 0, 0]) },
  { id: 'ts-7', reference: 'TS-2026-007', contactId: 'con-8', contractId: 'ctr-2', weekStart: '2026-03-16', totalHours: 32, status: 'Submitted', entries: generateWeekEntries('2026-03-16', [8, 8, 8, 8, 0, 0, 0]) },
  { id: 'ts-8', reference: 'TS-2026-008', contactId: 'con-2', contractId: 'ctr-4', weekStart: '2026-03-02', totalHours: 40, status: 'Approved', entries: generateWeekEntries('2026-03-02', [8, 8, 8, 8, 8, 0, 0]) },
  { id: 'ts-9', reference: 'TS-2026-009', contactId: 'con-2', contractId: 'ctr-4', weekStart: '2026-03-09', totalHours: 40, status: 'Submitted', entries: generateWeekEntries('2026-03-09', [8, 8, 8, 8, 8, 0, 0]) },
  { id: 'ts-10', reference: 'TS-2026-010', contactId: 'con-3', contractId: 'ctr-5', weekStart: '2026-03-02', totalHours: 40, status: 'Approved', entries: generateWeekEntries('2026-03-02', [8, 8, 8, 8, 8, 0, 0]) },
  { id: 'ts-11', reference: 'TS-2026-011', contactId: 'con-3', contractId: 'ctr-5', weekStart: '2026-03-09', totalHours: 40, status: 'Submitted', entries: generateWeekEntries('2026-03-09', [8, 8, 8, 8, 8, 0, 0]) },
  { id: 'ts-12', reference: 'TS-2026-012', contactId: 'con-9', contractId: 'ctr-6', weekStart: '2026-03-02', totalHours: 40, status: 'Approved', entries: generateWeekEntries('2026-03-02', [8, 8, 8, 8, 8, 0, 0]) },
];

// ===== LEAVE REQUESTS =====
export const leaveRequests: LeaveRequest[] = [
  { id: 'lr-1', contactId: 'con-1', leaveType: 'Annual Leave', startDate: '2026-04-14', endDate: '2026-04-18', totalDays: 5, status: 'Pending', reason: 'Family vacation' },
  { id: 'lr-2', contactId: 'con-2', leaveType: 'Sick Leave', startDate: '2026-03-20', endDate: '2026-03-21', totalDays: 2, status: 'Approved', reason: 'Medical appointment' },
  { id: 'lr-3', contactId: 'con-8', leaveType: 'Personal Leave', startDate: '2026-04-07', endDate: '2026-04-07', totalDays: 1, status: 'Pending', reason: 'Personal matter' },
];

// ===== DIVIDENDS =====
export const dividends: Dividend[] = [
  { id: 'div-1', entityId: 'ent-1', contactId: 'con-1', amount: 15000, currencyCode: 'EUR', paymentDate: '2025-12-20', taxWithheld: 750, netAmount: 14250 },
  { id: 'div-2', entityId: 'ent-1', contactId: 'con-8', amount: 10000, currencyCode: 'EUR', paymentDate: '2025-12-20', taxWithheld: 500, netAmount: 9500 },
];

// ===== BANK STATEMENTS =====
export const bankStatements: BankStatement[] = [
  {
    id: 'bs-1', entityId: 'ent-1', periodStart: '2026-01-01', periodEnd: '2026-01-31',
    lines: [
      { id: 'bsl-1', bankStatementId: 'bs-1', transactionDate: '2026-01-28', reference: 'TechCorp INV-001', credit: 11900, matchedInvoiceId: 'inv-1', reconciled: true, explanation: 'Invoice CSP-RO-2026-001' },
      { id: 'bsl-2', bankStatementId: 'bs-1', transactionDate: '2026-01-20', reference: 'Popescu SRL - CTR1', debit: 8330, matchedExpenseId: 'exp-1', reconciled: true, explanation: 'Contractor payment' },
      { id: 'bsl-3', bankStatementId: 'bs-1', transactionDate: '2026-01-20', reference: 'Popescu SRL - CTR2', debit: 7616, matchedExpenseId: 'exp-2', reconciled: true, explanation: 'Contractor payment' },
      { id: 'bsl-4', bankStatementId: 'bs-1', transactionDate: '2026-01-15', reference: 'AWS', debit: 1500, reconciled: false },
      { id: 'bsl-5', bankStatementId: 'bs-1', transactionDate: '2026-01-30', reference: 'Unknown credit', credit: 5000, reconciled: false },
    ],
  },
  {
    id: 'bs-2', entityId: 'ent-1', periodStart: '2026-02-01', periodEnd: '2026-02-28',
    lines: [
      { id: 'bsl-6', bankStatementId: 'bs-2', transactionDate: '2026-02-01', reference: 'TechCorp INV-002', credit: 10710, matchedInvoiceId: 'inv-2', reconciled: true, explanation: 'Invoice CSP-RO-2026-002' },
      { id: 'bsl-7', bankStatementId: 'bs-2', transactionDate: '2026-02-20', reference: 'Nordic INV-003', credit: 9600, matchedInvoiceId: 'inv-3', reconciled: true, explanation: 'Invoice CSP-RO-2026-003' },
      { id: 'bsl-8', bankStatementId: 'bs-2', transactionDate: '2026-02-10', reference: 'Office Hub rent', debit: 2380, matchedExpenseId: 'exp-7', reconciled: true },
      { id: 'bsl-9', bankStatementId: 'bs-2', transactionDate: '2026-02-20', reference: 'ANAF taxes', debit: 15000, reconciled: false },
    ],
  },
];

// ===== EXCHANGE RATES =====
export const exchangeRates: ExchangeRate[] = [
  { id: 'er-1', fromCurrencyCode: 'EUR', toCurrencyCode: 'RON', rate: 4.9750, effectiveDate: '2026-03-01', month: 3, year: 2026 },
  { id: 'er-2', fromCurrencyCode: 'USD', toCurrencyCode: 'RON', rate: 4.5620, effectiveDate: '2026-03-01', month: 3, year: 2026 },
  { id: 'er-3', fromCurrencyCode: 'GBP', toCurrencyCode: 'RON', rate: 5.7800, effectiveDate: '2026-03-01', month: 3, year: 2026 },
  { id: 'er-4', fromCurrencyCode: 'EUR', toCurrencyCode: 'RON', rate: 4.9720, effectiveDate: '2026-02-01', month: 2, year: 2026 },
  { id: 'er-5', fromCurrencyCode: 'USD', toCurrencyCode: 'RON', rate: 4.5500, effectiveDate: '2026-02-01', month: 2, year: 2026 },
  { id: 'er-6', fromCurrencyCode: 'GBP', toCurrencyCode: 'RON', rate: 5.7650, effectiveDate: '2026-02-01', month: 2, year: 2026 },
  { id: 'er-7', fromCurrencyCode: 'EUR', toCurrencyCode: 'RON', rate: 4.9700, effectiveDate: '2026-01-01', month: 1, year: 2026 },
  { id: 'er-8', fromCurrencyCode: 'USD', toCurrencyCode: 'RON', rate: 4.5400, effectiveDate: '2026-01-01', month: 1, year: 2026 },
  { id: 'er-9', fromCurrencyCode: 'GBP', toCurrencyCode: 'RON', rate: 5.7500, effectiveDate: '2026-01-01', month: 1, year: 2026 },
  { id: 'er-10', fromCurrencyCode: 'EUR', toCurrencyCode: 'RON', rate: 4.9680, effectiveDate: '2025-12-01', month: 12, year: 2025 },
  { id: 'er-11', fromCurrencyCode: 'USD', toCurrencyCode: 'RON', rate: 4.5300, effectiveDate: '2025-12-01', month: 12, year: 2025 },
  { id: 'er-12', fromCurrencyCode: 'GBP', toCurrencyCode: 'RON', rate: 5.7400, effectiveDate: '2025-12-01', month: 12, year: 2025 },
];

// ===== PUBLIC HOLIDAYS =====
export const publicHolidays: PublicHoliday[] = [
  { id: 'ph-1', name: "New Year's Day", date: '2026-01-01', country: 'Romania', year: 2026 },
  { id: 'ph-2', name: "New Year's Day (2nd)", date: '2026-01-02', country: 'Romania', year: 2026 },
  { id: 'ph-3', name: 'Unification Day', date: '2026-01-24', country: 'Romania', year: 2026 },
  { id: 'ph-4', name: 'Easter Monday', date: '2026-04-13', country: 'Romania', year: 2026 },
  { id: 'ph-5', name: 'Labour Day', date: '2026-05-01', country: 'Romania', year: 2026 },
  { id: 'ph-6', name: 'National Day', date: '2026-12-01', country: 'Romania', year: 2026 },
  { id: 'ph-7', name: 'Christmas', date: '2026-12-25', country: 'Romania', year: 2026 },
  { id: 'ph-8', name: 'Liberation Day', date: '2026-03-03', country: 'Bulgaria', year: 2026 },
  { id: 'ph-9', name: 'Labour Day', date: '2026-05-01', country: 'Bulgaria', year: 2026 },
  { id: 'ph-10', name: 'National Day', date: '2026-09-06', country: 'Bulgaria', year: 2026 },
  { id: 'ph-11', name: "New Year's Day", date: '2026-01-01', country: 'US', year: 2026 },
  { id: 'ph-12', name: 'Independence Day', date: '2026-07-04', country: 'US', year: 2026 },
  { id: 'ph-13', name: 'Thanksgiving', date: '2026-11-26', country: 'US', year: 2026 },
  { id: 'ph-14', name: 'Christmas', date: '2026-12-25', country: 'US', year: 2026 },
  { id: 'ph-15', name: "New Year's Day", date: '2026-01-01', country: 'UK', year: 2026 },
  { id: 'ph-16', name: 'Good Friday', date: '2026-04-03', country: 'UK', year: 2026 },
  { id: 'ph-17', name: 'Christmas', date: '2026-12-25', country: 'UK', year: 2026 },
];

// ===== REPORTING SNAPSHOTS =====
export const reportingSnapshots: ReportingSnapshot[] = [
  { id: 'rs-1', entityId: 'ent-1', month: 12, year: 2025, revenue: 28600, revenueRon: 142162, costs: 22946, costsRon: 114042, grossProfit: 5654, grossProfitRon: 28120, marginPercent: 19.8, activeContracts: 3, invoicesIssued: 3, currencyCode: 'EUR', snapshotType: 'Actual' },
  { id: 'rs-2', entityId: 'ent-2', month: 12, year: 2025, revenue: 9000, revenueRon: 51750, costs: 7140, costsRon: 35506, grossProfit: 1860, grossProfitRon: 16244, marginPercent: 20.7, activeContracts: 1, invoicesIssued: 1, currencyCode: 'GBP', snapshotType: 'Actual' },
  { id: 'rs-3', entityId: 'ent-3', month: 12, year: 2025, revenue: 15200, revenueRon: 69008, costs: 12000, costsRon: 54480, grossProfit: 3200, grossProfitRon: 14528, marginPercent: 21.1, activeContracts: 1, invoicesIssued: 1, currencyCode: 'USD', snapshotType: 'Actual' },
  { id: 'rs-4', entityId: 'ent-1', month: 1, year: 2026, revenue: 31460, revenueRon: 156407, costs: 25040.6, costsRon: 124452, grossProfit: 6419.4, grossProfitRon: 31955, marginPercent: 20.4, activeContracts: 3, invoicesIssued: 3, currencyCode: 'EUR', snapshotType: 'Actual' },
  { id: 'rs-5', entityId: 'ent-2', month: 1, year: 2026, revenue: 20900, revenueRon: 103896, costs: 15017, costsRon: 74654, grossProfit: 5883, grossProfitRon: 29242, marginPercent: 28.1, activeContracts: 2, invoicesIssued: 2, currencyCode: 'EUR', snapshotType: 'Actual' },
  { id: 'rs-6', entityId: 'ent-3', month: 1, year: 2026, revenue: 16720, revenueRon: 76118, costs: 13200, costsRon: 60060, grossProfit: 3520, grossProfitRon: 16058, marginPercent: 21.1, activeContracts: 1, invoicesIssued: 1, currencyCode: 'USD', snapshotType: 'Actual' },
];

// ===== ONBOARDING CANDIDATES =====
export const availabilitySlots: AvailabilitySlot[] = [
  { id: 'slot-1', dayOfWeek: 'Monday', startTime: '10:00', endTime: '10:15', weekStart: '2026-04-06', weekEnd: '2026-06-29', teamsLink: 'https://teams.microsoft.com/l/meetup-join/slot1', isActive: true, status: 'Available', interviewerId: 'con-1' },
  { id: 'slot-2', dayOfWeek: 'Monday', startTime: '14:00', endTime: '14:15', weekStart: '2026-04-06', weekEnd: '2026-06-29', teamsLink: 'https://teams.microsoft.com/l/meetup-join/slot2', isActive: true, status: 'Fully Booked', interviewerId: 'con-4' },
  { id: 'slot-3', dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '09:15', weekStart: '2026-04-06', weekEnd: '2026-06-29', teamsLink: 'https://teams.microsoft.com/l/meetup-join/slot3', isActive: true, status: 'Available', interviewerId: 'con-8' },
  { id: 'slot-4', dayOfWeek: 'Wednesday', startTime: '15:00', endTime: '15:15', weekStart: '2026-04-06', weekEnd: '2026-06-29', teamsLink: 'https://teams.microsoft.com/l/meetup-join/slot4', isActive: true, status: 'Available', interviewerId: 'con-1' },
  { id: 'slot-5', dayOfWeek: 'Friday', startTime: '10:00', endTime: '10:15', weekStart: '2026-04-06', weekEnd: '2026-05-31', teamsLink: 'https://teams.microsoft.com/l/meetup-join/slot5', isActive: true, status: 'Available' },
  { id: 'slot-6', dayOfWeek: 'Friday', startTime: '16:00', endTime: '16:15', weekStart: '2026-01-06', weekEnd: '2026-03-31', teamsLink: '', isActive: false, status: 'Expired' },
];

export const onboardingCandidates: OnboardingCandidate[] = [
  { id: 'cand-1', firstName: 'Andrei', lastName: 'Mihai', email: 'andrei.mihai@gmail.com', phone: '+40722111222', path: 'B2B seeking Contracts', cvFileName: 'Andrei_Mihai_CV.pdf', hourlyRateEur: 45, b2bEntityName: 'Mihai Consulting SRL', selectedSlots: ['slot-1', 'slot-3', 'slot-5'], confirmedSlotId: 'slot-3', reviewerNotes: 'Strong React/Node profile. 5 years experience.', status: 'Fit', appliedDate: '2026-03-10', reviewedBy: 'Admin User', createdContactId: 'con-new-1', createdAccountId: 'acc-new-1' },
  { id: 'cand-2', firstName: 'Cristina', lastName: 'Barbu', email: 'cristina.barbu@yahoo.com', phone: '+40733222333', path: 'CIM to B2B', cvFileName: 'Cristina_Barbu_CV.pdf', hourlyRateEur: 35, selectedSlots: ['slot-2', 'slot-4', 'slot-5'], confirmedSlotId: 'slot-4', reviewerNotes: 'Junior profile, needs mentoring.', status: 'Not Fit', appliedDate: '2026-03-12', reviewedBy: 'Admin User' },
  { id: 'cand-3', firstName: 'Vlad', lastName: 'Ionescu', email: 'vlad.ionescu@outlook.com', phone: '+40744333444', path: 'B2B seeking Contracts', cvFileName: 'Vlad_Ionescu_CV.pdf', hourlyRateEur: 55, b2bEntityName: 'Ionescu Tech SRL', selectedSlots: ['slot-1', 'slot-3', 'slot-5'], confirmedSlotId: 'slot-1', status: 'Scheduled', appliedDate: '2026-03-15' },
  { id: 'cand-4', firstName: 'Diana', lastName: 'Popa', email: 'diana.popa@gmail.com', phone: '+40755444555', path: 'B2B seeking Contracts', cvFileName: 'Diana_Popa_CV.pdf', hourlyRateEur: 50, b2bEntityName: 'Popa Digital SRL', selectedSlots: ['slot-2', 'slot-3', 'slot-5'], confirmedSlotId: 'slot-5', status: 'Scheduled', appliedDate: '2026-03-18' },
  { id: 'cand-5', firstName: 'Bogdan', lastName: 'Stanescu', email: 'bogdan.s@gmail.com', phone: '+40766555666', path: 'CIM to B2B', cvFileName: 'Bogdan_Stanescu_CV.pdf', hourlyRateEur: 40, selectedSlots: ['slot-1', 'slot-4', 'slot-5'], status: 'Applied', appliedDate: '2026-03-20' },
  { id: 'cand-6', firstName: 'Alexandra', lastName: 'Dobre', email: 'alexandra.d@email.com', phone: '+40777666777', path: 'B2B seeking Contracts', cvFileName: 'Alexandra_Dobre_CV.pdf', hourlyRateEur: 60, b2bEntityName: 'Dobre Solutions SRL', selectedSlots: ['slot-2', 'slot-3', 'slot-5'], status: 'Applied', appliedDate: '2026-03-22' },
  { id: 'cand-7', firstName: 'Radu', lastName: 'Gheorghe', email: 'radu.g@yahoo.com', phone: '+40788777888', path: 'CIM to B2B', cvFileName: 'Radu_Gheorghe_CV.pdf', hourlyRateEur: 38, selectedSlots: ['slot-1', 'slot-2', 'slot-5'], status: 'Applied', appliedDate: '2026-03-25' },
  { id: 'cand-8', firstName: 'Simona', lastName: 'Tudor', email: 'simona.tudor@gmail.com', phone: '+40799888999', path: 'B2B seeking Contracts', cvFileName: 'Simona_Tudor_CV.pdf', hourlyRateEur: 48, b2bEntityName: 'Tudor IT Consulting SRL', selectedSlots: ['slot-3', 'slot-4', 'slot-5'], confirmedSlotId: 'slot-3', reviewerNotes: 'Great Azure & DevOps skills. Recommended.', status: 'Fit', appliedDate: '2026-03-08', reviewedBy: 'Admin User', createdContactId: 'con-new-2', createdAccountId: 'acc-new-2' },
];

export function getSlotById(id: string) { return availabilitySlots.find(s => s.id === id); }
export function getInterviewers() { return contacts.filter(c => c.isInterviewer); }

// ===== PAYMENT DETAILS =====
export const paymentDetails: PaymentDetail[] = [
  { id: 'pd-1', accountId: 'acc-1', currencyCode: 'EUR', iban: 'DE89370400440532013000', swift: 'COBADEFFXXX', bankName: 'Commerzbank', isPrimary: true },
  { id: 'pd-2', accountId: 'acc-3', currencyCode: 'GBP', iban: 'GB29NWBK60161331926819', swift: 'NWBKGB2L', bankName: 'NatWest', isPrimary: true },
  { id: 'pd-3', accountId: 'acc-4', currencyCode: 'USD', iban: 'N/A', swift: 'CHASUS33', bankName: 'JPMorgan Chase', isPrimary: true },
];

// ===== CONTRACT MILESTONES =====
export const contractMilestones: ContractMilestone[] = [
  { id: 'ms-1', milestoneId: 'MS-001', contractId: 'ctr-7', description: 'Phase 1 - Cloud Architecture Design', value: 15000, currencyCode: 'EUR', startDate: '2025-02-01', endDate: '2025-03-15', status: 'Paid' },
  { id: 'ms-2', milestoneId: 'MS-002', contractId: 'ctr-7', description: 'Phase 2 - Infrastructure Setup & Migration', value: 20000, currencyCode: 'EUR', startDate: '2025-03-16', endDate: '2025-05-15', status: 'Invoiced' },
  { id: 'ms-3', milestoneId: 'MS-003', contractId: 'ctr-7', description: 'Phase 3 - Testing & Go-Live', value: 19000, currencyCode: 'EUR', startDate: '2025-05-16', endDate: '2025-07-31', status: 'Pending' },
];

// Helper lookups
export function getEntityById(id: string) { return entities.find(e => e.id === id); }
export function getAccountById(id: string) { return accounts.find(a => a.id === id); }
export function getContactById(id: string) { return contacts.find(c => c.id === id); }
export function getContractById(id: string) { return contracts.find(c => c.id === id); }
export function getMilestonesByContractId(contractId: string) { return contractMilestones.filter(m => m.contractId === contractId); }
export function getContractLookupLabel(c: { id: string; contractNumber: string; parentAccountId: string; contactId: string; entityId: string }) {
  const account = getAccountById(c.parentAccountId)?.name || '\u2014';
  const contact = getContactById(c.contactId);
  const consultant = contact ? `${contact.firstName} ${contact.lastName}` : '\u2014';
  const country = getEntityById(c.entityId)?.country || '\u2014';
  return `${c.contractNumber} | ${account} | ${consultant} | ${country}`;
}
