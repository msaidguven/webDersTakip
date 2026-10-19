'use client';

// Ders raporu (İlerlemem altında, 2026-10-12 — Sınav Hazırlık tasarımının ortaokul uyarlaması:
// https://claude.ai/artifact/BhprJ2kq1N4gouA6tRTmkH). Tek dersin: başarı oranı / çözülen / öğrenilen konu,
// ünite ünite tamamlama ve başarı grafiği (üniteye dokununca konuları), zorlandığın konular, tekrar. Sınava özel
// bölüm / çıkmış soru kısımları yok. Derslere geçiş: geniş ekranda solda kenar çubuğu, dar ekranda üstte
// kaydırılabilir sekmeler. Veri İlerlemem ile aynı SWR önbelleklerinden — derse geçişte istek yok.
import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../../src/context/AuthContext';
import { useTopicMastery } from '../../src/hooks/useTopicMastery';
import { useReviewDue } from '../../src/hooks/useReviewDue';
import { onQuizModalClosed } from '../../src/lib/panelRefreshBridge';
import { AuthPrompt } from '../../src/components/AuthPrompt';
import { UnitProgressChart } from '../../src/components/progress/UnitProgressChart';
import { TONE_TEXT } from '../../src/components/progress/LessonList';
import { accuracyTone, lessonHref, totalsOf, unitReports } from '../../src/lib/lessonReports';
import { MASTERY_RULES, weakestTopics, type LessonMastery } from '../../src/lib/topicMastery';

const REFRESH_KEYS = new Set(['topic-mastery', 'review-due']);

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-surface p-3 sm:p-4">
      <span className="whitespace-nowrap text-xl font-black tabular-nums text-default sm:text-2xl">{value}</span>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}

function SectionTitle({ id, title, note }: { id: string; title: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 id={id} className="text-lg font-extrabold text-default">
        {title}
      </h2>
      {note && <span className="text-xs font-semibold text-muted-foreground">{note}</span>}
    </div>
  );
}

// Geniş ekran: solda dersler, her birinde başarı oranı. Sorusu olmayan ders listede soluk ve tıklanamaz.
function LessonSidebar({ lessons, current }: { lessons: LessonMastery[]; current: string }) {
  return (
    <nav aria-label="Dersler" className="sticky top-24 hidden lg:block">
      <h2 className="mb-2 px-3 text-xs font-black uppercase tracking-wider text-muted-foreground">Dersler</h2>
      <ul className="flex flex-col gap-0.5">
        {lessons.map((l) => {
          const t = totalsOf(l.topics);
          const active = l.slug === current;
          if (!l.slug || t.total === 0) {
            return (
              <li key={l.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-muted-foreground">
                <span className="min-w-0">{l.name}</span>
                <span className="shrink-0 text-xs">hazırlanıyor</span>
              </li>
            );
          }
          return (
            <li key={l.id}>
              <Link
                href={lessonHref(l.slug)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
                  active ? 'bg-indigo-600 font-bold text-white' : 'font-semibold text-default hover:bg-surface'
                }`}
              >
                <span className="min-w-0">{l.name}</span>
                <span className={`shrink-0 text-xs font-black tabular-nums ${active ? 'text-white' : TONE_TEXT[accuracyTone(t.accuracy)]}`}>
                  {t.accuracy == null ? '—' : `%${t.accuracy}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function LessonReportPage() {
  const { ders } = useParams<{ ders: string }>();
  const { user, loading } = useAuth();
  const { mutate } = useSWRConfig();
  const { data: mastery, error: mErr } = useTopicMastery();
  const { data: reviewDue = 0 } = useReviewDue();

  useEffect(
    () => onQuizModalClosed(() => void mutate((key) => Array.isArray(key) && REFRESH_KEYS.has(key[0]))),
    [mutate]
  );

  const lesson = mastery?.lessons.find((l) => l.slug === ders);
  const totals = useMemo(() => (lesson ? totalsOf(lesson.topics) : null), [lesson]);
  const units = useMemo(() => (lesson ? unitReports(lesson) : []), [lesson]);
  const weak = useMemo(() => (lesson ? weakestTopics([lesson], 5) : []), [lesson]);
  const tabs = mastery?.lessons.filter((l) => l.slug && l.topics.length > 0) ?? [];
  // Seçili ders sekmesi dar ekranda kaydırma alanının dışında kalmasın.
  const activeTab = useRef<HTMLAnchorElement>(null);
  const tabsReady = tabs.length > 1;
  useEffect(() => {
    activeTab.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [ders, tabsReady]);

  const back = (
    <Link href="/ilerlemem" className="inline-flex w-fit items-center gap-1 text-sm font-bold text-indigo-600 hover:underline dark:text-indigo-400">
      <ChevronLeft className="h-4 w-4" aria-hidden="true" /> İlerlemem
    </Link>
  );
  const shell = (body: React.ReactNode) => (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-8">
        {mastery ? <LessonSidebar lessons={mastery.lessons} current={ders} /> : <div className="hidden lg:block" />}
        <main className="flex min-w-0 flex-col gap-6 sm:gap-8">{body}</main>
      </div>
    </div>
  );

  if (loading || (user && mastery === undefined && !mErr)) {
    return shell(<div aria-busy="true" aria-label="Ders raporu yükleniyor" className="h-96 animate-pulse rounded-2xl bg-surface-elevated" />);
  }
  if (!user) return shell(<>{back}<AuthPrompt message="Ders raporunu görmek için giriş yap." /></>);
  if (mErr) {
    return shell(<>{back}<p role="alert" className="text-sm text-muted-foreground">Ders raporun şu an yüklenemedi. Sayfayı yenilemeyi dene.</p></>);
  }
  // Sınıfta olmayan ders slug'ı (ör. /ilerlemem/aylik) gerçek bir sayfa değil.
  if (!lesson || !totals) notFound();

  const learned = lesson.counts.learned;
  const topicTotal = lesson.topics.length + lesson.upcoming;
  const tone = accuracyTone(totals.accuracy);

  return shell(
    <>
      <header className="flex flex-col gap-2">
        {back}
        <h1 className="text-3xl font-black tracking-tight text-default sm:text-4xl">{lesson.name}</h1>
      </header>

      {tabs.length > 1 && (
        <nav aria-label="Ders değiştir" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:hidden">
          <ul className="flex w-max gap-2">
            {tabs.map((l) => (
              <li key={l.id}>
                <Link
                  href={lessonHref(l.slug!)}
                  ref={l.slug === ders ? activeTab : undefined}
                  aria-current={l.slug === ders ? 'page' : undefined}
                  className={`block whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-bold transition-colors ${
                    l.slug === ders ? 'bg-indigo-600 text-white' : 'bg-surface text-muted-foreground hover:text-default'
                  }`}
                >
                  {l.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat
          value={<span className={TONE_TEXT[tone]}>{totals.accuracy == null ? '—' : `%${totals.accuracy}`}</span>}
          label={totals.accuracy == null ? `başarı oranı (en az ${MASTERY_RULES.minSolvedToJudge} soru)` : 'başarı oranı'}
        />
        <Stat value={<>{totals.solved}<span className="text-sm text-muted-foreground">/{totals.total}</span></>} label="soru çözüldü" />
        <Stat value={<>{learned}<span className="text-sm text-muted-foreground">/{topicTotal}</span></>} label="konu öğrenildi" />
      </div>

      {units.length > 0 && (
        <section aria-labelledby="unite-basari" className="flex flex-col gap-3">
          <SectionTitle id="unite-basari" title="Ünitelere göre başarı oranı" />
          <UnitProgressChart units={units} />
        </section>
      )}

      {weak.length > 0 && (
        <section aria-labelledby="zorlandigin" className="flex flex-col gap-3">
          <SectionTitle id="zorlandigin" title="Zorlandığın konular" note={`en az ${MASTERY_RULES.minSolvedToJudge} soru, başarı oranı %${MASTERY_RULES.weakAccuracy * 100} altı`} />
          <ol className="flex flex-col gap-2">
            {weak.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-default p-3 sm:px-4">
                <span className="w-11 shrink-0 text-center text-sm font-black tabular-nums text-rose-700 dark:text-rose-400">%{t.accuracy}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-extrabold leading-snug text-default">{t.title}</span>
                  <span className="text-[13px] text-muted-foreground">{t.solved} soru çözdün · {t.wrong} yanlış</span>
                </span>
                {t.href && (
                  <Link href={t.href} aria-label={`${t.title} sorularını çöz`} className="flex min-h-11 shrink-0 items-center rounded-xl bg-indigo-600 px-4 text-sm font-extrabold text-white transition-colors hover:bg-indigo-700">
                    Çöz
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {reviewDue > 0 && (
        <section aria-labelledby="tekrar" className="flex flex-col gap-3">
          <SectionTitle id="tekrar" title="Tekrar" />
          <div className="flex items-center gap-3 rounded-2xl border border-default p-3 sm:px-4">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-extrabold text-default">Tekrar zamanı gelen {reviewDue} soru</span>
              <span className="text-[13px] text-muted-foreground">Tekrar testi tüm derslerin zamanı gelen sorularını birlikte açar.</span>
            </span>
            <Link href="/tekrar" className="flex min-h-11 shrink-0 items-center rounded-xl border border-indigo-600 px-4 text-sm font-extrabold text-indigo-700 transition-colors hover:bg-indigo-50 dark:border-indigo-400 dark:text-indigo-300 dark:hover:bg-indigo-500/10">
              Tekrar et
            </Link>
          </div>
        </section>
      )}

    </>
  );
}
