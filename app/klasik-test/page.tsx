'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
  id: number;
  question_text: string;
  difficulty: number;
  score: number;
  model_answer: string;
}

interface TestResult {
  correct: number;
  wrong: number;
  empty: number;
  total: number;
  percentage: number;
}

import { createSupabaseBrowserClient } from '../src/lib/supabaseClient';

async function fetchClassicalQuestions(
  supabase: SupabaseClient,
  unitId: number,
  week: number
): Promise<ClassicalQuestion[]> {
  // 1. Get question IDs for this week
  const { data: usages, error: usageError } = await supabase
    .from('question_usages')
    .select('question_id')
    .eq('curriculum_week', week)
    .eq('usage_type', 'weekly');

  if (usageError) throw usageError;
  if (!usages?.length) return [];

  const questionIds = usages.map(u => u.question_id);

  // 2. Get classical questions with model answers
  const { data: questions, error: questionError } = await supabase
    .from('questions')
    .select(`
      id,
      question_text,
      difficulty,
      score,
      question_classical!inner(model_answer)
    `)
    .in('id', questionIds)
    .eq('question_type_id', 2); // classical type

  if (questionError) throw questionError;
  if (!questions?.length) return [];

  return questions.map((q: any) => ({
    id: q.id,
    question_text: q.question_text,
    difficulty: q.difficulty,
    score: q.score,
    model_answer: q.question_classical?.model_answer || ''
  }));
}

function ClassicalTestContent() {
  const searchParams = useSearchParams();
  const unitId = searchParams.get('unit_id');
  const week = searchParams.get('week');

  const [questions, setQuestions] = useState<ClassicalQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes
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
      if (!supabase) {
        setError('Veritabanı bağlantısı kurulamadı');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await fetchClassicalQuestions(supabase, parseInt(unitId), parseInt(week));
        setQuestions(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();
  }, [unitId, week]);

  // Timer
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

  const handleAnswer = useCallback((questionId: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
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

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
          <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-4xl mx-auto mb-6">✏️</div>
          <h1 className="text-2xl font-bold text-default mb-4">Klasik Soru Bulunamadı</h1>
          <p className="text-muted mb-6">Bu hafta için klasik soru eklenmemiş.</p>
          <Link href="/ders" className="px-6 py-3 rounded-xl bg-indigo-500 text-default">Derse Dön</Link>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <ResultScreen 
        questions={questions} 
        answers={answers} 
        onRetry={() => {
          setAnswers({});
          setIsFinished(false);
          setCurrentIndex(0);
        }}
      />
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-[#0f0f11]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-[#0f0f11]/95 backdrop-blur-xl border-b border-default">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <span className="text-xl font-bold text-default">E</span>
            </div>
            <span className="text-xl font-bold text-default hidden sm:block">Klasik Test</span>
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

      {/* Main Content */}
      <main className="pt-[100px] pb-20 px-4 sm:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Question Card */}
          <div className="rounded-2xl bg-surface-elevated border border-default p-6 sm:p-8 mb-6">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-sm font-medium">Klasik</span>
              <span className="px-3 py-1 rounded-full bg-zinc-800 text-muted text-sm">{currentQuestion.score || 1} Puan</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-medium text-default mb-8">
              {currentIndex + 1}. {currentQuestion.question_text}
            </h2>

            {/* Answer Input */}
            <div className="space-y-4">
              <label className="block text-sm text-muted">Cevabınızı yazın:</label>
              <textarea
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                className="w-full h-40 p-4 rounded-xl bg-zinc-800 border border-zinc-700 text-default placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="Cevabınızı buraya yazın..."
              />
              <p className="text-muted text-sm">{answers[currentQuestion.id]?.length || 0} karakter</p>
            </div>
          </div>

          {/* Navigation */}
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

function ResultScreen({ 
  questions, 
  answers, 
  onRetry 
}: { 
  questions: ClassicalQuestion[]; 
  answers: Record<number, string>;
  onRetry: () => void;
}) {
  const answered = Object.keys(answers).filter(k => answers[parseInt(k)]?.trim()).length;
  const empty = questions.length - answered;

  return (
    <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4 sm:p-8">
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />

      <div className="relative max-w-3xl w-full">
        <div className="rounded-2xl sm:rounded-3xl bg-surface-elevated border border-default p-6 sm:p-12">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl sm:text-4xl mx-auto mb-6 sm:mb-8 shadow-2xl shadow-orange-500/30">
            ✏️
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold text-default mb-3 sm:mb-4 text-center">
            Test <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Tamamlandı</span>!
          </h1>
          <p className="text-muted text-sm sm:text-base mb-6 sm:mb-8 text-center">
            Cevaplarınız kaydedildi. Öğretmeniniz değerlendirecek.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
            <div className="p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-zinc-800/50 text-center">
              <p className="text-lg sm:text-3xl font-bold text-emerald-400">{answered}</p>
              <p className="text-xs sm:text-sm text-muted">Cevaplanan</p>
            </div>
            <div className="p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-zinc-800/50 text-center">
              <p className="text-lg sm:text-3xl font-bold text-muted">{empty}</p>
              <p className="text-xs sm:text-sm text-muted">Boş</p>
            </div>
            <div className="p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-center">
              <p className="text-lg sm:text-3xl font-bold text-default">{questions.length}</p>
              <p className="text-xs sm:text-sm text-muted">Toplam</p>
            </div>
          </div>

          {/* Answers Review */}
          <div className="space-y-4 mb-6 sm:mb-8 max-h-96 overflow-y-auto">
            {questions.map((q, i) => (
              <div key={q.id} className="p-4 rounded-xl bg-zinc-800/30 text-left">
                <p className="text-default font-medium mb-2">{i + 1}. {q.question_text}</p>
                <p className="text-muted text-sm mb-2">Senin cevabın: {answers[q.id] || '(Boş)'}</p>
                <p className="text-emerald-400 text-sm">Model cevap: {q.model_answer}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              href="/ders"
              className="px-6 sm:px-8 py-3 rounded-xl bg-zinc-800 text-default font-medium hover:bg-zinc-700 transition-all text-sm sm:text-base text-center"
            >
              Derse Dön
            </Link>
            <button
              onClick={onRetry}
              className="px-6 sm:px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-default font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all text-sm sm:text-base"
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KlasikTestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f11]" />}>
      <ClassicalTestContent />
    </Suspense>
  );
}
