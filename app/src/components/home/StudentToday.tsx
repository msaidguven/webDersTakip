'use client';

// Girişli öğrencinin anasayfası "Bugün" (yol haritası 3a, 2026-09-27 taslağı): "Şimdi ne
// yapmalıyım?" sorusunu tek bir görevle yanıtlar. Derin analiz (ustalık haritası, geçmiş,
// haftalık tablo) BURADA DEĞİL, "İlerlemem" sayfasında (yol haritası 4) — iki sayfa aynı
// kutuları tekrar etmesin.
import Link from 'next/link';
import { ArrowRight, Flame } from 'lucide-react';
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
        {/* 2026-10-02 sıkılaştırma (kullanıcı: büyük buton/kutular küçük öğrenciyi yoruyor): küçük
            başlık, satır içi buton, "Sonra" önerileri kutu değil tek satırlık bağlantılar. */}
        <div className="flex flex-col gap-4 rounded-[24px] border border-indigo-200 bg-indigo-50 p-5 shadow-[0_18px_40px_-28px_rgba(79,70,229,0.45)] dark:border-indigo-500/30 dark:bg-indigo-500/10 sm:p-6">
          <span className="self-start rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white">
            Bugünkü görevin
          </span>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-xl font-black leading-tight tracking-tight text-default sm:text-2xl">{copy.title}</h2>
            <p className="text-sm text-muted-foreground sm:text-[15px]">{copy.detail}</p>
          </div>
          {copy.progress != null && (
            <div className="h-2 overflow-hidden rounded-full bg-indigo-200/70 dark:bg-indigo-500/20" role="progressbar" aria-valuenow={copy.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Test ilerlemesi">
              <div className="h-full rounded-full bg-indigo-600 dark:bg-indigo-400" style={{ width: `${copy.progress}%` }} />
            </div>
          )}
          <Link
            href={copy.href}
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-indigo-600 px-5 text-[15px] font-extrabold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            {copy.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {secondary.length > 0 && (
            <ul className="flex flex-col border-t border-indigo-200 pt-1 dark:border-indigo-500/20">
              {secondary.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className="flex min-h-10 items-center justify-between gap-3 py-1.5 text-sm transition-colors hover:text-indigo-700 dark:hover:text-indigo-300">
                    <span className="min-w-0">
                      <span className="font-semibold text-muted-foreground">{s.label}: </span>
                      <span className="font-bold text-default">{s.text}</span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-[24px] border border-default bg-background p-5 sm:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="flex items-baseline gap-2">
                <span className="text-base font-black text-default">Günlük hedef</span>
                {/* Hedef İlerlemem başlığında seçiliyor (10/20/40). */}
                <Link href="/ilerlemem" className="text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-400">
                  değiştir
                </Link>
              </span>
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
              {/* Sayıdan sonra ek yok ("3.'süsün" sayıya göre değişir): "Haftalık sıralama: 3. sıra". */}
              <span className="text-[15px] font-bold text-default">Haftalık sıralama: {data.rank.position}. sıra</span>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {data.rank.toPass != null ? `Bir üst sıraya ${data.rank.toPass} soru` : 'Zirvedesin!'}
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Akşam hatırlatması (yol haritası 3c) — izin sadece butona basınca istenir. */}
      <PushReminderOptIn />

      {data.lessons.length > 0 && <MyLessons lessons={data.lessons} nextSteps={data.nextSteps} openTests={data.openTestByLesson} />}
    </section>
  );
}

// Derslerim (2026-10-01 yeniden tasarım, 2026-10-02 sıkılaştırma — kullanıcı: büyük kartlar
// küçük öğrenciyi yoruyordu): tek liste, her ders TEK SATIR. Ders adı → dersin konu sayfası;
// sağda tek küçük buton: yarım test varsa "Devam et" (önce onu bitirsin), yoksa "N soru çöz"
// (dersin başından müfredat sırasıyla hiç çözmediği sorular, bkz. sequential_question_queue.sql).
// Alt satır: öğrenilen konu + sıradaki konu ("Önce konuyu oku" / "✓ Okudun").
function MyLessons({ lessons, nextSteps, openTests }: { lessons: LessonProgress[]; nextSteps: Map<number, LessonNextStep>; openTests: Map<number, OpenTest> }) {
  const { data: mastery } = useTopicMastery();
  const learnedByLesson = new Map((mastery?.lessons ?? []).map((l) => [l.id, { learned: l.counts.learned, total: l.topics.length }]));
  const btn = 'inline-flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-3.5 text-sm font-extrabold transition-colors';

  return (
    <div className="mt-8 flex flex-col gap-3 sm:mt-10">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-black tracking-tight text-default sm:text-3xl">Derslerim</h2>
        <Link href="/ilerlemem" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
          İlerlemem →
        </Link>
      </div>
      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-default bg-background">
        {lessons.map((lesson) => {
          const id = Number(lesson.id);
          const step = nextSteps.get(id);
          const open = openTests.get(id);
          const learned = learnedByLesson.get(id);
          const topic = step?.nextTopic;
          const topicHref = topic && lesson.lessonHref && topic.unitSlug && topic.slug ? `${lesson.lessonHref}/${topic.unitSlug}/${topic.slug}` : null;
          const count = step ? Math.min(SEQUENTIAL_TEST_SIZE, step.remaining) : 0;

          let action: React.ReactNode;
          let detail: React.ReactNode = null;
          if (open) {
            action = (
              <Link href={open.href} className={`${btn} bg-orange-700 text-white hover:bg-orange-800`} aria-label={`${open.title} testine devam et, ${open.answered}/${open.total}`}>
                Devam et · {open.answered}/{open.total}
              </Link>
            );
            detail = 'Yarım kalan testin var, önce onu bitir.';
          } else if (lesson.totalQuestions === 0) {
            action = <span className="shrink-0 px-2 text-sm font-semibold text-muted-foreground">Sorular yakında</span>;
          } else if (step && step.remaining > 0) {
            action = (
              <Link href={sequentialTestHref(step.lessonId)} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`} aria-label={`${lesson.name}: sıradaki ${count} soruyu çöz`}>
                {count} soru çöz <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            );
            if (topic) {
              detail = (
                <>
                  {topic.title} ile devam
                  {topicHref &&
                    (topic.completed ? (
                      <span className="font-bold text-emerald-700 dark:text-emerald-400"> · ✓ Okudun</span>
                    ) : (
                      <>
                        {' · '}
                        <Link href={topicHref} className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">
                          {topic.viewed ? 'Konuyu oku' : 'Önce konuyu oku'}
                        </Link>
                      </>
                    ))}
                </>
              );
            }
          } else if (step) {
            action = (
              <Link href="/tekrar" className={`${btn} bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300`}>
                Tekrar et
              </Link>
            );
            detail = step.hasCalendar ? 'İşlenen konuların hepsini çözdün 🎉' : 'Tüm soruları çözdün 🎉';
          } else {
            action = lesson.soruBankasiHref ? (
              <Link href={lesson.soruBankasiHref} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>
                Soru çöz
              </Link>
            ) : null;
          }

          return (
            <li key={lesson.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  {lesson.lessonHref ? (
                    <Link href={lesson.lessonHref} className="text-[15px] font-extrabold leading-snug text-default hover:text-indigo-600 dark:hover:text-indigo-400">
                      {lesson.name}
                    </Link>
                  ) : (
                    <span className="text-[15px] font-extrabold leading-snug text-default">{lesson.name}</span>
                  )}
                  {learned && learned.total > 0 && (
                    <span className="text-xs font-semibold text-muted-foreground">
                      {learned.learned}/{learned.total} konu öğrenildi
                    </span>
                  )}
                </span>
                {detail && <span className="text-[13px] leading-snug text-muted-foreground">{detail}</span>}
              </div>
              {action}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
