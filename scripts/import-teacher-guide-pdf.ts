// MEB öğretmen kılavuz kitabını (dijital PDF) konu bazlı, ayrıntılı olarak içe aktarır.
//
// Neden yerel betik: panelden yükleme (processTeacherGuideDocument.ts) Vercel'in 300 sn
// sınırında ünite başına tek Gemini çağrısıyla çalışıyor ve konu başına ancak 2-3 cümle
// çıkarabiliyordu. Burada kılavuz AI'sız olarak konulara bölünür (splitGuideByTopic.ts,
// öğrenme çıktısı koduyla eşleme), her konunun ham bölümü ayrı bir Gemini çağrısıyla
// yapılandırılır (app/prompt/34-teacher-guide-topic-extract.md) — konu başına ~1 dk.
//
// Sonuçlar konu konu önbellek dosyasına yazılır: yarıda kesilirse ya da --dry-run sonrası
// gerçek çalıştırmada Gemini tekrar çağrılmaz (--refresh ile zorlanır).
//
// Kullanım:
//   npx tsx scripts/import-teacher-guide-pdf.ts --pdf "<yol>" --grade 5 --lesson 7 --dry-run
//   npx tsx scripts/import-teacher-guide-pdf.ts --pdf "<yol>" --grade 5 --lesson 7
//   Ek: --topics 813,814  --concurrency 3  --refresh  --cache <dosya.json>

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { extractText, getDocumentProxy } from 'unpdf';
import { splitGuideByTopic, formatPageRanges } from '../app/src/lib/teacherGuide/splitGuideByTopic';
import { structureTeacherGuideTopicText, type TeacherGuideTopicNote } from '../app/src/lib/teacherGuide/structureTeacherGuide';
import { saveTeacherGuideNotes } from '../app/src/lib/teacherGuide/processTeacherGuideDocument';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function loadEnv() {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    })
  );
}

const pdfPath = arg('pdf') ?? '';
const gradeId = Number(arg('grade'));
const lessonId = Number(arg('lesson'));
const dryRun = process.argv.includes('--dry-run');
const refresh = process.argv.includes('--refresh');
const concurrency = Number(arg('concurrency') || 1);
const onlyTopics = arg('topics')?.split(',').map(Number);
// Kalıcı yer: Gemini günlük kotası bitince ertesi gün kalan konulardan devam edilir.
const cachePath = arg('cache') || path.join(homedir(), '.cache', 'derstakip', `teacher-guide-g${gradeId}-l${lessonId}.json`);
mkdirSync(path.dirname(cachePath), { recursive: true });

if (!pdfPath || !Number.isFinite(gradeId) || !Number.isFinite(lessonId)) {
  console.error('Kullanım: --pdf <yol> --grade <id> --lesson <id> [--dry-run]');
  process.exit(1);
}

async function main() {
  loadEnv();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  const [{ data: grade }, { data: lesson }, { data: units }] = await Promise.all([
    supabase.from('grades').select('name').eq('id', gradeId).single(),
    supabase.from('lessons').select('name').eq('id', lessonId).single(),
    supabase.from('units').select('id').eq('grade_id', gradeId).eq('lesson_id', lessonId).eq('is_active', true),
  ]);
  if (!grade || !lesson || !units?.length) throw new Error('Sınıf/ders/ünite bulunamadı');

  type TopicRow = {
    id: number;
    title: string;
    topic_learning_outcomes: { code: string | null }[];
    outcomes: { code: string | null; description: string; order_index: number | null; is_current: boolean }[];
  };
  const { data: topicsData, error: topicsError } = await supabase
    .from('topics')
    .select('id, title, topic_learning_outcomes(code), outcomes(code, description, order_index, is_current)')
    .in('unit_id', units.map((u) => u.id))
    .eq('is_active', true);
  if (topicsError) throw topicsError;
  const topics = topicsData as TopicRow[];

  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(pdfPath)));
  const { text: pages } = await extractText(pdf, { mergePages: false });
  const split = splitGuideByTopic(
    pages,
    topics.map((t) => ({ id: t.id, title: t.title, learningOutcomeCodes: t.topic_learning_outcomes.map((l) => l.code).filter((c): c is string => !!c) }))
  );

  console.log(`${grade.name} ${lesson.name}: ${pdf.numPages} sayfa, ${split.blocks.length} ders planı, ${split.sections.length}/${topics.length} konu eşleşti`);
  for (const b of split.blocks) {
    console.log(`  s.${b.startPage}-${b.endPage} [${b.matchedBy}] ${b.codes.join(',') || '-'} ${b.heading || '(başlıksız)'} → ${b.topicIds.join(',') || 'EŞLEŞMEDİ'}`);
  }
  if (split.unmatchedTopicIds.length) {
    console.log('Kılavuzda bölümü bulunamayan konular:', split.unmatchedTopicIds.map((id) => `${id} ${topics.find((t) => t.id === id)?.title}`).join(' | '));
  }

  const cache: Record<string, TeacherGuideTopicNote> = existsSync(cachePath) && !refresh ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
  const failures: string[] = [];
  // --topics yalnız yapılandırılacak/yazılacak konuları daraltır; bölme her zaman tüm
  // konularla yapılır (önceki planın konusuna bağlanan devam dersleri doğru eşlensin).
  const sections = split.sections.filter((s) => !onlyTopics || onlyTopics.includes(s.topicId));
  const todo = sections.filter((s) => !cache[s.topicId]);
  console.log(`Gemini ile yapılandırılacak: ${todo.length} konu (önbellekte ${sections.length - todo.length}), önbellek: ${cachePath}`);

  await mapWithConcurrency(todo, concurrency, async (section) => {
    const topic = topics.find((t) => t.id === section.topicId)!;
    const outcomesText = topic.outcomes
      .filter((o) => o.is_current)
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      .map((o) => (o.code ? `${o.code}) ${o.description}` : o.description))
      .join('\n');
    const sourcePages = formatPageRanges(section.pages);
    try {
      const details = await structureTeacherGuideTopicText({
        gradeName: grade.name,
        lessonName: lesson.name,
        topicTitle: topic.title,
        outcomesText,
        pages: sourcePages,
        sourceText: section.text,
        glossaryText: split.glossaryText,
      });
      cache[section.topicId] = { ...details, topicId: section.topicId, recommendedHours: section.hours, sourceText: section.text, sourcePages };
      writeFileSync(cachePath, JSON.stringify(cache, null, 1));
      console.log(`  ✓ ${topic.id} ${topic.title} (s.${sourcePages}, ${details.contentPoints?.length ?? 0} madde, ${details.keyTerms?.length ?? 0} terim)`);
    } catch (err) {
      failures.push(`${topic.id} ${topic.title}: ${err instanceof Error ? err.message : String(err)}`);
      console.log(`  ✗ ${topic.id} ${topic.title}`);
    }
  });

  if (failures.length) {
    console.error(`${failures.length} konu yapılandırılamadı, tekrar çalıştırın (önbellektekiler atlanır):\n${failures.join('\n')}`);
    process.exit(1);
  }

  const notes = sections.map((s) => cache[s.topicId]).filter(Boolean);
  if (dryRun) {
    console.log(`--dry-run: ${notes.length} konu hazır, veritabanına yazılmadı.`);
    process.exit(0);
  }

  const { data: previousDocs } = await supabase.from('teacher_guide_documents').select('id').eq('grade_id', gradeId).eq('lesson_id', lessonId);
  const { data: document, error: insertError } = await supabase
    .from('teacher_guide_documents')
    .insert({
      grade_id: gradeId,
      lesson_id: lessonId,
      title: lesson.name,
      source: 'pdf_text_import',
      status: 'ready',
      page_count: pdf.numPages,
      topic_count: notes.length,
    })
    .select('id')
    .single();
  if (insertError || !document) throw new Error(insertError?.message || 'Belge kaydedilemedi');

  await saveTeacherGuideNotes(supabase, document.id, notes);

  // Eski içe aktarmaların notları upsert ile bu belgeye geçti; notu kalmayan eski belge satırları siliniyor.
  for (const old of previousDocs || []) {
    const { count } = await supabase.from('topic_teacher_guide_notes').select('id', { count: 'exact', head: true }).eq('document_id', old.id);
    if (!count) await supabase.from('teacher_guide_documents').delete().eq('id', old.id);
  }

  console.log(`Kaydedildi: belge #${document.id}, ${notes.length} konu.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
