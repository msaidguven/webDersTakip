import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { DEFAULT_EXAM_WEEKS, type ExamNo, type ExamTerm } from '@/app/src/lib/yazili/common';
import { classicalByLo, loadClassicalCounts, loadTopicLoCodes, loadTopicOutcomes, revalidateYaziliPages } from '@/app/src/lib/yazili/server';
import { mergeWeekSpans } from '@/app/src/lib/kazanimPlan';

// Admin → Yazılı Soruları: yazılının kapsamı (konular, MEB senaryo dağılımı) okunur, konu listesi /
// durum / tarih kaydedilir. MEB dağılımı yalnız Excel içe aktarımıyla yazılır (yazili/import).
// Parametresiz GET: sınıf-ders seçenekleri + kayıtlı yazılıların özeti. Sorular: yazili/questions.

type ExamRow = { id: number; week_from: number; week_to: number; status: 'draft' | 'published'; national: boolean; exam_date: string | null };

function parseExamKey(v: { gradeId: unknown; lessonId: unknown; term: unknown; examNo: unknown }) {
  const gradeId = Number(v.gradeId);
  const lessonId = Number(v.lessonId);
  const term = Number(v.term);
  const examNo = Number(v.examNo);
  if (!Number.isInteger(gradeId) || !Number.isInteger(lessonId) || ![1, 2].includes(term) || ![1, 2].includes(examNo)) return null;
  return { gradeId, lessonId, term: term as ExamTerm, examNo: examNo as ExamNo };
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const supabase = createServiceClient();
  const sp = request.nextUrl.searchParams;

  if (!sp.has('gradeId')) {
    const [{ data, error }, { data: examsData }] = await Promise.all([
      supabase.from('units').select('grade_id, lesson_id, grades(name, order_no), lessons(name, order_no)').eq('is_active', true),
      supabase.from('exams').select('grade_id, lesson_id, term, exam_no, status, exam_lo_targets(count)'),
    ]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    type Row = { grade_id: number; lesson_id: number; grades: { name: string; order_no: number } | null; lessons: { name: string; order_no: number } | null };
    const pairs = new Map<string, { gradeId: number; gradeName: string; gradeOrder: number; lessonId: number; lessonName: string; lessonOrder: number }>();
    for (const r of (data as unknown as Row[] | null) ?? []) {
      if (!r.grades || !r.lessons) continue;
      pairs.set(`${r.grade_id}-${r.lesson_id}`, {
        gradeId: r.grade_id, gradeName: r.grades.name, gradeOrder: r.grades.order_no,
        lessonId: r.lesson_id, lessonName: r.lessons.name, lessonOrder: r.lessons.order_no,
      });
    }
    type E = { grade_id: number; lesson_id: number; term: number; exam_no: number; status: string; exam_lo_targets: { count: number }[] };
    return NextResponse.json({
      pairs: [...pairs.values()].sort((a, b) => a.gradeOrder - b.gradeOrder || a.lessonOrder - b.lessonOrder),
      exams: ((examsData as unknown as E[] | null) ?? []).map((e) => ({
        gradeId: e.grade_id, lessonId: e.lesson_id, term: e.term, examNo: e.exam_no, status: e.status,
        hasMeb: (e.exam_lo_targets[0]?.count ?? 0) > 0,
      })),
    });
  }

  const key = parseExamKey({ gradeId: sp.get('gradeId'), lessonId: sp.get('lessonId'), term: sp.get('term'), examNo: sp.get('examNo') });
  if (!key) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const { data: examData } = await supabase
    .from('exams')
    .select('id, week_from, week_to, status, national, exam_date')
    .eq('grade_id', key.gradeId).eq('lesson_id', key.lessonId).eq('term', key.term).eq('exam_no', key.examNo)
    .maybeSingle();
  const exam = examData as ExamRow | null;
  const def = DEFAULT_EXAM_WEEKS[`${key.term}-${key.examNo}`];
  const weekFrom = exam?.week_from ?? def.from;
  const weekTo = exam?.week_to ?? def.to;

  const { data: topicsData, error: topicsError } = await supabase
    .from('topics')
    .select('id, title, order_no, units!inner(id, title, order_no, grade_id, lesson_id)')
    .eq('units.grade_id', key.gradeId)
    .eq('units.lesson_id', key.lessonId)
    .eq('is_active', true)
    .eq('is_archived', false);
  if (topicsError) return NextResponse.json({ error: topicsError.message }, { status: 500 });
  type TopicRow = { id: number; title: string; order_no: number; units: { id: number; title: string; order_no: number } };
  const topicRows = ((topicsData as unknown as TopicRow[] | null) ?? []).sort(
    (a, b) => a.units.order_no - b.units.order_no || a.order_no - b.order_no
  );
  const topicIds = topicRows.map((t) => t.id);

  const [outcomesByTopic, countsByTopic, loByTopic] = await Promise.all([
    loadTopicOutcomes(supabase, topicIds),
    loadClassicalCounts(supabase, topicIds),
    loadTopicLoCodes(supabase, topicIds),
  ]);

  let selectedIds: number[] = [];
  let targets: { scenario_no: number; lo_code: string; question_count: number }[] = [];
  if (exam) {
    const [{ data: et }, { data: tg }] = await Promise.all([
      supabase.from('exam_topics').select('topic_id, order_no').eq('exam_id', exam.id).order('order_no'),
      supabase.from('exam_lo_targets').select('scenario_no, lo_code, question_count').eq('exam_id', exam.id),
    ]);
    selectedIds = ((et as { topic_id: number }[] | null) ?? []).map((r) => r.topic_id);
    targets = (tg as typeof targets | null) ?? [];
  }
  if (!exam || (!selectedIds.length && !targets.length && !exam.national)) {
    // MEB tablosu yok: kazanım haftası kapsamla kesişen konular önerilir.
    selectedIds = topicRows
      .filter((t) => {
        const span = mergeWeekSpans((outcomesByTopic.get(t.id) ?? []).flatMap((o) => o.weeks));
        return span && span.start <= weekTo && span.end >= weekFrom;
      })
      .map((t) => t.id);
  }

  return NextResponse.json({
    exam: exam ? { id: exam.id, status: exam.status, national: exam.national, examDate: exam.exam_date } : null,
    weekFrom,
    weekTo,
    selectedIds,
    targets: targets.map((t) => ({ scenario: t.scenario_no, loCode: t.lo_code, count: t.question_count })),
    topics: topicRows.map((t) => ({
      id: t.id,
      title: t.title,
      unitTitle: t.units.title,
      span: mergeWeekSpans((outcomesByTopic.get(t.id) ?? []).flatMap((o) => o.weeks)),
      loCodes: loByTopic.get(t.id) ?? [],
      outcomes: outcomesByTopic.get(t.id) ?? [],
      classical: { total: countsByTopic.get(t.id)?.total ?? 0, svgPending: countsByTopic.get(t.id)?.svgPending ?? 0, answerSvgPending: countsByTopic.get(t.id)?.answerSvgPending ?? 0, byOutcome: countsByTopic.get(t.id)?.byOutcome ?? {}, byLo: classicalByLo(t.id, outcomesByTopic, countsByTopic, loByTopic) },
    })),
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as {
    gradeId?: unknown; lessonId?: unknown; term?: unknown; examNo?: unknown;
    weekFrom?: unknown; weekTo?: unknown; topicIds?: unknown; status?: unknown; examDate?: unknown;
  } | null;
  const key = body && parseExamKey({ gradeId: body.gradeId, lessonId: body.lessonId, term: body.term, examNo: body.examNo });
  const weekFrom = Number(body?.weekFrom);
  const weekTo = Number(body?.weekTo);
  const topicIds = Array.isArray(body?.topicIds) ? body.topicIds.filter((v): v is number => Number.isInteger(v)) : null;
  const status = body?.status === 'published' ? 'published' : 'draft';
  const examDate = typeof body?.examDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.examDate) ? body.examDate : null;
  if (!key || !topicIds || !Number.isInteger(weekFrom) || !Number.isInteger(weekTo) || weekFrom < 1 || weekTo > 40 || weekFrom > weekTo) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }
  if (status === 'published' && !topicIds.length) return NextResponse.json({ error: 'Konusu olmayan yazılı yayınlanamaz' }, { status: 400 });

  const supabase = createServiceClient();

  // Yalnız bu sınıf-dersin konuları kabul edilir.
  const { data: validTopics } = topicIds.length
    ? await supabase.from('topics').select('id, units!inner(grade_id, lesson_id)').in('id', topicIds)
      .eq('units.grade_id', key.gradeId).eq('units.lesson_id', key.lessonId)
    : { data: [] };
  if (((validTopics as { id: number }[] | null) ?? []).length !== topicIds.length) {
    return NextResponse.json({ error: 'Konu listesi bu derse ait değil' }, { status: 400 });
  }

  const { data: examRow, error: examError } = await supabase
    .from('exams')
    .upsert(
      { grade_id: key.gradeId, lesson_id: key.lessonId, term: key.term, exam_no: key.examNo, week_from: weekFrom, week_to: weekTo, status, exam_date: examDate, updated_at: new Date().toISOString() },
      { onConflict: 'grade_id,lesson_id,term,exam_no' }
    )
    .select('id')
    .single();
  if (examError || !examRow) return NextResponse.json({ error: examError?.message ?? 'Kaydedilemedi' }, { status: 500 });
  const examId = (examRow as { id: number }).id;

  const { error: delError } = await supabase.from('exam_topics').delete().eq('exam_id', examId);
  if (delError) return NextResponse.json({ error: 'Kapsam güncellenemedi' }, { status: 500 });
  if (topicIds.length) {
    const { error } = await supabase.from('exam_topics').insert(topicIds.map((topic_id, order_no) => ({ exam_id: examId, topic_id, order_no })));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateYaziliPages();
  return NextResponse.json({ ok: true, examId });
}
