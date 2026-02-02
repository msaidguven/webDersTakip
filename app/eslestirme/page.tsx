'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '../src/lib/supabaseClient';

interface MatchingPair {
  id: number;
  left_text: string;
  right_text: string;
  order_no: number;
}

interface MatchingQuestion {
  id: number;
  question_text: string;
  pairs: MatchingPair[];
}

function DragDropContent() {
  const searchParams = useSearchParams();
  const unitId = searchParams.get('unit_id');
  const week = searchParams.get('week');

  const [question, setQuestion] = useState<MatchingQuestion | null>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuestion();
  }, [unitId, week]);

  async function loadQuestion() {
    const supabase = createSupabaseBrowserClient();
    
    // Get a matching question for this week
    const { data: usages } = await supabase
      .from('question_usages')
      .select('question_id')
      .eq('curriculum_week', week || 19)
      .eq('usage_type', 'weekly');

    if (!usages?.length) {
      setLoading(false);
      return;
    }

    const questionIds = usages.map(u => u.question_id);

    // Get matching type questions
    const { data: questions } = await supabase
      .from('questions')
      .select('id, question_text')
      .in('id', questionIds)
      .eq('question_type_id', 4); // matching type

    if (!questions?.length) {
      setLoading(false);
      return;
    }

    const q = questions[0];

    // Get pairs for this question
    const { data: pairs } = await supabase
      .from('question_matching_pairs')
      .select('*')
      .eq('question_id', q.id)
      .order('order_no');

    if (pairs) {
      // Shuffle right items
      const shuffledPairs = [...pairs].sort(() => Math.random() - 0.5);
      
      setQuestion({
        id: q.id,
        question_text: q.question_text,
        pairs: pairs
      });
    }
    
    setLoading(false);
  }

  const handleDragStart = (leftText: string) => {
    setDraggedItem(leftText);
  };

  const handleDrop = (rightText: string) => {
    if (draggedItem) {
      setMatches(prev => ({ ...prev, [draggedItem]: rightText }));
      setDraggedItem(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const checkAnswers = () => {
    let correct = 0;
    question?.pairs.forEach(pair => {
      if (matches[pair.left_text] === pair.right_text) {
        correct++;
      }
    });
    setScore(correct);
    setShowResult(true);
  };

  const reset = () => {
    setMatches({});
    setShowResult(false);
    setScore(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-default mb-4">Eşleştirme Sorusu Bulunamadı</h1>
          <Link href="/" className="px-6 py-3 rounded-xl bg-indigo-500 text-default">
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    );
  }

  // Get available right items (not matched yet)
  const matchedRights = Object.values(matches);
  const availableRights = question.pairs
    .map(p => p.right_text)
    .filter(r => !matchedRights.includes(r));

  return (
    <div className="min-h-screen bg-[#0f0f11]">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-[#0f0f11]/95 backdrop-blur-xl border-b border-default">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <span className="text-xl font-bold text-default">E</span>
            </div>
            <span className="text-xl font-bold text-default">Eşleştirme Testi</span>
          </Link>
          <Link href="/ders" className="text-muted hover:text-default">← Geri</Link>
        </div>
      </nav>

      <main className="pt-[100px] pb-20 px-4 sm:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Question */}
          <div className="rounded-2xl bg-surface-elevated border border-default p-6 sm:p-8 mb-8">
            <h1 className="text-xl sm:text-2xl font-semibold text-default mb-2">
              {question.question_text}
            </h1>
            <p className="text-muted">Öğeleri sürükleyip eşleştirin</p>
          </div>

          {showResult ? (
            <ResultScreen 
              score={score} 
              total={question.pairs.length} 
              matches={matches}
              pairs={question.pairs}
              onRetry={reset}
            />
          ) : (
            <>
              {/* Matching Area */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column - Draggable Items */}
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-default mb-4">Sürüklenecekler</h3>
                  {question.pairs.map((pair) => {
                    const isMatched = matches[pair.left_text];
                    return (
                      <div
                        key={pair.id}
                        draggable={!isMatched}
                        onDragStart={() => handleDragStart(pair.left_text)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          isMatched 
                            ? 'bg-emerald-500/20 border-emerald-500/50 opacity-50' 
                            : 'bg-zinc-800 border-zinc-700 cursor-move hover:border-indigo-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={isMatched ? 'text-emerald-400' : 'text-default'}>
                            {pair.left_text}
                          </span>
                          {isMatched && (
                            <span className="text-emerald-400 text-sm">
                              → {matches[pair.left_text]}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right Column - Drop Zones */}
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-default mb-4">Buraya Bırak</h3>
                  {question.pairs.map((pair, index) => {
                    const matchedLeft = Object.entries(matches).find(
                      ([_, right]) => right === pair.right_text
                    );
                    
                    return (
                      <div
                        key={index}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(pair.right_text)}
                        className={`p-4 rounded-xl border-2 border-dashed transition-all min-h-[60px] flex items-center ${
                          matchedLeft
                            ? 'bg-indigo-500/20 border-indigo-500'
                            : 'bg-surface-elevated border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        {matchedLeft ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-indigo-400">{matchedLeft[0]}</span>
                            <span className="text-muted">=</span>
                            <span className="text-default">{pair.right_text}</span>
                            <button
                              onClick={() => {
                                const newMatches = { ...matches };
                                delete newMatches[matchedLeft[0]];
                                setMatches(newMatches);
                              }}
                              className="text-red-400 hover:text-red-300 ml-2"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted">{pair.right_text}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex justify-center gap-4">
                <button
                  onClick={reset}
                  className="px-6 py-3 rounded-xl bg-zinc-800 text-default hover:bg-zinc-700 transition-colors"
                >
                  Sıfırla
                </button>
                <button
                  onClick={checkAnswers}
                  disabled={Object.keys(matches).length !== question.pairs.length}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-default font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Kontrol Et
                </button>
              </div>

              {/* Progress */}
              <div className="mt-6 text-center text-muted">
                {Object.keys(matches).length} / {question.pairs.length} eşleştirme tamamlandı
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function ResultScreen({ 
  score, 
  total, 
  matches, 
  pairs,
  onRetry 
}: { 
  score: number; 
  total: number; 
  matches: Record<string, string>;
  pairs: MatchingPair[];
  onRetry: () => void;
}) {
  const percentage = Math.round((score / total) * 100);

  return (
    <div className="rounded-2xl bg-surface-elevated border border-default p-8 text-center">
      <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 ${
        percentage >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
        percentage >= 50 ? 'bg-amber-500/20 text-amber-400' :
        'bg-red-500/20 text-red-400'
      }`}>
        {percentage >= 80 ? '🎉' : percentage >= 50 ? '👍' : '💪'}
      </div>

      <h2 className="text-3xl font-bold text-default mb-2">
        {score} / {total} Doğru
      </h2>
      <p className="text-muted mb-6">%{percentage} Başarı</p>

      {/* Detailed Results */}
      <div className="text-left space-y-3 mb-8">
        {pairs.map((pair, index) => {
          const userMatch = matches[pair.left_text];
          const isCorrect = userMatch === pair.right_text;

          return (
            <div 
              key={index}
              className={`p-4 rounded-xl ${
                isCorrect ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-default">{pair.left_text}</span>
                <span className={isCorrect ? 'text-emerald-400' : 'text-red-400'}>
                  {isCorrect ? '✓' : '✗'} {userMatch}
                </span>
              </div>
              {!isCorrect && (
                <p className="text-emerald-400 text-sm mt-2">
                  Doğru cevap: {pair.right_text}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-center gap-4">
        <Link
          href="/ders"
          className="px-6 py-3 rounded-xl bg-zinc-800 text-default hover:bg-zinc-700 transition-colors"
        >
          Derse Dön
        </Link>
        <button
          onClick={onRetry}
          className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-default font-medium hover:shadow-lg"
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}

export default function DragDropTestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f11]" />}>
      <DragDropContent />
    </Suspense>
  );
}
