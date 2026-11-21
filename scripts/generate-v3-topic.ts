// Tek komutla herhangi bir konu için Gemini AI ile v3 Etkileşimli Ders üretir ve interactive_lessons tablosuna kaydeder:
//   npx tsx scripts/generate-v3-topic.ts 713
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

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
  // generateV3.ts server-only içerdiği için doğrudan prompt/parser mantığını burada temizçe kullanıyoruz
  const { src, pageUrl } = await loadSource(topicId);
  console.log(`Konu #${topicId}: ${src.grade} ${src.lesson} — "${src.title}" (${src.sections.length} bölüm)`);

  const sectionsText = src.sections
    .map((sec, idx) =>
      [
        `### BÖLÜM ${idx + 1} (sectionId=${sec.id}): ${sec.heading}`,
        sec.body,
        'Kullanılabilecek aktif havuz soru kimlikleri (checkQuestionIds için YALNIZ bunlardan 2 adet seç):',
        ...sec.pool.map((q) => `- #${q.id}: ${q.text.replace(/\s+/g, ' ').slice(0, 220)} → doğru: ${q.answer}`),
      ].join('\n'),
    )
    .join('\n\n');

  const termsText =
    src.terms.map((t) => `- ${t.slug}: ${t.title} — ${t.description}`).join('\n') ||
    '(Anahtar kavram kaydı yok — kavram tanımlarını doğrudan kitap metninden kısa ve net yaz)';

  const prompt = `Sen ortaokul öğrencileri için "Atom Keşif Dünyası" v3 oyunlaştırılmış ETKİLEŞİMLİ DERS üreten uzman bir eğitim tasarımcısısın.
Konu: ${src.grade} ${src.lesson} · "${src.title}".
Maskotumuzun adı "Atom".

KAYNAK KİTAP METNİ (YALNIZ buradaki bilgileri kullan; kaynakta olmayan hiçbir bilgi/sayı/örnek uydurma, kaynakla çelişme):
${sectionsText}

ANAHTAR KAVRAMLAR (Kavram Avı oyun turlarında öncelikle bunları kullan):
${termsText}

PEDAGOJİK KURALLAR:
1. HER EKRANDA YALNIZCA 1 BİLGİ: Her bölüm için 3-4 adet tek-bilgi adımı ("beats") yaz. "fact" en fazla 1-2 kısa cümle olsun.
2. GEÇİŞ SORULARI ("quickCheck"): Her bölümde 1-2 adıma 2 seçenekli anında kontrollü soru ekle.
3. GÖRSEL ŞEMA ("visual" — HER adımda zorunlu):
   - {"kind":"highlight","badge":"...","headline":"...","bullets":["...","..."]}
   - {"kind":"compare","left":{"title":"...","points":["...","..."]},"right":{"title":"...","points":["...","..."]}}
   - {"kind":"steps","items":["...","...","..."]}
   - {"kind":"cards","items":[{"title":"...","detail":"..."}]}
   - {"kind":"equation","inputs":["...","..."],"result":"..."}
4. BÖLÜM İÇİ OYUN ("game"): Her bölümün sonunda 3 kavramlık "kavram_avi" yaz. "word" BÜYÜK HARFLE 1-2 kelime; "definition" kavramın adını geçirmeden net 1 cümle tanım; "praise" 1 cümle tebrik.
5. BÖLÜM SONU KONTROLÜ ("checkQuestionIds"): Her bölüm için yukarıdaki havuzdan tam 2 geçerli soru ID'si seç.

ÇIKTI: YALNIZCA geçerli JSON döndür:
{
  "guide": { "intro": "Merhaba! Ben Atom. ...", "finish": "Tebrikler! ..." },
  "sections": [
    {
      "sectionId": 1234,
      "tabLabel": "1. Kısa Bölüm Adı",
      "title": "Tam Bölüm Başlığı",
      "accent": "sky",
      "beats": [
        {
          "id": "s1-b1",
          "kicker": "Kategori",
          "title": "Kısa Başlık",
          "fact": "Tek net bilgi.",
          "visual": { "kind": "highlight", "badge": "...", "headline": "...", "bullets": ["...", "..."] },
          "quickCheck": { "prompt": "...", "options": ["...", "..."], "answer": 0, "okFeedback": "...", "retryFeedback": "..." }
        }
      ],
      "game": {
        "kind": "kavram_avi",
        "title": "Bölüm 1 — Kavram Avı",
        "intro": "3 kavramı harf çemberinden yakala!",
        "rounds": [
          { "word": "KAVRAM", "definition": "...", "praise": "..." }
        ]
      },
      "checkQuestionIds": [1001, 1002]
    }
  ]
}`;

  const apiKey = process.env.GEMINI_API_KEY_QUESTIONS || process.env.GEMINI_API_KEY_CONTENT || process.env.NEW_GEMINI_API_KEY_CONTENT;
  const model = 'gemini-3.6-flash';
  console.log(`Gemini çağrılıyor (${model})...`);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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

  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const payload = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const rawText = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? '';
  const parsed = JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()) as {
    guide: { intro: string; finish: string };
    sections: Array<{
      sectionId: number;
      tabLabel: string;
      title: string;
      accent?: string;
      beats: unknown[];
      game: { kind: 'kavram_avi'; title: string; intro: string; rounds: Array<{ word: string; definition: string; praise: string }> };
      checkQuestionIds: number[];
    }>;
  };

  const accents = ['sky', 'amber', 'emerald', 'rose'] as const;
  const normalizedSections = parsed.sections.map((sec, idx) => {
    const srcSec = src.sections.find((s) => s.id === Number(sec.sectionId)) ?? src.sections[idx];
    const validIds = new Set(srcSec.pool.map((q) => q.id));
    const qIds = (sec.checkQuestionIds ?? []).map(Number).filter((id) => validIds.has(id)).slice(0, 2);
    for (const q of srcSec.pool) {
      if (qIds.length >= 2) break;
      if (!qIds.includes(q.id)) qIds.push(q.id);
    }
    return {
      sectionId: srcSec.id,
      tabLabel: sec.tabLabel || `${idx + 1}. ${srcSec.heading.slice(0, 22)}`,
      title: sec.title || srcSec.heading,
      accent: accents[idx % accents.length],
      beats: sec.beats,
      game: {
        ...sec.game,
        kind: 'kavram_avi' as const,
        rounds: (sec.game?.rounds ?? []).map((r) => ({
          ...r,
          word: r.word.toLocaleUpperCase('tr-TR'),
        })),
      },
      checkQuestionIds: qIds,
    };
  });

  const storedLesson = {
    version: 3,
    courseLabel: `${src.grade} ${src.lesson}`,
    sceneId: 'generic',
    guide: parsed.guide,
    sections: normalizedSections,
  };

  const { error: upsertErr } = await supabase.from('interactive_lessons').upsert(
    {
      topic_id: topicId,
      status: 'ready',
      voice_done: true,
      model,
      runs: 0,
      lesson: storedLesson,
      last_message: `v3 AI üretimi: ${normalizedSections.length} bölüm`,
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
