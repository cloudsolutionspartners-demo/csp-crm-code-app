# 18 — Payment Details

## Purpose

Per-account, per-currency bank account details, used for outbound payments to contractors/suppliers and as the bill-to bank on AR invoices when needed.

## Primary entity: `PaymentDetail`

| Field | Type | Required | Notes |
|---|---|---|---|
| `accountId` | Lookup → Account | yes | |
| `currencyCode` | Choice (`CurrencyCode`) | yes | |
| `iban` | String | conditional | required for EUR/GBP/RON |
| `swift` | String | conditional | required for non-domestic transfers |
| `bankName` | String | yes | |
| `isPrimary` | Boolean | yes | default false |

## Validation rules

- `accountId`, `currencyCode`, `bankName` required.
- `iban` format validated for EUR, GBP, RON; US accounts use routing/account numbers (not modelled in `PaymentDetail` — extension field set may be added).
- **Exactly one** `isPrimary = true` per `(accountId, currencyCode)`. Setting `isPrimary` on a new record auto-clears the previous primary in the same scope.

## Business rules

- When generating an Expense or paying a contractor, the system uses the primary `PaymentDetail` for `(accountId, expense.currencyCode)`. If none exists, the user is warned to add one.
- Editing a primary record does not retroactively change historical expenses (which captured the bank details at the time of payment via the evidence file).

## Filters

Account, Currency, Primary only (toggle).
