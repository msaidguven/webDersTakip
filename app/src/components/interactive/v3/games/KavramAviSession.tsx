'use client';

// Çok Turlu Kavram Avı Oturumu (v3 Modüler Oyun #1).
// Mevcut useKavramOyunu, HarfCemberi ve KavramKutulari altyapısını doğrudan kullanır.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { HarfCemberi } from '@/app/src/components/kavram-avi/HarfCemberi';
import { KavramKutulari } from '@/app/src/components/kavram-avi/KavramKutulari';
import { useKavramOyunu } from '@/app/src/hooks/useKavramOyunu';
import { GUIDE } from '@/app/src/lib/interactiveLesson/guide';
import type { Kavram } from '@/app/src/lib/kavramAvi';
import type { V3KavramAviConfig, V3KavramAviRound } from '@/app/src/lib/interactiveLesson/typesV3';
import type { MiniGameProps } from './MiniGameRegistry';
import s from '../v3.module.css';

function KavramRoundPlay({
  round,
  roundIndex,
  totalRounds,
  onFeedback,
  onMistake,
  onNext,
  onSpeak,
}: {
  round: V3KavramAviRound;
  roundIndex: number;
  totalRounds: number;
  onFeedback: MiniGameProps<V3KavramAviConfig>['onFeedback'];
  onMistake: () => void;
  onNext: () => void;
  onSpeak?: (text: string, force?: boolean) => void;
}) {
  const kavram = useMemo<Kavram>(
    () => ({
      id: `${roundIndex}-${round.highlightSlug ?? round.word}`,
      kavram: round.word,
      tanim: round.definition ?? '',
    }),
    [roundIndex, round.highlightSlug, round.word, round.definition],
  );

  const prevSecimLen = useRef(0);
  const prevAktif = useRef(0);

  const oyun = useKavramOyunu(kavram, () => {
    onFeedback({
      mood: 'happy',
      text: round.praise,
      tone: 'ok',
      sfx: 'ok',
    });
  });

  useEffect(() => {
    if (oyun.secim.length > prevSecimLen.current) {
      onFeedback({
        mood: 'normal',
        text: 'Harfleri birleştirerek kavramı oluştur. İstersen İpucu alabilirsin.',
        tone: 'normal',
        sfx: 'link',
        linkStep: oyun.secim.length,
      });
    }
    prevSecimLen.current = oyun.secim.length;
  }, [oyun.secim.length, onFeedback]);

  useEffect(() => {
    if (round.definition) onSpeak?.(round.definition);
  }, [round.definition, onSpeak]);

  useEffect(() => {
    if (oyun.aktif > prevAktif.current && !oyun.tamamlandi) {
      onFeedback({
        mood: 'happy',
        text: GUIDE.v3KavramNextWord,
        tone: 'ok',
        sfx: 'ok',
      });
    }
    prevAktif.current = oyun.aktif;
  }, [oyun.aktif, oyun.tamamlandi, onFeedback]);

  useEffect(() => {
    if (!oyun.yanlis) return;
    onMistake();
    onFeedback({
      mood: 'oops',
      text: GUIDE.v3KavramWrong,
      tone: 'oops',
      sfx: 'retry',
    });
  }, [oyun.yanlis, onMistake, onFeedback]);

  return (
    <>
      {round.definition && (
        <div className={s.kavramDefCard}>
          <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-sky-700">
            Tanımı Oku ve Kavramı Bul ({roundIndex + 1}/{totalRounds})
          </span>
          “{round.definition}”
        </div>
      )}

      <KavramKutulari kelimeler={oyun.kelimeler} aktif={oyun.aktif} ipucu={oyun.ipucu} />

      {oyun.tamamlandi ? (
        <div className={s.kavramSolvedCard}>
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            <span className="text-lg font-extrabold tracking-wide">{round.word}</span>
          </div>
          <p className="m-0 text-sm font-semibold leading-relaxed text-emerald-900">{round.praise}</p>
          <button type="button" onClick={onNext} className={s.primaryBtn} style={{ width: '100%', maxWidth: 320 }}>
            {roundIndex + 1 < totalRounds ? (
              <>
                Sıradaki Kavram ({roundIndex + 2}/{totalRounds})
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            ) : (
              <>
                Kavram Avı’nı Tamamla
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      ) : (
        <HarfCemberi
          harfler={oyun.harfler}
          secim={oyun.secim}
          secilenKelime={oyun.secilenKelime}
          yanlis={oyun.yanlis}
          ipucuBitti={oyun.ipucuBitti}
          onHarfSec={oyun.harfSec}
          onGonder={oyun.gonder}
          onTemizle={oyun.temizle}
          onKaristir={oyun.karistir}
          onIpucu={oyun.ipucuAc}
        />
      )}
    </>
  );
}

export function KavramAviSession({
  config,
  onProgress,
  onFeedback,
  onComplete,
  onSpeak,
}: MiniGameProps<V3KavramAviConfig>) {
  const [roundIdx, setRoundIdx] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const total = config.rounds.length;
  const activeRound = config.rounds[roundIdx];

  useEffect(() => {
    onProgress({
      current: roundIdx + 1,
      total,
      label: `Kavram ${roundIdx + 1} / ${total}`,
    });
  }, [roundIdx, total, onProgress]);

  const handleNext = () => {
    if (roundIdx + 1 < total) {
      const nextIdx = roundIdx + 1;
      setRoundIdx(nextIdx);
      onFeedback({
        mood: 'normal',
        text: `${nextIdx + 1}. kavram hazır! Tanımı oku ve harfleri birleştir.`,
        tone: 'normal',
        sfx: 'tap',
      });
      return;
    }
    onComplete({
      score: total,
      total,
      mistakes,
    });
  };

  if (!activeRound) return null;

  return (
    <div className={s.kavramHost}>
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">{config.title}</span>
        <div className={s.roundPills} aria-label={`Tur ${roundIdx + 1} / ${total}`}>
          {config.rounds.map((r, i) => (
            <span
              key={r.word}
              className={`${s.roundPill} ${i < roundIdx ? s.roundPillDone : i === roundIdx ? s.roundPillActive : ''}`}
            />
          ))}
        </div>
      </div>

      <KavramRoundPlay
        key={`${config.title}-${roundIdx}`}
        round={activeRound}
        roundIndex={roundIdx}
        totalRounds={total}
        onFeedback={onFeedback}
        onMistake={() => setMistakes((m) => m + 1)}
        onNext={handleNext}
        onSpeak={onSpeak}
      />
    </div>
  );
}
