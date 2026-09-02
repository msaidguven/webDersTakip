'use client';

// /soru/[id] paylaşım sayfasının istemci tarafı: QuizClient.tsx'teki soru tipi
// bileşenlerini (OptionsView/MatchingView/ClassicalView/QuestionSvg/TYPE_LABELS) AYNEN
// yeniden kullanır — burada tek bir soru, test oturumu/istatistik kaydı OLMADAN
// (misafir de görebilir) çözülüp açıklaması istenirse gösterilebilir.

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Eye, XCircle } from 'lucide-react';
import type { QuizQuestion } from '@/app/src/lib/quizQuestions';
import type { PublicQuestionContext } from '@/app/src/lib/publicQuestion';
import { ClassicalView, MatchingView, OptionsView, TYPE_LABELS } from './QuizClient';
import UnitDiscussion from './UnitDiscussion';

export default function PublicQuestionClient({ question, context }: { question: QuizQuestion; context: PublicQuestionContext }) {
  const [selectedId, setSelectedId] = useState<number | undefined>(undefined);
  const [matchAssign, setMatchAssign] = useState<Record<number, number>>({});
  const [classicalAnswer, setClassicalAnswer] = useState('');
  const [locked, setLocked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const topicHref = `/${context.gradeSlug}/${context.lessonSlug}/${context.unitSlug}/${context.topicSlug}`;
  const testHref = `${topicHref}/kavrama-testi`;

  function selectAnswer(optionId: number) {
    if (question.type === 'matching' || question.type === 'classical' || locked) return;
    const options = question.type === 'multiple_choice' ? question.choices : question.options;
    const chosen = options.find((o) => o.id === optionId);
    setSelectedId(optionId);
    setLocked(true);
    setIsCorrect(!!chosen?.is_correct);
  }

  function assignMatch(leftId: number, rightId: number) {
    if (question.type !== 'matching' || locked) return;
    setMatchAssign((prev) => {
      const next = { ...prev };
      for (const [l, r] of Object.entries(next)) {
        if (r === rightId) delete next[Number(l)];
      }
      next[leftId] = rightId;
      return next;
    });
  }

  function checkMatching() {
    if (question.type !== 'matching' || locked) return;
    if (Object.keys(matchAssign).length !== question.pairs.length) return;
    setLocked(true);
    setIsCorrect(question.pairs.every((p) => matchAssign[p.id] === p.id));
  }

  function checkClassical() {
    if (question.type !== 'classical' || locked) return;
    setLocked(true);
  }

  return (
    <div className="mx-auto max-w-lg px-3 py-4 sm:px-4 sm:py-12">
      <Link href={topicHref} className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-indigo-500 sm:mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> {context.topicTitle}&apos;a Dön
      </Link>

      <div className="mb-3 rounded-2xl border border-default bg-surface-elevated p-3.5 sm:mb-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-500">
          {context.gradeName} • {context.lessonName}
        </p>
        <h1 className="mt-1 text-lg font-black leading-tight text-default sm:text-2xl">{context.topicTitle}</h1>
      </div>

      <div className="rounded-2xl border border-default bg-surface-elevated p-3.5 shadow-sm sm:p-6">
        <span className="mb-2 inline-block rounded-full bg-surface px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground sm:mb-3">
          {TYPE_LABELS[question.type]}
        </span>

        {question.type === 'matching' && (
          <MatchingView question={question} assignment={matchAssign} locked={locked} onAssign={assignMatch} onCheck={checkMatching} />
        )}
        {question.type === 'classical' && (
          <ClassicalView
            question={question}
            value={classicalAnswer}
            locked={locked}
            explanationRevealed={revealed}
            onChange={setClassicalAnswer}
            onCheck={checkClassical}
            onRevealExplanation={() => setRevealed(true)}
          />
        )}
        {(question.type === 'multiple_choice' || question.type === 'blank') && (
          <OptionsView question={question} selectedId={selectedId} locked={locked} onSelect={selectAnswer} />
        )}

        {locked && question.type !== 'classical' && (
          <div className={`mt-3 rounded-xl border p-3.5 sm:mt-4 sm:p-4 ${isCorrect ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-rose-400/40 bg-rose-500/10'}`}>
            <p className={`flex items-center gap-1.5 text-sm font-black ${isCorrect ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {isCorrect ? 'Doğru! 🎉' : 'Olsun, öğrenmenin bir parçası! 🌱'}
            </p>
            {(question.type === 'matching' || question.solution_text) && !revealed && (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="mt-2 flex items-center gap-1.5 text-xs font-black text-indigo-500 hover:underline"
              >
                <Eye className="h-3.5 w-3.5" /> Açıklamayı Göster
              </button>
            )}
            {revealed && question.type !== 'matching' && question.solution_text && (
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-muted-foreground">{question.solution_text}</p>
            )}
            {revealed && question.type === 'matching' && !isCorrect && (
              <ul className="mt-1.5 space-y-1 text-sm font-medium leading-relaxed text-muted-foreground">
                {question.pairs
                  .filter((p) => matchAssign[p.id] !== p.id)
                  .map((p) => (
                    <li key={p.id}>
                      <span className="font-black text-default">{p.left_text}</span> → {p.right_text}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        <Link
          href={testHref}
          className="mt-4 flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-black text-white transition-opacity hover:opacity-90 sm:mt-6 sm:h-12"
        >
          Bu Konunun Testini Çöz
        </Link>
      </div>

      <div className="mt-4 sm:mt-6">
        <UnitDiscussion gradeId={context.gradeId} lessonId={context.lessonId} unitId={context.unitId} quizQuestionId={question.id} isAnswered={locked} />
      </div>
    </div>
  );
}
