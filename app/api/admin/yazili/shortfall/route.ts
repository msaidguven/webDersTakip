import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { examLabel, type ExamNo, type ExamTerm } from '@/app/src/lib/yazili/common';
import { nationalCountPerLo } from '@/app/src/lib/yazili/papers';
import { classicalByLo, loadClassicalCounts, loadTopicLoCodes, loadTopicOutcomes } from '@/app/src/lib/yazili/server';

// Admin → Yazılı Soruları → "Eksik havuz": tüm yazılılarda hangi öğrenme çıktısının klasik soru havuzu
// iki farklı kağıda (A/B) yetmiyor. Gereken = senaryolarda istenen en çok sayı × 2 (ülke genelinde
// kağıt kuralındaki pay × 2). Sınav tarihi yakın olan önce, tarihsizler sınıf/ders sırasıyla sonda.

type ExamRow = {
  id: number; grade_id: number; lesson_id: number; term: number; exam_no: number; status: string; national: boolean; exam_date: string | null;
  grades: { name: string; order_no: number }; lessons: { name: string; order_no: number };
  exam_topics: { topic_id: number }[]; exam_lo_targets: { lo_code: string; question_count: number }[];
};

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('exams')
    .select('id, grade_id, lesson_id, term, exam_no, status, national, exam_date, grades!inner(name, order_no), lessons!inner(name, order_no), exam_topics(topic_id), exam_lo_targets(lo_code, question_count)');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const exams = (data as unknown as ExamRow[] | null) ?? [];

  const topicIds = [...new Set(exams.flatMap((e) => e.exam_topics.map((t) => t.topic_id)))];
  const [outcomesByTopic, countsByTopic, loByTopic] = await Promise.all([
    loadTopicOutcomes(supabase, topicIds),
    loadClassicalCounts(supabase, topicIds),
    loadTopicLoCodes(supabase, topicIds),
  ]);
  const poolByTopic = new Map(topicIds.map((id) => [id, classicalByLo(id, outcomesByTopic, countsByTopic, loByTopic)]));

  const rows = exams
    .map((e) => {
      const need = new Map<string, number>();
      if (e.national) {
        const codes = [...new Set(e.exam_topics.flatMap((t) => loByTopic.get(t.topic_id) ?? []))];
        for (const c of codes) need.set(c, nationalCountPerLo(codes.length) * 2);
      } else {
        for (const t of e.exam_lo_targets) need.set(t.lo_code, Math.max(need.get(t.lo_code) ?? 0, t.question_count * 2));
      }
      const missing = [...need.entries()]
        .map(([loCode, needed]) => {
          const topics = e.exam_topics.map((t) => t.topic_id).filter((id) => (loByTopic.get(id) ?? []).includes(loCode));
          const have = topics.reduce((sum, id) => sum + (poolByTopic.get(id)?.[loCode] ?? 0), 0);
          return { loCode, needed, have, topicIds: topics };
        })
        .filter((m) => m.have < m.needed)
        .sort((a, b) => a.loCode.localeCompare(b.loCode, 'tr', { numeric: true }));
      return {
        examId: e.id,
        gradeId: e.grade_id,
        lessonId: e.lesson_id,
        term: e.term,
        examNo: e.exam_no,
        title: `${e.grades.name} ${e.lessons.name} · ${examLabel(e.term as ExamTerm, e.exam_no as ExamNo)}`,
        status: e.status,
        national: e.national,
        examDate: e.exam_date,
        gradeOrder: e.grades.order_no,
        lessonOrder: e.lessons.order_no,
        totalCodes: need.size,
        missing,
      };
    })
    .filter((r) => r.totalCodes > 0 && r.missing.length > 0)
    .sort((a, b) =>
      (a.examDate ?? '9999').localeCompare(b.examDate ?? '9999') ||
      a.term - b.term || a.examNo - b.examNo || a.gradeOrder - b.gradeOrder || a.lessonOrder - b.lessonOrder
    );

  // Görsel bekleyen klasik sorular taslakta kalır, havuza sayılmaz — admin'e ayrıca hatırlatılır.
  const svgPending = [...countsByTopic.values()].reduce((n, c) => n + c.svgPending, 0);
  const answerSvgPending = [...countsByTopic.values()].reduce((n, c) => n + c.answerSvgPending, 0);
  return NextResponse.json({ rows, svgPending, answerSvgPending });
}
