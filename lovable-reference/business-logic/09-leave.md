# 09 — Leave

## Purpose

Track time-off requests for consultants and permanent employees.

## Primary entity: `LeaveRequest`

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | String | yes | `LEA-NNNN` auto |
| `contactId` | Lookup → Contact | yes | must be `Consultant` or `Permanent Employee` |
| `leaveType` | Choice (`LeaveType`) | yes | |
| `startDate` | DateOnly | yes | |
| `endDate` | DateOnly | yes | ≥ startDate |
| `totalDays` | Decimal | derived | working days only (excludes Sat/Sun) |
| `status` | Choice (`LeaveStatus`) | yes | default `Pending` |
| `reason` | String | no | required when `leaveType = Sick Leave` (warn) |
| `clientNotified` | Boolean | yes | default false |

## Validation rules

- `contactId`, `startDate`, `endDate` required.
- `endDate ≥ startDate`.
- Contact must have `contactType ∈ {Consultant, Permanent Employee}`.
- Overlapping leave for the same `contactId` is allowed (warn, not block) to support partial-day or split sick leave.

## Business rules

- **Total working days:** count of weekdays (Mon–Fri) between `startDate` and `endDate` inclusive. Public holidays (`PublicHoliday` records matching contact `country`) should be excluded from `totalDays` — production refinement; prototype uses weekdays only.
- **Status transitions:** `Pending → Approved | Rejected`. Only Admin/Owner can change status.
- **clientNotified flag** is a manual checkbox — Dashboard surfaces upcoming approved leaves where `clientNotified = false`.
- **Leave type `Public Holiday`** is created in bulk by Settings → Holidays import; it is read-only on this page.

## Filters

Pills: Search (name, consultant), Consultant (multi), Leave Type (multi), Status (multi), Start Date (relative), End Date (relative).
