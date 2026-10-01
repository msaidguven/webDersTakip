import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getQuestionsByIds, SECONDS_PER_QUESTION } from '@/app/src/lib/quizQuestions';
import { findResumableSession } from '@/app/src/lib/quizResume';
import { getNextQuestionIds, sequentialTestHref } from '@/app/src/lib/sequentialTest';
import QuizClient from '@/app/src/components/QuizClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sıradaki 10 soru', robots: { index: false, follow: false } };

// "Sıradaki 10 soru" (2026-10-01, girişli anasayfa → Derslerim): dersin başından müfredat
// sırasıyla, öğrencinin hiç çözmediği sorular. Yarım kalan oturum varsa o devam ettirilir
// (ders bazında — bkz. findResumableSession lessonId parametresi; /tekrar ile karışmaz).
export default async function SequentialTestPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId: raw } = await params;
  const lessonId = Number(raw);
  if (!Number.isInteger(lessonId) || lessonId <= 0) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(sequentialTestHref(lessonId))}`);

  const [{ data: profile }, { data: lesson }] = await Promise.all([
    supabase.from('profiles').select('grade_id').eq('id', user.id).maybeSingle(),
    supabase.from('lessons').select('name').eq('id', lessonId).eq('is_active', true).maybeSingle(),
  ]);
  if (!lesson) notFound();
  const lessonName = (lesson as { name: string }).name;
  const gradeId = (profile as { grade_id: number | null } | null)?.grade_id ?? null;
  if (!gradeId) redirect(`/profil?next=${encodeURIComponent(sequentialTestHref(lessonId))}`);

  const resumable = await findResumableSession(supabase, user.id, null, null, gradeId, lessonId);
  const questionIds = resumable ? [] : await getNextQuestionIds(supabase, gradeId, lessonId);

  if (!resumable && questionIds.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-16 text-center">
        <h1 className="text-xl font-black text-default">{lessonName}: sıradaki soru kalmadı</h1>
        <p className="text-sm text-muted-foreground">
          Bu dersin şu ana kadarki konularında çözmediğin soru yok. Yanlış yaptıkların tekrar zamanı gelince karşına
          çıkacak; yeni konular işlendikçe ve yeni sorular eklendikçe burada devam edersin.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link href="/tekrar" className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white hover:bg-indigo-700">
            Tekrarlara bak
          </Link>
          <Link href="/" className="rounded-xl bg-surface px-5 py-3 text-sm font-extrabold text-default hover:bg-surface-elevated">
            Anasayfaya dön
          </Link>
        </div>
      </div>
    );
  }

  const initialQuestions = resumable ? resumable.questions : await getQuestionsByIds(questionIds);

  return (
    <QuizClient
      presentation="player"
      scopeLabel={`${lessonName} · Sıradaki sorular`}
      exitHref="/"
      exitLabel="Anasayfaya Dön"
      initialQuestions={initialQuestions}
      reloadEndpoint={`/api/next-questions?lessonId=${lessonId}`}
      secondsPerQuestion={initialQuestions.length > 0 ? SECONDS_PER_QUESTION : undefined}
      intro={{
        subLabel: 'Sıradaki 10 soru',
        description: `${lessonName} dersinin başından, konu sırasıyla henüz çözmediğin sorular. Geride kalan konuları böyle tamamlarsın.`,
        questionCount: initialQuestions.length,
      }}
      gradeId={gradeId}
      lessonId={lessonId}
      unitId={null}
      topicId={null}
      resume={resumable ? { sessionId: resumable.sessionId, answers: resumable.answers } : undefined}
    />
  );
}
