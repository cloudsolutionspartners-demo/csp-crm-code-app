# 08 — Timesheets

## Purpose

Weekly time tracking per contract, used by consultants and approved by Admin/Owner. Drives invoicing for `Time & Material` contracts.

## Primary entity: `Timesheet` (+ embedded `TimesheetEntry[]`)

### Timesheet fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `reference` | String | yes | `TS-YYYY-NNN` |
| `contactId` | Lookup → Contact | yes | the consultant |
| `contractId` | Lookup → Contract | yes | must have `hasTimesheet = true` |
| `weekStart` | DateOnly | yes | **must be a Monday** |
| `totalHours` | Decimal | derived | sum of `entries[].hours` |
| `status` | Choice (`TimesheetStatus`) | yes | default `Draft` |
| `entries` | Array<TimesheetEntry> | yes | exactly 7 (Mon→Sun) |

### TimesheetEntry fields

| Field | Type | Notes |
|---|---|---|
| `date` | DateOnly | one per day Mon..Sun |
| `hours` | Decimal | 0–24 |
| `comment` | String | per-day note |
| `description` | String | optional task description |

## Validation rules

- `weekStart.dayOfWeek == Monday`. Week end (Sunday) is derived as `weekStart + 6 days`.
- Exactly **7 entries** per timesheet; dates are consecutive starting from `weekStart`.
- Each entry `hours` between 0 and 24 inclusive.
- A consultant may have **at most one** timesheet per `(contactId, contractId, weekStart)` — uniqueness enforced.

## Business rules

### Status transitions

`Draft → Submitted → Approved` (happy path). `Submitted → Rejected` returns the timesheet to the consultant with a comment (notification email/toast).

### Hour pre-population strategy (used by the Generate flow)

Determined by contract type/billing combination:

| `contractType` | `billingType` | Strategy | Default per weekday |
|---|---|---|---|
| Standard Contracting | Standard Contracting | `eight` | 8 hours |
| Standard Contracting | Time & Material | `zero` | 0 (consultant fills) |
| Standard Contracting | Fixed Price | `ask` | prompt user for daily hours |
| Fixed Price | Fixed Price | `exclude` | not generated (uses milestones) |
| any other | — | `zero` | 0 |

Weekend days (Sat/Sun) are always pre-populated with `0`, regardless of strategy.

### Generate flow (header action)

1. User selects month + year and one or more eligible contracts.
2. Eligible contracts: `status = Active`, `hasTimesheet = true`, NOT (`Fixed Price + Fixed Price`).
3. For each contract, compute weeks to create:
   - Find latest existing `weekStart` for that contract.
   - Start from the next Monday after that (or first Monday in/after the chosen month if none exists).
   - Iterate by 7 days while `current.month == chosenMonth`.
   - Skip any week that already exists (uniqueness).
4. Apply hour strategy. If `ask`, the wizard pauses and asks the user for a daily-hours value (default `8`).
5. Persist generated timesheets with `status = Draft`.

### Approval

- Only Admin/Owner can approve.
- Approved timesheets become read-only (except by Admin via "Reopen" action — production addition).
- Returned (rejected) timesheets reset to `Draft` for the consultant to edit.

### Excel export

Bulk export of selected timesheets uses `xlsx` library producing one sheet per timesheet.

## Filtering

Pills: Search (reference, consultant, contract #), Status, **Week Date** (relative slider — slides Monday-to-Sunday increments; left bound = today − 1 year, right bound = end of current month).
Column filters: Reference, Consultant, Contract, Hours (range).
Views: Table, By Account, Monthly Timeline, By Consultant.

## Cross-entity effects

- Approved timesheet hours flow into invoice generation for `Time & Material` contracts (the invoice line `quantity` defaults to `totalHours` for the period, UoM = `Hour`).
- Returning a timesheet sends a notification (toast in prototype; email in production) to the consultant.
