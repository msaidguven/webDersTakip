// app/src/lib/tymm/compareTopicsOnly.ts
// Kazanım/öğrenme çıktısı seviyesine hiç inmeden, SADECE konu BAŞLIKLARINI kıyaslar — bir
// ders/sınıf TYMM sayfasındaki (tüm ünitelerin toplamındaki) güncel konu başlıkları ile
// DB'deki mevcut konuları eşleştirip, artık TYMM'in HİÇBİR ünitesinde karşılığı bulunamayan
// (muhtemelen müfredattan tamamen kaldırılmış) DB konularını işaretler. Admin bunun
// üzerinden "Arşive Taşı" ile o konuları kenara alabilir (bkz.
// app/api/admin/tymm/archive-topic/route.ts) — DB'nin gerçekten yazdığı hiçbir şey burada
// yok, bu fonksiyon sadece okur.
//
// BİLEREK TÜM ÜNİTELERİN TOPLAMINA (birleşim/union) KARŞI kıyaslıyoruz, ünite ünite eşleşmiş
// halde DEĞİL — TYMM güncellemesinde konular üniteler arasında yeniden dağıtılmış olabilir,
// kullanıcının isteği "sadece konuları karşılaştıralım": bir konu HANGİ ünitede olursa
// olsun TYMM'in güncel verisinde bir yerde varsa "eşleşti" sayılır.

import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { discoverTymmUnitLinks } from './discoverUnits';
import { fetchTymmUnit } from './fetchTymmUnit';
import { fuzzyNorm } from './compareUnits';

export type TopicOnlyDiff = {
  dbTopicId: number;
  dbTopicTitle: string;
  dbUnitTitle: string;
  matchedInTymm: boolean;
  isArchived: boolean;
};

export type CompareTopicsOnlyResult = { ok: true; results: TopicOnlyDiff[] } | { ok: false; error: string };

type DbTopicRow = {
  id: number;
  title: string;
  order_no: number;
  is_archived: boolean;
  unit_id: number;
};
type DbUnitRow = { id: number; title: string; order_no: number };

export async function compareLessonTopics(lessonId: number, gradeId: number): Promise<CompareTopicsOnlyResult> {
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
    return { ok: false, error: "Önce bu ders/sınıf için TYMM sayfa URL'i kaydedilmeli — Toplu sekmesinde bir kere çekin." };
  }

  const discovered = await discoverTymmUnitLinks(pageUrl);
  if (!discovered.ok) return { ok: false, error: discovered.error };

  // Bireysel ünite çekme hataları TOLERE edilir (bkz. fetch-bulk/route.ts'teki aynı desen) —
  // TYMM sayfasının tek bir ünitesi geçici olarak erişilemez olsa bile, geri kalan
  // ünitelerin konu başlıklarıyla kıyaslamaya devam edebiliriz.
  const fetched = await Promise.all(discovered.units.map((u) => fetchTymmUnit(u.url)));
  const fuzzyTymmTitles = new Set<string>();
  for (const f of fetched) {
    if (!f.ok) continue;
    // KONU adı olarak TYMM'in kendi "İçerik Çerçevesi" satırları — learningOutcomes[].topicTitle
    // DEĞİL (o alan çerçeve/kazanım sayısı uyuşmazlığında yanlışlıkla kazanımın kendi uzun
    // cümlesine düşebiliyor, bkz. fetchLessonTymmTopics.ts'teki aynı düzeltme, kullanıcının
    // 2026-09-24 bulduğu bug). Grup başlığı satırları (sonu ":" ile bitenler) elenir.
    for (const line of f.result.unit.contentFramework) {
      if (line.trim().endsWith(':')) continue;
      fuzzyTymmTitles.add(fuzzyNorm(line));
    }
  }

  const { data: unitsData, error: unitsErr } = await supabase
    .from('units')
    .select('id, title, order_no')
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId);
  if (unitsErr) return { ok: false, error: unitsErr.message };
  const units = (unitsData as DbUnitRow[] | null) || [];
  const unitIds = units.map((u) => u.id);
  const unitById = new Map(units.map((u) => [u.id, u]));

  if (!unitIds.length) return { ok: true, results: [] };

  const { data: topicsData, error: topicsErr } = await supabase
    .from('topics')
    .select('id, title, order_no, is_archived, unit_id')
    .in('unit_id', unitIds)
    .eq('is_active', true);
  if (topicsErr) return { ok: false, error: topicsErr.message };
  const topics = (topicsData as DbTopicRow[] | null) || [];

  // DB sırası: ünitenin order_no'su, sonra konu order_no'su.
  topics.sort((a, b) => {
    const ua = unitById.get(a.unit_id)?.order_no ?? 0;
    const ub = unitById.get(b.unit_id)?.order_no ?? 0;
    if (ua !== ub) return ua - ub;
    return a.order_no - b.order_no;
  });

  const results: TopicOnlyDiff[] = topics.map((t) => ({
    dbTopicId: t.id,
    dbTopicTitle: t.title,
    dbUnitTitle: unitById.get(t.unit_id)?.title || '',
    matchedInTymm: fuzzyTymmTitles.has(fuzzyNorm(t.title)),
    isArchived: t.is_archived,
  }));

  return { ok: true, results };
}
