'use client';

// Soru bankası sayfalarındaki (konu ve ünite seviyesi) "Teste Başla"/"Teste Devam Et" kartı.
// Sayfanın geri kalanı (SEO içeriği, İncele modu) statik/ISR kalsın diye bu kart kendi
// verisini client'ta ayrıca çeker (DersClientCards.tsx'teki topicCount fetch'iyle aynı
// desen) — /api/soru-bankasi/topic-status veya unit-status'tan gelen sonuca göre ya "Teste
// Başla" (+ bu konuda/ünitede bugüne kadarki doğru/yanlış) ya da "Teste Devam Et" (+ yarım
// kalan oturumun ilerlemesi, dairesel gösterge ile) gösterir. "Teste Başla"/"Devam Et" linki
// her iki durumda da AYNI /.../kavrama-testi veya /.../unite-testi URL'i — hangi soruların
// geleceğine (devam mı yeni mi) zaten o sayfanın kendi mantığı (loadTopicQuizState/
// loadUnitQuizState) karar veriyor, burası sadece doğru metni/sayıyı gösteriyor. Soru
// bankasının kendi @modal'ı sayesinde bu link normal tıklamada sayfadan hiç ayrılmadan
// overlay açar.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { SoruBankasiTestStatus } from '@/app/src/lib/soruBankasiStatus';

interface TestStatusCardProps {
  scope: 'topic' | 'unit';
  topicId?: number;
  unitId: number;
  testHref: string;
  title: string;
  color: 'indigo' | 'emerald';
}

const COLOR_CLASSES = {
  indigo: { ring: 'text-indigo-500', button: 'bg-indigo-600 hover:bg-indigo-700' },
  emerald: { ring: 'text-emerald-500', button: 'bg-emerald-600 hover:bg-emerald-700' },
} as const;

// r=40, çevre = 2*pi*40 ≈ 251.33 — yüzdeye göre strokeDashoffset hesaplanıyor,
// -rotate-90 ile başlangıç 12 yönüne (saat başı) çekiliyor.
const RING_RADIUS = 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ percent, ringClass, label, sublabel }: { percent: number; ringClass: string; label: string; sublabel: string }) {
  const offset = RING_CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, percent)) / 100);
  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={RING_RADIUS} fill="none" strokeWidth="9" style={{ stroke: 'var(--border)' }} />
        <circle
          cx="50"
          cy="50"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className={ringClass}
          style={{ stroke: 'currentColor', strokeDasharray: RING_CIRCUMFERENCE, strokeDashoffset: offset, transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-black text-default">{label}</span>
        <span className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">{sublabel}</span>
      </div>
    </div>
  );
}

export default function TestStatusCard({ scope, topicId, unitId, testHref, title, color }: TestStatusCardProps) {
  const [status, setStatus] = useState<SoruBankasiTestStatus | null>(null);
  const classes = COLOR_CLASSES[color];

  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    const url =
      scope === 'topic'
        ? `/api/soru-bankasi/topic-status?topicId=${topicId}&unitId=${unitId}`
        : `/api/soru-bankasi/unit-status?unitId=${unitId}`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SoruBankasiTestStatus | null) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, topicId, unitId]);

  const resumable = status?.resumable ?? null;

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-default bg-surface-elevated p-4 text-center sm:p-6">
      <p className="text-base font-black text-default sm:text-lg">{title}</p>

      {!status ? (
        <div className="flex items-center gap-2 py-4 text-xs font-bold text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Durum yükleniyor…
        </div>
      ) : resumable ? (
        <>
          <p className="-mt-2 text-xs font-bold text-muted-foreground sm:text-sm">Tamamlanmamış bir testiniz var</p>

          <ProgressRing
            percent={resumable.total ? (resumable.answeredCount / resumable.total) * 100 : 0}
            ringClass={classes.ring}
            label={`${resumable.answeredCount}/${resumable.total}`}
            sublabel="Soru"
          />

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5 text-sm font-black text-default">
              {resumable.correctCount} DOĞRU <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex items-center gap-1.5 text-sm font-black text-default">
              {resumable.wrongCount} YANLIŞ <XCircle className="h-4 w-4 text-rose-500" />
            </div>
          </div>

          <Link
            href={testHref}
            className={`flex w-full items-center justify-center gap-1.5 rounded-xl ${classes.button} px-4 py-3 text-sm font-black text-white transition-colors`}
          >
            Teste Devam Et <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      ) : (
        <>
          <p className="-mt-2 text-xs font-bold text-muted-foreground sm:text-sm">
            {status.testSize} soruluk test
            {!status.loggedIn ? ' — giriş yaparsan ilerlemen kaydedilir' : ''}
          </p>

          {status.loggedIn && status.solved > 0 && (
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-1.5 text-sm font-black text-default">
                {status.correct} DOĞRU <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="flex items-center gap-1.5 text-sm font-black text-default">
                {status.wrong} YANLIŞ <XCircle className="h-4 w-4 text-rose-500" />
              </div>
            </div>
          )}

          <Link
            href={testHref}
            className={`flex w-full items-center justify-center gap-1.5 rounded-xl ${classes.button} px-4 py-3 text-sm font-black text-white transition-colors`}
          >
            Teste Başla <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      )}
    </div>
  );
}
