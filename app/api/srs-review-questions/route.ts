import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getDueSrsQuestionIds } from '@/app/src/lib/dashboardSrs';
import { getQuestionsByIds, MAX_QUESTIONS_PER_TEST } from '@/app/src/lib/quizQuestions';

// QuizClient'ın "Tekrar Çöz" butonu bu endpoint'i çağırır — /tekrar sayfasının ilk
// yüklemesiyle aynı mantık: kullanıcının o anki gerçek tekrar borcunu yeniden hesaplar
// (sabit bir soru seti değil, sürekli güncel).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('grade_id').eq('id', user.id).maybeSingle();
  const gradeId = (profile as { grade_id: number | null } | null)?.grade_id ?? null;

  const questionIds = await getDueSrsQuestionIds(supabase, user.id, gradeId, MAX_QUESTIONS_PER_TEST);
  const questions = questionIds.length ? await getQuestionsByIds(questionIds) : [];

  return NextResponse.json({ questions });
}
