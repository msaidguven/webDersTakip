// app/src/components/QuizModalContent.tsx
// Konu kavrama testi ve ünite testinin modal içeriği — hem panelin hem soru bankasının
// intercepting route'ları (bkz. app/panel/@modal/... ve app/soru-bankasi/@modal/...) BU
// component'i çağırıyor. Tek fark: hangi sayfadan açıldıysa "X'e Dön" linki oraya gitsin
// diye exitHref/exitLabel dışarıdan veriliyor — kod/mantık kopyalanmıyor, sadece çıkış
// hedefi değişiyor (bkz. kullanıcının 2026-09-05 isteği: soru bankası ve panel aynı test
// motorunu, farklı giriş noktalarından modal olarak açsın).
import { notFound } from 'next/navigation';
import { SECONDS_PER_QUESTION } from '@/app/src/lib/quizQuestions';
import {
  getTopicTestPageData,
  getUnitTestPageData,
  loadTopicQuizState,
  loadUnitQuizState,
  buildTopicPath,
  buildQuestionBankPath,
} from '@/app/src/lib/quizPageData';
import QuizWithAsk from '@/app/src/components/QuizWithAsk';
import QuizModal from '@/app/src/components/QuizModal';

export async function TopicTestModalContent({
  gradeSlug,
  lessonSlug,
  unitSlug,
  topicSlug,
  exitHref,
  exitLabel = 'Konuya Dön',
}: {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
  topicSlug: string;
  // Verilmezse davranış panelin her zamanki modalıyla birebir aynı kalır: konunun içerik
  // sayfasına döner. Soru bankası modalı bunu kendi sayfasına dönecek şekilde eziyor.
  exitHref?: string;
  exitLabel?: string;
}) {
  const data = await getTopicTestPageData(gradeSlug, lessonSlug, unitSlug, topicSlug);
  if (!data) notFound();

  const { resumable, initialQuestions, remainingQuestionIds, allCaughtUp } = await loadTopicQuizState(data);

  return (
    <QuizModal>
      <QuizWithAsk
        key={data.topicId}
        gradeId={data.gradeId}
        lessonId={data.lessonId}
        unitId={data.unitId}
        topicId={data.topicId}
        scopeLabel={`${data.topicTitle} Kavrama Testi`}
        exitHref={exitHref ?? buildTopicPath(data)}
        exitLabel={exitLabel}
        initialQuestions={initialQuestions}
        remainingQuestionIds={remainingQuestionIds}
        allCaughtUp={allCaughtUp}
        reloadEndpoint={`/api/topic-test-questions?topicId=${data.topicId}`}
        secondsPerQuestion={initialQuestions.length > 0 ? SECONDS_PER_QUESTION : undefined}
        resume={resumable ? { sessionId: resumable.sessionId, answers: resumable.answers } : null}
        questionBankPathBase={buildQuestionBankPath(data)}
      />
    </QuizModal>
  );
}

export async function UnitTestModalContent({
  gradeSlug,
  lessonSlug,
  unitSlug,
  exitHref,
  exitLabel = 'Üniteye Dön',
}: {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
  // Verilmezse davranış panelin her zamanki modalıyla birebir aynı: ünitenin ilk konusuna
  // döner (data.exitHref). Soru bankası modalı bunu kendi sayfasına dönecek şekilde eziyor.
  exitHref?: string;
  exitLabel?: string;
}) {
  const data = await getUnitTestPageData(gradeSlug, lessonSlug, unitSlug);
  if (!data) notFound();

  const { resumable, initialQuestions, remainingQuestionIds, allCaughtUp } = await loadUnitQuizState(data);

  return (
    <QuizModal>
      <QuizWithAsk
        key={data.unitId}
        gradeId={data.gradeId}
        lessonId={data.lessonId}
        unitId={data.unitId}
        scopeLabel={`${data.unitTitle} Ünite Testi`}
        exitHref={exitHref ?? data.exitHref}
        exitLabel={exitLabel}
        initialQuestions={initialQuestions}
        remainingQuestionIds={remainingQuestionIds}
        allCaughtUp={allCaughtUp}
        reloadEndpoint={`/api/unit-test-questions?unitId=${data.unitId}`}
        secondsPerQuestion={initialQuestions.length > 0 ? SECONDS_PER_QUESTION : undefined}
        resume={resumable ? { sessionId: resumable.sessionId, answers: resumable.answers } : null}
        intro={{
          subLabel: `${data.gradeName} / ${data.lessonName}`,
          description: data.unitDescription,
          topicCount: data.topicCount,
          questionCount: data.questionCount,
        }}
      />
    </QuizModal>
  );
}
