'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation'; 
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useTimer } from '../src/viewmodels/useTimer';

interface Choice {
  id: number;
  choice_text: string;
  is_correct: boolean;
}

interface Question {
  id: number;
  question_text: string;
  difficulty: number;
  score: number;
  choices: Choice[];
}

const createSupabaseClient = (): SupabaseClient | null => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Key is missing in environment variables.');
    return null;
  }

  try {
    return createClient(supabaseUrl, supabaseKey);
  } catch {
    return null;
  }
};

// Ders ve haftaya gore sorulari cek
const fetchQuestionsByLesson = async (
  supabase: SupabaseClient,
  lessonId: number,
  week: number
): Promise<Question[]> => {
  // 1. Bu dersin unit'lerini bul
  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('id')
    .eq('lesson_id', lessonId);

  if (unitsError) throw unitsError;
  if (!units?.length) return [];

  const unitIds = units.map(u => u.id);

  // 2. Bu unit'lere ait topic'leri bul
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('id')
    .in('unit_id', unitIds);

  if (topicsError) throw topicsError;
  if (!topics?.length) return [];

  const topicIds = topics.map(t => t.id);

  // 3. Bu konulara ve haftaya ait soru kullanimlarini bul
  const { data: usages, error: usagesError } = await supabase
    .from('question_usages')
    .select('question_id')
    .in('topic_id', topicIds)
    .eq('curriculum_week', week)
    .eq('usage_type', 'weekly');

  if (usagesError) throw usagesError;
  if (!usages?.length) return [];

  const questionIds = usages.map(u => u.question_id);

  // 4. Sorulari ve cevaplarini cek
  const [{ data: questions }, { data: allChoices }] = await Promise.all([
    supabase
      .from('questions')
      .select('id, question_text, difficulty, score')
      .in('id', questionIds)
      .order('id'),
    supabase
      .from('question_choices')
      .select('id, question_id, choice_text, is_correct')
      .in('question_id', questionIds)
      .order('id')
  ]);

  if (!questions?.length) return [];

  // Secenekleri sorulara grupla
  const choicesByQuestion: Record<number, Choice[]> = {};
  allChoices?.forEach((c: any) => {
    if (!choicesByQuestion[c.question_id]) choicesByQuestion[c.question_id] = [];
    choicesByQuestion[c.question_id].push(c);
  });

  return questions.map((q: any) => ({
    ...q,
    choices: choicesByQuestion[q.id] || []
  }));
};

function TestContent() {
  const searchParams = useSearchParams();
  const lessonId = searchParams.get('lesson_id');
  const week = searchParams.get('week');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { timeLeft, resetTimer, formatTime } = useTimer(1800, !isFinished && !loading, () => {
    setIsFinished(true);
  });

  useEffect(() => {
    if (!lessonId || !week) {
      setError('Ders veya hafta bilgisi eksik');
      setLoading(false);
      return;
    }

    const supabase = createSupabaseClient();
    if (!supabase) {
      setError('Veritabani baglantisi kurulamadi');
      setLoading(false);
      return;
    }

    fetchQuestionsByLesson(supabase, parseInt(lessonId), parseInt(week))
      .then(setQuestions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [lessonId, week]);

  const handleAnswer = useCallback((qId: number, cId: number) => {
    setAnswers((prev) => ({ ...prev, [qId]: cId }));
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((p) => p + 1);
    } else {
      setIsFinished(true);
    }
  }, [currentIndex, questions.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex((p) => p - 1);
  }, [currentIndex]);

  const calculateResult = useCallback(() => {
    let correct = 0;
    questions.forEach((q) => {
      const ans = answers[q.id];
      if (ans && q.choices.find((c) => c.id === ans)?.is_correct) correct++;
    });
    return {
      correct,
      wrong: questions.length - correct,
      total: questions.length,
      percentage: Math.round((correct / questions.length) * 100)
    };
  }, [questions, answers]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Hata</h1>
          <p className="text-zinc-400 mb-6">{error}</p>
          <Link href="/" className="px-6 py-3 rounded-xl bg-indigo-500 text-white">
            Ana Sayfaya Don
          </Link>
        </div>
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Soru Bulunamadi</h1>
          <p className="text-zinc-400 mb-6">Bu ders ve hafta icin soru eklenmemis.</p>
          <Link href="/ders" className="px-6 py-3 rounded-xl bg-indigo-500 text-white">
            Derse Don
          </Link>
        </div>
      </div>
    );
  }

  if (isFinished) {
    const result = calculateResult();
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full rounded-2xl bg-zinc-900/80 border border-white/10 p-8 text-center">
          <div className="text-4xl mb-4">🏆</div>
          <h1 className="text-3xl font-bold text-white mb-4">Test Tamamlandi!</h1>
          
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-zinc-800">
              <p className="text-2xl font-bold text-emerald-400">{result.correct}</p>
              <p className="text-sm text-zinc-500">Dogru</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-800">
              <p className="text-2xl font-bold text-red-400">{result.wrong}</p>
              <p className="text-sm text-zinc-500">Yanlis</p>
            </div>
            <div className="p-4 rounded-xl bg-indigo-500/20 border border-indigo-500/30">
              <p className="text-2xl font-bold text-white">%{result.percentage}</p>
              <p className="text-sm text-zinc-400">Basari</p>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <Link href="/ders" className="px-6 py-3 rounded-xl bg-zinc-800 text-white">
              Derse Don
            </Link>
            <button
              onClick={() => {
                setAnswers({});
                setIsFinished(false);
                setCurrentIndex(0);
                resetTimer();
              }}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-[#0f0f11]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-[#0f0f11]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <span className="text-xl font-bold text-white">E</span>
            </div>
            <span className="text-xl font-bold text-white hidden sm:block">Test</span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">
              Soru {currentIndex + 1} / {questions.length}
            </span>
            <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className={`px-4 py-2 rounded-xl bg-zinc-900 border border-white/10 font-mono ${timeLeft < 300 ? 'text-red-400 border-red-500/30' : 'text-zinc-400'}`}>
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="pt-[100px] pb-20 px-4 sm:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Question */}
          <div className="rounded-2xl bg-zinc-900/80 border border-white/10 p-6 sm:p-8 mb-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-sm">
                {q.difficulty === 1 ? 'Kolay' : q.difficulty === 2 ? 'Orta' : 'Zor'}
              </span>
              <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 text-sm">
                {q.score || 1} Puan
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-medium text-white mb-8">
              {currentIndex + 1}. {q.question_text}
            </h2>

            {/* Choices */}
            <div className="space-y-3">
              {q.choices.map((choice, idx) => (
                <button
                  key={choice.id}
                  onClick={() => handleAnswer(q.id, choice.id)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    answers[q.id] === choice.id
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center font-semibold ${
                        answers[q.id] === choice.id
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-zinc-700 text-zinc-500'
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span className={answers[q.id] === choice.id ? 'text-white' : 'text-zinc-300'}>
                      {choice.choice_text}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className={`px-6 py-3 rounded-xl font-medium ${
                currentIndex === 0
                  ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                  : 'bg-zinc-900 text-white hover:bg-zinc-800'
              }`}
            >
              ← Onceki
            </button>

            <button
              onClick={() => setIsFinished(true)}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium"
            >
              Testi Bitir
            </button>

            <button
              onClick={handleNext}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium"
            >
              {currentIndex === questions.length - 1 ? 'Testi Bitir' : 'Sonraki →'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function HaftalikTestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f11]" />}>
      <TestContent />
    </Suspense>
  );
}
