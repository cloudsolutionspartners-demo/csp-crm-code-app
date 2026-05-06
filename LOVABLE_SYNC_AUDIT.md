# Lovable Sync Audit — 2026-04-22

## Commits since last sync (last 30)

```
d41ae91 Added delete & timeline UX
14271cd Changes
967d855 Changes
1261c18 Changes
814f9a2 Changes
e5e08dd Restructured materials tab UI
37b97b2 Changes
b09f6e3 Changes
249aaf6 Added material doc upload
0fe0b1b Changes
e104284 Work in progress
02b6ac2 Fixed prospects video path
f43588e Changes
eb37f24 Added Learn How To button
b1ed8a3 Changes
9847249 Fixed missing import for btn
f1bf98a Changes
1f613c8 Added Prospects video tutorial
459f031 Changes
23e3109 Changes
88717d5 Changes
827f015 Changes
3e61534 Changes
1c3a786 Fixed expense editing persistence
21e1613 Changes
a434789 Changes
3b939d9 Simplified leave schedule display
cade69d Changes
5a9dcb1 Refreshed unpaid list on close
27cfaaf Changes
```

## Summary

- **Total files compared**: 92 shared + 11 new in Lovable + 0 removed
- **Files actually changed**: 4 out of 92 shared files
- **New files**: 11 (mostly framework/infra, 2 worth noting)
- **Removed files**: 0

---

## NEW files in Lovable (not in our reference)

| File | Lines | Purpose | Priority |
|------|-------|---------|----------|
| `src/lib/reports-forecast.ts` | 232 | Revenue/profit forecasting engine: month windows, per-country aggregation, margin calculations, forecast with trend extrapolation | **HIGH** |
| `src/lib/format.ts` | 26 | formatCurrency, formatDate, formatPercent, formatNumber — extracted from utils | LOW (we have these in lib/utils.ts already) |
| `src/App.tsx` | 69 | React Router setup — we use PageId navigation, skip | SKIP |
| `src/main.tsx` | 5 | Vite entry point — we have our own | SKIP |
| `src/lib/utils.ts` | 6 | cn() utility only — we have this | SKIP |
| `src/hooks/use-mobile.tsx` | 19 | Mobile breakpoint hook — Lovable infra | SKIP |
| `src/hooks/use-toast.ts` | 186 | Toast hook — we have our own in Layout.tsx | SKIP |
| `src/components/ui/use-toast.ts` | 3 | Re-export of hooks/use-toast | SKIP |
| `src/test/example.test.ts` | 7 | Test scaffold | SKIP |
| `src/test/setup.ts` | 15 | Test setup | SKIP |
| `src/vite-env.d.ts` | 1 | Vite type reference | SKIP |

## REMOVED files (in our reference but not in Lovable)

None. Lovable has not removed any files.

---

## MODIFIED files — grouped by priority

### HIGH priority (likely needs porting to Code App)

#### 1. `src/pages/ProspectsPage.tsx` — +92 / -21 lines
**Tags**: TYPE_FEATURE, TYPE_UI, TYPE_LOGIC

Changes:
- **Delete interactions**: New `deleteInteraction(id)` function + Trash2 icon button on each timeline entry. Users can now remove logged interactions.
- **Delete materials**: New `deleteMaterial(id)` function + Trash2 icon button on each material entry.
- **Material document upload**: New file input with `handleMaterialFile(file)` that reads file as base64 data URL, stores in material state. Materials now have `document`, `documentMimeType`, `documentSize` fields.
- **Download link**: Material file name is now a clickable `<a href={m.document} download={m.fileName}>` link when document is attached.
- **Timeline UX overhaul**: Form layout changed from 3-column to 2-column grid, added "Log a new interaction" header with subtitle, Clear + Add buttons in footer row, disabled Add when summary empty.
- **Materials UX overhaul**: Similar restructure — header with subtitle, Clear + Add buttons, required markers on fields, disabled Add when fileName or document empty.
- **Section headers**: Added count labels "Interactions (N)" and "Shared materials (N)" above the lists.

**Recommendation**: **PORT WHEN TOUCHING** — Our ProspectsPage is local-state only (not Dataverse). The delete buttons and UX improvements are nice-to-have. The document upload is Lovable-specific (base64 in state) and won't map to Dataverse file columns directly.

#### 2. `src/components/invoice/generateInvoicePdf.ts` — +82 / -43 lines
**Tags**: TYPE_LOGIC, TYPE_FEATURE

Changes:
- **Country-specific payment details on PDF**: New `getPaymentLines(entity, invoiceCurrency)` function that renders different bank details per country:
  - Bulgaria: EU bank (IBAN/BIC) by default, UK bank (Account No/Sort Code) when invoice is GBP
  - US: Account No, ACH Routing, Wire Routing, SWIFT
  - Romania/default: IBAN, BIC, Intermediary BIC
- **Dynamic entity header**: Entity details (email, phone) now pulled from entity object instead of hardcoded `expenses.bg@cloudsolutionspartners.com` and phone number
- **Minor**: Removed hardcoded header comment, condensed style objects to single lines

**Recommendation**: **PORT NOW** — This is business logic that directly affects invoice PDFs. Hardcoded email/phone was already flagged as a gap. Multi-country payment details are critical for the UK/US expansion.

#### 3. `src/components/invoice/AccountingMonthEndFlow.tsx` — +3 / -3 lines
**Tags**: TYPE_FIX

Changes:
- Email recipient changed from `entity?.email` to `entity?.accountantEmail` (3 occurrences)
- Error message changed to "No accountant email configured"

**Recommendation**: **PORT NOW** — Bug fix. Month-end emails should go to accountant email, not generic entity email. Quick 3-line change.

#### 4. `src/types/crm.ts` — +4 / -0 lines
**Tags**: TYPE_FIELD

Changes:
- Added to `ProspectMaterial` interface:
  ```
  document?: string;        // base64 data URL
  documentMimeType?: string;
  documentSize?: number;
  ```

**Recommendation**: **PORT WHEN TOUCHING** — Only relevant if we port the material document upload feature from ProspectsPage.

### LOW priority / Skip

No files in this category — the only 4 changed files are all HIGH.

---

## Quick wins (< 20 lines, low risk)

| Change | File | Lines | Effort | Closes gap? |
|--------|------|-------|--------|-------------|
| AccountingMonthEndFlow: email to accountantEmail | AccountingMonthEndFlow.tsx | 3 lines | 2 min | Yes — was using wrong email field |
| generateInvoicePdf: remove hardcoded email/phone | generateInvoicePdf.ts | ~10 lines | 5 min | Yes — CSP_CRM_HANDOVER section 10 noted hardcoded values |
| ProspectsPage: delete interaction/material buttons | ProspectsPage.tsx | ~15 lines | 10 min | Improves UX, no Dataverse impact |

---

## Cross-reference with handover bug list (issues #1-19)

| Handover issue | Addressed by Lovable commits? |
|---|---|
| #1 Fixed expense editing persistence | **YES** — commit `1c3a786` "Fixed expense editing persistence" |
| #2-#19 | No direct matches in commit messages |

The commit `1c3a786` "Fixed expense editing persistence" likely addresses handover issue #1 about expense form data loss. However, we already fixed this independently via the ExpensesPage useMemo dependency fix.

Other notable commits:
- `3b939d9` "Simplified leave schedule display" — may be relevant to LeavePage
- `5a9dcb1` "Refreshed unpaid list on close" — may be an invoice UX fix
- `02b6ac2` "Fixed prospects video path" — tutorial video path fix
