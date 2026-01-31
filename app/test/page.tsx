'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '../src/components/icons';

// Mock Question Type
interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
}

// Mock Questions
const mockQuestions: Question[] = [
  {
    id: '1',
    text: 'Aşağıdaki sayılardan hangisi rasyonel sayıdır?',
    options: ['√2', 'π', '0.75', 'e'],
    correctAnswer: 2,
  },
  {
    id: '2',
    text: '3/4 + 1/2 işleminin sonucu kaçtır?',
    options: ['4/6', '5/4', '1', '1/4'],
    correctAnswer: 1,
  },
  {
    id: '3',
    text: '(-3) × (-4) işleminin sonucu kaçtır?',
    options: ['-12', '12', '-7', '7'],
    correctAnswer: 1,
  },
  {
    id: '4',
    text: 'Bir kesrin paydası 0 olursa ne olur?',
    options: ['Sonuç 0 olur', 'Sonuç 1 olur', 'Tanımsız olur', 'Negatif olur'],
    correctAnswer: 2,
  },
  {
    id: '5',
    text: '2³ kaç eşittir?',
    options: ['6', '8', '9', '16'],
    correctAnswer: 1,
  },
];

export default function TestPage() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [isFinished, setIsFinished] = useState(false);

  // Timer
  useEffect(() => {
    if (timeLeft > 0 && !isFinished) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !isFinished) {
      setIsFinished(true);
    }
  }, [timeLeft, isFinished]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (index: number) => {
    setSelectedAnswer(index);
  };

  const handleNext = () => {
    if (selectedAnswer !== null) {
      setAnswers({ ...answers, [mockQuestions[currentQuestion].id]: selectedAnswer });
      setSelectedAnswer(null);
      if (currentQuestion < mockQuestions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
      } else {
        setIsFinished(true);
      }
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setSelectedAnswer(answers[mockQuestions[currentQuestion - 1].id] ?? null);
    }
  };

  const calculateScore = () => {
    let correct = 0;
    Object.entries(answers).forEach(([questionId, answer]) => {
      const question = mockQuestions.find(q => q.id === questionId);
      if (question && question.correctAnswer === answer) {
        correct++;
      }
    });
    return correct;
  };

  if (isFinished) {
    const score = calculateScore();
    const percentage = Math.round((score / mockQuestions.length) * 100);

    return (
      <div className="min-h-screen bg-[#0f0f11] bg-grid flex items-center justify-center p-8">
        <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
        
        <div className="relative max-w-2xl w-full">
          <div className="rounded-3xl bg-zinc-900/80 border border-white/10 p-12 text-center">
            {/* Trophy Icon */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-4xl mx-auto mb-8 shadow-2xl shadow-orange-500/30">
              🏆
            </div>

            <h1 className="text-4xl font-bold text-white mb-4">
              Test <span className="gradient-text">Tamamlandı</span>!
            </h1>
            <p className="text-zinc-400 mb-8">
              Tebrikler! Testi başarıyla tamamladın.
            </p>

            {/* Score Display */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-6 rounded-2xl bg-zinc-800/50">
                <p className="text-3xl font-bold text-white">{score}</p>
                <p className="text-sm text-zinc-500">Doğru</p>
              </div>
              <div className="p-6 rounded-2xl bg-zinc-800/50">
                <p className="text-3xl font-bold text-white">{mockQuestions.length - score}</p>
                <p className="text-sm text-zinc-500">Yanlış</p>
              </div>
              <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
                <p className="text-3xl font-bold text-white">%{percentage}</p>
                <p className="text-sm text-zinc-400">Başarı</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 justify-center">
              <Link
                href="/"
                className="px-8 py-3 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-all"
              >
                Ana Sayfaya Dön
              </Link>
              <Link
                href="/"
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
              >
                Yeni Test Başlat
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const question = mockQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / mockQuestions.length) * 100;

  return (
    <div className="min-h-screen bg-[#0f0f11] bg-grid">
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-[#0f0f11]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto h-full flex items-center justify-between px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <span className="text-sm font-bold text-white">E</span>
            </div>
            <span className="font-semibold text-white">EduSmart</span>
          </Link>

          <div className="flex items-center gap-6">
            {/* Progress */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-500">
                Soru {currentQuestion + 1} / {mockQuestions.length}
              </span>
              <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Timer */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-white/10 ${timeLeft < 60 ? 'text-red-400 border-red-500/30' : 'text-zinc-400'}`}>
              <Icon name="clock" size={18} />
              <span className="font-mono font-medium">{formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-[120px] pb-20 px-8">
        <div className="max-w-3xl mx-auto">
          {/* Question Card */}
          <div className="rounded-3xl bg-zinc-900/80 border border-white/10 p-8 mb-6">
            <h2 className="text-xl font-medium text-white mb-8">
              {question.text}
            </h2>

            {/* Options */}
            <div className="space-y-3">
              {question.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  className={`
                    w-full p-5 rounded-xl border-2 text-left transition-all duration-200
                    ${selectedAnswer === index
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900'
                    }
                  `}
                >
                  <div className="flex items-center gap-4">
                    <div className={`
                      w-8 h-8 rounded-lg border-2 flex items-center justify-center font-semibold transition-all
                      ${selectedAnswer === index
                        ? 'border-indigo-500 bg-indigo-500 text-white'
                        : 'border-zinc-700 text-zinc-500'
                      }
                    `}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className={`text-lg ${selectedAnswer === index ? 'text-white' : 'text-zinc-300'}`}>
                      {option}
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
                px-6 py-3 rounded-xl font-medium transition-all
                ${currentQuestion === 0
                  ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                  : 'bg-zinc-900 text-white hover:bg-zinc-800'
                }
              `}
            >
              ← Önceki
            </button>

            <button
              onClick={handleNext}
              disabled={selectedAnswer === null}
              className={`
                px-8 py-3 rounded-xl font-medium transition-all
                ${selectedAnswer === null
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/30'
                }
              `}
            >
              {currentQuestion === mockQuestions.length - 1 ? 'Testi Bitir' : 'Sonraki →'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
