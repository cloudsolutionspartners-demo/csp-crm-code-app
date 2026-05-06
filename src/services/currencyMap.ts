// Dynamic currency GUID <-> code mapping — fetched from Dataverse at runtime
// No hardcoded GUIDs — works across all environments

import { listRecords } from './dataverseService';

let _codeToGuid: Record<string, string> = {};
let _guidToCode: Record<string, string> = {};
let _guidToSymbol: Record<string, string> = {};
let _loaded = false;
let _loading: Promise<void> | null = null;

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}

async function loadCurrencies(): Promise<void> {
  if (_loaded) return;
  try {
    const records = await listRecords(
      'transactioncurrencies',
      'transactioncurrencyid,isocurrencycode,currencysymbol,currencyname',
      undefined,
      'isocurrencycode asc',
    );
    const codeToGuid: Record<string, string> = {};
    const guidToCode: Record<string, string> = {};
    const guidToSymbol: Record<string, string> = {};
    for (const r of records) {
      const id = norm(r.transactioncurrencyid);
      const code = (r.isocurrencycode || '').toUpperCase();
      const symbol = r.currencysymbol || code;
      if (id && code) {
        codeToGuid[code] = id;
        guidToCode[id] = code;
        guidToSymbol[id] = symbol;
      }
    }
    _codeToGuid = codeToGuid;
    _guidToCode = guidToCode;
    _guidToSymbol = guidToSymbol;
    _loaded = true;
    console.log(`[Currency] Loaded ${records.length} currencies:`, Object.keys(codeToGuid).join(', '));
  } catch (err) {
    console.error('[Currency] Failed to load currencies:', err);
  }
}

// Initialize — call once at app startup
export async function initCurrencies(): Promise<void> {
  if (!_loading) {
    _loading = loadCurrencies();
  }
  return _loading;
}

// Get currency code from GUID (e.g., "guid" → "EUR")
export function currencyGuidToCode(guid: any): string {
  if (!guid) return 'EUR';
  const normalized = norm(guid);
  return _guidToCode[normalized] || 'EUR';
}

// Get GUID from currency code (e.g., "EUR" → "guid")
export function currencyCodeToGuid(code: string): string | undefined {
  return _codeToGuid[code];
}

// Get currency symbol from GUID (e.g., "guid" → "€")
export function currencyGuidToSymbol(guid: any): string {
  if (!guid) return '€';
  return _guidToSymbol[norm(guid)] || '€';
}

// Check if currencies are loaded
export function areCurrenciesLoaded(): boolean {
  return _loaded;
}
