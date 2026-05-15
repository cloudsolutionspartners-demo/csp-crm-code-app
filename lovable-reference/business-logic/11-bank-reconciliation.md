# 11 — Bank Reconciliation

## Purpose

Match imported bank statement lines to invoices (AR) and expenses (AP). Provides smart-match suggestions and manual override.

## Primary entities

### `BankStatement`
| Field | Type | Notes |
|---|---|---|
| `entityId` | Lookup → BusinessEntity | |
| `periodStart`, `periodEnd` | DateOnly | inclusive |
| `lines` | Array<BankStatementLine> | |

### `BankStatementLine`
| Field | Type | Notes |
|---|---|---|
| `transactionDate` | DateOnly | |
| `reference` | String | bank-side reference |
| `debit`, `credit` | Decimal | exactly one is non-null |
| `matchedInvoiceId` | Lookup → Invoice | when credit |
| `matchedExpenseId` | Lookup → Expense | when debit |
| `explanation` | String | manual note |
| `reconciled` | Boolean | true once matched and confirmed |

## Validation rules

- A line has either `debit > 0` or `credit > 0`, never both.
- `matchedInvoiceId` only allowed when line is a credit (money in).
- `matchedExpenseId` only allowed when line is a debit (money out).
- A line cannot have both `matchedInvoiceId` and `matchedExpenseId`.

## Business rules

- **Smart match algorithm (suggestion only):**
  - For credits: candidate invoices = `status ∈ {Sent, Overdue}`, `currencyCode = entity base or ron`, `total` within ±0.01 of credit amount, `dueDate ± 30 days` of `transactionDate`. Highest scoring match auto-suggested.
  - For debits: candidate expenses = `status ∈ {Received, Overdue}`, similar amount/date heuristic.
  - Confidence > 90% may auto-link with `reconciled = true`. Lower confidence suggests but requires user click.
- Confirming a match: sets `reconciled = true` AND, for credits, sets the invoice `status = Paid` with `paymentReceivedDate = transactionDate`. For debits, sets expense `status = Paid` with `paymentDate = transactionDate`.
- **Match percentage** shown in summary: `matched / total lines × 100`.

## UI

- Left panel: list of statements, click to switch.
- Right panel: lines table with match status.
- Top KPIs: total credits, total debits, matched %, unmatched count.
- Header action: **Smart Match** runs the algorithm across all unmatched lines in the current statement.
