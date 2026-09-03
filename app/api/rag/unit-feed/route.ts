import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { CHAT_MODEL } from '@/app/src/lib/rag/gemini';

// Yayınlanmış soru-cevaplar — herkese açık, tıpkı yorum gibi (kim sormuşsa görünür,
// sadece soran değil). İki farklı kapsamda çalışır:
// - questionId verilirse: SADECE o test sorusuna özel Q&A'lar (test sayfasındaki
//   "neden A" akışı — farklı soruların açıklamaları birbirine karışmasın diye).
// - unitId verilirse: o ünitenin GENEL soru-cevap akışı (ders sayfasındaki soru sor).
// Kişisel/özel sohbet ayrı bir özellik olarak düşünüldüğü için bu akış bilerek
// herkese açık; giriş yapmamış ziyaretçi de görebilir, sadece soru soramaz.
export async function GET(request: NextRequest) {
  const questionIdParam = request.nextUrl.searchParams.get('questionId');
  const unitIdParam = request.nextUrl.searchParams.get('unitId');

  const questionId = questionIdParam != null ? Number(questionIdParam) : null;
  const unitId = unitIdParam != null ? Number(unitIdParam) : null;

  if (questionId == null && unitId == null) {
    return NextResponse.json({ error: 'questionId veya unitId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();
  let query = supabase
    .from('rag_answers')
    // rag_answers'ın profiles'a iki FK'sı var (student_id, reviewed_by) — hangisini
    // kullanacağını PostgREST'e açıkça söylemek gerekiyor, yoksa "ambiguous embed" hatası verir.
    .select('id, question, answer, model, created_at, student_id, parent_comment_id, parent_rag_answer_id, profiles!rag_answers_student_id_fkey(username, full_name, avatar_url)')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(100);

  // Bir satırda hem unit_id hem quiz_question_id dolu olabilir (test sayfasından
  // sorulan sorular ikisini de taşır). Genel ünite akışı bu yüzden quiz_question_id
  // boş olanlarla sınırlanıyor — yoksa soru-özel "neden A" cevapları da karışırdı.
  query =
    questionId != null
      ? query.eq('quiz_question_id', questionId)
      : query.eq('unit_id', unitId as number).is('quiz_question_id', null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const answered = (data || []).map((row) => ({ ...row, status: 'published' as const, answer: (row as { answer: string }).answer }));

  // Sorular artık senkron cevaplanmıyor (bkz. /api/rag/process-queue) — giriş yapmış
  // kullanıcı, KENDİ kuyrukta bekleyen (henüz cevabı olmayan) sorusunu da bu akışta
  // görsün diye ekleniyor. Sorunun kendisi zaten normal bir yorum olarak anında
  // yayınlanmıştı (bkz. /api/rag/ask); burada eklenen sadece "cevap hazırlanıyor"
  // yer tutucusu — comment_id sayesinde o yoruma YANIT olarak nest ediliyor (tıpkı
  // gerçek cevap gelince rag_answers'ta olacağı gibi). comment_id'si olmayan (eski,
  // bu alan eklenmeden önce kuyruğa girmiş) satırlar atlanıyor.
  let queuedItems: unknown[] = [];
  const authSupabase = await createClient();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (user) {
    let queueQuery = supabase
      .from('rag_question_queue')
      .select('id, question, mode, status, created_at, student_id, comment_id')
      .eq('student_id', user.id)
      .not('comment_id', 'is', null)
      .order('created_at', { ascending: false });
    queueQuery =
      questionId != null
        ? queueQuery.eq('quiz_question_id', questionId)
        : queueQuery.eq('unit_id', unitId as number).is('quiz_question_id', null);
    const { data: queueRows } = await queueQuery;
    queuedItems = (queueRows || []).map((row) => ({
      id: row.id,
      question: row.question,
      status: row.status,
      created_at: row.created_at,
      student_id: row.student_id,
      model: row.mode === 'kanka' ? `${CHAT_MODEL}-kanka` : CHAT_MODEL,
      answer: null,
      profiles: null,
      parent_comment_id: row.comment_id,
      parent_rag_answer_id: null,
    }));
  }

  return NextResponse.json({ items: [...queuedItems, ...answered] });
}
