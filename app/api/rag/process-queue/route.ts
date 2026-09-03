import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { answerQuestionForBook, answerAsBuddy } from '@/app/src/lib/rag/answerQuestion';

// Gemini'nin ücretsiz katmanının dakikalık istek limitine (RPM) aynı anda birden
// fazla öğrenci sorduğunda çok çabuk takılması yüzünden (2026-09-03), AI sorular
// artık /api/rag/ask'ta senkron cevaplanmıyor — rag_question_queue'ya yazılıyor.
// Bu route o kuyruğu işler: her tetiklenişte en eski ITEMS_PER_RUN kadar soruyu
// SIRAYLA (paralel değil — Gemini'ye art arda değil, birbiri bitince) cevaplayıp
// normal şekilde rag_answers'a yazar. Vercel Hobby planında Cron Jobs günde 1'le
// sınırlı olduğu için (Pro'da dakikalık mümkün), bu route dışarıdan — GitHub
// Actions'taki zamanlanmış bir workflow'dan, 5 dakikada bir — RAG_QUEUE_WORKER_SECRET
// ile korunan bir POST isteğiyle tetikleniyor (bkz. .github/workflows/rag-queue-worker.yml).
const ITEMS_PER_RUN = 3;
const MAX_ATTEMPTS = 3;

export async function POST(request: NextRequest) {
  const secret = process.env.RAG_QUEUE_WORKER_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: candidates, error: fetchError } = await supabase
    .from('rag_question_queue')
    .select('*')
    .or(`status.eq.queued,and(status.eq.failed,attempts.lt.${MAX_ATTEMPTS})`)
    .order('created_at', { ascending: true })
    .limit(ITEMS_PER_RUN);

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ processed: 0, succeeded: 0, failed: 0 });
  }

  let succeeded = 0;
  let failed = 0;

  for (const row of candidates) {
    // Atomic claim: aynı satırı bu arada başka bir worker çalıştırması almışsa
    // (üst üste binen tetiklemeler) update 0 satır döner, sessizce atlanır.
    const { data: claimed } = await supabase
      .from('rag_question_queue')
      .update({ status: 'processing' })
      .eq('id', row.id)
      .in('status', ['queued', 'failed'])
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    try {
      const result =
        row.mode === 'kanka'
          ? await answerAsBuddy(supabase, row.grade_id, row.lesson_id, row.unit_id, row.question, row.question_context, row.reply_context)
          : await answerQuestionForBook(supabase, row.grade_id, row.lesson_id, row.question, row.question_context, row.reply_context);

      const { error: insertError } = await supabase.from('rag_answers').insert({
        grade_id: row.grade_id,
        lesson_id: row.lesson_id,
        unit_id: row.unit_id,
        quiz_question_id: row.quiz_question_id,
        student_id: row.student_id,
        question: row.question,
        question_context: row.question_context,
        answer: result.answer,
        matched_chunk_ids: result.matchedChunkIds,
        model: result.model,
        status: 'published',
        parent_comment_id: row.parent_comment_id,
        parent_rag_answer_id: row.parent_rag_answer_id,
      });
      if (insertError) throw new Error(insertError.message);

      await supabase.from('rag_question_queue').delete().eq('id', row.id);
      succeeded++;
    } catch (err) {
      const attempts = (row.attempts ?? 0) + 1;
      const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
      await supabase
        .from('rag_question_queue')
        .update({ status: attempts >= MAX_ATTEMPTS ? 'failed' : 'queued', attempts, error: message })
        .eq('id', row.id);
      console.error('RAG kuyruk işleme hatası', row.id, message);
      failed++;
    }
  }

  return NextResponse.json({ processed: candidates.length, succeeded, failed });
}
