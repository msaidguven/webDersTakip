"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Icon } from "../src/components/icons";

// ========== SUPABASE CLIENT ==========
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// ========== TYPES ==========

type QuestionTypeCode = "multiple_choice" | "classical" | "blank" | "matching";

interface Choice {
  id: number;
  question_id: number;
  choice_text: string;
  is_correct: boolean;
}

interface Question {
  id: number;
  question_text: string;
  difficulty: number;
  score: number;
  question_type: { code: QuestionTypeCode };
  question_choices: Choice[] | null;
  question_blank_options: any[] | null;
  question_matching_pairs: any[] | null;
  question_classical: any[] | null;
}

// ========== MOCK USER (Geçici) ==========
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001";

// ========== MAIN TEST PAGE ==========

export default function WeeklyTestPage() {
  const searchParams = useSearchParams();
  const unitId = searchParams.get("unit_id");
  const week = searchParams.get("week") || "1";

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes
  const [isFinished, setIsFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());

  // Soruları çek
  useEffect(() => {
    async function fetchQuestions() {
      if (!unitId) {
        setError("Ünite bilgisi gerekli");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        console.log('[fetchQuestions] Params:', { unitId, week, type: 'weekly' });

        // start_guest_test RPC fonksiyonunu çağır
        const { data, error: rpcError } = await supabase.rpc(
          "start_guest_test",
          {
            p_unit_id: parseInt(unitId),
            p_type: "weekly",
            p_curriculum_week: parseInt(week),
          }
        );

        console.log('[fetchQuestions] Response:', { data, rpcError });

        if (rpcError) {
          console.error('[fetchQuestions] RPC Error:', rpcError);
          throw rpcError;
        }

        if (!data || data.length === 0) {
          setError(`Bu haftaya (unit_id: ${unitId}, week: ${week}) ait soru bulunamadı.`);
          setIsLoading(false);
          return;
        }

        setQuestions(data);
      } catch (err: any) {
        console.error("Soru getirme hatası:", err);
        setError(err.message || "Bir hata oluştu");
      } finally {
        setIsLoading(false);
      }
    }

    fetchQuestions();
  }, [unitId, week]);

  // Timer
  useEffect(() => {
    if (timeLeft > 0 && !isFinished && !isLoading) {
      const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !isFinished && !isLoading) {
      setIsFinished(true);
    }
  }, [timeLeft, isFinished, isLoading]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAnswer = (questionId: number, choiceId: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: choiceId }));
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((c) => c + 1);
      setStartTime(Date.now());
    } else {
      setIsFinished(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((c) => c - 1);
      setStartTime(Date.now());
    }
  };

  const handleQuestionSelect = (index: number) => {
    setCurrentQuestion(index);
    setStartTime(Date.now());
  };

  const calculateScore = () => {
    let correct = 0;
    let wrong = 0;
    let empty = 0;

    questions.forEach((q) => {
      const answer = answers[q.id];
      if (!answer) {
        empty++;
      } else {
        const choice = q.question_choices?.find((c) => c.id === answer);
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
  };

  const getDifficultyLabel = (diff: number) => {
    const labels = ["", "Kolay", "Orta", "Zor", "Çok Zor", "Uzman"];
    return labels[diff] || "Orta";
  };

  const getQuestionTypeLabel = (code: QuestionTypeCode) => {
    const labels: Record<QuestionTypeCode, string> = {
      multiple_choice: "Çoktan Seçmeli",
      classical: "Klasik",
      blank: "Boşluk Doldurma",
      matching: "Eşleştirme",
    };
    return labels[code] || "Soru";
  };

  // Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Sorular yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Error Screen
  if (error) {
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
            className="px-6 py-3 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-all"
          >
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    );
  }

  // Results Screen
  if (isFinished) {
    const { correct, wrong, empty, total, percentage } = calculateScore();

    return (
      <div className="min-h-screen bg-[#0f0f11] bg-grid flex items-center justify-center p-4 sm:p-8">
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
                <p className="text-lg sm:text-3xl font-bold text-emerald-400">{correct}</p>
                <p className="text-xs sm:text-sm text-zinc-500">Doğru</p>
              </div>
              <div className="p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-zinc-800/50">
                <p className="text-lg sm:text-3xl font-bold text-red-400">{wrong}</p>
                <p className="text-xs sm:text-sm text-zinc-500">Yanlış</p>
              </div>
              <div className="p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-zinc-800/50">
                <p className="text-lg sm:text-3xl font-bold text-zinc-400">{empty}</p>
                <p className="text-xs sm:text-sm text-zinc-500">Boş</p>
              </div>
              <div className="p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
                <p className="text-lg sm:text-3xl font-bold text-white">%{percentage}</p>
                <p className="text-xs sm:text-sm text-zinc-400">Başarı</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6 sm:mb-8">
              <div className="h-3 sm:h-4 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            {/* Question Summary */}
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-6 sm:mb-8">
              {questions.map((q, i) => {
                const answer = answers[q.id];
                let status = "empty";
                if (answer) {
                  const choice = q.question_choices?.find((c) => c.id === answer);
                  status = choice?.is_correct ? "correct" : "wrong";
                }

                return (
                  <div
                    key={q.id}
                    className={`
                      aspect-square rounded-lg flex items-center justify-center text-sm font-bold
                      ${status === "correct"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : status === "wrong"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-zinc-800 text-zinc-500"
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

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
        <p className="text-zinc-400">Soru bulunamadı</p>
      </div>
    );
  }

  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const choices = question.question_choices || [];

  return (
    <div className="min-h-screen bg-[#0f0f11] bg-grid">
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-[#0f0f11]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <span className="text-sm font-bold text-white">E</span>
            </div>
            <span className="font-semibold text-white text-sm sm:text-base">EduSmart</span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-6">
            {/* Progress */}
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-sm text-zinc-500">
                Soru {currentQuestion + 1} / {questions.length}
              </span>
              <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Timer */}
            <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-zinc-900 border border-white/10 ${timeLeft < 300 ? "text-red-400 border-red-500/30" : "text-zinc-400"}`}>
              <Icon name="clock" size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="font-mono font-medium text-sm sm:text-base">{formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-[88px] sm:pt-[100px] pb-20 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Question Area */}
            <div className="lg:col-span-3">
              {/* Question Card */}
              <div className="rounded-xl sm:rounded-2xl bg-zinc-900/80 border border-white/10 p-4 sm:p-8 mb-4 sm:mb-6">
                {/* Question Header */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                  <span className="px-2 sm:px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 text-xs sm:text-sm font-medium">
                    {getQuestionTypeLabel(question.question_type.code)}
                  </span>
                  <span className="px-2 sm:px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 text-xs sm:text-sm">
                    {getDifficultyLabel(question.difficulty)}
                  </span>
                  <span className="px-2 sm:px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 text-xs sm:text-sm">
                    {question.score || 1} Puan
                  </span>
                </div>

                {/* Question Text */}
                <h2 className="text-lg sm:text-2xl font-medium text-white mb-6 sm:mb-8">
                  {currentQuestion + 1}. {question.question_text}
                </h2>

                {/* Answer Options */}
                <div className="space-y-3">
                  {choices.map((choice, index) => (
                    <button
                      key={choice.id}
                      onClick={() => handleAnswer(question.id, choice.id)}
                      className={`
                        w-full p-4 sm:p-5 rounded-xl border-2 text-left transition-all duration-200
                        ${answers[question.id] === choice.id
                          ? "border-indigo-500 bg-indigo-500/10"
                          : "border-zinc-800 hover:border-zinc-700 bg-zinc-900"
                        }
                      `}
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className={`
                          w-8 h-8 sm:w-10 sm:h-10 rounded-lg border-2 flex items-center justify-center font-semibold transition-all flex-shrink-0
                          ${answers[question.id] === choice.id
                            ? "border-indigo-500 bg-indigo-500 text-white"
                            : "border-zinc-700 text-zinc-500"
                          }
                        `}>
                          {String.fromCharCode(65 + index)}
                        </div>
                        <span className={`text-base sm:text-lg ${answers[question.id] === choice.id ? "text-white" : "text-zinc-300"}`}>
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
                  disabled={currentQuestion === 0}
                  className={`
                    px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium transition-all text-sm sm:text-base
                    ${currentQuestion === 0
                      ? "bg-zinc-900 text-zinc-600 cursor-not-allowed"
                      : "bg-zinc-900 text-white hover:bg-zinc-800"
                    }
                  `}
                >
                  ← Önceki
                </button>

                <button
                  onClick={handleNext}
                  className={`
                    px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-medium transition-all text-sm sm:text-base
                    bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/30
                  `}
                >
                  {currentQuestion === questions.length - 1 ? "Testi Bitir" : "Sonraki →"}
                </button>
              </div>
            </div>

            {/* Sidebar - Question Navigator */}
            <div className="lg:col-span-1 order-first lg:order-last">
              <div className="rounded-xl sm:rounded-2xl bg-zinc-900/50 border border-white/5 p-4 sm:p-6 sticky top-[100px]">
                <h3 className="text-white font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Soru Navigasyonu</h3>
                
                {/* Mobile Progress */}
                <div className="sm:hidden mb-4">
                  <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                    <span>Soru {currentQuestion + 1} / {questions.length}</span>
                    <span>%{Math.round(progress)}</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-4 gap-2">
                  {questions.map((q, i) => (
                    <button
                      key={q.id}
                      onClick={() => handleQuestionSelect(i)}
                      className={`
                        aspect-square rounded-lg flex items-center justify-center text-xs sm:text-sm font-bold transition-all
                        ${i === currentQuestion
                          ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                          : answers[q.id]
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                        }
                      `}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-zinc-800">
                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-indigo-500" />
                      <span className="text-zinc-400">Mevcut</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" />
                      <span className="text-zinc-400">Cevaplandı</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-zinc-800" />
                      <span className="text-zinc-400">Boş</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsFinished(true)}
                  className="w-full mt-4 sm:mt-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium hover:shadow-lg hover:shadow-orange-500/30 transition-all text-sm sm:text-base"
                >
                  Testi Bitir
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
