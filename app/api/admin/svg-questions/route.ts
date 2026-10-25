import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// svg_prompt dolu olan (AI'nin "bu soru için görsel gerekli" dediği) soruları, admin'in
// promptu kopyalayıp başka bir AI'ye verip SVG'yi yapıştırabileceği tek bir listede toplar.
// href, /soru-bankasi'ndeki ?soru=ID deep-link'i (bkz. app/api/admin/search/route.ts'teki
// aynı slug-zinciri çözümü) — kaydedilen SVG'yi admin'in canlıda görebilmesi için.

type Embed<T> = T | T[] | null;

function one<T>(v: Embed<T>): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] || null : v;
}

type GradeRef = { slug: string | null };
type LessonRef = { slug: string | null };
type UnitRef = { slug: string | null; grades: Embed<GradeRef>; lessons: Embed<LessonRef> };
type TopicRef = { title: string; slug: string | null; units: Embed<UnitRef> };

function resolveSlugChain(topics: Embed<TopicRef>) {
  const topic = one(topics);
  const unit = topic ? one(topic.units) : null;
  const grade = unit ? one(unit.grades) : null;
  const lesson = unit ? one(unit.lessons) : null;
  if (!grade?.slug || !lesson?.slug || !unit?.slug || !topic?.slug) return null;
  return { gradeSlug: grade.slug, lessonSlug: lesson.slug, unitSlug: unit.slug, topicSlug: topic.slug, topicTitle: topic.title };
}

type Row = {
  id: number;
  question_text: string;
  svg_prompt: string | null;
  svg_content: string | null;
  svg_position: 'above' | 'below';
  created_at: string;
  topics: Embed<TopicRef>;
};

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const status = request.nextUrl.searchParams.get('status') || 'pending';
  // ?tur=klasik: yalnız klasik (yazılı) sorular — Yazılı Soruları ekranındaki uyarı buraya bağlanır.
  // ?tur=cevap: cevap görseli işleri (question_classical.answer_svg_prompt dolu olanlar).
  const tur = request.nextUrl.searchParams.get('tur');
  const classicalOnly = tur === 'klasik';
  const supabase = createServiceClient();

  if (tur === 'cevap') return answerSvgItems(supabase, status);

  const base = supabase
    .from('questions')
    .select('id, question_text, svg_prompt, svg_content, svg_position, created_at, topics(title, slug, units(slug, grades(slug), lessons(slug)))')
    .not('svg_prompt', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);
  const filtered = classicalOnly ? base.eq('question_type_id', 4) : base;

  const { data, error } =
    status === 'pending' ? await filtered.is('svg_content', null) : status === 'done' ? await filtered.not('svg_content', 'is', null) : await filtered;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = ((data as Row[] | null) || []).map((row) => {
    const chain = resolveSlugChain(row.topics);
    return {
      id: row.id,
      question_text: row.question_text,
      svg_prompt: row.svg_prompt,
      svg_content: row.svg_content,
      svg_position: row.svg_position,
      topicTitle: chain?.topicTitle || null,
      href: chain ? `/soru-bankasi/${chain.gradeSlug}/${chain.lessonSlug}/${chain.unitSlug}/${chain.topicSlug}?soru=${row.id}` : null,
    };
  });

  return NextResponse.json({ items });
}

type AnswerRow = {
  question_id: number;
  model_answer: string | null;
  answer_svg_prompt: string;
  answer_svg_content: string | null;
  questions: Embed<Omit<Row, 'id'> & { id: number }>;
};

// Cevap görseli işleri. Sorunun kendi görseli bekleniyorsa (svg_prompt dolu, svg_content boş) cevap görseli
// ondan türetileceği için önce o girilmeli: questionSvgPending ile istemci "Kopyala"yı kapatır (plan kural 3).
async function answerSvgItems(supabase: ReturnType<typeof createServiceClient>, status: string) {
  const base = supabase
    .from('question_classical')
    .select(
      'question_id, model_answer, answer_svg_prompt, answer_svg_content, questions!inner(id, question_text, svg_prompt, svg_content, svg_position, created_at, topics(title, slug, units(slug, grades(slug), lessons(slug))))'
    )
    .not('answer_svg_prompt', 'is', null)
    .order('question_id', { ascending: false })
    .limit(200);
  const { data, error } =
    status === 'pending' ? await base.is('answer_svg_content', null) : status === 'done' ? await base.not('answer_svg_content', 'is', null) : await base;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = ((data as unknown as AnswerRow[] | null) || []).flatMap((row) => {
    const q = one(row.questions);
    if (!q) return [];
    const chain = resolveSlugChain(q.topics);
    return [
      {
        id: q.id,
        question_text: q.question_text,
        svg_prompt: q.svg_prompt,
        svg_content: q.svg_content,
        svg_position: q.svg_position,
        model_answer: row.model_answer,
        answer_svg_prompt: row.answer_svg_prompt,
        answer_svg_content: row.answer_svg_content,
        questionSvgPending: !!q.svg_prompt && !q.svg_content,
        topicTitle: chain?.topicTitle || null,
        // Klasik soru tek bir herkese açık sayfaya bağlı değil (birden çok yazılı kağıdında çıkabilir).
        href: null,
      },
    ];
  });
  return NextResponse.json({ items });
}
