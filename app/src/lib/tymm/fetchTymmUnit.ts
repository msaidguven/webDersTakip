import { parseTymmUnitHtml, type ParseTymmResult } from './tymmParser';

export type FetchTymmResult = { ok: true; result: ParseTymmResult } | { ok: false; error: string };

export async function fetchTymmUnit(tymmUrl: string): Promise<FetchTymmResult> {
  let html: string;
  try {
    const res = await fetch(tymmUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return { ok: false, error: `TYMM sayfası alınamadı (HTTP ${res.status})` };
    html = await res.text();
  } catch {
    return { ok: false, error: 'TYMM sayfasına ulaşılamadı (ağ hatası)' };
  }

  const result = parseTymmUnitHtml(html);
  if (!result.unit.learningOutcomes.length) {
    return { ok: false, error: 'TYMM sayfasında öğrenme çıktısı bulunamadı — URL doğru mu?' };
  }
  return { ok: true, result };
}
