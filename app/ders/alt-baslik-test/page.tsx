'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw, Trophy, XCircle } from 'lucide-react';

type Choice = { id: number; choice_text: string; is_correct: boolean };
type Question = { id: number; question_text: string; choices: Choice[] };

function AltBaslikTestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionId = searchParams.get('sectionId');

  const [heading, setHeading] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!sectionId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/section-test-questions?sectionId=${sectionId}`);
        const data = await res.json().catch(() => null);
        if (!cancelled) {
          setHeading(data?.heading || '');
          setQuestions(res.ok ? data?.questions || [] : []);
          setIndex(0);
          setAnswers({});
          setShowResult(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [sectionId, reloadKey]);

  const current = questions[index];
  const answeredCount = Object.keys(answers).length;

  const score = useMemo(
    () =>
      questions.reduce((acc, q) => {
        const chosen = q.choices.find((c) => c.id === answers[q.id]);
        return acc + (chosen?.is_correct ? 1 : 0);
      }, 0),
    [questions, answers]
  );

  const selectAnswer = (choiceId: number) => {
    if (!current || answers[current.id] != null) return;
    setAnswers((prev) => ({ ...prev, [current.id]: choiceId }));
  };

  const goNext = () => {
    if (index < questions.length - 1) setIndex((i) => i + 1);
    else setShowResult(true);
  };

  const retry = () => setReloadKey((k) => k + 1);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm font-bold">Sorular hazırlanıyor...</span>
      </div>
    );
  }

  if (!sectionId || questions.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 shadow-sm">
          <Trophy className="h-8 w-8 text-slate-300" />
        </div>
        <h1 className="mb-2 text-lg font-black text-slate-800">Bu alt başlık için henüz soru yok</h1>
        <p className="mb-6 text-sm font-medium text-slate-500">Yakında bu konu için sorular eklenecek.</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-black text-white transition-colors hover:bg-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Geri Dön
        </button>
      </div>
    );
  }

  if (showResult) {
    const percent = Math.round((score / questions.length) * 100);
    return (
      <div className="mx-auto max-w-lg px-4 py-12 sm:py-16">
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
            <Trophy className="h-8 w-8 text-white" />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-indigo-600">{heading}</p>
          <h1 className="mt-1 text-2xl font-black text-slate-800">
            {score} / {questions.length} doğru
          </h1>
          <p className="mt-1 text-sm font-bold text-slate-400">%{percent} başarı</p>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Tekrar Çöz
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-black text-white transition-colors hover:bg-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Alt Başlığa Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  const chosenChoiceId = answers[current.id];
  const isAnswered = chosenChoiceId != null;

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1.5 text-xs font-bold text-slate-400 transition-colors hover:text-indigo-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Alt Başlığa Dön
      </button>

      <div className="mb-5">
        <div className="mb-1.5 flex items-center justify-between text-xs font-black text-slate-400">
          <span className="truncate uppercase tracking-widest text-indigo-600">{heading}</span>
          <span className="shrink-0">{answeredCount}/{questions.length}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-500 ease-out"
            style={{ width: `${(index / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-6">
        <p className="mb-5 text-base font-black leading-snug text-slate-800 sm:text-lg">{current.question_text}</p>

        <div className="space-y-2.5">
          {current.choices.map((choice) => {
            const isChosen = chosenChoiceId === choice.id;
            let stateClasses = 'border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40';
            if (isAnswered) {
              if (choice.is_correct) stateClasses = 'border-emerald-300 bg-emerald-50';
              else if (isChosen) stateClasses = 'border-rose-300 bg-rose-50';
              else stateClasses = 'border-slate-100 opacity-60';
            }
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => selectAnswer(choice.id)}
                disabled={isAnswered}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-bold text-slate-700 transition-colors disabled:cursor-default ${stateClasses}`}
              >
                <span>{choice.choice_text}</span>
                {isAnswered && choice.is_correct && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                {isAnswered && isChosen && !choice.is_correct && <XCircle className="h-4 w-4 shrink-0 text-rose-500" />}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={!isAnswered}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-black text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {index === questions.length - 1 ? 'Testi Bitir' : 'Sonraki Soru'}
        </button>
      </div>
    </div>
  );
}

export default function AltBaslikTestPage() {
  return (
    <Suspense fallback={null}>
      <AltBaslikTestContent />
    </Suspense>
  );
}
