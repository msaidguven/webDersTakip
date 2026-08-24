// app/src/lib/tymm/discoverUnits.ts
// Bir "ders/sınıf" TYMM sayfasından (ör. tymm.meb.gov.tr/ogretim-programlari/
// din-kulturu-ve-ahlak-bilgisi-dersi/6), o sınıftaki TÜM ünitelerin linklerini çıkarır.
// Sayfa her üniteyi `<a href=".../unite/ID" target="_blank">N. ÜNİTE: BAŞLIK</a>` şeklinde,
// sıralı olarak listeliyor — deterministik regex ile çıkarmak yeterli.

import { plainText } from './tymmParser';

export type DiscoveredUnit = { url: string; title: string };
export type DiscoverUnitsResult = { ok: true; units: DiscoveredUnit[] } | { ok: false; error: string };

const UNIT_LINK_RE = /<a\s+href="([^"]*\/unite\/(\d+))"[^>]*target="_blank"[^>]*>([^<]*)<\/a>/gi;

export async function discoverTymmUnitLinks(pageUrl: string): Promise<DiscoverUnitsResult> {
  let html: string;
  try {
    const res = await fetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return { ok: false, error: `Sayfa alınamadı (HTTP ${res.status})` };
    html = await res.text();
  } catch {
    return { ok: false, error: 'Sayfaya ulaşılamadı (ağ hatası)' };
  }

  const seen = new Set<string>();
  const units: DiscoveredUnit[] = [];
  let m: RegExpExecArray | null;
  UNIT_LINK_RE.lastIndex = 0;
  while ((m = UNIT_LINK_RE.exec(html))) {
    const [, href, unitId, rawTitle] = m;
    const title = plainText(rawTitle);
    if (!title || seen.has(unitId)) continue;
    seen.add(unitId);
    units.push({ url: new URL(href, pageUrl).toString(), title });
  }

  if (!units.length) return { ok: false, error: 'Sayfada ünite linki bulunamadı — URL doğru mu?' };
  return { ok: true, units };
}
