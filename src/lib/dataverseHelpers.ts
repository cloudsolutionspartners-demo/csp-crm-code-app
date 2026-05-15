/**
 * Defensive lookup-to-GUID resolution. Throws when the lookup record can't be
 * found so the caller never silently saves NULL for a required Dataverse lookup.
 *
 * Previous bug: callers used `.find(...)?.id` which returned `undefined` when
 * seed data was missing → the `@odata.bind` annotation was silently dropped
 * from the OData payload → Dataverse accepted the request with the field as
 * NULL. This helper makes that case loud.
 */
export function resolveLookupId<T extends Record<string, any>>(
  lookups: T[],
  wantedName: string | undefined | null,
  tableLabel: string,
  nameField: keyof T,
  idField: keyof T,
): string {
  if (!wantedName) {
    throw new Error(`${tableLabel} is required but no value was provided`);
  }
  const trimmed = String(wantedName).trim().toLowerCase();
  const match = lookups.find(l =>
    String(l[nameField] || '').trim().toLowerCase() === trimmed,
  );
  if (!match) {
    const available = lookups.map(l => l[nameField]).filter(Boolean).join(', ') || '(none)';
    throw new Error(
      `Cannot save: "${wantedName}" not found in ${tableLabel}. ` +
      `Available values: ${available}. Contact your administrator to seed this lookup table.`,
    );
  }
  return String(match[idField]);
}

/** Resolve a Rate Unit display name → csp_unitofmeasureid */
export function resolveUomId(
  uoms: { id?: string; name?: string; csp_unitofmeasureid?: string; csp_name?: string }[],
  name: string | undefined | null,
): string {
  // Support both the normalised `{id, name}` shape used in the Code App pages
  // AND raw Dataverse rows.
  if (uoms.length === 0) {
    throw new Error(
      'Cannot save: Rate Unit table (csp_unitofmeasures) is empty. ' +
      'Ask an admin to seed at least "Hour" and "Day".',
    );
  }
  const hasNormalised = 'id' in (uoms[0] || {}) && 'name' in (uoms[0] || {});
  return resolveLookupId(
    uoms,
    name,
    'Rate Unit (csp_unitofmeasures)',
    hasNormalised ? 'name' : 'csp_name',
    hasNormalised ? 'id' : 'csp_unitofmeasureid',
  );
}

/**
 * Convert any currency reference (ISO code "EUR" or display name "Euro") to
 * the canonical ISO code used by our dropdowns. Returns the raw input as a
 * fallback if no match. Use this when reading lookup FormattedValues back from
 * Dataverse to populate UI dropdown values.
 */
export function normalizeCurrencyCode(
  currencies: { code?: string; name?: string }[],
  raw: string | undefined | null,
): string {
  if (!raw) return '';
  const t = String(raw).trim().toLowerCase();
  const byCode = currencies.find(c => (c.code || '').toLowerCase() === t);
  if (byCode?.code) return byCode.code;
  const byName = currencies.find(c => (c.name || '').toLowerCase() === t);
  return byName?.code || String(raw);
}

/** Resolve a currency reference (ISO code OR display name) → transactioncurrencyid */
export function resolveCurrencyId(
  currencies: { id?: string; code?: string; name?: string; transactioncurrencyid?: string; isocurrencycode?: string; currencyname?: string }[],
  codeOrName: string | undefined | null,
): string {
  if (currencies.length === 0) {
    throw new Error(
      'Cannot save: transactioncurrencies table is empty. ' +
      'Ask an admin to enable at least one currency.',
    );
  }
  if (!codeOrName) {
    throw new Error('Currency (transactioncurrencies) is required but no value was provided');
  }
  const trimmed = String(codeOrName).trim().toLowerCase();
  // Try ISO code first (the canonical value: "EUR", "USD", ...)
  const byCode = currencies.find(c =>
    String(c.code || c.isocurrencycode || '').trim().toLowerCase() === trimmed,
  );
  if (byCode) return String(byCode.id || byCode.transactioncurrencyid);
  // Fallback: display name ("Euro", "US Dollar", ...) — happens when applicant
  // records are read back from Dataverse where the lookup name is what we have.
  const byName = currencies.find(c =>
    String(c.name || c.currencyname || '').trim().toLowerCase() === trimmed,
  );
  if (byName) return String(byName.id || byName.transactioncurrencyid);
  const available = currencies.map(c => c.code || c.isocurrencycode).filter(Boolean).join(', ') || '(none)';
  throw new Error(
    `Cannot save: "${codeOrName}" not found in Currency (transactioncurrencies). ` +
    `Available values: ${available}. Contact your administrator to seed this lookup table.`,
  );
}
