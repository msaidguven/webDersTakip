// 6. sınıf Türkçe'nin tema/konu/kazanım yapısını scripts/data/turkce-6.json'dan veritabanına yazar.
//
// Neden ayrı betik: yönetim panelindeki TYMM aktarıcısı "her öğrenme çıktısı bir konu" mantığıyla
// çalışır. Türkçe'de öğrenme çıktıları beceri (ör. T.O.6.6 "metnin yüzey anlamını belirleyebilme"),
// konular ise ders kitabının öğrettiği bilgi başlıkları — eşleme elle yapıldı (2026-10-03, kaynak ve
// gerekçeler: ~/Masaüstü/turkce-arastirma/6-sinif-konu-listesi.md).
//
// Tekrar çalıştırılabilir: ünite slug'ı, konu (unit_id, slug), öğrenme çıktısı kodu ve kazanım
// (öğrenme çıktısı + harf + resmî metin) üzerinden günceller; kopya kayıt açmaz.
//
// KAZANIMLAR = RESMÎ METİN (2026-10-04, kullanıcı kararı): outcomes tablosuna yalnız MEB yıllık
// planındaki a/b/c süreç bileşenleri birebir yazılır (TYMM sitesi Türkçe'de bunları yayımlamıyor).
// Konuya özgü hedefler (content_goals) topics.content_goals'a gider; kazanım olarak hiçbir yerde
// gösterilmez, yalnız içerik/soru üretimine girer. Resmî olmayan eski kazanım satırları silinir;
// içeriği olan konuların bölüm–kazanım bağları konunun resmî kazanımlarına taşınır.
//
// Ders (lessons.is_active) kapalıyken öğrenci hiçbir şey görmez ve içerik/soru/anlatım worker'ları
// bu konulara dokunmaz — betik ders açıksa durur.
//
// Kullanım:
//   npx tsx scripts/import-turkce-6.ts --dry-run
//   npx tsx scripts/import-turkce-6.ts

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

type LearningOutcome = { code: string; title: string; components: { letter: string | null; text: string }[] };
type TopicData = { order_no: number; title: string; slug: string; learning_outcomes: LearningOutcome[]; content_goals: string[]; weeks?: { start: number; end: number } };
type UnitData = { order_no: number; title: string; slug: string; tymm_url: string; duration_hours: number; key_concepts: string[]; topics: TopicData[] };
type ImportData = { lesson_id: number; grade_id: number; curriculum_year: string; weekly_hours: number; tymm_page_url: string; units: UnitData[] };

const dryRun = process.argv.includes('--dry-run');

function loadEnv(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) vars[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return vars;
}

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

// .single() sonuçları için: hata da boş satır da istisna.
function mustOne<T>(res: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  const data = must(res, what);
  if (data == null) throw new Error(`${what}: satır dönmedi`);
  return data;
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const data = JSON.parse(readFileSync(new URL('./data/turkce-6.json', import.meta.url), 'utf8')) as ImportData;
  const { lesson_id: lessonId, grade_id: gradeId } = data;

  const lesson = mustOne(await supabase.from('lessons').select('id, name, is_active').eq('id', lessonId).single(), 'Ders okunamadı');
  if (lesson.is_active) throw new Error(`${lesson.name} dersi açık — yarım yapı öğrenciye görünmesin diye betik durduruldu.`);

  const log = (msg: string) => console.log(`${dryRun ? '[deneme] ' : ''}${msg}`);
  log(`${lesson.name} ${gradeId}. sınıf: ${data.units.length} tema, ${data.units.reduce((n, u) => n + u.topics.length, 0)} konu`);

  if (!dryRun) {
    must(
      await supabase
        .from('lesson_grades')
        .update({ tymm_page_url: data.tymm_page_url, weekly_hours: data.weekly_hours })
        .eq('lesson_id', lessonId)
        .eq('grade_id', gradeId),
      'lesson_grades güncellenemedi',
    );
  }

  for (const unit of data.units) {
    const existingUnit = must(
      await supabase.from('units').select('id, lesson_id, grade_id').eq('slug', unit.slug).maybeSingle(),
      `Ünite aranamadı (${unit.slug})`,
    );
    if (existingUnit && (existingUnit.lesson_id !== lessonId || existingUnit.grade_id !== gradeId)) {
      throw new Error(`"${unit.slug}" slug'ı başka bir derse/sınıfa ait (ünite ${existingUnit.id})`);
    }
    log(`${existingUnit ? 'Güncelle' : 'Ekle'} ünite ${unit.order_no}. ${unit.title}`);
    if (dryRun) {
      for (const t of unit.topics) log(`   konu ${t.order_no}. ${t.title} — ${t.learning_outcomes.map((l) => l.code).join(', ')} — ${t.learning_outcomes.reduce((n, l) => n + l.components.length, 0)} resmî kazanım, ${t.content_goals.length} içerik hedefi${t.weeks ? ` — hafta ${t.weeks.start}-${t.weeks.end}` : ''}`);
      continue;
    }

    const unitFields = {
      lesson_id: lessonId,
      grade_id: gradeId,
      title: unit.title,
      slug: unit.slug,
      description: `${unit.title} teması`,
      order_no: unit.order_no,
      duration_hours: unit.duration_hours,
      key_concepts: unit.key_concepts,
      is_active: true,
    };
    // units.slug'da canlıda unique kısıt yok (upsert onConflict kullanılamıyor) — elle bul/yaz.
    const unitRow = existingUnit
      ? (must(await supabase.from('units').update(unitFields).eq('id', existingUnit.id), `Ünite güncellenemedi (${unit.slug})`), { id: existingUnit.id })
      : mustOne(await supabase.from('units').insert(unitFields).select('id').single(), `Ünite eklenemedi (${unit.slug})`);

    for (const topic of unit.topics) {
      const primary = topic.learning_outcomes[0];
      const topicFields = {
        unit_id: unitRow.id,
        title: topic.title,
        slug: topic.slug,
        order_no: topic.order_no,
        order_status: 'approved',
        learning_outcome: `${primary.code}. ${primary.title}`,
        content_goals: topic.content_goals,
        is_active: true,
      };
      const existingTopic = must(
        await supabase.from('topics').select('id').eq('unit_id', unitRow.id).eq('slug', topic.slug).maybeSingle(),
        `Konu aranamadı (${topic.slug})`,
      );
      const topicRow = existingTopic
        ? (must(await supabase.from('topics').update(topicFields).eq('id', existingTopic.id), `Konu güncellenemedi (${topic.slug})`), { id: existingTopic.id })
        : mustOne(await supabase.from('topics').insert(topicFields).select('id').single(), `Konu eklenemedi (${topic.slug})`);

      // Öğrenme çıktıları: koda göre eşle, eksikleri ekle, listeden çıkanları sil.
      const existingLos = must(
        await supabase.from('topic_learning_outcomes').select('id, code').eq('topic_id', topicRow.id),
        'Öğrenme çıktıları okunamadı',
      ) as { id: number; code: string | null }[];
      const loIds: number[] = [];
      for (const [i, lo] of topic.learning_outcomes.entries()) {
        const found = existingLos.find((e) => e.code === lo.code);
        if (found) {
          must(await supabase.from('topic_learning_outcomes').update({ title: lo.title, order_no: i + 1 }).eq('id', found.id), 'Öğrenme çıktısı güncellenemedi');
          loIds.push(found.id);
        } else {
          const row = mustOne(
            await supabase.from('topic_learning_outcomes').insert({ topic_id: topicRow.id, code: lo.code, title: lo.title, order_no: i + 1 }).select('id').single(),
            'Öğrenme çıktısı eklenemedi',
          );
          loIds.push(row.id);
        }
      }
      const staleLos = existingLos.filter((e) => !loIds.includes(e.id)).map((e) => e.id);
      if (staleLos.length) must(await supabase.from('topic_learning_outcomes').delete().in('id', staleLos), 'Eski öğrenme çıktısı silinemedi');

      // Resmî kazanımlar: (öğrenme çıktısı, harf, metin) birebir eşleşen satır korunur, eksik olan
      // eklenir. Harfsiz tek bileşenli çıktılarda (ör. T.K.6.24) code null kalır — MEB harf vermiyor.
      const existingOutcomes = must(
        await supabase.from('outcomes').select('id, code, description, learning_outcome_id').eq('topic_id', topicRow.id),
        'Kazanımlar okunamadı',
      ) as { id: number; code: string | null; description: string; learning_outcome_id: number | null }[];
      const officialIds: number[] = [];
      let orderIndex = 0;
      for (const [loIndex, lo] of topic.learning_outcomes.entries()) {
        for (const comp of lo.components) {
          orderIndex++;
          const fields = {
            description: comp.text,
            code: comp.letter,
            order_index: orderIndex,
            curriculum_year: data.curriculum_year,
            learning_outcome_id: loIds[loIndex],
            is_current: true,
          };
          const found = existingOutcomes.find(
            (o) => o.learning_outcome_id === loIds[loIndex] && o.code === comp.letter && o.description === comp.text,
          );
          if (found) {
            must(await supabase.from('outcomes').update(fields).eq('id', found.id), 'Kazanım güncellenemedi');
            officialIds.push(found.id);
          } else {
            const row = mustOne(await supabase.from('outcomes').insert({ topic_id: topicRow.id, ...fields }).select('id').single(), 'Kazanım eklenemedi');
            officialIds.push(row.id);
          }
        }
      }

      // İçeriği olan konuda bölümler resmî kazanımlara bağlanır. Konular (Türkçe) resmî maddelerle
      // bire bir örtüşmediği için bağ konu düzeyinde: her bölüm konunun tüm resmî kazanımlarına.
      const nonOfficial = existingOutcomes.filter((o) => !officialIds.includes(o.id)).map((o) => o.id);
      const content = must(await supabase.from('topic_contents').select('id').eq('topic_id', topicRow.id).maybeSingle(), 'İçerik okunamadı');
      if (content) {
        const sections = must(await supabase.from('topic_content_sections').select('id').eq('topic_content_id', content.id), 'Bölümler okunamadı') as { id: number }[];
        const sectionIds = sections.map((x) => x.id);
        if (sectionIds.length) {
          must(await supabase.from('topic_content_section_outcomes').delete().in('section_id', sectionIds), 'Eski bölüm bağları silinemedi');
          must(
            await supabase.from('topic_content_section_outcomes').insert(sectionIds.flatMap((sid) => officialIds.map((oid) => ({ section_id: sid, outcome_id: oid })))),
            'Bölüm bağları yazılamadı',
          );
        }
      }
      if (nonOfficial.length) {
        must(await supabase.from('topic_content_section_outcomes').delete().in('outcome_id', nonOfficial), 'Eski kazanım bağları silinemedi');
        must(await supabase.from('outcome_weeks').delete().in('outcome_id', nonOfficial), 'Eski kazanım haftaları silinemedi');
        must(await supabase.from('outcomes').delete().in('id', nonOfficial), 'Resmî olmayan kazanımlar silinemedi');
      }

      // Haftalar: MEB yıllık planında konunun kitapta işlendiği metnin haftaları (veride hazır).
      // apply_yearly_plan_weeks RPC'siyle aynı desen: kazanım başına tek aralık, önce silinip yazılır.
      if (topic.weeks) {
        must(await supabase.from('outcome_weeks').delete().in('outcome_id', officialIds), 'Eski haftalar silinemedi');
        must(
          await supabase.from('outcome_weeks').insert(officialIds.map((id) => ({ outcome_id: id, start_week: topic.weeks!.start, end_week: topic.weeks!.end }))),
          'Haftalar yazılamadı',
        );
      }

      log(`   konu ${topic.order_no}. ${topic.title} (id ${topicRow.id})`);
    }
  }
  log('Bitti.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
