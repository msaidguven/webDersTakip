'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface Question {
  id: number;
  question_text: string;
  choices?: { id: number; choice_text: string; is_correct: boolean }[];
}

export default function TopicTestClient() {
  const params = useParams();
  const gradeSlug = params.gradeSlug as string;
  const lessonSlug = params.lessonSlug as string;
  const unitSlug = params.unitSlug as string;
  const topicSlug = params.topicSlug as string;
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      
      // Topic'i bul
      const { data: topicData } = await supabase
        .from('topics')
        .select('id')
        .eq('slug', topicSlug)
        .single();

      if (!topicData) {
        setLoading(false);
        return;
      }

      // Önce question_usages'tan bu topic'e ait soru ID'lerini çek
      const { data: usagesData } = await supabase
        .from('question_usages')
        .select('question_id')
        .eq('topic_id', topicData.id);

      const questionIds = usagesData?.map((u: any) => u.question_id) || [];
      
      if (questionIds.length === 0) {
        setLoading(false);
        return;
      }

      // Soruları çek
      const { data: questionsData } = await supabase
        .from('questions')
        .select('id, question_text')
        .in('id', questionIds)
        .limit(10);

      // Her soru için seçenekleri çek
      const questionsWithChoices = await Promise.all(
        (questionsData || []).map(async (q) => {
          const { data: choicesData } = await supabase
            .from('question_choices')
            .select('id, choice_text, is_correct')
            .eq('question_id', q.id);
          return { ...q, choices: choicesData || [] };
        })
      );

      setQuestions(questionsWithChoices);
      setLoading(false);
    }

    load();
  }, [topicSlug]);

  const handleAnswer = (choiceId: number) => {
    setAnswers({ ...answers, [questions[currentIndex].id]: choiceId });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setShowResult(true);
    }
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q) => {
      const selectedChoice = q.choices?.find((c) => c.id === answers[q.id]);
      if (selectedChoice?.is_correct) correct++;
    });
    return correct;
  };

  if (loading) return <div className="p-8">Yükleniyor...</div>;
  if (questions.length === 0) return <div className="p-8">Bu konuda soru bulunmuyor.</div>;

  if (showResult) {
    const score = calculateScore();
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Test Sonucu</h2>
        <p className="text-xl">
          {score} / {questions.length} doğru
        </p>
        <p className="text-gray-600 mt-2">%{Math.round((score / questions.length) * 100)} başarı</p>
        <Link href={`/${gradeSlug}/${lessonSlug}/${unitSlug}/${topicSlug}`} className="text-blue-600 mt-4 inline-block">
          ← Konuya Dön
        </Link>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-4">
        <span className="text-gray-600">Soru {currentIndex + 1} / {questions.length}</span>
      </div>

      <h2 className="text-xl font-semibold mb-6">{currentQuestion.question_text}</h2>

      <div className="space-y-3">
        {currentQuestion.choices?.map((choice) => (
          <button
            key={choice.id}
            onClick={() => handleAnswer(choice.id)}
            className={`w-full p-4 text-left border rounded-lg transition ${
              answers[currentQuestion.id] === choice.id
                ? 'bg-indigo-100 border-indigo-500'
                : 'hover:bg-gray-50'
            }`}
          >
            {choice.choice_text}
          </button>
        ))}
      </div>

      <button
        onClick={handleNext}
        disabled={!answers[currentQuestion.id]}
        className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-lg disabled:opacity-50"
      >
        {currentIndex === questions.length - 1 ? 'Testi Bitir' : 'Sonraki'}
      </button>
    </div>
  );
}
