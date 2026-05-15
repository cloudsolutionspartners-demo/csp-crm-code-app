# 15 — Onboarding · Candidates

## Purpose

Inbound pipeline of people applying to join CSP as B2B contractors or via the CIM-to-B2B path.

## Primary entity: `OnboardingCandidate`

| Field | Type | Required | Notes |
|---|---|---|---|
| `firstName`, `lastName` | String | yes | |
| `email` | Email | yes | unique |
| `phone` | String | no | |
| `path` | Choice (`CandidatePath`) | yes | `CIM to B2B` or `B2B seeking Contracts` |
| `candidateRole` | String | no | Role the candidate is best fit for (free text, e.g. "Senior Power Platform Developer"). Surfaced after the Name in the list view and as an editable field in the form. |
| `cvFileName` | String | yes | display name of the uploaded CV file |
| `cvDocument` (Dataverse: **Candidate CV**) | File | yes | binary CV file stored on the Candidate row. Accepted types: `.pdf`, `.doc`, `.docx`. Uploaded via dropzone on the General tab; previewable in a new browser tab via blob URL (PDFs render inline, Office docs download). Max size follows Dataverse File column default (≤ 32 MB recommended). |
| `hourlyRateEur` | Decimal | yes | desired sell rate |
| `dailyRateEur` | Decimal | derived | computed as `hourlyRateEur * 8`; not stored in Dataverse — display only. |
| `b2bEntityName` | String | conditional | required when `path = B2B seeking Contracts` |
| `selectedSlots` | Array<Lookup→AvailabilitySlot> | yes | candidate-picked slots |
| `confirmedSlotId` | Lookup → AvailabilitySlot | no | set when an interviewer is assigned to one of the selected slots |
| `reviewerNotes` | String (multi) | no | |
| `status` | Choice (`CandidateStatus`) | yes | `Applied → Scheduled → Fit / Not Fit` |
| `source` | Choice (`CandidateSource`) | yes | `Website` (725,070,000), `Recruiter` (725,070,001), `Referral` (725,070,002). Default `Website`. |
| `appliedDate` | DateOnly | yes | default today |
| `reviewedBy` | String | no | reviewer name |
| `createdContactId` | Lookup → Contact | no | populated when approved (Fit) and a Contact is created |
| `createdAccountId` | Lookup → Account | no | populated when approved (Fit) and an Account is created |

## Validation rules

- `firstName`, `lastName`, `email`, `path`, `cvFileName` + `cvDocument`, `hourlyRateEur`, `appliedDate` required.
- `b2bEntityName` required when `path = 'B2B seeking Contracts'`.
- `hourlyRateEur > 0`.
- `email` must be valid email and unique across candidates.

## Business rules

### Status auto-transitions

- When `confirmedSlotId` is set → `status` becomes `Scheduled`.
- When `confirmedSlotId` is cleared and current status is `Scheduled` → revert to `Applied`.
- `Fit` and `Not Fit` are set manually after the interview.

### Approval (`Fit`) → create Contact + Account

When a candidate is marked `Fit`, the user can trigger **Approve & Create**:

1. A `Contact` is created with: name, email, phone, `contactType = Consultant`, `skillset` (optional), `available = true`.
2. An `Account` is created with: `name = b2bEntityName` (or `firstName lastName` for CIM-to-B2B), `accountType = Contractor`, `entityId = default`, `country = candidate country`, `paymentTerms = 30 Days`, `status = Active`.
3. `createdContactId` and `createdAccountId` are populated on the candidate.

`Not Fit` is terminal — no records are created.

### Source & outreach ownership

The `source` choice declares where the candidate came from and who is allowed to talk to them:

- **Website** — candidate came in through our public site. **CSP owns the outreach rights** and may contact the candidate directly.
- **Referral** — internal referral by an existing CSP contact/employee. **CSP owns the outreach rights** and may contact the candidate directly.
- **Recruiter** — candidate was introduced by a third-party recruiter. **CSP must NOT contact the candidate directly.** All outreach (scheduling, follow-ups, offers, rejections) must be routed through the originating recruiter. The form surfaces a warning banner whenever `source = Recruiter`.

Implementation notes:
- Surfaced in the candidate slide-over directly under the navigation tabs as a segmented control (Website / Recruiter / Referral), styled like the Status control on Invoices.
- `source` defaults to `Website` for new candidates.
- Future automations (email sends, calendar invites) must check `source` and block direct-to-candidate sends when `source = Recruiter`.

## Filters

Pills: Search (name, email, B2B entity), Status (default `All`), Path, Source, Applied Date (relative).
Column filters: Name, Role, Email, Source (multi), Path (multi), Hourly Rate (range), Applied Date (range), B2B Entity. Daily Rate column is read-only and not filterable (derive from Hourly Rate).
List columns order: Name, Role, Email, Source, Path, Rate (€/h), Daily Rate (€), B2B Entity, Applied, Status.

Row tinting:
- Applied → muted
- Scheduled → amber
- Fit → emerald
- Not Fit → red

## Bulk action: Send Profiles (Candidate Profiles Request email)

Lets the user email a curated set of candidate profiles (with CVs attached) to a client/contact.

### Entry point
- Button **Send Profiles** rendered in the Candidates list header next to **Add Candidate**.
- Disabled when `selectedIds.length === 0`. Label shows the selection count.

### Compose dialog
| Field | Required | Notes |
|---|---|---|
| To | yes | Single recipient. Free-text email (validated `[^\s@]+@[^\s@]+\.[^\s@]+$`) OR pick from existing `Contact` records. |
| CC | no | Multi recipient. Same input model as To. |
| Subject | yes | Prepopulated with `CSP - Candidate Profiles Request`. |
| Body | yes | Plain text. Prepopulated greeting `Hi <recipient first name>,` (falls back to `Hi there,` when To is empty/multiple) and closing `Best Regards, <Sender Full Name>`. |

### Generated content (auto-appended to email body)
A formatted HTML table is rendered below the user's body text:

| Candidate Name | Role | Rate |
|---|---|---|
| `firstName + " " + lastName` | `candidateRole` (or `—`) | _blank — sender fills manually before sending the deal_ |

Rows are built from the selected candidates. The Rate column is intentionally left empty — the sender quotes commercials offline.

### Attachments
- For every selected candidate where `cvDocument` is populated, the file is attached to the email using `cvFileName` and `cvMimeType`.
- Candidates **without** a CV are still listed in the body table but the dialog shows a non-blocking warning listing each affected candidate's name. Sending is allowed.

### Validation rules
- Cannot send unless **To**, **Subject**, **Body** are non-empty.
- Each typed email must pass basic email format validation before being added as a chip.
- Duplicate addresses are deduped silently.

### Delivery
- Sent via the `send-outlook-email` edge function (Microsoft Graph `/me/sendMail`), which saves a copy in the sender's Sent Items.
- Each attachment forwards its own `contentType` (PDF, DOC, DOCX, etc.).

### Permissions
- Same roles that can read the Candidates list. No additional gating in the prototype.
