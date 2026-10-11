'use client';

// Girişli öğrencinin anasayfası "Bugün" (yol haritası 3a, 2026-09-27): "Şimdi ne yapmalıyım?"
// sorusunu tek bir görevle yanıtlar. Derin analiz (ustalık haritası, geçmiş, günlük hedef takvimi,
// konu ilerlemesi) BURADA DEĞİL, "İlerlemem" sayfasında.
// Sade düzen (2026-10-11, ortaokul öğrencisi için sadeleştirme — kullanıcı onaylı taslak
// https://claude.ai/artifact/XMRvo8X428Wg3zJ7RjZ5Lj): büyük tek görev kartı + tek büyük buton,
// ders başına tek satır, yanda Günün sorusu, altta "Bir de bunlara bak". Günlük hedef halkası,
// haftalık nokta takvimi, ders başına ilerleme çubuğu ve ikincil linkler kaldırıldı (İlerlemem'de var);
// bildirim kartı ancak öğrenci düzenli gelmeye başlayınca (seri ≥ 3) çıkar.
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight, Flame, Plus, Trophy } from 'lucide-react';
import { SubjectIcon } from './SubjectIcon';
import type { LessonProgress } from '@/app/src/models/types';
import { useStudentToday, type OpenTest, type StudentToday as StudentTodayData, type TodayTask } from '@/app/src/hooks/useStudentToday';
import { sequentialTestHref, type LessonNextStep } from '@/app/src/lib/sequentialTest';
import { PushReminderOptIn } from './PushReminderOptIn';

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
      <div className="h-12 w-56 animate-pulse rounded-xl bg-surface-elevated" />
      <div className="h-64 animate-pulse rounded-[24px] bg-surface-elevated" />
      <div className="h-80 animate-pulse rounded-[20px] bg-surface-elevated" />
    </section>
  );
}

const panel = 'rounded-[20px] border border-zinc-200 bg-background dark:border-default';

function TaskCard({ data }: { data: StudentTodayData }) {
  const copy = taskCopy(data.tasks[0], data);
  const pct = copy.progress && copy.progress.total > 0 ? Math.min(100, Math.round((copy.progress.done / copy.progress.total) * 100)) : null;
  return (
    <section
      aria-labelledby="gorev-baslik"
      className={`flex flex-col gap-5 rounded-[24px] p-5 text-white sm:p-7 ${copy.done ? 'bg-emerald-700' : 'bg-indigo-600 dark:bg-indigo-600/90'}`}
    >
      <p className="text-[13px] font-bold uppercase tracking-wider text-white/85">Bugünkü görevin</p>
      <div className="flex flex-col gap-1.5">
        <h2 id="gorev-baslik" className="text-2xl font-extrabold leading-tight sm:text-[30px]">
          {copy.title}
        </h2>
        <p className="text-base leading-relaxed text-white/90 sm:text-[17px]">{copy.detail}</p>
      </div>
      {copy.progress && pct != null && (
        <div className="flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="İlerleme">
            <div className="h-full rounded-full bg-white" style={{ width: `${Math.max(pct, 3)}%` }} />
          </div>
          <span className="shrink-0 text-sm font-semibold">
            {Math.min(copy.progress.done, copy.progress.total)} / {copy.progress.total} soru
          </span>
        </div>
      )}
      <Link
        href={copy.href}
        className={`inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 text-lg font-extrabold transition-colors hover:bg-white/90 sm:w-auto sm:self-start ${copy.done ? 'text-emerald-800' : 'text-indigo-700'}`}
      >
        {copy.cta}
        <ChevronRight className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
      </Link>
      <p className="flex items-center gap-1.5 text-sm text-white/90">
        <Flame className="h-4 w-4 shrink-0" aria-hidden="true" />
        {streakLine(data)}
      </p>
    </section>
  );
}

// Ders başına TEK satır, satırın tamamı tek bağlantı: yarım test varsa ona, yoksa sıradaki konuya
// (konu sayfasında hem anlatım hem test var), o da yoksa dersin sayfasına.
function lessonRow(lesson: LessonProgress, step: LessonNextStep | undefined, open: OpenTest | undefined): { href: string | null; detail: string; highlight?: boolean } {
  if (open) return { href: open.href, detail: `Yarım testin var · ${open.answered}/${open.total}`, highlight: true };
  if (lesson.totalQuestions === 0) return { href: lesson.lessonHref ?? null, detail: 'Soruları yakında' };
  const topic = step?.nextTopic;
  if (step && step.remaining > 0) {
    const topicHref = topic && lesson.lessonHref && topic.unitSlug && topic.slug ? `${lesson.lessonHref}/${topic.unitSlug}/${topic.slug}` : null;
    return { href: topicHref ?? sequentialTestHref(step.lessonId), detail: topic ? `Sıradaki: ${topic.title}` : 'Sıradaki soruların hazır' };
  }
  if (step) return { href: '/tekrar', detail: step.hasCalendar ? 'İşlenen konuların hepsini çözdün · Tekrar et' : 'Tüm soruları çözdün · Tekrar et' };
  return { href: lesson.lessonHref ?? lesson.soruBankasiHref ?? null, detail: 'Konulara göz at' };
}

function MyLessons({ data }: { data: StudentTodayData }) {
  if (!data.lessons.length) return null;
  return (
    <section aria-labelledby="derslerim" className="flex flex-col gap-3">
      <h2 id="derslerim" className="text-xl font-extrabold text-default">
        Derslerim
      </h2>
      <ul className={`${panel} divide-y divide-zinc-200 overflow-hidden dark:divide-default`}>
        {data.lessons.map((lesson) => {
          const row = lessonRow(lesson, data.nextSteps.get(Number(lesson.id)), data.openTestByLesson.get(Number(lesson.id)));
          const body = (
            <>
              <SubjectIcon lessonName={lesson.name} size="lg" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-bold text-default">{lesson.name}</span>
                <span className={`text-sm leading-snug ${row.highlight ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>{row.detail}</span>
              </span>
              {row.href && <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" strokeWidth={2.5} aria-hidden="true" />}
            </>
          );
          const cls = 'flex min-h-[72px] items-center gap-3 px-4 py-3';
          return (
            <li key={lesson.id}>
              {row.href ? (
                <Link href={row.href} className={`${cls} transition-colors hover:bg-surface`}>
                  {body}
                </Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// "Bir de bunlara bak": ikincil içerik tek satır kutucuk. Sıralamanın kendi sayfası var; "Okulda bu
// hafta" ve "Yeni konular"ın yok — onlar mevcut kartı yerinde açar/kapatır (yeni sayfa açılmadı).
function MoreForStudent({ rank, thisWeek, recent }: { rank: StudentTodayData['rank']; thisWeek?: { label: string; panel: ReactNode }; recent?: { label: string; panel: ReactNode } }) {
  const [open, setOpen] = useState<'week' | 'recent' | null>(null);
  const tile = 'flex min-h-[104px] flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-center transition-colors';
  const idle = 'border-zinc-200 bg-background hover:border-indigo-300 dark:border-default dark:hover:border-indigo-400/50';
  const active = 'border-indigo-400 bg-indigo-50 dark:border-indigo-400/60 dark:bg-indigo-500/10';
  const toggle = (key: 'week' | 'recent') => setOpen((cur) => (cur === key ? null : key));
  const content = (icon: ReactNode, title: string, sub: string) => (
    <>
      {icon}
      <span className="text-sm font-bold leading-tight text-default">{title}</span>
      <span className="text-[13px] text-muted-foreground">{sub}</span>
    </>
  );
  const iconCls = 'h-6 w-6 text-indigo-600 dark:text-indigo-400';
  return (
    <section aria-labelledby="daha-fazla" className="flex flex-col gap-3">
      <h2 id="daha-fazla" className="text-lg font-extrabold text-default">
        Bir de bunlara bak
      </h2>
      <div className="grid grid-cols-3 gap-2.5 sm:max-w-xl sm:gap-3">
        <Link href="/ilerlemem/siralama" className={`${tile} ${idle}`}>
          {content(<Trophy className={iconCls} aria-hidden="true" />, 'Sıralama', rank ? `${rank.position}. sıradasın` : 'Haftanın en çalışkanları')}
        </Link>
        {thisWeek && (
          <button type="button" onClick={() => toggle('week')} aria-expanded={open === 'week'} aria-controls="daha-fazla-panel" className={`${tile} ${open === 'week' ? active : idle}`}>
            {content(<CalendarDays className={iconCls} aria-hidden="true" />, 'Okulda bu hafta', thisWeek.label)}
          </button>
        )}
        {recent && (
          <button type="button" onClick={() => toggle('recent')} aria-expanded={open === 'recent'} aria-controls="daha-fazla-panel" className={`${tile} ${open === 'recent' ? active : idle}`}>
            {content(<Plus className={iconCls} aria-hidden="true" />, 'Yeni konular', recent.label)}
          </button>
        )}
      </div>
      <div id="daha-fazla-panel">
        {open === 'week' && thisWeek?.panel}
        {open === 'recent' && recent?.panel}
      </div>
    </section>
  );
}

export function StudentToday({
  dailyQuestion,
  thisWeek,
  recent,
}: {
  // Sağ sütun (mobilde derslerin altı): Günün sorusu.
  dailyQuestion?: ReactNode;
  thisWeek?: { label: string; panel: ReactNode };
  recent?: { label: string; panel: ReactNode };
}) {
  const { data } = useStudentToday();
  if (!data) return <Skeleton />;

  return (
    <section aria-labelledby="bugun-baslik" className="flex flex-col gap-7">
      <div>
        {data.gradeName && <p className="text-sm font-medium text-muted-foreground">{data.gradeName}</p>}
        <h1 id="bugun-baslik" className="mt-0.5 text-[28px] font-extrabold leading-tight tracking-tight text-default sm:text-4xl">
          Merhaba, {data.firstName}
        </h1>
      </div>

      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-7">
          <TaskCard data={data} />
          <MyLessons data={data} />
        </div>
        {dailyQuestion && <div className="min-w-0">{dailyQuestion}</div>}
      </div>

      {data.streak >= PUSH_OPT_IN_MIN_STREAK && <PushReminderOptIn />}

      <MoreForStudent rank={data.rank} thisWeek={thisWeek} recent={recent} />
    </section>
  );
}
