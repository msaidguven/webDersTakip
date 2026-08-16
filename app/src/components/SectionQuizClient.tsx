'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw, Trophy, XCircle } from 'lucide-react';

type Option = { id: number; text: string; is_correct: boolean };
type Pair = { id: number; left_text: string; right_text: string };

type MultipleChoiceQuestion = { id: number; type: 'multiple_choice'; question_text: string; solution_text: string | null; choices: Option[] };
type BlankQuestion = { id: number; type: 'blank'; question_text: string; solution_text: string | null; options: Option[] };
type MatchingQuestion = { id: number; type: 'matching'; pairs: Pair[] };
type Question = MultipleChoiceQuestion | BlankQuestion | MatchingQuestion;

const CORRECT_MESSAGES = [
  'Harika! 🎉',
  'Süpersin! ⭐',
  'Tam isabet! 🎯',
  'Çok iyi gidiyorsun! 🚀',
  'Mükemmel! ✨',
  'Bravo! 👏',
  'Doğru bildin! ✅',
  'Harikasın! 🌟',
  'İşte bu! 💪',
  'Tebrikler! 🏆',
  'Muhteşemsin! 🔥',
  'Tam üstüne bastın! 🎯',
  'Çok başarılısın! 🥳',
  'Bir dahi gibisin! 🧠',
  'Yıldız gibi parlıyorsun! ⭐',
  'Bu doğru cevap! ✔️',
  'Kesinlikle doğru! 💯',
  'Çok zekisin! 💡',
  'Aferin sana! 👍',
  'Böyle devam! 🚀',
  'Sen bir şampiyonsun! 🏅',
  'Harika bir cevap! 🎊',
  'Tam olarak doğru! 🎈',
  'Süper performans! 🌈',
];

const INCORRECT_MESSAGES = ['Olsun, öğrenmenin bir parçası! 🌱', 'Az kalsın, bir dahakine yakalarsın 💪', 'Sorun değil, doğrusuna bakalım 👇', 'Bu sefer olmadı ama devam! ✨'];

const TYPE_LABELS: Record<Question['type'], string> = {
  multiple_choice: 'Çoktan Seçmeli',
  blank: 'Boşluk Doldurma',
  matching: 'Eşleştirme',
};

function randomOf(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function OptionsView({
  question,
  selectedId,
  locked,
  onSelect,
}: {
  question: MultipleChoiceQuestion | BlankQuestion;
  selectedId: number | undefined;
  locked: boolean;
  onSelect: (optionId: number) => void;
}) {
  const options = question.type === 'multiple_choice' ? question.choices : question.options;

  return (
    <>
      {question.type === 'blank' ? (
        <p className="mb-5 text-base font-black leading-snug text-slate-800 sm:text-lg">
          {question.question_text.split('_____').map((part, i, arr) => (
            <Fragment key={i}>
              {part}
              {i < arr.length - 1 && (
                <span className="mx-1 inline-block min-w-[90px] rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-center text-indigo-600">
                  {selectedId ? options.find((o) => o.id === selectedId)?.text : '…'}
                </span>
              )}
            </Fragment>
          ))}
        </p>
      ) : (
        <p className="mb-5 text-base font-black leading-snug text-slate-800 sm:text-lg">{question.question_text}</p>
      )}

      <div className="space-y-2.5">
        {options.map((opt) => {
          const isChosen = selectedId === opt.id;
          let stateClasses = 'border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40';
          if (locked) {
            if (opt.is_correct) stateClasses = 'border-emerald-300 bg-emerald-50';
            else if (isChosen) stateClasses = 'border-rose-300 bg-rose-50';
            else stateClasses = 'border-slate-100 opacity-60';
          }
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              disabled={locked}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-bold text-slate-700 transition-colors disabled:cursor-default ${stateClasses}`}
            >
              <span>{opt.text}</span>
              {locked && opt.is_correct && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
              {locked && isChosen && !opt.is_correct && <XCircle className="h-4 w-4 shrink-0 text-rose-500" />}
            </button>
          );
        })}
      </div>
    </>
  );
}

function MatchingView({
  question,
  assignment,
  locked,
  onAssign,
}: {
  question: MatchingQuestion;
  assignment: Record<number, number>;
  locked: boolean;
  onAssign: (leftId: number, rightId: number) => void;
}) {
  const [activeLeft, setActiveLeft] = useState<number | null>(null);
  const rightItems = useMemo(() => shuffle(question.pairs), [question]);
  const assignedRightIds = new Set(Object.values(assignment));

  return (
    <div>
      <p className="mb-4 text-xs font-bold text-slate-400">Önce soldan bir kavram seç, sonra sağdan eşini işaretle.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {question.pairs.map((pair) => {
            const assignedTo = assignment[pair.id];
            const isCorrect = assignedTo != null && assignedTo === pair.id;
            const isWrong = assignedTo != null && assignedTo !== pair.id;
            let cls = 'border-slate-200';
            if (activeLeft === pair.id) cls = 'border-indigo-400 bg-indigo-50';
            else if (isCorrect) cls = 'border-emerald-300 bg-emerald-50';
            else if (isWrong) cls = 'border-rose-300 bg-rose-50';
            return (
              <button
                key={pair.id}
                type="button"
                disabled={locked}
                onClick={() => setActiveLeft(pair.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left text-xs font-bold text-slate-700 transition-colors disabled:cursor-default ${cls}`}
              >
                {pair.left_text}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {rightItems.map((pair) => {
            const used = assignedRightIds.has(pair.id);
            return (
              <button
                key={pair.id}
                type="button"
                disabled={locked || used || activeLeft == null}
                onClick={() => activeLeft != null && onAssign(activeLeft, pair.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors disabled:cursor-default ${
                  used ? 'border-slate-100 bg-slate-50 text-slate-300' : 'border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/40'
                }`}
              >
                {pair.right_text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface SectionQuizClientProps {
  sectionId: number;
  heading: string;
  exitHref: string;
  exitLabel: string;
}

export default function SectionQuizClient({ sectionId, heading, exitHref, exitLabel }: SectionQuizClientProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [selection, setSelection] = useState<Record<number, number>>({});
  const [matchAssign, setMatchAssign] = useState<Record<number, Record<number, number>>>({});
  const [locked, setLocked] = useState<Record<number, boolean>>({});
  const [correct, setCorrect] = useState<Record<number, boolean>>({});
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [maxIndex, setMaxIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/section-test-questions?sectionId=${sectionId}`);
        const data = await res.json().catch(() => null);
        if (!cancelled) {
          setQuestions(res.ok ? data?.questions || [] : []);
          setIndex(0);
          setMaxIndex(0);
          setSelection({});
          setMatchAssign({});
          setLocked({});
          setCorrect({});
          setFeedback({});
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
  const answeredCount = Object.keys(locked).length;
  const score = useMemo(() => Object.values(correct).filter(Boolean).length, [correct]);

  const selectAnswer = (optionId: number) => {
    if (!current || current.type === 'matching' || locked[current.id]) return;
    const options = current.type === 'multiple_choice' ? current.choices : current.options;
    const chosen = options.find((o) => o.id === optionId);
    setSelection((prev) => ({ ...prev, [current.id]: optionId }));
    setLocked((prev) => ({ ...prev, [current.id]: true }));
    setCorrect((prev) => ({ ...prev, [current.id]: !!chosen?.is_correct }));
    setFeedback((prev) => ({ ...prev, [current.id]: randomOf(chosen?.is_correct ? CORRECT_MESSAGES : INCORRECT_MESSAGES) }));
  };

  const assignMatch = (leftId: number, rightId: number) => {
    if (!current || current.type !== 'matching' || locked[current.id]) return;
    const prevAssign = matchAssign[current.id] || {};
    const nextAssign = { ...prevAssign };
    for (const [l, r] of Object.entries(nextAssign)) {
      if (r === rightId) delete nextAssign[Number(l)];
    }
    nextAssign[leftId] = rightId;
    setMatchAssign((prev) => ({ ...prev, [current.id]: nextAssign }));

    if (Object.keys(nextAssign).length === current.pairs.length) {
      const allCorrect = current.pairs.every((p) => nextAssign[p.id] === p.id);
      setLocked((prev) => ({ ...prev, [current.id]: true }));
      setCorrect((prev) => ({ ...prev, [current.id]: allCorrect }));
      setFeedback((prev) => ({ ...prev, [current.id]: randomOf(allCorrect ? CORRECT_MESSAGES : INCORRECT_MESSAGES) }));
    }
  };

  const goNext = () => {
    if (index < questions.length - 1) {
      const nextIndex = index + 1;
      setMaxIndex((m) => Math.max(m, nextIndex));
      setIndex(nextIndex);
    } else {
      setShowResult(true);
    }
  };

  const goPrev = () => {
    if (index > 0) setIndex((i) => i - 1);
  };

  const jumpToIndex = (i: number) => {
    if (i < 0 || i >= questions.length || i > maxIndex) return;
    setShowResult(false);
    setIndex(i);
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

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 shadow-sm">
          <Trophy className="h-8 w-8 text-slate-300" />
        </div>
        <h1 className="mb-2 text-lg font-black text-slate-800">Bu konu için henüz soru yok</h1>
        <p className="mb-6 text-sm font-medium text-slate-500">Yakında bu konu için sorular eklenecek.</p>
        <Link
          href={exitHref}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-black text-white transition-colors hover:bg-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {exitLabel}
        </Link>
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

          <div className="mt-6 max-h-72 space-y-1.5 overflow-y-auto text-left">
            {questions.map((q, i) => {
              const isCorrectQ = !!correct[q.id];
              const label = q.type === 'matching' ? `${i + 1}. Eşleştirme Sorusu` : `${i + 1}. ${q.question_text}`;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => jumpToIndex(i)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-left transition-colors hover:bg-slate-100"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                      isCorrectQ ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-600">{label}</span>
                  {isCorrectQ ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Tekrar Çöz
            </button>
            <Link
              href={exitHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-black text-white transition-colors hover:bg-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {exitLabel}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isAnswered = !!locked[current.id];
  const isCorrect = !!correct[current.id];

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      <Link href={exitHref} className="mb-4 flex items-center gap-1.5 text-xs font-bold text-slate-400 transition-colors hover:text-indigo-600">
        <ArrowLeft className="h-3.5 w-3.5" /> {exitLabel}
      </Link>

      <div className="mb-5">
        <div className="mb-1.5 flex items-center justify-between text-xs font-black text-slate-400">
          <span className="truncate uppercase tracking-widest text-indigo-600">{heading}</span>
          <span className="shrink-0">
            {answeredCount}/{questions.length}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-500 ease-out"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
          {questions.map((q, i) => {
            const isCurrent = i === index;
            const isLocked = !!locked[q.id];
            const isReachable = i <= maxIndex;
            let cls = 'bg-slate-100 text-slate-400';
            if (isLocked) cls = correct[q.id] ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white';
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => jumpToIndex(i)}
                disabled={!isReachable}
                title={`${i + 1}. Soru${isLocked ? (correct[q.id] ? ' - Doğru' : ' - Yanlış') : ''}`}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${cls} ${
                  isCurrent ? 'ring-2 ring-indigo-400 ring-offset-1' : ''
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-6">
        <span className="mb-3 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
          {TYPE_LABELS[current.type]}
        </span>

        {current.type === 'matching' ? (
          <MatchingView question={current} assignment={matchAssign[current.id] || {}} locked={isAnswered} onAssign={assignMatch} />
        ) : (
          <OptionsView question={current} selectedId={selection[current.id]} locked={isAnswered} onSelect={selectAnswer} />
        )}

        {isAnswered && (
          <div className={`mt-4 rounded-xl border p-4 ${isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
            <p className={`text-sm font-black ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>{feedback[current.id]}</p>
            {current.type !== 'matching' && current.solution_text && (
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-600">{current.solution_text}</p>
            )}
            {current.type === 'matching' && !isCorrect && (
              <ul className="mt-1.5 space-y-1 text-sm font-medium leading-relaxed text-slate-600">
                {current.pairs
                  .filter((p) => matchAssign[current.id]?.[p.id] !== p.id)
                  .map((p) => (
                    <li key={p.id}>
                      <span className="font-black text-slate-700">{p.left_text}</span> → {p.right_text}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center gap-2.5">
          <button
            type="button"
            onClick={goPrev}
            disabled={index === 0}
            className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" /> Geri
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!isAnswered}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-black text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {index === questions.length - 1 ? 'Testi Bitir' : 'Sonraki Soru'}
          </button>
        </div>
      </div>
    </div>
  );
}
