# Business Logic — CSP CRM

This folder is the **single source of truth** for business rules and validation across the CSP CRM platform. It is consumed by AI coding agents (e.g. Claude Code) to (re)build the solution as a **Power Apps Code App** backed by **Dataverse**.

## How to read these files

- One `.md` file per page / process. File naming: `NN-page-name.md` (numbering provides reading order; not significant).
- Cross-entity rules (e.g. a contract creating a timesheet) are documented on **both** sides.
- Field types use Dataverse-friendly naming where possible (`Choice`, `Lookup`, `Decimal`, `DateOnly`, `String`, `Boolean`, `File`).
- All money fields are stored with their `currencyCode` (no implicit conversion).
- All dates are stored as ISO `YYYY-MM-DD` (DateOnly).

## Reference files

- `00-data-model.md` — global enums, lookups, currency map, country/entity rules.
- `Changelog.md` — every change to these specs is logged here. **Every modification must add a Changelog entry.**

## Pages / processes (sidebar order)

| # | File | Route |
|---|------|-------|
| 1 | `01-dashboard.md` (superseded by `26-corporate-actions.md`) | `/` |
| 2 | `02-accounts.md` | `/accounts` |
| 3 | `03-contacts.md` | `/contacts` |
| 4 | `04-contracts.md` | `/contracts` |
| 5 | `05-contract-milestones.md` | `/milestones` |
| 6 | `06-invoices.md` | `/invoices` |
| 7 | `07-expenses.md` | `/expenses` |
| 8 | `08-timesheets.md` | `/timesheets` |
| 9 | `09-leave.md` | `/leave` |
| 10 | `10-dividends.md` | `/dividends` |
| 11 | `11-bank-reconciliation.md` | `/bank-reconciliation` |
| 12 | `12-documents.md` | `/documents` |
| 13 | `13-reports.md` | `/reports` |
| 14 | `14-settings.md` | `/settings` |
| 15 | `15-onboarding-candidates.md` | `/onboarding/candidates` |
| 16 | `16-onboarding-availability.md` | `/onboarding/availability` |
| 17 | `17-onboarding-interviewers.md` | `/onboarding/interviewers` |
| 18 | `18-payment-details.md` | `/metadata/payment-details` |
| 19 | `19-jd-skills.md` | `/metadata/skills` |
| 20 | `20-jd-platforms.md` | `/metadata/platforms` |
| 21 | `21-prospects.md` | `/prospecting/prospects` |
| 22 | `22-prospect-pipeline.md` | (component / view inside Prospects) |
| 23 | `23-prospect-interactions.md` | (sub-table / panel inside Prospects) |
| 24 | `24-opportunities.md` | `/prospecting/opportunities` |
| 25 | `25-contact-cvs.md` | (sub-table / panel inside Contacts) |
| 26 | `26-corporate-actions.md` | `/` (replaces the old Dashboard) |

## Conventions used in every page file

Each page file follows this structure:

1. **Purpose** — what the page does and who uses it.
2. **Primary entity** — Dataverse table backing the page.
3. **Fields** — name · type · required · default · notes.
4. **Validation rules** — synchronous form validations.
5. **Business rules** — derivations, status transitions, side effects.
6. **Filtering / search** — pills, column filters, relative date pills.
7. **Permissions** — Admin vs Owner (see `00-data-model.md`).
8. **Cross-entity effects** — what records are created/updated elsewhere.
