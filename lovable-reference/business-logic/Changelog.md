# Changelog

All notable changes to the **Business Logic** specifications are recorded here. Each entry must include date, author/source, affected file(s), and a short description of what changed and why.

Format:
```
## YYYY-MM-DD — <short title>
**Files:** `path/to/file.md`, ...
**Author:** <name or "Lovable AI">
**Type:** Added | Changed | Removed | Clarified

- Bullet describing the change.
- Reason / context.
```

---

## 2026-05-15 — Corporate Actions board replaces the Dashboard
**Files:** `Business Logic/26-corporate-actions.md`, `Business Logic/01-dashboard.md`, `Business Logic/README.md`, `src/types/crm.ts`, `src/data/mock-data.ts`, `src/pages/Dashboard.tsx`, `src/components/AppSidebar.tsx`
**Author:** Lovable AI
**Type:** Added

- New Dataverse-backed entity **`csp_CorporateAction`** (`Corporate Action` in `CSPCRMSolution`) with fields: `csp_ActionSummarizedTitle`, `csp_ActionDetails` (read-only to end users), `csp_ClosingComments`, `csp_Priority` (Low / Medium / High — Choice values 725,070,000 / 001 / 002), `csp_Duedate`, `statuscode` (New / In Progress / Closed / Cancelled). Spec lives in `Business Logic/26-corporate-actions.md`.
- The landing page (`/`) is renamed from **Dashboard** to **Corporate Actions** in the sidebar and is rebuilt as a 4-lane Kanban board (lanes = `statuscode` options, fixed order). The previous KPI/charts dashboard is removed.
- Card layout shows the summarized title, the priority paired with a glyph (🧊 Low / 🚨 Medium / 🔥 High) and the due date with dynamic urgency styling (overdue, due today, due in ≤3 days, otherwise neutral).
- Drag-and-drop moves a card between lanes. The **Cancelled** lane refuses drops without Closing Comments — the slide-over opens with a toast prompting the user to fill them in and Save.
- The **Closed** lane only lists items whose `ModifiedOn` is in the current calendar month so the board stays focused on recent work.
- Slide-over editor: read-only Action Details block (~2.5× taller than the default with internal scroll for long AI analyses), editable Closing Comments, **sticky 4-segment status switcher in the header** mirroring the lane order, and a sticky footer with **Cancel** (discard draft) and **Save** (commit status + comments). `Save` is disabled while the form is clean or while the draft is `Cancelled` with empty Closing Comments.
- Validation: end users can never edit `csp_ActionDetails`. `csp_ClosingComments` is required only when transitioning to `Cancelled`.

---


**Files:** `Business Logic/25-contact-cvs.md`, `Business Logic/03-contacts.md`, `Business Logic/README.md`, `src/types/crm.ts`
**Author:** Lovable AI
**Type:** Added

- New Dataverse table **`csp_ContactCV`** holding the library of CV variants per Contact (1:N from Contact). Columns: `csp_ContactCVPrimaryID` (CV name), `csp_Contact` (parent), `csp_Document` (file), standard `statecode`/`statuscode`, `OwnerId`, `CreatedOn`.
- Used as the source list for **CV to apply with** on `csp_OpportunityApplicant`. When an applicant is added/edited, the chosen CV's bytes are **copied** onto the applicant's `csp_Document` so the historical record of what was sent to the client is preserved.
- Prototype keeps `label` and `isPrimary` as UI-only conveniences (not in Dataverse today).

---

## 2026-05-13 — Opportunities module (consolidated)
**Files:** `Business Logic/24-opportunities.md`, `Business Logic/03-contacts.md`, `Business Logic/15-onboarding-candidates.md`, `Business Logic/README.md`, `src/types/crm.ts`, `src/data/mock-data.ts`, `src/pages/OpportunitiesPage.tsx`, `src/pages/CandidatesPage.tsx`, `src/pages/ProspectsPage.tsx`, `src/pages/AccountsPage.tsx`, `src/pages/ContactsPage.tsx`, `src/components/opportunity/AddOpportunityWizard.tsx`, `src/components/opportunity/SendOpportunityProfilesDialog.tsx`, `src/components/opportunity/RaiseOpportunityForm.tsx`, `src/components/candidate/SendCandidateProfilesDialog.tsx`, `src/components/AppSidebar.tsx`, `src/App.tsx`
**Author:** Lovable AI
**Type:** Added

This single entry supersedes earlier per-iteration Opportunities entries and captures the module end-to-end as it stands today, mapped against the Dataverse schema (`csp_Opportunity`, `csp_OpportunityApplicant`, `csp_OpportunityMaterial`).

- **`csp_Opportunity` header** with: `csp_Source` (**From Existing Client / From Prospect / From New Client / From Existing Consultant** — value renamed in the prototype from `From Contact` to match Dataverse exactly), client linkage (`csp_Account` / `csp_Prospect` / `csp_NewClientName` / `csp_Contact`), `csp_Role`, `csp_OpportunityRate` + `csp_OpportunityRateUnit` + `csp_OpportunityCurrency`, `csp_StartDate`, `csp_ClosingDate`, `csp_OpportunityDetails`, `csp_OutcomeComments`, `statuscode` **New → Interview Booked → Won/Lost**.
- **`csp_OpportunityApplicant`** child rows — one per person applied (Candidate **or** Contact, mutually exclusive). Carries per-applicant `csp_Rate` + `csp_RateUnit` + `csp_RateCurrency`, the applied `csp_Document` (CV), and **`statuscode` Drafted → Sent → Accepted/Rejected** (default `Drafted`).
- **`csp_OpportunityMaterial`** child rows — same UX as Prospect Materials (file + sharedDate + description; base64 in prototype).
- **List view "Name" column** — single column resolved from Source: Prospect name / Account name / New Client name / Consultant name (column was renamed from "Client").
- **Send via Outlook flips applicants** — on a successful send through the Send Opportunity Profiles dialog, every applicant on the opportunity is moved from **Drafted → Sent**.
- **CV to apply with** — for Contact applicants the dropdown lists the contact's `csp_ContactCV` library (see new entry above); for Candidate applicants it defaults to the candidate's primary CV with per-opportunity override. The chosen CV's bytes are copied onto `csp_OpportunityApplicant.csp_Document`.
- **Send Profiles removed from Contacts page** — the standalone "Send Profiles" action on the Contacts list (and its dialog `SendContactProfilesDialog.tsx`) was deleted. A consultant's profile may now only be shared via an Opportunity, so every profile sent is tied to the deal it was sent for. Updated `Business Logic/03-contacts.md` accordingly.
- **Auto-creation from Candidates → Send Profiles** — one Opportunity per candidate sent. Source is inferred from the To address (Account contact → From Existing Client; Prospect primary contact → From Prospect; otherwise From New Client with the email kept as `csp_NewClientName`). Candidate role + rate seed the applicant; `csp_OpportunityRate` is left blank for the user to fill.
- **Raise Opportunity entry points** — Candidates / Prospects / Accounts use the same selection-bar pattern as Send Profiles (greyed until a single row is selected). Each preseeds the wizard and skips steps it can resolve. **Contacts has no Raise Opportunity button** by design.
- **Add New Opportunity wizard** — 6 steps with explanatory copy: Source → Client → Applicants → Role & Rates (live margin) → Dates & Details → Review.
- **Slide-over tabs** — Details / Applicants (inline rate, currency, status, CV editing) / Materials / Outcome.
- **Margin** is computed live (per-applicant hourly + daily) from `csp_OpportunityRate` vs each applicant's `csp_Rate` using a ×8 Day↔Hour conversion. Never stored.

---

## 2026-05-13 — Send Candidate Profiles to Client (bulk email via Outlook)
**Files:** `Business Logic/15-onboarding-candidates.md`, `supabase/functions/send-outlook-email/index.ts`, `src/components/candidate/SendCandidateProfilesDialog.tsx`
**Author:** Lovable AI
**Type:** Added

- New bulk action **Send Profiles** appears next to **Add Candidate** on the Candidates list, enabled when ≥1 row is selected.
- Opens a dialog showing the selected candidates with a per-row **CV attached / No CV** badge and a summary warning when any candidate is missing a `cvDocument`.
- Email composer fields:
  - **To** (required, single recipient) and **CC** (optional, multi). Both accept free-text emails (Enter / comma to add) or selection from existing Contacts via a "Pick contact" popover. Invalid emails are rejected with a toast.
  - **Subject** (required), prepopulated with `CSP - Candidate Profiles Request`.
  - **Body** (required) is a rich, in-place WYSIWYG editor (`contentEditable`) prepopulated on open with: greeting `Hi <First Name>,` (auto-updates from To when a single contact is selected), an intro line, the candidate table, a closing line, and `Best Regards, <Sender Full Name>`.
- The candidate table is **inserted directly into the editable body** (not appended at send time). Columns: **Candidate Name**, **Role** (from `candidateRole`), **Rate** (intentionally blank). Every cell — including Rate — is editable in place before sending; users can also edit any surrounding text.
- **Delivery via Microsoft Outlook connector**: the dialog calls the `send-outlook-email` edge function, which posts to Microsoft Graph `POST /me/sendMail` through the Lovable Outlook connector gateway with `saveToSentItems: true`. The email is sent from the connected Outlook mailbox and the full message (body, table, attachments, To/CC) is stored in the sender's **Sent Items** in Outlook.
- Available CVs are attached using each candidate's `cvDocument` (base64) and `cvMimeType` (each attachment's content type is honored — PDF, DOC, DOCX, etc.). Candidates without a CV are flagged in the dialog but do not block sending; their row still appears in the email table, just with no attachment.

---

## 2026-05-13 — Candidate CV file upload + in-browser preview
**Files:** `Business Logic/15-onboarding-candidates.md`
**Author:** Lovable AI
**Type:** Added

- Candidate form now exposes a file dropzone for the **Candidate CV** Dataverse File column (`cvDocument`). Accepts `.pdf`, `.doc`, `.docx`. Replicates the Expenses evidence upload UX.
- Uploaded CV can be previewed in a separate browser tab via blob URL (PDFs render inline; Word docs download).
- `cvFileName` documented as the display label, `cvDocument` as the binary File column. Both are required for a complete candidate record.

---

## 2026-05-13 — Candidates: Source pill filter + Source column in list view
**Files:** `Business Logic/15-onboarding-candidates.md`
**Author:** Lovable AI
**Type:** Added

- Added a **Source** pill filter (single-select: Website / Recruiter / Referral) to the Candidates list, alongside Status, Path and Applied Date.
- Added a **Source** column in the Candidates table view between Email and Path, with a multi-select column filter.
- Updated `Business Logic/15-onboarding-candidates.md` Filters section to document the new pill, column filter, and column order.
- Prototype updates: `src/pages/CandidatesPage.tsx` (new state, pill, chip, column, multi-filter and useMemo dep).

---

## 2026-05-13 — Candidate `candidateRole` + derived Daily Rate column
**Files:** `Business Logic/15-onboarding-candidates.md`
**Author:** Lovable AI
**Type:** Added

- Added `candidateRole` String column on `OnboardingCandidate` capturing the role the candidate is best fit for (free text).
- List view now shows the role immediately after the Name column, and a new **Daily Rate (€)** column after Rate computed as `hourlyRateEur * 8` (display-only, not stored).
- Form exposes `candidateRole` as an editable text field on the General tab; Daily Rate is shown as a read-only derived field next to Hourly Rate.
- Prototype updates: `src/types/crm.ts` (added `candidateRole?: string`), `src/pages/CandidatesPage.tsx` (column, filter, form field, derived Daily Rate).

---

## 2026-05-13 — Candidate `source` field added
**Files:** `Business Logic/15-onboarding-candidates.md`
**Author:** Lovable AI
**Type:** Added

- Added `source` Choice column on `OnboardingCandidate` with values `Website` (725,070,000), `Recruiter` (725,070,001), `Referral` (725,070,002). Default `Website`.
- Documented outreach ownership rules: `Website` and `Referral` candidates are owned by CSP (direct contact allowed). `Recruiter` candidates must only be contacted via the originating recruiter — all direct outreach is forbidden.
- UI: rendered as a segmented control directly under the navigation tabs in the candidate slide-over (mirrors the Invoices Status control). Recruiter selection shows an inline warning.
- Prototype updates: `src/types/crm.ts` (added `CandidateSource` type and field), `src/pages/CandidatesPage.tsx` (toggle group, default `Website`, warning when `Recruiter`).

---

## 2026-05-12 — Initial business-logic baseline created
**Files:** all files in `Business Logic/`
**Author:** Lovable AI (generated from current React prototype)
**Type:** Added

- Created `Business Logic/` folder with one Markdown file per page/process of the CSP CRM platform.
- Added `README.md` (index + conventions) and `Changelog.md` (this file).
- Added `00-data-model.md` with global enums, currency map, country/entity rules.
- Documented all 23 pages and their validation rules, derivations, status transitions, and cross-entity effects.
- Source of truth: React prototype (`src/pages/*.tsx`, `src/types/crm.ts`, `src/data/mock-data.ts`) as of 2026-05-12.
