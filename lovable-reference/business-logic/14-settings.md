# 14 — Settings

## Purpose

Admin configuration of: business entities (countries), public holidays, units of measure, exchange rates.

## 1) Business Entities (`BusinessEntity`)

See `00-data-model.md` for fields and country-specific bank requirements.

### Editable fields per entity

- General: `name`, `vatNumber`, `registrationNumber`, `address`, `phone`, `email`, `accountantEmail`.
- Invoice: `invoicePrefix`, `invoiceFooter`.
- Bank (always): `bankName`, `iban`, `swift`, `intermediaryBic`.
- Bank (BG only): `ukBankName`, `ukAccountNumber`, `ukSortCode`, `ukIban`, `ukSwift`, `ukIntermediaryBic`.
- Bank (US only): `usAccountNumber`, `usAchRoutingNumber`, `usWireRoutingNumber`.

### Validation

- `iban`, `ukIban` must match IBAN format if set.
- `swift`/`bic` must match BIC format (8 or 11 chars) if set.
- `accountantEmail` must be valid email.
- `country` and `baseCurrencyCode` are read-only after creation (re-keying would invalidate historical data).

## 2) Public Holidays (`PublicHoliday`)

| Field | Type | Required |
|---|---|---|
| `name` | String | yes |
| `date` | DateOnly | yes |
| `country` | Choice (`Country`) | yes |
| `year` | Number | derived from date |

### Rules

- Unique per `(country, date)`.
- Used by Timesheets (no work expected) and Reports (working-day count).
- Bulk import allowed (CSV).

## 3) Units of Measure (system list)

Default values: `Day`, `Hour`, `Month`, `Fixed`. Admin can add additional values; they appear in Contract and Invoice line UoM pickers.

### Rules

- Cannot delete a UoM in use by any contract or invoice line.
- Built-in 4 cannot be renamed.

## 4) Exchange Rates (`ExchangeRate`)

| Field | Type | Required |
|---|---|---|
| `fromCurrencyCode`, `toCurrencyCode` | Choice | yes |
| `rate` | Decimal | yes |
| `effectiveDate` | DateOnly | yes |
| `month`, `year` | Number | derived from effectiveDate |

### Rules

- Unique per `(fromCurrency, toCurrency, month, year)`.
- `rate > 0`.
- Used by:
  - Invoices: snapshot `(currencyCode → RON)` on `Sent`.
  - Expenses: snapshot `(currencyCode → RON)` on `Paid`.
  - Reports: latest rate for the bucket month.
- If no rate exists for the requested period, fall back to the most recent rate before the period (warn).

## Permissions

Admin only.
