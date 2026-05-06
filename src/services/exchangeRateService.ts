import { listRecords, createRecord, updateRecord, deleteRecord } from './dataverseService';
import { currencyGuidToCode, currencyCodeToGuid } from './currencyMap';
import type { ExchangeRate, CurrencyCode } from '../types/crm';

function norm(val: any): string {
  if (!val) return '';
  return String(val).replace(/[{}]/g, '').toLowerCase();
}
function isGuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

const SOURCE_REVERSE: Record<number, string> = {
  770400000: 'BNR',
  770400001: 'ECB',
  770400002: 'Manual',
};
const SOURCE_FORWARD: Record<string, number> = {
  BNR: 770400000,
  ECB: 770400001,
  Manual: 770400002,
};

function mapFromDataverse(r: any): ExchangeRate {
  const dateStr = r.csp_effectivedate ? r.csp_effectivedate.substring(0, 10) : '';
  return {
    id: norm(r.csp_exchangerateid),
    fromCurrencyCode: (currencyGuidToCode(norm(r._csp_fromcurrency_value)) || 'EUR') as CurrencyCode,
    toCurrencyCode: (currencyGuidToCode(norm(r._csp_tocurrency_value)) || 'RON') as CurrencyCode,
    rate: r.csp_rate ?? 0,
    effectiveDate: dateStr,
    month: r.csp_month ?? (dateStr ? new Date(dateStr).getMonth() + 1 : 0),
    year: r.csp_year ?? (dateStr ? new Date(dateStr).getFullYear() : 0),
  };
}

function mapToDataverse(data: Record<string, any>): any {
  const record: any = {};
  if (data.name !== undefined) record.csp_name = data.name;
  if (data.rate !== undefined) record.csp_rate = Number(data.rate) || null;
  if (data.effectiveDate !== undefined) record.csp_effectivedate = data.effectiveDate || null;
  if (data.month !== undefined) record.csp_month = Number(data.month) || null;
  if (data.year !== undefined) record.csp_year = Number(data.year) || null;
  if (data.source !== undefined) {
    const code = SOURCE_FORWARD[data.source];
    if (code !== undefined) record.csp_source = code;
  }
  // Currency lookups
  if (data.fromCurrencyCode) {
    const guid = currencyCodeToGuid(data.fromCurrencyCode);
    if (guid) record['csp_fromcurrency@odata.bind'] = `/transactioncurrencies(${guid})`;
  }
  if (data.toCurrencyCode) {
    const guid = currencyCodeToGuid(data.toCurrencyCode);
    if (guid) record['csp_tocurrency@odata.bind'] = `/transactioncurrencies(${guid})`;
  }
  return record;
}

const SELECT = 'csp_exchangerateid,csp_name,csp_rate,csp_effectivedate,csp_month,csp_year,csp_source,_csp_fromcurrency_value,_csp_tocurrency_value,statecode,statuscode,createdon';

export async function fetchExchangeRates(): Promise<ExchangeRate[]> {
  const records = await listRecords('csp_exchangerates', SELECT, undefined, 'csp_effectivedate desc');
  return records.map(mapFromDataverse);
}

export async function saveExchangeRate(data: Record<string, any>, existingId?: string): Promise<string> {
  const mapped = mapToDataverse(data);
  if (existingId && isGuid(existingId)) {
    await updateRecord('csp_exchangerates', existingId, mapped);
    return existingId;
  }
  return await createRecord('csp_exchangerates', mapped);
}

export async function removeExchangeRate(id: string): Promise<void> {
  await deleteRecord('csp_exchangerates', id);
}
