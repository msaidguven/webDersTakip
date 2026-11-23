'use client';

// Misafir anasayfası v1 (2026-10-19 — tek misafir tasarımı; eski sürümler git geçmişinde).
// Düzen: sınıflar ana seçim (her sınıf kendi kartı → o sınıfın ders sayfası); sağ sütun (gerçek veri):
// "Okulda bu hafta" — her derste bir konu; "Yeni eklenen konular" — sınıf sekmeli.
// Görünüm: robotik kontrol paneli teması (metal paneller, HUD köşebentleri, neon, krom başlık).
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, Sun } from 'lucide-react';
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
import { DailyQuestionFullScreen, DailyQuestionOfTheDay, useDailyQuestionStatus } from './DailyQuestionCard';
import { roboticFontVars } from '../robotic/fonts';
import { GradeMetalCard } from '@/app/src/components/GradeMetalCard';
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

// Hızlı erişim satırı: iki rozet — konu sayısı konu anlatımına, soru sayısı soru bankasına gider.
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
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-sm font-bold text-default">{lesson.name}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{lesson.unitCount} ünite</span>
        </span>
        <span className="flex flex-wrap gap-1.5">
          {lesson.topicCount > 0 && (
            <QuickBadge href={lessonPath}>
              {lesson.topicCount} konu anlatımı
            </QuickBadge>
          )}
          {lesson.questionCount > 0 && (
            <QuickBadge href={lessonPath ? `/soru-bankasi${lessonPath}` : null}>
              {lesson.questionCount} soru
            </QuickBadge>
          )}
        </span>
      </div>
    </li>
  );
}

function QuickBadge({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) {
    return (
      <span aria-disabled="true" className={`${r.badge} ${r.muted}`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={r.badge}>
      {children}
    </Link>
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
  upcomingExams,
}: {
  grades: Grade[];
  gradeSections: Record<string, HomeGradeSection>;
  stats: SiteStats;
  topStudents: TopStudentEntry[];
  thisWeek: { week: number; byGradeId: Record<string, ThisWeekTopicItem[]> };
  recentByGrade: Record<string, RecentTopicItem[]>;
  dailyQuestionSets: Record<string, DailyQuestionSet>;
  // Yaklaşan yazılılar kartı (yoksa kendini gizler) — sağ sütunun başında.
  upcomingExams?: ReactNode;
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
  const [quickGradeId, setQuickGradeId] = useState<string | null>(null);
  const [dailyGradeId, setDailyGradeId] = useState<string | null>(null);
  const [dailyOpen, setDailyOpen] = useState(false);

  // Mobilde tek birleşik sınıf seçici: kullanıcı bir kez sınıfını seçince dersler,
  // bu hafta, günün sorusu ve yeni konular aynı sınıfa senkronize olur.
  const selectUnifiedGrade = (id: string) => {
    setQuickGradeId(id);
    if (weekGrades.some((g) => g.id === id)) setWeekGradeId(id);
    if (recentGrades.some((g) => g.id === id)) setRecentGradeId(id);
    if (dailyGrades.some((g) => g.id === id)) setDailyGradeId(id);
  };

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
  const activeQuickGrade =
    quickGrades.find((g) => g.id === quickGradeId) ?? quickGrades[0] ?? null;
  const quickSection = activeQuickGrade
    ? gradeSections[activeQuickGrade.id]
    : undefined;
  // Günün sorusu: sınıf bazlı set; yalnızca seti olan sınıflar sekme olarak gösterilir.
  const dailyGrades = grades.filter((g) => dailyQuestionSets[g.id]);
  const activeDailyGrade =
    dailyGrades.find((g) => g.id === dailyGradeId) ?? dailyGrades[0] ?? null;
  const dailySet = activeDailyGrade
    ? dailyQuestionSets[activeDailyGrade.id]
    : undefined;
  const dailyStatus = useDailyQuestionStatus(dailySet ?? null);
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
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 pb-12 pt-4 sm:gap-8 sm:px-6 sm:pb-16 sm:pt-12 lg:px-8">
        {/* KOKPİT (hero) — mobilde kompakt uygulama karşılaması + tek birleşik sınıf seçici */}
        <section className={`${r.panel} ${r.hero} flex flex-col gap-4 p-4 sm:gap-8 sm:p-10`}>
          <span className={r.scan} aria-hidden="true" />
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="flex max-w-2xl flex-col gap-2.5 sm:gap-4">
              <span className={`inline-flex w-fit items-center gap-2 ${r.label}`}>
                <i className={r.led} aria-hidden="true" />
                {gradeRange ? `${gradeRange} · ` : ''}Ücretsiz MEB müfredatı
              </span>
              <h1 className={`text-[22px] font-extrabold leading-[1.12] sm:text-[2.75rem] sm:leading-[1.05] ${r.chrome}`}>
                Konuyu öğren, soruyla pekiştir.
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-lg">
                Her konunun anlatımı ve cevap anahtarlı soruları, sınıfına göre tek yerde.
              </p>

              {/* Mobilde tek birleşik sınıf seçici (seçilince tüm sayfa bölümleri senkronize olur) */}
              {quickGrades.length > 0 && activeQuickGrade && (
                <div
                  role="tablist"
                  aria-label="Sınıfını seç"
                  className={`mt-1 grid gap-1.5 rounded-2xl border p-1 lg:hidden ${r.divider}`}
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(quickGrades.length, 4)}, minmax(0, 1fr))`,
                    background: 'var(--bg)',
                  }}
                >
                  {quickGrades.map((g) => {
                    const active = g.id === activeQuickGrade.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => selectUnifiedGrade(g.id)}
                        className={`min-h-10 rounded-xl px-2 text-xs font-extrabold transition-all active:scale-[0.98] ${active ? `${r.btnNeon} text-white` : 'text-muted-foreground'
                          }`}
                      >
                        {g.level}. Sınıf
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Masaüstü CTA butonları (mobilde Header ve alt bölümlerde zaten mevcut) */}
              <div className="hidden flex-wrap gap-3 pt-1 sm:flex">
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

            <dl className="hidden grid-cols-3 gap-2 sm:grid md:w-auto">
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

        {/* Mobilde seçili sınıfın dersleri — gruplu ferah liste (ilk ekranda doğrudan derse erişim) */}
        {activeQuickGrade && quickSection && (
          <section aria-label={`${activeQuickGrade.name} dersleri`} className="flex flex-col gap-2.5 lg:hidden">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-[15px] font-extrabold text-default">
                {activeQuickGrade.level}. Sınıf Dersleri
              </h2>
              <Link href={`/${activeQuickGrade.slug}`} className={`text-xs font-bold ${r.accent}`}>
                Tümünü gör →
              </Link>
            </div>
            <ul className={`overflow-hidden rounded-[20px] border divide-y ${r.divider}`} style={{ background: 'var(--panel-solid)' }}>
              {quickSection.lessons.map((lesson) => {
                const gradeSlug = quickSection.gradeSlug ?? activeQuickGrade.slug ?? null;
                const lessonPath = gradeSlug && lesson.slug ? `/${gradeSlug}/${lesson.slug}` : `/${activeQuickGrade.slug}`;
                return (
                  <li key={lesson.id} className={r.divider}>
                    <Link
                      href={lessonPath}
                      className="flex min-h-[60px] items-center gap-3 px-3.5 py-2.5 active:scale-[0.99] transition-transform"
                    >
                      <SubjectIcon lessonName={lesson.name} variant="solid" size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold leading-snug text-default">
                          {lesson.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {lesson.unitCount} ünite
                          {lesson.topicCount > 0 ? ` · ${lesson.topicCount} konu` : ''}
                          {lesson.questionCount > 0 ? ` · ${lesson.questionCount} soru` : ''}
                        </span>
                      </span>
                      <ArrowRight className={`h-4 w-4 shrink-0 ${ACCENT}`} aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Mobilde Günün Sorusu açılır pencere kartı */}
        {dailySet && activeDailyGrade && (
          <button
            type="button"
            onClick={() => setDailyOpen(true)}
            className={`flex w-full items-center gap-3.5 rounded-[20px] p-4 text-left active:scale-[0.985] transition-transform lg:hidden ${r.panel} ${r.hero}`}
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/25">
              <Sun className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[15px] font-extrabold leading-tight text-default">
                  {activeDailyGrade.level}. Sınıf Günün Sorusu
                </span>
                {dailyStatus?.answered ? (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    Çözüldü
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                    Yeni
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {dailyStatus?.lessonName ? `${dailyStatus.lessonName} · ` : ''}Dokun, cevabı ve başarı oranını hemen gör
              </span>
            </span>
            <ArrowRight className={`h-4 w-4 shrink-0 ${ACCENT}`} aria-hidden="true" />
          </button>
        )}

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_350px] lg:gap-6">
          <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
            <section
              id="dersler"
              aria-labelledby="sinif-baslik"
              className={`${FRAME} hidden min-w-0 flex-col gap-5 p-5 sm:p-7 lg:flex`}
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
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
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
                            <GradeMetalCard href={`/${grade.slug}`} level={grade.level} title={`${grade.level}. Sınıf`}>
                              {lessons.length} ders · {unitCount} ünite{questionCount > 0 ? ` · ${questionCount.toLocaleString('tr-TR')} soru` : ''}
                            </GradeMetalCard>
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
                className={`${FRAME} hidden flex-col gap-4 p-5 sm:p-6 lg:flex`}
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
                <ul className={`grid grid-cols-1 gap-2 ${quickSection.lessons.length > 1 ? 'sm:grid-cols-2' : ''}`}>
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
              <div id="gunun-sorusu-bolumu" className="hidden scroll-mt-24 lg:block">
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
            {upcomingExams}
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
      {dailySet && (
        <DailyQuestionFullScreen
          open={dailyOpen}
          onClose={() => setDailyOpen(false)}
          set={dailySet}
        />
      )}
    </div>
  );
}
