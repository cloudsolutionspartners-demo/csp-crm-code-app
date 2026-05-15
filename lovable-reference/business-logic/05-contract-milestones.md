# 05 — Contract Milestones

## Purpose

Milestone-based revenue recognition for Fixed Price contracts. Each milestone represents a deliverable that, once invoiced, generates an invoice line.

## Primary entity: `ContractMilestone`

| Field | Type | Required | Notes |
|---|---|---|---|
| `milestoneId` | String | yes | `MS-NNN` |
| `contractId` | Lookup → Contract | yes | must have `hasMilestones = true` |
| `description` | String | yes | |
| `value` | Decimal | yes | |
| `currencyCode` | Choice | yes | should match contract `sellCurrency` (warn if not) |
| `startDate`, `endDate` | DateOnly | yes | endDate ≥ startDate |
| `status` | Choice (`MilestoneStatus`) | yes | default `Pending` |

## Validation rules

- All required fields present.
- `endDate ≥ startDate`.
- Sum of milestone `value` should not exceed contract `grossValue` (warn, not block).

## Business rules

- **Status transitions:** `Pending → Invoiced → Paid`. No skipping; no reversing without admin override.
- Marking `Invoiced` requires linking an invoice line (or implicitly via the Send Invoice flow). Marking `Paid` requires the linked invoice to be `Paid`.
- Only contracts with `hasMilestones = true` are pickable in the form.
- Deletion allowed only when `status = Pending`.

## Filters

Search (milestone id, description, contract #), Status, Start Date (relative), End Date (relative). Column filters on Milestone Id, Description, Contract #, Value (range).
