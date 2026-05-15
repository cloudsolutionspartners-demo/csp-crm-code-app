import {
  BusinessEntity, Account, Contact, Contract, Invoice, InvoiceLine,
  Expense, Timesheet, TimesheetEntry, LeaveRequest, Dividend,
  BankStatement, BankStatementLine, ExchangeRate, PublicHoliday,
  ReportingSnapshot, PaymentDetail, OnboardingCandidate, AvailabilitySlot,
  ContractMilestone, JDSkill, JDPlatform,
  Prospect, ProspectInteraction, ProspectMaterial,
  Opportunity, OpportunityMaterial,
  CorporateAction,
} from '@/types/crm';

export const corporateActions: CorporateAction[] = [
  {
    id: 'ca-001',
    actionSummarizedTitle: 'Invoice INV-2025-0142 overdue by 18 days',
    actionDetails: 'AI scan detected that invoice INV-2025-0142 issued to Acme Holdings on 2026-04-12 for €24,500 has been in "Sent" status for 47 days, exceeding the 30-day payment terms by 18 days. No matching credit was found in the latest bank statement reconciliation. Recommended: send a payment reminder and validate banking details on file.',
    priority: 'High',
    status: 'New',
    dueDate: '2026-05-22',
    createdAt: '2026-05-14T08:12:00Z',
    modifiedAt: '2026-05-14T08:12:00Z',
  },
  {
    id: 'ca-002',
    actionSummarizedTitle: 'Contract CT-088 ends in 12 days, no renewal in pipeline',
    actionDetails: 'Contract CT-088 (Consultant: Petar Ivanov, Client: Northwind Logistics) has an end date of 2026-05-27 and no follow-on opportunity has been raised. Average margin on this contract is 27%. Recommended: contact the account manager and confirm renewal intent.',
    priority: 'High',
    status: 'In Progress',
    dueDate: '2026-05-20',
    createdAt: '2026-05-12T09:45:00Z',
    modifiedAt: '2026-05-13T14:02:00Z',
  },
  {
    id: 'ca-003',
    actionSummarizedTitle: '3 candidates marked Fit but no interview slot booked',
    actionDetails: 'Candidates Maria Stoyanova, James O\'Connor and Lucia Marin have been marked Fit for over 5 days with no Booked availability slot. Hiring velocity drops by ~40% when slots are not confirmed within 7 days of Fit decision.',
    priority: 'Medium',
    status: 'New',
    dueDate: '2026-05-19',
    createdAt: '2026-05-13T11:30:00Z',
    modifiedAt: '2026-05-13T11:30:00Z',
  },
  {
    id: 'ca-004',
    actionSummarizedTitle: 'Exchange rate for EUR→RON missing for May 2026',
    actionDetails: 'No ExchangeRate record exists for EUR→RON with effective date in May 2026. Reports and invoice snapshots will fall back to April 2026 rate (4.9772). Recommended: import the BNR official monthly rate.',
    priority: 'Low',
    status: 'New',
    dueDate: '2026-05-31',
    createdAt: '2026-05-10T07:00:00Z',
    modifiedAt: '2026-05-10T07:00:00Z',
  },
  {
    id: 'ca-005',
    actionSummarizedTitle: 'Bank statement BG-Apr-2026 has 4 unmatched credits',
    actionDetails: 'Smart Match for the BG entity April 2026 statement left 4 credit lines unreconciled (total €18,420). Two are within ±0.01 of open invoices but outside the ±30 day window. Recommended: review manually and confirm matches.',
    priority: 'Medium',
    status: 'In Progress',
    dueDate: '2026-05-18',
    createdAt: '2026-05-08T15:20:00Z',
    modifiedAt: '2026-05-13T09:10:00Z',
  },
  {
    id: 'ca-006',
    actionSummarizedTitle: 'Public holidays for 2026 not loaded for Bulgaria',
    actionDetails: 'Settings → Public Holidays contains 0 records with country=Bulgaria and year=2026. Working day calculations on Reports and Leave will be inaccurate.',
    priority: 'Medium',
    status: 'Closed',
    closingComments: 'Imported the official 2026 BG holiday calendar (12 entries) on 2026-05-09. Verified Reports working-day counts for May refreshed correctly.',
    dueDate: '2026-05-15',
    createdAt: '2026-05-05T10:00:00Z',
    modifiedAt: '2026-05-09T16:40:00Z',
  },
  {
    id: 'ca-007',
    actionSummarizedTitle: 'Duplicate Account suspected: "Globex" vs "Globex Corp"',
    actionDetails: 'Two Account records share the same VAT number (DE811234567) with slightly different names: Globex (acc-117) and Globex Corp (acc-204). Likely duplicates, with 3 contracts and 14 invoices spread across both.',
    priority: 'High',
    status: 'In Progress',
    dueDate: '2026-05-25',
    createdAt: '2026-05-11T13:15:00Z',
    modifiedAt: '2026-05-14T08:55:00Z',
  },
  {
    id: 'ca-008',
    actionSummarizedTitle: 'Timesheet TS-0421 submitted with 0 entries',
    actionDetails: 'Consultant Andrei Popescu submitted timesheet TS-0421 for week 19/2026 with 0 logged entries. Either an erroneous submission or full leave week — flagged for verification.',
    priority: 'Low',
    status: 'Cancelled',
    closingComments: 'Confirmed with consultant — full week of approved annual leave already on record. Timesheet legitimately empty. No action needed.',
    dueDate: '2026-05-12',
    createdAt: '2026-05-09T09:00:00Z',
    modifiedAt: '2026-05-10T11:25:00Z',
  },
  {
    id: 'ca-009',
    actionSummarizedTitle: 'Opportunity OPP-073 has no profiles sent for 21 days',
    actionDetails: 'Opportunity OPP-073 (Account: Stark Industries, raised 2026-04-23) is in Discussing stage with 0 candidate profiles sent. Average win rate drops below 5% when no profiles are sent within 14 days.',
    priority: 'Medium',
    status: 'New',
    dueDate: '2026-05-21',
    createdAt: '2026-05-14T07:30:00Z',
    modifiedAt: '2026-05-14T07:30:00Z',
  },
  {
    id: 'ca-010',
    actionSummarizedTitle: 'Dividend DIV-014 missing AGA document',
    actionDetails: 'Dividend payment DIV-014 (CSP-RO, €45,000, paid 2026-04-18) has no documentFile attached. Required for compliance and audit trail.',
    priority: 'High',
    status: 'New',
    dueDate: '2026-05-17',
    createdAt: '2026-05-13T16:00:00Z',
    modifiedAt: '2026-05-13T16:00:00Z',
  },
  {
    id: 'ca-011',
    actionSummarizedTitle: 'Contract CT-091 buy/sell currencies differ — FX not pinned',
    actionDetails: 'Contract CT-091 has sellCurrency=GBP and buyCurrency=EUR with no exchange rate snapshot recorded for the active month. Profit forecast may be inaccurate.',
    priority: 'Low',
    status: 'Closed',
    closingComments: 'FX rate pinned manually for May 2026 (GBP→EUR 1.1732). Will revisit when monthly rate is loaded automatically.',
    dueDate: '2026-05-14',
    createdAt: '2026-05-07T08:45:00Z',
    modifiedAt: '2026-05-11T10:30:00Z',
  },
];


// ===== BUSINESS ENTITIES =====
export const entities: BusinessEntity[] = [
  {
    id: 'ent-1', name: 'CLOUD SOLUTIONS PARTNERS S.R.L.', shortName: 'CSP-RO',
    country: 'Romania', baseCurrencyCode: 'EUR', vatNumber: 'RO42485424',
    registrationNumber: 'J23/2345/2022', address: 'Str. Viorelelor, nr. 6, Periș, Ilfov, Romania',
    phone: '+40 724 585 060',
    email: 'marius.oprea@cloudsolutionspartners.ro',
    bankName: 'Banca Transilvania', iban: 'RO44BTRLRONCRT0668754501',
    swift: 'BTRLRO22',
    invoicePrefix: 'CSP', invoiceFooter: 'Payment due within terms. VAT registered in Romania.',
    accountantEmail: 'accountant.ro@cloudsolutionspartners.ro',
  },
  {
    id: 'ent-2', name: 'CLOUD SOLUTIONS PARTNERS EOOD', shortName: 'CSP-BG',
    country: 'Bulgaria', baseCurrencyCode: 'EUR', vatNumber: 'BG207996481',
    registrationNumber: 'BG-2021-5678', address: 'Alexanderovski Boulevard, No. 97, Floor 5, Apartment 28, Ruse, Ruse, 7071, Bulgaria',
    phone: '+359 888 123 456',
    email: 'accounts.svc@cloudsolutionspartners.ro',
    bankName: 'Revolut', iban: 'LT38 3250 0037 2564 8717',
    swift: 'REVOLT21', intermediaryBic: 'CHASGB2L',
    ukBankName: 'Revolut UK', ukAccountNumber: '12345678', ukSortCode: '04-00-75',
    ukIban: 'GB29 REVO 0099 7012 3456 78', ukSwift: 'REVOGB21', ukIntermediaryBic: 'CHASGB2L',
    invoicePrefix: 'CSP-BG-', invoiceFooter: 'Payment due within terms. VAT registered in Bulgaria.',
    accountantEmail: 'accountant.bg@cloudsolutionspartners.ro',
  },
  {
    id: 'ent-3', name: 'CLOUD SOLUTIONS PARTNERS LLC', shortName: 'CSP-US',
    country: 'US', baseCurrencyCode: 'USD', vatNumber: 'N/A',
    registrationNumber: 'US-EIN-12-3456789', address: '100 Main St, New York, NY 10001',
    phone: '+1 212 555 0100',
    email: 'expenses@cloudsolutionspartners.ro',
    bankName: 'JPMorgan Chase', iban: 'N/A',
    swift: 'CHASUS33',
    usAccountNumber: '123456789012', usAchRoutingNumber: '021000021', usWireRoutingNumber: '021000021',
    invoicePrefix: 'CSP-US-', invoiceFooter: 'Payment due within terms.',
    accountantEmail: 'accountant.us@cloudsolutionspartners.ro',
  },
];

// ===== ACCOUNTS =====
export const accounts: Account[] = [
  { id: 'acc-1', accountNumber: 'CSP-000001', name: 'TechCorp International', accountType: 'Direct Customer', entityId: 'ent-2', country: 'Germany', vatNumber: 'DE123456789', registrationNumber: 'HRB 98765 B', paymentTerms: '30 Days', status: 'Active', activeContracts: 3, email: 'finance@techcorp.de', phone: '+49 30 1234 5678', website: 'https://www.techcorp.de', address: 'Friedrichstraße 123, 10117 Berlin, Germany', invoicingEmail: 'accounts.svc@cloudsolutionspartners.ro', invoiceComments: 'Please reference PO number on remittance advice. Payment in EUR only.' },
  { id: 'acc-2', accountNumber: 'CSP-000002', name: 'Nordic Staffing AB', accountType: 'Recruiter Agency', entityId: 'ent-2', country: 'Sweden', vatNumber: 'SE556677889901', registrationNumber: '556677-8899', paymentTerms: '45 Days', status: 'Active', activeContracts: 2, email: 'contact@nordicstaffing.se', phone: '+46 8 555 0142', website: 'https://www.nordicstaffing.se', address: 'Kungsgatan 48, 111 35 Stockholm, Sweden', invoicingEmail: 'accounts.svc@cloudsolutionspartners.ro', invoiceComments: 'Invoice in GBP via UK bank. Net 45 from invoice date.' },
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
  { id: 'acc-16', accountNumber: 'CSP-000016', name: 'Manpower Romania SRL', accountType: 'Recruiter Client', entityId: 'ent-1', country: 'Romania', vatNumber: 'RO15327494', paymentTerms: '30 Days', status: 'Active', activeContracts: 1, email: 'finance@manpower.ro', address: 'Bld IULIU MANIU, nr. 6Q, Sector 6, Bucharest', invoicingEmail: 'invoices@manpower.ro' },
  { id: 'acc-17', accountNumber: 'CSP-000017', name: 'Sofia Digital Services AD', accountType: 'Direct Customer', entityId: 'ent-2', country: 'Bulgaria', vatNumber: 'BG204567890', paymentTerms: '30 Days', status: 'Active', activeContracts: 2, email: 'ap@sofiadigital.bg', address: 'ul. Vitosha 89, Sofia 1000, Bulgaria', invoicingEmail: 'accounts.svc@cloudsolutionspartners.ro', parentAccountId: 'acc-15' },
  { id: 'acc-18', accountNumber: 'CSP-000018', name: 'TechCorp Berlin GmbH', accountType: 'Direct Customer', entityId: 'ent-2', country: 'Germany', vatNumber: 'DE987654321', paymentTerms: '30 Days', status: 'Active', activeContracts: 0, email: 'berlin@techcorp.de', parentAccountId: 'acc-1' },
  { id: 'acc-19', accountNumber: 'CSP-000019', name: 'TechCorp Munich GmbH', accountType: 'Direct Customer', entityId: 'ent-2', country: 'Germany', vatNumber: 'DE987654322', paymentTerms: '30 Days', status: 'Active', activeContracts: 0, email: 'munich@techcorp.de', parentAccountId: 'acc-1' },
];

// ===== CONTACTS =====
export const contacts: Contact[] = [
  { id: 'con-1', firstName: 'Ion', lastName: 'Popescu', email: 'ion@popescu.ro', phone: '+40721000001', accountId: 'acc-6', contactType: 'Consultant', nationality: 'Romanian', country: 'Romania', skillset: ['React', 'TypeScript', 'Node.js'], jobRole: 'Senior Full-Stack Developer', available: false, isInterviewer: true, cvs: [
    { id: 'cv-con1-1', fileName: 'Ion-Popescu-CV.pdf', label: 'Full-stack focus', uploadedAt: '2025-09-12', isPrimary: true },
    { id: 'cv-con1-2', fileName: 'Ion-Popescu-Backend.pdf', label: 'Backend focus', uploadedAt: '2025-10-01' },
  ] },
  { id: 'con-2', firstName: 'Maria', lastName: 'Ivanova', email: 'maria@ivanova.bg', phone: '+359888000002', accountId: 'acc-7', contactType: 'Consultant', nationality: 'Bulgarian', country: 'Bulgaria', skillset: ['Java', 'Spring Boot', 'AWS'], jobRole: 'Backend Developer', available: false, cvs: [
    { id: 'cv-con2-1', fileName: 'Maria-Ivanova-CV.pdf', label: 'Default', uploadedAt: '2025-08-21', isPrimary: true },
  ] },
  { id: 'con-3', firstName: 'John', lastName: 'Smith', email: 'john@smithdev.com', phone: '+12125550003', accountId: 'acc-8', contactType: 'Consultant', nationality: 'American', country: 'US', skillset: ['Python', 'ML', 'Data Engineering'], jobRole: 'Data Engineer', available: false },
  { id: 'con-4', firstName: 'Elena', lastName: 'Dragomir', email: 'elena.d@email.com', phone: '+40721000004', contactType: 'Consultant', nationality: 'Romanian', country: 'Romania', skillset: ['Azure', 'DevOps', 'Terraform'], jobRole: 'Cloud Architect', available: true, isInterviewer: true, cvs: [
    { id: 'cv-con4-1', fileName: 'Elena-Dragomir-Cloud-CV.pdf', label: 'Cloud architect', uploadedAt: '2025-07-04', isPrimary: true },
    { id: 'cv-con4-2', fileName: 'Elena-Dragomir-DevOps-CV.pdf', label: 'DevOps focus', uploadedAt: '2025-09-30' },
    { id: 'cv-con4-3', fileName: 'Elena-Dragomir-EN.pdf', label: 'EN translated', uploadedAt: '2025-11-15' },
  ] },
  { id: 'con-5', firstName: 'Georgi', lastName: 'Petrov', email: 'georgi.p@email.com', phone: '+359888000005', contactType: 'Consultant', nationality: 'Bulgarian', country: 'Bulgaria', skillset: ['Angular', 'C#', '.NET'], jobRole: 'Full-Stack Developer', available: true },
  { id: 'con-6', firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.j@techcorp.de', phone: '+49170000006', company: 'TechCorp International', accountId: 'acc-1', contactType: 'Client Contact', country: 'Germany' },
  { id: 'con-7', firstName: 'Michael', lastName: 'Brown', email: 'michael.b@dataflow.com', phone: '+12125550007', company: 'DataFlow Systems', accountId: 'acc-4', contactType: 'Client Contact', country: 'US' },
  { id: 'con-8', firstName: 'Ana', lastName: 'Georgescu', email: 'ana.g@email.com', phone: '+40721000008', contactType: 'Consultant', nationality: 'Romanian', country: 'Romania', skillset: ['React', 'Vue.js', 'UX Design'], jobRole: 'Frontend Developer', available: false, isInterviewer: true, cvs: [
    { id: 'cv-con8-1', fileName: 'Ana-Georgescu-Frontend-CV.pdf', label: 'Frontend', uploadedAt: '2025-06-18', isPrimary: true },
    { id: 'cv-con8-2', fileName: 'Ana-Georgescu-UX-CV.pdf', label: 'UX-focused', uploadedAt: '2025-10-12' },
  ] },
  { id: 'con-9', firstName: 'Dimitar', lastName: 'Kolev', email: 'dimitar.k@email.com', phone: '+359888000009', contactType: 'Consultant', nationality: 'Bulgarian', country: 'Bulgaria', skillset: ['Kubernetes', 'Docker', 'Go'], jobRole: 'Platform Engineer', available: true },
  { id: 'con-10', firstName: 'Robert', lastName: 'Davis', email: 'robert.d@globaltech.com', phone: '+12125550010', company: 'GlobalTech Inc', accountId: 'acc-11', contactType: 'Finance Contact', country: 'US' },
  { id: 'con-11', firstName: 'Lars', lastName: 'Andersson', email: 'lars.a@nordicstaffing.se', phone: '+46855501142', company: 'Nordic Staffing AB', accountId: 'acc-2', contactType: 'Client Contact', country: 'Sweden' },
  { id: 'con-12', firstName: 'Astrid', lastName: 'Lindqvist', email: 'astrid.l@nordicstaffing.se', phone: '+46855501143', company: 'Nordic Staffing AB', accountId: 'acc-2', contactType: 'Finance Contact', country: 'Sweden' },
  { id: 'con-13', firstName: 'Oliver', lastName: 'Hughes', email: 'oliver.h@financehub.co.uk', phone: '+442075550199', company: 'FinanceHub Ltd', accountId: 'acc-3', contactType: 'Finance Contact', country: 'UK' },
  { id: 'con-14', firstName: 'Klaus', lastName: 'Becker', email: 'klaus.b@techcorp.de', phone: '+4930123456789', company: 'TechCorp International', accountId: 'acc-1', contactType: 'Finance Contact', country: 'Germany' },
];

// ===== CONTRACTS =====
export const contracts: Contract[] = [
  { id: 'ctr-1', contractNumber: 'CTR-2024-001', name: 'TechCorp - Ion Popescu - React Dev', contractType: 'Standard Contracting', billingType: 'Time & Material', entityId: 'ent-2', parentAccountId: 'acc-1', contactId: 'con-1', sellRate: 500, sellHourlyRate: 62.5, sellCurrency: 'EUR', buyRate: 350, buyHourlyRate: 43.75, buyCurrency: 'EUR', unitOfMeasure: 'Day', payTerms: '30 Days', margin: 150, marginPercent: 30, grossValue: 132000, startDate: '2024-01-15', endDate: '2026-12-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  { id: 'ctr-2', contractNumber: 'CTR-2024-002', name: 'TechCorp - Ana Georgescu - Frontend', contractType: 'Standard Contracting', billingType: 'Time & Material', entityId: 'ent-2', parentAccountId: 'acc-1', contactId: 'con-8', sellRate: 450, sellHourlyRate: 56.25, sellCurrency: 'EUR', buyRate: 320, buyHourlyRate: 40, buyCurrency: 'EUR', unitOfMeasure: 'Day', payTerms: '30 Days', margin: 130, marginPercent: 28.9, grossValue: 118800, startDate: '2024-03-01', endDate: '2026-06-30', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  { id: 'ctr-3', contractNumber: 'CTR-2024-003', name: 'Nordic - Ion Popescu - Node.js', contractType: 'Standard Contracting', billingType: 'Time & Material', entityId: 'ent-2', parentAccountId: 'acc-2', childAccountId: 'acc-6', contactId: 'con-1', sellRate: 480, sellHourlyRate: 60, sellCurrency: 'EUR', buyRate: 350, buyHourlyRate: 43.75, buyCurrency: 'EUR', unitOfMeasure: 'Day', payTerms: '45 Days', margin: 130, marginPercent: 27.1, grossValue: 126720, startDate: '2024-06-01', endDate: '2025-05-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  { id: 'ctr-4', contractNumber: 'CTR-2024-004', name: 'FinanceHub - Maria Ivanova - Java', contractType: 'Standard Contracting', billingType: 'Time & Material', entityId: 'ent-2', parentAccountId: 'acc-3', contactId: 'con-2', sellRate: 450, sellHourlyRate: 56.25, sellCurrency: 'GBP', buyRate: 300, buyHourlyRate: 37.5, buyCurrency: 'EUR', unitOfMeasure: 'Day', payTerms: '30 Days', margin: 150, marginPercent: 33.3, grossValue: 118800, startDate: '2024-02-01', endDate: '2026-01-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  { id: 'ctr-5', contractNumber: 'CTR-2024-005', name: 'DataFlow - John Smith - Data Eng', contractType: 'Standard Contracting', billingType: 'Time & Material', entityId: 'ent-3', parentAccountId: 'acc-4', contactId: 'con-3', sellRate: 760, sellHourlyRate: 95, sellCurrency: 'USD', buyRate: 600, buyHourlyRate: 75, buyCurrency: 'USD', unitOfMeasure: 'Hour', payTerms: '30 Days', margin: 20, marginPercent: 21.1, grossValue: 200640, startDate: '2024-04-01', endDate: '2026-03-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  { id: 'ctr-6', contractNumber: 'CTR-2024-006', name: 'BalkanTech - Dimitar Kolev - Platform', contractType: 'Standard Contracting', billingType: 'Time & Material', entityId: 'ent-2', parentAccountId: 'acc-15', contactId: 'con-9', sellRate: 500, sellHourlyRate: 62.5, sellCurrency: 'EUR', buyRate: 350, buyHourlyRate: 43.75, buyCurrency: 'EUR', unitOfMeasure: 'Day', payTerms: '30 Days', margin: 150, marginPercent: 30, grossValue: 132000, startDate: '2025-01-01', endDate: '2025-12-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  { id: 'ctr-7', contractNumber: 'CTR-2024-007', name: 'Alpine - Elena Dragomir - Cloud', contractType: 'Fixed Price', billingType: 'Fixed Price', entityId: 'ent-1', parentAccountId: 'acc-5', contactId: 'con-4', sellRate: 9000, sellCurrency: 'EUR', buyRate: 8800, buyCurrency: 'EUR', unitOfMeasure: 'Month', payTerms: '30 Days', margin: 200, marginPercent: 2.2, grossValue: 54000, monthlySalary: 8800, monthlySalaryCurrency: 'EUR', startDate: '2025-02-01', endDate: '2025-07-31', hasTimesheet: false, hasMilestones: true, status: 'Draft' },
  { id: 'ctr-8', contractNumber: 'CTR-2023-001', name: 'GlobalTech - Georgi Petrov - .NET', contractType: 'Standard Contracting', billingType: 'Time & Material', entityId: 'ent-3', parentAccountId: 'acc-11', childAccountId: 'acc-7', contactId: 'con-5', sellRate: 550, sellHourlyRate: 68.75, sellCurrency: 'USD', buyRate: 280, buyHourlyRate: 35, buyCurrency: 'EUR', unitOfMeasure: 'Day', payTerms: '30 Days', margin: 270, marginPercent: 49.1, grossValue: 145200, startDate: '2023-09-01', endDate: '2024-08-31', actualEndDate: '2024-08-31', hasTimesheet: true, hasMilestones: false, status: 'Completed' },
  // SC + Fixed Price
  { id: 'ctr-9', contractNumber: 'CTR-2025-009', name: 'TechCorp - Ion Popescu - Fixed Deliverable', contractType: 'Standard Contracting', billingType: 'Fixed Price', entityId: 'ent-2', parentAccountId: 'acc-1', contactId: 'con-1', sellRate: 12000, sellCurrency: 'EUR', buyRate: 9500, buyCurrency: 'EUR', unitOfMeasure: 'Fixed', payTerms: '30 Days', margin: 2500, marginPercent: 20.8, grossValue: 12000, startDate: '2025-03-01', endDate: '2025-08-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  // SC + Monthly Salary
  { id: 'ctr-10', contractNumber: 'CTR-2025-010', name: 'Nordic - Maria Ivanova - Managed Service', contractType: 'Standard Contracting', billingType: 'Monthly Salary', entityId: 'ent-2', parentAccountId: 'acc-2', contactId: 'con-2', sellRate: 6000, sellCurrency: 'EUR', buyRate: 4500, buyCurrency: 'EUR', unitOfMeasure: 'Month', payTerms: '30 Days', margin: 1500, marginPercent: 25, grossValue: 72000, monthlySalary: 4500, monthlySalaryCurrency: 'EUR', startDate: '2025-01-01', endDate: '2025-12-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  // SC + Standard Contracting
  { id: 'ctr-11', contractNumber: 'CTR-2025-011', name: 'FinanceHub - Ana Georgescu - Standard', contractType: 'Standard Contracting', billingType: 'Standard Contracting', entityId: 'ent-2', parentAccountId: 'acc-3', contactId: 'con-8', sellRate: 480, sellHourlyRate: 60, sellCurrency: 'GBP', buyRate: 340, buyHourlyRate: 42.5, buyCurrency: 'EUR', unitOfMeasure: 'Day', payTerms: '30 Days', margin: 140, marginPercent: 29.2, grossValue: 126720, startDate: '2025-02-01', endDate: '2025-12-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  // PE + T&M
  { id: 'ctr-12', contractNumber: 'CTR-2025-012', name: 'DataFlow - Elena Dragomir - Perm T&M', contractType: 'Permanent Employee', billingType: 'Time & Material', entityId: 'ent-3', parentAccountId: 'acc-4', contactId: 'con-4', sellRate: 700, sellHourlyRate: 87.5, sellCurrency: 'USD', buyRate: 520, buyHourlyRate: 65, buyCurrency: 'USD', unitOfMeasure: 'Hour', payTerms: '30 Days', margin: 180, marginPercent: 25.7, grossValue: 184800, startDate: '2025-01-01', endDate: '2025-12-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  // PE + Fixed Price
  { id: 'ctr-13', contractNumber: 'CTR-2025-013', name: 'Alpine - Georgi Petrov - Perm Fixed', contractType: 'Permanent Employee', billingType: 'Fixed Price', entityId: 'ent-1', parentAccountId: 'acc-5', contactId: 'con-5', sellRate: 15000, sellCurrency: 'EUR', buyRate: 11000, buyCurrency: 'EUR', unitOfMeasure: 'Fixed', payTerms: '30 Days', margin: 4000, marginPercent: 26.7, grossValue: 15000, startDate: '2025-04-01', endDate: '2025-09-30', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  // PE + Monthly Salary
  { id: 'ctr-14', contractNumber: 'CTR-2025-014', name: 'BalkanTech - John Smith - Perm Salary', contractType: 'Permanent Employee', billingType: 'Monthly Salary', entityId: 'ent-2', parentAccountId: 'acc-15', contactId: 'con-3', sellRate: 7500, sellCurrency: 'EUR', buyRate: 5800, buyCurrency: 'EUR', unitOfMeasure: 'Month', payTerms: '30 Days', margin: 1700, marginPercent: 22.7, grossValue: 90000, monthlySalary: 5800, monthlySalaryCurrency: 'EUR', startDate: '2025-01-01', endDate: '2025-12-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  // PE + Standard Contracting
  { id: 'ctr-15', contractNumber: 'CTR-2025-015', name: 'TechCorp - Dimitar Kolev - Perm Std', contractType: 'Permanent Employee', billingType: 'Standard Contracting', entityId: 'ent-2', parentAccountId: 'acc-1', contactId: 'con-9', sellRate: 520, sellHourlyRate: 65, sellCurrency: 'EUR', buyRate: 380, buyHourlyRate: 47.5, buyCurrency: 'EUR', unitOfMeasure: 'Day', payTerms: '30 Days', margin: 140, marginPercent: 26.9, grossValue: 137280, startDate: '2025-03-01', endDate: '2025-12-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  // FP + T&M
  { id: 'ctr-16', contractNumber: 'CTR-2025-016', name: 'GlobalTech - Ion Popescu - FP T&M', contractType: 'Fixed Price', billingType: 'Time & Material', entityId: 'ent-3', parentAccountId: 'acc-11', contactId: 'con-1', sellRate: 600, sellHourlyRate: 75, sellCurrency: 'USD', buyRate: 450, buyHourlyRate: 56.25, buyCurrency: 'USD', unitOfMeasure: 'Hour', payTerms: '30 Days', margin: 150, marginPercent: 25, grossValue: 158400, startDate: '2025-02-01', endDate: '2025-12-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  // FP + Monthly Salary
  { id: 'ctr-17', contractNumber: 'CTR-2025-017', name: 'Nordic - Elena Dragomir - FP Monthly', contractType: 'Fixed Price', billingType: 'Monthly Salary', entityId: 'ent-2', parentAccountId: 'acc-2', contactId: 'con-4', sellRate: 8500, sellCurrency: 'EUR', buyRate: 6500, buyCurrency: 'EUR', unitOfMeasure: 'Month', payTerms: '45 Days', margin: 2000, marginPercent: 23.5, grossValue: 102000, monthlySalary: 6500, monthlySalaryCurrency: 'EUR', startDate: '2025-01-01', endDate: '2025-12-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  // FP + Standard Contracting
  { id: 'ctr-18', contractNumber: 'CTR-2025-018', name: 'FinanceHub - Georgi Petrov - FP Std', contractType: 'Fixed Price', billingType: 'Standard Contracting', entityId: 'ent-2', parentAccountId: 'acc-3', contactId: 'con-5', sellRate: 550, sellHourlyRate: 68.75, sellCurrency: 'GBP', buyRate: 400, buyHourlyRate: 50, buyCurrency: 'EUR', unitOfMeasure: 'Day', payTerms: '30 Days', margin: 150, marginPercent: 27.3, grossValue: 145200, startDate: '2025-03-01', endDate: '2025-12-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  { id: 'ctr-19', contractNumber: 'CTR-2025-019', name: 'SofiaDigital - Maria Ivanova - Backend', contractType: 'Standard Contracting', billingType: 'Time & Material', entityId: 'ent-2', parentAccountId: 'acc-17', contactId: 'con-2', sellRate: 480, sellHourlyRate: 60, sellCurrency: 'EUR', buyRate: 300, buyHourlyRate: 37.5, buyCurrency: 'EUR', unitOfMeasure: 'Day', payTerms: '30 Days', margin: 180, marginPercent: 37.5, grossValue: 126720, startDate: '2025-01-01', endDate: '2025-12-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
  { id: 'ctr-20', contractNumber: 'CTR-2025-020', name: 'SofiaDigital - Dimitar Kolev - DevOps', contractType: 'Standard Contracting', billingType: 'Time & Material', entityId: 'ent-2', parentAccountId: 'acc-17', contactId: 'con-9', sellRate: 520, sellHourlyRate: 65, sellCurrency: 'EUR', buyRate: 350, buyHourlyRate: 43.75, buyCurrency: 'EUR', unitOfMeasure: 'Day', payTerms: '30 Days', margin: 170, marginPercent: 32.7, grossValue: 137280, startDate: '2025-03-01', endDate: '2025-12-31', hasTimesheet: true, hasMilestones: false, status: 'Active' },
];

// ===== INVOICES =====
const makeLines = (invoiceId: string, contactId: string, desc: string, qty: number, rate: number, currency: 'EUR' | 'GBP' | 'USD' | 'RON', uom: 'Day' | 'Hour' | 'Month' | 'Fixed', contractId?: string): InvoiceLine[] => [
  { id: `${invoiceId}-l1`, invoiceId, name: desc.split(' - ')[0] || desc, contactId, description: desc, quantity: qty, rate, currencyCode: currency, amount: qty * rate, unitOfMeasure: uom, contractId },
];

export const invoices: Invoice[] = [
  { id: 'inv-1', invoiceNumber: 'CSP-BG-2026-1001', entityId: 'ent-2', accountId: 'acc-1', contractId: 'ctr-1', currencyCode: 'EUR', invoiceDate: '2026-01-05', dueDate: '2026-02-04', subtotal: 10000, vatRate: 19, vatAmount: 1900, total: 11900, ronConversionRate: 5.05, ronTotal: 50500.0, comments: 'EUR billed by CSP-BG; RON equivalent shown for client reference at the official BNR rate on the invoice date.', status: 'Paid', paymentReceivedDate: '2026-01-28', periodMonth: 12, periodYear: 2025, lines: makeLines('inv-1', 'con-1', 'React Development - Dec 2025', 20, 500, 'EUR', 'Day', 'ctr-1') },
  { id: 'inv-2', invoiceNumber: 'CSP-BG-2026-1002', entityId: 'ent-2', accountId: 'acc-1', contractId: 'ctr-2', currencyCode: 'EUR', invoiceDate: '2026-01-05', dueDate: '2026-02-04', subtotal: 9000, vatRate: 19, vatAmount: 1710, total: 10710, ronConversionRate: 5.05, ronTotal: 45450.0, comments: 'EUR billed by CSP-BG; RON equivalent shown for client reference at the official BNR rate on the invoice date.', status: 'Paid', paymentReceivedDate: '2026-02-01', periodMonth: 12, periodYear: 2025, lines: makeLines('inv-2', 'con-8', 'Frontend Development - Dec 2025', 20, 450, 'EUR', 'Day', 'ctr-2') },
  { id: 'inv-3', invoiceNumber: 'CSP-BG-2026-2003', entityId: 'ent-2', accountId: 'acc-2', contractId: 'ctr-3', currencyCode: 'GBP', invoiceDate: '2026-01-10', dueDate: '2026-02-24', subtotal: 9600, vatRate: 0, vatAmount: 0, total: 9600, comments: 'Invoice in GBP. Please remit via UK bank account (Revolut UK). Net 45 from invoice date.', status: 'Paid', paymentReceivedDate: '2026-02-20', periodMonth: 12, periodYear: 2025, lines: makeLines('inv-3', 'con-1', 'Node.js Development - Dec 2025', 20, 480, 'GBP', 'Day', 'ctr-3') },
  { id: 'inv-4', invoiceNumber: 'CSP-BG-2026-001', entityId: 'ent-2', accountId: 'acc-3', contractId: 'ctr-4', currencyCode: 'GBP', invoiceDate: '2026-01-05', dueDate: '2026-02-04', subtotal: 9000, vatRate: 20, vatAmount: 1800, total: 10800, status: 'Paid', paymentReceivedDate: '2026-01-30', periodMonth: 12, periodYear: 2025, lines: makeLines('inv-4', 'con-2', 'Java Development - Dec 2025', 20, 450, 'GBP', 'Day', 'ctr-4') },
  { id: 'inv-5', invoiceNumber: 'CSP-US-2026-001', entityId: 'ent-3', accountId: 'acc-4', contractId: 'ctr-5', currencyCode: 'USD', invoiceDate: '2026-01-05', dueDate: '2026-02-04', subtotal: 15200, vatRate: 0, vatAmount: 0, total: 15200, status: 'Paid', paymentReceivedDate: '2026-01-29', periodMonth: 12, periodYear: 2025, lines: makeLines('inv-5', 'con-3', 'Data Engineering - Dec 2025', 160, 95, 'USD', 'Hour', 'ctr-5') },
  { id: 'inv-6', invoiceNumber: 'CSP-BG-2026-1004', entityId: 'ent-2', accountId: 'acc-1', contractId: 'ctr-1', currencyCode: 'EUR', invoiceDate: '2026-02-05', dueDate: '2026-03-07', subtotal: 11000, vatRate: 19, vatAmount: 2090, total: 13090, ronConversionRate: 5.05, ronTotal: 55550.0, comments: 'EUR billed by CSP-BG; RON equivalent shown for client reference at the official BNR rate on the invoice date.', status: 'Paid', paymentReceivedDate: '2026-03-05', periodMonth: 1, periodYear: 2026, lines: makeLines('inv-6', 'con-1', 'React Development - Jan 2026', 22, 500, 'EUR', 'Day', 'ctr-1') },
  { id: 'inv-7', invoiceNumber: 'CSP-BG-2026-1005', entityId: 'ent-2', accountId: 'acc-1', contractId: 'ctr-2', currencyCode: 'EUR', invoiceDate: '2026-02-05', dueDate: '2026-03-07', subtotal: 9900, vatRate: 19, vatAmount: 1881, total: 11781, ronConversionRate: 5.05, ronTotal: 49995.0, comments: 'EUR billed by CSP-BG; RON equivalent shown for client reference at the official BNR rate on the invoice date.', status: 'Paid', paymentReceivedDate: '2026-03-03', periodMonth: 1, periodYear: 2026, lines: makeLines('inv-7', 'con-8', 'Frontend Development - Jan 2026', 22, 450, 'EUR', 'Day', 'ctr-2') },
  { id: 'inv-8', invoiceNumber: 'CSP-BG-2026-002', entityId: 'ent-2', accountId: 'acc-3', contractId: 'ctr-4', currencyCode: 'GBP', invoiceDate: '2026-02-05', dueDate: '2026-03-07', subtotal: 9900, vatRate: 20, vatAmount: 1980, total: 11880, status: 'Sent', periodMonth: 1, periodYear: 2026, lines: makeLines('inv-8', 'con-2', 'Java Development - Jan 2026', 22, 450, 'GBP', 'Day', 'ctr-4') },
  { id: 'inv-9', invoiceNumber: 'CSP-US-2026-002', entityId: 'ent-3', accountId: 'acc-4', contractId: 'ctr-5', currencyCode: 'USD', invoiceDate: '2026-02-05', dueDate: '2026-03-07', subtotal: 16720, vatRate: 0, vatAmount: 0, total: 16720, status: 'Sent', periodMonth: 1, periodYear: 2026, lines: makeLines('inv-9', 'con-3', 'Data Engineering - Jan 2026', 176, 95, 'USD', 'Hour', 'ctr-5') },
  { id: 'inv-10', invoiceNumber: 'CSP-BG-2026-2006', entityId: 'ent-2', accountId: 'acc-2', contractId: 'ctr-3', currencyCode: 'GBP', invoiceDate: '2026-02-10', dueDate: '2026-03-27', subtotal: 10560, vatRate: 0, vatAmount: 0, total: 10560, comments: 'Invoice in GBP. Please remit via UK bank account (Revolut UK). Net 45 from invoice date.', status: 'Sent', periodMonth: 1, periodYear: 2026, lines: makeLines('inv-10', 'con-1', 'Node.js Development - Jan 2026', 22, 480, 'GBP', 'Day', 'ctr-3') },
  { id: 'inv-11', invoiceNumber: 'CSP-BG-2026-003', entityId: 'ent-2', accountId: 'acc-15', contractId: 'ctr-6', currencyCode: 'EUR', invoiceDate: '2026-02-05', dueDate: '2026-03-07', subtotal: 11000, vatRate: 20, vatAmount: 2200, total: 13200, status: 'Sent', periodMonth: 1, periodYear: 2026, lines: makeLines('inv-11', 'con-9', 'Platform Engineering - Jan 2026', 22, 500, 'EUR', 'Day', 'ctr-6') },
  { id: 'inv-12', invoiceNumber: 'CSP-BG-2026-1007', entityId: 'ent-2', accountId: 'acc-1', contractId: 'ctr-1', currencyCode: 'EUR', invoiceDate: '2026-03-05', dueDate: '2026-04-04', subtotal: 10500, vatRate: 19, vatAmount: 1995, total: 12495, ronConversionRate: 5.05, ronTotal: 53025.0, comments: 'EUR billed by CSP-BG; RON equivalent shown for client reference at the official BNR rate on the invoice date.', status: 'Sent', periodMonth: 2, periodYear: 2026, lines: makeLines('inv-12', 'con-1', 'React Development - Feb 2026', 21, 500, 'EUR', 'Day', 'ctr-1') },
  { id: 'inv-13', invoiceNumber: 'CSP-BG-2026-1008', entityId: 'ent-2', accountId: 'acc-1', contractId: 'ctr-2', currencyCode: 'EUR', invoiceDate: '2026-03-05', dueDate: '2026-04-04', subtotal: 9450, vatRate: 19, vatAmount: 1795.5, total: 11245.5, ronConversionRate: 5.05, ronTotal: 47722.5, comments: 'EUR billed by CSP-BG; RON equivalent shown for client reference at the official BNR rate on the invoice date.', status: 'Draft', periodMonth: 2, periodYear: 2026, lines: makeLines('inv-13', 'con-8', 'Frontend Development - Feb 2026', 21, 450, 'EUR', 'Day', 'ctr-2') },
  { id: 'inv-14', invoiceNumber: 'CSP-US-2026-003', entityId: 'ent-3', accountId: 'acc-4', contractId: 'ctr-5', currencyCode: 'USD', invoiceDate: '2026-03-05', dueDate: '2026-04-04', subtotal: 15200, vatRate: 0, vatAmount: 0, total: 15200, status: 'Draft', periodMonth: 2, periodYear: 2026, lines: makeLines('inv-14', 'con-3', 'Data Engineering - Feb 2026', 160, 95, 'USD', 'Hour', 'ctr-5') },
  { id: 'inv-15', invoiceNumber: 'CSP-BG-2026-2009', entityId: 'ent-2', accountId: 'acc-2', contractId: 'ctr-3', currencyCode: 'GBP', invoiceDate: '2026-03-10', dueDate: '2026-04-24', subtotal: 10080, vatRate: 0, vatAmount: 0, total: 10080, comments: 'Invoice in GBP. Please remit via UK bank account (Revolut UK). Net 45 from invoice date.', status: 'Overdue', periodMonth: 2, periodYear: 2026, lines: makeLines('inv-15', 'con-1', 'Node.js Development - Feb 2026', 21, 480, 'GBP', 'Day', 'ctr-3') },
  { id: 'inv-16', invoiceNumber: 'CSP-BG-2026-004', entityId: 'ent-2', accountId: 'acc-3', contractId: 'ctr-4', currencyCode: 'GBP', invoiceDate: '2026-03-05', dueDate: '2026-04-04', subtotal: 9450, vatRate: 20, vatAmount: 1890, total: 11340, status: 'Overdue', periodMonth: 2, periodYear: 2026, lines: makeLines('inv-16', 'con-2', 'Java Development - Feb 2026', 21, 450, 'GBP', 'Day', 'ctr-4') },
  { id: 'inv-17', invoiceNumber: 'CSP-BG-2026-1010', entityId: 'ent-2', accountId: 'acc-1', contractId: 'ctr-1', currencyCode: 'EUR', invoiceDate: '2026-04-03', dueDate: '2026-05-03', subtotal: 11500, vatRate: 19, vatAmount: 2185, total: 13685, ronConversionRate: 5.05, ronTotal: 58075.0, comments: 'EUR billed by CSP-BG; RON equivalent shown for client reference at the official BNR rate on the invoice date.', status: 'Draft', periodMonth: 3, periodYear: 2026, lines: makeLines('inv-17', 'con-1', 'React Development - Mar 2026', 23, 500, 'EUR', 'Day', 'ctr-1') },
  { id: 'inv-18', invoiceNumber: 'CSP-BG-2026-005', entityId: 'ent-2', accountId: 'acc-15', contractId: 'ctr-6', currencyCode: 'EUR', invoiceDate: '2026-03-05', dueDate: '2026-04-04', subtotal: 10500, vatRate: 20, vatAmount: 2100, total: 12600, status: 'Sent', periodMonth: 2, periodYear: 2026, lines: makeLines('inv-18', 'con-9', 'Platform Engineering - Feb 2026', 21, 500, 'EUR', 'Day', 'ctr-6') },
  { id: 'inv-19', invoiceNumber: 'CSP-US-2026-004', entityId: 'ent-3', accountId: 'acc-11', contractId: 'ctr-8', currencyCode: 'USD', invoiceDate: '2024-07-05', dueDate: '2024-08-04', subtotal: 12100, vatRate: 0, vatAmount: 0, total: 12100, status: 'Cancelled', periodMonth: 6, periodYear: 2024, lines: makeLines('inv-19', 'con-5', '.NET Development - Jun 2024', 22, 550, 'USD', 'Day', 'ctr-8') },
  { id: 'inv-20', invoiceNumber: 'CSP-RO-2025-050', entityId: 'ent-1', accountId: 'acc-5', contractId: 'ctr-7', currencyCode: 'EUR', invoiceDate: '2025-11-05', dueDate: '2025-12-05', subtotal: 9000, vatRate: 19, vatAmount: 1710, total: 10710, status: 'Paid', paymentReceivedDate: '2025-11-28', periodMonth: 10, periodYear: 2025, lines: makeLines('inv-20', 'con-4', 'Cloud Architecture - Oct 2025', 1, 9000, 'EUR', 'Month', 'ctr-7') },
  // Bulgaria Draft invoices for Sofia Digital Services - Mar 2026
  { id: 'inv-21', invoiceNumber: 'CSP-BG-2026-006', entityId: 'ent-2', accountId: 'acc-17', contractId: 'ctr-19', currencyCode: 'EUR', invoiceDate: '2026-04-05', dueDate: '2026-05-05', subtotal: 10560, vatRate: 20, vatAmount: 2112, total: 12672, status: 'Draft', periodMonth: 3, periodYear: 2026, lines: makeLines('inv-21', 'con-2', 'Backend Development - Mar 2026', 22, 480, 'EUR', 'Day', 'ctr-19') },
  { id: 'inv-22', invoiceNumber: 'CSP-BG-2026-007', entityId: 'ent-2', accountId: 'acc-17', contractId: 'ctr-20', currencyCode: 'EUR', invoiceDate: '2026-04-05', dueDate: '2026-05-05', subtotal: 11440, vatRate: 20, vatAmount: 2288, total: 13728, status: 'Draft', periodMonth: 3, periodYear: 2026, lines: makeLines('inv-22', 'con-9', 'DevOps Services - Mar 2026', 22, 520, 'EUR', 'Day', 'ctr-20') },
  // Nordic Staffing - Draft GBP invoices
  { id: 'inv-n1', invoiceNumber: 'CSP-BG-2026-2010', entityId: 'ent-2', accountId: 'acc-2', contractId: 'ctr-3', currencyCode: 'GBP', invoiceDate: '2026-04-10', dueDate: '2026-05-25', subtotal: 10560, vatRate: 0, vatAmount: 0, total: 10560, comments: 'Invoice in GBP. Please remit via UK bank account (Revolut UK). Net 45 from invoice date.', status: 'Draft', periodMonth: 3, periodYear: 2026, lines: makeLines('inv-n1', 'con-1', 'Node.js Development - Mar 2026', 22, 480, 'GBP', 'Day', 'ctr-3') },
  { id: 'inv-n2', invoiceNumber: 'CSP-BG-2026-2011', entityId: 'ent-2', accountId: 'acc-2', contractId: 'ctr-17', currencyCode: 'GBP', invoiceDate: '2026-04-10', dueDate: '2026-05-25', subtotal: 7250, vatRate: 0, vatAmount: 0, total: 7250, comments: 'Invoice in GBP. Please remit via UK bank account (Revolut UK). Net 45 from invoice date.', status: 'Draft', periodMonth: 3, periodYear: 2026, lines: makeLines('inv-n2', 'con-4', 'Managed Service - Mar 2026', 1, 7250, 'GBP', 'Month', 'ctr-17') },
  // Bulgaria Draft invoices for BalkanTech - Mar 2026
  { id: 'inv-23', invoiceNumber: 'CSP-BG-2026-008', entityId: 'ent-2', accountId: 'acc-15', contractId: 'ctr-6', currencyCode: 'EUR', invoiceDate: '2026-04-05', dueDate: '2026-05-05', subtotal: 11500, vatRate: 20, vatAmount: 2300, total: 13800, status: 'Draft', periodMonth: 3, periodYear: 2026, lines: makeLines('inv-23', 'con-9', 'Platform Engineering - Mar 2026', 23, 500, 'EUR', 'Day', 'ctr-6') },
  // Bulgaria Draft invoice for FinanceHub (GBP) - Mar 2026
  { id: 'inv-24', invoiceNumber: 'CSP-BG-2026-009', entityId: 'ent-2', accountId: 'acc-3', contractId: 'ctr-4', currencyCode: 'GBP', invoiceDate: '2026-04-05', dueDate: '2026-05-05', subtotal: 9900, vatRate: 20, vatAmount: 1980, total: 11880, status: 'Draft', periodMonth: 3, periodYear: 2026, lines: makeLines('inv-24', 'con-2', 'Java Development - Mar 2026', 22, 450, 'GBP', 'Day', 'ctr-4') },
];

// ===== EXPENSES =====
export const expenses: Expense[] = [
  { id: 'exp-1', reference: 'EXP-000001', entityId: 'ent-1', accountId: 'acc-6', expenseType: 'Contractor Payment', contractId: 'ctr-1', currencyCode: 'EUR', totalAmount: 8330, vatAmount: 1330, netAmount: 7000, dateIssued: '2026-01-10', dueDate: '2026-01-25', paymentDate: '2026-01-20', status: 'Paid', periodMonth: 12, periodYear: 2025 },
  { id: 'exp-2', reference: 'EXP-000002', entityId: 'ent-1', accountId: 'acc-6', expenseType: 'Contractor Payment', contractId: 'ctr-2', currencyCode: 'EUR', totalAmount: 7616, vatAmount: 1216, netAmount: 6400, dateIssued: '2026-01-10', dueDate: '2026-01-25', paymentDate: '2026-01-20', status: 'Paid', periodMonth: 12, periodYear: 2025 },
  { id: 'exp-3', reference: 'EXP-000003', entityId: 'ent-2', accountId: 'acc-7', expenseType: 'Contractor Payment', contractId: 'ctr-3', currencyCode: 'GBP', totalAmount: 7140, vatAmount: 1140, netAmount: 6000, dateIssued: '2026-01-10', dueDate: '2026-01-25', paymentDate: '2026-01-22', status: 'Paid', periodMonth: 12, periodYear: 2025 },
  { id: 'exp-4', reference: 'EXP-000004', entityId: 'ent-3', accountId: 'acc-8', expenseType: 'Contractor Payment', contractId: 'ctr-5', currencyCode: 'USD', totalAmount: 12000, vatAmount: 0, netAmount: 12000, dateIssued: '2026-01-10', dueDate: '2026-01-25', paymentDate: '2026-01-23', status: 'Paid', periodMonth: 12, periodYear: 2025 },
  { id: 'exp-5', reference: 'EXP-000005', entityId: 'ent-1', accountId: 'acc-9', expenseType: 'Software / Subscription', currencyCode: 'USD', totalAmount: 1500, vatAmount: 0, netAmount: 1500, dateIssued: '2026-01-15', dueDate: '2026-02-14', paymentDate: '2026-02-10', status: 'Paid', periodMonth: 1, periodYear: 2026 },
  { id: 'exp-6', reference: 'EXP-000006', entityId: 'ent-1', accountId: 'acc-10', expenseType: 'Tax', currencyCode: 'RON', totalAmount: 15000, vatAmount: 0, netAmount: 15000, dateIssued: '2026-01-25', dueDate: '2026-02-25', paymentDate: '2026-02-20', status: 'Paid', periodMonth: 1, periodYear: 2026 },
  { id: 'exp-7', reference: 'EXP-000007', entityId: 'ent-1', accountId: 'acc-13', expenseType: 'Operating Cost', currencyCode: 'EUR', totalAmount: 2380, vatAmount: 380, netAmount: 2000, dateIssued: '2026-02-01', dueDate: '2026-02-15', paymentDate: '2026-02-10', status: 'Paid', periodMonth: 2, periodYear: 2026 },
  { id: 'exp-8', reference: 'EXP-000008', entityId: 'ent-1', accountId: 'acc-6', expenseType: 'Contractor Payment', contractId: 'ctr-1', currencyCode: 'EUR', totalAmount: 9163, vatAmount: 1463, netAmount: 7700, dateIssued: '2026-02-10', dueDate: '2026-02-25', status: 'Received', periodMonth: 1, periodYear: 2026 },
  { id: 'exp-9', reference: 'EXP-000009', entityId: 'ent-1', accountId: 'acc-6', expenseType: 'Contractor Payment', contractId: 'ctr-2', currencyCode: 'EUR', totalAmount: 8377.6, vatAmount: 1337.6, netAmount: 7040, dateIssued: '2026-02-10', dueDate: '2026-02-25', status: 'Received', periodMonth: 1, periodYear: 2026 },
  { id: 'exp-10', reference: 'EXP-000010', entityId: 'ent-2', accountId: 'acc-7', expenseType: 'Contractor Payment', contractId: 'ctr-3', currencyCode: 'GBP', totalAmount: 7854, vatAmount: 1254, netAmount: 6600, dateIssued: '2026-02-10', dueDate: '2026-02-25', status: 'Received', periodMonth: 1, periodYear: 2026 },
  { id: 'exp-11', reference: 'EXP-000011', entityId: 'ent-3', accountId: 'acc-8', expenseType: 'Contractor Payment', contractId: 'ctr-5', currencyCode: 'USD', totalAmount: 13200, vatAmount: 0, netAmount: 13200, dateIssued: '2026-02-10', dueDate: '2026-02-25', status: 'Received', periodMonth: 1, periodYear: 2026 },
  { id: 'exp-12', reference: 'EXP-000012', entityId: 'ent-1', accountId: 'acc-6', expenseType: 'Contractor Payment', contractId: 'ctr-1', currencyCode: 'EUR', totalAmount: 8747, vatAmount: 1397, netAmount: 7350, dateIssued: '2026-03-10', dueDate: '2026-03-25', status: 'Overdue', periodMonth: 2, periodYear: 2026 },
  { id: 'exp-13', reference: 'EXP-000013', entityId: 'ent-2', accountId: 'acc-7', expenseType: 'Contractor Payment', contractId: 'ctr-6', currencyCode: 'EUR', totalAmount: 9163, vatAmount: 1463, netAmount: 7700, dateIssued: '2026-02-10', dueDate: '2026-02-25', status: 'Received', periodMonth: 1, periodYear: 2026 },
  { id: 'exp-14', reference: 'EXP-000014', entityId: 'ent-1', accountId: 'acc-9', expenseType: 'Software / Subscription', currencyCode: 'USD', totalAmount: 1500, vatAmount: 0, netAmount: 1500, dateIssued: '2026-02-15', dueDate: '2026-03-14', status: 'Overdue', periodMonth: 2, periodYear: 2026 },
  { id: 'exp-15', reference: 'EXP-000015', entityId: 'ent-1', accountId: 'acc-13', expenseType: 'Operating Cost', currencyCode: 'EUR', totalAmount: 2380, vatAmount: 380, netAmount: 2000, dateIssued: '2026-03-01', dueDate: '2026-03-15', status: 'Overdue', periodMonth: 3, periodYear: 2026 },
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
  { id: 'lr-1', name: 'Annual Leave - Apr 2026', contactId: 'con-1', leaveType: 'Annual Leave', startDate: '2026-04-14', endDate: '2026-04-18', totalDays: 5, status: 'Pending', reason: 'Family vacation', clientNotified: false },
  { id: 'lr-2', name: 'Sick Leave - Mar 2026', contactId: 'con-2', leaveType: 'Sick Leave', startDate: '2026-03-20', endDate: '2026-03-21', totalDays: 2, status: 'Approved', reason: 'Medical appointment', clientNotified: true },
  { id: 'lr-3', name: 'Personal Leave - Apr 2026', contactId: 'con-8', leaveType: 'Personal Leave', startDate: '2026-04-07', endDate: '2026-04-07', totalDays: 1, status: 'Pending', reason: 'Personal matter', clientNotified: false },
];

// ===== DIVIDENDS =====
export const dividends: Dividend[] = [
  { id: 'div-1', name: 'DIV-001', entityId: 'ent-1', amount: 15000, currencyCode: 'EUR', paymentDate: '2025-12-20', taxWithheld: 750 },
  { id: 'div-2', name: 'DIV-002', entityId: 'ent-1', amount: 10000, currencyCode: 'EUR', paymentDate: '2025-12-20', taxWithheld: 500 },
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
  { id: 'ph-1', name: 'New Year\'s Day', date: '2026-01-01', country: 'Romania', year: 2026 },
  { id: 'ph-2', name: 'New Year\'s Day (2nd)', date: '2026-01-02', country: 'Romania', year: 2026 },
  { id: 'ph-3', name: 'Unification Day', date: '2026-01-24', country: 'Romania', year: 2026 },
  { id: 'ph-4', name: 'Easter Monday', date: '2026-04-13', country: 'Romania', year: 2026 },
  { id: 'ph-5', name: 'Labour Day', date: '2026-05-01', country: 'Romania', year: 2026 },
  { id: 'ph-6', name: 'National Day', date: '2026-12-01', country: 'Romania', year: 2026 },
  { id: 'ph-7', name: 'Christmas', date: '2026-12-25', country: 'Romania', year: 2026 },
  { id: 'ph-8', name: 'Liberation Day', date: '2026-03-03', country: 'Bulgaria', year: 2026 },
  { id: 'ph-9', name: 'Labour Day', date: '2026-05-01', country: 'Bulgaria', year: 2026 },
  { id: 'ph-10', name: 'National Day', date: '2026-09-06', country: 'Bulgaria', year: 2026 },
  { id: 'ph-11', name: 'New Year\'s Day', date: '2026-01-01', country: 'US', year: 2026 },
  { id: 'ph-12', name: 'Independence Day', date: '2026-07-04', country: 'US', year: 2026 },
  { id: 'ph-13', name: 'Thanksgiving', date: '2026-11-26', country: 'US', year: 2026 },
  { id: 'ph-14', name: 'Christmas', date: '2026-12-25', country: 'US', year: 2026 },
  { id: 'ph-15', name: 'New Year\'s Day', date: '2026-01-01', country: 'UK', year: 2026 },
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
  { id: 'slot-1', candidateId: 'cand-1', dayOfWeek: 'Monday', startTime: '10:00', endTime: '10:15', date: '2026-04-13', teamsLink: 'https://teams.microsoft.com/l/meetup-join/slot1', isActive: true, status: 'Booked', interviewerId: 'con-1', confirmedAt: '2026-04-11' },
  { id: 'slot-2', candidateId: 'cand-2', dayOfWeek: 'Monday', startTime: '14:00', endTime: '14:15', date: '2026-04-13', teamsLink: 'https://teams.microsoft.com/l/meetup-join/slot2', isActive: true, status: 'Completed', interviewerId: 'con-4', confirmedAt: '2026-04-10' },
  { id: 'slot-3', candidateId: 'cand-3', dayOfWeek: 'Wednesday', startTime: '09:00', endTime: '09:15', date: '2026-04-15', teamsLink: '', isActive: true, status: 'New' },
  { id: 'slot-4', candidateId: 'cand-4', dayOfWeek: 'Wednesday', startTime: '15:00', endTime: '15:15', date: '2026-04-15', teamsLink: '', isActive: true, status: 'New' },
  { id: 'slot-5', candidateId: 'cand-5', dayOfWeek: 'Friday', startTime: '10:00', endTime: '10:15', date: '2026-04-17', teamsLink: '', isActive: true, status: 'New' },
  { id: 'slot-6', candidateId: 'cand-6', dayOfWeek: 'Thursday', startTime: '16:00', endTime: '16:15', date: '2026-04-09', teamsLink: '', isActive: true, status: 'Booked', interviewerId: 'con-8', confirmedAt: '2026-04-08' },
  { id: 'slot-7', candidateId: 'cand-7', dayOfWeek: 'Tuesday', startTime: '11:00', endTime: '11:15', date: '2026-03-25', teamsLink: '', isActive: false, status: 'Cancelled' },
  { id: 'slot-8', candidateId: 'cand-8', dayOfWeek: 'Friday', startTime: '14:00', endTime: '14:15', date: '2026-04-10', teamsLink: 'https://teams.microsoft.com/l/meetup-join/slot8', isActive: true, status: 'Completed', interviewerId: 'con-1', confirmedAt: '2026-04-09' },
];

export const onboardingCandidates: OnboardingCandidate[] = [
  { id: 'cand-1', firstName: 'Andrei', lastName: 'Mihai', email: 'andrei.mihai@gmail.com', phone: '+40722111222', path: 'B2B seeking Contracts', cvFileName: 'Andrei_Mihai_CV.pdf', hourlyRateEur: 45, b2bEntityName: 'Mihai Consulting SRL', selectedSlots: [], confirmedSlotId: 'con-1', reviewerNotes: 'Strong React/Node profile. 5 years experience.', status: 'Fit', appliedDate: '2026-03-10', reviewedBy: 'Admin User', createdContactId: 'con-new-1', createdAccountId: 'acc-new-1' },
  { id: 'cand-2', firstName: 'Cristina', lastName: 'Barbu', email: 'cristina.barbu@yahoo.com', phone: '+40733222333', path: 'CIM to B2B', cvFileName: 'Cristina_Barbu_CV.pdf', hourlyRateEur: 35, selectedSlots: [], confirmedSlotId: 'con-4', reviewerNotes: 'Junior profile, needs mentoring.', status: 'Not Fit', appliedDate: '2026-03-12', reviewedBy: 'Admin User' },
  { id: 'cand-3', firstName: 'Vlad', lastName: 'Ionescu', email: 'vlad.ionescu@outlook.com', phone: '+40744333444', path: 'B2B seeking Contracts', cvFileName: 'Vlad_Ionescu_CV.pdf', hourlyRateEur: 55, b2bEntityName: 'Ionescu Tech SRL', selectedSlots: [], confirmedSlotId: 'con-1', status: 'Scheduled', appliedDate: '2026-03-15' },
  { id: 'cand-4', firstName: 'Diana', lastName: 'Popa', email: 'diana.popa@gmail.com', phone: '+40755444555', path: 'B2B seeking Contracts', cvFileName: 'Diana_Popa_CV.pdf', hourlyRateEur: 50, b2bEntityName: 'Popa Digital SRL', selectedSlots: [], confirmedSlotId: 'con-8', status: 'Scheduled', appliedDate: '2026-03-18' },
  { id: 'cand-5', firstName: 'Bogdan', lastName: 'Stanescu', email: 'bogdan.s@gmail.com', phone: '+40766555666', path: 'CIM to B2B', cvFileName: 'Bogdan_Stanescu_CV.pdf', hourlyRateEur: 40, selectedSlots: [], status: 'Applied', appliedDate: '2026-03-20' },
  { id: 'cand-6', firstName: 'Alexandra', lastName: 'Dobre', email: 'alexandra.d@email.com', phone: '+40777666777', path: 'B2B seeking Contracts', cvFileName: 'Alexandra_Dobre_CV.pdf', hourlyRateEur: 60, b2bEntityName: 'Dobre Solutions SRL', selectedSlots: [], status: 'Applied', appliedDate: '2026-03-22' },
  { id: 'cand-7', firstName: 'Radu', lastName: 'Gheorghe', email: 'radu.g@yahoo.com', phone: '+40788777888', path: 'CIM to B2B', cvFileName: 'Radu_Gheorghe_CV.pdf', hourlyRateEur: 38, selectedSlots: [], status: 'Applied', appliedDate: '2026-03-25' },
  { id: 'cand-8', firstName: 'Simona', lastName: 'Tudor', email: 'simona.tudor@gmail.com', phone: '+40799888999', path: 'B2B seeking Contracts', cvFileName: 'Simona_Tudor_CV.pdf', hourlyRateEur: 48, b2bEntityName: 'Tudor IT Consulting SRL', selectedSlots: [], confirmedSlotId: 'con-1', reviewerNotes: 'Great Azure & DevOps skills. Recommended.', status: 'Fit', appliedDate: '2026-03-08', reviewedBy: 'Admin User', createdContactId: 'con-new-2', createdAccountId: 'acc-new-2' },
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

// ===== JD SKILLS =====
export const jdSkills: JDSkill[] = [
  { id: 'skill-1', name: 'React', description: 'Frontend JavaScript library for building user interfaces', definedByAI: false },
  { id: 'skill-2', name: 'TypeScript', description: 'Typed superset of JavaScript', definedByAI: false },
  { id: 'skill-3', name: 'Azure', description: 'Microsoft cloud platform', definedByAI: false },
  { id: 'skill-4', name: 'Power Platform', description: 'Low-code development platform by Microsoft', definedByAI: true },
  { id: 'skill-5', name: '.NET', description: 'Cross-platform framework for building applications', definedByAI: false },
  { id: 'skill-6', name: 'SQL Server', description: 'Relational database management system', definedByAI: false },
  { id: 'skill-7', name: 'DevOps', description: 'CI/CD and infrastructure automation practices', definedByAI: true },
  { id: 'skill-8', name: 'Python', description: 'General-purpose programming language', definedByAI: false },
];

// ===== JD PLATFORMS =====
export const jdPlatforms: JDPlatform[] = [
  { id: 'plat-1', name: 'Azure', description: 'Microsoft Azure cloud platform', definedByAI: false },
  { id: 'plat-2', name: 'AWS', description: 'Amazon Web Services cloud platform', definedByAI: false },
  { id: 'plat-3', name: 'Power Platform', description: 'Microsoft Power Apps, Power Automate, Power BI', definedByAI: true },
  { id: 'plat-4', name: 'Dynamics 365', description: 'Microsoft ERP and CRM platform', definedByAI: false },
  { id: 'plat-5', name: 'Salesforce', description: 'CRM and cloud computing platform', definedByAI: true },
  { id: 'plat-6', name: 'ServiceNow', description: 'IT service management platform', definedByAI: false },
];

// ===== PROSPECTS =====
export const prospects: Prospect[] = [
  { id: 'pro-1', prospectNumber: 'PRO-0001', companyName: 'Helix Biotech GmbH', country: 'Germany', industry: 'Biotech', website: 'helix-bio.de', companySize: '200-500', ownerContactId: 'con-1', source: 'LinkedIn', primaryContactName: 'Lukas Werner', primaryContactEmail: 'lukas.werner@helix-bio.de', primaryContactPhone: '+49 30 1234567', primaryContactRole: 'Head of IT', needDescription: 'Looking for 3 senior .NET contractors for a 12-month modernization project.', servicesDiscussed: 'Standard contracting, dedicated team', estimatedValue: 540000, currencyCode: 'EUR', expectedCloseDate: '2026-06-15', status: 'Discussing', firstContactDate: '2026-02-10', lastActivityDate: '2026-04-12' },
  { id: 'pro-2', prospectNumber: 'PRO-0002', companyName: 'Atlas Logistics PLC', country: 'UK', industry: 'Logistics', website: 'atlaslog.co.uk', companySize: '1000+', ownerContactId: 'con-1', source: 'Email', primaryContactName: 'Emma Clarke', primaryContactEmail: 'emma.clarke@atlaslog.co.uk', primaryContactPhone: '+44 20 7946 0123', primaryContactRole: 'CTO', needDescription: 'Azure migration and DevOps practice setup.', servicesDiscussed: 'Cloud migration, DevOps, T&M contracts', estimatedValue: 320000, currencyCode: 'GBP', expectedCloseDate: '2026-05-30', status: 'Proposal Sent', firstContactDate: '2026-01-20', lastActivityDate: '2026-04-14' },
  { id: 'pro-3', prospectNumber: 'PRO-0003', kind: 'Existing Account', existingAccountId: 'acc-1', companyName: 'NovaPay Inc.', country: 'US', industry: 'Fintech', website: 'novapay.io', companySize: '50-200', ownerContactId: 'con-4', source: 'Internal Referral', referredByContactId: 'con-1', primaryContactName: 'Maria Gonzalez', primaryContactEmail: 'maria@novapay.io', primaryContactRole: 'VP Engineering', needDescription: 'Need 2 React/Node engineers for new payments product.', servicesDiscussed: 'Standard contracting', estimatedValue: 240000, currencyCode: 'USD', expectedCloseDate: '2026-05-10', status: 'Customer Reached Out', firstContactDate: '2026-03-22', lastActivityDate: '2026-04-08' },
  { id: 'pro-4', prospectNumber: 'PRO-0004', companyName: 'BlueWave Energy', country: 'Norway', industry: 'Energy', website: 'bluewave.no', companySize: '500-1000', ownerContactId: 'con-1', source: 'Phone', primaryContactName: 'Sigurd Hansen', primaryContactEmail: 'sigurd.hansen@bluewave.no', primaryContactPhone: '+47 22 12 34 56', primaryContactRole: 'IT Director', needDescription: 'Initial intro call. Exploring SAP integration partners.', estimatedValue: 180000, currencyCode: 'EUR', expectedCloseDate: '2026-08-01', status: 'We Reached Out', firstContactDate: '2026-04-15', lastActivityDate: '2026-04-15' },
  { id: 'pro-5', prospectNumber: 'PRO-0005', companyName: 'Crimson Retail Group', country: 'UK', industry: 'Retail', website: 'crimsonretail.co.uk', companySize: '1000+', ownerContactId: 'con-4', source: 'LinkedIn', primaryContactName: 'James O\'Brien', primaryContactEmail: 'jobrien@crimsonretail.co.uk', primaryContactRole: 'Head of Digital', needDescription: 'eCommerce platform overhaul.', servicesDiscussed: 'Fixed price + T&M hybrid', estimatedValue: 410000, currencyCode: 'GBP', expectedCloseDate: '2026-04-05', status: 'Won', firstContactDate: '2025-11-12', lastActivityDate: '2026-04-05', convertedAccountId: 'acc-1', convertedContactId: 'con-1', convertedDate: '2026-04-05' },
  { id: 'pro-6', prospectNumber: 'PRO-0006', companyName: 'Silverline Insurance', country: 'Germany', industry: 'Insurance', website: 'silverline-ins.de', companySize: '200-500', ownerContactId: 'con-1', source: 'Email', primaryContactName: 'Anna Becker', primaryContactEmail: 'a.becker@silverline-ins.de', primaryContactRole: 'Head of Procurement', needDescription: 'Wanted permanent hires only — not a fit for our model.', estimatedValue: 0, currencyCode: 'EUR', status: 'Lost', firstContactDate: '2026-02-01', lastActivityDate: '2026-03-10', lostReason: 'Wanted FTE, not contractors' },
  { id: 'pro-7', prospectNumber: 'PRO-0007', companyName: 'Quantum Systems SA', country: 'France', industry: 'Aerospace', website: 'quantum-sys.fr', companySize: '500-1000', ownerContactId: 'con-1', source: 'Internal Referral', referredByContactId: 'con-4', primaryContactName: 'Pierre Dubois', primaryContactEmail: 'pierre.dubois@quantum-sys.fr', primaryContactRole: 'Procurement Manager', needDescription: 'Multi-year framework agreement for embedded engineers.', servicesDiscussed: 'Long-term contracting framework', estimatedValue: 1200000, currencyCode: 'EUR', expectedCloseDate: '2026-09-01', status: 'Discussing', firstContactDate: '2026-03-01', lastActivityDate: '2026-04-10' },
  { id: 'pro-8', prospectNumber: 'PRO-0008', companyName: 'Sunset Media LLC', country: 'US', industry: 'Media', website: 'sunsetmedia.com', companySize: '50-200', ownerContactId: 'con-4', source: 'LinkedIn', primaryContactName: 'Rachel Kim', primaryContactEmail: 'rachel@sunsetmedia.com', primaryContactRole: 'CEO', needDescription: 'Looking for a CTO-as-a-service.', estimatedValue: 90000, currencyCode: 'USD', expectedCloseDate: '2026-05-20', status: 'We Reached Out', firstContactDate: '2026-03-28', lastActivityDate: '2026-04-11' },
  { id: 'pro-9', prospectNumber: 'PRO-0009', companyName: 'Northwind Finance', country: 'Netherlands', industry: 'Banking', ownerContactId: 'con-1', source: 'LinkedIn', primaryContactName: 'Femke Janssen', primaryContactEmail: 'f.janssen@northwind.nl', primaryContactRole: 'Head of Data', needDescription: 'Data platform modernization on Snowflake.', estimatedValue: 280000, currencyCode: 'EUR', status: 'We Reached Out', firstContactDate: '2026-04-10', lastActivityDate: '2026-04-16' },
  { id: 'pro-10', prospectNumber: 'PRO-0010', companyName: 'Granite Manufacturing', country: 'Poland', industry: 'Manufacturing', ownerContactId: 'con-4', source: 'Email', primaryContactName: 'Pawel Nowak', primaryContactEmail: 'p.nowak@granite-mfg.pl', primaryContactRole: 'Plant Director', needDescription: 'MES rollout to 4 plants.', estimatedValue: 360000, currencyCode: 'EUR', status: 'We Reached Out', firstContactDate: '2026-04-02', lastActivityDate: '2026-04-09' },
  { id: 'pro-11', prospectNumber: 'PRO-0011', companyName: 'Tide Health', country: 'UK', industry: 'Healthcare', ownerContactId: 'con-1', source: 'Phone', primaryContactName: 'Sarah Patel', primaryContactEmail: 'sarah.patel@tidehealth.uk', primaryContactRole: 'CIO', needDescription: 'NHS-compliant patient portal.', estimatedValue: 220000, currencyCode: 'GBP', status: 'Customer Reached Out', firstContactDate: '2026-03-18', lastActivityDate: '2026-04-13' },
  { id: 'pro-12', prospectNumber: 'PRO-0012', kind: 'Existing Account', existingAccountId: 'acc-2', companyName: 'NovaPay Inc.', country: 'US', industry: 'Fintech', ownerContactId: 'con-4', source: 'Internal Referral', primaryContactName: 'Derek Chen', primaryContactEmail: 'derek@novapay.io', primaryContactRole: 'Director of Eng', needDescription: 'Expansion: data engineering pod.', estimatedValue: 180000, currencyCode: 'USD', status: 'Customer Reached Out', firstContactDate: '2026-04-01', lastActivityDate: '2026-04-15' },
  { id: 'pro-13', prospectNumber: 'PRO-0013', companyName: 'Aurora Telecom', country: 'Sweden', industry: 'Telecom', ownerContactId: 'con-1', source: 'LinkedIn', primaryContactName: 'Erik Lindberg', primaryContactEmail: 'erik.lindberg@aurora-tel.se', primaryContactRole: 'Head of Architecture', needDescription: '5G core team augmentation.', estimatedValue: 480000, currencyCode: 'EUR', status: 'Discussing', firstContactDate: '2026-02-22', lastActivityDate: '2026-04-08' },
  { id: 'pro-14', prospectNumber: 'PRO-0014', companyName: 'Maple Leaf Insurance', country: 'Canada', industry: 'Insurance', ownerContactId: 'con-4', source: 'Email', primaryContactName: 'Olivia Tremblay', primaryContactEmail: 'olivia@mapleleaf-ins.ca', primaryContactRole: 'VP Operations', needDescription: 'Claims automation platform.', estimatedValue: 310000, currencyCode: 'USD', status: 'Discussing', firstContactDate: '2026-03-05', lastActivityDate: '2026-03-30' },
  { id: 'pro-15', prospectNumber: 'PRO-0015', companyName: 'Verdant Agritech', country: 'Spain', industry: 'AgriTech', ownerContactId: 'con-1', source: 'Phone', primaryContactName: 'Carlos Ruiz', primaryContactEmail: 'carlos.ruiz@verdant.es', primaryContactRole: 'CTO', needDescription: 'IoT data ingestion pipeline.', estimatedValue: 150000, currencyCode: 'EUR', status: 'Discussing', firstContactDate: '2026-01-30', lastActivityDate: '2026-03-12' },
  { id: 'pro-16', prospectNumber: 'PRO-0016', companyName: 'Ironclad Defence', country: 'UK', industry: 'Defence', ownerContactId: 'con-1', source: 'Internal Referral', primaryContactName: 'Major R. Hughes', primaryContactEmail: 'r.hughes@ironclad.uk', primaryContactRole: 'Programme Lead', needDescription: 'Cleared engineers for secure systems.', estimatedValue: 720000, currencyCode: 'GBP', status: 'Proposal Sent', firstContactDate: '2026-02-12', lastActivityDate: '2026-04-11' },
  { id: 'pro-17', prospectNumber: 'PRO-0017', companyName: 'Lumen Education', country: 'Ireland', industry: 'EdTech', ownerContactId: 'con-4', source: 'LinkedIn', primaryContactName: 'Niamh Doyle', primaryContactEmail: 'niamh@lumen-edu.ie', primaryContactRole: 'Head of Product', needDescription: 'LMS rebuild.', estimatedValue: 195000, currencyCode: 'EUR', status: 'Proposal Sent', firstContactDate: '2026-02-28', lastActivityDate: '2026-03-25' },
  { id: 'pro-18', prospectNumber: 'PRO-0018', kind: 'Existing Account', existingAccountId: 'acc-1', companyName: 'Crimson Retail Group', country: 'UK', industry: 'Retail', ownerContactId: 'con-4', source: 'Internal Referral', primaryContactName: 'Hannah Lewis', primaryContactEmail: 'hannah@crimsonretail.co.uk', primaryContactRole: 'Digital Director', needDescription: 'Phase 2: mobile app rebuild.', estimatedValue: 260000, currencyCode: 'GBP', status: 'Proposal Sent', firstContactDate: '2026-03-08', lastActivityDate: '2026-04-14' },
  { id: 'pro-19', prospectNumber: 'PRO-0019', companyName: 'Stonebridge Capital', country: 'US', industry: 'Investment', ownerContactId: 'con-1', source: 'Email', primaryContactName: 'Daniel Roth', primaryContactEmail: 'd.roth@stonebridge.com', primaryContactRole: 'COO', needDescription: 'Risk reporting platform.', estimatedValue: 340000, currencyCode: 'USD', status: 'Won', firstContactDate: '2025-12-01', lastActivityDate: '2026-03-28', convertedDate: '2026-03-28' },
  { id: 'pro-20', prospectNumber: 'PRO-0020', companyName: 'Echo Travel Group', country: 'Germany', industry: 'Travel', ownerContactId: 'con-4', source: 'LinkedIn', primaryContactName: 'Markus Vogel', primaryContactEmail: 'markus@echotravel.de', primaryContactRole: 'CTO', needDescription: 'Booking engine refactor.', estimatedValue: 0, currencyCode: 'EUR', status: 'Lost', firstContactDate: '2025-12-15', lastActivityDate: '2026-02-20', lostReason: 'Chose internal team' },
  { id: 'pro-21', prospectNumber: 'PRO-0021', companyName: 'Polaris Robotics', country: 'Switzerland', industry: 'Robotics', ownerContactId: 'con-1', source: 'Phone', primaryContactName: 'Dr. Yves Müller', primaryContactEmail: 'yves@polaris-robotics.ch', primaryContactRole: 'Head of Software', needDescription: 'C++ embedded engineers for warehouse robots.', estimatedValue: 420000, currencyCode: 'EUR', status: 'We Reached Out', firstContactDate: '2026-04-12', lastActivityDate: '2026-04-12' },
  { id: 'pro-22', prospectNumber: 'PRO-0022', companyName: 'Cobalt Mining Ltd', country: 'Australia', industry: 'Mining', ownerContactId: 'con-4', source: 'Email', primaryContactName: 'Sophie Wright', primaryContactEmail: 'sophie@cobaltmining.au', primaryContactRole: 'IT Manager', needDescription: 'SAP S/4 migration support.', estimatedValue: 530000, currencyCode: 'USD', status: 'Discussing', firstContactDate: '2026-02-08', lastActivityDate: '2026-04-01' },
  { id: 'pro-23', prospectNumber: 'PRO-0023', companyName: 'Saffron Foods', country: 'India', industry: 'FoodTech', ownerContactId: 'con-1', source: 'LinkedIn', primaryContactName: 'Arjun Mehta', primaryContactEmail: 'arjun@saffronfoods.in', primaryContactRole: 'Head of Tech', needDescription: 'Supply chain visibility platform.', estimatedValue: 130000, currencyCode: 'EUR', status: 'Customer Reached Out', firstContactDate: '2026-04-05', lastActivityDate: '2026-04-14' },
  { id: 'pro-24', prospectNumber: 'PRO-0024', companyName: 'Halcyon Pharma', country: 'Belgium', industry: 'Pharma', ownerContactId: 'con-4', source: 'Internal Referral', primaryContactName: 'Inge Vermeulen', primaryContactEmail: 'inge@halcyon-pharma.be', primaryContactRole: 'Head of Validation', needDescription: 'GxP-compliant data pipelines.', estimatedValue: 290000, currencyCode: 'EUR', status: 'Proposal Sent', firstContactDate: '2026-03-15', lastActivityDate: '2026-04-10' },
  { id: 'pro-25', prospectNumber: 'PRO-0025', companyName: 'Velocity Sports', country: 'US', industry: 'Sports', ownerContactId: 'con-1', source: 'LinkedIn', primaryContactName: 'Tyler Brooks', primaryContactEmail: 'tyler@velocity-sports.com', primaryContactRole: 'VP Digital', needDescription: 'Fan engagement app.', estimatedValue: 175000, currencyCode: 'USD', status: 'Won', firstContactDate: '2026-01-08', lastActivityDate: '2026-04-02', convertedDate: '2026-04-02' },
  { id: 'pro-26', prospectNumber: 'PRO-0026', companyName: 'Beacon Public Sector', country: 'UK', industry: 'Public Sector', ownerContactId: 'con-1', source: 'Email', primaryContactName: 'Michael Stone', primaryContactEmail: 'michael.stone@beacon.gov.uk', primaryContactRole: 'Head of Procurement', needDescription: 'GDS-aligned digital service.', estimatedValue: 0, currencyCode: 'GBP', status: 'Lost', firstContactDate: '2026-01-22', lastActivityDate: '2026-03-05', lostReason: 'Lost on price' },
];

export const prospectInteractions: ProspectInteraction[] = [
  { id: 'pi-1', prospectId: 'pro-1', type: 'LinkedIn', date: '2026-02-10', summary: 'Initial outreach via LinkedIn DM. Lukas responded same day.', createdBy: 'Admin User' },
  { id: 'pi-2', prospectId: 'pro-1', type: 'Call', date: '2026-02-18', summary: 'Discovery call. Discussed their .NET modernization roadmap and team gaps.', durationMinutes: 45, createdBy: 'Admin User' },
  { id: 'pi-3', prospectId: 'pro-1', type: 'Meeting', date: '2026-03-12', summary: 'On-site visit. Met with engineering leadership and procurement.', durationMinutes: 120, createdBy: 'Admin User' },
  { id: 'pi-4', prospectId: 'pro-1', type: 'Email', date: '2026-04-12', summary: 'Sent revised commercial proposal with 3 senior profiles.', createdBy: 'Admin User' },
  { id: 'pi-5', prospectId: 'pro-2', type: 'Email', date: '2026-01-20', summary: 'Inbound enquiry via website contact form.', createdBy: 'Admin User' },
  { id: 'pi-6', prospectId: 'pro-2', type: 'Call', date: '2026-02-05', summary: 'Discovery call about Azure migration timeline.', durationMinutes: 60, createdBy: 'Admin User' },
  { id: 'pi-7', prospectId: 'pro-2', type: 'Meeting', date: '2026-03-20', summary: 'Solution workshop with Atlas architecture team.', durationMinutes: 180, createdBy: 'Admin User' },
  { id: 'pi-8', prospectId: 'pro-2', type: 'Email', date: '2026-04-14', summary: 'Submitted formal proposal. Awaiting feedback by April 25.', createdBy: 'Admin User' },
  { id: 'pi-9', prospectId: 'pro-3', type: 'Call', date: '2026-03-22', summary: 'Warm intro from CSP-1. 30 min discovery.', durationMinutes: 30, createdBy: 'Admin User' },
  { id: 'pi-10', prospectId: 'pro-3', type: 'Email', date: '2026-04-08', summary: 'Sent capability deck and 2 sample CVs.', createdBy: 'Admin User' },
  { id: 'pi-11', prospectId: 'pro-4', type: 'Call', date: '2026-04-15', summary: 'Cold call inbound. Brief intro, scheduled follow-up.', durationMinutes: 15, createdBy: 'Admin User' },
  { id: 'pi-12', prospectId: 'pro-5', type: 'LinkedIn', date: '2025-11-12', summary: 'Connected via LinkedIn. James open to a chat.', createdBy: 'Admin User' },
  { id: 'pi-13', prospectId: 'pro-5', type: 'Meeting', date: '2026-01-15', summary: 'On-site discovery + scoping workshop.', durationMinutes: 240, createdBy: 'Admin User' },
  { id: 'pi-14', prospectId: 'pro-5', type: 'Email', date: '2026-04-05', summary: 'Contract signed. Converting to account.', createdBy: 'Admin User' },
  { id: 'pi-15', prospectId: 'pro-7', type: 'Meeting', date: '2026-03-25', summary: 'Framework agreement workshop. Legal review in progress.', durationMinutes: 150, createdBy: 'Admin User' },
];

export const prospectMaterials: ProspectMaterial[] = [
  { id: 'pm-1', prospectId: 'pro-1', fileName: 'CSP_Capability_Deck_v3.pdf', sharedDate: '2026-02-18', description: 'General capability overview' },
  { id: 'pm-2', prospectId: 'pro-1', fileName: 'Helix_Commercial_Proposal_v2.pdf', sharedDate: '2026-04-12', description: 'Revised pricing for 3 .NET seniors' },
  { id: 'pm-3', prospectId: 'pro-2', fileName: 'Atlas_Azure_Migration_SOW.pdf', sharedDate: '2026-04-14', description: 'Full SOW with phasing' },
  { id: 'pm-4', prospectId: 'pro-3', fileName: 'NovaPay_Sample_CVs.pdf', sharedDate: '2026-04-08', description: '2 React/Node senior profiles' },
  { id: 'pm-5', prospectId: 'pro-5', fileName: 'Crimson_Final_Contract.pdf', sharedDate: '2026-04-05', description: 'Signed master agreement' },
  { id: 'pm-6', prospectId: 'pro-7', fileName: 'Quantum_Framework_Agreement_Draft.pdf', sharedDate: '2026-03-25', description: 'Draft for legal review' },
];

export function getProspectById(id: string) { return prospects.find(p => p.id === id); }

// ===== OPPORTUNITIES =====
export const opportunities: Opportunity[] = [
  {
    id: 'opp-1', opportunityNumber: 'OPP-0001', source: 'From Prospect', clientLinkType: 'Prospect', prospectId: 'pro-1',
    candidateIds: ['cand-1'], contactIds: [], role: 'Senior .NET Developer',
    opportunityRate: 65, opportunityRateUnit: 'Hour', currencyCode: 'EUR',
    candidateRate: 45, candidateRateUnit: 'Hour',
    details: 'Helix Bank looking for a senior .NET dev to lead modernization.',
    startDate: '2026-05-01', closingDate: '2026-06-15', status: 'Interview Booked',
    outcomeComments: '', createdAt: '2026-04-12',
  },
  {
    id: 'opp-2', opportunityNumber: 'OPP-0002', source: 'From Existing Client', clientLinkType: 'Account', accountId: 'acc-1',
    candidateIds: ['cand-2'], contactIds: [], role: 'React Engineer',
    opportunityRate: 600, opportunityRateUnit: 'Day', currencyCode: 'EUR',
    candidateRate: 480, candidateRateUnit: 'Day',
    details: 'Frontend reinforcement for Q3 release.',
    startDate: '2026-05-15', closingDate: '2026-05-30', status: 'New',
    createdAt: '2026-04-20',
  },
  {
    id: 'opp-3', opportunityNumber: 'OPP-0003', source: 'From New Client', clientLinkType: 'Free Text', freeClientName: 'Innova Health (new lead)',
    candidateIds: [], contactIds: ['con-1'], role: 'Cloud Architect',
    opportunityRate: 750, opportunityRateUnit: 'Day', currencyCode: 'EUR',
    candidateRate: 600, candidateRateUnit: 'Day',
    details: 'Inbound enquiry — not yet qualified as a Prospect.',
    closingDate: '2026-06-30', status: 'New',
    createdAt: '2026-04-25',
  },
];

export const opportunityMaterials: OpportunityMaterial[] = [
  { id: 'om-1', opportunityId: 'opp-1', fileName: 'Helix_Role_Spec.pdf', sharedDate: '2026-04-12', description: 'Role description from client' },
];

let _opportunitySeq = opportunities.length;
export function nextOpportunityNumber() {
  _opportunitySeq += 1;
  return `OPP-${String(_opportunitySeq).padStart(4, '0')}`;
}
export function addOpportunity(o: Opportunity) {
  opportunities.unshift(o);
}


// Helper lookups
export function getEntityById(id: string) { return entities.find(e => e.id === id); }
export function getAccountById(id: string) { return accounts.find(a => a.id === id); }
export function getContactById(id: string) { return contacts.find(c => c.id === id); }
export function getContractById(id: string) { return contracts.find(c => c.id === id); }
export function getMilestonesByContractId(contractId: string) { return contractMilestones.filter(m => m.contractId === contractId); }
export function getContractLookupLabel(c: { id: string; contractNumber: string; parentAccountId: string; contactId: string; entityId: string }) {
  const account = getAccountById(c.parentAccountId)?.name || '—';
  const contact = getContactById(c.contactId);
  const consultant = contact ? `${contact.firstName} ${contact.lastName}` : '—';
  const country = getEntityById(c.entityId)?.country || '—';
  return `${c.contractNumber} | ${account} | ${consultant} | ${country}`;
}
