import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { getDueSrsQuestionIds } from '@/app/src/lib/dashboardSrs';
import { getQuestionsByIds, MAX_QUESTIONS_PER_TEST, SECONDS_PER_QUESTION } from '@/app/src/lib/quizQuestions';
import { findResumableSession } from '@/app/src/lib/quizResume';
import QuizClient from '@/app/src/components/QuizClient';

export const dynamic = 'force-dynamic';

// "Şimdi Tekrar Et" (SRS widget) hedefi: kullanıcının hangi ders/üniteden olduğuna
// bakılmaksızın tüm tekrar borcunu (user_question_stats.next_review_at geçmiş olan sorular)
// tek bir testte toplar. Ünite/konu testlerinden farklı olarak sabit bir bağlamı yok, bu
// yüzden QuizWithAsk yerine doğrudan QuizClient kullanılıyor (Ask-AI widget'ı tek bir
// ünite/ders bağlamı gerektiriyor).
export default async function SrsReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirectTo=/tekrar');
  }

  const { data: profile } = await supabase.from('profiles').select('grade_id').eq('id', user.id).maybeSingle();
  const gradeId = (profile as { grade_id: number | null } | null)?.grade_id ?? null;

  // Kullanıcının zaten bitmemiş bir SRS oturumu varsa (unitId=null, topicId=null ile
  // işaretleniyor) sıfırdan yeni bir oturum açıp eskisini terk etmek yerine onunla devam
  // edilir — konu/ünite testlerindeki AYNI resume mekanizması (bkz. quizResume.ts). Öncesinde
  // her "/tekrar" ziyareti ayrı bir test_sessions satırı açıp hiçbirini bitirmiyordu
  // (kullanıcının 2026-09-06 bulduğu, DB'de sessizce biriken oturumlar).
  const resumable = await findResumableSession(supabase, user.id, null, null);
  const questionIds = resumable ? [] : await getDueSrsQuestionIds(supabase, user.id, gradeId, MAX_QUESTIONS_PER_TEST);

  if (!resumable && questionIds.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface shadow-sm text-3xl">
          🎉
        </div>
        <h1 className="mb-2 text-lg font-black text-default">Tekrar edilecek sorun yok</h1>
        <p className="mb-6 text-sm font-medium text-muted-foreground">
          Şu an için tüm tekrarların güncel. Yeni sorular çözdükçe zamanı gelenler burada belirecek.
        </p>
        <Link
          href="/panel"
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-xs font-black text-white transition-opacity hover:opacity-90"
        >
          Panele Dön
        </Link>
      </div>
    );
  }

  const initialQuestions = resumable ? resumable.questions : await getQuestionsByIds(questionIds);

  return (
    <QuizClient
      scopeLabel="Tekrar Zamanı"
      exitHref="/panel"
      exitLabel="Panele Dön"
      initialQuestions={initialQuestions}
      reloadEndpoint="/api/srs-review-questions"
      secondsPerQuestion={initialQuestions.length > 0 ? SECONDS_PER_QUESTION : undefined}
      intro={{
        subLabel: 'Aralıklı Tekrar',
        description: 'Bu sorular daha önce çözdüğün ve tekrar zamanı gelen sorular — hatırlamanı pekiştirmek için tam zamanı.',
        questionCount: initialQuestions.length,
      }}
      gradeId={gradeId}
      lessonId={null}
      unitId={null}
      topicId={null}
      resume={resumable ? { sessionId: resumable.sessionId, answers: resumable.answers } : undefined}
    />
  );
}
