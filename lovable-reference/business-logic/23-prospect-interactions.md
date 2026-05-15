# 23 — Prospect Interactions

## Purpose

Activity log of touchpoints (call, email, meeting, LinkedIn) per prospect. Used to compute `lastActivityDate` and aging bucket.

## Primary entity: `ProspectInteraction`

| Field | Type | Required | Notes |
|---|---|---|---|
| `prospectId` | Lookup → Prospect | yes | |
| `type` | Choice (`InteractionType`) | yes | Call, Email, Meeting, LinkedIn |
| `date` | DateOnly | yes | default today |
| `summary` | String (multi) | yes | what was discussed |
| `durationMinutes` | Number | no | for Call / Meeting |
| `createdBy` | String | yes | user display name (auto) |

## Validation rules

- `prospectId`, `type`, `date`, `summary` required.
- `date ≤ today` (cannot log future interactions; use a follow-up task instead).
- `durationMinutes ≥ 0`.

## Business rules

- Adding an interaction recomputes the parent prospect's `lastActivityDate = max(existing, this.date)`.
- Deleting the most recent interaction recomputes `lastActivityDate` accordingly.
- Interactions are immutable after 24 hours (Admin override only) — production refinement.

## Display

- Inside the Prospect slide-over, a tab showing chronological interactions (newest first) with type icon, date, summary, optional duration.
- Standalone page (`/prospecting/interactions` if added) lists all interactions across prospects, with click-through to the parent prospect (opens the prospect's slide-over on the Interactions tab).

## Filters (when shown standalone)

Search (summary, prospect company), Type (multi), Date (relative).
