'use client';

import { useCallback, useState } from 'react';
import QuizClient, { type QuizClientProps } from './QuizClient';
import AskRagQuestionCard from './AskRagQuestionCard';
import QuestionComments from './QuestionComments';
import { formatQuestionContext, type QuizQuestion } from '@/app/src/lib/quizQuestions';

type QuizWithAskProps = Omit<QuizClientProps, 'onCurrentQuestionChange'> & {
  gradeId: number;
  lessonId: number;
  unitId: number;
  lessonName: string;
};

// QuizClient, AskRagQuestionCard ve QuestionComments sayfada ayrı kardeş bileşenler
// olduğu için "şu an hangi soruya bakılıyor, cevaplandı mı" bilgisini paylaşmaları
// gerekiyordu — bu wrapper o durumu tutup ikisine de aktarıyor.
export default function QuizWithAsk({ gradeId, lessonId, unitId, lessonName, ...quizProps }: QuizWithAskProps) {
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  const handleCurrentQuestionChange = useCallback((q: QuizQuestion | null, answered: boolean) => {
    setCurrentQuestion(q);
    setIsAnswered(answered);
  }, []);

  return (
    <>
      <QuizClient {...quizProps} onCurrentQuestionChange={handleCurrentQuestionChange} />
      <div className="mx-auto max-w-lg px-4 pb-8">
        <AskRagQuestionCard
          gradeId={gradeId}
          lessonId={lessonId}
          unitId={unitId}
          lessonName={lessonName}
          questionContext={currentQuestion ? formatQuestionContext(currentQuestion) : null}
        />
      </div>
      {currentQuestion && <QuestionComments questionId={currentQuestion.id} isAnswered={isAnswered} />}
    </>
  );
}
