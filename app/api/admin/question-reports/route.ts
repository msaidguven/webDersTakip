import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { revalidateUnitPagesForTopics } from '@/app/src/lib/topicPageRevalidation';

// Öğrencilerin "Hatalı soru bildir" kayıtları (question_reports.sql) — açık bildirimler soru
// bazında gruplanır. POST ile admin kararı:
//   hide    → soru yayından kalkar, bildirimler 'resolved'
//   fixed   → admin soruyu düzeltti; bildirimler 'resolved', otomatik gizlendiyse geri açılır
//   dismiss → soru doğru; bildirimler 'dismissed', otomatik gizlendiyse geri açılır

type Embed<T> = T | T[] | null;
const one = <T,>(v: Embed<T>): T | null => (!v ? null : Array.isArray(v) ? v[0] ?? null : v);

type QuestionEmbed = {
  id: number;
  question_text: string;
  solution_text: string | null;
  question_type_id: number;
  is_active: boolean;
  auto_hidden_at: string | null;
  ai_model: string | null;
  question_choices: { choice_text: string; is_correct: boolean }[];
  question_blank_options: { option_text: string; is_correct: boolean }[];
  topics: Embed<{ id: number; title: string; units: Embed<{ title: string; grades: Embed<{ name: string }>; lessons: Embed<{ name: string }> }> }>;
};

type ReportRow = { id: number; question_id: number; reason: string; note: string | null; created_at: string; questions: Embed<QuestionEmbed> };

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('question_reports')
    .select(
      'id, question_id, reason, note, created_at, questions!inner(id, question_text, solution_text, question_type_id, is_active, auto_hidden_at, ai_model, question_choices(choice_text, is_correct), question_blank_options(option_text, is_correct), topics(id, title, units(title, grades(name), lessons(name))))'
    )
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byQuestion = new Map<number, { question: QuestionEmbed; reports: { reason: string; note: string | null; createdAt: string }[] }>();
  for (const r of (data as ReportRow[] | null) || []) {
    const q = one(r.questions);
    if (!q) continue;
    const entry = byQuestion.get(q.id) ?? { question: q, reports: [] };
    entry.reports.push({ reason: r.reason, note: r.note, createdAt: r.created_at });
    byQuestion.set(q.id, entry);
  }

  const items = [...byQuestion.values()]
    .map(({ question: q, reports }) => {
      const topic = one(q.topics);
      const unit = one(topic?.units ?? null);
      const correct = q.question_choices.find((c) => c.is_correct)?.choice_text ?? q.question_blank_options.find((o) => o.is_correct)?.option_text ?? null;
      return {
        questionId: q.id,
        questionText: q.question_text,
        solutionText: q.solution_text,
        correctAnswer: correct,
        isActive: q.is_active,
        autoHidden: !!q.auto_hidden_at,
        aiModel: q.ai_model,
        topicId: topic?.id ?? null,
        context: [one(unit?.grades ?? null)?.name, one(unit?.lessons ?? null)?.name, topic?.title].filter(Boolean).join(' · '),
        reportCount: reports.length,
        reports,
      };
    })
    .sort((a, b) => b.reportCount - a.reportCount);

  // Başarısız / son konu partileri (otomatik soru üretimi durumu).
  const { data: batchRows } = await supabase
    .from('ai_topic_question_batches')
    .select('topic_id, round_no, status, started_at, published_at, question_count, svg_pending_count, last_error, topics(title)')
    .order('started_at', { ascending: false })
    .limit(30);
  const batches = ((batchRows as { topic_id: number; round_no: number; status: string; started_at: string; published_at: string | null; question_count: number | null; svg_pending_count: number | null; last_error: string | null; topics: Embed<{ title: string }> }[] | null) || []).map((b) => ({
    topicId: b.topic_id,
    roundNo: b.round_no,
    topicTitle: one(b.topics)?.title ?? `Konu ${b.topic_id}`,
    status: b.status,
    startedAt: b.started_at,
    publishedAt: b.published_at,
    questionCount: b.question_count,
    svgPendingCount: b.svg_pending_count,
    lastError: b.last_error,
  }));

  return NextResponse.json({ items, batches });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { questionId?: unknown; action?: unknown } | null;
  const questionId = Number(body?.questionId);
  const action = body?.action;
  if (!Number.isInteger(questionId) || (action !== 'hide' && action !== 'fixed' && action !== 'dismiss')) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: q, error: qError } = await supabase.from('questions').select('id, topic_id, auto_hidden_at').eq('id', questionId).maybeSingle();
  if (qError || !q) return NextResponse.json({ error: 'Soru bulunamadı' }, { status: 404 });
  const question = q as { id: number; topic_id: number | null; auto_hidden_at: string | null };

  if (action === 'hide') {
    const { error } = await supabase.from('questions').update({ is_active: false, auto_hidden_at: null }).eq('id', questionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (question.auto_hidden_at) {
    const { error } = await supabase.from('questions').update({ is_active: true, auto_hidden_at: null }).eq('id', questionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: rError } = await supabase
    .from('question_reports')
    .update({ status: action === 'dismiss' ? 'dismissed' : 'resolved', resolved_at: new Date().toISOString() })
    .eq('question_id', questionId)
    .eq('status', 'open');
  if (rError) return NextResponse.json({ error: rError.message }, { status: 500 });

  if (question.topic_id != null && (action === 'hide' || question.auto_hidden_at)) await revalidateUnitPagesForTopics(supabase, [question.topic_id]);
  return NextResponse.json({ ok: true });
}
