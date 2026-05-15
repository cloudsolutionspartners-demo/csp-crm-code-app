# 12 — Documents

## Purpose

Central document repository — contracts, certificates, NDAs, MSAs, policies, reports — optionally linked to an account.

## Primary entity: `CompanyDocument`

| Field | Type | Required | Notes |
|---|---|---|---|
| `documentName` | String | yes | |
| `documentType` | Choice (`DocumentType`) | yes | Contract, Certificate, Invoice, Policy, Report, Other |
| `relatedAccountId` | Lookup → Account | no | when omitted, treated as company-wide |
| `issuedDate` | DateOnly | no | |
| `expirationDate` | DateOnly | no | |
| `description` | String (multi) | no | |
| `instructions` | String (multi) | no | usage notes |
| `fileName` | String | no | filename of stored blob |

## Validation rules

- `documentName`, `documentType` required.
- `expirationDate ≥ issuedDate` if both set.

## Business rules

- Documents nearing expiration (within 30 days) are surfaced on the Account page and on a dashboard alert (production addition).
- Certificates with no `expirationDate` are treated as perpetual.
- Soft-delete only (Admin can purge).

## Filters

Search (name, description), Type (multi), Account (lookup), Issued Date (relative), Expiration Date (relative).
