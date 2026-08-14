import type { SupabaseClient } from '@supabase/supabase-js';

// MEB (Millî Eğitim Bakanlığı) okul dizinini (https://www.meb.gov.tr/baglantilar/okullar/index.php)
// çeker, il/ilçe/okul adını ayrıştırır, cities/districts ile eşleştirir ve public.schools
// tablosuna (bkz. supabase/schools_table.sql) upsert eder. Admin panelindeki "Okulları
// Güncelle" butonu tarafından çağrılır (bkz. app/api/admin/manage/schools-sync/route.ts).
// Yılda birkaç kez elle tetiklenmesi yeterlidir; işlem idempotenttir (meb_kurum_kodu
// üzerinden merge-duplicates ile upsert), tekrar çalıştırmak güvenlidir.

const MEB_AJAX_URL = 'https://www.meb.gov.tr/baglantilar/okullar/okullar_ajax.php';
const PAGE_SIZE = 1000;
const UPSERT_CHUNK = 1000;

const TYPE_KEYWORDS: [string, string][] = [
  ['anaokulu', 'ANAOKUL'],
  ['ilkokul', 'İLKOKUL'],
  ['ortaokul', 'ORTAOKUL'],
  ['lise', 'LİSE'],
];

// MEB verisinde bazı iller resmi/tam adından farklı, kısaltılmış ya da eski isimle geçiyor.
const CITY_ALIASES: Record<string, string> = {
  AFYON: 'AFYONKARAHISAR',
  ICEL: 'MERSIN',
  MARAS: 'KAHRAMANMARAS',
  URFA: 'SANLIURFA',
};

// MEB verisinde bazı ilçeler yazım hatası, eski ad ya da gayriresmi ön ekle geçiyor.
// Anahtar: "<normalize edilmiş il>::<MEB'deki normalize edilmiş ilçe>"
const DISTRICT_ALIASES: Record<string, string> = {
  'AGRI::DOGUBEYAZIT': 'DOGUBAYAZIT',
  'MALATYA::POTURGE': 'PUTURGE',
  'KAHRAMANMARAS::CAGLIYANCERIT': 'CAGLAYANCERIT',
  'ANKARA::KAHRAMANKAZAN': 'KAZAN',
  'ISTANBUL::EYUPSULTAN': 'EYUP',
};

function classifyType(name: string): string | null {
  const upper = name.toLocaleUpperCase('tr-TR');
  for (const [type, keyword] of TYPE_KEYWORDS) {
    if (upper.includes(keyword)) return type;
  }
  return null;
}

// Şehir/ilçe adlarını karşılaştırmak için tüm Türkçe özel karakterleri (dotlu İ, şapkalı
// â/î/û, ç/ş/ğ/ö/ü) ASCII eşdeğerine indirger; MEB verisinde bunlar tutarsız kullanılıyor.
function normalizeName(s: string | null | undefined): string {
  return (s || '')
    .trim()
    .toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/Â/g, 'A')
    .replace(/Î/g, 'I')
    .replace(/Û/g, 'U')
    .replace(/Ç/g, 'C')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ö/g, 'O')
    .replace(/Ü/g, 'U')
    .replace(/\s+/g, '');
}

function parseOkulAdi(raw: string): { il: string; ilce: string; name: string } | null {
  const idx1 = raw.indexOf(' - ');
  if (idx1 === -1) return null;
  const il = raw.slice(0, idx1);
  const rest = raw.slice(idx1 + 3);
  const idx2 = rest.indexOf(' - ');
  if (idx2 === -1) return null;
  const ilce = rest.slice(0, idx2);
  const name = rest.slice(idx2 + 3).trim();
  return { il, ilce, name };
}

function extractKurumKodu(yol: unknown): string | null {
  if (!yol) return null;
  const parts = String(yol).split('/');
  return parts[parts.length - 1] || null;
}

type MebRow = { OKUL_ADI?: string; HOST?: string; YOL?: string };
type MebResponse = { data?: MebRow[]; recordsTotal?: string | number };

async function fetchMebPage(start: number, length: number): Promise<MebResponse> {
  const body = new URLSearchParams({
    draw: '1',
    start: String(start),
    length: String(length),
    'search[value]': '',
    'order[0][column]': '0',
    'order[0][dir]': 'asc',
    'columns[0][data]': 'OKUL_ADI',
    il: '0',
    ilce: '0',
  });

  const res = await fetch(MEB_AJAX_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: 'https://www.meb.gov.tr/baglantilar/okullar/index.php',
      'User-Agent': 'Mozilla/5.0 (compatible; DersTakipSchoolSync/1.0)',
    },
    body: body.toString(),
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`MEB isteği başarısız: HTTP ${res.status}`);
  return res.json();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type MebSyncResult = {
  total: number;
  included: number;
  bySchoolType: Record<string, number>;
  excludedOther: number;
  cityMiss: number;
  districtMiss: number;
  cityMissSamples: string[];
  districtMissSamples: string[];
  written: number;
};

type SchoolRecord = {
  meb_kurum_kodu: string;
  name: string;
  school_type: string;
  city_id: number;
  district_id: number | null;
  host: string | null;
};

export async function syncMebSchools(
  supabase: SupabaseClient,
  options: { write: boolean; pageLimit?: number; onProgress?: (done: number, total: number) => void } = { write: false }
): Promise<MebSyncResult> {
  const { data: cities, error: citiesError } = await supabase.from('cities').select('id, name');
  if (citiesError) throw new Error(`cities okunamadı: ${citiesError.message}`);
  const { data: districts, error: districtsError } = await supabase.from('districts').select('id, name, city_id');
  if (districtsError) throw new Error(`districts okunamadı: ${districtsError.message}`);

  const cityByName = new Map<string, number>();
  for (const c of (cities as { id: number; name: string }[]) || []) cityByName.set(normalizeName(c.name), c.id);

  const districtByCityAndName = new Map<string, number>();
  for (const d of (districts as { id: number; name: string; city_id: number }[]) || []) {
    districtByCityAndName.set(`${d.city_id}::${normalizeName(d.name)}`, d.id);
  }

  const first = await fetchMebPage(0, 1);
  const total = Number(first.recordsTotal || 0);

  const bySchoolType: Record<string, number> = { anaokulu: 0, ilkokul: 0, ortaokul: 0, lise: 0 };
  let excludedOther = 0;
  let cityMiss = 0;
  let districtMiss = 0;
  const cityMissSamples = new Set<string>();
  const districtMissSamples = new Set<string>();
  const rowsByKurumKodu = new Map<string, SchoolRecord>();

  const pageCount = Math.min(Math.ceil(total / PAGE_SIZE), options.pageLimit ?? Infinity);

  for (let page = 0; page < pageCount; page++) {
    const start = page * PAGE_SIZE;
    const res = await fetchMebPage(start, PAGE_SIZE);
    const rows = res.data || [];

    for (const row of rows) {
      const parsed = parseOkulAdi(row.OKUL_ADI || '');
      if (!parsed) continue;

      const schoolType = classifyType(parsed.name);
      if (!schoolType) {
        excludedOther++;
        continue;
      }

      const normalizedIl = normalizeName(parsed.il);
      const resolvedCityKey = cityByName.has(normalizedIl) ? normalizedIl : CITY_ALIASES[normalizedIl];
      const cityId = resolvedCityKey ? cityByName.get(resolvedCityKey) : undefined;
      if (!cityId) {
        cityMiss++;
        cityMissSamples.add(parsed.il);
        continue;
      }

      const normalizedIlce = normalizeName(parsed.ilce);
      const aliasedIlce = DISTRICT_ALIASES[`${resolvedCityKey}::${normalizedIlce}`];
      const districtKey = normalizedIlce === 'MERKEZ' ? resolvedCityKey : aliasedIlce || normalizedIlce;
      const districtId = districtByCityAndName.get(`${cityId}::${districtKey}`) ?? null;
      if (!districtId) {
        districtMiss++;
        districtMissSamples.add(`${parsed.il} / ${parsed.ilce}`);
      }

      const kurumKodu = extractKurumKodu(row.YOL);
      if (!kurumKodu) continue;

      bySchoolType[schoolType] = (bySchoolType[schoolType] || 0) + 1;
      rowsByKurumKodu.set(kurumKodu, {
        meb_kurum_kodu: kurumKodu,
        name: parsed.name,
        school_type: schoolType,
        city_id: cityId,
        district_id: districtId,
        host: row.HOST || null,
      });
    }

    options.onProgress?.(Math.min(start + PAGE_SIZE, total), total);
    await sleep(120);
  }

  const finalRows = Array.from(rowsByKurumKodu.values());
  let written = 0;

  if (options.write) {
    for (let i = 0; i < finalRows.length; i += UPSERT_CHUNK) {
      const chunk = finalRows.slice(i, i + UPSERT_CHUNK);
      const { error } = await supabase.from('schools').upsert(chunk, { onConflict: 'meb_kurum_kodu' });
      if (error) throw new Error(`schools yazılamadı: ${error.message}`);
      written += chunk.length;
    }
  }

  return {
    total,
    included: finalRows.length,
    bySchoolType,
    excludedOther,
    cityMiss,
    districtMiss,
    cityMissSamples: Array.from(cityMissSamples),
    districtMissSamples: Array.from(districtMissSamples).slice(0, 20),
    written,
  };
}
