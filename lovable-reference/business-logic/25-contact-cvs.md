# 25 — Contact CVs

## Purpose

A Contact (consultant) typically has **several CV variations** — one tailored to backend roles, another to data, an English-translated version, a short-form profile, etc. Storing them as a child collection on the Contact lets the user pick the right CV when applying that contact to an Opportunity (the **CV to apply with** field on `csp_OpportunityApplicant`).

## Primary entity: `csp_ContactCV`

| Field | Dataverse column | Type | Notes |
|---|---|---|---|
| CV Name | `csp_ContactCVPrimaryID` | nvarchar | Primary name field — typically the file name (e.g. `JohnDoe_Backend_2026.pdf`). |
| Contact | `csp_Contact` | Lookup → Contact | Parent. Required. |
| Document | `csp_Document` | File | Bytes of the CV file (PDF / DOC / DOCX). |
| Status Reason | `statuscode` | Status | `Active` / `Inactive`. |
| Owner | `OwnerId` | Owner | Standard Dataverse owner. |
| Created On | `CreatedOn` | datetime | System — used as the "uploaded at" timestamp in the UI. |

### Prototype-only fields

The React prototype additionally tracks `label` (free-text shorthand) and `isPrimary` (the default CV when applying). These are **not in Dataverse today**; in production they would either be added as columns on `csp_ContactCV` or implemented as a tag/flag elsewhere. For now they are UI-only conveniences.

## Validation rules

- `csp_Contact` required.
- `csp_Document` required.
- `csp_ContactCVPrimaryID` required (defaults to the uploaded file name).
- Exactly one CV per contact may be marked primary in the UI.

## Business rules

- A Contact can have **N** CVs (1:N from `Contact` to `csp_ContactCV`).
- When an applicant row is created on `csp_OpportunityApplicant` for a Contact, the user picks which Contact CV to apply with from a dropdown of that contact's `csp_ContactCV` rows. The chosen CV's bytes are **copied** onto `csp_OpportunityApplicant.csp_Document` so the historical record of what was sent is preserved even if the contact later updates or deletes the CV.
- Deleting a CV is allowed; it does not affect existing applicant records (because their copy has already been snapshotted).

## UI

- Managed on the **Contact slide-over → CVs tab**: list, upload, rename, mark primary, delete, in-browser preview.
- Selectable on the Opportunity → **Applicants** grid via the **CV to apply with** dropdown.
