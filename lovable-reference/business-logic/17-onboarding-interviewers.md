# 17 — Onboarding · Interviewers

## Purpose

Read-mostly view of all `Contact`s with `isInterviewer = true`, showing their assigned slots and pending (unassigned) slots.

## Source entities

- `Contact` (filtered: `isInterviewer = true`)
- `AvailabilitySlot`

## Display

For each interviewer:
- Identity card (name, email, phone, country, role).
- List of assigned slots: status (`Booked`, `Completed`), candidate name, date/time, Teams link.
- Pending pool: all slots with `status = New` (unassigned), sortable by date — Admin/Owner can claim a slot for the interviewer.

## Business rules

- Marking an interviewer inactive on this page sets the `Contact.isInterviewer = false`. They no longer appear in the interviewer picker on `AvailabilityPage`.
- Re-activation restores the flag.
- Cannot remove an interviewer with `Booked` future slots; reassign or cancel first.

## Filters

Search (name, email), Role (multi from `jobRole`), Country (multi).

## Permissions

Admin and Owner.
