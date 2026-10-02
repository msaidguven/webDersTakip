'use client';

// Girişli öğrencinin anasayfası "Bugün" (yol haritası 3a, 2026-09-27 taslağı): "Şimdi ne
// yapmalıyım?" sorusunu tek bir görevle yanıtlar. Derin analiz (ustalık haritası, geçmiş,
// haftalık tablo) BURADA DEĞİL, "İlerlemem" sayfasında (yol haritası 4) — iki sayfa aynı
// kutuları tekrar etmesin.
// Görünüm: anasayfa v4 sade tasarım (2026-10-02, kullanıcı onaylı prototip
// ~/İndirilenler/ders_takip_anasayfa_v4_sade.html) — beyaz ince çerçeveli kartlar, tek vurgu
// rengi indigo; ders rengi yalnız küçük ikon ve ince ilerleme çizgisinde.
import type React from 'react';
import Link from 'next/link';
import { subjectStyle } from '@/app/src/lib/subjectStyle';
import { SubjectIcon } from './SubjectIcon';
import type { LessonProgress } from '@/app/src/models/types';
import { useStudentToday, type OpenTest, type TodayTask } from '@/app/src/hooks/useStudentToday';
import { useTopicMastery } from '@/app/src/hooks/useTopicMastery';
import { SEQUENTIAL_TEST_SIZE, sequentialTestHref, type LessonNextStep } from '@/app/src/lib/sequentialTest';
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
        detail: `${task.topicTitle} · ${task.lessonName} — ${task.accuracy != null ? `%${task.accuracy} doğru, ` : ''}${task.wrongCount} yanlış.`,
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
    <section aria-busy="true" aria-label="Bugünkü özetin yükleniyor" className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="h-60 animate-pulse rounded-[20px] bg-surface-elevated" />
      <div className="h-60 animate-pulse rounded-[20px] bg-surface-elevated" />
    </section>
  );
}

const card = 'rounded-[20px] border border-default bg-background';
const btnPrimary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-indigo-700';
const btnGhost = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-default bg-background px-5 text-[15px] font-semibold text-default transition-colors hover:bg-surface';

// lessonsAside: masaüstünde Derslerim'in yanında gösterilecek kart (anasayfa: kendi sınıfının
// "Okulda bu hafta"sı). Yoksa Derslerim tam genişlik.
export function StudentToday({ lessonsAside }: { lessonsAside?: React.ReactNode } = {}) {
  const { data } = useStudentToday();
  if (!data) return <Skeleton />;

  const [main, ...rest] = data.tasks;
  const copy = taskCopy(main);
  const secondary = rest.map(secondaryLabel).filter((s): s is NonNullable<typeof s> => !!s).slice(0, 1);
  const goalPct = data.dailyGoal ? Math.min(100, Math.round((data.dailyProgress / data.dailyGoal) * 100)) : 0;
  const todayIndex = (new Date().getDay() + 6) % 7; // 0 = Pazartesi
  const remainingGoal = Math.max(0, data.dailyGoal - data.dailyProgress);
  const ringLen = 2 * Math.PI * 30;

  return (
    <section aria-labelledby="bugun-baslik" className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {DATE_FMT.format(new Date())}
          {data.gradeName ? ` · ${data.gradeName}` : ''}
        </p>
        <h1 id="bugun-baslik" className="mt-1 text-[34px] font-bold tracking-[-0.03em] text-default sm:text-[42px]">
          Tekrar hoş geldin, {data.firstName}.
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Asıl eylem: açık indigo zeminli tek kart, tek dolu buton. */}
        <div className="flex flex-col gap-3 rounded-[20px] border border-indigo-100 bg-indigo-50 p-6 dark:border-indigo-500/20 dark:bg-indigo-500/10 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Bugünkü görevin</p>
          <h2 className="text-2xl font-bold tracking-tight text-default">{copy.title}</h2>
          <p className="text-muted-foreground">{copy.detail}</p>
          {copy.progress != null && (
            <div className="h-1.5 max-w-sm overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-500/20" role="progressbar" aria-valuenow={copy.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Test ilerlemesi">
              <div className="h-full rounded-full bg-indigo-600 dark:bg-indigo-400" style={{ width: `${copy.progress}%` }} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-2">
            <Link href={copy.href} className={btnPrimary}>
              {copy.cta}
            </Link>
            {secondary.map((s) => (
              <Link key={s.label} href={s.href} className="text-sm font-medium text-muted-foreground transition-colors hover:text-default">
                {s.label}: {s.text} →
              </Link>
            ))}
          </div>
        </div>

        <section aria-labelledby="gunluk-hedef" className={`${card} flex flex-col gap-5 p-6`}>
          <div className="flex items-baseline justify-between">
            <h2 id="gunluk-hedef" className="font-semibold text-default">
              Günlük hedef
            </h2>
            {/* Hedef İlerlemem başlığında seçiliyor (10/20/40). */}
            <Link href="/ilerlemem" className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
              Değiştir
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative h-[72px] w-[72px] shrink-0">
              <svg className="-rotate-90" viewBox="0 0 72 72" aria-hidden="true">
                <circle cx="36" cy="36" r="30" fill="none" className="stroke-indigo-100 dark:stroke-indigo-500/20" strokeWidth="7" />
                {goalPct > 0 && <circle cx="36" cy="36" r="30" fill="none" className="stroke-indigo-600 dark:stroke-indigo-400" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(goalPct / 100) * ringLen} ${ringLen}`} />}
              </svg>
              <span className="absolute inset-0 grid place-items-center text-sm font-semibold text-default">%{goalPct}</span>
            </div>
            <div>
              <p>
                <b className="text-2xl font-semibold tracking-tight text-default">{data.dailyProgress}</b>
                <span className="text-muted-foreground"> / {data.dailyGoal} soru</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {/* Bugün en az 1 soru çözüldüyse seri zaten güvende (bkz. getCurrentStreak). */}
                {data.streak > 0
                  ? data.dailyProgress > 0
                    ? remainingGoal > 0
                      ? `${data.streak} günlük serin sürüyor`
                      : 'Bugünkü hedef tamam!'
                    : `${data.streak} günlük serin var, bugün çözmezsen sıfırlanır`
                  : 'Bugün çözmeye başla, serin başlasın'}
              </p>
            </div>
          </div>
          <ol aria-label="Bu hafta" className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
            {DAY_LABELS.map((label, i) => {
              const active = data.weeklyActiveDays[i];
              const isToday = i === todayIndex;
              return (
                <li key={label} className="flex flex-col items-center gap-1.5">
                  <span
                    className={`h-6 w-6 rounded-full ${
                      active ? 'bg-indigo-600 dark:bg-indigo-400' : isToday ? 'border-2 border-indigo-600 dark:border-indigo-400' : 'bg-surface-elevated'
                    }`}
                    aria-label={`${label}: ${active ? 'çalıştın' : isToday ? 'bugün' : 'çalışmadın'}`}
                  />
                  {label}
                </li>
              );
            })}
          </ol>
          {data.rank && (
            <Link href="/ilerlemem/siralama" className="mt-auto flex items-center justify-between gap-3 border-t border-default pt-4 text-sm">
              {/* Sayıdan sonra ek yok: "Haftalık sıralama: 3. sıra". */}
              <span className="font-medium text-default">Haftalık sıralama: {data.rank.position}. sıra</span>
              <span className="text-muted-foreground">{data.rank.toPass != null ? `+${data.rank.toPass} soru` : 'Zirvedesin!'}</span>
            </Link>
          )}
        </section>
      </div>

      {/* Akşam hatırlatması (yol haritası 3c) — izin sadece butona basınca istenir. */}
      <PushReminderOptIn />

      {data.lessons.length > 0 && (
        <section aria-labelledby="derslerim" className="mt-6 flex flex-col gap-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="derslerim" className="text-2xl font-bold tracking-tight text-default">
                Derslerim
              </h2>
              <p className="mt-1 text-muted-foreground">Her derste sıradaki adımın hazır.</p>
            </div>
            <Link href="/ilerlemem" className="shrink-0 text-sm font-medium text-indigo-600 dark:text-indigo-400">
              İlerlemem →
            </Link>
          </div>
          <div className={`grid grid-cols-1 items-start gap-6 ${lessonsAside ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
            <MyLessons lessons={data.lessons} nextSteps={data.nextSteps} openTests={data.openTestByLesson} />
            {lessonsAside}
          </div>
        </section>
      )}
    </section>
  );
}

// Derslerim (2026-10-01 yeniden tasarım; v4 sade kartlar 2026-10-02): her derste TEK buton —
// yarım test varsa "Devam et" (önce onu bitirsin), yoksa "N soru çöz" (dersin başından müfredat
// sırasıyla hiç çözmediği sorular, bkz. sequential_question_queue.sql). Hepsi çözüldüyse çerçeveli
// "Yanlışlarını tekrar et". Ders rengi yalnız ikon ve ince ilerleme çizgisinde.
function MyLessons({ lessons, nextSteps, openTests }: { lessons: LessonProgress[]; nextSteps: Map<number, LessonNextStep>; openTests: Map<number, OpenTest> }) {
  const { data: mastery } = useTopicMastery();
  const learnedByLesson = new Map((mastery?.lessons ?? []).map((l) => [l.id, { learned: l.counts.learned, total: l.topics.length }]));

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {lessons.map((lesson) => {
        const id = Number(lesson.id);
        const step = nextSteps.get(id);
        const open = openTests.get(id);
        const learned = learnedByLesson.get(id);
        const topic = step?.nextTopic;
        const topicHref = topic && lesson.lessonHref && topic.unitSlug && topic.slug ? `${lesson.lessonHref}/${topic.unitSlug}/${topic.slug}` : null;
        const count = step ? Math.min(SEQUENTIAL_TEST_SIZE, step.remaining) : 0;
        const pct = learned && learned.total > 0 ? Math.max(3, Math.round((learned.learned / learned.total) * 100)) : 0;

        let action: React.ReactNode = null;
        let detail: React.ReactNode = null;
        if (open) {
          action = (
            <Link href={open.href} className={`${btnPrimary} w-full`} aria-label={`${open.title} testine devam et, ${open.answered}/${open.total}`}>
              Devam et · {open.answered}/{open.total}
            </Link>
          );
          detail = 'Yarım kalan testin var';
        } else if (lesson.totalQuestions === 0) {
          detail = 'Bu dersin soruları yakında.';
        } else if (step && step.remaining > 0) {
          action = (
            <Link href={sequentialTestHref(step.lessonId)} className={`${btnPrimary} w-full`} aria-label={`${lesson.name}: sıradaki ${count} soruyu çöz`}>
              {count} soru çöz
            </Link>
          );
          if (topic) {
            detail = (
              <>
                Sıradaki: {topic.title}
                {topicHref &&
                  (topic.completed ? (
                    <span className="text-emerald-700 dark:text-emerald-400"> · ✓ Okudun</span>
                  ) : (
                    <>
                      {' · '}
                      <Link href={topicHref} className="text-default underline underline-offset-2">
                        {topic.viewed ? 'Konuyu oku' : 'Önce konuyu oku'}
                      </Link>
                    </>
                  ))}
              </>
            );
          }
        } else if (step) {
          action = (
            <Link href="/tekrar" className={`${btnGhost} w-full`}>
              Yanlışlarını tekrar et
            </Link>
          );
          detail = step.hasCalendar ? 'Okulda işlenen konuların hepsini çözdün' : 'Bu dersteki tüm soruları çözdün';
        } else if (lesson.soruBankasiHref) {
          action = (
            <Link href={lesson.soruBankasiHref} className={`${btnPrimary} w-full`}>
              Soru çöz
            </Link>
          );
        }

        return (
          <li key={lesson.id} className={`${card} flex flex-col gap-4 p-5`}>
            <div className="flex items-center gap-3">
              <SubjectIcon lessonName={lesson.name} />
              {lesson.lessonHref ? (
                <Link href={lesson.lessonHref} className="min-w-0 flex-1 font-semibold leading-tight text-default hover:text-indigo-600 dark:hover:text-indigo-400">
                  {lesson.name}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 font-semibold leading-tight text-default">{lesson.name}</span>
              )}
              {open && <span className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Yarım test</span>}
            </div>
            {learned && learned.total > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">
                  {learned.learned} / {learned.total} konu öğrenildi
                </p>
                <span className="block h-1 overflow-hidden rounded-full bg-surface-elevated" aria-hidden="true">
                  <span className={`block h-full rounded-full ${subjectStyle(lesson.name).bar}`} style={{ width: `${pct}%` }} />
                </span>
              </div>
            )}
            {detail && <p className="text-sm leading-snug text-muted-foreground">{detail}</p>}
            {action && <div className="mt-auto">{action}</div>}
          </li>
        );
      })}
    </ul>
  );
}
