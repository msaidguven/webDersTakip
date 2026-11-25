'use client';

// Girişli öğrencinin anasayfası "Bugün" (yol haritası 3a, 2026-09-27): "Şimdi ne yapmalıyım?"
// sorusunu tek bir görevle yanıtlar. Derin analiz (ustalık haritası, geçmiş, günlük hedef takvimi,
// konu ilerlemesi) BURADA DEĞİL, "İlerlemem" sayfasında.
// Düzen: karşılama kartı + hızlı erişim (Soru Bankası, Tekrar, Sıralama); altta görev kartı, Okulda bu
// hafta ve Günün sorusu (sol), sağda yaklaşan yazılılar. 2026-11-17 sadeleştirme: Derslerim, "Bugünkü
// durumun" (seri/hedef/sıralama zaten başka yerde) ve Yeni konular (girişli sayfa SEO'ya katkı vermez;
// misafir anasayfasında duruyor) kaldırıldı; Derslerim'in aynısı İlerlemem'de. Okulda bu hafta görev
// kartının altına alındı (mobilde en altta kalıyordu). Yarım soru bankası testi ("Kaldığın yerden devam et") sayfa değiştirmeden oynatıcıda açılır
// (useQuizTestLauncher); sıralı testler kendi sayfasına gider.
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, CalendarDays, CheckCircle2, ChevronRight, Loader2, RotateCcw, Sun, Trophy } from 'lucide-react';
import { useStudentToday, type StudentToday as StudentTodayData, type TodayTask } from '@/app/src/hooks/useStudentToday';
import { useQuizTestLauncher } from '@/app/src/hooks/useQuizTestLauncher';
import { useMyGradeSlug } from '@/app/src/hooks/useMyGradeSlug';
import type { DailyQuestionSet, ThisWeekTopicItem } from '@/app/src/lib/homeHighlights';
import type { HomeLessonCard } from '@/app/src/lib/homeStats';
import { DailyQuestionFullScreen, useDailyQuestionStatus } from './DailyQuestionCard';
import { SchoolThisWeekCard } from './HomeHighlightCards';
import { SubjectIcon } from './SubjectIcon';
import { BottomSheet } from '../ui/BottomSheet';
import { PushReminderOptIn } from './PushReminderOptIn';
import { StudentFeedbackCard } from './StudentFeedbackCard';
import r from '../robotic/robotic.module.css';

// Bildirim izni kartı bu seriden itibaren gösterilir: ilk gün bir "izin ver" kartı kalabalık yapıyor.
const PUSH_OPT_IN_MIN_STREAK = 3;

type TaskCopy = { title: string; detail: string; cta: string; href: string; endpoint?: string; progress?: { done: number; total: number }; done?: boolean };

// Yarım testi açan bağlantıların ortak durumu: hangi bağlantı tıklandı, yükleniyor mu, hata var mı.
type Resume = {
  onClick: (key: string, endpoint: string | undefined, href: string) => (e: MouseEvent<HTMLAnchorElement>) => void;
  busyKey: string | null;
  errorKey: string | null;
  error: string | null;
};

const RESUME_TASK_KEY = 'task';

function taskCopy(task: TodayTask, data: StudentTodayData): TaskCopy {
  switch (task.kind) {
    case 'resume':
      return { title: 'Yarım kalan testini bitir', detail: task.title, cta: 'Kaldığın yerden devam et', href: task.href, endpoint: task.endpoint, progress: { done: task.answered, total: task.total } };
    case 'srs':
      return { title: `${task.count} soruyu tekrar etme zamanı`, detail: 'Daha önce yanlış yaptığın ya da unutmaya başladığın sorular.', cta: 'Tekrara başla', href: task.href };
    case 'weak':
      return { title: 'Zorlandığın bir konu var', detail: `${task.topicTitle} · ${task.lessonName}`, cta: 'Bu konudan soru çöz', href: task.href };
    case 'goal':
      return {
        title: data.dailyProgress > 0 ? `Bugünkü hedefine ${task.remaining} soru kaldı` : `Bugün ${data.dailyGoal} soru çöz`,
        detail: 'Kısa bir test çöz, serini koru.',
        cta: data.dailyProgress > 0 ? 'Devam et' : 'Hadi başla',
        href: task.href,
        progress: { done: data.dailyProgress, total: data.dailyGoal },
      };
    case 'done':
      return {
        title: 'Bugünkü hedefini tamamladın',
        detail: 'Aferin! Yarın yine gel, serin büyüsün.',
        cta: 'Günün sorusunu çöz',
        href: '#gunun-sorusu-bolumu',
        progress: { done: data.dailyGoal, total: data.dailyGoal },
        done: true,
      };
  }
}

function streakLine(data: StudentTodayData): string {
  // Bugün en az 1 soru çözüldüyse seri zaten güvende (bkz. getCurrentStreak).
  if (data.streak === 0) return 'Bugün bir soru çöz, serin başlasın.';
  if (data.dailyProgress > 0) return `${data.streak} günlük serin sürüyor.`;
  return `${data.streak} günlük serin var. Bugün de çöz, bozulmasın.`;
}

function Skeleton() {
  return (
    <section aria-busy="true" aria-label="Bugünkü özetin yükleniyor" className="flex flex-col gap-6">
      <div className="h-32 animate-pulse rounded-[24px] bg-surface-elevated" />
      <div className="h-96 animate-pulse rounded-[24px] bg-surface-elevated" />
    </section>
  );
}

// Görünüm: "robotik kontrol paneli" teması (2026-10-19, misafir anasayfası ve ders raporuyla aynı; bkz.
// ../robotic). Kök tema sınıfı HomeClient'ta.
const DIVIDER = r.divider;
const card = `rounded-[22px] ${r.panel}`;

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-surface-elevated" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="İlerleme">
        <div className={r.fill} style={{ width: `${Math.max(pct, 3)}%` }} />
      </div>
      <span className="shrink-0 text-sm font-semibold text-default">
        {Math.min(done, total)} / {total} soru
      </span>
    </div>
  );
}

const quickLinks = [
  { href: '/soru-bankasi', label: 'Soru Bankası', Icon: BookOpen },
  { href: '/tekrar', label: 'Tekrar', Icon: RotateCcw },
  { href: '/ilerlemem/siralama', label: 'Sıralama', Icon: Trophy },
];

export interface StudentThisWeekData {
  gradeName: string;
  week: number;
  topics: ThisWeekTopicItem[];
}

export function StudentToday({
  dailyQuestion,
  dailyQuestionSet,
  thisWeek,
  thisWeekData,
  lessons = [],
  selectedGradeSlug = null,
  upcomingExams,
}: {
  // Bölüm kartları (masaüstü görünümde; verilmeyen bölüm gösterilmez).
  dailyQuestion?: ReactNode;
  dailyQuestionSet?: DailyQuestionSet | null;
  thisWeek?: ReactNode;
  thisWeekData?: StudentThisWeekData | null;
  lessons?: HomeLessonCard[];
  selectedGradeSlug?: string | null;
  upcomingExams?: ReactNode;
}) {
  const router = useRouter();
  const { data, mutate } = useStudentToday();
  const gradeSlug = useMyGradeSlug();
  const effectiveGradeSlug = gradeSlug ?? selectedGradeSlug;
  const { open: openTest, loading, error, conflict, player } = useQuizTestLauncher(() => void mutate());
  const [active, setActive] = useState<{ key: string; href: string } | null>(null);
  const [openSheet, setOpenSheet] = useState<'daily' | 'week' | null>(null);
  const dailyStatus = useDailyQuestionStatus(dailyQuestionSet ?? null);

  // Oturum bu arada başka yerde bitmişse API devam yerine çakışma döner; seçimi soru bankası sayfası sunar.
  useEffect(() => {
    if (conflict && active) router.push(active.href);
  }, [conflict, active, router]);

  if (!data) return <Skeleton />;

  const resume: Resume = {
    onClick: (key, endpoint, href) => (e) => {
      // Uç noktası olmayan (sıralı test) ya da değiştirici tuşlu tıklar normal bağlantı gibi davranır.
      if (!endpoint || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      setActive({ key, href });
      void openTest(endpoint, href);
    },
    busyKey: loading ? active?.key ?? null : null,
    errorKey: error ? active?.key ?? null : null,
    error,
  };

  const copy = taskCopy(data.tasks[0], data);
  const pct = copy.progress && copy.progress.total > 0 ? Math.min(100, Math.round((copy.progress.done / copy.progress.total) * 100)) : null;
  const hasThisWeekData = !!(thisWeekData && thisWeekData.topics.length > 0);
  const taskCard = (isMobile: boolean) => (
    <section aria-label="Bugünkü görev" className={`${card} ${isMobile ? r.hero : ''} flex flex-col gap-3 p-4 sm:p-6`}>
      <span className={`inline-flex w-fit items-center gap-2 ${r.label}`}><i className={r.led} aria-hidden="true" />Bugünkü görevin</span>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-extrabold leading-tight text-default sm:text-xl">{copy.title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.detail}</p>
      </div>
      {copy.progress && pct != null && <ProgressBar done={copy.progress.done} total={copy.progress.total} />}
      <div className="flex flex-wrap items-center gap-3">
        {isMobile && copy.done && dailyQuestionSet ? (
          <button
            type="button"
            onClick={() => setOpenSheet('daily')}
            className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white transition duration-200 hover:bg-emerald-800 active:scale-[0.98]"
          >
            {copy.cta}
            <ChevronRight className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
          </button>
        ) : (
          <Link
            href={copy.href}
            onClick={resume.onClick(RESUME_TASK_KEY, copy.endpoint, copy.href)}
            aria-busy={resume.busyKey === RESUME_TASK_KEY}
            className={`inline-flex ${isMobile ? 'min-h-12 w-full justify-center' : 'min-h-10'} items-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white transition duration-200 active:scale-[0.98] ${copy.done ? 'bg-emerald-700 hover:bg-emerald-800' : `${r.btnNeon} ${r.btnText}`}`}
          >
            {copy.cta}
            {resume.busyKey === RESUME_TASK_KEY ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            )}
          </Link>
        )}
        {resume.errorKey === RESUME_TASK_KEY && <span role="alert" className="text-sm text-red-500">{resume.error}</span>}
      </div>
    </section>
  );

  const mobileTileCls = `group flex flex-col justify-between gap-3 rounded-[20px] p-4 text-left select-none active:scale-[0.98] ${r.item}`;

  return (
    <section aria-labelledby="bugun-baslik" className="flex flex-col gap-4 lg:gap-6">
      {/* MOBİL GÖRÜNÜM (< lg): tek ekrana sığan native uygulama düzeni */}
      <div className="flex flex-col gap-4 lg:hidden">
        {/* Kompakt tek satırlık karşılama */}
        <div className="flex items-center gap-3 px-0.5 pt-0.5">
          <span className={`h-11 w-11 shrink-0 rounded-2xl text-base ${r.chipBox}`} aria-hidden="true">
            {data.firstName.charAt(0).toLocaleUpperCase('tr-TR')}
          </span>
          <div className="min-w-0 flex-1">
            <h1 id="bugun-baslik" className={`truncate text-xl font-extrabold leading-tight ${r.chrome}`}>
              Merhaba, {data.firstName}
            </h1>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {data.gradeName && <span className="font-semibold text-default">{data.gradeName} · </span>}
              {streakLine(data)}
            </p>
          </div>
        </div>

        {/* 1. Ana görev kartı */}
        {taskCard(true)}

        {/* 2. Yatay kaydırılabilir hızlı Derslerim şeridi */}
        {lessons.length > 0 && effectiveGradeSlug && (
          <div>
            <div className="mb-2 flex items-center justify-between px-0.5">
              <h2 className="text-sm font-extrabold text-default">Derslerim</h2>
              <Link href={`/${effectiveGradeSlug}`} className={`text-xs font-bold ${r.accent}`}>
                Tümü →
              </Link>
            </div>
            <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-hide">
              {lessons.map((lesson) => {
                const href = lesson.slug ? `/${effectiveGradeSlug}/${lesson.slug}` : `/${effectiveGradeSlug}`;
                return (
                  <Link
                    key={lesson.id}
                    href={href}
                    className={`flex w-[118px] shrink-0 flex-col gap-2.5 rounded-2xl p-3 active:scale-[0.97] transition-transform ${r.item}`}
                  >
                    <SubjectIcon lessonName={lesson.name} variant="solid" size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-bold leading-tight text-default">{lesson.name}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{lesson.unitCount} ünite</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. 2x2 canlı aksiyon ızgarası (Soru Bankası zaten alt menüde) */}
        <nav aria-label="Hızlı erişim" className="grid grid-cols-2 gap-3">
          {dailyQuestionSet && (
            <button
              type="button"
              onClick={() => setOpenSheet('daily')}
              className={mobileTileCls}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/12 text-amber-600 dark:text-amber-400">
                  <Sun className="h-5 w-5" aria-hidden="true" />
                </span>
                {dailyStatus?.answered ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Çözüldü
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                    Çözülmedi
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-extrabold leading-tight text-default">Günün Sorusu</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {dailyStatus?.lessonName ?? 'Her gün 1 soru'}
                </div>
              </div>
            </button>
          )}

          {hasThisWeekData && thisWeekData && (
            <button
              type="button"
              onClick={() => setOpenSheet('week')}
              className={mobileTileCls}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className={`h-10 w-10 shrink-0 ${r.chipBox}`}>
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className={r.badge}>{thisWeekData.week}. hafta</span>
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-extrabold leading-tight text-default">Okulda Bu Hafta</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {thisWeekData.topics.length} konu
                </div>
              </div>
            </button>
          )}

          <Link href="/tekrar" className={mobileTileCls}>
            <div className="flex w-full items-center justify-between gap-2">
              <span className={`h-10 w-10 shrink-0 ${r.chipBox}`}>
                <RotateCcw className="h-5 w-5" aria-hidden="true" />
              </span>
              {data.dueSrs > 0 && (
                <span className="rounded-full bg-rose-500/12 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                  {data.dueSrs} soru
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-extrabold leading-tight text-default">Tekrar</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {data.dueSrs > 0 ? 'Tekrar zamanı' : 'Hatalı soruların'}
              </div>
            </div>
          </Link>

          <Link href="/ilerlemem/siralama" className={mobileTileCls}>
            <div className="flex w-full items-center justify-between gap-2">
              <span className={`h-10 w-10 shrink-0 ${r.chipBox}`}>
                <Trophy className="h-5 w-5" aria-hidden="true" />
              </span>
              {data.rank && (
                <span className={r.badge}>#{data.rank.position}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-extrabold leading-tight text-default">Sıralama</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {data.rank ? 'Bu haftaki sıran' : 'Haftalık tablo'}
              </div>
            </div>
          </Link>
        </nav>

        {/* 3. Yaklaşan yazılılar (varsa) */}
        {upcomingExams}
      </div>

      {/* MASAÜSTÜ GÖRÜNÜM (lg ve üstü): mevcut ferah 2 sütunlu kontrol paneli */}
      <div className="hidden flex-col gap-6 lg:flex">
        {/* Karşılama kartı — kokpit: metal panel + tarama ışığı */}
        <div className={`flex flex-col gap-5 rounded-[22px] p-5 sm:p-7 ${r.panel} ${r.hero}`}>
          <span className={r.scan} aria-hidden="true" />
          <div className="flex items-center gap-4">
            <span className={`h-14 w-14 shrink-0 rounded-full text-xl ${r.chipBox}`} aria-hidden="true">
              {data.firstName.charAt(0).toLocaleUpperCase('tr-TR')}
            </span>
            <div className="min-w-0">
              <h1 className={`text-[26px] leading-tight sm:text-3xl ${r.chrome}`}>
                Merhaba, {data.firstName}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {data.gradeName && <span className="font-semibold text-default">{data.gradeName} · </span>}
                {streakLine(data)}
              </p>
            </div>
          </div>
          <nav aria-label="Hızlı erişim" className={`grid grid-cols-3 gap-2.5 border-t pt-5 ${DIVIDER}`}>
            {quickLinks.map(({ href, label, Icon }) => {
              const resolvedHref = href === '/soru-bankasi' && gradeSlug ? `/soru-bankasi/${gradeSlug}` : href;
              return (
                <Link
                  key={href}
                  href={resolvedHref}
                  className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold hover:-translate-y-0.5 ${r.item}`}
                >
                  <span className={`h-9 w-9 shrink-0 ${r.chipBox}`}>
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-6">
          <div className="flex min-w-0 flex-col gap-6">
            {thisWeek}
            {dailyQuestion}
          </div>

          <aside className="sticky top-24 flex flex-col gap-6" aria-label="Bugünkü görevin ve yaklaşan yazılılar">
            {taskCard(false)}
            {upcomingExams}
          </aside>
        </div>
      </div>

      {/* Günün Sorusu: tam ekran native quiz görünümü */}
      {dailyQuestionSet && (
        <DailyQuestionFullScreen
          open={openSheet === 'daily'}
          onClose={() => setOpenSheet(null)}
          set={dailyQuestionSet}
        />
      )}

      {hasThisWeekData && thisWeekData && (
        <BottomSheet
          open={openSheet === 'week'}
          onClose={() => setOpenSheet(null)}
          title="Okulda Bu Hafta"
          badge={`${thisWeekData.week}. hafta`}
          subtitle={`${thisWeekData.gradeName} · müfredat takvimine göre`}
        >
          <SchoolThisWeekCard
            gradeName={thisWeekData.gradeName}
            week={thisWeekData.week}
            topics={thisWeekData.topics}
            embedded
            onTopicClick={() => setOpenSheet(null)}
          />
        </BottomSheet>
      )}

      {data.streak >= PUSH_OPT_IN_MIN_STREAK && <PushReminderOptIn />}
      {(data.dailyProgress > 0 || data.streak >= 1) && <StudentFeedbackCard streak={data.streak} />}
      {player}
    </section>
  );
}
