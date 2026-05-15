# 00 — Global Data Model

Shared enums, lookups, and conventions used across the platform. All page-level files reference this document.

## Enums (Dataverse `Choice` columns)

| Name | Values |
|------|--------|
| `Country` | Romania, Bulgaria, US, UK |
| `CurrencyCode` | USD, EUR, RON, GBP |
| `AccountType` | Direct Customer, Recruiter Client, Recruiter Agency, Partner B2B, Contractor, Supplier, Legal Taxes |
| `AccountStatus` | Active, Inactive, Prospect |
| `PaymentTerms` | 15 Days, 30 Days, 45 Days, 60 Days |
| `ContactType` | Consultant, Client Contact, Middleman Contact, Finance Contact, Permanent Employee |
| `ContractType` | Standard Contracting, Permanent Employee, Fixed Price |
| `ContractStatus` | Draft, Active, On Hold, Completed, Terminated |
| `BillingType` | Time & Material, Fixed Price, Monthly Salary, Standard Contracting |
| `InvoiceStatus` | Draft, Sent, Paid, Overdue, Cancelled, Credit Note |
| `ExpenseType` | Contractor Payment, Supplier Invoice, Tax, Employee Salary, Operating Cost, Software / Subscription |
| `ExpenseStatus` | Received, Paid, Overdue |
| `TimesheetStatus` | Draft, Submitted, Approved, Rejected |
| `LeaveType` | Annual Leave, Sick Leave, Personal Leave, Public Holiday |
| `LeaveStatus` | Pending, Approved, Rejected |
| `UnitOfMeasure` | Day, Hour, Month, Fixed |
| `MilestoneStatus` | Pending, Invoiced, Paid |
| `SlotStatus` | New, Booked, Cancelled, Completed |
| `CandidatePath` | CIM to B2B, B2B seeking Contracts |
| `CandidateStatus` | Applied, Scheduled, Fit, Not Fit |
| `ProspectKind` | New Business, Existing Account |
| `ProspectStatus` | New, Contacted, Discussing, Proposal, Won, Lost, We Reached Out, Customer Reached Out, Proposal Sent |
| `ProspectSource` | Phone, LinkedIn, Email, Internal Referral |
| `InteractionType` | Call, Email, Meeting, LinkedIn |
| `DocumentType` | Contract, Certificate, Invoice, Policy, Report, Other |
| `SnapshotType` | Actual, Forecast |
| `UserRole` | Admin, Owner |

## Currency map

| Code | Symbol |
|------|--------|
| USD | $ |
| EUR | € |
| RON | lei |
| GBP | £ |

All monetary fields must persist `currencyCode` alongside the value. **Never** auto-convert in the data layer.

Reporting (and only reporting) may convert into RON using `ExchangeRate` records (see `14-settings.md`).

## Business Entities (the operating companies)

The platform supports multiple operating companies (`BusinessEntity`). Each entity belongs to a `Country` and has a `baseCurrencyCode`. Country-specific bank fields:

- **Romania (CSP-RO):** `bankName`, `iban`, `swift`, `intermediaryBic`.
- **Bulgaria (CSP-BG):** EU bank fields **plus** UK bank fields (`ukBankName`, `ukAccountNumber`, `ukSortCode`, `ukIban`, `ukSwift`, `ukIntermediaryBic`).
- **US (CSP-US):** `usAccountNumber`, `usAchRoutingNumber`, `usWireRoutingNumber`.

Every `Account`, `Contract`, `Invoice`, `Expense`, `Dividend` MUST be scoped to exactly one `BusinessEntity` (`entityId`).

## Permissions

- **Admin** — full read/write across all entities, settings, users.
- **Owner** — full read/write on operational data (accounts, contracts, invoices, expenses, timesheets, leave, prospects, candidates). Cannot manage settings or users.

(Detailed RBAC matrix lives in the Power Apps security role; this is the high-level intent.)

## Numbering / Reference patterns

Sequential, zero-padded references are generated per entity type. The prototype uses 3-digit padding; production should use a Dataverse autonumber column.

| Entity | Pattern | Example |
|--------|---------|---------|
| Invoice | `INV-NNN` | INV-042 |
| Expense | `EXP-NNN` | EXP-018 |
| Contract | `CON-NNN` | CON-007 |
| Milestone | `MS-NNN` | MS-003 |
| Timesheet | `TS-YYYY-NNN` | TS-2026-021 |
| Leave | `LEA-NNNN` | LEA-0014 |
| Dividend | `DIV-NNN` | DIV-005 |
| Prospect | `PRO-NNNN` | PRO-0023 |

Account uses an `accountNumber` set manually or by a separate sequence.

## Common UI behaviours (apply on every list page)

- **Search pill** — free-text search across the most relevant fields of the entity.
- **Single-select / multi-select pills** — for `Choice` columns (Status, Type, Country, etc).
- **Relative date pill** — opens a slider covering the last 12 months → today (Timesheets pill `Week Date` slides Mon-to-Sun, max right = end of current month).
- **Column filters** — text contains, multi-select, number range, date range, applied per column header.
- **Selection bar** — bulk selection with delete/download/activate/deactivate actions where applicable.
- **Slide-over (Sheet) form** — used for create/edit on every entity instead of a page navigation.
- **Confirm dialog** — required for any destructive action (delete, terminate, cancel).
