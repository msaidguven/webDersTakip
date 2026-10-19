'use client';

// İlerlemem (eski "Panel", yol haritası 4 — 2026-09-28 onaylı taslak:
// https://claude.ai/artifact/KY9tfyz86FfaSnktevr5d3). Anasayfa "Bugün"ü (şimdi ne yapayım)
// yanıtlar; burası "nasıl gidiyorum, nerede eksiğim". Anasayfadaki kutular (günlük hedef,
// bugünkü görev) burada TEKRAR ETMEZ.
//
// Sıra (2026-10-12, Sınav Hazırlık projesindeki tasarımdan — taslak https://claude.ai/artifact/BhprJ2kq1N4gouA6tRTmkH):
// Son 7 gün → yarım kalan testler (yalnız varsa; bitenler /ilerlemem/aktiviteler'de) → son 7 gün çizelgesi
// (2026-10-20, "bu hafta önceliğin"in yerine) |
// ders raporları (her ders /ilerlemem/[ders]: ünite başarı grafiği, zorlandığın konular, tüm konular) →
// rozetler → tüm testler / sıralama; günlük hedef seçimi başlıkta. Her bölüm kendi verisini SWR ile çeker;
// aynı veriyi kullananlar önbelleği paylaşır (konu ustalığı: öncelikler + ders listesi + özet).
import { useEffect } from 'react';
import Link from 'next/link';
import { useSWRConfig } from 'swr';
import { ArrowRight, ListChecks, Trophy, CalendarDays } from 'lucide-react';
import { useAuth } from '../src/context/AuthContext';
import { useMyProfileBasics } from '../src/hooks/useMyGradeSlug';
import { onQuizModalClosed } from '../src/lib/panelRefreshBridge';
import { AuthPrompt } from '../src/components/AuthPrompt';
import { ProgressSummary } from '../src/components/progress/ProgressSummary';
import { WeeklyChart } from '../src/components/progress/WeeklyChart';
import { LessonList } from '../src/components/progress/LessonList';
import { MyTests } from '../src/components/progress/MyTests';
import { Badges } from '../src/components/progress/Badges';
import { DailyGoalPicker } from '../src/components/progress/DailyGoalPicker';
import { roboticFontVars } from '../src/components/robotic/fonts';
import r from '../src/components/robotic/robotic.module.css';

// Görünüm: "robotik kontrol paneli" teması (2026-10-19, ders raporu/anasayfa ile aynı; bkz. robotic).

// Test penceresi (bu rotadaki @modal) kapanınca tazelenecek bölüm verileri.
const PROGRESS_KEYS = new Set(['progress-daily-activity', 'topic-mastery', 'review-due', 'my-tests', 'monthly-activity']);

const SHORTCUTS = [
  { href: '/ilerlemem/aktiviteler', label: 'Tüm testlerim', hint: 'Çözdüğün bütün testler', Icon: ListChecks },
  { href: '/ilerlemem/siralama', label: 'Haftalık sıralama', hint: 'Bu hafta kim önde?', Icon: Trophy },
  { href: '/ders-takip-cizelgesi', label: 'Ders takip çizelgesi', hint: 'Ay ay doğru ve yanlışların', Icon: CalendarDays },
];

export default function IlerlememPage() {
  const { user, loading } = useAuth();
  const profile = useMyProfileBasics();
  const { mutate } = useSWRConfig();

  useEffect(
    () => onQuizModalClosed(() => void mutate((key) => Array.isArray(key) && PROGRESS_KEYS.has(key[0]))),
    [mutate]
  );

  const firstName = profile?.fullName?.trim().split(/\s+/)[0];
  const meta = profile?.gradeName ?? null;

  return (
    <div className={`${roboticFontVars} ${r.root}`}>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-20 pt-8 sm:gap-8 sm:px-6 sm:pt-12 lg:px-8">
        <header className={`flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7 ${r.panel} ${r.hero}`}>
          <span className={r.scan} aria-hidden="true" />
          <div className="flex flex-col gap-2">
            {user && meta && (
              <span className={`inline-flex w-fit items-center gap-2 ${r.label}`}>
                <i className={r.led} aria-hidden="true" />
                {meta}
              </span>
            )}
            <h1 className={`text-3xl leading-tight sm:text-4xl ${r.chrome}`}>
              {user && firstName ? (
                <>
                  Merhaba, {firstName}
                </>
              ) : (
                'İlerlemem'
              )}
            </h1>
            {user && <p className="text-base text-muted-foreground">Nerede olduğunu gör, bir sonraki adımını seç.</p>}
          </div>
          {user && <DailyGoalPicker />}
        </header>

        {loading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-surface-elevated" />
        ) : !user ? (
          <AuthPrompt message="Son 7 gününü, serini ve hangi konularda zorlandığını görmek için giriş yap." />
        ) : (
          <>
            <ProgressSummary />

            <MyTests />

            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
              <WeeklyChart />
              <div id="derslerim" className="scroll-mt-24">
                <LessonList />
              </div>
            </div>

            <Badges />

            <nav aria-label="Diğer sayfalar" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {SHORTCUTS.map(({ href, label, hint, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`group flex items-center gap-4 rounded-2xl p-4 hover:-translate-y-0.5 ${r.item}`}
                >
                  <span className={`h-10 w-10 shrink-0 ${r.chipBox}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold text-default">{label}</span>
                    <span className="text-sm text-muted-foreground">{hint}</span>
                  </span>
                  <ArrowRight className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1 ${r.accent}`} aria-hidden="true" />
                </Link>
              ))}
            </nav>
          </>
        )}
      </main>
    </div>
  );
}
