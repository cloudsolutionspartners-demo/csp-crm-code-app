# 21 — Prospects

## Purpose

Sales pipeline of opportunities — either **New Business** (brand-new company) or **Existing Account** (new opportunity with a current customer). Convertible into an `Account` + `Contact` on win.

## Primary entity: `Prospect`

| Field | Type | Required | Notes |
|---|---|---|---|
| `prospectNumber` | String | yes | `PRO-NNNN` |
| `kind` | Choice (`ProspectKind`) | yes | `New Business` or `Existing Account` |
| `existingAccountId` | Lookup → Account | conditional | required when `kind = Existing Account` |
| `companyName` | String | yes | for `Existing Account` defaults to the linked account name (read-only) |
| `country` | String | yes | |
| `industry` | String | no | |
| `website` | URL | no | |
| `companySize` | String | no | e.g. "50-200" |
| `ownerContactId` | Lookup → Contact | yes | internal consultant who owns the deal (Consultant or Permanent Employee) |
| `source` | Choice (`ProspectSource`) | yes | Phone, LinkedIn, Email, Internal Referral |
| `referredByContactId` | Lookup → Contact | conditional | required when `source = Internal Referral` |
| `primaryContactName` | String | yes | the prospect-side contact |
| `primaryContactEmail` | Email | yes | |
| `primaryContactPhone` | String | no | |
| `primaryContactRole` | String | no | |
| `prospectingContactId` | Lookup → Contact | conditional | for `kind = Existing Account` — picks an existing client contact instead of typing one |
| `title` | String | no | **opportunity title** — shown on the prospect card to disambiguate multiple deals with the same company |
| `needDescription` | String (multi) | no | |
| `servicesDiscussed` | String (multi) | no | |
| `estimatedValue` | Decimal | no | |
| `currencyCode` | Choice | conditional | required when `estimatedValue` is set |
| `expectedCloseDate` | DateOnly | no | |
| `status` | Choice (`ProspectStatus`) | yes | default `New` |
| `firstContactDate` | DateOnly | yes | default today |
| `lastActivityDate` | DateOnly | derived | max(`firstContactDate`, last interaction date) |
| `lostReason` | String (multi) | conditional | required when `status = Lost` |
| `convertedAccountId` | Lookup → Account | derived | set when converted |
| `convertedContactId` | Lookup → Contact | derived | set when converted |
| `convertedDate` | DateOnly | derived | set when converted |

## Validation rules

- `companyName`, `primaryContactName`, `primaryContactEmail` required (enforced by save).
- `kind = Existing Account` ⇒ `existingAccountId` required.
- `source = Internal Referral` ⇒ `referredByContactId` required.
- `status = Lost` ⇒ `lostReason` required.
- `estimatedValue` and `currencyCode` must both be set or both be empty.
- Email must be a valid email format.

## Business rules

### Status flow

`New → We Reached Out / Customer Reached Out → Discussing → Proposal Sent → Won | Lost`

(Display also accepts legacy values `Contacted` and `Proposal` — they map onto the modern flow.)

- Pipeline view (Kanban) supports drag-and-drop between stages; the moved record's `status` is updated and `lastActivityDate = today`.
- Moving to `Won` opens the **Convert** dialog.
- Moving to `Lost` requires `lostReason`.

### Aging colour bands (row tint on list view)

Reference date = `lastActivityDate ?? firstContactDate`. Active prospects only (excludes Won/Lost).

| Bucket | Days since reference | Tint |
|---|---|---|
| Fresh | ≤ 7 | emerald |
| Active | 8–14 | sky |
| Aging | 15–30 | amber |
| Stalled | 31–60 | orange |
| Cold | > 60 | red |

### Convert flow (`Won`)

1. User clicks **Convert to Account**.
2. Dialog confirms: target `Account` (new vs link to existing), target `Contact` (new vs link), and inherits prospect data.
3. On confirm:
   - `Account` created with `name = companyName`, `country`, `industry`, `website`, `companySize`, `accountType = 'Direct Customer'` (default), `entityId = default`, `paymentTerms = '30 Days'`, `status = 'Active'`, `sourceProspectId = prospect.id`.
   - `Contact` created with prospect-side primary fields, `accountId = newAccount.id`, `contactType = 'Client Contact'`.
   - Prospect: `status = 'Won'`, `convertedAccountId`, `convertedContactId`, `convertedDate = today`.

### Card display

On the prospect card / pipeline lane:
- Line 1: **Company Name**
- Line 2: **Title** (when present, line-clamp-2)
- Line 3+: owner, status, value, last activity

### Sub-collections

- **Interactions** (`ProspectInteraction`) — see `23-prospect-interactions.md`.
- **Materials** (`ProspectMaterial`) — file attachments shared with the prospect.
  - Fields: `prospectId`, `fileName`, `sharedDate`, `description`, `document` (base64/file), `documentMimeType`, `documentSize`.
  - Click on a file opens a browser preview (blob URL from base64). Mock materials without a file render an HTML preview page with metadata.

## Filters

Pills: Search (company, contact name, email), Status (default `All`), Kind (`All / New Business / Existing Account`), Conversion (`All / Converted / Not Converted`).
Column filters: Company (text), Owner (multi), Source (multi), Status (multi), Value (range).
