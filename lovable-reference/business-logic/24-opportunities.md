# 24 — Opportunities

## Purpose

Single place to track every commercial opportunity — i.e. a candidate or an existing consultant being put forward to a client. Captures **who** is being applied, **where** (which client), the **rate position** on both sides, the **applicant lifecycle**, **materials shared**, and the **outcome**.

Lives under **Prospecting → Opportunities**.

## Dataverse model

Three tables back this module:

- `csp_Opportunity` — the opportunity header (one row per opportunity).
- `csp_OpportunityApplicant` — one row per person applied to the opportunity (Candidate **or** Contact). Carries the per-applicant rate, currency, status and the CV used.
- `csp_OpportunityMaterial` — one row per file shared with the client for the opportunity (mirrors Prospect Materials).

### `csp_Opportunity`

| Field | Dataverse column | Type | Notes |
|---|---|---|---|
| Opportunity Number | `csp_OpportunityPrimaryID` | nvarchar | Auto-number `OPP-####`. |
| Source | `csp_Source` | Picklist | **From Existing Client** \| **From Prospect** \| **From New Client** \| **From Existing Consultant**. Drives client linkage. |
| Account | `csp_Account` | Lookup → Account | Set when source = From Existing Client. |
| Prospect | `csp_Prospect` | Lookup → Prospect | Set when source = From Prospect. |
| New Client Name | `csp_NewClientName` | nvarchar | Set when source = From New Client. |
| Contact | `csp_Contact` | Lookup → Contact | Set when source = From Existing Consultant — the consultant who referred the opportunity. |
| Role | `csp_Role` | nvarchar | Role title the opportunity is for. |
| Opportunity Rate | `csp_OpportunityRate` | int | Rate offered to the client (whole numbers). |
| Opportunity Rate Unit | `csp_OpportunityRateUnit` | Lookup | `Hour` or `Day`. |
| Opportunity Currency | `csp_OpportunityCurrency` | Lookup → Currency | |
| Start Date | `csp_StartDate` | datetime | |
| Closing Date | `csp_ClosingDate` | datetime | |
| Details | `csp_OpportunityDetails` | ntext | Long-form description. |
| Outcome Comments | `csp_OutcomeComments` | ntext | |
| Status Reason | `statuscode` | Status | **New → Interview Booked → Won** or **Lost**. |
| Owner | `OwnerId` | Owner | Standard Dataverse owner. |

### `csp_OpportunityApplicant`

One row per applicant. The two lookups are mutually exclusive — exactly one is set.

| Field | Dataverse column | Type | Notes |
|---|---|---|---|
| Opportunity | `csp_Opportunity` | Lookup → Opportunity | Parent. |
| Candidate | `csp_Candidate` | Lookup → Onboarding Candidate | Set when the applicant is a Candidate. |
| Contact | `csp_Contact` | Lookup → Contact | Set when the applicant is an existing consultant. |
| Rate | `csp_Rate` | int | Per-applicant rate (cost side). |
| Rate Unit | `csp_RateUnit` | Lookup | `Hour` or `Day`. |
| Rate Currency | `csp_RateCurrency` | Lookup → Currency | Defaults to the opportunity currency. |
| CV (Document) | `csp_Document` | File | The CV the applicant is applied with — chosen at apply time. For Contacts this is picked from the **Contact CV** library (see `25-contact-cvs.md`); for Candidates it defaults to the candidate's primary CV. |
| Status Reason | `statuscode` | Status | **Drafted → Sent → Accepted** or **Rejected**. Default `Drafted`. |

### `csp_OpportunityMaterial`

| Field | Dataverse column | Type | Notes |
|---|---|---|---|
| Opportunity | `csp_Opportunity` | Lookup → Opportunity | Parent. |
| File Name | `csp_FileName` | nvarchar | |
| Document | `csp_Document` | File | Bytes of the file (base64 in prototype). |
| Description | `csp_Description` | ntext | |
| Shared Date | `csp_SharedDate` | datetime | |

### Derived (never stored)

- **Margin / hour** = `opportunityRate(/h) − rate(/h)` per applicant (Day↔Hour conversion is ×8).
- **Margin / day** = hourly margin × 8.

Margins are shown live in the wizard (Step 4), the Details tab, the Applicants grid and the list view.

## Source values and the **Name** column

The list view shows a single **Name** column that resolves from `Source`:

| Source | Name shown |
|---|---|
| From Prospect | Prospect's company name |
| From Existing Client | Account name |
| From New Client | `csp_NewClientName` (free text) |
| From Existing Consultant | Consultant's full name |

## Applicant lifecycle

`Drafted → Sent → Accepted` or `Rejected`.

- New applicants default to **Drafted**.
- A successful **Send via Outlook** from the Send Profiles dialog flips every applicant on the opportunity from **Drafted → Sent**.
- **Accepted** / **Rejected** are set manually from the Applicants grid on the Opportunity slide-over once the client responds.

### CV to apply with

Per applicant, the user picks which CV to send:

- **Contacts** — the dropdown lists every CV in the contact's **Contact CV** library (`csp_ContactCV`). Defaults to the primary CV. The chosen CV's bytes are copied onto `csp_OpportunityApplicant.csp_Document` so the applicant always retains the exact file that was shared with the client.
- **Candidates** — defaults to the candidate's primary CV; users can override per opportunity.

## Where opportunities are raised

Every entry point uses the **selection-bar pattern** (button greyed out until exactly one row is selected) — identical to Send Profiles on Candidates.

| Page | Seeds | Wizard jumps to |
|---|---|---|
| **Candidates** | candidate, role, rate (as the cost side) | Step 1 (source unknown) |
| **Prospects** | `source = From Prospect`, prospect | Step 3 (Applicants) |
| **Accounts** | `source = From Existing Client`, account | Step 3 (Applicants) |

There is **no Raise Opportunity / Send Profiles entry on the Contacts page** — opportunities involving an existing consultant must be created from the Opportunities module (or auto-created via Send Profiles from Candidates). This guarantees no profile is ever shared without an Opportunity to track it against.

The Opportunities page itself has **Add New Opportunity** (full guided wizard from Step 1) and a secondary **Open Opportunity** action enabled when exactly one row is selected.

### Auto-creation from Candidates → Send Profiles

Each candidate sent through **Send Profiles** automatically gets one Opportunity:

- Source is inferred from the recipient (`To`) email — match against an Account contact → **From Existing Client**; match against a Prospect's primary contact → **From Prospect**; otherwise **From New Client** with the email kept as `csp_NewClientName`.
- One `csp_OpportunityApplicant` is created with `csp_Candidate`, the candidate's role, hourly rate (EUR/Hour) and `Drafted` status.
- `csp_OpportunityRate` is intentionally left blank so the user enters the rate they actually proposed (matches the editable Rate column in the email).
- A toast confirms the count of opportunities created.

## Add Opportunity wizard (6 steps)

Each step has explanatory copy:

1. **Source** — large radio cards explaining the consequence of each of the four source choices.
2. **Client** — Prospect lookup, Account lookup, free-text Client Name, or referring Contact lookup (depending on Step 1).
3. **Applicants** — multi-select Candidates and multi-select Contacts; per-row Rate / Unit / Currency / CV inline.
4. **Role & Rates** — role text, opportunity rate + unit + currency. Live margin preview.
5. **Dates & Details** — start date, closing date, status, long-form details.
6. **Review** — final summary before creation.

## Slide-over (open opportunity)

Tabs:

- **Details** — all editable header fields and live margin.
- **Applicants** — grid of `csp_OpportunityApplicant` rows; inline edit of rate/unit/currency/status/CV; bulk **Send via Outlook** flips all to Sent on success.
- **Materials** — same UX as Prospect Materials (upload, list, preview, delete). Files stored as base64 data URLs in the prototype.
- **Outcome** — status + outcome comments.

## Permissions

Same as Prospects (Admin and Owner can read/write).
