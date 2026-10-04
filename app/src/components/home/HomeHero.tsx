import Link from 'next/link';
import { formatGradeRange } from '@/app/src/lib/homeMapping';
import type { SiteStats } from '@/app/src/lib/homeStats';
import type { DailyQuestionSet } from '@/app/src/lib/homeHighlights';
import { DailyQuestionOfTheDay } from './DailyQuestionCard';

// Misafir giriş bölümü (anasayfa v4 sade tasarım, 2026-10-02 — kullanıcı onaylı prototip
// ~/İndirilenler/ders_takip_anasayfa_v4_sade.html): solda net vaat + iki eylem + gerçek rakamlar,
// sağda Günün Sorusu. Süs/degrade yok; vurgu rengi sadece ana butonda ve başlığın son satırında.
// "Ders Takip" adı üst satırda kalır (marka araması sinyali, bkz. AboutSite).
export function HomeHero({
  gradeLevels,
  stats,
  dailyQuestionSet,
}: {
  isAuthenticated?: boolean;
  gradeLevels: number[];
  stats: SiteStats;
  dailyQuestionSet: DailyQuestionSet | null;
}) {
  const gradeRange = formatGradeRange(gradeLevels);
  const figures = [
    { value: stats.lessonCount, label: 'ders' },
    { value: stats.topicCount, label: 'konu anlatımı' },
    { value: stats.questionCount, label: 'cevap anahtarlı soru' },
  ];

  return (
    <section className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12">
      <div className="flex flex-col gap-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ders Takip · MEB müfredatına uygun{gradeRange ? ` · ${gradeRange}` : ''} · ücretsiz
        </p>
        <h1 className="text-[40px] font-bold leading-[1.05] tracking-[-0.035em] text-default sm:text-[56px]">
          Konuyu öğren,
          <br />
          soruyu çöz,
          <br />
          <span className="text-indigo-600 dark:text-indigo-400">ilerlemeni gör.</span>
        </h1>
        <p className="max-w-md text-[17px] leading-relaxed text-muted-foreground">
          Kısa konu anlatımları, cevap anahtarlı soru bankası ve seni tanıyan testler. Üye olmadan da hepsini kullanabilirsin.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <a href="#dersler" className="inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-indigo-700">
            Sınıfını seç
          </a>
          <Link
            href="/soru-bankasi"
            className="inline-flex min-h-11 items-center rounded-xl border border-default bg-background px-5 text-[15px] font-semibold text-default transition-colors hover:bg-surface"
          >
            Soru Bankası
          </Link>
        </div>
        <dl className="flex gap-8 pt-3">
          {figures.map((f) => (
            <div key={f.label}>
              <dt className="sr-only">{f.label}</dt>
              <dd className="text-2xl font-semibold tracking-tight text-default">{f.value.toLocaleString('tr-TR')}</dd>
              <dd className="text-sm text-muted-foreground">{f.label}</dd>
            </div>
          ))}
        </dl>
      </div>

      {dailyQuestionSet && <DailyQuestionOfTheDay set={dailyQuestionSet} />}
    </section>
  );
}
