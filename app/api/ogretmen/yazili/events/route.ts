import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/app/src/lib/teacherAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { logPaperEvent } from '@/app/src/lib/yazili/paperEvents';

// Öğretmen kağıdı olumsuz sinyalleri (teacher_paper_events): sistemin seçtiği sorunun çıkarılması ve
// "Bu soruyu değiştir". İstemci ateşle-unut gönderir; sorular o yazılının konularına ait değilse kaydedilmez.
export async function POST(request: NextRequest) {
  const auth = await requireTeacher();
  if (!auth.ok) return auth.response;

  const b = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const examId = Number(b.examId);
  const questionId = Number(b.questionId);
  const replacedBy = b.replacedBy == null ? null : Number(b.replacedBy);
  const kind = b.kind === 'swap' ? 'swap' : b.kind === 'remove' ? 'remove' : null;
  const ids = [questionId, ...(replacedBy == null ? [] : [replacedBy])];
  if (!kind || !Number.isInteger(examId) || !ids.every(Number.isInteger) || (kind === 'swap') !== (replacedBy != null)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const [{ data: topicRows }, { data: questionRows }] = await Promise.all([
    supabase.from('exam_topics').select('topic_id').eq('exam_id', examId),
    supabase.from('questions').select('id, topic_id').in('id', ids),
  ]);
  const topicIds = new Set(((topicRows as { topic_id: number }[] | null) ?? []).map((t) => t.topic_id));
  const questions = (questionRows as { id: number; topic_id: number }[] | null) ?? [];
  if (questions.length !== ids.length || !questions.every((q) => topicIds.has(q.topic_id))) {
    return NextResponse.json({ error: 'Soru bu yazılıya ait değil' }, { status: 400 });
  }

  await logPaperEvent(
    kind === 'swap'
      ? { kind, teacherId: auth.user.id, examId, questionId, replacedBy: replacedBy! }
      : { kind, teacherId: auth.user.id, examId, questionId }
  );
  return new NextResponse(null, { status: 204 });
}
