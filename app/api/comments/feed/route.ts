import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

type Profile = { username: string | null; full_name: string | null; avatar_url: string | null } | null;
type CommentRow = {
  id: number;
  parent_comment_id: number | null;
  parent_ai_answer_id: number | null;
  body: string;
  status: 'pending' | 'published' | 'rejected' | 'deleted';
  created_at: string;
  student_id: string;
  profiles: Profile | Profile[];
};

const SELECT =
  'id, parent_comment_id, parent_ai_answer_id, body, status, created_at, student_id, profiles!question_comments_student_id_fkey(username, full_name, avatar_url)';

// UnitDiscussion.tsx ÖNCEDEN yorumları doğrudan tarayıcıdan (anon/authenticated
// key) çekiyordu — question_comments üzerindeki "published_public_read" policy'si
// herkese açık olsa da, embed edilen profiles!question_comments_student_id_fkey(...)
// için public.profiles'ta HİÇ SELECT RLS policy'si yok (bkz. app/api/profile/update/
// route.ts'teki AYNI not: "servis rolüyle okuyup uygulama katmanında yetkilendiriyoruz").
// Sonuç: embed'deki profiles her zaman null dönüyor, yorumcunun kullanıcı adı/PP'si
// KİMSEYE (giriş yapmış olsun olmasın) görünmüyordu (kullanıcı raporu, 2026-09-12).
// rag_answers için zaten aynı yaklaşım kullanılıyordu (bkz. /api/rag/unit-feed) — bu
// route AYNI deseni question_comments'e uyguluyor: service role ile server tarafında
// join edip herkese (giriş yapmamış ziyaretçi dahil) doğru isim/avatarla döndürüyor.
export async function GET(request: NextRequest) {
  const questionIdParam = request.nextUrl.searchParams.get('questionId');
  const unitIdParam = request.nextUrl.searchParams.get('unitId');
  const topicIdParam = request.nextUrl.searchParams.get('topicId');

  const questionId = questionIdParam != null ? Number(questionIdParam) : null;
  const unitId = unitIdParam != null ? Number(unitIdParam) : null;
  const topicId = topicIdParam != null ? Number(topicIdParam) : null;

  if (questionId == null && unitId == null && topicId == null) {
    return NextResponse.json({ error: 'questionId, topicId veya unitId gerekli' }, { status: 400 });
  }

  const service = createServiceClient();

  // Herkese açık: yayınlanmış yorumlar — question_comments_published_public_read
  // policy'sinin server tarafındaki eşdeğeri (bkz. supabase/migrations/question_comments.sql).
  let publishedQuery = service.from('question_comments').select(SELECT).eq('status', 'published');
  publishedQuery =
    questionId != null
      ? publishedQuery.eq('question_id', questionId)
      : topicId != null
        ? publishedQuery.eq('topic_id', topicId)
        : publishedQuery.eq('unit_id', unitId as number);
  const { data: publishedData, error: publishedError } = await publishedQuery.order('created_at', { ascending: true });
  if (publishedError) return NextResponse.json({ error: publishedError.message }, { status: 500 });

  // Giriş yapmışsa: kendi yorumunu (henüz onaylanmamış/reddedilmiş olsa bile) de ekle —
  // question_comments_own_read policy'sinin eşdeğeri, "onay bekliyor" durumunu kendi
  // ekranında görebilsin diye. Silinmiş (status='deleted') olanlar hiç kimseye gösterilmez.
  const authSupabase = await createClient();
  const { data: { user } } = await authSupabase.auth.getUser();
  let ownData: CommentRow[] = [];
  if (user) {
    let ownQuery = service
      .from('question_comments')
      .select(SELECT)
      .eq('student_id', user.id)
      .in('status', ['pending', 'rejected']);
    ownQuery =
      questionId != null
        ? ownQuery.eq('question_id', questionId)
        : topicId != null
          ? ownQuery.eq('topic_id', topicId)
          : ownQuery.eq('unit_id', unitId as number);
    const { data, error: ownError } = await ownQuery.order('created_at', { ascending: true });
    if (ownError) return NextResponse.json({ error: ownError.message }, { status: 500 });
    ownData = (data as CommentRow[] | null) || [];
  }

  const byId = new Map<number, CommentRow>();
  for (const row of [...((publishedData as CommentRow[] | null) || []), ...ownData]) byId.set(row.id, row);
  const items = Array.from(byId.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return NextResponse.json({ items });
}
