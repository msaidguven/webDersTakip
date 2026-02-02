'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cXSIkRvdM3hsu2ZIFjSYVQ_XRhlmng8';

type QuestionType = 'multiple_choice' | 'blank' | 'matching' | 'classical';

interface Choice {
  id: number;
  choice_text: string;
  is_correct: boolean;
}

interface MatchingPair {
  id: number;
  left_text: string;
  right_text: string;
}

interface BlankOption {
  id: number;
  option_text: string;
  is_correct: boolean;
}

interface Question {
  id: number;
  question_text: string;
  difficulty: number;
  score: number;
  type: QuestionType;
  // Çoktan seçmeli
  choices?: Choice[];
  // Boşluk
  blankOptions?: BlankOption[];
  // Eşleştirme
  matchingPairs?: MatchingPair[];
  // Klasik
  modelAnswer?: string;
}

function createSupabaseClient(): SupabaseClient | null {
  try {
    return createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch {
    return null;
  }
}

async function fetchMixedQuestions(
  supabase: SupabaseClient,
  lessonId: number,
  week: number
): Promise<Question[]> {
  // 1. Dersin unit'lerini bul
  const { data: units } = await supabase
    .from('units')
    .select('id')
    .eq('lesson_id', lessonId);

  if (!units?.length) return [];
  const unitIds = units.map(u => u.id);

  // 2. Topic'leri bul
  const { data: topics } = await supabase
    .from('topics')
    .select('id')
    .in('unit_id', unitIds);

  if (!topics?.length) return [];
  const topicIds = topics.map(t => t.id);

  // 3. Haftaya göre soru kullanımlarını bul
  const { data: usages } = await supabase
    .from('question_usages')
    .select('question_id, topic_id')
    .in('topic_id', topicIds)
    .eq('curriculum_week', week)
    .eq('usage_type', 'weekly');

  if (!usages?.length) return [];
  const questionIds = usages.map(u => u.question_id);

  // 4. Soruları çek (tip ID'si önemli değil, ilişkili tabloya göre belirleyeceğiz)
  const { data: questions } = await supabase
    .from('questions')
    .select('id, question_text, difficulty, score')
    .in('id', questionIds);

  if (!questions?.length) return [];

  // Tüm soruların detaylarını paralel çek
  const result: Question[] = [];

  // Her tip için toplu sorgu yap
  const [
    { data: allChoices },
    { data: allClassical },
    { data: allBlankOptions },
    { data: allMatchingPairs }
  ] = await Promise.all([
    supabase.from('question_choices').select('*').in('question_id', questionIds),
    supabase.from('question_classical').select('*').in('question_id', questionIds),
    supabase.from('question_blank_options').select('*').in('question_id', questionIds),
    supabase.from('question_matching_pairs').select('*').in('question_id', questionIds)
  ]);

  // Soruları grupla
  const choicesByQuestion: Record<number, Choice[]> = {};
  allChoices?.forEach((c: any) => {
    if (!choicesByQuestion[c.question_id]) choicesByQuestion[c.question_id] = [];
    choicesByQuestion[c.question_id].push(c);
  });

  const classicalByQuestion: Record<number, string> = {};
  allClassical?.forEach((c: any) => {
    classicalByQuestion[c.question_id] = c.model_answer;
  });

  const blankByQuestion: Record<number, BlankOption[]> = {};
  allBlankOptions?.forEach((o: any) => {
    if (!blankByQuestion[o.question_id]) blankByQuestion[o.question_id] = [];
    blankByQuestion[o.question_id].push(o);
  });

  const matchingByQuestion: Record<number, MatchingPair[]> = {};
  allMatchingPairs?.forEach((p: any) => {
    if (!matchingByQuestion[p.question_id]) matchingByQuestion[p.question_id] = [];
    matchingByQuestion[p.question_id].push(p);
  });

  // Her soru için tipini belirle (hangi tabloya bağlıysa)
  for (const q of questions) {
    const baseQuestion = {
      id: q.id,
      question_text: q.question_text,
      difficulty: q.difficulty,
      score: q.score,
    };

    // Hangi tabloda varsa o tip
    if (choicesByQuestion[q.id]) {
      result.push({
        ...baseQuestion,
        type: 'multiple_choice' as const,
        choices: choicesByQuestion[q.id]
      });
    } else if (blankByQuestion[q.id]) {
      result.push({
        ...baseQuestion,
        type: 'blank' as const,
        blankOptions: blankByQuestion[q.id]
      });
    } else if (matchingByQuestion[q.id]) {
      result.push({
        ...baseQuestion,
        type: 'matching' as const,
        matchingPairs: matchingByQuestion[q.id]
      });
    } else if (classicalByQuestion[q.id]) {
      result.push({
        ...baseQuestion,
        type: 'classical' as const,
        modelAnswer: classicalByQuestion[q.id]
      });
    }
  }

  // Karıştır
  return result.sort(() => Math.random() - 0.5);
}

function MixedTestContent() {
  const searchParams = useSearchParams();
  const lessonId = searchParams.get('lesson_id');
  const week = searchParams.get('week');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [matchingState, setMatchingState] = useState<Record<number, Record<string, string>>>({});
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState<Record<number, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(3600);
  const [isFinished, setIsFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!lessonId || !week) {
      setError('Ders veya hafta bilgisi eksik');
      setLoading(false);
      return;
    }

    const supabase = createSupabaseClient();
    if (!supabase) {
      setError('Veritabanı bağlantısı kurulamadı');
      setLoading(false);
      return;
    }

    fetchMixedQuestions(supabase, parseInt(lessonId), parseInt(week))
      .then(data => {
        setQuestions(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [lessonId, week]);

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

  const handleAnswer = useCallback((questionId: number, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  }, []);

  const handleMatching = useCallback((questionId: number, left: string, right: string) => {
    setMatchingState(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], [left]: right }
    }));
    setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], [left]: right } }));
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

  const calculateResult = useCallback(() => {
    let correct = 0;
    let totalScore = 0;
    let earnedScore = 0;

    questions.forEach(q => {
      totalScore += q.score || 1;
      const answer = answers[q.id];

      if (q.type === 'multiple_choice' && q.choices) {
        const selectedChoice = q.choices.find(c => c.id === answer);
        if (selectedChoice?.is_correct) {
          correct++;
          earnedScore += q.score || 1;
        }
      } else if (q.type === 'blank' && q.blankOptions) {
        const selectedOption = q.blankOptions.find(o => o.id === answer);
        if (selectedOption?.is_correct) {
          correct++;
          earnedScore += q.score || 1;
        }
      } else if (q.type === 'matching' && q.matchingPairs) {
        const userMatches = answer || {};
        let allCorrect = true;
        q.matchingPairs.forEach(pair => {
          if (userMatches[pair.left_text] !== pair.right_text) {
            allCorrect = false;
          }
        });
        if (allCorrect && q.matchingPairs.length > 0) {
          correct++;
          earnedScore += q.score || 1;
        }
      }
    });

    return {
      correct,
      wrong: questions.length - correct,
      total: questions.length,
      percentage: Math.round((earnedScore / totalScore) * 100),
      score: earnedScore,
      totalPossible: totalScore
    };
  }, [questions, answers]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTypeLabel = (type: QuestionType) => {
    const labels: Record<QuestionType, string> = {
      multiple_choice: 'Çoktan Seçmeli',
      blank: 'Boşluk Doldurma',
      matching: 'Eşleştirme',
      classical: 'Klasik'
    };
    return labels[type];
  };

  const getTypeColor = (type: QuestionType) => {
    const colors: Record<QuestionType, string> = {
      multiple_choice: 'bg-amber-500/20 text-amber-400',
      blank: 'bg-emerald-500/20 text-emerald-400',
      matching: 'bg-purple-500/20 text-purple-400',
      classical: 'bg-blue-500/20 text-blue-400'
    };
    return colors[type];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Sorular yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center text-4xl mx-auto mb-6">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-4">Hata</h1>
          <p className="text-zinc-400 mb-6">{error}</p>
          <Link href="/" className="px-6 py-3 rounded-xl bg-indigo-500 text-white">Ana Sayfaya Dön</Link>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-4xl mx-auto mb-6">📝</div>
          <h1 className="text-2xl font-bold text-white mb-4">Soru Bulunamadı</h1>
          <p className="text-zinc-400 mb-6">Bu ders ve hafta için soru eklenmemiş.</p>
          <Link href="/ders" className="px-6 py-3 rounded-xl bg-indigo-500 text-white">Derse Dön</Link>
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
          <h1 className="text-3xl font-bold text-white mb-4">Test Tamamlandı!</h1>
          
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-zinc-800">
              <p className="text-2xl font-bold text-emerald-400">{result.correct}</p>
              <p className="text-sm text-zinc-500">Doğru</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-800">
              <p className="text-2xl font-bold text-red-400">{result.wrong}</p>
              <p className="text-sm text-zinc-500">Yanlış</p>
            </div>
            <div className="p-4 rounded-xl bg-indigo-500/20 border border-indigo-500/30">
              <p className="text-2xl font-bold text-white">%{result.percentage}</p>
              <p className="text-sm text-zinc-400">Başarı</p>
            </div>
          </div>

          <p className="text-zinc-400 mb-6">Puan: {result.score} / {result.totalPossible}</p>

          <div className="flex justify-center gap-4">
            <Link href="/ders" className="px-6 py-3 rounded-xl bg-zinc-800 text-white">Derse Dön</Link>
            <button onClick={() => window.location.reload()} className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white">Tekrar Dene</button>
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
            <span className="text-xl font-bold text-white hidden sm:block">Karışık Test</span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">
              Soru {currentIndex + 1} / {questions.length}
            </span>
            <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className={`px-4 py-2 rounded-xl bg-zinc-900 border border-white/10 font-mono ${timeLeft < 300 ? 'text-red-400 border-red-500/30' : 'text-zinc-400'}`}>
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-[100px] pb-20 px-4 sm:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Question Card */}
          <div className="rounded-2xl bg-zinc-900/80 border border-white/10 p-6 sm:p-8 mb-6">
            {/* Type Badge */}
            <div className="flex items-center gap-2 mb-6">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(q.type)}`}>
                {getTypeLabel(q.type)}
              </span>
              <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 text-sm">
                {q.score || 1} Puan
              </span>
            </div>

            {/* Question Text */}
            <h2 className="text-xl sm:text-2xl font-medium text-white mb-8">
              {currentIndex + 1}. {q.question_text}
            </h2>

            {/* Multiple Choice */}
            {q.type === 'multiple_choice' && q.choices && (
              <div className="space-y-3">
                {q.choices.map((choice, idx) => {
                  const isSelected = answers[q.id] === choice.id;
                  const showResult = showFeedback[q.id];
                  const isCorrect = choice.is_correct;
                  
                  return (
                    <button
                      key={choice.id}
                      onClick={() => {
                        handleAnswer(q.id, choice.id);
                        setShowFeedback(prev => ({ ...prev, [q.id]: true }));
                      }}
                      disabled={showResult}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        showResult
                          ? isCorrect
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : isSelected
                              ? 'border-red-500 bg-red-500/10'
                              : 'border-zinc-800 bg-zinc-900'
                          : isSelected
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center font-semibold ${
                          showResult
                            ? isCorrect
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : isSelected
                                ? 'border-red-500 bg-red-500 text-white'
                                : 'border-zinc-700 text-zinc-500'
                            : isSelected
                              ? 'border-indigo-500 bg-indigo-500 text-white'
                              : 'border-zinc-700 text-zinc-500'
                        }`}>
                          {showResult && isCorrect && '✓'}
                          {showResult && !isCorrect && isSelected && '✗'}
                          {!showResult && String.fromCharCode(65 + idx)}
                        </div>
                        <span className={
                          showResult
                            ? isCorrect
                              ? 'text-emerald-400'
                              : isSelected
                                ? 'text-red-400'
                                : 'text-zinc-500'
                            : isSelected
                              ? 'text-white'
                              : 'text-zinc-300'
                        }>
                          {choice.choice_text}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Blank */}
            {q.type === 'blank' && q.blankOptions && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {q.blankOptions.map((option) => {
                  const isSelected = answers[q.id] === option.id;
                  const showResult = showFeedback[q.id];
                  const isCorrect = option.is_correct;
                  
                  return (
                    <button
                      key={option.id}
                      onClick={() => {
                        handleAnswer(q.id, option.id);
                        setShowFeedback(prev => ({ ...prev, [q.id]: true }));
                      }}
                      disabled={showResult}
                      className={`p-4 rounded-xl border-2 text-center font-medium transition-all ${
                        showResult
                          ? isCorrect
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                            : isSelected
                              ? 'border-red-500 bg-red-500/10 text-red-400'
                              : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                          : isSelected
                            ? 'border-emerald-500 bg-emerald-500/10 text-white'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      {showResult && isCorrect && '✓ '}
                      {showResult && !isCorrect && isSelected && '✗ '}
                      {option.option_text}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Matching - Click to Match */}
            {q.type === 'matching' && q.matchingPairs && (
              <div className="space-y-6">
                {/* Instructions */}
                <p className="text-zinc-400 text-sm text-center">
                  Soldaki öğeleri sağdaki kutularla eşleştirmek için tıklayın
                </p>

                {/* Check Button */}
                {Object.keys(matchingState[q.id] || {}).length === q.matchingPairs.length && !showFeedback[q.id] && (
                  <button
                    onClick={() => setShowFeedback(prev => ({ ...prev, [q.id]: true }))}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium"
                  >
                    Eşleştirmeleri Kontrol Et
                  </button>
                )}

                {/* Feedback */}
                {showFeedback[q.id] && (
                  <div className={`p-4 rounded-xl text-center ${
                    q.matchingPairs.every(p => matchingState[q.id]?.[p.left_text] === p.right_text)
                      ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                      : 'bg-red-500/20 border border-red-500/30 text-red-400'
                  }`}>
                    {q.matchingPairs.every(p => matchingState[q.id]?.[p.left_text] === p.right_text)
                      ? '✓ Tüm eşleştirmeler doğru!'
                      : '✗ Bazı eşleştirmeler yanlış'}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Items */}
                  <div className="space-y-3">
                    <p className="text-zinc-400 text-sm mb-2">Seçilecekler (tıklayın):</p>
                    {q.matchingPairs.map((pair) => {
                      const isMatched = matchingState[q.id]?.[pair.left_text];
                      const showResult = showFeedback[q.id];
                      const isCorrect = isMatched === pair.right_text;
                      const isSelected = selectedLeft === pair.left_text;
                      
                      return (
                        <button
                          key={pair.id}
                          onClick={() => setSelectedLeft(pair.left_text)}
                          disabled={!!isMatched || showResult}
                          className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                            showResult
                              ? isCorrect
                                ? 'bg-emerald-500/20 border-emerald-500/50'
                                : 'bg-red-500/20 border-red-500/50'
                              : isMatched
                                ? 'bg-purple-500/20 border-purple-500/50 opacity-50'
                                : isSelected
                                  ? 'bg-amber-500/20 border-amber-500'
                                  : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={
                              showResult
                                ? isCorrect
                                  ? 'text-emerald-400'
                                  : 'text-red-400'
                                : isMatched
                                  ? 'text-purple-400'
                                  : isSelected
                                    ? 'text-amber-400 font-bold'
                                    : 'text-white'
                            }>
                              {showResult && (isCorrect ? '✓ ' : '✗ ')}
                              {pair.left_text}
                            </span>
                            {isSelected && <span className="text-amber-400 text-sm">Seçildi</span>}
                            {isMatched && <span className="text-purple-400 text-sm">→ {isMatched}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Right Drop Zones */}
                  <div className="space-y-3">
                    <p className="text-zinc-400 text-sm mb-2">Buraya eşleştirin:</p>
                    {q.matchingPairs.map((pair, idx) => {
                      const matchedLeft = Object.entries(matchingState[q.id] || {}).find(
                        ([_, right]) => right === pair.right_text
                      );
                      const showResult = showFeedback[q.id];
                      const isCorrect = matchedLeft?.[0] && q.matchingPairs?.find(p => p.left_text === matchedLeft[0])?.right_text === pair.right_text;

                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (selectedLeft && !matchedLeft) {
                              handleMatching(q.id, selectedLeft, pair.right_text);
                              setSelectedLeft(null);
                            }
                          }}
                          disabled={!!matchedLeft || showResult || !selectedLeft}
                          className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                            showResult
                              ? isCorrect
                                ? 'bg-emerald-500/20 border-emerald-500'
                                : matchedLeft
                                  ? 'bg-red-500/20 border-red-500'
                                  : 'bg-zinc-900/50 border-zinc-700'
                              : matchedLeft
                                ? 'bg-indigo-500/20 border-indigo-500'
                                : selectedLeft
                                  ? 'bg-zinc-800 border-zinc-600 hover:border-amber-500 cursor-pointer'
                                  : 'bg-zinc-900/50 border-zinc-700 opacity-50'
                          }`}
                        >
                          {matchedLeft ? (
                            <div className="flex items-center justify-between w-full">
                              <span className={showResult ? (isCorrect ? 'text-emerald-400' : 'text-red-400') : 'text-indigo-400'}>
                                {matchedLeft[0]}
                              </span>
                              <span className="text-zinc-400">=</span>
                              <span className="text-white">{pair.right_text}</span>
                            </div>
                          ) : (
                            <span className="text-zinc-600">{pair.right_text}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Reset Matching Button */}
                <button
                  onClick={() => {
                    setMatchingState(prev => ({ ...prev, [q.id]: {} }));
                    setAnswers(prev => ({ ...prev, [q.id]: {} }));
                    setShowFeedback(prev => ({ ...prev, [q.id]: false }));
                    setSelectedLeft(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-sm"
                >
                  Eşleştirmeleri Sıfırla
                </button>
              </div>
            )}

            {/* Classical */}
            {q.type === 'classical' && (
              <div className="space-y-4">
                <textarea
                  value={answers[q.id] || ''}
                  onChange={(e) => handleAnswer(q.id, e.target.value)}
                  className="w-full h-40 p-4 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Cevabınızı buraya yazın..."
                />
                <p className="text-zinc-500 text-sm">{(answers[q.id] || '').length} karakter</p>
                
                {/* Check Button */}
                {(answers[q.id] || '').length > 10 && !showFeedback[q.id] && (
                  <button
                    onClick={() => setShowFeedback(prev => ({ ...prev, [q.id]: true }))}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-medium"
                  >
                    Cevabımı Kontrol Et
                  </button>
                )}
                
                {/* Model Answer */}
                {showFeedback[q.id] && (
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                    <p className="text-blue-400 font-medium mb-2">Model Cevap:</p>
                    <p className="text-zinc-300">{q.modelAnswer}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className={`px-6 py-3 rounded-xl font-medium ${currentIndex === 0 ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}
            >
              ← Önceki
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

export default function MixedTestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f11]" />}>
      <MixedTestContent />
    </Suspense>
  );
}
