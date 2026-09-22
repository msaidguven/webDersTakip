import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { fetchTymmUnit } from '@/app/src/lib/tymm/fetchTymmUnit';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { normUnitTitleForMatch, fuzzyNorm } from '@/app/src/lib/tymm/compareUnits';
import type { TymmUnit } from '@/app/src/lib/tymm/tymmParser';

// Konu başına önizleme kıyası: kaç kazanım AYNEN kalacak, kaç tanesi yeni eklenecek, kaç
// tanesi (DB'de is_current=true ama TYMM'de artık yok diye) arşivlenecek. Eşleşme kuralı
// SAVE (saveTymmUnit) İLE BİREBİR AYNI olmalı — (topic_id, description) tam string eşitliği
// — yoksa önizleme, kaydetmenin gerçekte yapacağından farklı bir şey gösterip admin'i yanıltır.
type TopicDiff = {
  topicTitle: string;
  topicExists: boolean;
  topicId: number | null;
  unchanged: number;
  new: number;
  toArchive: number;
  // "Yeni" görünen ama aslında eski bir kazanımın 1-2 kelime değişmiş hali olabilecekler için:
  // admin bunları elle eski bir kazanımla eşleştirebilsin diye ham liste (bkz. TymmSaveDiffSummary,
  // kullanıcının 2026-09-22 isteği — fuzzy eşleşme her ufak değişikliği yakalayamıyor, "1-2
  // kelime değişse de ana konu aynıysa" admin kendi karar vermek istiyor).
  newDescriptions: string[];
  toArchiveOutcomes: { id: number; description: string }[];
};

async function buildTopicDiffs(unit: TymmUnit, lessonId: number, gradeId: number): Promise<TopicDiff[]> {
  const supabase = createServiceClient();

  // saveTymmUnit ile AYNI eşleştirme kuralı (bkz. importUnit.ts) — birebir title yerine
  // normUnitTitleForMatch, TYMM'in bazen eklediği "1. Öğrenme Alanı: " gibi bir öneki yok
  // sayar; aksi halde önizleme "yeni ünite" gösterip aslında var olan üniteyle eşleşecek
  // kaydı yanlış tanıtır.
  const { data: unitsForLessonGrade } = await supabase.from('units').select('id, title').eq('lesson_id', lessonId).eq('grade_id', gradeId);
  const normalizedUnitTarget = normUnitTitleForMatch(unit.unitTitle);
  const existingUnit = ((unitsForLessonGrade as { id: number; title: string }[] | null) || []).find(
    (u) => normUnitTitleForMatch(u.title) === normalizedUnitTarget
  );

  // Parse edilen ünitede her konu için TÜM kazanım metinlerini (birden fazla öğrenme çıktısı
  // aynı konuya düşebiliyor, bkz. importUnit.ts) tek bir set'te topla.
  const parsedDescsByTopic = new Map<string, Set<string>>();
  for (const lo of unit.learningOutcomes) {
    const set = parsedDescsByTopic.get(lo.topicTitle) || new Set<string>();
    for (const comp of lo.components) set.add(comp.text);
    parsedDescsByTopic.set(lo.topicTitle, set);
  }

  const topicTitles = Array.from(parsedDescsByTopic.keys());
  const diffs: TopicDiff[] = [];

  if (!existingUnit) {
    // Ünite DB'de hiç yok → içindeki tüm konular da yeni, kazanım kıyaslanacak bir şey yok.
    for (const topicTitle of topicTitles) {
      const descs = Array.from(parsedDescsByTopic.get(topicTitle)!);
      diffs.push({ topicTitle, topicExists: false, topicId: null, unchanged: 0, new: descs.length, toArchive: 0, newDescriptions: descs, toArchiveOutcomes: [] });
    }
    return diffs;
  }

  const unitId = (existingUnit as { id: number }).id;
  const { data: existingTopicsData } = await supabase.from('topics').select('id, title').eq('unit_id', unitId);
  const existingTopicIdByTitle = new Map<string, number>(
    ((existingTopicsData as { id: number; title: string }[] | null) || []).map((t) => [t.title, t.id])
  );

  for (const topicTitle of topicTitles) {
    const parsedDescs = parsedDescsByTopic.get(topicTitle)!;
    const topicId = existingTopicIdByTitle.get(topicTitle);
    if (topicId == null) {
      const descs = Array.from(parsedDescs);
      diffs.push({ topicTitle, topicExists: false, topicId: null, unchanged: 0, new: descs.length, toArchive: 0, newDescriptions: descs, toArchiveOutcomes: [] });
      continue;
    }

    const { data: activeOutcomesData } = await supabase
      .from('outcomes')
      .select('id, description')
      .eq('topic_id', topicId)
      .eq('is_current', true);
    const activeOutcomes = (activeOutcomesData as { id: number; description: string }[] | null) || [];
    // FUZZY eşleşme — saveTymmUnit ile AYNI (bkz. importUnit.ts, compareUnits.ts fuzzyNorm):
    // noktalama/boşluk farkı "değişti" sayılmasın, önizleme kaydetmenin yapacağından farklı
    // bir şey göstermesin (kullanıcının 2026-09-22 canlıda yakaladığı bug).
    const activeDescsFuzzy = new Set(activeOutcomes.map((o) => fuzzyNorm(o.description)));

    const newDescriptions: string[] = [];
    let unchanged = 0;
    for (const desc of parsedDescs) {
      if (activeDescsFuzzy.has(fuzzyNorm(desc))) unchanged += 1;
      else newDescriptions.push(desc);
    }
    const parsedDescsFuzzy = new Set(Array.from(parsedDescs).map(fuzzyNorm));
    const toArchiveOutcomes = activeOutcomes.filter((o) => !parsedDescsFuzzy.has(fuzzyNorm(o.description)));

    diffs.push({
      topicTitle,
      topicExists: true,
      topicId,
      unchanged,
      new: newDescriptions.length,
      toArchive: toArchiveOutcomes.length,
      newDescriptions,
      toArchiveOutcomes,
    });
  }

  return diffs;
}

// SADECE ÇEKME (yazma yok): tek bir TYMM ünite sayfasını çeker, ayrıştırır ve olduğu gibi
// döner — admin önizleyip düzeltebilsin diye. DB'ye kaydetme /api/admin/tymm/save ile,
// admin bu önizlemeyi elle onayladıktan sonra ayrı bir istekle yapılır.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { tymmUrl?: unknown; lessonId?: unknown; gradeId?: unknown } | null;
  const tymmUrl = typeof body?.tymmUrl === 'string' ? body.tymmUrl.trim() : '';
  if (!tymmUrl) return NextResponse.json({ error: 'tymmUrl zorunlu' }, { status: 400 });
  const lessonId = typeof body?.lessonId === 'number' ? body.lessonId : null;
  const gradeId = typeof body?.gradeId === 'number' ? body.gradeId : null;

  const fetched = await fetchTymmUnit(tymmUrl);
  if (!fetched.ok) return NextResponse.json({ error: fetched.error }, { status: 400 });

  // lessonId/gradeId verilmişse (admin Sınıf/Ders seçtiyse) DB ile kıyaslayıp önizleme
  // için konu bazlı fark özeti çıkar — verilmemişse (ör. bulk akışta henüz kullanılmıyor)
  // topicDiffs alanı atlanır, istemci "Yeni konu" gibi bir varsayıma düşmeden gösterimi gizler.
  const topicDiffs = lessonId != null && gradeId != null ? await buildTopicDiffs(fetched.result.unit, lessonId, gradeId) : undefined;

  return NextResponse.json({
    unit: fetched.result.unit,
    unmatchedLines: fetched.result.unmatchedLines,
    boundaryWarnings: fetched.result.boundaryWarnings,
    rawSections: fetched.result.rawSections,
    topicDiffs,
  });
}
