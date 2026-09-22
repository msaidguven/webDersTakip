// app/src/lib/yillikPlan/importer.ts
// yillik_plan/importer.py'nin (Python) TypeScript portu — DOCX'ten üretilen satırları
// units / topics / outcomes (+ outcome_weeks) tablolarına aktarır.
//
// Python sürümündeki "Adım 5: Taslak İçerikler" (topic_contents + topic_content_weeks)
// bilinçli olarak taşınmadı: güncel sitede her konunun topic_contents'te TEK bir kaydı
// var (NotebookLM akışıyla doldurulan, bkz. app/api/admin/topic-sections/plan/route.ts)
// ve topic_content_weeks hiç kullanılmıyor — o adımı olduğu gibi taşımak birden fazla
// haftaya yayılan konularda aynı topic'e birden fazla topic_contents satırı açar ve
// konu sayfasının .maybeSingle() sorgusunu bozar. Bu port yalnızca ünite/konu/kazanım
// (yıllık planın asıl amacı) ile ilgilenir; topic_contents'e hiç dokunmaz.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedRow } from './docxParser';
import { computeMissingCodeAssignments } from '@/app/src/lib/outcomeCodes';
import { fuzzyNorm } from '@/app/src/lib/tymm/compareUnits';

export type LogLevel = 'info' | 'success' | 'warning' | 'error';
export type LogEntry = { msg: string; level: LogLevel };
export type StepResult = { basarili: number; atlanmis: number; hata: number; hafta_atlanmis?: number };

// Python sürümünde "Sınav" yoktu — gerçek DOCX'lerde "Sınav Haftası" tüm satırı
// kaplayan birleşik hücre değilse (bkz. docxParser.ts:tatilMi) ünite/konu olarak
// sızıyordu; ders içeriği taşımadığı için Tatil/Bayram ile aynı muameleyi görsün.
const SKIP_PATTERNS = ['*', 'Yıl Sonu', 'yıl sonu', 'Eğitim-öğretim Yılı Sonu', 'Bayram', 'bayram', 'Tatil', 'tatil', 'Sınav', 'sınav'];
const SKIP_WEEK_OVER = 50;

const TR_SLUG_MAP: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
  Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U',
  // Python sürümünde yoktu — şapkalı sesli harfler (â/î/û) çevrilmeyince o karakter
  // tamamen düşüyor ve kelime ortada kesik bir tireyle bölünüyordu (ör. "Zekâ" →
  // "zek", "Dinî" → "din--motifler"); site genelinde slug üretimi bunları a/i/u'ya
  // çeviriyor (bkz. app/src/lib/site.ts:slugifyHeading), burada da tutarlı olsun diye.
  â: 'a', Â: 'A', î: 'i', Î: 'I', û: 'u', Û: 'U',
};

export function skipRow(row: ParsedRow): boolean {
  const unite = row.ünite || '';
  const konu = row.konu || '';
  if (!unite && !konu) return true;
  for (const p of SKIP_PATTERNS) {
    if (unite.includes(p) || konu.includes(p)) return true;
  }
  const wn = row.week_no;
  return !!(wn && wn > SKIP_WEEK_OVER);
}

export function slugify(text: string): string {
  let out = text;
  for (const [k, v] of Object.entries(TR_SLUG_MAP)) out = out.split(k).join(v);
  return out
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Boş konu olan satırlara aynı ünite içindeki bir sonraki (veya önceki) geçerli
// konuyu atar. Orijinal listeyi bozmadan bir kopyasını döndürür.
export function lookaheadKonu(rows: ParsedRow[]): ParsedRow[] {
  const out = rows.map((r) => ({ ...r }));
  for (let i = 0; i < out.length; i++) {
    if (out[i].konu.trim()) continue;
    const unite = out[i].ünite.trim();
    for (let j = i + 1; j < out.length; j++) {
      if (out[j].ünite.trim() === unite && out[j].konu.trim()) {
        out[i].konu = out[j].konu;
        break;
      }
    }
    if (!out[i].konu.trim()) {
      for (let j = i - 1; j >= 0; j--) {
        if (out[j].ünite.trim() === unite && out[j].konu.trim()) {
          out[i].konu = out[j].konu;
          break;
        }
      }
    }
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>;

async function gradeName(sb: SB, gradeId: number): Promise<string> {
  const { data } = await sb.from('grades').select('name').eq('id', gradeId).maybeSingle();
  return (data as { name: string } | null)?.name || String(gradeId);
}

// ── Adım 1: Üniteler ──────────────────────────────────────────────────────────

export async function importUnits(
  sb: SB,
  rows: ParsedRow[],
  lessonId: number,
  gradeId: number
): Promise<{ logs: LogEntry[]; result: StepResult }> {
  const logs: LogEntry[] = [];
  const log = (msg: string, level: LogLevel = 'info') => logs.push({ msg, level });

  const seen = new Map<string, number>();
  for (const row of rows) {
    if (skipRow(row)) continue;
    const u = row.ünite.trim();
    if (u && !seen.has(u)) seen.set(u, seen.size + 1);
  }
  log(`📊 ${seen.size} benzersiz ünite`);

  const gName = await gradeName(sb, gradeId);
  log(`🎓 Sınıf: ${gName}`);

  const { data: lgData } = await sb
    .from('lesson_grades')
    .select('lesson_id')
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId)
    .maybeSingle();
  if (!lgData) {
    await sb.from('lesson_grades').insert({ lesson_id: lessonId, grade_id: gradeId, is_active: true });
    log('  ✅ lesson_grades bağlantısı oluşturuldu', 'success');
  } else {
    log('  ⊘ lesson_grades zaten var');
  }

  let basarili = 0;
  let hata = 0;
  let atlanmis = 0;

  for (const [uniteAdi] of seen) {
    // Ünite hiçbir yerde salt slug'la aranmıyor, her zaman lesson_id + grade_id + slug ile
    // aranıyor (bkz. unitOverviewPageData.ts) — düz slug dışında HİÇBİR EK/SIRA NUMARASI
    // kullanılmıyor (kullanıcının 2026-09-21 kesin kararı). Aynı ders+sınıfta gerçekten
    // aynı isme slugify olan iki farklı ünite varsa (pratikte olmamalı, başlıklar farklı
    // olduğu sürece) upsert kendi hata mesajıyla (unique violation) düşer, sessizce
    // numaralandırılmaz — kayıt admin'in görüp başlığı düzeltmesi gereken gerçek bir durum.
    const slugUniq = slugify(uniteAdi);

    try {
      const { data: ex } = await sb
        .from('units')
        .select('id')
        .eq('lesson_id', lessonId)
        .eq('grade_id', gradeId)
        .eq('title', uniteAdi)
        .maybeSingle();

      if (ex) {
        // Yeniden aktarım: mevcut ünitenin üzerine yaz (skip yerine güncelle).
        const { error: updateError } = await sb
          .from('units')
          .update({ description: `${uniteAdi} ünitesi`, is_active: true })
          .eq('id', (ex as { id: number }).id);
        if (updateError) throw updateError;
        log(`  🔄 ${uniteAdi} (mevcut, güncellendi, id=${(ex as { id: number }).id})`, 'success');
        atlanmis += 1;
        continue;
      }

      // slug üzerinde artık hiçbir unique constraint yok (bkz. supabase/migrations/
      // units_slug_unique_per_lesson_grade.sql) — aynı isme/slug'a sahip başka bir ünite
      // zaten yukarıdaki "ex" kontrolüyle (title eşleşmesi) güncelleniyor, buraya sadece
      // gerçekten yeni bir kayıt geldiğinde düşülüyor, o yüzden düz insert yeterli.
      const { error: insertError } = await sb.from('units').insert({
        lesson_id: lessonId,
        grade_id: gradeId,
        title: uniteAdi,
        slug: slugUniq,
        is_active: true,
        description: `${uniteAdi} ünitesi`,
      });
      if (insertError) throw insertError;
      log(`  ✅ ${uniteAdi}`, 'success');
      basarili += 1;
    } catch (e) {
      log(`  ❌ ${uniteAdi}: ${e instanceof Error ? e.message : String(e)}`, 'error');
      hata += 1;
    }
  }

  log('────────────────────────');
  log(`✅ ${basarili} eklendi  ⊘ ${atlanmis} atlandı  ❌ ${hata} hata`, 'success');
  return { logs, result: { basarili, atlanmis, hata } };
}

// ── Adım 2: Konular ───────────────────────────────────────────────────────────

export async function importTopics(
  sb: SB,
  rows: ParsedRow[],
  lessonId: number,
  gradeId: number
): Promise<{ logs: LogEntry[]; result: StepResult }> {
  const logs: LogEntry[] = [];
  const log = (msg: string, level: LogLevel = 'info') => logs.push({ msg, level });

  const temiz = lookaheadKonu(rows.filter((r) => !skipRow(r)));

  const seen = new Map<string, [string, string]>();
  for (const row of temiz) {
    const unite = row.ünite.trim();
    const konu = row.konu.trim();
    if (unite && konu) {
      const key = `${unite} ${konu}`;
      if (!seen.has(key)) seen.set(key, [unite, konu]);
    }
  }
  log(`📊 ${seen.size} benzersiz konu`);

  const gName = await gradeName(sb, gradeId);
  log(`🎓 Sınıf: ${gName}`);

  const { data: unitsData } = await sb.from('units').select('id, title').eq('lesson_id', lessonId).eq('grade_id', gradeId);
  const unitMap = new Map<string, number>(((unitsData as { id: number; title: string }[] | null) || []).map((u) => [u.title, u.id]));
  log(`🗂  ${unitMap.size} ünite DB'de (sınıf: ${gName})`);

  let basarili = 0;
  let hata = 0;
  let atlanmis = 0;
  const konuOrder = new Map<number, number>();

  for (const [, [uniteAdi, konuAdi]] of seen) {
    const unitId = unitMap.get(uniteAdi);
    if (!unitId) {
      log(`  ⚠️  Ünite DB'de yok: ${uniteAdi}`, 'warning');
      hata += 1;
      continue;
    }

    konuOrder.set(unitId, (konuOrder.get(unitId) || 0) + 1);
    const slug = slugify(konuAdi);

    try {
      // upsert: yeniden aktarımda aynı (unit_id, slug) için unique-violation almak
      // yerine mevcut konunun üzerine yazar (bkz. topics_unit_slug_unique,
      // supabase/migrations/yillik_plan_upsert_constraints.sql).
      const { data: ex } = await sb.from('topics').select('id').eq('unit_id', unitId).eq('slug', slug).maybeSingle();

      const { error: upsertError } = await sb.from('topics').upsert(
        {
          unit_id: unitId,
          title: konuAdi,
          slug,
          order_no: konuOrder.get(unitId),
          is_active: true,
        },
        { onConflict: 'unit_id,slug' }
      );
      if (upsertError) throw upsertError;

      if (ex) {
        log(`  🔄 [${uniteAdi.slice(0, 18)}] ${konuAdi.slice(0, 40)} (güncellendi)`, 'success');
        atlanmis += 1;
      } else {
        log(`  ✅ [${uniteAdi.slice(0, 18)}] ${konuAdi.slice(0, 40)}`, 'success');
        basarili += 1;
      }
    } catch (e) {
      log(`  ❌ ${konuAdi.slice(0, 40)}: ${e instanceof Error ? e.message : String(e)}`, 'error');
      hata += 1;
    }
  }

  log('────────────────────────');
  log(`✅ ${basarili} eklendi  ⊘ ${atlanmis} atlandı  ❌ ${hata} hata`, 'success');
  return { logs, result: { basarili, atlanmis, hata } };
}

// ── Adım 3: Kazanımlar ────────────────────────────────────────────────────────

const KAZANIM_KOD_RE = /^[A-ZÇĞİÖŞÜA-Z]{1,6}\.\d+\.\d+/;

// DOCX'teki her kazanım satırı "a) ...", "b) ..." gibi bir harfle başlıyor; description
// olarak bu harfi taşımadan sadece metni saklıyoruz.
const KAZANIM_LETTER_RE = /^([a-zçğıöşü])\)\s*/i;

function splitKazanimLetter(kaz: string): { rawLetter: string | null; description: string } {
  const m = KAZANIM_LETTER_RE.exec(kaz);
  if (!m) return { rawLetter: null, description: kaz };
  return { rawLetter: m[1].toLowerCase(), description: kaz.slice(m[0].length).trim() };
}

// DOCX'teki harf (a,b,c...) her HAFTA kendi içinde 1'den başlıyor — aynı konu birden
// fazla haftaya yayılırsa (ör. 1. hafta "a,b,c", 2. hafta yine "a,b,c" ama FARKLI
// kazanımlar) DOCX'teki harfi doğrudan code'a yazmak aynı konuda "a" harfini birden
// fazla kazanıma çakıştırır. Bunun yerine site genelinde zaten kullanılan
// (topic_sections/assign-codes ile aynı) haftaya göre sıralı, konu boyunca kesintisiz
// alfabe atamasını kullanıyoruz — computeMissingCodeAssignments zaten bunu yapıyor.
async function assignMissingCodesForTopic(sb: SB, topicId: number): Promise<number> {
  const { data: outcomesData } = await sb
    .from('outcomes')
    .select('id, order_index, code')
    .eq('topic_id', topicId)
    .eq('is_current', true)
    .order('order_index', { ascending: true });
  const outcomes = (outcomesData as { id: number; order_index: number | null; code: string | null }[] | null) || [];
  if (!outcomes.length) return 0;

  const outcomeIds = outcomes.map((o) => o.id);
  const { data: weeksData } = await sb.from('outcome_weeks').select('outcome_id, start_week').in('outcome_id', outcomeIds);
  const weekByOutcomeId = new Map<number, number>();
  ((weeksData as { outcome_id: number; start_week: number }[] | null) || []).forEach((w) => weekByOutcomeId.set(w.outcome_id, w.start_week));

  const outcomesWithWeeks = outcomes.map((o) => ({ ...o, startWeek: weekByOutcomeId.get(o.id) ?? null }));
  const assignments = computeMissingCodeAssignments(outcomesWithWeeks);
  for (const a of assignments) {
    await sb.from('outcomes').update({ code: a.code }).eq('id', a.id);
  }
  return assignments.length;
}

export async function importOutcomes(
  sb: SB,
  rows: ParsedRow[],
  lessonId: number,
  gradeId: number
): Promise<{ logs: LogEntry[]; result: StepResult }> {
  const logs: LogEntry[] = [];
  const log = (msg: string, level: LogLevel = 'info') => logs.push({ msg, level });

  const gName = await gradeName(sb, gradeId);
  log(`🎓 Sınıf: ${gName}`);

  const { data: unitsData } = await sb.from('units').select('id, title').eq('lesson_id', lessonId).eq('grade_id', gradeId);
  const unitMap = new Map<string, number>(((unitsData as { id: number; title: string }[] | null) || []).map((u) => [u.title, u.id]));

  const unitIds = Array.from(unitMap.values());
  const { data: topicsData } = unitIds.length
    ? await sb.from('topics').select('id, title, unit_id').in('unit_id', unitIds)
    : { data: [] as { id: number; title: string; unit_id: number }[] };
  const topicMap = new Map<string, number>(
    ((topicsData as { id: number; title: string; unit_id: number }[] | null) || []).map((t) => [`${t.unit_id} ${t.title}`, t.id])
  );
  log(`🗂  ${unitMap.size} ünite, ${topicMap.size} konu DB'de (sınıf: ${gName})`);

  const temiz = lookaheadKonu(rows.filter((r) => !skipRow(r)));
  for (const row of temiz) {
    if (!row.konu.trim()) {
      log(`  ⚠️  Hafta ${row.week_no ?? '?'} [${row.ünite}]: konu çözülemedi`, 'warning');
    }
  }

  // Ön hesaplama: (topic_id, kazanım_metni) → geçtiği haftalar
  const kazHaftalar = new Map<string, number[]>();
  for (const row of temiz) {
    const uniteAdi = row.ünite.trim();
    const konuAdi = row.konu.trim();
    const weekNo = row.week_no;
    if (!konuAdi || !weekNo) continue;
    const unitId = unitMap.get(uniteAdi);
    const topicId = unitId != null ? topicMap.get(`${unitId} ${konuAdi}`) : undefined;
    if (!topicId) continue;
    for (const kazRaw of row.kazanım || []) {
      const kaz = kazRaw.trim();
      if (!kaz) continue;
      if (KAZANIM_KOD_RE.test(kaz)) continue;
      if (kaz.length < 10) continue;
      const { description } = splitKazanimLetter(kaz);
      const key = `${topicId} ${description}`;
      const list = kazHaftalar.get(key) || [];
      list.push(weekNo);
      kazHaftalar.set(key, list);
    }
  }
  log(`📅 ${kazHaftalar.size} benzersiz (konu, kazanım) çifti tespit edildi`);

  const eklendiSet = new Set<string>();
  const touchedTopicIds = new Set<number>();
  const touchedOutcomeIdsByTopic = new Map<number, number[]>();
  // FUZZY eşleşme için topic_id → o konunun kazanımları önbelleği (bkz. compareUnits.ts
  // fuzzyNorm) — noktalama/boşluk/Türkçe İ-I-ı-i farkı görmezden gelinir, aksi halde DOCX'te
  // tek bir nokta/boşluk farkı bile kazanımı "değişti" sanıp gereksiz yere arşivliyor ve o
  // kazanıma bağlı sorular (question_outcomes) "güncel değil" görünüyordu (kullanıcının
  // 2026-09-22 TYMM tarafında canlıda yakaladığı bug, DOCX yolu da aynı riski taşıyordu).
  const outcomesByTopicCache = new Map<number, { id: number; description: string }[]>();
  async function getTopicOutcomes(topicId: number) {
    let list = outcomesByTopicCache.get(topicId);
    if (!list) {
      const { data } = await sb.from('outcomes').select('id, description').eq('topic_id', topicId);
      list = (data as { id: number; description: string }[] | null) || [];
      outcomesByTopicCache.set(topicId, list);
    }
    return list;
  }
  let basarili = 0;
  let hata = 0;
  let atlanmis = 0;
  let haftaAtlandı = 0;

  for (const row of temiz) {
    const uniteAdi = row.ünite.trim();
    const konuAdi = row.konu.trim();
    const kazanimlar = row.kazanım || [];
    if (!kazanimlar.length || !konuAdi) continue;

    const unitId = unitMap.get(uniteAdi);
    const topicId = unitId != null ? topicMap.get(`${unitId} ${konuAdi}`) : undefined;
    if (!unitId || !topicId) {
      log(`  ⚠️  Bulunamadı: ${uniteAdi} / ${konuAdi}`, 'warning');
      hata += 1;
      continue;
    }

    for (const kazRaw of kazanimlar) {
      const kaz = kazRaw.trim();
      if (!kaz) continue;
      if (KAZANIM_KOD_RE.test(kaz)) continue;
      if (kaz.length < 10) continue;

      const { description } = splitKazanimLetter(kaz);
      const key = `${topicId} ${description}`;
      if (eklendiSet.has(key)) continue;
      eklendiSet.add(key);

      const haftalar = Array.from(new Set(kazHaftalar.get(key) || [])).sort((a, b) => a - b);
      const startWeek = haftalar.length ? haftalar[0] : null;
      const endWeek = haftalar.length ? haftalar[haftalar.length - 1] : null;

      try {
        // FUZZY eşleşme (yukarıdaki not) — birebir değil. is_current=true: bu satır güncel
        // plana ait — fuzzy eşleşmeyen eski kazanımlar aşağıda, konu döngüsü bittikten sonra
        // is_current=false yapılır (bkz. outcomes_is_current.sql).
        const topicOutcomes = await getTopicOutcomes(topicId);
        const descFuzzy = fuzzyNorm(description);
        const existing = topicOutcomes.find((o) => fuzzyNorm(o.description) === descFuzzy);

        let outcomeId: number;
        if (existing) {
          const { error: updateError } = await sb.from('outcomes').update({ description, is_current: true }).eq('id', existing.id);
          if (updateError) throw updateError;
          existing.description = description;
          outcomeId = existing.id;
          atlanmis += 1;
        } else {
          const { data: created, error: insertError } = await sb
            .from('outcomes')
            .insert({ topic_id: topicId, description, is_current: true })
            .select('id')
            .single();
          if (insertError || !created) throw insertError || new Error('kazanım oluşturulamadı');
          outcomeId = (created as { id: number }).id;
          topicOutcomes.push({ id: outcomeId, description });
          basarili += 1;
        }
        touchedTopicIds.add(topicId);
        touchedOutcomeIdsByTopic.set(topicId, [...(touchedOutcomeIdsByTopic.get(topicId) || []), outcomeId]);

        if (startWeek && endWeek) {
          const { data: wx } = await sb
            .from('outcome_weeks')
            .select('id')
            .eq('outcome_id', outcomeId)
            .eq('start_week', startWeek)
            .eq('end_week', endWeek)
            .maybeSingle();
          if (!wx) {
            await sb.from('outcome_weeks').insert({ outcome_id: outcomeId, start_week: startWeek, end_week: endWeek });
          } else {
            haftaAtlandı += 1;
          }
        }
      } catch (e) {
        log(`  ❌ ${description.slice(0, 40)}: ${e instanceof Error ? e.message : String(e)}`, 'error');
        hata += 1;
      }
    }
  }

  // Metni değiştiği için yukarıdaki upsert'e YAKALANMAYAN eski kazanımları arşivle:
  // sadece bu importun dokunduğu konularda, bu importta upsert edilenlerin DIŞINDA kalan
  // is_current=true satırları is_current=false yap. Upsert'ten SONRA çalışması önemli —
  // tersi sırada (önce arşivle, sonra upsert) aynı metinli kazanımlar upsert'in ON
  // CONFLICT'i onları hiç güncellemediği için (id değişmez) yanlışlıkla arşivlenmiş kalırdı.
  let arsivlendi = 0;
  for (const topicId of touchedTopicIds) {
    const keepIds = touchedOutcomeIdsByTopic.get(topicId) || [];
    const { data: archived, error: archiveError } = await sb
      .from('outcomes')
      .update({ is_current: false })
      .eq('topic_id', topicId)
      .eq('is_current', true)
      .not('id', 'in', `(${keepIds.join(',') || '0'})`)
      .select('id');
    if (archiveError) {
      log(`  ⚠️  Konu ${topicId}: eski kazanımlar arşivlenemedi: ${archiveError.message}`, 'warning');
      continue;
    }
    arsivlendi += (archived as { id: number }[] | null)?.length || 0;
  }
  if (arsivlendi) log(`🗄  ${arsivlendi} eski kazanım arşivlendi (is_current=false)`, 'success');

  // Kodu (a,b,c...) boş kalan kazanımlara, hafta+sıra bazlı kesintisiz alfabe atanır —
  // topic-sections/assign-codes ile aynı mantık (bkz. assignMissingCodesForTopic).
  let kodAtandi = 0;
  for (const topicId of touchedTopicIds) {
    kodAtandi += await assignMissingCodesForTopic(sb, topicId);
  }
  if (kodAtandi) log(`🔤 ${kodAtandi} kazanıma kod (a, b, c...) atandı`, 'success');

  log('────────────────────────');
  log(`✅ ${basarili} kazanım eklendi  ⊘ ${atlanmis} atlandı  ❌ ${hata} hata`, 'success');
  log(`📅 outcome_weeks: ${basarili} yeni  ⊘ ${haftaAtlandı} mevcut`, 'success');
  return { logs, result: { basarili, atlanmis, hata, hafta_atlanmis: haftaAtlandı } };
}
