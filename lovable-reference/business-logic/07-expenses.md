# 07 — Expenses

## Purpose

All money out: contractor payments, supplier invoices, taxes, employee salaries, operating costs, software subscriptions.

## Primary entity: `Expense`

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `reference` | String | yes | `EXP-NNN` | |
| `entityId` | Lookup → BusinessEntity | yes | — | |
| `accountId` | Lookup → Account | yes | — | the vendor / payee |
| `expenseType` | Choice (`ExpenseType`) | yes | Supplier Invoice | |
| `relatedInvoiceId` | Lookup → Invoice | no | — | for client-rebill scenarios |
| `contractId` | Lookup → Contract | no | — | required when `expenseType = Contractor Payment` |
| `currencyCode` | Choice | yes | EUR | |
| `totalAmount` | Decimal | yes | — | gross |
| `vatAmount` | Decimal | yes | derived | |
| `netAmount` | Decimal | derived | — | `totalAmount − vatAmount` |
| `ronEquivalent` | Decimal | derived | — | when currency ≠ RON |
| `dateIssued` | DateOnly | yes | — | invoice date from vendor |
| `dueDate` | DateOnly | yes | — | |
| `paymentDate` | DateOnly | no | — | required when `status = Paid` |
| `vendorInvoiceNumber` | String | no | — | vendor's reference |
| `evidenceFile` | File | no | — | PDF receipt/invoice |
| `status` | Choice (`ExpenseStatus`) | yes | Received | |
| `periodMonth`, `periodYear` | Number | yes | from dateIssued | for reporting |

## Validation rules

- Required fields above.
- `totalAmount ≥ 0`; `vatAmount ≥ 0`; `vatAmount ≤ totalAmount`.
- `dueDate ≥ dateIssued`.
- `paymentDate ≥ dateIssued` when set.
- `expenseType = Contractor Payment` ⇒ `contractId` required and `accountId` should reference a `Contractor`-type account.

## Business rules

- **Status transitions:** `Received → Paid`; `Received → Overdue` (auto when `dueDate < today AND status = Received`).
- **Period derivation:** `periodMonth/Year` from `dateIssued` and editable by Admin only.
- **Net amount:** always `totalAmount − vatAmount` (do not allow direct edit of `netAmount`).
- **RON equivalent:** computed when status moves to `Paid`, using `ExchangeRate (currencyCode → RON)` valid for `paymentDate`'s month/year. Snapshot persisted.
- **Contractor payment linkage:** when `expenseType = Contractor Payment` and `contractId` is set, the expense participates in margin calculations for that contract's reporting snapshot.
- **Evidence file** is mandatory for `Supplier Invoice` and `Contractor Payment` before `Paid` (warn, not block in prototype).

## Filters

Pills: Search (reference, vendor, vendor invoice #), Status, Type, Country (multi), Date Issued (relative), Due Date (relative).
Column filters: Reference (text), Vendor (text), Currency (multi), Date Issued (range), Due Date (range), Total (range).
Views: Table, By Vendor, By Type, By Contract.
