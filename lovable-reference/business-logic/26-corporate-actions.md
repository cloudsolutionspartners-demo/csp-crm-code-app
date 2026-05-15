# 26 — Corporate Actions

## Purpose

Landing page (`/`). Replaces the previous KPI dashboard. A Kanban board of **Corporate Actions** — AI-surfaced "things to do" raised autonomously by background agents that scan the system for discrepancies (overdue invoices, missing FX rates, suspected duplicate accounts, etc.). Each card is a single, trackable item that the internal admin works through to keep the operation tidy and to leave an auditable trail of what was done and how.

## Primary entity: `CorporateAction` (`csp_CorporateAction`)

Mirrors the Dataverse table `Corporate Action` in `CSPCRMSolution`.

| Field | Dataverse name | Type | Required | Notes |
|---|---|---|---|---|
| `id` | `csp_CorporateActionId` | Unique identifier | yes | system |
| `actionSummarizedTitle` | `csp_ActionSummarizedTitle` | String | yes | short title shown on the card and in the slide-over header. Authored by the AI agent. |
| `actionDetails` | `csp_ActionDetails` | Multiple lines of text | yes | full AI-written analysis of the issue. **Read-only in the UI** — never editable by end users. |
| `closingComments` | `csp_ClosingComments` | Multiple lines of text | conditional | user notes. Required only when transitioning to `Cancelled` (see business rules). Optional in any other status. |
| `priority` | `csp_Priority` | Choice (`Low` / `Medium` / `High`) | yes | drives the card icon. Choice values: `Low = 725,070,000`, `Medium = 725,070,001`, `High = 725,070,002`. |
| `dueDate` | `csp_Duedate` | DateOnly | no | shown on the card; drives the urgency chip. |
| `status` | `statuscode` | Choice | yes | **`New` → `In Progress` → `Closed`**, plus `Cancelled` from any state. Defaults to `New`. |
| `createdAt` | `CreatedOn` | Date and time | derived | system |
| `modifiedAt` | `ModifiedOn` | Date and time | derived | system; used to determine which Closed items appear on the board (see business rules). |

Standard Dataverse fields (`OwnerId`, `OwningBusinessUnit`, `OwningTeam`, `OwningUser`, `CreatedBy`, `ModifiedBy`, `VersionNumber`, etc.) are present on the table but not surfaced in the UI for the prototype.

## Validation rules

- `actionSummarizedTitle`, `actionDetails`, `priority`, `status` required.
- `actionDetails` **cannot be edited** by the user — the field is rendered read-only in the slide-over and there is no inline editor.
- `closingComments` **must be non-empty** before saving when `status = Cancelled`. In all other statuses it is optional.
- `dueDate` is optional and unconstrained (past/today/future all allowed). The UI colours past-due cards differently but does not block.

## Business rules

### Status transitions

- Any status can move to any other status, with the single restriction above (Cancelled requires Closing Comments).
- Status changes are made from a **sticky pill switcher in the slide-over header**. The change is persisted only when the user clicks **Save**.
- Drag-and-drop on the board moves a card between lanes instantly. Dropping on the **Cancelled** lane without Closing Comments shows an error toast and opens the slide-over so the user can add the comments and Save.

### Closed lane visibility

- The **Closed** lane on the board only displays items whose `modifiedAt` falls in the **current calendar month**. Older Closed items remain in the database (and remain reachable via search / list views in production) but drop off the board to keep it focused on recent work.
- All other lanes (`New`, `In Progress`, `Cancelled`) show every record in that status.

### Priority iconography

The card uses an emoji glyph paired with the priority chip — chosen so the urgency is legible at a glance from across the room:

| Priority | Glyph | Meaning |
|---|---|---|
| Low | 🧊 (cube of ice) | informational, no rush |
| Medium | 🚨 (police siren) | needs attention this week |
| High | 🔥 (fire / flame) | act now |

### Due-date chip

Computed dynamically against the device clock:

- `dueDate < today` and status is `New`/`In Progress` → "Nd overdue" in rose, bold.
- `dueDate = today` → "Due today" in amber, bold.
- `dueDate within next 3 days` → "Due in Nd" in amber.
- otherwise → formatted date in muted grey.
- `Closed` / `Cancelled` cards always show the formatted date in muted grey (urgency no longer relevant).

## UI

### Board

- 4 lanes, fixed order: **New · In Progress · Closed · Cancelled** (matches the `statuscode` option set order). Each lane has a coloured top bar, a count chip, and a drop target.
- Cards show: priority glyph + chip, `actionSummarizedTitle` (clamped to 3 lines), and the due-date chip.
- Drag-and-drop between lanes is enabled. The hovered lane highlights with a primary ring.
- Clicking a card opens the slide-over editor.

### Slide-over editor

- Header: priority glyph, priority chip, `actionSummarizedTitle`, sub-line with due date and creation date.
- **Sticky status switcher** sits directly under the header (a 4-segment pill control mirroring the lane order). The currently active status is highlighted in its lane colour. Clicking `Cancelled` while Closing Comments is empty shows an error toast and refuses the change.
- Body:
  - **Action Details** — read-only block with a lock icon and an "AI generated · read only" annotation. The container is tall (~360px min-height, 60vh max with scroll) so long AI analyses fit without truncation.
  - **Closing Comments** — editable textarea, with a hint that it is required to cancel.
- **Sticky footer**: `Cancel` (discards draft, closes the sheet) and `Save` (commits status + closing comments). `Save` is disabled until the form is dirty, and disabled when the draft status is `Cancelled` with empty Closing Comments.

## Permissions

Admin and Owner can view and edit. There is no public/anonymous access. Standard ownership semantics from Dataverse apply (`OwnerId` is set to the creating service principal for AI-raised records, can be reassigned).

## Cross-entity effects

None at the prototype stage. In production, closing or cancelling a Corporate Action would optionally write back to the source entity (e.g. mark the underlying invoice as "reminder sent") — out of scope for the UX validation prototype.

## Filters

The current prototype renders the full board without filters. Production additions will likely include: `Search` (title, details), `Priority` (multi), `Due date` (relative pills), `Owner` (lookup).
