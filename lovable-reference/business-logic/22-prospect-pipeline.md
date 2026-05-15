# 22 — Prospect Pipeline (Kanban view)

## Purpose

Visual Kanban over `Prospect` records grouped by `status`, with drag-and-drop to move a prospect between stages.

## Stages (columns)

In order:

1. We Reached Out
2. Customer Reached Out
3. Discussing
4. Proposal Sent
5. Won
6. Lost

`New` records appear in the first column (`We Reached Out`) by default, but `New` is a valid pre-stage that the form may persist.

## Card content

(Same as Prospects card — see `21-prospects.md`):
- **Company Name** (bold)
- **Title** (when set)
- Owner avatar + name
- Estimated value (currency)
- Days since last activity (with aging dot)

## Drag-and-drop rules

- Allowed between any active stages and Won/Lost.
- Drop on **Won** → opens Convert dialog.
- Drop on **Lost** → opens dialog asking for `lostReason`.
- On successful drop: `status` updated, `lastActivityDate = today`.
- Dragging is disabled when the user does not have write permission on the prospect.

## Filtering

Same pills as the list view; the Kanban respects the active filters.
