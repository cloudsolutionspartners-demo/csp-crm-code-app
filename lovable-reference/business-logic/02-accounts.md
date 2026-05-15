# 02 — Accounts

## Purpose

Master list of all companies the business interacts with: clients, contractors, suppliers, recruiter agencies, legal/tax entities. Supports **single-level parent → child** hierarchy.

## Primary entity: `Account`

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | GUID | yes | auto | |
| `accountNumber` | String | yes | manual | unique per entity |
| `name` | String | yes | — | display name |
| `accountType` | Choice (`AccountType`) | yes | Direct Customer | |
| `entityId` | Lookup → BusinessEntity | yes | first entity | scopes data |
| `country` | String | yes | from entity | ISO country name |
| `vatNumber` | String | no | — | required for EU clients (warn) |
| `registrationNumber` | String | no | — | |
| `paymentTerms` | Choice (`PaymentTerms`) | yes | 30 Days | drives invoice `dueDate` |
| `invoiceComments` | String (multi) | no | — | injected into invoice footer |
| `invoicingEmail` | Email | no | — | used by Send Invoice flow |
| `address`, `phone`, `email`, `website` | String | no | — | |
| `status` | Choice (`AccountStatus`) | yes | Active | |
| `activeContracts` | Decimal | derived | — | computed live |
| `sourceProspectId` | Lookup → Prospect | no | — | populated when account is created via Convert from Prospect |
| `parentAccountId` | Lookup → Account | no | — | **single-level only** |
| `primaryContactId` | Lookup → Contact | no | — | shown in Account header |

## Validation rules

- `name`, `accountType`, `entityId`, `country`, `paymentTerms`, `status` are required.
- `email`, `invoicingEmail` must be valid email format if set.
- `website` must be valid URL format if set.
- `parentAccountId` constraints:
  - Cannot equal own `id` (no self-parenting).
  - The chosen parent **must not itself have a `parentAccountId`** (single-level only).
  - An account that is currently a parent (has children) cannot be set as a child of another account.

## Business rules

- **Hierarchy view** — accounts with `parentAccountId == null` render as expandable rows; their children render under them sorted by name.
- **Active contract count** = `count(contracts where parentAccountId = id OR childAccountId = id)`.
- **Status = Inactive** hides the account from default lookup pickers in Contracts/Invoices/Expenses (the form must still allow opening existing references).
- **Convert from Prospect** sets `sourceProspectId` and copies `companyName → name`, `country`, `industry`, `website`, `companySize`. The originating prospect is marked `Won`.
- **Inline contact creation** is allowed from the Account form (modes: `account_contact` or `account_primary_contact`). Creates a `Contact` linked to this account; sets `primaryContactId` when mode = `account_primary_contact`.
- **Inline payment details** can be added per account/currency (see `18-payment-details.md`). Exactly one `PaymentDetail` per `(accountId, currencyCode)` may be marked `isPrimary = true`.

## Tabs in the Account slide-over

1. **Details** — core fields above.
2. **Contacts** — list of contacts where `accountId = this`.
3. **Contracts** — list of contracts where `parentAccountId = this OR childAccountId = this`.
4. **Invoices** — invoices linked to this account.
5. **Documents** — `CompanyDocument` records where `relatedAccountId = this`.
6. **Payment Details** — IBAN/SWIFT records.

## Cross-entity effects

- Deleting an account is blocked if it has any contracts, invoices, expenses, or child accounts. Use **Deactivate** instead.
- `paymentTerms` change applies to **future** invoices only; existing invoices keep the terms snapshot used at issue time (`dueDate` already stored).

## Filters

- Pills: Search, Status (default `Active`), Type, Country (multi).
- Column filters: Name (text), Type (multi), Country (multi), Payment Terms (multi), Active Contracts (number range).
