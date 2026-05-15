# 10 — Dividends

## Purpose

Track dividend distributions paid out by each `BusinessEntity`, with tax withheld and supporting AGA (shareholder resolution) document.

## Primary entity: `Dividend`

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | String | yes | `DIV-NNN` |
| `entityId` | Lookup → BusinessEntity | yes | the paying entity |
| `amount` | Decimal | yes | gross |
| `currencyCode` | Choice | yes | usually entity base currency |
| `paymentDate` | DateOnly | yes | |
| `taxWithheld` | Decimal | no | default 0 |
| `documentFile` | File (PDF) | no | AGA / shareholder resolution |

## Validation rules

- Required fields above.
- `amount > 0`.
- `taxWithheld ≥ 0` and `≤ amount`.
- `documentFile` accepts only `application/pdf`.

## Business rules

- Dividends are **immutable** after `paymentDate < today` (Admin override only).
- Net dividend = `amount − taxWithheld`.
- Dividends do not affect P&L (they are below the line) but do affect cash position in Reports.

## Filters

Pills: Search (name, country), Country, Currency (multi), Payment Date (relative).
