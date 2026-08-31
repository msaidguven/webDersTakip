import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

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
    .select('id, question, answer, created_at, profiles!rag_answers_student_id_fkey(username, full_name, avatar_url)')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(100);

  query = questionId != null ? query.eq('quiz_question_id', questionId) : query.eq('unit_id', unitId as number);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [] });
}
