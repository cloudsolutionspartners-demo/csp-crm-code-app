# 06 — Invoices

## Purpose

Issued invoices to clients (and credit notes). Drives revenue recognition, AR, and the **Accounting Month End** flow that emails accountants.

## Primary entity: `Invoice` (header) + `InvoiceLine` (lines)

### Invoice fields

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `invoiceNumber` | String | yes | `INV-NNN` | unique within `entityId` (use entity `invoicePrefix` in production) |
| `entityId` | Lookup → BusinessEntity | yes | — | |
| `accountId` | Lookup → Account | yes | — | bill-to |
| `parentAccountId` | Lookup → Account | no | — | when accountId is a child |
| `contractId` | Lookup → Contract | no | — | optional link |
| `currencyCode` | Choice | yes | EUR | |
| `invoiceDate` | DateOnly | yes | — | |
| `dueDate` | DateOnly | yes | derived | `invoiceDate + paymentTerms days` |
| `subtotal` | Decimal | derived | — | sum of line `amount` |
| `vatRate` | Decimal | yes | 19 | percent |
| `vatAmount` | Decimal | derived | — | `subtotal × vatRate / 100` |
| `total` | Decimal | derived | — | `subtotal + vatAmount` |
| `ronConversionRate` | Decimal | no | from ExchangeRate | only persisted when `currencyCode ≠ RON` |
| `ronTotal` | Decimal | no | derived | `total × ronConversionRate` |
| `comments` | String (multi) | no | — | overrides account `invoiceComments` if set |
| `status` | Choice (`InvoiceStatus`) | yes | Draft | |
| `paymentReceivedDate` | DateOnly | no | — | required when `status = Paid` |
| `periodMonth` | Number 1–12 | yes | from invoiceDate | for reporting |
| `periodYear` | Number | yes | from invoiceDate | |

### InvoiceLine fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `invoiceId` | Lookup → Invoice | yes | |
| `name` | String | yes | auto `Line N` if blank |
| `description` | String | no | |
| `quantity` | Decimal | yes | |
| `unitOfMeasure` | Choice | yes | Day/Hour/Month/Fixed |
| `contactId` | Lookup → Contact | no | the consultant being billed |
| `contractId` | Lookup → Contract | no | inherited from header |
| `rate` | Decimal | yes | per UoM |
| `currencyCode` | Choice | yes | inherited from header |
| `amount` | Decimal | derived | `quantity × rate` (or auto-computed from contract sellRate when contract is set: `qty × (sellRate if UoM=Day else sellRate/8 if UoM=Hour)`) |

## Validation rules

- Header: required fields above must be present before status can leave `Draft`.
- At least **one line** is required to send (status `Draft → Sent`).
- `vatRate ≥ 0`. Country-aware defaults: RO 19, BG 20, US 0, UK 20 (override allowed).
- All line `currencyCode` MUST equal header `currencyCode`.
- `paymentReceivedDate ≥ invoiceDate` when `status = Paid`.
- Credit notes (`status = Credit Note`) have negative `total` semantics; the UI displays them with red tint.

## Business rules

- **Status transitions:** `Draft → Sent → Paid` (happy path). `Draft → Cancelled`. `Sent → Overdue` is auto-derived (`dueDate < today AND status = Sent`). `Sent → Credit Note` requires reason; this creates a paired credit note with negative amount.
- **dueDate auto-calc:** `invoiceDate + paymentTerms days` from the account at the moment of creation. Editable.
- **RON conversion:** when invoice currency ≠ RON, on `Sent` we snapshot the latest `ExchangeRate` for `(currencyCode → RON)` valid for the invoice month/year. Both `ronConversionRate` and `ronTotal` become immutable after `Sent`.
- **Comments precedence:** invoice `comments` ∥ account `invoiceComments` ∥ entity `invoiceFooter` (first non-empty wins on the printed PDF).
- **PDF generation:** see `src/components/invoice/generateInvoicePdf.ts`. Header sources entity bank details based on country (EU bank for RO, UK bank for BG when client country = UK, US bank for US).

## Accounting Month End flow

Triggered from the Invoices page header.

1. User selects a period (month + year).
2. System collects all invoices with `periodMonth/periodYear` matching, status in `Sent | Paid | Overdue | Credit Note`.
3. Generates PDFs (one per invoice).
4. Composes a single email to `entity.accountantEmail` (CC user) with all PDFs attached, subject `Month-end accounting pack — <Month YYYY>`.
5. Sends via Outlook (`supabase/functions/send-outlook-email`).
6. On success: toast confirmation. No status change to invoices.

## Send Invoice flow (per invoice or batch)

1. Select one or more `Sent`-ready invoices (status `Draft` allowed; will mark `Sent` on send).
2. Compose email to `account.invoicingEmail` (fallback `account.email`); CC user.
3. Subject default: `Invoice <invoiceNumber> — <entity.shortName>`.
4. Attach generated PDF(s).
5. On send: status → `Sent`; `invoiceDate` defaults to today if blank; `dueDate` recomputed from account `paymentTerms`.

## Cross-entity effects

- Marking line `contactId`/`contractId` does **not** affect the contract; pure reporting link.
- Marking invoice `Paid` triggers nothing automatic (bank reconciliation is a separate manual process).
- Creating a credit note from an existing invoice copies lines with negated `quantity` and links via a `creditNoteOfId` field (production addition; prototype uses status only).

## Filters

Pills: Search, Status, Country, Invoice Date (relative), Due Date (relative).
Column filters: Invoice # (text), Account (text), Currency (multi), Invoice Date (range), Due Date (range), Total (range).
Views: Table, By Account, Monthly Timeline, By Consultant.
