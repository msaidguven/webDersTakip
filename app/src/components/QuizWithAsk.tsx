'use client';

import { useCallback, useState } from 'react';
import QuizClient, { type QuizClientProps } from './QuizClient';
import UnitDiscussion from './UnitDiscussion';
import { formatQuestionContext, type QuizQuestion } from '@/app/src/lib/quizQuestions';

type QuizWithAskProps = Omit<QuizClientProps, 'onCurrentQuestionChange'> & {
  gradeId: number;
  lessonId: number;
  unitId: number;
  topicId?: number | null;
};

// QuizClient ve UnitDiscussion sayfada ayrı kardeş bileşenler olduğu için "şu an
// hangi soruya bakılıyor, cevaplandı mı" bilgisini paylaşmaları gerekiyordu — bu
// wrapper o durumu tutup UnitDiscussion'a aktarıyor.
export default function QuizWithAsk({ gradeId, lessonId, unitId, topicId, ...quizProps }: QuizWithAskProps) {
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);

  // Yorumlar/AI sohbeti artık soru cevaplanmadan da görülebiliyor (kullanıcının
  // "soruyu çözmeden de yorum butonunu görmeliyim" isteği, 2026-09-02) — UnitDiscussion
  // buna göre isAnswered gerektirmiyor, sadece hangi soruya bakıldığını biliyoruz yeterli.
  const handleCurrentQuestionChange = useCallback((q: QuizQuestion | null) => {
    setCurrentQuestion(q);
  }, []);

  return (
    <>
      <QuizClient
        {...quizProps}
        gradeId={gradeId}
        lessonId={lessonId}
        unitId={unitId}
        topicId={topicId}
        onCurrentQuestionChange={handleCurrentQuestionChange}
      />
      {currentQuestion && (
        <div className="mx-auto max-w-lg px-4 pb-8">
          <UnitDiscussion
            gradeId={gradeId}
            lessonId={lessonId}
            unitId={unitId}
            quizQuestionId={currentQuestion.id}
            questionContext={formatQuestionContext(currentQuestion)}
          />
        </div>
      )}
    </>
  );
}
