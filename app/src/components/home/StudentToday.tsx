'use client';

// Girişli öğrencinin anasayfası "Bugün" (yol haritası 3a, 2026-09-27): "Şimdi ne yapmalıyım?"
// sorusunu tek bir görevle yanıtlar. Derin analiz (ustalık haritası, geçmiş, günlük hedef takvimi,
// konu ilerlemesi) BURADA DEĞİL, "İlerlemem" sayfasında.
// Düzen: karşılama kartı + hızlı erişim kutuları; altta görev kartı ve Derslerim kartı (sol) ile
// sağda bugünkü durum özeti ve Okulda bu hafta kartı; en altta Günün sorusu ve Yeni konular — her biri
// kendi kartında, sekme yok (2026-10-19, kullanıcı isteği). Derslerim İlerlemem'deki ders çubuklarıyla
// aynı görünür (doğru / yanlış / kalan); satıra dokunmak dersin müfredat sayfasına (/<sınıf>/<ders>) götürür.
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Onest } from 'next/font/google';
import { BookOpen, ChartColumn, ChevronRight, Flame, RotateCcw, Trophy, TrendingUp } from 'lucide-react';
import { Legend, Pill } from '@/app/src/components/progress/UnitProgressChart';
import { MASTERY_RULES } from '@/app/src/lib/topicMastery';
import type { Totals } from '@/app/src/lib/lessonReports';
import type { LessonProgress } from '@/app/src/models/types';
import { useStudentToday, type OpenTest, type StudentToday as StudentTodayData, type TodayTask } from '@/app/src/hooks/useStudentToday';
import { PushReminderOptIn } from './PushReminderOptIn';
import r from '../robotic/robotic.module.css';

// Derslerim listesinin yazı tipi: referans ekrandaki gibi (İlerlemem'in ders raporlarıyla aynı Onest).
const lessonFont = Onest({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-home-lessons', display: 'swap' });

// Bildirim izni kartı bu seriden itibaren gösterilir: ilk gün bir "izin ver" kartı kalabalık yapıyor.
const PUSH_OPT_IN_MIN_STREAK = 3;

type TaskCopy = { title: string; detail: string; cta: string; href: string; progress?: { done: number; total: number }; done?: boolean };

function taskCopy(task: TodayTask, data: StudentTodayData): TaskCopy {
  switch (task.kind) {
    case 'resume':
      return { title: 'Yarım kalan testini bitir', detail: task.title, cta: 'Kaldığın yerden devam et', href: task.href, progress: { done: task.answered, total: task.total } };
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

// İlerlemem'deki ders raporuyla aynı hesap: başarı yalnız yeterli soru çözülünce (minSolvedToJudge).
function lessonTotals(lesson: LessonProgress): Totals {
  const { solvedQuestions: solved, correctAnswers: correct, totalQuestions: total } = lesson;
  return { solved, correct, total, accuracy: solved >= MASTERY_RULES.minSolvedToJudge ? Math.round((correct / solved) * 100) : null };
}

function LessonBar({ totals }: { totals: Totals }) {
  const { total, solved, correct } = totals;
  const wrong = solved - correct;
  return (
    <span
      className="flex h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      role="img"
      aria-label={`${total} sorunun ${correct} doğru, ${wrong} yanlış, ${total - solved} çözülmedi`}
    >
      <span className="h-full bg-emerald-500" style={{ width: `${(correct / total) * 100}%` }} />
      <span className="h-full bg-rose-500" style={{ width: `${(wrong / total) * 100}%` }} />
    </span>
  );
}

function LessonRow({ lesson, open }: { lesson: LessonProgress; open: OpenTest | undefined }) {
  const totals = lessonTotals(lesson);
  const { solved, correct, total } = totals;
  const remaining = total - solved;
  const header = (
    <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
      <span className="flex items-center gap-1 text-[15px] font-bold leading-snug text-default">
        {lesson.name}
        {lesson.soruBankasiHref && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      </span>
      <Pill totals={totals} />
    </span>
  );
  const body = (
    <>
      {total === 0 ? (
        <span className="text-xs text-muted-foreground">Soruları yakında</span>
      ) : (
        <>
          <LessonBar totals={totals} />
          <span className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="tabular-nums">
              <strong className="font-bold text-default">%{Math.round((solved / total) * 100)}</strong> tamamlandı · {solved}/{total} soru
            </span>
            <span className="tabular-nums">
              {correct} doğru · {solved - correct} yanlış · <strong className="font-bold text-default">{remaining} kalan</strong>
            </span>
          </span>
        </>
      )}
      {open && (
        <Link href={open.href} className="relative z-10 self-start text-xs font-semibold text-amber-700 hover:underline dark:text-amber-400">
          Yarım testin var · {open.answered}/{open.total} · Devam et →
        </Link>
      )}
    </>
  );
  // Kartın tamamı soru bankasındaki derse gider (ayrı bağlantı, after: ile kartı kaplar); "Raporu göster"
  // ve "Devam et" bağlantıları onun üstünde kalır, böylece iç içe bağlantı olmaz.
  const cls = `relative flex flex-col gap-2.5 rounded-2xl p-4 hover:-translate-y-0.5 ${r.item} ${r.itemHover}`;
  return (
    <div className={cls}>
      <div className="flex items-center gap-3">
        {lesson.soruBankasiHref ? (
          <Link href={lesson.soruBankasiHref} aria-label={`${lesson.name} soru bankasına git`} className="flex min-w-0 flex-1 after:absolute after:inset-0 after:rounded-2xl">
            {header}
          </Link>
        ) : (
          header
        )}
        {lesson.reportHref && (
          <Link
            href={lesson.reportHref}
            className={`relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-lg py-1 pl-1 pr-2.5 text-xs font-bold ${r.btnGhost}`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-md ${r.tint}`}>
              <ChartColumn className="h-3 w-3" aria-hidden="true" />
            </span>
            {/* Tek kapsayıcı: inline-flex gap'i "Rapor" ile "u göster" arasına boşluk koymasın. */}
            <span>Rapor<span className="hidden sm:inline">u göster</span></span>
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-2.5">{body}</div>
    </div>
  );
}

function LessonList({ data }: { data: StudentTodayData }) {
  if (!data.lessons.length) return <p className="text-sm text-muted-foreground">Henüz bir ders yok.</p>;
  return (
    <div className={`${lessonFont.variable} flex flex-col gap-3 font-[family-name:var(--font-home-lessons)]`}>
      <Legend />
      <ul className="flex flex-col gap-3">
        {data.lessons.map((lesson) => (
          <li key={lesson.id}>
            <LessonRow lesson={lesson} open={data.openTestByLesson.get(Number(lesson.id))} />
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  { href: '/ilerlemem', label: 'İlerlemem', Icon: TrendingUp },
  { href: '/ilerlemem/siralama', label: 'Sıralama', Icon: Trophy },
];

export function StudentToday({
  dailyQuestion,
  thisWeek,
  recent,
  upcomingExams,
}: {
  // Bölüm kartları (verilmeyen bölüm gösterilmez).
  dailyQuestion?: ReactNode;
  thisWeek?: ReactNode;
  recent?: ReactNode;
  upcomingExams?: ReactNode;
}) {
  const { data } = useStudentToday();
  if (!data) return <Skeleton />;

  const copy = taskCopy(data.tasks[0], data);
  const pct = copy.progress && copy.progress.total > 0 ? Math.min(100, Math.round((copy.progress.done / copy.progress.total) * 100)) : null;

  return (
    <section aria-labelledby="bugun-baslik" className="flex flex-col gap-6">
      {/* Karşılama kartı — kokpit: metal panel + tarama ışığı */}
      <div className={`flex flex-col gap-5 rounded-[22px] p-5 sm:p-7 ${r.panel} ${r.hero}`}>
        <span className={r.scan} aria-hidden="true" />
        <div className="flex items-center gap-4">
          <span className={`h-14 w-14 shrink-0 rounded-full text-xl ${r.chipBox}`} aria-hidden="true">
            {data.firstName.charAt(0).toLocaleUpperCase('tr-TR')}
          </span>
          <div className="min-w-0">
            <h1 id="bugun-baslik" className={`text-[26px] leading-tight sm:text-3xl ${r.chrome}`}>
              Merhaba, {data.firstName}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {data.gradeName && <span className="font-semibold text-default">{data.gradeName} · </span>}
              {streakLine(data)}
            </p>
          </div>
        </div>
        <nav aria-label="Hızlı erişim" className={`grid grid-cols-2 gap-2.5 border-t pt-5 sm:grid-cols-4 ${DIVIDER}`}>
          {quickLinks.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold hover:-translate-y-0.5 ${r.item}`}
            >
              <span className={`h-9 w-9 shrink-0 ${r.chipBox}`}>
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-label="Bugünkü görev" className={`${card} flex flex-col gap-3 p-5 sm:p-7`}>
            <span className={`inline-flex w-fit items-center gap-2 ${r.label}`}><i className={r.led} aria-hidden="true" />Bugünkü görevin</span>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg font-extrabold leading-tight text-default sm:text-xl">{copy.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{copy.detail}</p>
            </div>
            {copy.progress && pct != null && <ProgressBar done={copy.progress.done} total={copy.progress.total} />}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={copy.href}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white transition duration-200 ${copy.done ? 'bg-emerald-700 hover:bg-emerald-800' : `${r.btnNeon} ${r.btnText}`}`}
              >
                {copy.cta}
                <ChevronRight className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
              </Link>
            </div>
          </section>

          <section aria-labelledby="dersler-baslik" className={`${card} flex min-w-0 flex-col gap-4 p-5 sm:p-7`}>
            <h2 id="dersler-baslik" className="text-lg font-extrabold text-default">
              Derslerim
            </h2>
            <LessonList data={data} />
          </section>

          {dailyQuestion}
          {recent && <section className={`${card} p-5 sm:p-7`}>{recent}</section>}
        </div>

        <div className="flex flex-col gap-6">
          <aside aria-labelledby="bugun-durum" className={`${card} flex flex-col gap-5 p-5 sm:p-6`}>
            <h2 id="bugun-durum" className="text-base font-extrabold text-default">
              Bugünkü durumun
            </h2>
            <dl className="flex flex-col gap-4 text-sm">
              <div className="flex flex-col gap-2">
                <dt className="text-muted-foreground">Günlük hedef</dt>
                <dd>
                  <ProgressBar done={data.dailyProgress} total={data.dailyGoal} />
                </dd>
              </div>
              <div className={`flex items-center justify-between gap-3 border-t pt-4 ${DIVIDER}`}>
                <dt className="text-muted-foreground">Günlük seri</dt>
                <dd className="flex items-center gap-1.5 font-bold text-default">
                  <Flame className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  {data.streak} gün
                </dd>
              </div>
              <div className={`flex items-center justify-between gap-3 border-t pt-4 ${DIVIDER}`}>
                <dt className="text-muted-foreground">Sıralama</dt>
                <dd className="font-bold text-default">{data.rank ? `${data.rank.position}. sıradasın` : 'Henüz yok'}</dd>
              </div>
            </dl>
          </aside>
          {upcomingExams}
          {thisWeek}
        </div>
      </div>

      {data.streak >= PUSH_OPT_IN_MIN_STREAK && <PushReminderOptIn />}
    </section>
  );
}
