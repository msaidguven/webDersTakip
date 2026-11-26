// Tek komutla herhangi bir konu için Gemini AI ile v3 Etkileşimli Ders üretir ve interactive_lessons tablosuna kaydeder:
//   npx tsx scripts/generate-v3-topic.ts 713
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { buildLessonV3Prompt, parseGeneratedLessonV3 } from '../app/src/lib/interactiveLesson/generateV3Core';

// .env.local değişkenlerini process.env'e yükle
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  if (!line.includes('=') || line.trim().startsWith('#')) continue;
  const idx = line.indexOf('=');
  const k = line.slice(0, idx).trim();
  const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  if (!process.env[k]) process.env[k] = v;
}

const topicId = Number(process.argv[2]);
if (!Number.isInteger(topicId) || topicId <= 0) {
  console.error('Kullanım: npx tsx scripts/generate-v3-topic.ts <topicId>');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

async function loadSource(id: number) {
  const [topicRes, contentRes, highlightRes] = await Promise.all([
    supabase
      .from('topics')
      .select('title, slug, units!inner(slug, grades!inner(name, slug), lessons!inner(name, slug))')
      .eq('id', id)
      .single(),
    supabase
      .from('topic_contents')
      .select('id, order_no, topic_content_sections(id, heading, body_markdown, order_no)')
      .eq('topic_id', id)
      .eq('is_published', true)
      .order('order_no'),
    supabase
      .from('topic_content_highlights')
      .select('title, description, topic_contents!inner(topic_id, is_published)')
      .eq('topic_contents.topic_id', id)
      .eq('topic_contents.is_published', true),
  ]);

  if (topicRes.error) throw topicRes.error;
  if (contentRes.error) throw contentRes.error;
  if (highlightRes.error) throw highlightRes.error;

  type TopicRow = {
    title: string;
    slug: string;
    units: { slug: string; grades: { name: string; slug: string }; lessons: { name: string; slug: string } };
  };
  const topic = topicRes.data as unknown as TopicRow;
  type SecRow = { id: number; heading: string; body_markdown: string | null; order_no: number };
  const rawSections = ((contentRes.data ?? []) as { topic_content_sections: SecRow[] }[]).flatMap((c) =>
    [...c.topic_content_sections].sort((a, b) => a.order_no - b.order_no),
  );
  if (!rawSections.length) throw new Error('Yayında içerik bölümü yok');

  const secIds = rawSections.map((s) => s.id);
  const { data: qRows, error: qErr } = await supabase
    .from('questions')
    .select(
      'id, section_id, question_type_id, question_text, question_choices(choice_text, is_correct), question_blank_options(option_text, is_correct)',
    )
    .in('section_id', secIds)
    .eq('is_active', true)
    .in('question_type_id', [1, 3])
    .order('id');
  if (qErr) throw qErr;

  type QRow = {
    id: number;
    section_id: number;
    question_type_id: number;
    question_text: string;
    question_choices: { choice_text: string; is_correct: boolean }[];
    question_blank_options: { option_text: string; is_correct: boolean }[];
  };
  const qs = (qRows ?? []) as unknown as QRow[];

  const sections = rawSections
    .map((s) => {
      const pool = qs
        .filter((q) => q.section_id === s.id)
        .map((q) => {
          const right =
            q.question_choices?.find((c) => c.is_correct)?.choice_text ??
            q.question_blank_options?.find((o) => o.is_correct)?.option_text ??
            '';
          return { id: q.id, text: q.question_text, answer: right };
        })
        .slice(0, 8);
      return { id: s.id, heading: s.heading, body: (s.body_markdown ?? '').slice(0, 4500), pool, classical: [] };
    })
    .filter((s) => s.pool.length >= 2);

  if (!sections.length) throw new Error('Yeterli test sorusu olan bölüm yok');

  const terms = ((highlightRes.data ?? []) as { title: string; description: string }[]).map((h) => ({
    slug: h.title
      .toLocaleLowerCase('tr-TR')
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ş/g, 's')
      .replace(/ü/g, 'u')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
    title: h.title,
    description: h.description,
  }));

  const pageUrl = `/${topic.units.grades.slug}/${topic.units.lessons.slug}/${topic.units.slug}/${topic.slug}`;
  return {
    src: {
      topicId: id,
      title: topic.title,
      grade: topic.units.grades.name,
      lesson: topic.units.lessons.name,
      sections,
      terms,
    },
    pageUrl,
  };
}

async function main() {
  const { src, pageUrl } = await loadSource(topicId);
  console.log(`Konu #${topicId}: ${src.grade} ${src.lesson} — "${src.title}" (${src.sections.length} bölüm)`);

  const apiKeys = [
    process.env.NEW_GEMINI_API_KEY_CONTENT,
    process.env.GEMINI_API_KEY_IMAGE,
    process.env.GEMINI_API_KEY_CONTENT,
    process.env.GEMINI_API_KEY_QUESTIONS,
  ].filter((k): k is string => Boolean(k));
  const models = process.env.GEMINI_V3_MODEL
    ? [process.env.GEMINI_V3_MODEL]
    : ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash'];
  if (!apiKeys.length) throw new Error('Gemini API anahtarı bulunamadı');

  let usedModel = models[0];
  let guide: ReturnType<typeof parseGeneratedLessonV3>['lesson']['guide'] | undefined;
  const allSections: ReturnType<typeof parseGeneratedLessonV3>['lesson']['sections'] = [];
  const SECTIONS_PER_CALL = 2;

  for (let start = 0; start < src.sections.length; start += SECTIONS_PER_CALL) {
    const chunkSrc = { ...src, sections: src.sections.slice(start, start + SECTIONS_PER_CALL) };
    const chunkLabel = `Bölüm ${start + 1}-${start + chunkSrc.sections.length}/${src.sections.length}`;
    let errorsText: string | undefined;
    let chunkLesson: ReturnType<typeof parseGeneratedLessonV3>['lesson'] | null = null;
    let chunkErrors: string[] = [];

    for (let attempt = 1; attempt <= 2; attempt++) {
      const prompt = buildLessonV3Prompt(chunkSrc, errorsText);
      let rawText = '';
      let lastErr = '';

      outer: for (const candidateModel of models) {
        for (let kIdx = 0; kIdx < apiKeys.length; kIdx++) {
          const apiKey = apiKeys[kIdx];
          console.log(`[${chunkLabel}] Gemini çağrılıyor (${candidateModel}, anahtar ${kIdx + 1}/${apiKeys.length}, deneme ${attempt}/2)...`);
          try {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                signal: AbortSignal.timeout(120_000),
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ role: 'user', parts: [{ text: prompt }] }],
                  generationConfig: { temperature: 0.35, responseMimeType: 'application/json' },
                }),
              },
            );

            if (res.ok) {
              const payload = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
              rawText = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? '';
              usedModel = candidateModel;
              break outer;
            }

            lastErr = `Gemini HTTP ${res.status} (${candidateModel}): ${(await res.text()).slice(0, 220)}`;
            if (res.status === 429) {
              console.warn(`${candidateModel} kota dolu (429), sonraki anahtara geçiliyor...`);
              continue;
            }
            if (res.status === 503) {
              console.warn(`${candidateModel} meşgul (503), yedek modele geçiliyor...`);
              break;
            }
            throw new Error(lastErr);
          } catch (err) {
            if (err instanceof Error && err.name === 'TimeoutError') {
              lastErr = `${candidateModel} zaman aşımı`;
              console.warn(`${candidateModel} zaman aşımı, yedek modele geçiliyor...`);
              break;
            }
            throw err;
          }
        }
      }

      if (!rawText) throw new Error(lastErr || 'Gemini yanıt vermedi');
      const parsedJson = JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()) as unknown;

      const { lesson, errors } = parseGeneratedLessonV3(parsedJson, chunkSrc);
      chunkLesson = lesson;
      chunkErrors = errors;
      if (!errors.length) break;
      console.warn(`[${chunkLabel}] Deneme ${attempt} doğrulama hataları (${errors.length}):\n- ${errors.join('\n- ')}`);
      errorsText = errors.slice(0, 20).join('\n');
    }

    if (!chunkLesson || chunkErrors.length) {
      throw new Error(`[${chunkLabel}] v3 doğrulama başarısız:\n${chunkErrors.join('\n')}`);
    }
    if (!guide) guide = chunkLesson.guide;
    allSections.push(...chunkLesson.sections);
  }

  const finalLesson = {
    version: 3 as const,
    topicId,
    courseLabel: `${src.grade} ${src.lesson}`,
    sceneId: 'generic' as const,
    guide,
    sections: allSections,
  };

  const kindCounts: Record<string, number> = {};
  for (const sec of finalLesson.sections) {
    for (const beat of sec.beats) {
      const k = beat.visual?.kind ?? 'none';
      kindCounts[k] = (kindCounts[k] ?? 0) + 1;
    }
  }
  console.log('Görsel dağılımı:', kindCounts);

  const storedLesson = {
    version: 3,
    schemaVersion: '3.1' as const,
    courseLabel: finalLesson.courseLabel,
    sceneId: finalLesson.sceneId,
    guide: finalLesson.guide,
    sections: finalLesson.sections,
  };

  const { error: upsertErr } = await supabase.from('interactive_lessons').upsert(
    {
      topic_id: topicId,
      status: 'ready',
      voice_done: false,
      model: usedModel,
      runs: 0,
      lesson: storedLesson,
      last_message: `v3.1 AI üretimi: ${finalLesson.sections.length} bölüm`,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'topic_id' },
  );
  if (upsertErr) throw upsertErr;

  console.log(`BAŞARILI! Konu #${topicId} ("${src.title}") v3 olarak interactive_lessons tablosuna kaydedildi.`);
  console.log(`Test adresi: http://localhost:3000${pageUrl}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
