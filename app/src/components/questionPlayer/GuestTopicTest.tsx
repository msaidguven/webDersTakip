'use client';

// Misafirin konu testi (2026-10-23 birleştirme): soru bankası konu sayfası, konu anlatımı sayfası ve
// slayt oynatıcısı aynı yerden çağırır. Soru ekranı üyelerinkiyle AYNI motor (QuizWithAsk → QuizClient,
// tam ekran oynatıcı); burada yalnız misafire özel soru seçimi var. Misafirde hiçbir şey kaydedilmez.
//
// Sıradaki 10 soru (2026-10-04, kullanıcı isteği): rastgele seçim aynı soruları tekrar getirip
// bazılarını hiç göstermiyordu (öğretmen akıllı tahtada tüm soruları tekrarsız dolaşabilmeli).
// Havuz müfredat (id) sırasında gelir; tarayıcı konu başına nerede kaldığını hatırlar, her bitirilen
// testte sıradaki 10 soruya geçer, sona gelince başa döner (son parti eksikse baştan tamamlanır).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import QuizWithAsk from '@/app/src/components/QuizWithAsk';
import { MAX_QUESTIONS_PER_TEST, type QuizQuestion } from '@/app/src/lib/quizQuestionTypes';
import { SLIDE_ACCENTS, PLAYER_TOP_BAR_CLASS, PlayerEyebrow, OverlayWindowButtons, PlayerFrame, useFullscreen } from './QuestionPlayerParts';

const CURSOR_KEY = 'guestTestCursor:v1';

function readCursors(): Record<string, number> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CURSOR_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readCursor(topicId: number, poolSize: number): number {
  const value = Number(readCursors()[topicId]);
  return Number.isInteger(value) && value >= 0 && value < poolSize ? value : 0;
}

function writeCursor(topicId: number, value: number) {
  try {
    window.localStorage.setItem(CURSOR_KEY, JSON.stringify({ ...readCursors(), [topicId]: value }));
  } catch {
    // depolama kapalı — her açılışta ilk 10 soru gelir
  }
}

function batchFrom<T>(items: T[], start: number, count: number): T[] {
  if (items.length <= count) return items.slice();
  return Array.from({ length: count }, (_, i) => items[(start + i) % items.length]);
}

type Batch = { start: number; questions: QuizQuestion[]; attempt: number };

type GuestTopicTestProps = {
  gradeId: number;
  lessonId: number;
  unitId: number;
  topicId: number;
  scopeLabel: string;
  onClose: () => void;
};

export default function GuestTopicTest({ gradeId, lessonId, unitId, topicId, scopeLabel, onClose }: GuestTopicTestProps) {
  const [pool, setPool] = useState<QuizQuestion[] | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);

  useEffect(() => {
    let cancelled = false;
    // public=1: misafire herkesle aynı, CDN'de önbellekli havuz (bkz. all-questions route).
    fetch(`/api/topics/${topicId}/all-questions?public=1`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { questions?: QuizQuestion[] }) => {
        if (cancelled) return;
        const all = data.questions || [];
        const start = readCursor(topicId, all.length);
        setPool(all);
        setBatch({ start, questions: batchFrom(all, start, MAX_QUESTIONS_PER_TEST), attempt: 0 });
      })
      .catch(() => {
        if (!cancelled) setError('Sorular yüklenemedi, tekrar dener misin?');
      });
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  // Test bitti → bu konuda bir sonraki açılış/deneme sıradaki partiden başlar.
  const finish = useCallback(() => {
    if (pool && pool.length > 0 && batch) writeCursor(topicId, (batch.start + MAX_QUESTIONS_PER_TEST) % pool.length);
  }, [pool, batch, topicId]);

  // "Yeni Test Çöz": sıradaki parti, QuizClient key ile sıfırdan başlar.
  const nextBatch = useCallback(() => {
    if (!pool) return;
    const start = readCursor(topicId, pool.length);
    setBatch((b) => ({ start, questions: batchFrom(pool, start, MAX_QUESTIONS_PER_TEST), attempt: (b?.attempt ?? 0) + 1 }));
  }, [pool, topicId]);

  if (!batch || !pool) {
    const accent = SLIDE_ACCENTS[0];
    return (
      <PlayerFrame
        variant="overlay"
        accent={accent}
        containerRef={containerRef}
        cardKey="guest-loading"
        header={
          <div className={PLAYER_TOP_BAR_CLASS}>
            <div className="min-w-0 w-full sm:w-auto">
              <PlayerEyebrow text={scopeLabel} accent={accent} fontScale={1} />
            </div>
            <OverlayWindowButtons isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} onClose={onClose} />
          </div>
        }
      >
        <div className="relative flex flex-1 items-center justify-center px-6 text-center" role="status" aria-label="Sorular yükleniyor">
          {error ? <p className="text-sm font-bold text-rose-500">{error}</p> : <Loader2 className="h-6 w-6 animate-spin text-slate-400" />}
        </div>
      </PlayerFrame>
    );
  }

  const seenUpTo = Math.min(pool.length, batch.start + batch.questions.length);
  return (
    <QuizWithAsk
      key={batch.attempt}
      presentation="player"
      gradeId={gradeId}
      lessonId={lessonId}
      unitId={unitId}
      topicId={topicId}
      scopeLabel={scopeLabel}
      exitHref=""
      exitLabel="Kapat"
      onExit={onClose}
      initialQuestions={batch.questions}
      reloadEndpoint=""
      onRetry={nextBatch}
      onFinish={finish}
      resultNote={
        pool.length > batch.questions.length && (
          <p className="mt-2 text-xs font-bold text-indigo-600">
            {seenUpTo >= pool.length
              ? `${pool.length} sorunun hepsini gördün, sıradaki test baştan başlar.`
              : `${pool.length} sorunun ${seenUpTo} tanesini gördün, sıradaki 10 soru hazır.`}
          </p>
        )
      }
    />
  );
}
