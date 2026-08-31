import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { DAILY_QUESTION_LIMIT, countTodayQuestions } from '@/app/src/lib/rag/dailyLimit';

// Öğrenci sayfasındaki "Soru Sor" formunun gösterilip gösterilmeyeceğine karar
// vermek için: bu sınıf/ders için en az bir işlenmiş (ready) ders notu var mı?
// rag_documents RLS ile service-role dışına kapalı, bu yüzden herkese açık bu
// route sadece bir boolean döner, doküman içeriğine dokunmaz. Giriş yapmış
// kullanıcı için günlük kalan soru hakkını da döner (widget bunu proaktif gösterir).
export async function GET(request: NextRequest) {
  const gradeId = Number(request.nextUrl.searchParams.get('gradeId'));
  const lessonId = Number(request.nextUrl.searchParams.get('lessonId'));

  if (!Number.isFinite(gradeId) || !Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'gradeId ve lessonId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from('rag_documents')
    .select('id', { count: 'exact', head: true })
    .eq('grade_id', gradeId)
    .eq('lesson_id', lessonId)
    .eq('status', 'ready');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let dailyRemaining: number | null = null;
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (user) {
    const askedToday = await countTodayQuestions(supabase, user.id);
    dailyRemaining = Math.max(0, DAILY_QUESTION_LIMIT - askedToday);
  }

  return NextResponse.json({ available: (count ?? 0) > 0, dailyRemaining });
}
