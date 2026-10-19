'use client';

// Misafir anasayfası v5 (deneme sürümü, /?v=5). v4 (varsayılan) olduğu gibi kalır; bu dosya yalnızca
// ?v=5 ile açılır. Sınıflar ana seçim: her sınıf kendi kartı, tıklayınca o sınıfın ders sayfasına gider.
// Sağ sütun (gerçek veri): "Okulda bu hafta" — her derste bir konu; "Yeni eklenen konular" — sınıf sekmeli.
import { useState } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Grade } from '@/app/src/models/homeTypes';
import type {
  HomeGradeSection,
  HomeLessonCard,
  SiteStats,
} from '@/app/src/lib/homeStats';
import type {
  DailyQuestionSet,
  RecentTopicItem,
  ThisWeekTopicItem,
} from '@/app/src/lib/homeHighlights';
import type { TopStudentEntry } from '@/app/src/lib/leaderboard';
import { AboutSite } from './AboutSite';
import { TopStudents } from './TopStudents';
import { SubjectIcon } from './SubjectIcon';
import { DailyQuestionOfTheDay } from './DailyQuestionCard';

const bodyFont = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-guest-v5',
  display: 'swap',
});

// Kullanıcının 2026-10-19 isteği: kartlara yumuşak amber zemin (yeşil ve mor denendi,
// beğenilmedi — amber bordoyla split-complementary, sıcak/akademik bir ton veriyor).
const GREEN_FRAME =
  'rounded-2xl border border-[#7A2634]/15 bg-gradient-to-br from-amber-50 via-amber-50/30 to-background';
const ICON_BOX = 'bg-zinc-100 text-[#7A2634]';
const HERO_BUTTON =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-sm font-bold transition-colors';
const OUTLINE =
  'border border-[#7A2634]/30 bg-background/70 text-[#7A2634] hover:bg-[#7A2634]/5';
const BUTTON = 'bg-[#7A2634] text-white hover:bg-[#5C1B27]';
const RECENT_SHOW = 3;

// Konu satırı: gerçek konu görseli varsa o, yoksa ders ikonu. Bağlantısı varsa tıklanabilir.
function TopicRow({
  title,
  subtitle,
  href,
  imageUrl,
  lessonName,
}: {
  title: string;
  subtitle: string;
  href: string | null;
  imageUrl: string | null;
  lessonName: string;
}) {
  const body = (
    <>
      {imageUrl ? (
        // Konu kapak görseli (topic_contents.hero_image_url). Liste içinde, ekran dışında → lazy.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-12 w-16 shrink-0 rounded-lg bg-surface-elevated object-cover"
        />
      ) : (
        <span
          className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-zinc-100"
          aria-hidden="true"
        >
          <SubjectIcon lessonName={lessonName} variant="solid" size="sm" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold leading-snug text-default">
          {title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {subtitle}
        </span>
      </span>
      {href && (
        <ArrowRight
          className="h-4 w-4 shrink-0 text-[#7A2634]"
          aria-hidden="true"
        />
      )}
    </>
  );
  const cls =
    'flex items-center gap-3 rounded-xl border border-[#7A2634]/15 bg-background/70 p-2.5';
  if (!href) return <li className={cls}>{body}</li>;
  return (
    <li>
      <Link
        href={href}
        className={`${cls} transition-colors hover:border-[#7A2634]/40 hover:bg-[#7A2634]/5`}
      >
        {body}
      </Link>
    </li>
  );
}

// Sınıf sekmeleri: yalnızca içeriği olan sınıflar.
function GradeTabs({
  grades,
  activeId,
  onSelect,
  label,
}: {
  grades: Grade[];
  activeId: string;
  onSelect: (id: string) => void;
  label: string;
}) {
  if (grades.length < 2) return null;
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1.5">
      {grades.map((g) => (
        <button
          key={g.id}
          type="button"
          role="tab"
          aria-selected={g.id === activeId}
          onClick={() => onSelect(g.id)}
          className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
            g.id === activeId
              ? BUTTON
              : 'border border-[#7A2634]/20 text-muted-foreground hover:text-[#7A2634]'
          }`}
        >
          {g.level}. Sınıf
        </button>
      ))}
    </div>
  );
}

// Hızlı erişim satırı: ders adı konu anlatımına, sağdaki sayı soru bankasına gider.
function QuickLessonRow({
  lesson,
  gradeSlug,
}: {
  lesson: HomeLessonCard;
  gradeSlug: string | null;
}) {
  const lessonPath =
    gradeSlug && lesson.slug ? `/${gradeSlug}/${lesson.slug}` : null;
  return (
    <li className="flex items-center gap-2.5 rounded-xl border border-[#7A2634]/15 bg-background/70 p-2.5 transition-colors hover:border-[#7A2634]/40">
      <SubjectIcon lessonName={lesson.name} variant="solid" size="sm" />
      <div className="min-w-0 flex-1">
        {lessonPath ? (
          <Link
            href={lessonPath}
            className="block truncate text-sm font-bold text-default hover:text-[#7A2634]"
          >
            {lesson.name}
          </Link>
        ) : (
          <span className="block truncate text-sm font-bold text-default">
            {lesson.name}
          </span>
        )}
        <span className="text-[11px] text-muted-foreground">
          {lesson.unitCount} ünite · {lesson.topicCount} konu
        </span>
      </div>
      {lesson.questionCount > 0 && lessonPath ? (
        <Link
          href={`/soru-bankasi${lessonPath}`}
          className="shrink-0 rounded-md border border-[#7A2634]/20 px-2 py-1 text-[11px] font-bold text-[#7A2634] transition-colors hover:bg-[#7A2634]/5"
        >
          {lesson.questionCount} soru
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className="shrink-0 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-bold text-zinc-400"
        >
          {lesson.questionCount} soru
        </span>
      )}
    </li>
  );
}

// Her ders için ilk konu (liste sırası korunur).
function firstPerLesson(items: ThisWeekTopicItem[]): ThisWeekTopicItem[] {
  return items.filter(
    (t, i) => items.findIndex((x) => x.lessonName === t.lessonName) === i,
  );
}

export function GuestHomeV5({
  grades,
  gradeSections,
  stats,
  topStudents,
  thisWeek,
  recentByGrade,
  dailyQuestionSets,
}: {
  grades: Grade[];
  gradeSections: Record<string, HomeGradeSection>;
  stats: SiteStats;
  topStudents: TopStudentEntry[];
  thisWeek: { week: number; byGradeId: Record<string, ThisWeekTopicItem[]> };
  recentByGrade: Record<string, RecentTopicItem[]>;
  dailyQuestionSets: Record<string, DailyQuestionSet>;
}) {
  // Bu hafta ve yeni konular için yalnızca içeriği olan sınıflar sekme olarak gösterilir.
  const levels = grades.map((g) => g.level);
  const gradeRange =
    levels.length > 0
      ? `${Math.min(...levels)}–${Math.max(...levels)}. sınıf`
      : '';
  const weekGrades = grades.filter(
    (g) => (thisWeek.byGradeId[g.id] ?? []).length > 0,
  );
  const recentGrades = grades.filter(
    (g) => (recentByGrade[g.id] ?? []).length > 0,
  );
  const [weekGradeId, setWeekGradeId] = useState<string | null>(null);
  const [recentGradeId, setRecentGradeId] = useState<string | null>(null);
  const activeWeekGrade =
    weekGrades.find((g) => g.id === weekGradeId) ?? weekGrades[0] ?? null;
  const activeRecentGrade =
    recentGrades.find((g) => g.id === recentGradeId) ?? recentGrades[0] ?? null;
  const weekTopics = activeWeekGrade
    ? firstPerLesson(thisWeek.byGradeId[activeWeekGrade.id] ?? [])
    : [];
  // Hızlı erişim: seçili sınıfın dersleri (sınıf kartlarının altında, kompakt).
  const quickGrades = grades.filter(
    (g) => (gradeSections[g.id]?.lessons ?? []).length > 0,
  );
  const [quickGradeId, setQuickGradeId] = useState<string | null>(null);
  const activeQuickGrade =
    quickGrades.find((g) => g.id === quickGradeId) ?? quickGrades[0] ?? null;
  const quickSection = activeQuickGrade
    ? gradeSections[activeQuickGrade.id]
    : undefined;
  // Günün sorusu: sınıf bazlı set; yalnızca seti olan sınıflar sekme olarak gösterilir.
  const dailyGrades = grades.filter((g) => dailyQuestionSets[g.id]);
  const [dailyGradeId, setDailyGradeId] = useState<string | null>(null);
  const activeDailyGrade =
    dailyGrades.find((g) => g.id === dailyGradeId) ?? dailyGrades[0] ?? null;
  const dailySet = activeDailyGrade
    ? dailyQuestionSets[activeDailyGrade.id]
    : undefined;
  const recent = activeRecentGrade
    ? (recentByGrade[activeRecentGrade.id] ?? []).slice(0, RECENT_SHOW)
    : [];

  return (
    <div
      className={`${bodyFont.variable} min-h-screen bg-[#F7F4FB] dark:bg-background font-[family-name:var(--font-guest-v5)]`}
    >
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-16 pt-8 sm:gap-8 sm:px-6 sm:pt-12 lg:px-8">
        <section className={`${GREEN_FRAME} flex flex-col gap-8 p-6 sm:p-10`}>
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex max-w-2xl flex-col gap-4">
              <span className="inline-flex w-fit rounded-full border border-[#7A2634]/20 bg-background/70 px-3 py-1 text-xs font-bold text-[#7A2634]">
                {gradeRange ? `${gradeRange} · ` : ''}MEB müfredatı
              </span>
              <h1 className="text-3xl font-black leading-tight tracking-tight text-default sm:text-4xl">
                Konuyu öğren, soruyla pekiştir.
              </h1>
              <p className="text-base text-muted-foreground sm:text-lg">
                Her konunun anlatımı ve cevap anahtarlı soruları, sınıfına göre
                tek yerde.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href="/register" className={`${HERO_BUTTON} ${BUTTON}`}>
                  Ücretsiz kayıt ol
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="#gunun-sorusu-bolumu"
                  className={`${HERO_BUTTON} ${OUTLINE}`}
                >
                  Günün sorusunu dene
                </Link>
                <Link href="/login" className={`${HERO_BUTTON} ${OUTLINE}`}>
                  Giriş yap
                </Link>
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-2 md:w-auto">
              <div className="flex flex-col gap-0.5 rounded-xl border border-[#7A2634]/15 bg-background/70 px-3 py-2.5">
                <dt className="text-[11px] font-bold text-muted-foreground">
                  Konu
                </dt>
                <dd className="text-base font-black text-default">
                  {stats.topicCount}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5 rounded-xl border border-[#7A2634]/15 bg-background/70 px-3 py-2.5">
                <dt className="text-[11px] font-bold text-muted-foreground">
                  Soru
                </dt>
                <dd className="text-base font-black text-default">
                  {stats.questionCount}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5 rounded-xl border border-[#7A2634]/15 bg-background/70 px-3 py-2.5">
                <dt className="text-[11px] font-bold text-muted-foreground">
                  Ders
                </dt>
                <dd className="text-base font-black text-default">
                  {stats.lessonCount}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-6">
            <section
              aria-labelledby="sinif-baslik"
              className={`${GREEN_FRAME} flex min-w-0 flex-col gap-5 p-5 sm:p-7`}
            >
              <div>
                <h2
                  id="sinif-baslik"
                  className="text-lg font-black tracking-tight text-default sm:text-xl"
                >
                  Sınıfını seç
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                  Derslerini ve konularını görmek için sınıfına gir.
                </p>
              </div>

              {[
                { label: 'Ortaokul', items: grades.filter((g) => g.level <= 8) },
                { label: 'Lise', items: grades.filter((g) => g.level > 8) },
              ].map(({ label, items }) =>
                items.length === 0 ? null : (
              <div key={label} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="shrink-0 rounded-full border border-[#7A2634]/25 bg-background/80 px-3 py-1 text-xs font-bold tracking-wide text-[#7A2634]">
                    {label}
                  </h3>
                  <span className="h-px flex-1 bg-[#7A2634]/15" aria-hidden="true" />
                </div>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                {items.map((grade) => {
                  const lessons = gradeSections[grade.id]?.lessons ?? [];
                  const unitCount = lessons.reduce(
                    (sum, l) => sum + l.unitCount,
                    0,
                  );
                  const questionCount = lessons.reduce(
                    (sum, l) => sum + l.questionCount,
                    0,
                  );
                  return (
                    <li key={grade.id}>
                      <Link
                        href={`/${grade.slug}`}
                        className="group flex h-full flex-col gap-5 rounded-2xl border border-[#7A2634]/15 bg-background/70 p-5 transition-colors hover:border-[#7A2634]/50 hover:bg-[#7A2634]/5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black ${ICON_BOX}`}
                          >
                            {grade.level}
                          </span>
                          <ArrowRight
                            className="h-5 w-5 text-[#7A2634] transition-transform group-hover:translate-x-1"
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <p className="text-lg font-black text-default">
                            {grade.level}. Sınıf
                          </p>
                          <p className="mt-1 text-xs font-bold text-muted-foreground">
                            {lessons.length} ders · {unitCount} ünite ·{' '}
                            {questionCount} soru
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              </div>
                ),
              )}
            </section>

            {activeQuickGrade && quickSection && (
              <section
                aria-labelledby="hizli-erisim"
                className={`${GREEN_FRAME} flex flex-col gap-4 p-5 sm:p-6`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3
                    id="hizli-erisim"
                    className="text-base font-black text-default"
                  >
                    Hızlı erişim
                  </h3>
                  <GradeTabs
                    grades={quickGrades}
                    activeId={activeQuickGrade.id}
                    onSelect={setQuickGradeId}
                    label="Hızlı erişim için sınıf"
                  />
                </div>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {quickSection.lessons.map((lesson) => (
                    <QuickLessonRow
                      key={lesson.id}
                      lesson={lesson}
                      gradeSlug={
                        quickSection.gradeSlug ?? activeQuickGrade.slug ?? null
                      }
                    />
                  ))}
                </ul>
              </section>
            )}

            {dailySet && activeDailyGrade && (
              <div id="gunun-sorusu-bolumu" className="scroll-mt-24">
                <DailyQuestionOfTheDay
                  set={dailySet}
                  tabs={
                    <GradeTabs
                      grades={dailyGrades}
                      activeId={activeDailyGrade.id}
                      onSelect={setDailyGradeId}
                      label="Günün sorusu için sınıf"
                    />
                  }
                />
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            {activeWeekGrade && (
              <section
                aria-labelledby="okulda-bu-hafta"
                className={`${GREEN_FRAME} flex flex-col gap-4 p-5`}
              >
                <div>
                  <h2
                    id="okulda-bu-hafta"
                    className="text-base font-black text-default"
                  >
                    Okulda bu hafta
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {thisWeek.week}. hafta · müfredat takvimine göre
                  </p>
                </div>
                <GradeTabs
                  grades={weekGrades}
                  activeId={activeWeekGrade.id}
                  onSelect={setWeekGradeId}
                  label="Bu hafta için sınıf"
                />
                <ul className="flex flex-col gap-2">
                  {weekTopics.map((t) => (
                    <TopicRow
                      key={t.id}
                      title={t.title}
                      subtitle={t.lessonName}
                      href={t.href}
                      imageUrl={t.imageUrl}
                      lessonName={t.lessonName}
                    />
                  ))}
                </ul>
              </section>
            )}

            {activeRecentGrade && (
              <section
                aria-labelledby="yeni-konular"
                className={`${GREEN_FRAME} flex flex-col gap-4 p-5`}
              >
                <h2
                  id="yeni-konular"
                  className="text-base font-black text-default"
                >
                  Yeni eklenen konular
                </h2>
                <GradeTabs
                  grades={recentGrades}
                  activeId={activeRecentGrade.id}
                  onSelect={setRecentGradeId}
                  label="Yeni konular için sınıf"
                />
                <ul className="flex flex-col gap-2">
                  {recent.map((t) => (
                    <TopicRow
                      key={t.id}
                      title={t.title}
                      subtitle={t.lessonName}
                      href={t.href}
                      imageUrl={t.imageUrl}
                      lessonName={t.lessonName}
                    />
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          <section className={`${GREEN_FRAME} p-5 sm:p-7`}>
            <AboutSite gradeLevels={grades.map((g) => g.level)} stats={stats} />
          </section>
          <section className={`${GREEN_FRAME} p-5 sm:p-7`}>
            <TopStudents students={topStudents} isAuthenticated={false} />
          </section>
        </div>
      </main>
    </div>
  );
}
