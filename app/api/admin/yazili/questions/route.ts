import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { parseQuestions, TYPE_ID, type ParsedClassical } from '@/app/src/lib/parseMixedQuestions';
import { insertQuestions } from '@/app/src/lib/questionInsert';
import { loadTopicOutcomes, revalidateYaziliPages } from '@/app/src/lib/yazili/server';

// Yazılı soruları — bir konunun klasik soruları.
//   GET  ?topicId          liste (düzenleme/silme mevcut /api/admin/manage/questions ile)
//   POST {topicId, payload, dryRun}
//        payload = AI'dan dönen JSON ya da elle eklenen tek soru (aynı şema + outcome_code, difficulty).
//        dryRun: kaydetmeden önizleme — her sorunun kazanımı çözülür, çözülemeyen işaretlenir.
//        Kaydetmede kazanımı çözülemeyen soru varsa hiçbiri kaydedilmez.

const MAX_QUESTIONS = 30;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const topicId = Number(request.nextUrl.searchParams.get('topicId'));
  if (!Number.isInteger(topicId)) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('questions')
    .select('id, question_text, difficulty, is_active, svg_prompt, svg_content, svg_position, question_classical(model_answer, key_terms, rubric), question_outcomes(outcome_id)')
    .eq('topic_id', topicId)
    .eq('question_type_id', TYPE_ID.classical)
    .order('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  type Row = {
    id: number; question_text: string; difficulty: number | null; is_active: boolean;
    svg_prompt: string | null; svg_content: string | null; svg_position: string;
    question_classical: { model_answer: string; key_terms: string[] | null; rubric: string | null } | null;
    question_outcomes: { outcome_id: number }[];
  };
  return NextResponse.json({
    questions: ((data as unknown as Row[] | null) ?? []).map((q) => ({
      id: q.id,
      questionText: q.question_text,
      difficulty: q.difficulty,
      isActive: q.is_active,
      svgPending: !!q.svg_prompt && !q.svg_content,
      svgContent: q.svg_content,
      svgPosition: q.svg_position,
      modelAnswer: q.question_classical?.model_answer ?? '',
      keyTerms: q.question_classical?.key_terms ?? [],
      rubric: q.question_classical?.rubric ?? null,
      outcomeIds: q.question_outcomes.map((o) => o.outcome_id),
    })),
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { topicId?: unknown; payload?: unknown; dryRun?: unknown } | null;
  const topicId = Number(body?.topicId);
  if (!Number.isInteger(topicId)) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const payload = body?.payload as { ai_model?: unknown; questions?: unknown } | null;
  const parsed = parseQuestions(payload, MAX_QUESTIONS);
  if (!parsed) return NextResponse.json({ error: `Geçersiz JSON: her soruda "question_text" ve "model_answer" olmalı (en çok ${MAX_QUESTIONS} soru).` }, { status: 400 });
  if (parsed.some((q) => q.kind !== 'classical')) return NextResponse.json({ error: 'Yalnız klasik ("classical") soru kabul edilir.' }, { status: 400 });

  const supabase = createServiceClient();
  const outcomes = (await loadTopicOutcomes(supabase, [topicId])).get(topicId) ?? [];
  const norm = (s: string) => s.trim().replace(/^[(\[]+|[)\].:\s]+$/g, '').toLocaleLowerCase('tr');
  const raw = (payload?.questions as Record<string, unknown>[]) ?? [];

  const items = (parsed as ParsedClassical[]).map((q, i) => {
    const code = typeof raw[i]?.outcome_code === 'string' ? (raw[i].outcome_code as string) : '';
    const outcome = code ? outcomes.find((o) => norm(o.key) === norm(code)) : outcomes.length === 1 ? outcomes[0] : undefined;
    const d = Number(raw[i]?.difficulty);
    return { q, outcomeId: outcome?.id ?? null, outcomeKey: outcome?.key ?? null, rawCode: code, difficulty: Number.isInteger(d) && d >= 1 && d <= 5 ? d : 3 };
  });

  if (body?.dryRun === true) {
    return NextResponse.json({
      items: items.map((it) => ({
        questionText: it.q.question_text, modelAnswer: it.q.model_answer, keyTerms: it.q.key_terms,
        svgPrompt: it.q.svg_prompt, answerSvgPrompt: it.q.answer_svg_prompt, rubric: it.q.rubric, outcomeKey: it.outcomeKey, rawCode: it.rawCode, difficulty: it.difficulty,
      })),
    });
  }

  const unresolved = items.filter((it) => it.outcomeId == null).length;
  if (unresolved) return NextResponse.json({ error: `${unresolved} sorunun kazanım kodu tanınmadı — önizlemede kırmızı olanları düzelt.` }, { status: 400 });

  const aiModel = typeof payload?.ai_model === 'string' && payload.ai_model.trim() ? payload.ai_model.trim().slice(0, 100) : null;
  let saved = 0;
  let svgPending = 0;
  for (const it of items) {
    const res = await insertQuestions(supabase, {
      topicId, sectionId: null, outcomeIds: [it.outcomeId as number], questions: [it.q], aiModel, difficulty: it.difficulty,
    });
    if (!res.ok) return NextResponse.json({ error: res.error, saved }, { status: 500 });
    saved += res.savedCount;
    svgPending += res.svgPendingCount;
  }
  revalidateYaziliPages();
  // Cevap görseli bekleyenler yalnız bilgi: yayını ve havuzu etkilemez (plan kural 1).
  const answerSvgPending = items.filter((it) => it.q.answer_svg_prompt).length;
  return NextResponse.json({ ok: true, saved, svgPending, answerSvgPending });
}
