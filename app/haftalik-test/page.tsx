'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================
// CONSTANTS
// ============================================
const SUPABASE_URL = 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cXSIkRvdM3hsu2ZIFjSYVQ_XRhlmng8';

// ============================================
// TYPES
// ============================================
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
  question_type: 'multiple_choice' | 'classical' | 'blank' | 'matching';
  choices: Choice[];
}

interface TestResult {
  correct: number;
  wrong: number;
  empty: number;
  total: number;
  percentage: number;
}

// ============================================
// SUPABASE CLIENT
// ============================================
function createSupabaseClient(): SupabaseClient | null {
  try {
    return createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch {
    return null;
  }
}

// ============================================
// DATA FETCHING
// ============================================
async function fetchWeekQuestions(
  supabase: SupabaseClient,
  unitId: number,
  week: number
): Promise<Question[]> {
  // 1. Get question IDs for this week and unit
  const { data: usages, error: usageError } = await supabase
    .from('question_usages')
    .select('question_id')
    .eq('curriculum_week', week)
    .eq('usage_type', 'weekly');

  if (usageError) throw usageError;
  if (!usages?.length) return [];

  const questionIds = usages.map(u => u.question_id);

  // 2. Get questions with their choices
  const { data: questions, error: questionError } = await supabase
    .from('questions')
    .select(`
      id,
      question_text,
      difficulty,
      score,
      question_types!inner(code)
    `)
    .in('id', questionIds)
    .order('id');

  if (questionError) throw questionError;
  if (!questions?.length) return [];

  // 3. Get all choices for these questions
  const { data: allChoices, error: choiceError } = await supabase
    .from('question_choices')
    .select('id, question_id, choice_text, is_correct')
    .in('question_id', questionIds)
    .order('id');

  if (choiceError) throw choiceError;

  // 4. Group choices by question
  const choicesByQuestion: Record<number, Choice[]> = {};
  allChoices?.forEach((choice: any) => {
    if (!choicesByQuestion[choice.question_id]) {
      choicesByQuestion[choice.question_id] = [];
    }
    choicesByQuestion[choice.question_id].push({
      id: choice.id,
      choice_text: choice.choice_text,
      is_correct: choice.is_correct
    });
  });

  // 5. Format questions
  return questions.map((q: any) => ({
    id: q.id,
    question_text: q.question_text,
    difficulty: q.difficulty,
    score: q.score,
    question_type: q.question_types?.code || 'multiple_choice',
    choices: choicesByQuestion[q.id] || []
  }));
}

// ============================================
// MAIN COMPONENT
// ============================================
function TestContent() {
  const searchParams = useSearchParams();
  const unitId = searchParams.get('unit_id');
  const week = searchParams.get('week');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes
  const [isFinished, setIsFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load questions
  useEffect(() => {
    async function loadQuestions() {
      if (!unitId || !week) {
        setError('Ünite veya hafta bilgisi eksik');
        setLoading(false);
        return;
      }

      const supabase = createSupabaseClient();
      if (!supabase) {
        setError('Veritabanı bağlantısı kurulamadı');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await fetchWeekQuestions(supabase, parseInt(unitId), parseInt(week));
        setQuestions(data);
      } catch (err: any) {
        console.error('Error loading questions:', err);
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

  const handleAnswer = useCallback((questionId: number, choiceId: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: choiceId }));
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

  const calculateResult = useCallback((): TestResult => {
    let correct = 0;
    let wrong = 0;
    let empty = 0;

    questions.forEach(q => {
      const answer = answers[q.id];
      if (!answer) {
        empty++;
      } else {
        const choice = q.choices.find(c => c.id === answer);
        if (choice?.is_correct) {
          correct++;
        } else {
          wrong++;
        }
      }
    });

    const total = questions.length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    return { correct, wrong, empty, total, percentage };
  }, [questions, answers]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDifficultyLabel = (diff: number) => {
    const labels = ['', 'Kolay', 'Orta', 'Zor', 'Çok Zor', 'Uzman'];
    return labels[diff] || 'Orta';
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <ErrorScreen error={error} />;
  }

  if (questions.length === 0) {
    return <EmptyScreen message="Bu hafta için soru bulunmuyor." />;
  }

  if (isFinished) {
    return <ResultScreen result={calculateResult()} questions={questions} answers={answers} />;
  }

  const currentQuestion = questions[currentIndex];
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
            <span className="text-xl font-bold text-white hidden sm:block">EduSmart</span>
          </Link>

          <div className="flex items-center gap-4 sm:gap-6">
            {/* Progress */}
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-sm text-zinc-500">
                Soru {currentIndex + 1} / {questions.length}
              </span>
              <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Timer */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-white/10 ${timeLeft < 300 ? 'text-red-400 border-red-500/30' : 'text-zinc-400'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path strokeWidth="2" strokeLinecap="round" d="M12 6v6l4 2" />
              </svg>
              <span className="font-mono font-medium">{formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-[100px] pb-20 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Mobile Progress */}
          <div className="sm:hidden mb-6">
            <div className="flex items-center justify-between text-sm text-zinc-500 mb-2">
              <span>Soru {currentIndex + 1} / {questions.length}</span>
              <span>%{Math.round(progress)}</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="max-w-3xl mx-auto">
            {/* Question Card */}
            <div className="rounded-2xl bg-zinc-900/80 border border-white/10 p-6 sm:p-8 mb-6">
              {/* Question Header */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6">
                <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-sm font-medium">
                  {getDifficultyLabel(currentQuestion.difficulty)}
                </span>
                <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 text-sm">
                  {currentQuestion.score || 1} Puan
                </span>
              </div>

              {/* Question Text */}
              <h2 className="text-xl sm:text-2xl font-medium text-white mb-8">
                {currentIndex + 1}. {currentQuestion.question_text}
              </h2>

              {/* Answer Options */}
              <div className="space-y-3">
                {currentQuestion.choices.map((choice, index) => (
                  <button
                    key={choice.id}
                    onClick={() => handleAnswer(currentQuestion.id, choice.id)}
                    className={`w-full p-4 sm:p-5 rounded-xl border-2 text-left transition-all duration-200 ${
                      answers[currentQuestion.id] === choice.id
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center font-semibold transition-all flex-shrink-0 ${
                        answers[currentQuestion.id] === choice.id
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-zinc-700 text-zinc-500'
                      }`}>
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span className={`text-lg ${answers[currentQuestion.id] === choice.id ? 'text-white' : 'text-zinc-300'}`}>
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
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className={`px-6 py-3 rounded-xl font-medium transition-all ${
                  currentIndex === 0
                    ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                    : 'bg-zinc-900 text-white hover:bg-zinc-800'
                }`}
              >
                ← Önceki
              </button>

              <button
                onClick={() => setIsFinished(true)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium hover:shadow-lg transition-all"
              >
                Testi Bitir
              </button>

              <button
                onClick={handleNext}
                className="px-6 py-3 rounded-xl font-medium bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg transition-all"
              >
                {currentIndex === questions.length - 1 ? 'Testi Bitir' : 'Sonraki →'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400">Sorular yükleniyor...</p>
      </div>
    </div>
  );
}

function ErrorScreen({ error }: { error: string }) {
  return (
    <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center text-4xl mx-auto mb-6">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold text-white mb-4">Hata</h1>
        <p className="text-zinc-400 mb-6">{error}</p>
        <Link
          href="/"
          className="px-6 py-3 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors"
        >
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}

function EmptyScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-4xl mx-auto mb-6">
          📝
        </div>
        <h1 className="text-2xl font-bold text-white mb-4">Soru Bulunamadı</h1>
        <p className="text-zinc-400 mb-6">{message}</p>
        <Link
          href="/"
          className="px-6 py-3 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors"
        >
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}

function ResultScreen({ result, questions, answers }: { 
  result: TestResult; 
  questions: Question[]; 
  answers: Record<number, number>;
}) {
  return (
    <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4 sm:p-8">
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />

      <div className="relative max-w-2xl w-full">
        <div className="rounded-2xl sm:rounded-3xl bg-zinc-900/80 border border-white/10 p-6 sm:p-12 text-center">
          {/* Trophy Icon */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl sm:text-4xl mx-auto mb-6 sm:mb-8 shadow-2xl shadow-orange-500/30">
            🏆
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-3 sm:mb-4">
            Test <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Tamamlandı</span>!
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base mb-6 sm:mb-8">
            Tebrikler! Haftalık değerlendirme testini başarıyla tamamladın.
          </p>

          {/* Score Display */}
          <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
            <div className="p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-zinc-800/50">
              <p className="text-lg sm:text-3xl font-bold text-emerald-400">{result.correct}</p>
              <p className="text-xs sm:text-sm text-zinc-500">Doğru</p>
            </div>
            <div className="p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-zinc-800/50">
              <p className="text-lg sm:text-3xl font-bold text-red-400">{result.wrong}</p>
              <p className="text-xs sm:text-sm text-zinc-500">Yanlış</p>
            </div>
            <div className="p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-zinc-800/50">
              <p className="text-lg sm:text-3xl font-bold text-zinc-400">{result.empty}</p>
              <p className="text-xs sm:text-sm text-zinc-500">Boş</p>
            </div>
            <div className="p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
              <p className="text-lg sm:text-3xl font-bold text-white">%{result.percentage}</p>
              <p className="text-xs sm:text-sm text-zinc-400">Başarı</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6 sm:mb-8">
            <div className="h-3 sm:h-4 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000"
                style={{ width: `${result.percentage}%` }}
              />
            </div>
          </div>

          {/* Question Summary */}
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-6 sm:mb-8">
            {questions.map((q, i) => {
              const answer = answers[q.id];
              let status = 'empty';
              if (answer) {
                const choice = q.choices.find(c => c.id === answer);
                status = choice?.is_correct ? 'correct' : 'wrong';
              }

              return (
                <div
                  key={q.id}
                  className={`
                    aspect-square rounded-lg flex items-center justify-center text-sm font-bold
                    ${status === 'correct'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : status === 'wrong'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-zinc-800 text-zinc-500'
                    }
                  `}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              href="/"
              className="px-6 sm:px-8 py-3 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-all text-sm sm:text-base"
            >
              Ana Sayfaya Dön
            </Link>
            <Link
              href="/ders"
              className="px-6 sm:px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all text-sm sm:text-base"
            >
              Yeni Test Başlat
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PAGE EXPORT
// ============================================
export default function HaftalikTestPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <TestContent />
    </Suspense>
  );
}
