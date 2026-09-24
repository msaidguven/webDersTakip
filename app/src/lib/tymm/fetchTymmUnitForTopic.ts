// app/src/lib/tymm/fetchTymmUnitForTopic.ts
// Verilen bir DB konusunun (topic) ait olduğu üniteyi TYMM'in canlı sayfasında bulup tam
// TymmUnit'ini (öğrenme çıktıları + kazanım bileşenleri dahil) döner — Kazanım Yönetimi
// paneli, tek bir konuyu seçtiğinde admin'e ayrıca URL sordurmadan (lesson_grades.tymm_page_url
// zaten kayıtlı, bkz. YillikPlanPanel/KonuYonetimiPanel'deki aynı desen) "TYMM'de bu konunun
// ünitesinde neler var" göstermek için.

import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { discoverTymmUnitLinks } from './discoverUnits';
import { fetchTymmUnit } from './fetchTymmUnit';
import { normUnitTitleForMatch } from './compareUnits';
import type { TymmUnit } from './tymmParser';

export type FetchTymmUnitForTopicResult =
  | { ok: true; topicId: number; unitId: number; unitTitle: string; curriculumYear: string | null; tymmUnit: TymmUnit }
  | { ok: false; error: string };

export async function fetchTymmUnitForTopic(topicId: number): Promise<FetchTymmUnitForTopicResult> {
  const supabase = createServiceClient();

  const { data: topicRow, error: topicErr } = await supabase
    .from('topics')
    .select('id, unit_id, units(id, title, lesson_id, grade_id)')
    .eq('id', topicId)
    .maybeSingle();
  if (topicErr) return { ok: false, error: topicErr.message };
  if (!topicRow) return { ok: false, error: 'Konu bulunamadı' };

  const unit = (topicRow as unknown as { units: { id: number; title: string; lesson_id: number; grade_id: number } | null }).units;
  if (!unit) return { ok: false, error: 'Konunun ünitesi bulunamadı' };

  const { data: lgData, error: lgErr } = await supabase
    .from('lesson_grades')
    .select('tymm_page_url')
    .eq('lesson_id', unit.lesson_id)
    .eq('grade_id', unit.grade_id)
    .maybeSingle();
  if (lgErr) return { ok: false, error: lgErr.message };
  const pageUrl = (lgData as { tymm_page_url: string | null } | null)?.tymm_page_url;
  if (!pageUrl) return { ok: false, error: "Bu ders/sınıf için TYMM sayfa URL'i henüz kayıtlı değil (Yıllık Plan > Kontrol Et'ten bir kez çekilmesi gerekiyor)." };

  const discovered = await discoverTymmUnitLinks(pageUrl);
  if (!discovered.ok) return { ok: false, error: discovered.error };

  const matchedLink = discovered.units.find((u) => normUnitTitleForMatch(u.title) === normUnitTitleForMatch(unit.title));
  if (!matchedLink) return { ok: false, error: `TYMM'de "${unit.title}" ile eşleşen bir ünite bulunamadı.` };

  const fetched = await fetchTymmUnit(matchedLink.url);
  if (!fetched.ok) return { ok: false, error: fetched.error };

  return {
    ok: true,
    topicId,
    unitId: unit.id,
    unitTitle: unit.title,
    curriculumYear: null,
    tymmUnit: fetched.result.unit,
  };
}
