'use client';

// Soru bankası testini (konu/ünite) sayfa ve adres DEĞİŞTİRMEDEN tam ekran oynatıcıda açar:
// /api/soru-bankasi/topic-test|unit-test'ten QuizWithAsk'ın ihtiyaç duyduğu her şey tek istekte
// gelir, oynatıcı saf React state'iyle render edilir (neden navigasyon yok: TestStatusCard başı).
// Kullananlar: TestStatusCard (soru bankası sayfaları) ve İlerlemem ders raporundaki "Soru çöz".
import { useCallback, useRef, useState } from 'react';
import type { QuizQuestion } from '@/app/src/lib/quizQuestionTypes';
import QuizWithAsk from '@/app/src/components/QuizWithAsk';

interface TestData {
  gradeId: number;
  lessonId: number;
  unitId: number;
  topicId?: number;
  scopeLabel: string;
  initialQuestions: QuizQuestion[];
  remainingQuestionIds: number[];
  allCaughtUp: boolean;
  conflict: QuizTestConflict | null;
  resume: { sessionId: number; answers: { questionId: number; isCorrect: boolean }[] } | null;
  reloadEndpoint: string;
  questionBankPathBase?: string;
}

// Aynı ünitenin konu testi ile ünite testi aynı soru havuzunu paylaşıyor — ikisi aynı anda
// açık kalırsa biri diğerini "hayalete" çevirebiliyor (bkz. quizResume.ts'teki
// findConflictingSession). Yeni bir test başlatılırken böyle bir çakışma bulunursa, sessizce
// üstüne yazmak yerine kullanıcıya seçim sunuluyor (kullanıcının 2026-09-06 isteği).
export interface QuizTestConflict {
  sessionId: number;
  scopeLabel: string;
  href: string;
  total: number;
  answeredCount: number;
}

export { topicTestEndpoint, unitTestEndpoint } from '@/app/src/lib/quizTestEndpoints';

/** `exitHref`: oynatıcının yedek çıkış adresi (testin soru bankası sayfası). */
export function useQuizTestLauncher(onClosed?: () => void) {
  const [test, setTest] = useState<{ data: TestData; exitHref: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<QuizTestConflict | null>(null);
  const busy = useRef(false);

  const open = useCallback(async (endpoint: string, exitHref: string, forceNew = false) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    setConflict(null);
    try {
      const res = await fetch(forceNew ? `${endpoint}&forceNew=1` : endpoint);
      if (!res.ok) throw new Error('failed');
      const data = (await res.json()) as TestData;
      if (data.conflict) setConflict(data.conflict);
      else setTest({ data, exitHref });
    } catch {
      setError('Test yüklenemedi, tekrar dener misin?');
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  const close = useCallback(() => {
    setTest(null);
    onClosed?.();
  }, [onClosed]);

  const player = test && (
    <QuizWithAsk
      presentation="player"
      key={test.data.resume?.sessionId ?? 'new'}
      gradeId={test.data.gradeId}
      lessonId={test.data.lessonId}
      unitId={test.data.unitId}
      topicId={test.data.topicId}
      scopeLabel={test.data.scopeLabel}
      exitHref={test.exitHref}
      exitLabel="Kapat"
      onExit={close}
      initialQuestions={test.data.initialQuestions}
      remainingQuestionIds={test.data.remainingQuestionIds}
      allCaughtUp={test.data.allCaughtUp}
      reloadEndpoint={test.data.reloadEndpoint}
      resume={test.data.resume}
      questionBankPathBase={test.data.questionBankPathBase}
      // intro BİLEREK verilmiyor: kullanıcı zaten "Teste Başla/Devam Et/Soru çöz" butonuna
      // tıklayarak testi başlatmayı onaylamış oluyor — oynatıcı içinde ayrıca bir "kapak sayfası"
      // gösterip ikinci kez "Başla" dedirtmek gereksiz bir adım (kullanıcının 2026-09-06 bildirdiği bug).
    />
  );

  return { open, loading, error, conflict, player };
}
