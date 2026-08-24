// app/src/lib/tymm/discoverUnits.ts
// Bir "ders/sınıf" TYMM sayfasından (ör. tymm.meb.gov.tr/ogretim-programlari/
// din-kulturu-ve-ahlak-bilgisi-dersi/6), o sınıftaki TÜM ünitelerin linklerini çıkarır.
// TYMM bu listeleme sayfasının HTML yapısını en az bir kez değiştirdi (eskiden başlık
// doğrudan `<a href="…/unite/ID" target="_blank">N. ÜNİTE: BAŞLIK</a>` içindeydi, şimdi
// `<a …><div class="icon">…</div><h4 class="unite-list-item__title">N. Ünite: BAŞLIK</h4>
// …</a>` şeklinde iç içe) — bu yüzden başlığı önce anchor içindeki <h4>'ten, yoksa
// anchor'ın kendi düz metninden (eski biçim) alıyoruz. Sayfa tekrar değişirse burası
// yine kırılabilir; hata mesajı admin'e "ünite bulunamadı" olarak dönerse önce bu dosyayı
// gerçek sayfa HTML'ine karşı kontrol et.

import { plainText } from './tymmParser';

export type DiscoveredUnit = { url: string; title: string };
export type DiscoverUnitsResult = { ok: true; units: DiscoveredUnit[] } | { ok: false; error: string };

const UNIT_ANCHOR_RE = /<a\s+href="([^"]*\/unite\/(\d+))"[^>]*>([\s\S]*?)<\/a>/gi;
const TITLE_TAG_RE = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i;

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
  UNIT_ANCHOR_RE.lastIndex = 0;
  while ((m = UNIT_ANCHOR_RE.exec(html))) {
    const [, href, unitId, innerHtml] = m;
    const titleMatch = TITLE_TAG_RE.exec(innerHtml);
    const title = plainText(titleMatch ? titleMatch[1] : innerHtml);
    if (!title || seen.has(unitId)) continue;
    seen.add(unitId);
    units.push({ url: new URL(href, pageUrl).toString(), title });
  }

  if (!units.length) return { ok: false, error: 'Sayfada ünite linki bulunamadı — URL doğru mu?' };
  return { ok: true, units };
}
