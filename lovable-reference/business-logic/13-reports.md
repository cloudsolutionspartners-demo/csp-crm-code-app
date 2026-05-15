# 13 — Reports (Billing & Profit)

## Purpose

Forward-looking financial dashboard: actuals for last/this month + forecast for next 2 months. Broken down by country and currency.

## Inputs

- `Contract` (active, with `startDate ≤ monthEnd` and (`endDate ≥ monthStart` OR null))
- `ContractMilestone`
- `Invoice` (for last-month actual profit)
- `ExchangeRate` (for cross-currency normalisation)

## Computed columns

For each month bucket (`last`, `this`, `next`, `inTwoMonths`):

- **Billing forecast (per contract)**:
  - `Time & Material` / `Standard Contracting` (Day): `sellRate × workingDaysInMonth × allocation` (allocation defaults 1.0; reduced for partial-month start/end).
  - `Time & Material` (Hour): `sellHourlyRate × workingDaysInMonth × 8`.
  - `Monthly Salary`: `sellRate` (treated as monthly amount).
  - `Fixed Price`: pro-rate `grossValue` over the duration months OR include only if a milestone falls in that month.
- **Profit forecast (per contract)**: `billing − cost`, where cost uses `buyRate` similarly. Currency-aware; cross-currency uses latest `ExchangeRate`.
- **Working days** = weekdays in month minus public holidays for the contract's entity country.

## Last-month override

For the `last` bucket, **profit** is replaced with the actual profit derived from issued invoices (`InvoiceLine` linked to contract) minus matched contractor expenses (`Expense.expenseType = Contractor Payment` linked to contract). See `src/lib/reports-forecast.ts` (`buildLastMonthProfitFromInvoices`).

## Aggregation

- Headline grouping: `(country, currency)`. Each group has a row showing 4 months × `(billing, profit)`.
- Drill-down: per-contract rows under each headline group, expandable.

## Chart

Single bar chart, 4 months × `(billing, profit)`, summed in display currency (one per currency in the legend or merged with FX warning).

## Validations

- None at write time (no writes here).
- Display warns when a contract has `sellCurrency ≠ buyCurrency` and no exchange rate is found for the period.

## Permissions

Admin and Owner.
