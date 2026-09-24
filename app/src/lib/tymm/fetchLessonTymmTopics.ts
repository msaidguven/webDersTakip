// app/src/lib/tymm/fetchLessonTymmTopics.ts
// Konu Yönetimi panelindeki "TYMM'den referans" listesi için — bir ders+sınıfın TYMM'deki
// GÜNCEL ünite/konu başlıklarını (kazanım seviyesine hiç inmeden, sadece başlıklar) döner.
// lesson_grades.tymm_page_url zaten kayıtlı olduğu için (admin "Toplu" sekmesinde bir kere
// çekince kaydediliyor) admin ayrıca bir URL girmeden, sayfa açılır açılmaz otomatik
// çekilebilir — hiçbir şey DB'ye YAZMAZ, salt okunur bir referans.

import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { discoverTymmUnitLinks } from './discoverUnits';
import { fetchTymmUnit } from './fetchTymmUnit';
import { stripUnitTitleNumberPrefix } from './compareUnits';

export type LessonTymmUnit = { unitTitle: string; topics: string[] };
export type FetchLessonTymmTopicsResult = { ok: true; units: LessonTymmUnit[] } | { ok: false; error: string };

export async function fetchLessonTymmTopics(lessonId: number, gradeId: number): Promise<FetchLessonTymmTopicsResult> {
  const supabase = createServiceClient();

  const { data: lgData, error: lgErr } = await supabase
    .from('lesson_grades')
    .select('tymm_page_url')
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId)
    .maybeSingle();
  if (lgErr) return { ok: false, error: lgErr.message };
  const pageUrl = (lgData as { tymm_page_url: string | null } | null)?.tymm_page_url;
  if (!pageUrl) {
    return { ok: false, error: "Bu ders/sınıf için TYMM sayfa URL'i henüz kayıtlı değil." };
  }

  const discovered = await discoverTymmUnitLinks(pageUrl);
  if (!discovered.ok) return { ok: false, error: discovered.error };

  // Bireysel ünite çekme hataları tolere edilir (bkz. fetch-bulk/route.ts'teki aynı desen) —
  // TYMM'in tek bir ünitesi geçici erişilemez olsa bile geri kalanı gösterebiliriz.
  const fetched = await Promise.all(discovered.units.map((u) => fetchTymmUnit(u.url)));
  const units: LessonTymmUnit[] = [];
  for (const f of fetched) {
    if (!f.ok) continue;
    // KONU listesi olarak TYMM'in kendi "İçerik Çerçevesi" satırları kullanılıyor
    // (unit.contentFramework) — learningOutcomes[].topicTitle DEĞİL: o alan, çerçeve satır
    // sayısı kazanım grubu sayısıyla uyuşmadığında (bkz. tymmParser.ts'teki fallback,
    // örn. "Ortak Mirasımız" ünitesi) yanlışlıkla kazanımın kendi UZUN CÜMLESİNE düşebiliyor
    // — kullanıcının 2026-09-24 canlıda yakaladığı bug: "konu diye öğrenme çıktısını
    // alıyorsun, TYMM konuyu İçerik Çerçevesi adıyla veriyor". Grup başlığı satırları (sonu
    // ":" ile bitenler, ör. "İşlemler:") gerçek bir konu değildir, bunlar da elenir (bkz.
    // aynı dosyadaki withoutGroupHeaders mantığı).
    const topicTitles = Array.from(new Set(f.result.unit.contentFramework.filter((line) => !line.trim().endsWith(':'))));
    // Parser normalde "1. Öğrenme Alanı: " önekini ayıklıyor ama her zaman başaramıyor (bkz.
    // importUnit.ts'teki aynı güvenlik ağı) — burada da görüntülenen başlık temiz olsun diye.
    units.push({ unitTitle: stripUnitTitleNumberPrefix(f.result.unit.unitTitle), topics: topicTitles });
  }

  return { ok: true, units };
}
