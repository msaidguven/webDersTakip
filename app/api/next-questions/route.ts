import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getQuestionsByIds } from '@/app/src/lib/quizQuestions';
import { getNextQuestionIds } from '@/app/src/lib/sequentialTest';

// "Sıradaki 10 soru" testinin "yeni test" yenilemesi (QuizClient reloadEndpoint): az önce
// çözülenler artık "çözülmüş" sayıldığı için bir sonraki 10 soru gelir. ?ids= verilirse
// (QuizClient'ın kalan soruları arka planda çekme sözleşmesi) sadece o sorular döner.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const ids = (params.get('ids') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length) return NextResponse.json({ questions: await getQuestionsByIds(ids.slice(0, 30)) });

  const lessonId = Number(params.get('lessonId'));
  if (!Number.isInteger(lessonId) || lessonId <= 0) return NextResponse.json({ error: 'Geçersiz ders' }, { status: 400 });

  const { data: profile } = await supabase.from('profiles').select('grade_id').eq('id', user.id).maybeSingle();
  const gradeId = (profile as { grade_id: number | null } | null)?.grade_id ?? null;
  if (!gradeId) return NextResponse.json({ questions: [] });

  const questionIds = await getNextQuestionIds(supabase, gradeId, lessonId);
  return NextResponse.json({ questions: questionIds.length ? await getQuestionsByIds(questionIds) : [] });
}
