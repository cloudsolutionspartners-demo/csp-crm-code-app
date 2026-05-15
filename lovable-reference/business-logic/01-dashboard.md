# 01 — Dashboard

## Purpose

Landing page (`/`). Read-only KPI dashboard summarising onboarding, prospects, invoicing, expenses, contracts, and leave for the **previous, current, and next month**. Provides quick navigation to detail pages.

## Primary entity

None (aggregations only).

## Sections

### 1. Onboarding (Candidates)
Per month bucket (last / this / next):
- `total` = count of candidates with `appliedDate` in the month.
- `fit` = count where `status = 'Fit'`.
- `notFit` = count where `status = 'Not Fit'`.
- `scheduled` = count where `status = 'Scheduled'`.

### 2. Prospects pipeline
Funnel chart over stages: `We Reached Out → Customer Reached Out → Discussing → Proposal Sent → Won`. Counts active prospects (excl. `Lost`) per stage. Stage colour map fixed (see code).

### 3. Invoicing
For each month bucket: `issued` count, `total` (sum), `paid` (count + amount), `overdue` (count + amount).

### 4. Expenses
For each month bucket: `paid`, `received`, `overdue` totals; net cash position = invoices paid − expenses paid.

### 5. Contracts
- Active contracts count.
- Contracts ending within next 30 days (`endDate ≤ today + 30`).
- Average margin %.

### 6. Leave (next 30 days)
List of upcoming `Approved` leave requests; flag `clientNotified = false` as warning.

## Business rules

- Month bucket calculation uses **calendar month** based on the device clock.
- For invoicing/expenses, an item belongs to a month by `invoiceDate` / `dateIssued`.
- Overdue is computed dynamically: `status = 'Sent'` AND `dueDate < today`. The Invoices page may persist an `Overdue` status — both are valid (display layer favours the dynamic check).

## Permissions

Admin and Owner can view. No write actions on this page (except the **+ Add Expense** quick action which opens the standard Expense form sheet).
