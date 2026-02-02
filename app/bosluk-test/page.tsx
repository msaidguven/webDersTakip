'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '../src/lib/supabaseClient';

interface BlankOption {
  id: number;
  option_text: string;
  is_correct: boolean;
  order_no: number;
}

interface BlankQuestion {
  id: number;
  question_text: string;
  difficulty: number;
  score: number;
  options: BlankOption[];
}

// Use central wrapper

async function fetchBlankQuestions(
  supabase: SupabaseClient,
  unitId: number,
  week: number
): Promise<BlankQuestion[]> {
  const { data: usages, error: usageError } = await supabase
    .from('question_usages')
    .select('question_id')
    .eq('curriculum_week', week)
    .eq('usage_type', 'weekly');

  if (usageError) throw usageError;
  if (!usages?.length) return [];

  const questionIds = usages.map(u => u.question_id);

  const { data: questions, error: questionError } = await supabase
    .from('questions')
    .select('id, question_text, difficulty, score')
    .in('id', questionIds)
    .eq('question_type_id', 3); // blank type

  if (questionError) throw questionError;
  if (!questions?.length) return [];

  // Get options for blank questions
  const { data: allOptions, error: optionsError } = await supabase
    .from('question_blank_options')
    .select('id, question_id, option_text, is_correct, order_no')
    .in('question_id', questionIds)
    .order('order_no');

  if (optionsError) throw optionsError;

  // Group options by question
  const optionsByQuestion: Record<number, BlankOption[]> = {};
  allOptions?.forEach((opt: any) => {
    if (!optionsByQuestion[opt.question_id]) {
      optionsByQuestion[opt.question_id] = [];
    }
    optionsByQuestion[opt.question_id].push({
      id: opt.id,
      option_text: opt.option_text,
      is_correct: opt.is_correct,
      order_no: opt.order_no
    });
  });

  return questions.map((q: any) => ({
    id: q.id,
    question_text: q.question_text,
    difficulty: q.difficulty,
    score: q.score,
    options: optionsByQuestion[q.id] || []
  }));
}

function BlankTestContent() {
  const searchParams = useSearchParams();
  const unitId = searchParams.get('unit_id');
  const week = searchParams.get('week');

  const [questions, setQuestions] = useState<BlankQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(1800);
  const [isFinished, setIsFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadQuestions() {
      if (!unitId || !week) {
        setError('Ünite veya hafta bilgisi eksik');
        setLoading(false);
        return;
      }

      const supabase = createSupabaseBrowserClient();

      try {
        setLoading(true);
        const data = await fetchBlankQuestions(supabase, parseInt(unitId), parseInt(week));
        setQuestions(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();
  }, [unitId, week]);

  useEffect(() => {
    if (isFinished || loading) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isFinished, loading]);

  const handleAnswer = useCallback((questionId: number, optionId: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsFinished(true);
    }
  }, [currentIndex, questions.length]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const calculateScore = useCallback(() => {
    let correct = 0;
    questions.forEach(q => {
      const answer = answers[q.id];
      const option = q.options.find(o => o.id === answer);
      if (option?.is_correct) correct++;
    });
    return correct;
  }, [questions, answers]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Parse question with blanks (e.g., "_____ bir sayıdır")
  const renderQuestionWithBlank = (question: BlankQuestion) => {
    const parts = question.question_text.split('_____');
    if (parts.length === 1) return <p className="text-xl text-default mb-6">{question.question_text}</p>;

    return (
      <p className="text-xl text-default mb-6">
        {parts[0]}
        <span className="inline-block min-w-[120px] px-3 py-1 mx-2 rounded-lg bg-zinc-800 border-2 border-zinc-700 text-center">
          {answers[question.id] ? question.options.find(o => o.id === answers[question.id])?.option_text : '...'}
        </span>
        {parts[1]}
      </p>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted">Sorular yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center text-4xl mx-auto mb-6">⚠️</div>
          <h1 className="text-2xl font-bold text-default mb-4">Hata</h1>
          <p className="text-muted mb-6">{error}</p>
          <Link href="/" className="px-6 py-3 rounded-xl bg-indigo-500 text-default">Ana Sayfaya Dön</Link>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-4xl mx-auto mb-6">📝</div>
          <h1 className="text-2xl font-bold text-default mb-4">Boşluk Sorusu Bulunamadı</h1>
          <p className="text-muted mb-6">Bu hafta için boşluk sorusu eklenmemiş.</p>
          <Link href="/ders" className="px-6 py-3 rounded-xl bg-indigo-500 text-default">Derse Dön</Link>
        </div>
      </div>
    );
  }

  if (isFinished) {
    const score = calculateScore();
    const percentage = Math.round((score / questions.length) * 100);

    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4 sm:p-8">
        <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
        <div className="relative max-w-2xl w-full">
          <div className="rounded-2xl sm:rounded-3xl bg-surface-elevated border border-default p-6 sm:p-12 text-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-3xl sm:text-4xl mx-auto mb-6 sm:mb-8 shadow-2xl shadow-blue-500/30">
              📝
            </div>

            <h1 className="text-2xl sm:text-4xl font-bold text-default mb-3 sm:mb-4">
              Test <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Tamamlandı</span>!
            </h1>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
              <div className="p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-zinc-800/50">
                <p className="text-lg sm:text-3xl font-bold text-emerald-400">{score}</p>
                <p className="text-xs sm:text-sm text-muted">Doğru</p>
              </div>
              <div className="p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-zinc-800/50">
                <p className="text-lg sm:text-3xl font-bold text-red-400">{questions.length - score}</p>
                <p className="text-xs sm:text-sm text-muted">Yanlış</p>
              </div>
              <div className="p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
                <p className="text-lg sm:text-3xl font-bold text-default">%{percentage}</p>
                <p className="text-xs sm:text-sm text-muted">Başarı</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link href="/ders" className="px-6 sm:px-8 py-3 rounded-xl bg-zinc-800 text-default font-medium hover:bg-zinc-700 transition-all">Derse Dön</Link>
              <button onClick={() => { setAnswers({}); setIsFinished(false); setCurrentIndex(0); }} className="px-6 sm:px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-default font-medium hover:shadow-lg">Tekrar Dene</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-[#0f0f11]">
      <header className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-[#0f0f11]/95 backdrop-blur-xl border-b border-default">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <span className="text-xl font-bold text-default">E</span>
            </div>
            <span className="text-xl font-bold text-default hidden sm:block">Boşluk Testi</span>
          </Link>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-sm text-muted">Soru {currentIndex + 1} / {questions.length}</span>
              <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-elevated border border-default ${timeLeft < 300 ? 'text-red-400 border-red-500/30' : 'text-muted'}`}>
              <span className="font-mono font-medium">{formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-[100px] pb-20 px-4 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl bg-surface-elevated border border-default p-6 sm:p-8 mb-6">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium">Boşluk Doldurma</span>
              <span className="px-3 py-1 rounded-full bg-zinc-800 text-muted text-sm">{currentQuestion.score || 1} Puan</span>
            </div>

            {renderQuestionWithBlank(currentQuestion)}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {currentQuestion.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleAnswer(currentQuestion.id, option.id)}
                  className={`p-4 rounded-xl border-2 text-center font-medium transition-all ${
                    answers[currentQuestion.id] === option.id
                      ? 'border-indigo-500 bg-indigo-500/10 text-default'
                      : 'border-zinc-800 bg-surface-elevated text-muted hover:border-zinc-700'
                  }`}
                >
                  {option.option_text}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${currentIndex === 0 ? 'bg-surface-elevated text-muted cursor-not-allowed' : 'bg-surface-elevated text-default hover:bg-zinc-800'}`}
            >
              ← Önceki
            </button>

            <button
              onClick={() => setIsFinished(true)}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-default font-medium hover:shadow-lg transition-all"
            >
              Testi Bitir
            </button>

            <button
              onClick={handleNext}
              className="px-6 py-3 rounded-xl font-medium bg-gradient-to-r from-indigo-500 to-purple-600 text-default hover:shadow-lg transition-all"
            >
              {currentIndex === questions.length - 1 ? 'Testi Bitir' : 'Sonraki →'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function BoslukTestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f11]" />}>
      <BlankTestContent />
    </Suspense>
  );
}
