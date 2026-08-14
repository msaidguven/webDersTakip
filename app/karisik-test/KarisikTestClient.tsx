'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { useAuth } from '../src/context/AuthContext';


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

// Use central wrapper

interface KarisikTestClientProps {
  unitId: number;
  lessonId: number;
  gradeId: number;
  unitTitle: string;
  lessonName: string;
  gradeName: string;
  exitHref: string;
}

async function fetchUnitQuestions(
  supabase: SupabaseClient,
  unitId: number
): Promise<Question[]> {
  // 1. Ünitenin topic'lerini bul
  const { data: topics } = await supabase
    .from('topics')
    .select('id')
    .eq('unit_id', unitId)
    .eq('is_active', true);

  if (!topics?.length) return [];
  const topicIds = topics.map(t => t.id);

  // 2. Ünitedeki tüm konu sorularını bul
  const { data: usages } = await supabase
    .from('question_usages')
    .select('question_id, topic_id')
    .in('topic_id', topicIds);

  if (!usages?.length) return [];
  const questionIds = Array.from(new Set(usages.map(u => u.question_id)));

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

export default function KarisikTestClient({
  unitId,
  lessonId,
  gradeId,
  unitTitle,
  lessonName,
  gradeName,
  exitHref,
}: KarisikTestClientProps) {
  const { user, isAuthenticated, supabase: authSupabase } = useAuth();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [allQuestionsLoaded, setAllQuestionsLoaded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [matchingState, setMatchingState] = useState<Record<number, Record<string, string>>>({});
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState<Record<number, boolean>>({});
  const [resultsSaved, setResultsSaved] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3600);
  const [isFinished, setIsFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // İlk soruyu hemen çek, arka planda tümünü çek
  useEffect(() => {
    if (!unitId) {
      setError('Ünite bilgisi eksik');
      setLoading(false);
      return;
    }

    const supabase = createClient();

    async function loadQuestions() {
      try {
        // Önce tüm soruları çek ama hemen gösterme
        const allQuestions = await fetchUnitQuestions(supabase!, unitId);
        
        if (allQuestions.length === 0) {
          setError('Bu ünite için soru bulunamadı');
          setLoading(false);
          return;
        }

        // İlk soruyu hemen göster
        setQuestions([allQuestions[0]]);
        setLoading(false);

        // Kalan soruları arka planda yükle (eğer varsa)
        if (allQuestions.length > 1) {
          setTimeout(() => {
            setQuestions(allQuestions);
            setAllQuestionsLoaded(true);
          }, 100); // Kısa bir gecikmeyle diğer soruları ekle
        } else {
          setAllQuestionsLoaded(true);
        }
      } catch (err: any) {
        setError(err.message || 'Sorular yüklenirken bir hata oluştu');
        setLoading(false);
      }
    }

    loadQuestions();
  }, [unitId]);

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

  // Test sonuçlarını kaydet (sadece giriş yapmış kullanıcılar için)
  useEffect(() => {
    if (!isFinished || !isAuthenticated || resultsSaved || !user) return;

    const saveResults = async () => {
      try {
        const result = calculateResult();
        
        // test_sessions tablosuna kaydet
        const { data: sessionData, error: sessionError } = await authSupabase
          .from('test_sessions')
          .insert({
            user_id: user.id,
            lesson_id: lessonId,
            grade_id: gradeId,
            unit_id: unitId,
            completed_at: new Date().toISOString(),
            settings: {
              test_type: 'unit',
              unit_title: unitTitle,
              lesson_name: lessonName,
              grade_name: gradeName,
              total_questions: result.total,
              correct_count: result.correct,
              wrong_count: result.wrong,
              percentage: result.percentage,
              score: result.score,
              total_possible: result.totalPossible
            }
          })
          .select('id')
          .single();

        if (sessionError) {
          console.error('Test session kaydetme hatası:', sessionError);
          return;
        }

        // Her sorunun cevabını kaydet
        const sessionAnswers = questions.map((q, idx) => {
          let isCorrect = false;
          const answer = answers[q.id];

          if (q.type === 'multiple_choice' && q.choices) {
            isCorrect = q.choices.find(c => c.id === answer)?.is_correct || false;
          } else if (q.type === 'blank' && q.blankOptions) {
            isCorrect = q.blankOptions.find(o => o.id === answer)?.is_correct || false;
          } else if (q.type === 'matching' && q.matchingPairs) {
            const userMatches = answer || {};
            isCorrect = q.matchingPairs.every(p => userMatches[p.left_text] === p.right_text);
          }

          return {
            test_session_id: sessionData.id,
            question_id: q.id,
            user_id: user.id,
            selected_option_id: q.type === 'multiple_choice' || q.type === 'blank' ? answer : null,
            user_answer_text: q.type === 'classical' ? answer : q.type === 'matching' ? JSON.stringify(answer) : null,
            is_correct: isCorrect,
            order_no: idx + 1
          };
        });

        const { error: answersError } = await authSupabase
          .from('test_session_answers')
          .insert(sessionAnswers);

        if (answersError) {
          console.error('Test answers kaydetme hatası:', answersError);
        } else {
          setResultsSaved(true);
        }
      } catch (err) {
        console.error('Sonuç kaydetme hatası:', err);
      }
    };

    saveResults();
  }, [isFinished, isAuthenticated, resultsSaved, user, lessonId, gradeId, unitId, unitTitle, lessonName, gradeName, questions, answers, calculateResult, authSupabase]);

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
      <div className="min-h-screen bg-default flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">İlk soru hazırlanıyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-default flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center text-4xl mx-auto mb-6">⚠️</div>
          <h1 className="text-2xl font-bold text-default mb-4">Hata</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Link href="/" className="px-6 py-3 rounded-xl bg-indigo-500 text-white font-medium">Ana Sayfaya Dön</Link>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-default flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-surface-elevated flex items-center justify-center text-4xl mx-auto mb-6">📝</div>
          <h1 className="text-2xl font-bold text-default mb-4">Soru Bulunamadı</h1>
          <p className="text-muted-foreground mb-6">Bu ders ve hafta için soru eklenmemiş.</p>
          <Link href={exitHref} className="px-6 py-3 rounded-xl bg-indigo-500 text-white font-medium">Üniteye Dön</Link>
        </div>
      </div>
    );
  }

  if (isFinished) {
    const result = calculateResult();
    return (
      <div className="min-h-screen bg-default flex items-center justify-center p-4">
        <div className="max-w-2xl w-full rounded-2xl bg-surface-elevated border border-default p-8 text-center">
          <div className="text-4xl mb-4">🏆</div>
          <h1 className="text-3xl font-bold text-default mb-4">Test Tamamlandı!</h1>
          
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-surface border border-default">
              <p className="text-2xl font-bold text-emerald-500">{result.correct}</p>
              <p className="text-sm text-muted-foreground">Doğru</p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-default">
              <p className="text-2xl font-bold text-red-500">{result.wrong}</p>
              <p className="text-sm text-muted-foreground">Yanlış</p>
            </div>
            <div className="p-4 rounded-xl bg-indigo-500/20 border border-indigo-500/30">
              <p className="text-2xl font-bold text-default">%{result.percentage}</p>
              <p className="text-sm text-muted-foreground">Başarı</p>
            </div>
          </div>

          <p className="text-muted-foreground mb-6">Puan: {result.score} / {result.totalPossible}</p>

          {/* Anonim kullanıcı bilgisi */}
          {!isAuthenticated && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-amber-500 text-sm mb-2">💡 İstatistiklerini kaydetmek için giriş yap</p>
              <p className="text-muted-foreground text-xs">Test sonuçların sadece senin için kaydedilsin ve ilerlemeni takip et.</p>
              <div className="flex justify-center gap-3 mt-3">
                <Link href="/login" className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-500 text-sm hover:bg-amber-500/30 transition-colors">Giriş Yap</Link>
                <Link href="/register" className="px-4 py-2 rounded-lg bg-surface text-muted-foreground text-sm hover:text-default transition-colors border border-default">Kayıt Ol</Link>
              </div>
            </div>
          )}

          {/* Kaydedildi bilgisi */}
          {isAuthenticated && resultsSaved && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-emerald-400 text-sm">✓ Sonuçların başarıyla kaydedildi!</p>
            </div>
          )}

          <div className="flex justify-center gap-4">
            <Link href={exitHref} className="px-6 py-3 rounded-xl bg-surface text-default border border-default">Üniteye Dön</Link>
            <button onClick={() => window.location.reload()} className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium">Tekrar Dene</button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[currentIndex];

  return (
    <div className="min-h-screen bg-default">
      {/* Test Info Bar */}
      <div className="fixed top-[60px] sm:top-[72px] left-0 right-0 z-40 border-b border-default bg-surface">
        <div className="max-w-7xl mx-auto px-3 sm:px-8 py-3">
          <div className="flex items-center justify-between">
            <Link href={exitHref} className="text-sm text-muted-foreground hover:text-default flex items-center gap-1">
              ← Testten Çık
            </Link>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="text-xs sm:text-sm text-muted-foreground">
                {currentIndex + 1}/{allQuestionsLoaded ? questions.length : '?'}
              </span>
              <div className="w-16 sm:w-32 h-1.5 sm:h-2 bg-surface-elevated border border-default rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all" 
                  style={{ 
                    width: allQuestionsLoaded 
                      ? `${((currentIndex + 1) / questions.length) * 100}%` 
                      : '10%' 
                  }} 
                />
              </div>
              <div className={`px-2 sm:px-4 py-1 sm:py-2 rounded-lg bg-surface-elevated border border-default font-mono text-xs sm:text-sm ${timeLeft < 300 ? 'text-red-500 border-red-500/30' : 'text-default'}`}>
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-[120px] sm:pt-[140px] pb-24 sm:pb-20 px-3 sm:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Question Card */}
          <div className="rounded-xl sm:rounded-2xl bg-surface-elevated border border-default p-4 sm:p-8 mb-4 sm:mb-6">
            {/* Type Badge */}
            <div className="flex items-center gap-2 mb-4 sm:mb-6">
              <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getTypeColor(q.type)}`}>
                {getTypeLabel(q.type)}
              </span>
              <span className="px-2 sm:px-3 py-1 rounded-full bg-surface text-muted-foreground text-xs sm:text-sm border border-default">
                {q.score || 1} Puan
              </span>
            </div>

            {/* Question Text */}
            <h2 className="text-lg sm:text-xl md:text-2xl font-medium text-default mb-6 sm:mb-8 leading-relaxed">
              {currentIndex + 1}. {q.question_text}
            </h2>

            {/* Multiple Choice */}
            {q.type === 'multiple_choice' && q.choices && (
              <div className="space-y-2 sm:space-y-3">
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
                      className={`w-full p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 text-left transition-all min-h-[56px] sm:min-h-[64px] ${
                        showResult
                          ? isCorrect
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : isSelected
                              ? 'border-red-500 bg-red-500/10'
                              : 'border-default bg-surface-elevated'
                          : isSelected
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-default bg-surface-elevated active:border-muted'
                      }`}
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg border-2 flex items-center justify-center font-semibold text-sm sm:text-base flex-shrink-0 ${
                          showResult
                            ? isCorrect
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : isSelected
                                ? 'border-red-500 bg-red-500 text-white'
                                : 'border-default text-muted-foreground'
                            : isSelected
                              ? 'border-indigo-500 bg-indigo-500 text-white'
                              : 'border-default text-muted-foreground'
                        }`}>
                          {showResult && isCorrect && '✓'}
                          {showResult && !isCorrect && isSelected && '✗'}
                          {!showResult && String.fromCharCode(65 + idx)}
                        </div>
                        <span className={`text-sm sm:text-base leading-snug ${
                          showResult
                            ? isCorrect
                              ? 'text-emerald-400'
                              : isSelected
                                ? 'text-red-400'
                                : 'text-muted-foreground'
                            : isSelected
                              ? 'text-default'
                              : 'text-muted-foreground'
                        }`}>
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
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
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
                      className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 text-center font-medium transition-all text-sm sm:text-base min-h-[48px] sm:min-h-[56px] ${
                        showResult
                          ? isCorrect
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                            : isSelected
                              ? 'border-red-500 bg-red-500/10 text-red-500'
                              : 'border-default bg-surface-elevated text-muted-foreground'
                          : isSelected
                            ? 'border-emerald-500 bg-emerald-500/10 text-default'
                            : 'border-default bg-surface-elevated text-muted-foreground active:border-muted'
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
              <div className="space-y-4 sm:space-y-6">
                {/* Instructions */}
                <p className="text-muted-foreground text-xs sm:text-sm text-center px-2">
                  Soldakini seç, sağdakine tıkla
                </p>

                {/* Selected indicator */}
                {selectedLeft && (
                  <div className="p-2 sm:p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center">
                    <span className="text-amber-400 text-xs sm:text-sm">Seçilen: </span>
                    <span className="text-default font-medium text-sm sm:text-base">{selectedLeft}</span>
                  </div>
                )}

                {/* Check Button */}
                {Object.keys(matchingState[q.id] || {}).length === q.matchingPairs.length && !showFeedback[q.id] && (
                  <button
                    onClick={() => setShowFeedback(prev => ({ ...prev, [q.id]: true }))}
                    className="w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-default font-medium text-sm sm:text-base"
                  >
                    Eşleştirmeleri Kontrol Et
                  </button>
                )}

                {/* Feedback */}
                {showFeedback[q.id] && (
                  <div className={`p-3 sm:p-4 rounded-lg sm:rounded-xl text-center text-sm sm:text-base ${
                    q.matchingPairs.every(p => matchingState[q.id]?.[p.left_text] === p.right_text)
                      ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                      : 'bg-red-500/20 border border-red-500/30 text-red-400'
                  }`}>
                    {q.matchingPairs.every(p => matchingState[q.id]?.[p.left_text] === p.right_text)
                      ? '✓ Tüm eşleştirmeler doğru!'
                      : '✗ Bazı eşleştirmeler yanlış'}
                  </div>
                )}

                {/* Mobile: Horizontal scroll layout, Desktop: Grid */}
                <div className="space-y-4 sm:grid sm:grid-cols-2 sm:gap-4">
                  {/* Left Items */}
                  <div className="space-y-2 sm:space-y-3">
                    <p className="text-muted-foreground text-xs sm:text-sm mb-2">Seçilecekler:</p>
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
                          className={`w-full p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all text-left min-h-[44px] sm:min-h-[56px] ${
                            showResult
                              ? isCorrect
                                ? 'bg-emerald-500/20 border-emerald-500/50'
                                : 'bg-red-500/20 border-red-500/50'
                              : isMatched
                                ? 'bg-purple-500/20 border-purple-500/50 opacity-50'
                                : isSelected
                                  ? 'bg-amber-500/20 border-amber-500'
                                  : 'bg-surface border-default active:border-muted'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-sm sm:text-base ${
                              showResult
                                ? isCorrect
                                  ? 'text-emerald-400'
                                  : 'text-red-400'
                                : isMatched
                                  ? 'text-purple-400'
                                  : isSelected
                                    ? 'text-amber-400 font-bold'
                                    : 'text-default'
                            }`}>
                              {showResult && (isCorrect ? '✓ ' : '✗ ')}
                              {pair.left_text}
                            </span>
                            {isMatched && <span className="text-purple-400 text-xs sm:text-sm">→ {isMatched}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Right Drop Zones */}
                  <div className="space-y-2 sm:space-y-3">
                    <p className="text-muted-foreground text-xs sm:text-sm mb-2">Buraya eşleştir:</p>
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
                          className={`w-full p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all text-left min-h-[44px] sm:min-h-[56px] ${
                            showResult
                              ? isCorrect
                                ? 'bg-emerald-500/20 border-emerald-500'
                                : matchedLeft
                                  ? 'bg-red-500/20 border-red-500'
                                  : 'bg-surface-elevated border-zinc-700'
                              : matchedLeft
                                ? 'bg-indigo-500/20 border-indigo-500'
                                : selectedLeft
                                  ? 'bg-surface border-amber-500/50 cursor-pointer active:bg-surface-elevated'
                                  : 'bg-surface-elevated border-default opacity-50'
                          }`}
                        >
                          {matchedLeft ? (
                            <div className="flex items-center justify-between w-full">
                              <span className={`text-xs sm:text-sm truncate max-w-[40%] ${showResult ? (isCorrect ? 'text-emerald-400' : 'text-red-400') : 'text-indigo-400'}`}>
                                {matchedLeft[0]}
                              </span>
                              <span className="text-muted-foreground text-xs sm:text-sm">=</span>
                              <span className="text-default text-xs sm:text-sm truncate max-w-[40%]">{pair.right_text}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm sm:text-base">{pair.right_text}</span>
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
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-surface text-muted-foreground hover:text-default text-xs sm:text-sm border border-default"
                >
                  Eşleştirmeleri Sıfırla
                </button>
              </div>
            )}

            {/* Classical */}
            {q.type === 'classical' && (
              <div className="space-y-3 sm:space-y-4">
                <textarea
                  value={answers[q.id] || ''}
                  onChange={(e) => handleAnswer(q.id, e.target.value)}
                  className="w-full h-32 sm:h-40 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-surface border border-default text-default placeholder-muted focus:outline-none focus:border-indigo-500 resize-none text-sm sm:text-base"
                  placeholder="Cevabınızı buraya yazın..."
                />
                <p className="text-muted-foreground text-xs sm:text-sm">{(answers[q.id] || '').length} karakter</p>
                
                {/* Check Button */}
                {(answers[q.id] || '').length > 10 && !showFeedback[q.id] && (
                  <button
                    onClick={() => setShowFeedback(prev => ({ ...prev, [q.id]: true }))}
                    className="w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-default font-medium text-sm sm:text-base"
                  >
                    Cevabımı Kontrol Et
                  </button>
                )}
                
                {/* Model Answer */}
                {showFeedback[q.id] && (
                  <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-blue-500/10 border border-blue-500/30">
                    <p className="text-blue-400 font-medium mb-1 sm:mb-2 text-sm sm:text-base">Model Cevap:</p>
                    <p className="text-muted-foreground text-sm sm:text-base">{q.modelAnswer}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex flex-row justify-between gap-2 sm:gap-4">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className={`flex-1 sm:flex-none px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium text-sm sm:text-base ${currentIndex === 0 ? 'bg-surface-elevated text-muted-foreground cursor-not-allowed' : 'bg-surface-elevated text-default active:bg-zinc-800'}`}
            >
              ← Önceki
            </button>

            <button
              onClick={() => setIsFinished(true)}
              className="flex-1 sm:flex-none px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-default font-medium text-sm sm:text-base"
            >
              Testi Bitir
            </button>

            <button
              onClick={handleNext}
              disabled={!allQuestionsLoaded && currentIndex >= questions.length - 1}
              className={`flex-1 sm:flex-none px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium text-sm sm:text-base ${
                !allQuestionsLoaded && currentIndex >= questions.length - 1
                  ? 'bg-surface text-muted-foreground cursor-not-allowed border border-default'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
              }`}
            >
              {!allQuestionsLoaded && currentIndex >= questions.length - 1 
                ? 'Yükleniyor...' 
                : currentIndex === questions.length - 1 
                  ? 'Testi Bitir' 
                  : 'Sonraki →'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
