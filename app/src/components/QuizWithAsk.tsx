'use client';

import { useCallback, useState } from 'react';
import QuizClient, { type QuizClientProps } from './QuizClient';
import UnitDiscussion from './UnitDiscussion';
import { formatQuestionContext, type QuizQuestion } from '@/app/src/lib/quizQuestions';

type QuizWithAskProps = Omit<QuizClientProps, 'onCurrentQuestionChange'> & {
  gradeId: number;
  lessonId: number;
  unitId: number;
};

// QuizClient ve UnitDiscussion sayfada ayrı kardeş bileşenler olduğu için "şu an
// hangi soruya bakılıyor, cevaplandı mı" bilgisini paylaşmaları gerekiyordu — bu
// wrapper o durumu tutup UnitDiscussion'a aktarıyor.
export default function QuizWithAsk({ gradeId, lessonId, unitId, ...quizProps }: QuizWithAskProps) {
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  const handleCurrentQuestionChange = useCallback((q: QuizQuestion | null, answered: boolean) => {
    setCurrentQuestion(q);
    setIsAnswered(answered);
  }, []);

  return (
    <>
      <QuizClient {...quizProps} onCurrentQuestionChange={handleCurrentQuestionChange} />
      {currentQuestion && (
        <div className="mx-auto max-w-lg px-4 pb-8">
          <UnitDiscussion
            gradeId={gradeId}
            lessonId={lessonId}
            unitId={unitId}
            quizQuestionId={currentQuestion.id}
            questionContext={formatQuestionContext(currentQuestion)}
            isAnswered={isAnswered}
          />
        </div>
      )}
    </>
  );
}
