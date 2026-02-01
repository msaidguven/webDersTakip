"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "../src/components/icons";

// ========== TYPES ==========

type QuestionType = "multiple_choice" | "blank" | "matching" | "classical";

interface BaseQuestion {
  id: string;
  type: QuestionType;
  text: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  score: number;
}

interface MultipleChoiceQuestion extends BaseQuestion {
  type: "multiple_choice";
  options: { id: string; text: string }[];
  correctOptionId?: string;
}

interface BlankQuestion extends BaseQuestion {
  type: "blank";
  options: { id: string; text: string }[];
  blanksCount: number;
}

interface MatchingQuestion extends BaseQuestion {
  type: "matching";
  leftItems: { id: string; text: string }[];
  rightItems: { id: string; text: string }[];
}

interface ClassicalQuestion extends BaseQuestion {
  type: "classical";
  options: { id: string; text: string }[];
}

type Question = MultipleChoiceQuestion | BlankQuestion | MatchingQuestion | ClassicalQuestion;

// ========== MOCK DATA ==========

const mockQuestions: Question[] = [
  {
    id: "q1",
    type: "multiple_choice",
    text: "Aşağıdaki sayılardan hangisi rasyonel sayıdır?",
    difficulty: 2,
    score: 1,
    options: [
      { id: "opt1", text: "√2" },
      { id: "opt2", text: "π" },
      { id: "opt3", text: "0.75" },
      { id: "opt4", text: "e" },
    ],
  },
  {
    id: "q2",
    type: "blank",
    text: "3/4 + 1/2 = ____",
    difficulty: 3,
    score: 2,
    blanksCount: 1,
    options: [
      { id: "b1", text: "5/4" },
      { id: "b2", text: "4/6" },
      { id: "b3", text: "1" },
      { id: "b4", text: "1/4" },
    ],
  },
  {
    id: "q3",
    type: "matching",
    text: "Aşağıdaki kavramları doğru tanımlarıyla eşleştirin:",
    difficulty: 4,
    score: 3,
    leftItems: [
      { id: "l1", text: "Rasyonel Sayı" },
      { id: "l2", text: "İrrasyonel Sayı" },
      { id: "l3", text: "Tam Sayı" },
    ],
    rightItems: [
      { id: "r1", text: "Kesir olarak yazılabilen sayı" },
      { id: "r2", text: "Kesir olarak yazılamayan sayı" },
      { id: "r3", text: "Negatif, pozitif ve sıfır" },
    ],
  },
  {
    id: "q4",
    type: "classical",
    text: "(-3) × (-4) işleminin sonucu kaçtır?",
    difficulty: 2,
    score: 1,
    options: [
      { id: "c1", text: "-12" },
      { id: "c2", text: "12" },
      { id: "c3", text: "-7" },
      { id: "c4", text: "7" },
    ],
  },
  {
    id: "q5",
    type: "multiple_choice",
    text: "Bir kesrin paydası 0 olursa ne olur?",
    difficulty: 3,
    score: 1,
    options: [
      { id: "opt5", text: "Sonuç 0 olur" },
      { id: "opt6", text: "Sonuç 1 olur" },
      { id: "opt7", text: "Tanımsız olur" },
      { id: "opt8", text: "Negatif olur" },
    ],
  },
];

// ========== DRAG & DROP COMPONENTS ==========

interface DraggableOptionProps {
  id: string;
  text: string;
  isDragging?: boolean;
  isPlaced?: boolean;
}

function DraggableOption({ id, text, isDragging, isPlaced }: DraggableOptionProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        px-4 py-3 rounded-xl font-medium cursor-grab active:cursor-grabbing
        transition-all duration-200 select-none touch-none
        ${isPlaced 
          ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" 
          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700"
        }
        ${isDragging ? "opacity-50 scale-105 rotate-2 z-50" : ""}
      `}
    >
      {text}
    </div>
  );
}

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      {children}
    </div>
  );
}

// ========== QUESTION COMPONENTS ==========

interface MultipleChoiceProps {
  question: MultipleChoiceQuestion;
  answer: string | null;
  onAnswer: (optionId: string) => void;
}

function MultipleChoiceQuestion({ question, answer, onAnswer }: MultipleChoiceProps) {
  return (
    <div className="space-y-3">
      {question.options.map((option, index) => (
        <button
          key={option.id}
          onClick={() => onAnswer(option.id)}
          className={`
            w-full p-4 sm:p-5 rounded-xl border-2 text-left transition-all duration-200
            ${answer === option.id
              ? "border-indigo-500 bg-indigo-500/10"
              : "border-zinc-800 hover:border-zinc-700 bg-zinc-900"
            }
          `}
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className={`
              w-8 h-8 sm:w-10 sm:h-10 rounded-lg border-2 flex items-center justify-center font-semibold transition-all flex-shrink-0
              ${answer === option.id
                ? "border-indigo-500 bg-indigo-500 text-white"
                : "border-zinc-700 text-zinc-500"
              }
            `}>
              {String.fromCharCode(65 + index)}
            </div>
            <span className={`text-base sm:text-lg ${answer === option.id ? "text-white" : "text-zinc-300"}`}>
              {option.text}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

interface BlankQuestionProps {
  question: BlankQuestion;
  answers: string[];
  onAnswer: (blankIndex: number, optionId: string | null) => void;
}

function BlankQuestionComponent({ question, answers, onAnswer }: BlankQuestionProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [placedOptions, setPlacedOptions] = useState<Record<number, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over) {
      const blankIndex = parseInt(over.id.toString().replace("blank-", ""));
      const optionId = active.id.toString();
      
      // Remove from previous position if exists
      const prevBlank = Object.entries(placedOptions).find(([, id]) => id === optionId);
      if (prevBlank) {
        const [prevIndex] = prevBlank;
        setPlacedOptions(prev => ({ ...prev, [prevIndex]: undefined }));
        onAnswer(parseInt(prevIndex), null);
      }

      setPlacedOptions(prev => ({ ...prev, [blankIndex]: optionId }));
      onAnswer(blankIndex, optionId);
    }
  };

  // Parse text to find blank positions
  const parts = question.text.split("____");

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Question Text with Drop Zones */}
        <div className="text-lg sm:text-xl text-white leading-relaxed">
          {parts.map((part, index) => (
            <React.Fragment key={index}>
              <span>{part}</span>
              {index < parts.length - 1 && (
                <SortableContext items={[`blank-${index}`]} strategy={horizontalListSortingStrategy}>
                  <div
                    id={`blank-${index}`}
                    data-id={`blank-${index}`}
                    className={`
                      inline-flex items-center justify-center min-w-[100px] sm:min-w-[120px] h-12 sm:h-14 mx-2 rounded-xl border-2 border-dashed transition-all
                      ${placedOptions[index] 
                        ? "border-indigo-500 bg-indigo-500/20" 
                        : "border-zinc-600 bg-zinc-800/50"
                      }
                    `}
                  >
                    {placedOptions[index] ? (
                      <span className="text-indigo-300 font-medium px-3">
                        {question.options.find(o => o.id === placedOptions[index])?.text}
                      </span>
                    ) : (
                      <span className="text-zinc-500 text-sm">?</span>
                    )}
                  </div>
                </SortableContext>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Draggable Options */}
        <div className="pt-4 border-t border-zinc-800">
          <p className="text-sm text-zinc-500 mb-3">Seçenekleri sürükleyip boşluklara bırakın:</p>
          <SortableContext 
            items={question.options.map(o => o.id)} 
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {question.options.map((option) => (
                <DraggableOption
                  key={option.id}
                  id={option.id}
                  text={option.text}
                  isPlaced={Object.values(placedOptions).includes(option.id)}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="px-4 py-3 rounded-xl bg-indigo-500 text-white font-medium shadow-xl">
            {question.options.find(o => o.id === activeId)?.text}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface MatchingQuestionProps {
  question: MatchingQuestion;
  matches: Record<string, string>;
  onMatch: (leftId: string, rightId: string | null) => void;
}

function MatchingQuestionComponent({ question, matches, onMatch }: MatchingQuestionProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over) {
      const leftId = active.id.toString().replace("left-", "");
      const rightId = over.id.toString().replace("right-", "");
      onMatch(leftId, rightId);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Left Column - Draggable Items */}
          <div className="space-y-3">
            <p className="text-sm text-zinc-500 mb-2">Kavramlar:</p>
            <SortableContext 
              items={question.leftItems.map(i => `left-${i.id}`)} 
              strategy={verticalListSortingStrategy}
            >
              {question.leftItems.map((item) => (
                <SortableItem key={item.id} id={`left-${item.id}`}>
                  <div className={`
                    p-4 rounded-xl border-2 cursor-grab active:cursor-grabbing transition-all
                    ${matches[item.id] 
                      ? "border-emerald-500 bg-emerald-500/10" 
                      : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
                    }
                  `}>
                    <span className="text-white font-medium">{item.text}</span>
                    {matches[item.id] && (
                      <span className="ml-2 text-emerald-400 text-sm">✓</span>
                    )}
                  </div>
                </SortableItem>
              ))}
            </SortableContext>
          </div>

          {/* Right Column - Drop Zones */}
          <div className="space-y-3">
            <p className="text-sm text-zinc-500 mb-2">Tanımlar:</p>
            <SortableContext 
              items={question.rightItems.map(i => `right-${i.id}`)} 
              strategy={verticalListSortingStrategy}
            >
              {question.rightItems.map((item) => {
                const matchedLeft = Object.entries(matches).find(([, rightId]) => rightId === item.id);
                return (
                  <div
                    key={item.id}
                    id={`right-${item.id}`}
                    data-id={`right-${item.id}`}
                    className={`
                      p-4 rounded-xl border-2 border-dashed transition-all
                      ${matchedLeft 
                        ? "border-emerald-500 bg-emerald-500/10" 
                        : "border-zinc-600 bg-zinc-800/30 hover:border-zinc-500"
                      }
                    `}
                  >
                    {matchedLeft ? (
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-300">{item.text}</span>
                        <button
                          onClick={() => onMatch(matchedLeft[0], null)}
                          className="text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span className="text-zinc-500">{item.text}</span>
                    )}
                  </div>
                );
              })}
            </SortableContext>
          </div>
        </div>

        {/* Reset Button */}
        {Object.keys(matches).length > 0 && (
          <button
            onClick={() => question.leftItems.forEach(item => onMatch(item.id, null))}
            className="text-sm text-zinc-500 hover:text-white transition-colors"
          >
            Eşleştirmeleri Sıfırla
          </button>
        )}
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="p-4 rounded-xl bg-indigo-500 text-white shadow-xl">
            {question.leftItems.find(i => `left-${i.id}` === activeId)?.text}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface ClassicalQuestionProps {
  question: ClassicalQuestion;
  answer: string | null;
  onAnswer: (optionId: string) => void;
}

function ClassicalQuestionComponent({ question, answer, onAnswer }: ClassicalQuestionProps) {
  return (
    <DndContext>
      <div className="space-y-4">
        <p className="text-sm text-zinc-500 mb-4">Doğru cevabı seçin:</p>
        <SortableContext 
          items={question.options.map(o => o.id)} 
          strategy={horizontalListSortingStrategy}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {question.options.map((option) => (
              <DraggableOption
                key={option.id}
                id={option.id}
                text={option.text}
                isPlaced={answer === option.id}
              />
            ))}
          </div>
        </SortableContext>
        
        {/* Click to select as fallback */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          {question.options.map((option) => (
            <button
              key={`btn-${option.id}`}
              onClick={() => onAnswer(option.id)}
              className={`
                py-3 px-4 rounded-xl font-medium transition-all
                ${answer === option.id
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700"
                }
              `}
            >
              {option.text}
            </button>
          ))}
        </div>
      </div>
    </DndContext>
  );
}

// ========== MAIN TEST PAGE ==========

export default function WeeklyTestPage() {
  const searchParams = useSearchParams();
  const gradeId = searchParams.get("grade_id");
  const lessonId = searchParams.get("lesson_id");
  const unitId = searchParams.get("unit_id");

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes
  const [isFinished, setIsFinished] = useState(false);

  // Timer
  useEffect(() => {
    if (timeLeft > 0 && !isFinished) {
      const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !isFinished) {
      setIsFinished(true);
    }
  }, [timeLeft, isFinished]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAnswer = useCallback((questionId: string, answer: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }, []);

  const handleNext = () => {
    if (currentQuestion < mockQuestions.length - 1) {
      setCurrentQuestion((c) => c + 1);
    } else {
      setIsFinished(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((c) => c - 1);
    }
  };

  const handleQuestionSelect = (index: number) => {
    setCurrentQuestion(index);
  };

  const calculateScore = () => {
    let total = 0;
    let maxScore = 0;

    mockQuestions.forEach((q) => {
      maxScore += q.score;
      const answer = answers[q.id];

      if (q.type === "multiple_choice") {
        // Mock scoring - in real app, compare with correct answer
        if (answer) total += q.score;
      } else if (q.type === "blank") {
        if (answer && answer.length === q.blanksCount) total += q.score;
      } else if (q.type === "matching") {
        const matchCount = Object.keys(answer || {}).length;
        if (matchCount === q.leftItems.length) total += q.score;
      } else if (q.type === "classical") {
        if (answer) total += q.score;
      }
    });

    return { total, maxScore, percentage: Math.round((total / maxScore) * 100) };
  };

  // Results Screen
  if (isFinished) {
    const { total, maxScore, percentage } = calculateScore();

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
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
              <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-zinc-800/50">
                <p className="text-xl sm:text-3xl font-bold text-white">{total}</p>
                <p className="text-xs sm:text-sm text-zinc-500">Puan</p>
              </div>
              <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-zinc-800/50">
                <p className="text-xl sm:text-3xl font-bold text-white">{mockQuestions.length - Object.keys(answers).length}</p>
                <p className="text-xs sm:text-sm text-zinc-500">Boş</p>
              </div>
              <div className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
                <p className="text-xl sm:text-3xl font-bold text-white">%{percentage}</p>
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
              {mockQuestions.map((q, i) => (
                <div
                  key={q.id}
                  className={`
                    aspect-square rounded-lg flex items-center justify-center text-sm font-bold
                    ${answers[q.id] 
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                      : "bg-zinc-800 text-zinc-500"
                    }
                  `}
                >
                  {i + 1}
                </div>
              ))}
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

  const question = mockQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / mockQuestions.length) * 100;

  const getDifficultyLabel = (diff: number) => {
    const labels = ["", "Kolay", "Orta", "Zor", "Çok Zor", "Uzman"];
    return labels[diff] || "Orta";
  };

  const getQuestionTypeLabel = (type: QuestionType) => {
    const labels: Record<QuestionType, string> = {
      multiple_choice: "Çoktan Seçmeli",
      blank: "Boşluk Doldurma",
      matching: "Eşleştirme",
      classical: "Klasik",
    };
    return labels[type];
  };

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
                    {getQuestionTypeLabel(question.type)}
                  </span>
                  <span className="px-2 sm:px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 text-xs sm:text-sm">
                    {getDifficultyLabel(question.difficulty)}
                  </span>
                  <span className="px-2 sm:px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 text-xs sm:text-sm">
                    {question.score} Puan
                  </span>
                </div>

                {/* Question Text */}
                <h2 className="text-lg sm:text-2xl font-medium text-white mb-6 sm:mb-8">
                  {currentQuestion + 1}. {question.text}
                </h2>

                {/* Question Content */}
                {question.type === "multiple_choice" && (
                  <MultipleChoiceQuestion
                    question={question}
                    answer={answers[question.id] || null}
                    onAnswer={(optId) => handleAnswer(question.id, optId)}
                  />
                )}

                {question.type === "blank" && (
                  <BlankQuestionComponent
                    question={question}
                    answers={answers[question.id] || []}
                    onAnswer={(idx, optId) => {
                      const current = answers[question.id] || [];
                      const updated = [...current];
                      updated[idx] = optId;
                      handleAnswer(question.id, updated);
                    }}
                  />
                )}

                {question.type === "matching" && (
                  <MatchingQuestionComponent
                    question={question}
                    matches={answers[question.id] || {}}
                    onMatch={(leftId, rightId) => {
                      const current = answers[question.id] || {};
                      if (rightId === null) {
                        const { [leftId]: _, ...rest } = current;
                        handleAnswer(question.id, rest);
                      } else {
                        handleAnswer(question.id, { ...current, [leftId]: rightId });
                      }
                    }}
                  />
                )}

                {question.type === "classical" && (
                  <ClassicalQuestionComponent
                    question={question}
                    answer={answers[question.id] || null}
                    onAnswer={(optId) => handleAnswer(question.id, optId)}
                  />
                )}
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
                  {currentQuestion === mockQuestions.length - 1 ? "Testi Bitir" : "Sonraki →"}
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
                    <span>Soru {currentQuestion + 1} / {mockQuestions.length}</span>
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
                  {mockQuestions.map((q, i) => (
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
