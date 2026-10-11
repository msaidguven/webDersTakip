'use client';

// Soru bankası konu sayfasında misafirin "Teste Başla"sı (2026-09-26): slayt oynatıcısının soru
// ekranıyla AYNI tam ekran deneyim (bkz. QuestionPlayerParts). Sorular sayfadaki SEO
// içeriğinden bağımsız, tıklanınca tek istekle gelir — ek bir URL/route yok, sayfa HTML'i
// değişmiyor. Misafirde hiçbir şey kaydedilmez; sonuç ekranı üyeliğe yönlendirir (sonucun
// kaydedilsin mesajı en güçlü dönüşüm anı).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, RotateCcw, Trophy } from 'lucide-react';
import type { QuizQuestion } from '@/app/src/lib/quizQuestionTypes';
import {
  SLIDE_ACCENTS,
  NAV_BTN_CLASS,
  PLAYER_BADGE_CLASS,
  PLAYER_NAV_ROW_CLASS,
  PLAYER_TOP_BAR_CLASS,
  PlayerEyebrow,
  FontScaleControl,
  OverlayWindowButtons,
  PlayerFrame,
  QuestionPills,
  QuestionStack,
  useFullscreen,
  useQuestionRunner,
  useSwipe,
} from './QuestionPlayerParts';

const QUESTIONS_PER_TEST = 10;

// Sıradaki 10 soru (2026-10-04, kullanıcı isteği): misafirde rastgele seçim aynı soruları tekrar
// getirip bazılarını hiç göstermiyordu. Havuz müfredat (id) sırasında gelir; tarayıcı konu başına
// nerede kaldığını hatırlar, her bitirilen testte sıradaki 10 soruya geçer, sona gelince başa
// döner (son parti eksikse baştan tamamlanır). Sunucuya hiçbir şey yazılmaz.
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

export default function QuizPlayerModal({
  topicId,
  topicTitle,
  eyebrowText,
  onClose,
}: {
  topicId: number;
  topicTitle: string;
  eyebrowText: string;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);
  const [pool, setPool] = useState<QuizQuestion[] | null>(null);
  // Bu testin havuzdaki başlangıç sırası — bitirince sıradakine geçilir.
  const [batchStart, setBatchStart] = useState(0);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [fontScale, setFontScale] = useState(1);

  const runner = useQuestionRunner({ questions, active: !!questions && !showResult });
  const { qIndex, answeredMap, goTo, restart } = runner;

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
        setBatchStart(start);
        setQuestions(batchFrom(all, start, QUESTIONS_PER_TEST));
        restart();
      })
      .catch(() => {
        if (!cancelled) setError('Sorular yüklenemedi, tekrar dener misin?');
      });
    return () => {
      cancelled = true;
    };
  }, [topicId, restart]);

  const newAttempt = useCallback(() => {
    if (!pool) return;
    const start = readCursor(topicId, pool.length);
    setBatchStart(start);
    setQuestions(batchFrom(pool, start, QUESTIONS_PER_TEST));
    setShowResult(false);
    restart();
  }, [pool, restart, topicId]);

  const total = questions?.length ?? 0;
  const currentAnswered = !!questions && answeredMap[questions[qIndex]?.id] != null;
  const isLast = qIndex === total - 1;

  const goPrev = useCallback(() => {
    if (!showResult && qIndex > 0) goTo(qIndex - 1);
  }, [showResult, qIndex, goTo]);
  const goNext = useCallback(() => {
    if (showResult || !questions) return;
    if (!isLast) goTo(qIndex + 1);
    else if (currentAnswered) {
      // Test bitti → bu konuda bir sonraki açılış/deneme sıradaki partiden başlar.
      if (pool && pool.length > 0) writeCursor(topicId, (batchStart + QUESTIONS_PER_TEST) % pool.length);
      setShowResult(true);
    }
  }, [showResult, questions, isLast, qIndex, goTo, currentAnswered, pool, batchStart, topicId]);

  const swipe = useSwipe(goNext, goPrev);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!document.fullscreenElement) onClose();
      } else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, goPrev, goNext]);

  const accent = SLIDE_ACCENTS[qIndex % SLIDE_ACCENTS.length];
  const badgeStyle = useMemo(() => (fontScale !== 1 ? { fontSize: `${11 * fontScale}px` } : undefined), [fontScale]);
  const answeredCount = Object.keys(answeredMap).length;

  return (
    <PlayerFrame
      variant="overlay"
      accent={accent}
      containerRef={containerRef}
      cardKey={`quiz-${runner.attempt}-${showResult ? 'r' : 'q'}`}
      onTouchStart={swipe.onTouchStart}
      onTouchEnd={swipe.onTouchEnd}
      headerResetKey={`${qIndex}-${showResult}`}
      header={
        <div className={PLAYER_TOP_BAR_CLASS}>
          <div className="min-w-0 w-full sm:w-auto">
            <PlayerEyebrow text={eyebrowText} accent={accent} fontScale={fontScale} />
          </div>
          <div className="flex shrink-0 items-center justify-end gap-1.5">
            {questions && !showResult && (
              <>
                <FontScaleControl fontScale={fontScale} onChange={setFontScale} badgeStyle={badgeStyle} />
                <div className={`hidden sm:block ${PLAYER_BADGE_CLASS}`} style={badgeStyle}>
                  <span className="text-emerald-600">D:{runner.correctCount}</span> <span className="text-rose-500">Y:{runner.incorrectCount}</span>
                </div>
                <div className={`text-slate-500 ${PLAYER_BADGE_CLASS}`} style={badgeStyle}>
                  {qIndex + 1}/{total}
                </div>
              </>
            )}
            <OverlayWindowButtons isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} onClose={onClose} />
          </div>
        </div>
      }
    >
      {error ? (
        <div className="relative flex flex-1 items-center justify-center px-6 text-center">
          <p className="text-sm font-bold text-rose-500">{error}</p>
        </div>
      ) : !questions ? (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-3" role="status" aria-label="Sorular yükleniyor">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : questions.length === 0 ? (
        <div className="relative flex flex-1 items-center justify-center px-6 text-center">
          <p className="text-sm font-bold text-slate-400">Bu konu için henüz soru eklenmemiş.</p>
        </div>
      ) : showResult ? (
        <GuestResult
          correct={runner.correctCount}
          total={total}
          topicTitle={topicTitle}
          accentFrom={accent.from}
          accentTo={accent.to}
          loginHref={`/login?redirectTo=${encodeURIComponent(pathname || '/')}`}
          canRetry={(pool?.length ?? 0) > 0}
          onRetry={newAttempt}
          poolSize={pool?.length ?? 0}
          seenUpTo={Math.min(pool?.length ?? 0, batchStart + total)}
          onClose={onClose}
        />
      ) : (
        <QuestionStack
          questions={questions}
          qIndex={qIndex}
          attempt={runner.attempt}
          mountedQIndexes={runner.mountedQIndexes}
          answeredMap={answeredMap}
          timedOutIds={runner.timedOutIds}
          timeLeft={runner.timeLeft}
          fontScale={fontScale}
          onAnswered={runner.handleAnswered}
        />
      )}

      {questions && questions.length > 0 && !showResult && (
        <div className={PLAYER_NAV_ROW_CLASS}>
          <button type="button" onClick={goPrev} disabled={qIndex === 0} aria-label="Önceki soru" className={NAV_BTN_CLASS}>
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <QuestionPills
            questions={questions}
            qIndex={qIndex}
            answeredMap={answeredMap}
            pillStart={runner.pillStart}
            setPillStart={runner.setPillStart}
            onJump={goTo}
            accentBar={accent.bar}
          />
          {isLast ? (
            // Son soruda ok yerine açık bir "Bitir" — sonuç ekranına geçtiği belli olsun.
            <button
              type="button"
              onClick={goNext}
              disabled={!currentAnswered}
              className="shrink-0 rounded-full px-4 py-2 text-xs sm:text-sm font-black text-white shadow-sm transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
            >
              Bitir ({answeredCount}/{total})
            </button>
          ) : (
            <button type="button" onClick={goNext} aria-label="Sonraki soru" className={NAV_BTN_CLASS}>
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}
        </div>
      )}
    </PlayerFrame>
  );
}

function GuestResult({
  correct,
  total,
  topicTitle,
  accentFrom,
  accentTo,
  loginHref,
  canRetry,
  onRetry,
  poolSize,
  seenUpTo,
  onClose,
}: {
  correct: number;
  total: number;
  topicTitle: string;
  accentFrom: string;
  accentTo: string;
  loginHref: string;
  canRetry: boolean;
  onRetry: () => void;
  poolSize: number;
  seenUpTo: number;
  onClose: () => void;
}) {
  const hasMore = poolSize > total;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const headline = pct >= 80 ? 'Harika iş! 🎉' : pct >= 50 ? 'İyi gidiyorsun! 💪' : 'Öğrenmenin bir parçası! 🌱';
  return (
    <div
      className="relative flex flex-1 min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-6 text-center"
      style={{ background: `linear-gradient(135deg, ${accentFrom}22, white 55%)` }}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full shadow-lg" style={{ background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})` }}>
        <Trophy className="h-8 w-8 text-white" />
      </div>
      <div>
        <p className="text-sm font-black text-slate-500">{headline}</p>
        <p className="mt-1 text-3xl sm:text-4xl font-black text-slate-800">
          {correct}/{total} <span className="text-lg sm:text-xl text-slate-400">doğru</span>
        </p>
        <p className="mt-1 text-xs font-bold text-slate-400">{topicTitle} · %{pct} başarı</p>
        {hasMore && (
          <p className="mt-2 text-xs font-bold text-indigo-600">
            {seenUpTo >= poolSize ? `${poolSize} sorunun hepsini gördün, sıradaki test baştan başlar.` : `${poolSize} sorunun ${seenUpTo} tanesini gördün, sıradaki 10 soru hazır.`}
          </p>
        )}
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-indigo-200 bg-white/80 p-4 shadow-sm">
        <p className="text-sm font-bold text-slate-700">Bu sonuç kaydedilmedi.</p>
        <p className="mt-1 text-xs text-slate-500">Üye ol; çözdüğün her soru kaydedilsin, yanlışların sana tekrar sorulsun, ilerlemeni takip et.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href="/register"
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-2.5 text-sm font-black text-white transition-opacity hover:opacity-90"
          >
            Ücretsiz Üye Ol
          </Link>
          <Link href={loginHref} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50">
            Giriş Yap
          </Link>
        </div>
      </div>

      <div className="flex gap-2">
        {canRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> {hasMore ? 'Sıradaki 10 Soru' : 'Tekrar Çöz'}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
        >
          Kapat
        </button>
      </div>
    </div>
  );
}
