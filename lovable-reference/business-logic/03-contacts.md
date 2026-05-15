# 03 — Contacts

## Purpose

People directory — consultants, client contacts, middlemen, finance contacts, permanent employees, interviewers.

## Primary entity: `Contact`

| Field | Type | Required | Notes |
|---|---|---|---|
| `firstName`, `lastName` | String | yes | |
| `email` | Email | yes | unique recommended |
| `phone` | String | no | |
| `company` | String | no | free-text fallback when no `accountId` |
| `accountId` | Lookup → Account | no | |
| `contactType` | Choice (`ContactType`) | yes | |
| `nationality`, `country` | String | no | |
| `skillset` | Multi-string | no | references `JDSkill` names |
| `jobRole` | String | no | |
| `summary` | String (multi) | no | bio / notes |
| `available` | Boolean | no | available for any engagement |
| `availableForWork` | Boolean | no | actively seeking contracts |
| `isInterviewer` | Boolean | no | enables this contact in `AvailabilityPage` interviewer picker |
| `lastIncreaseDate` | DateOnly | no | for permanent employees |
| `lastIncreaseAmount` | Decimal | no | |
| `cvs` → `csp_ContactCV` | Child collection | no | Library of CV variants for this contact. See `25-contact-cvs.md`. Used as the source list for **CV to apply with** on Opportunity Applicants. |

## Validation rules

- `firstName`, `lastName`, `email`, `contactType` required.
- `email` must be a valid email.
- If `contactType = 'Permanent Employee'`, `accountId` must point to a `BusinessEntity`-owned account (the employer entity).

## Business rules

- A contact can be referenced by **many** contracts (e.g. the same consultant on multiple engagements).
- A contact set as `isInterviewer = true` becomes selectable in `Availability` slot booking.
- Soft-delete only when the contact has no contracts, no leave, no timesheets; otherwise **deactivate** by setting `available = false` (we do not have a status field on contact in the prototype — production should add `Active/Inactive`).
- **Sending profiles**: there is **no** "Send Profiles" action on the Contacts page. A consultant's profile may only be shared with a client through an **Opportunity** (see `24-opportunities.md`) — this guarantees every profile sent is tracked against the deal it was sent for. To put a contact forward, raise an Opportunity from the Opportunities module and add the contact as an Applicant.

## Filters

Search (name, email, company), Contact Type (multi), Country (multi), Available (boolean), Is Interviewer (boolean).
