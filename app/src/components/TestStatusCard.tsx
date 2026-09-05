'use client';

// Soru bankası sayfalarındaki (konu ve ünite seviyesi) "Teste Başla"/"Teste Devam Et" kartı.
// Sayfanın geri kalanı (SEO içeriği, İncele modu) statik/ISR kalsın diye bu kart kendi
// verisini client'ta ayrıca çeker (DersClientCards.tsx'teki topicCount fetch'iyle aynı
// desen) — /api/soru-bankasi/topic-status veya unit-status'tan gelen sonuca göre ya "Teste
// Başla" (+ bu konuda/ünitede bugüne kadarki doğru/yanlış) ya da "Teste Devam Et" (+ yarım
// kalan oturumun ilerlemesi) gösterir. "Teste Başla"/"Devam Et" linki her iki durumda da
// AYNI /.../kavrama-testi veya /.../unite-testi URL'i — hangi soruların geleceğine (devam mı
// yeni mi) zaten o sayfanın kendi mantığı (loadTopicQuizState/loadUnitQuizState) karar
// veriyor, burası sadece doğru metni/sayıyı gösteriyor. Soru bankasının kendi @modal'ı
// sayesinde bu link normal tıklamada sayfadan hiç ayrılmadan overlay açar.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ListChecks, Loader2, Trophy } from 'lucide-react';
import type { SoruBankasiTestStatus } from '@/app/src/lib/soruBankasiStatus';

// Server Component'ten (soru bankası sayfaları) doğrudan lucide component referansı
// GEÇİRİLEMEZ (RSC serileştirme hatası: "Functions cannot be passed directly to Client
// Components") — bu yüzden ikon bir string anahtar olarak geliyor, gerçek component burada
// (zaten client tarafında) map'leniyor.
const ICONS = { trophy: Trophy, 'list-checks': ListChecks } as const;

interface TestStatusCardProps {
  scope: 'topic' | 'unit';
  topicId?: number;
  unitId: number;
  testHref: string;
  title: string;
  icon: keyof typeof ICONS;
  color: 'indigo' | 'emerald';
}

const COLOR_CLASSES = {
  indigo: {
    border: 'border-indigo-100',
    bg: 'bg-indigo-50/60',
    text: 'text-indigo-700',
    subtext: 'text-indigo-900/70',
    badge: 'bg-indigo-500',
    button: 'bg-indigo-600 hover:bg-indigo-700',
    bar: 'bg-indigo-500',
  },
  emerald: {
    border: 'border-emerald-100',
    bg: 'bg-emerald-50/60',
    text: 'text-emerald-700',
    subtext: 'text-emerald-900/70',
    badge: 'bg-emerald-500',
    button: 'bg-emerald-600 hover:bg-emerald-700',
    bar: 'bg-emerald-500',
  },
} as const;

export default function TestStatusCard({ scope, topicId, unitId, testHref, title, icon, color }: TestStatusCardProps) {
  const [status, setStatus] = useState<SoruBankasiTestStatus | null>(null);
  const classes = COLOR_CLASSES[color];
  const Icon = ICONS[icon];

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
    <div className={`flex flex-col gap-3 rounded-2xl border ${classes.border} ${classes.bg} p-4 sm:p-5`}>
      <div className={`flex items-center gap-2.5 text-sm font-black ${classes.text}`}>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${classes.badge} text-white shadow-sm`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        {title}
      </div>

      {!status ? (
        <div className={`flex items-center gap-2 text-xs font-bold ${classes.subtext}`}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Durum yükleniyor…
        </div>
      ) : resumable ? (
        <>
          <div className="space-y-1.5">
            <p className={`text-xs font-medium leading-relaxed ${classes.subtext}`}>
              Yarım kalan bir testin var: {resumable.answeredCount}/{resumable.total} · {resumable.correctCount} doğru, {resumable.wrongCount} yanlış
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
              <div
                className={`h-full rounded-full ${classes.bar}`}
                style={{ width: `${resumable.total ? Math.round((resumable.answeredCount / resumable.total) * 100) : 0}%` }}
              />
            </div>
          </div>
          <Link
            href={testHref}
            className={`flex items-center justify-center gap-1.5 rounded-xl ${classes.button} px-4 py-2.5 text-sm font-black text-white transition-colors`}
          >
            Teste Devam Et <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      ) : (
        <>
          <p className={`flex-1 text-xs font-medium leading-relaxed ${classes.subtext}`}>
            {status.testSize} soruluk test
            {status.loggedIn && status.solved > 0 ? ` — bu ${scope === 'topic' ? 'konuda' : 'ünitede'} şimdiye kadar ${status.solved} çözülmüş, ${status.correct} doğru, ${status.wrong} yanlış` : ''}
            {!status.loggedIn ? ' — giriş yaparsan ilerlemen kaydedilir' : ''}
          </p>
          <Link
            href={testHref}
            className={`flex items-center justify-center gap-1.5 rounded-xl ${classes.button} px-4 py-2.5 text-sm font-black text-white transition-colors`}
          >
            Teste Başla <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      )}
    </div>
  );
}
