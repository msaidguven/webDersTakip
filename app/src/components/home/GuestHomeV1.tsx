'use client';

// Misafir anasayfası v1 (2026-10-19 — tek misafir tasarımı; eski sürümler git geçmişinde).
// Düzen: sınıflar ana seçim (her sınıf kendi kartı → o sınıfın ders sayfası); sağ sütun (gerçek veri):
// "Okulda bu hafta" — her derste bir konu; "Yeni eklenen konular" — sınıf sekmeli.
// Görünüm: robotik kontrol paneli teması (metal paneller, HUD köşebentleri, neon, krom başlık).
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
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
import { roboticFontVars } from '../robotic/fonts';
import r from '../robotic/robotic.module.css';

// Görünüm: "robotik kontrol paneli" teması (2026-10-19, ders raporuyla aynı; bkz. ../robotic).
const ACCENT = r.accent;
const FRAME = r.panel;
const ITEM = r.item;
const HERO_BUTTON =
  `inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-5 text-sm font-bold ${r.btnText}`;
const BUTTON = r.btnNeon;
const OUTLINE = r.btnGhost;
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
          className={`flex h-12 w-16 shrink-0 items-center justify-center rounded-lg ${r.tint}`}
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
          className={`h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1 ${ACCENT}`}
          aria-hidden="true"
        />
      )}
    </>
  );
  const cls = `group flex items-center gap-3 rounded-xl p-2.5 ${ITEM}`;
  if (!href) return <li className={cls}>{body}</li>;
  return (
    <li>
      <Link href={href} className={`${cls} hover:translate-x-0.5`}>
        {body}
      </Link>
    </li>
  );
}

// Sınıf sekmeleri (segment kontrol): yalnızca içeriği olan sınıflar.
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
    <div
      role="tablist"
      aria-label={label}
      className={`w-fit ${r.tabs}`}
    >
      {grades.map((g) => (
        <button
          key={g.id}
          type="button"
          role="tab"
          aria-selected={g.id === activeId}
          onClick={() => onSelect(g.id)}
          className={`${r.tab} ${g.id === activeId ? r.tabActive : ''}`}
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
    <li className={`flex items-center gap-2.5 rounded-xl p-2.5 ${ITEM} ${r.itemHover}`}>
      <SubjectIcon lessonName={lesson.name} variant="solid" size="sm" />
      <div className="min-w-0 flex-1">
        {lessonPath ? (
          <Link
            href={lessonPath}
            className="block truncate text-sm font-bold text-default hover:underline"
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
          className={`shrink-0 ${r.badge}`}
        >
          {lesson.questionCount} soru
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className={`shrink-0 ${r.badge} ${r.muted}`}
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

export function GuestHomeV1({
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

  const heroStats = [
    { label: 'Konu', value: stats.topicCount },
    { label: 'Soru', value: stats.questionCount },
    { label: 'Ders', value: stats.lessonCount },
  ];

  return (
    <div
      className={`${roboticFontVars} ${r.root}`}
    >
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-16 pt-8 sm:gap-8 sm:px-6 sm:pt-12 lg:px-8">
        {/* KOKPİT (hero) — metal panel + tarama ışığı */}
        <section className={`${r.panel} ${r.hero} flex flex-col gap-8 p-6 sm:p-10`}>
          <span className={r.scan} aria-hidden="true" />
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex max-w-2xl flex-col gap-4">
              <span className={`inline-flex w-fit items-center gap-2 ${r.label}`}>
                <i className={r.led} aria-hidden="true" />
                {gradeRange ? `${gradeRange} · ` : ''}MEB müfredatı
              </span>
              <h1 className={`text-3xl leading-[1.05] sm:text-[2.75rem] ${r.chrome}`}>
                Konuyu öğren, soruyla pekiştir.
              </h1>
              <p className="text-base text-muted-foreground sm:text-lg">
                Her konunun anlatımı ve cevap anahtarlı soruları, sınıfına göre
                tek yerde.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href="/register" className={`group ${HERO_BUTTON} ${BUTTON}`}>
                  Ücretsiz kayıt ol
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
                <Link
                  href="#gunun-sorusu-bolumu"
                  className={`${HERO_BUTTON} ${OUTLINE}`}
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Günün sorusunu dene
                </Link>
                <Link href="/login" className={`${HERO_BUTTON} ${OUTLINE}`}>
                  Giriş yap
                </Link>
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-2 md:w-auto">
              {heroStats.map((st) => (
                <div
                  key={st.label}
                  className={`flex min-w-[88px] flex-col gap-1 px-3.5 py-3 ${r.stat}`}
                >
                  <dt className={r.label}>
                    {st.label}
                  </dt>
                  <dd className={`text-2xl ${r.statValue}`}>
                    {st.value.toLocaleString('tr-TR')}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-6">
            <section
              aria-labelledby="sinif-baslik"
              className={`${FRAME} flex min-w-0 flex-col gap-5 p-5 sm:p-7`}
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
                      <h3 className={`shrink-0 ${r.label}`}>
                        {label}
                      </h3>
                      <span className={`h-px flex-1 border-t ${r.divider}`} aria-hidden="true" />
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
                              className={`group relative flex h-full flex-col gap-5 overflow-hidden rounded-2xl p-5 hover:-translate-y-[3px] ${ITEM}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span
                                  className={`h-14 w-14 text-2xl ${r.chipBox}`}
                                >
                                  {grade.level}
                                </span>
                                <ArrowRight
                                  className={`h-5 w-5 transition-transform duration-200 group-hover:translate-x-1 ${ACCENT}`}
                                  aria-hidden="true"
                                />
                              </div>
                              <div>
                                <p className={`text-lg font-bold text-default ${r.display}`}>
                                  {grade.level}. Sınıf
                                </p>
                                <p className="mt-1 text-xs font-bold text-muted-foreground">
                                  {lessons.length} ders · {unitCount} ünite
                                </p>
                                <p className={`mt-0.5 text-xs font-bold ${ACCENT}`}>
                                  {questionCount.toLocaleString('tr-TR')} soru
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
                className={`${FRAME} flex flex-col gap-4 p-5 sm:p-6`}
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
                className={`${FRAME} flex flex-col gap-4 p-5`}
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
                className={`${FRAME} flex flex-col gap-4 p-5`}
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
          <section className={`${FRAME} p-5 sm:p-7`}>
            <AboutSite gradeLevels={grades.map((g) => g.level)} stats={stats} />
          </section>
          <section className={`${FRAME} p-5 sm:p-7`}>
            <TopStudents students={topStudents} isAuthenticated={false} />
          </section>
        </div>
      </main>
    </div>
  );
}
