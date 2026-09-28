'use client';

// Girişli öğrencinin anasayfası "Bugün" (yol haritası 3a, 2026-09-27 taslağı): "Şimdi ne
// yapmalıyım?" sorusunu tek bir görevle yanıtlar. Derin analiz (ustalık haritası, geçmiş,
// haftalık tablo) BURADA DEĞİL, "İlerlemem" sayfasında (yol haritası 4) — iki sayfa aynı
// kutuları tekrar etmesin.
import Link from 'next/link';
import { ArrowRight, BookOpen, Flame, PencilLine } from 'lucide-react';
import type { LessonProgress } from '@/app/src/models/types';
import { useStudentToday, type TodayTask } from '@/app/src/hooks/useStudentToday';
import { PushReminderOptIn } from './PushReminderOptIn';

const DAY_LABELS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
const DATE_FMT = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', timeZone: 'Europe/Istanbul' });

function taskCopy(task: TodayTask): { title: string; detail: string; cta: string; href: string; progress?: number } {
  switch (task.kind) {
    case 'resume':
      return {
        title: 'Yarım kalan testini bitir',
        // Sayıdan sonra ek yok ("2'sini / 3'ünü" sayıya göre değişir) — kesir biçimi her sayıda doğru.
        detail: `${task.title} — ${task.answered}/${task.total} soru çözüldü.`,
        cta: 'Teste devam et',
        href: task.href,
        progress: task.total ? Math.round((task.answered / task.total) * 100) : 0,
      };
    case 'srs':
      return { title: `${task.count} soru tekrar zamanı geldi`, detail: 'Unutmadan önce tekrar et — bilgi kalıcı hale gelsin.', cta: 'Tekrara başla', href: task.href };
    case 'weak':
      return {
        title: 'En çok zorlandığın konuyu pekiştir',
        detail: `${task.topicTitle} · ${task.lessonName} — ${task.wrongCount} yanlışın var.`,
        cta: 'Soruları çöz',
        href: task.href,
      };
    case 'goal':
      return { title: `Bugünkü hedefine ${task.remaining} soru kaldı`, detail: 'Birkaç soru çöz, serini koru.', cta: 'Soru çöz', href: task.href };
    case 'done':
      return { title: 'Bugünkü hedefini tamamladın!', detail: 'Harika gidiyorsun. İstersen günün sorusuyla bitir.', cta: 'Günün sorusu', href: '#gunun-sorusu-bolumu' };
  }
}

function secondaryLabel(task: TodayTask): { label: string; text: string; href: string } | null {
  switch (task.kind) {
    case 'srs':
      return { label: 'Sonra', text: `${task.count} soru tekrar zamanı geldi`, href: task.href };
    case 'weak':
      return { label: 'En çok zorlandığın konu', text: task.topicTitle, href: task.href };
    case 'goal':
      return { label: 'Günlük hedef', text: `${task.remaining} soru daha`, href: task.href };
    default:
      return null;
  }
}

function Skeleton() {
  return (
    <section aria-busy="true" aria-label="Bugünkü özetin yükleniyor" className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="h-72 animate-pulse rounded-[26px] bg-surface-elevated" />
      <div className="h-72 animate-pulse rounded-[26px] bg-surface-elevated" />
    </section>
  );
}

export function StudentToday() {
  const { data } = useStudentToday();
  if (!data) return <Skeleton />;

  const [main, ...rest] = data.tasks;
  const copy = taskCopy(main);
  const secondary = rest.map(secondaryLabel).filter((s): s is NonNullable<typeof s> => !!s).slice(0, 2);
  const goalPct = data.dailyGoal ? Math.min(100, Math.round((data.dailyProgress / data.dailyGoal) * 100)) : 0;
  const todayIndex = (new Date().getDay() + 6) % 7; // 0 = Pazartesi
  const remainingGoal = Math.max(0, data.dailyGoal - data.dailyProgress);

  return (
    <section aria-labelledby="bugun-baslik" className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-bold capitalize text-muted-foreground">
          {DATE_FMT.format(new Date())}
          {data.gradeName ? ` · ${data.gradeName}` : ''}
        </p>
        <h1 id="bugun-baslik" className="mt-1 text-3xl font-black tracking-tight text-default sm:text-5xl">
          Tekrar hoş geldin, {data.firstName}.
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Açık indigo tonlu kart (2026-09-28): koyu/doygun zemin sayfanın beyaz kartları arasında
            fazla ağır duruyordu. Belirginlik zeminden değil tek dolu butondan (asıl eylem) gelir. */}
        <div className="flex flex-col gap-5 rounded-[26px] border border-indigo-200 bg-indigo-50 p-6 shadow-[0_18px_40px_-28px_rgba(79,70,229,0.45)] dark:border-indigo-500/30 dark:bg-indigo-500/10 sm:p-8">
          <span className="self-start rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white">
            Bugünkü görevin
          </span>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-black leading-tight tracking-tight text-default sm:text-3xl">{copy.title}</h2>
            <p className="text-base text-muted-foreground">{copy.detail}</p>
          </div>
          {copy.progress != null && (
            <div className="h-2.5 overflow-hidden rounded-full bg-indigo-200/70 dark:bg-indigo-500/20" role="progressbar" aria-valuenow={copy.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Test ilerlemesi">
              <div className="h-full rounded-full bg-indigo-600 dark:bg-indigo-400" style={{ width: `${copy.progress}%` }} />
            </div>
          )}
          <Link
            href={copy.href}
            className="inline-flex items-center justify-center gap-2 self-stretch rounded-2xl bg-indigo-600 px-6 py-4 text-base font-black text-white shadow-sm transition-colors hover:bg-indigo-700 sm:self-start"
          >
            {copy.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {secondary.length > 0 && (
            <div className="grid grid-cols-1 gap-3 border-t border-indigo-200 pt-5 dark:border-indigo-500/20 sm:grid-cols-2">
              {secondary.map((s) => (
                <Link key={s.label} href={s.href} className="flex flex-col gap-1 rounded-2xl border border-default bg-background p-4 transition-colors hover:border-indigo-400">
                  <span className="text-[13px] font-bold text-muted-foreground">{s.label}</span>
                  <span className="text-base font-bold text-default">{s.text}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5 rounded-[26px] border border-default bg-background p-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="text-base font-black text-default">Günlük hedef</span>
              <span className="text-sm text-muted-foreground">
                <b className="text-xl text-default">{data.dailyProgress}</b> / {data.dailyGoal} soru
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-elevated" role="progressbar" aria-valuenow={goalPct} aria-valuemin={0} aria-valuemax={100} aria-label="Günlük hedef">
              <div className="h-full rounded-full bg-indigo-600" style={{ width: `${goalPct}%` }} />
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Flame className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              {/* Bugün en az 1 soru çözüldüyse seri zaten güvende (bkz. getCurrentStreak) —
                  "bozulmasın" uyarısı sadece bugün hiç çözülmemişken anlamlı. */}
              {data.streak > 0
                ? data.dailyProgress > 0
                  ? remainingGoal > 0
                    ? `${data.streak} günlük serin sürüyor. Hedefe ${remainingGoal} soru kaldı.`
                    : `${data.streak} günlük serin sürüyor, bugünkü hedef tamam!`
                  : `${data.streak} günlük serin var — bugün çözmezsen sıfırlanır.`
                : 'Bugün çözmeye başla, serin başlasın.'}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-base font-black text-default">Bu hafta</span>
            <ol className="grid grid-cols-7 gap-1.5 text-center text-xs font-bold text-muted-foreground">
              {DAY_LABELS.map((label, i) => {
                const active = data.weeklyActiveDays[i];
                const isToday = i === todayIndex;
                return (
                  <li key={label} className="flex flex-col items-center gap-1.5">
                    <span
                      className={`h-8 w-8 rounded-full ${
                        active ? 'bg-indigo-600' : isToday ? 'border-2 border-dashed border-indigo-500' : i < todayIndex ? 'bg-surface-elevated' : 'border border-default'
                      }`}
                      aria-label={`${label}: ${active ? 'çalıştın' : isToday ? 'bugün' : 'çalışmadın'}`}
                    />
                    {label}
                  </li>
                );
              })}
            </ol>
          </div>

          {data.rank && (
            <Link href="/ilerlemem/siralama" className="mt-auto flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3.5 transition-colors hover:bg-surface-elevated">
              <span className="text-[15px] font-bold text-default">Sıralamada {data.rank.position}.’sin</span>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {data.rank.toPass != null ? `${data.rank.position - 1}.’ye ${data.rank.toPass} soru` : 'Zirvedesin!'}
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Akşam hatırlatması (yol haritası 3c) — izin sadece butona basınca istenir. */}
      <PushReminderOptIn />

      {data.lessons.length > 0 && <MyLessons lessons={data.lessons} />}
    </section>
  );
}

const LESSON_BARS = ['bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-fuchsia-600', 'bg-indigo-600', 'bg-rose-600'];

function MyLessons({ lessons }: { lessons: LessonProgress[] }) {
  return (
    <div className="mt-8 flex flex-col gap-4 sm:mt-10">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-black tracking-tight text-default sm:text-3xl">Derslerim</h2>
        <Link href="/ilerlemem" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
          İlerlemem →
        </Link>
      </div>
      {/* Her kartta iki açık hedef (2026-09-28): eskiden kartın tamamı Soru Bankası'na gidiyordu
          ve girişli öğrencinin anasayfadan konu anlatımına yolu yoktu. Misafir ders listesiyle
          (GradeLessonPicker) aynı ayrım: ders → konu anlatımı, sorular → Soru Bankası. */}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {lessons.map((lesson, i) => (
          <li key={lesson.id} className="flex h-full flex-col gap-3 rounded-2xl border border-default bg-background p-4">
            <span className="flex items-baseline justify-between gap-2">
              <span className="block text-[15px] font-bold leading-snug text-default">{lesson.name}</span>
              <span className="shrink-0 text-xl font-black text-default">%{lesson.progress}</span>
            </span>
            <span
              className="block h-2 overflow-hidden rounded-full bg-surface-elevated"
              role="img"
              aria-label={`Soruların yüzde ${lesson.progress} kadarını çözdün`}
            >
              <span className={`block h-full rounded-full ${LESSON_BARS[i % LESSON_BARS.length]}`} style={{ width: `${lesson.progress}%` }} />
            </span>
            <span className="mt-auto flex gap-2">
              {lesson.lessonHref && (
                <Link
                  href={lesson.lessonHref}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-surface px-2 text-sm font-bold text-default transition-colors hover:bg-surface-elevated"
                >
                  <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" /> Konu anlatımı
                </Link>
              )}
              {lesson.soruBankasiHref && lesson.totalQuestions > 0 && (
                <Link
                  href={lesson.soruBankasiHref}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-indigo-500/10 px-2 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-500/20 dark:text-indigo-300"
                >
                  <PencilLine className="h-4 w-4 shrink-0" aria-hidden="true" /> Soru çöz
                </Link>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
