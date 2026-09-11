import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { answerQuestionForBook, answerAsBuddy } from '@/app/src/lib/rag/answerQuestion';
import { buildContextResolver } from '@/app/src/lib/myComments';

// Ders sayfasından (test sorusu değil) sorulan @hocam sorularında öğrencinin
// hangi konuya baktığını modele bildirmek için — konunun başlığı + alt
// başlıklarını taze çekiyor (bkz. answerQuestionForBook'taki topicContext).
async function buildTopicContext(supabase: SupabaseClient, topicId: number | null): Promise<string | null> {
  if (topicId == null) return null;

  const { data: topicData } = await supabase.from('topics').select('id, title').eq('id', topicId).maybeSingle();
  const topic = topicData as { id: number; title: string } | null;
  if (!topic) return null;

  const { data: topicContentData } = await supabase
    .from('topic_contents')
    .select('id')
    .eq('topic_id', topicId)
    .maybeSingle();
  const topicContent = topicContentData as { id: number } | null;

  let headings: string[] = [];
  if (topicContent) {
    const { data: sectionsData } = await supabase
      .from('topic_content_sections')
      .select('heading, order_no')
      .eq('topic_content_id', topicContent.id)
      .order('order_no', { ascending: true });
    headings = ((sectionsData as { heading: string }[] | null) || []).map((s) => s.heading);
  }

  return `"${topic.title}" konusu.${headings.length ? ` Alt başlıklar: ${headings.join(', ')}.` : ''}`;
}

// Gemini'nin ücretsiz katmanının dakikalık istek limitine (RPM) aynı anda birden
// fazla öğrenci sorduğunda çok çabuk takılması yüzünden (2026-09-03), AI sorular
// artık /api/rag/ask'ta senkron cevaplanmıyor — rag_question_queue'ya yazılıyor.
// Bu route o kuyruğu işler: her tetiklenişte en eski ITEMS_PER_RUN kadar soruyu
// SIRAYLA (paralel değil — Gemini'ye art arda değil, birbiri bitince) cevaplayıp
// normal şekilde rag_answers'a yazar. Vercel Hobby planında Cron Jobs günde 1'le
// sınırlı olduğu için (Pro'da dakikalık mümkün), bu route dışarıdan tetikleniyor —
// önce GitHub Actions'taki bir workflow denendi ama scheduled tetikleyicileri
// güvenilmez çıktı (5 dakikada bir yerine 2-6 saatte bir çalışıyordu, 2026-09-09'da
// tespit edildi), bu yüzden Supabase pg_cron+pg_net'e taşındı: veritabanı her 5
// dakikada bir RAG_QUEUE_WORKER_SECRET ile korunan bir POST isteği atıyor
// (bkz. supabase/migrations/pg_cron_workers.sql).
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

    // Soru sorulduktan sonra, cevap gelmeden yorum silinmiş olabilir (normalde
    // /api/comments/[id] ve /api/admin/all-comments/[id] bu satırı zaten
    // temizliyor — bkz. o route'lardaki not, kullanıcı sorusu 2026-09-04). Bu,
    // o temizlikle çakışan küçük bir yarış penceresini (silme tam bu claim'le
    // aynı anda olduysa) ve olası eski/artık satırları kapatan ek bir güvenlik:
    // yorum artık yayında değilse boşuna AI'ye sormak yerine sessizce atlanır.
    if (row.comment_id != null) {
      const { data: parentComment } = await supabase
        .from('question_comments')
        .select('status')
        .eq('id', row.comment_id)
        .maybeSingle();
      if (!parentComment || parentComment.status !== 'published') {
        await supabase.from('rag_question_queue').delete().eq('id', row.id);
        continue;
      }
    }

    try {
      // Ders sayfasından (test sorusu değil) sorulan sorularda öğrencinin hangi
      // konuya baktığını modele bildirmiyorduk — "bu konuda nasıl çalışmalıyım"
      // gibi sorular hem aramada hem cevapta bağlamsız kalıp robotik bir "Bu bilgi
      // ders notlarında yok" reddine yol açıyordu (kullanıcı raporu, 2026-09-11).
      // topic_id zaten satırda duruyor (bkz. question_comments_topic_scope.sql) —
      // konunun başlığını + alt başlıklarını burada, cevap üretilirken taze çekip
      // answerQuestionForBook'a veriyoruz.
      const topicContext = row.mode !== 'kanka' ? await buildTopicContext(supabase, row.topic_id) : null;

      const result =
        row.mode === 'kanka'
          ? await answerAsBuddy(supabase, row.grade_id, row.lesson_id, row.unit_id, row.question, row.question_context, row.reply_context)
          : await answerQuestionForBook(supabase, row.grade_id, row.lesson_id, row.question, row.question_context, row.reply_context, topicContext);

      // Cevap, soru sorulduğunda hemen yayınlanan yoruma (bkz. /api/rag/ask,
      // comment_id) bir YANIT olarak ekleniyor — başka bir kullanıcının yanıtı gibi.
      const { error: insertError } = await supabase.from('rag_answers').insert({
        grade_id: row.grade_id,
        lesson_id: row.lesson_id,
        unit_id: row.unit_id,
        topic_id: row.topic_id,
        quiz_question_id: row.quiz_question_id,
        student_id: row.student_id,
        question: row.question,
        question_context: row.question_context,
        answer: result.answer,
        matched_chunk_ids: result.matchedChunkIds,
        model: result.model,
        status: 'published',
        parent_comment_id: row.comment_id,
      });
      if (insertError) throw new Error(insertError.message);

      await supabase.from('rag_question_queue').delete().eq('id', row.id);

      // Öğrenciye "cevabın hazır" bildirimi — header'daki zil bunu polling ile
      // gösterir (bkz. app/src/components/MainLayout.tsx). Bildirim oluşturma
      // başarısız olsa bile ana akışı (cevap zaten kaydedildi) bozmasın diye ayrı
      // bir try/catch'te, sessizce loglanarak geçiliyor.
      try {
        const resolve = await buildContextResolver(supabase, [{ questionId: row.quiz_question_id, unitId: row.unit_id }]);
        const { href } = resolve({ questionId: row.quiz_question_id, unitId: row.unit_id });
        const label = row.mode === 'kanka' ? '😄 Kanka' : '🎓 Hocam';
        const questionPreview = row.question.length > 80 ? `${row.question.slice(0, 80)}…` : row.question;
        await supabase.from('notifications').insert({
          user_id: row.student_id,
          type: 'rag_answer',
          title: `${label} sorunu cevapladı`,
          body: questionPreview,
          link: href ?? null,
        });
      } catch (notifyErr) {
        console.error('Bildirim oluşturma hatası (cevap yine de kaydedildi)', row.id, notifyErr);
      }

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
