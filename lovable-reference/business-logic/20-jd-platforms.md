# 20 — JD Platforms

## Purpose

Catalogue of platforms / tech stacks referenced by Job Descriptions and Contracts. Mirrors the JD Skills structure.

## Primary entity: `JDPlatform`

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | String | yes | unique, case-insensitive |
| `description` | String (multi) | yes | |
| `definedByAI` | Boolean | yes | default false |

## Validation rules

- `name`, `description` required.
- `name` unique (trim whitespace).

## Business rules

- Same AI-curation lifecycle as `JDSkill`.
- Cannot delete when referenced.

## Filters

Search (name, description), Defined By AI.
