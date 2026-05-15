# 04 — Contracts

## Purpose

Commercial agreements between a `BusinessEntity` and a counterparty (client account and/or contractor). Drives invoicing, timesheets, milestones, margin reporting.

## Primary entity: `Contract`

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `contractNumber` | String | yes | `CON-NNN` | system-generated |
| `name` | String | yes | — | descriptive title |
| `contractType` | Choice (`ContractType`) | yes | Standard Contracting | |
| `billingType` | Choice (`BillingType`) | yes | Time & Material | |
| `entityId` | Lookup → BusinessEntity | yes | — | |
| `parentAccountId` | Lookup → Account | yes | — | the **client / payer** |
| `childAccountId` | Lookup → Account | no | — | sub-account (e.g. end client when invoicing through a recruiter) |
| `contactId` | Lookup → Contact | yes | — | the **contractor / assignee** |
| `sellRate` | Decimal | yes | — | per `unitOfMeasure` |
| `sellHourlyRate` | Decimal | no | derived | sellRate / 8 if Day |
| `sellCurrency` | Choice (`CurrencyCode`) | yes | EUR | |
| `buyRate` | Decimal | yes | — | what we pay the contractor |
| `buyHourlyRate` | Decimal | no | derived | |
| `buyCurrency` | Choice (`CurrencyCode`) | yes | EUR | |
| `unitOfMeasure` | Choice (`UnitOfMeasure`) | yes | Day | |
| `payTerms` | Choice (`PaymentTerms`) | yes | 30 Days | inherited from account on create |
| `margin` | Decimal | derived | — | `sellRate − buyRate` (same UoM, may need FX) |
| `marginPercent` | Decimal | derived | — | `margin / sellRate × 100` |
| `grossValue` | Decimal | no | — | for Fixed Price |
| `monthlySalary` | Decimal | no | — | for `contractType = Permanent Employee` |
| `monthlySalaryCurrency` | Choice | no | EUR | |
| `startDate` | DateOnly | yes | — | |
| `endDate` | DateOnly | no | — | planned end |
| `actualEndDate` | DateOnly | no | — | set when terminated |
| `noticePeriod` | String | no | — | e.g. "30 days" |
| `hasTimesheet` | Boolean | yes | true | enables timesheet generation |
| `hasMilestones` | Boolean | yes | false | enables milestones tab |
| `calendarType` | String | no | — | e.g. RO holidays calendar |
| `status` | Choice (`ContractStatus`) | yes | Draft | |

## Validation rules

- All fields marked required must be present before save.
- `endDate ≥ startDate` if `endDate` is set.
- `actualEndDate ≥ startDate` if set.
- `hasTimesheet` and `hasMilestones` are **mutually exclusive when** `contractType = 'Fixed Price'` AND `billingType = 'Fixed Price'` → `hasTimesheet` must be `false` and `hasMilestones` must be `true`.
- `parentAccountId ≠ childAccountId`.
- Currency mixing allowed (sell in EUR, buy in RON), but margin display warns when currencies differ.

## Business rules

- **Status transitions:** `Draft → Active → On Hold ↔ Active → Completed | Terminated`. Terminated requires `actualEndDate`.
- **Margin calc:**
  - If `sellCurrency == buyCurrency`: `margin = sellRate − buyRate`, `marginPercent = margin / sellRate × 100`.
  - If currencies differ: convert `buyRate` to `sellCurrency` using the latest `ExchangeRate` for display only.
- **Hour conversion:** if `unitOfMeasure = Day`, `sellHourlyRate = sellRate / 8` (and same for buy).
- **Invoice rate suggestion** — when an invoice line is created against a contract, line amount = `quantity × (sellRate or sellRate/8 if UoM = Hour)`.
- **Timesheet generation** — see `08-timesheets.md`. Only contracts with `status = Active` AND `hasTimesheet = true` AND NOT (`Fixed Price + Fixed Price`) appear in the generator.
- **Milestone generation** — only contracts with `hasMilestones = true` are eligible (see `05-contract-milestones.md`).

## Tabs in the Contract slide-over

1. **Parties** — entity, parent/child accounts, contractor.
2. **Commercials** — rates, currencies, margin, payment terms, salary (if Permanent Employee).
3. **Dates** — start, planned end, actual end, notice period.
4. **Invoices** — invoices linked via `contractId`.
5. **Timesheets** — timesheets linked via `contractId`.
6. **Milestones** — only when `hasMilestones = true`.

## Cross-entity effects

- Setting status to **Terminated** with `actualEndDate < endDate` should display a warning that any pending milestones / future timesheets should be reviewed (no automatic deletion).
- Deletion blocked if any invoice, expense, timesheet, or milestone references this contract.

## Filters

Pills: Search, Status, Contract Type, Billing Type, Country, Start Date (relative), End Date (relative).
Column filters: Contract # (text), Contract Type (multi), Billing Type (multi), Account (text), Contractor (text), Margin % (number range).
