# 16 — Onboarding · Availability Slots

## Purpose

Time slots proposed by candidates for their interview. Admin/Owner assigns an interviewer to convert a `New` slot into a `Booked` interview.

## Primary entity: `AvailabilitySlot`

| Field | Type | Required | Notes |
|---|---|---|---|
| `candidateId` | Lookup → OnboardingCandidate | yes | |
| `dayOfWeek` | Choice (Monday..Sunday) | yes | derived from `date` |
| `startTime`, `endTime` | Time (HH:mm) | yes | endTime > startTime |
| `date` | DateOnly | yes | future or today |
| `teamsLink` | URL | no | auto-generated when Booked (production) |
| `isActive` | Boolean | yes | default true |
| `status` | Choice (`SlotStatus`) | yes | `New` (default) → `Booked` / `Cancelled` / `Completed` |
| `interviewerId` | Lookup → Contact | conditional | required when `status = Booked` |
| `confirmedAt` | DateOnly | derived | set when status moves to `Booked` |

## Validation rules

- `endTime > startTime` (within the same date).
- `date ≥ today` when status = `New`.
- `interviewerId` must reference a contact with `isInterviewer = true`.
- Selected interviewer must not have another `Booked` slot whose time window overlaps.

## Business rules

- **Status transitions:** `New → Booked → Completed`; `New → Cancelled`; `Booked → Cancelled` (with reason).
- **Confirm slot action** sets `interviewerId`, `status = Booked`, `confirmedAt = today`. Triggers (production):
  - A Teams meeting via Graph API; resulting URL stored in `teamsLink`.
  - Email to candidate + interviewer with the calendar invite.
- **Change interviewer** (only when `status = Booked`): replaces `interviewerId`, keeps `confirmedAt` unchanged, re-issues the invite.
- After the slot date+endTime passes, status auto-moves to `Completed` (nightly job; manual override allowed).

## Cross-entity effects

- A confirmed slot updates the parent candidate's `confirmedSlotId` and bumps candidate `status` to `Scheduled`.

## Filters

Pills: Search (candidate or interviewer name), Status, Day (multi), Date (relative).
