'use client';

// Gerçek Kavram Avı entegrasyonu: mevcut useKavramOyunu + KavramKutulari + HarfCemberi bileşenlerini kullanır.
import { useEffect, useMemo, useRef } from 'react';
import { HarfCemberi } from '@/app/src/components/kavram-avi/HarfCemberi';
import { KavramKutulari } from '@/app/src/components/kavram-avi/KavramKutulari';
import { useKavramOyunu } from '@/app/src/hooks/useKavramOyunu';
import type { Kavram } from '@/app/src/lib/kavramAvi';
import type { V2KavramAviStep } from '@/app/src/lib/interactiveLesson/typesV2';
import type { LessonSfx } from '@/app/src/lib/interactiveLesson/sound';
import type { RobotMood } from '../../RobotGuide';
import s from '../v2.module.css';

export type GameCallbacks = {
  onReact: (mood: RobotMood, text: string, tone?: 'normal' | 'ok' | 'oops', sfx?: LessonSfx, linkStep?: number) => void;
  onMiss: () => void;
  onComplete: () => void;
};

export function KavramAviGame({ step, onReact, onMiss, onComplete }: { step: V2KavramAviStep } & GameCallbacks) {
  const kavram = useMemo<Kavram>(
    () => ({
      id: step.highlightSlug ?? step.word,
      kavram: step.word,
      tanim: step.definition ?? '',
    }),
    [step.highlightSlug, step.word, step.definition],
  );

  const missedOnce = useRef(false);
  const prevSecimLen = useRef(0);
  const prevAktif = useRef(0);

  const oyun = useKavramOyunu(kavram, () => {
    onReact('happy', `🎉 ${step.feedback}`, 'ok', 'ok');
  });

  // Harf seçimi uzadıkça yükselen tını çal
  useEffect(() => {
    if (oyun.secim.length > prevSecimLen.current) {
      onReact('normal', step.say, 'normal', 'link', oyun.secim.length);
    }
    prevSecimLen.current = oyun.secim.length;
  }, [oyun.secim.length, onReact, step.say]);

  // Çok kelimeli kavramlarda ilk kelime bulununca kısa tebrik
  useEffect(() => {
    if (oyun.aktif > prevAktif.current && !oyun.tamamlandi) {
      onReact('happy', 'İlk kelime tamam! Şimdi sıradaki kelimeyi birleştir 👇', 'ok', 'ok');
    }
    prevAktif.current = oyun.aktif;
  }, [oyun.aktif, oyun.tamamlandi, onReact]);

  // Yanlış kelime denemesi
  useEffect(() => {
    if (!oyun.yanlis) return;
    if (!missedOnce.current) {
      missedOnce.current = true;
      onMiss();
    }
    onReact('oops', 'Olmadı! Harflerin üzerinden tekrar kaydır veya İpucu düğmesine dokun.', 'oops', 'retry');
  }, [oyun.yanlis, onMiss, onReact]);

  return (
    <div className={s.kavramTheme}>
      {step.definition && <div className={s.kavramDef}>“{step.definition}”</div>}

      <KavramKutulari kelimeler={oyun.kelimeler} aktif={oyun.aktif} ipucu={oyun.ipucu} />

      {oyun.tamamlandi ? (
        <button type="button" onClick={onComplete} className={s.goBtn}>
          Devam →
        </button>
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
    </div>
  );
}
