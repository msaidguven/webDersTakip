'use client';

// Anasayfadaki Günün Sorusu (2026-09-27). Soru sunucuda gün tarihine göre seçiliyor (bkz.
// homeHighlights.getDailyQuestion) — herkes aynı gün aynı soruyu görür. Cevap anında burada
// gösterilir; "öğrencilerin %X'i doğru bildi" istatistiği arkadan gelir (yol haritası 3b,
// supabase/migrations/daily_question_answers.sql). Doğruluk SUNUCUDA hesaplanır, istemci sadece
// seçilen şıkkı yollar. İstatistik isteği başarısızsa (ör. migration yok) satır sessizce gizlenir.
// Hafif tutuldu: anasayfa bundle'ına ağır soru bileşenlerini (QuizClient) çekmiyor.
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDismissOnBack } from '@/app/src/hooks/useDismissOnBack';
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowRight, CheckCircle2, Sun, Users, X, XCircle } from 'lucide-react';
import MathText from '@/app/src/components/MathText';
import { useAuth } from '@/app/src/context/AuthContext';
import type { DailyQuestion, DailyQuestionSet } from '@/app/src/lib/homeHighlights';
import { roboticFontVars } from '../robotic/fonts';
import r from '../robotic/robotic.module.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
// Bu sayının altında yüzde gösterilmez — tek kişilik "%100" yanıltıcı.
const MIN_ANSWERS_FOR_PERCENT = 5;
const ANON_KEY_STORAGE = 'dt-anon-key';

type Stats = { total: number; correct: number };

function istanbulDateKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
}

// localStorage erişimi gizli sekme/engelli çerezde hata verebilir — hiçbir yerde sayfayı bozmasın.
function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* yok say */
  }
}
function getAnonKey(): string | null {
  const existing = readStorage(ANON_KEY_STORAGE);
  if (existing) return existing;
  if (typeof crypto === 'undefined' || !crypto.randomUUID) return null;
  const created = crypto.randomUUID();
  writeStorage(ANON_KEY_STORAGE, created);
  return readStorage(ANON_KEY_STORAGE) ? created : null;
}

const noopSubscribe = () => () => {};
const DAILY_ANSWERED_EVENT = 'dt-daily-answered';

function subscribeDailyAnswer(cb: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(DAILY_ANSWERED_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(DAILY_ANSWERED_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function resolveDailyQuestionItem(set: DailyQuestionSet, todayKey: string): DailyQuestion {
  const dayOffset = Math.round((Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${set.startKey}T00:00:00Z`)) / 86_400_000);
  const count = set.items.length;
  return set.items[(((Number.isFinite(dayOffset) ? dayOffset : 0) % count) + count) % count];
}

// Mobil anasayfa kartında ders adı + "Çözülmedi / Çözüldü" durumunu canlı göstermek için.
export function useDailyQuestionStatus(set: DailyQuestionSet | null): { lessonName: string; answered: boolean } | null {
  const todayKey = useSyncExternalStore(noopSubscribe, istanbulDateKey, () => set?.startKey ?? '');
  const item = set ? resolveDailyQuestionItem(set, todayKey) : null;
  const storageKey = item ? `dt-daily-${todayKey}-${item.question.id}` : '';
  const stored = useSyncExternalStore(
    subscribeDailyAnswer,
    () => (storageKey ? readStorage(storageKey) : null),
    () => null,
  );
  if (!item) return null;
  const pickedId = stored ? Number(stored) : null;
  const answered = pickedId != null && item.question.choices.some((c) => c.id === pickedId);
  return { lessonName: item.lessonName, answered };
}

export function DailyQuestionCard({ data, tabs, embedded = false }: { data: DailyQuestion; tabs?: ReactNode; embedded?: boolean }) {
  const { question } = data;
  const { user, supabase } = useAuth();
  const storageKey = `dt-daily-${istanbulDateKey()}-${question.id}`;

  // Bugün bu soruya daha önce cevap verildiyse (sayfaya geri dönüş) seçim hatırlanır.
  // useSyncExternalStore: sunucu HTML'i "cevaplanmamış" (null), hydration uyuşmazlığı yok.
  const storedChoice = useSyncExternalStore(noopSubscribe, () => readStorage(storageKey), () => null);
  const [localPick, setLocalPick] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState<Stats | null>(null);
  const pickedId = localPick ?? (storedChoice ? Number(storedChoice) : null);
  const answered = pickedId != null && question.choices.some((c) => c.id === pickedId);
  const pickedCorrect = answered && question.choices.find((c) => c.id === pickedId)?.is_correct;

  // Geri dönen kullanıcı için güncel istatistik (yeni cevapta submit zaten döndürüyor).
  const { data: fetchedStats } = useSWR<Stats | null>(
    answered && !submitted ? ['daily-question-stats', question.id] : null,
    async () => {
      const { data: rows, error } = await supabase.rpc('get_daily_question_stats', { p_question_id: question.id });
      if (error) return null;
      const row = (rows as Stats[] | null)?.[0];
      return row ? { total: row.total, correct: row.correct } : null;
    },
    { revalidateOnFocus: false }
  );
  const stats = submitted ?? fetchedStats ?? null;

  const pick = async (choiceId: number) => {
    if (answered) return;
    setLocalPick(choiceId);
    writeStorage(storageKey, String(choiceId));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(DAILY_ANSWERED_EVENT));
    const anonKey = user ? null : getAnonKey();
    if (!user && !anonKey) return;
    const { data: rows, error } = await supabase.rpc('submit_daily_question_answer', {
      p_question_id: question.id,
      p_choice_id: choiceId,
      p_anon_key: anonKey,
    });
    if (error) return;
    const row = (rows as (Stats & { is_correct: boolean })[] | null)?.[0];
    if (row) setSubmitted({ total: row.total, correct: row.correct });
  };

  return (
    // v5 anasayfa diliyle uyumlu: yumuşak amber zemin + bordo çerçeve (2026-10-19).
    // BottomSheet içinde (embedded) çift çerçeve ve başlık tekrarı olmadan sade görünür.
    <section
      aria-labelledby={embedded ? undefined : 'gunun-sorusu'}
      className={
        embedded
          ? 'flex flex-col gap-4'
          : `flex flex-col gap-4 rounded-[20px] p-4 sm:p-6 ${r.panel}`
      }
    >
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="gunun-sorusu" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <Sun className="h-3.5 w-3.5" aria-hidden="true" /> Günün sorusu
            </h2>
            {tabs}
          </div>
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {data.gradeName} · {data.lessonName}
          </span>
        </div>
      )}

      <MathText as="p" text={question.question_text} className="text-[17px] font-semibold leading-snug text-default" />

      <div className="flex flex-col gap-2.5" role="group" aria-label="Şıklar">
        {question.choices.map((choice, i) => {
          const isPicked = choice.id === pickedId;
          const state = !answered ? 'idle' : choice.is_correct ? 'correct' : isPicked ? 'wrong' : 'muted';
          const cls =
            state === 'correct'
              ? 'border-emerald-500 bg-emerald-500/10 text-default'
              : state === 'wrong'
                ? 'border-rose-500 bg-rose-500/10 text-default'
                : state === 'muted'
                  ? 'border-default bg-surface text-muted-foreground'
                  : 'border-default bg-background/70 text-default hover:border-indigo-400 hover:bg-indigo-500/5';
          return (
            <button
              key={choice.id}
              type="button"
              disabled={answered}
              onClick={() => void pick(choice.id)}
              aria-pressed={isPicked}
              className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-[15px] font-medium transition-colors disabled:cursor-default ${cls}`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-xs font-semibold text-muted-foreground">
                {LETTERS[i]}
              </span>
              <MathText text={choice.text} className="min-w-0 flex-1" />
              {state === 'correct' && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="Doğru cevap" />}
              {state === 'wrong' && <XCircle className="h-5 w-5 shrink-0 text-rose-600" aria-label="Senin cevabın" />}
            </button>
          );
        })}
      </div>

      {answered ? (
        <div aria-live="polite" className="flex flex-col gap-2 rounded-xl bg-background/70 p-4 text-sm">
          <p className={`font-black ${pickedCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
            {pickedCorrect ? 'Doğru! Yarın yeni bir soru seni bekliyor.' : 'Olmadı — doğru cevap işaretlendi.'}
          </p>
          {stats && stats.total > 0 && (
            <p className="flex items-center gap-1.5 font-bold text-default">
              <Users className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              {stats.total >= MIN_ANSWERS_FOR_PERCENT
                ? // Yüzdeden sonra ek gerektirmeyen cümle: "%62'si / %60'ı" ekleri sayının okunuşuna göre değişir.
                  `Bugün ${stats.total} kişi cevapladı, %${Math.round((stats.correct / stats.total) * 100)} doğru bildi.`
                : 'Bugün ilk cevaplayanlardansın!'}
            </p>
          )}
          {question.solution_text && <MathText as="p" text={question.solution_text} className="leading-relaxed text-muted-foreground" />}
          {data.topicHref && (
            <Link href={data.topicHref} className="self-start font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
              {data.topicTitle} konusunu çalış →
            </Link>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Her gün yeni bir soru. Cevapla, kaç kişinin doğru bildiğini gör.</p>
      )}
    </section>
  );
}

// Haftanın 7 sorusundan bugününki (2026-10-04, Vercel CPU): anasayfa 7 gün önbellekte, günlük
// yenilenmiyor — set sunucuda seçilir (homeHighlights.getDailyQuestionSetsByGrade, sınıf başına), gün tarayıcıda belirlenir.
// Sunucu HTML'i setin ilk sorusuyla çizilir; tarayıcı bugünün İstanbul tarihini okuyunca (hydration
// sonrası, uyuşmazlık yok) setin başlangıcından bu yana geçen gün kadar ilerler. Set 7 günden uzun
// önbellekte kalırsa başa döner — her gün yine bir soru görünür.
export function DailyQuestionOfTheDay({ set, tabs, embedded = false }: { set: DailyQuestionSet; tabs?: ReactNode; embedded?: boolean }) {
  const todayKey = useSyncExternalStore(noopSubscribe, istanbulDateKey, () => set.startKey);
  const item = resolveDailyQuestionItem(set, todayKey);
  return <DailyQuestionCard key={item.question.id} data={item} tabs={tabs} embedded={embedded} />;
}

// Mobilde Günün Sorusu için tam ekran native quiz deneyimi (2026-11-24).
function DailyQuestionFullScreenBody({ data, onClose }: { data: DailyQuestion; onClose: () => void }) {
  const { question } = data;
  const { user, supabase } = useAuth();
  const storageKey = `dt-daily-${istanbulDateKey()}-${question.id}`;

  const storedChoice = useSyncExternalStore(noopSubscribe, () => readStorage(storageKey), () => null);
  const [localPick, setLocalPick] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState<Stats | null>(null);
  const pickedId = localPick ?? (storedChoice ? Number(storedChoice) : null);
  const answered = pickedId != null && question.choices.some((c) => c.id === pickedId);
  const pickedCorrect = answered && question.choices.find((c) => c.id === pickedId)?.is_correct;

  const { data: fetchedStats } = useSWR<Stats | null>(
    answered && !submitted ? ['daily-question-stats', question.id] : null,
    async () => {
      const { data: rows, error } = await supabase.rpc('get_daily_question_stats', { p_question_id: question.id });
      if (error) return null;
      const row = (rows as Stats[] | null)?.[0];
      return row ? { total: row.total, correct: row.correct } : null;
    },
    { revalidateOnFocus: false }
  );
  const stats = submitted ?? fetchedStats ?? null;
  const pctCorrect = stats && stats.total >= MIN_ANSWERS_FOR_PERCENT ? Math.round((stats.correct / stats.total) * 100) : null;

  const pick = async (choiceId: number) => {
    if (answered) return;
    setLocalPick(choiceId);
    writeStorage(storageKey, String(choiceId));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(DAILY_ANSWERED_EVENT));
    const anonKey = user ? null : getAnonKey();
    if (!user && !anonKey) return;
    const { data: rows, error } = await supabase.rpc('submit_daily_question_answer', {
      p_question_id: question.id,
      p_choice_id: choiceId,
      p_anon_key: anonKey,
    });
    if (error) return;
    const row = (rows as (Stats & { is_correct: boolean })[] | null)?.[0];
    if (row) setSubmitted({ total: row.total, correct: row.correct });
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* Tam ekran üst App Bar (safe-area uyumlu + ince robotik neon çizgi) */}
      <header
        className="relative flex shrink-0 items-center justify-between gap-3 border-b px-4 pb-3 pt-[max(0.875rem,env(safe-area-inset-top))] sm:px-6 sm:py-4"
        style={{ background: 'var(--panel-solid)', borderColor: 'var(--edge)' }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-[1px]"
          style={{ background: 'linear-gradient(90deg, transparent, var(--neon-2) 25%, var(--neon) 65%, transparent)' }}
        />
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/25">
            <Sun className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[16px] font-extrabold leading-tight text-default">Günün Sorusu</h2>
            <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
              {data.gradeName} · {data.lessonName}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className={`h-10 w-10 shrink-0 active:scale-95 ${r.iconBtn}`}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {/* Kaydırılabilir tam ekran soru + şıklar gövdesi */}
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-8"
        style={{
          background:
            'radial-gradient(600px 320px at 50% -60px, color-mix(in srgb, var(--neon) 10%, transparent), transparent 70%), var(--bg)',
        }}
      >
        <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
          {/* Soru kartı */}
          <div className={`rounded-[22px] p-5 sm:p-6 ${r.panel} ${r.hero}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-2 ${r.label}`}>
                <i className={r.led} aria-hidden="true" />
                Günün Meydan Okuması
              </span>
              {answered && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    pickedCorrect
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {pickedCorrect ? '✓ Doğru' : '✕ Yanlış'}
                </span>
              )}
            </div>
            <MathText
              as="p"
              text={question.question_text}
              className="text-[16.5px] font-semibold leading-relaxed text-default sm:text-[18px]"
            />
          </div>

          {/* Şıklar */}
          <div className="flex flex-col gap-3" role="group" aria-label="Şıklar">
            {question.choices.map((choice, i) => {
              const isPicked = choice.id === pickedId;
              const state = !answered ? 'idle' : choice.is_correct ? 'correct' : isPicked ? 'wrong' : 'muted';
              const cardCls =
                state === 'correct'
                  ? 'border-emerald-500 bg-emerald-500/12 text-default shadow-sm shadow-emerald-500/15'
                  : state === 'wrong'
                    ? 'border-rose-500 bg-rose-500/12 text-default shadow-sm shadow-rose-500/15'
                    : state === 'muted'
                      ? 'border-transparent bg-surface/60 text-muted-foreground opacity-65'
                      : `${r.item} active:scale-[0.985]`;
              const badgeCls =
                state === 'correct'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : state === 'wrong'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : state === 'muted'
                      ? 'bg-surface-elevated text-muted-foreground border-transparent'
                      : r.chipBox;
              return (
                <button
                  key={choice.id}
                  type="button"
                  disabled={answered}
                  onClick={() => void pick(choice.id)}
                  aria-pressed={isPicked}
                  className={`flex min-h-[58px] items-center gap-3.5 rounded-2xl border-2 px-4 py-3 text-left text-[15px] font-medium transition-all select-none disabled:cursor-default ${cardCls}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${badgeCls}`}>
                    {LETTERS[i]}
                  </span>
                  <MathText text={choice.text} className="min-w-0 flex-1 leading-snug" />
                  {state === 'correct' && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Doğru cevap" />}
                  {state === 'wrong' && <XCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" aria-label="Senin cevabın" />}
                </button>
              );
            })}
          </div>

          {/* Sonuç + İstatistik + Çözüm */}
          {answered ? (
            <div
              aria-live="polite"
              className={`flex flex-col gap-3 rounded-[20px] border p-4 ${
                pickedCorrect
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-rose-500/30 bg-rose-500/10'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {pickedCorrect ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                )}
                <p className={`text-[15px] font-extrabold ${pickedCorrect ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'}`}>
                  {pickedCorrect ? 'Harika! Doğru bildin.' : 'Olmadı — doğru cevap yeşille işaretlendi.'}
                </p>
              </div>

              {stats && stats.total > 0 && (
                <div className="flex flex-col gap-1.5 rounded-xl bg-background/70 px-3.5 py-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2 font-bold text-default">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
                      {pctCorrect != null ? `Bugün ${stats.total} kişi cevapladı` : 'Bugün ilk cevaplayanlardansın!'}
                    </span>
                    {pctCorrect != null && <span className="text-cyan-700 dark:text-cyan-400">%{pctCorrect} doğru</span>}
                  </div>
                  {pctCorrect != null && (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-surface-elevated">
                      <div className={r.fill} style={{ width: `${Math.max(pctCorrect, 4)}%` }} />
                    </div>
                  )}
                </div>
              )}

              {question.solution_text && (
                <div className="rounded-xl bg-background/70 px-3.5 py-3 text-sm">
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Çözüm</div>
                  <MathText as="p" text={question.solution_text} className="leading-relaxed text-default" />
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Bir şıkka dokun — cevabı ve diğer öğrencilerin başarısını anında gör.
            </p>
          )}
        </div>
      </div>

      {/* Alt aksiyon çubuğu (cevaplandıktan sonra belirgin) */}
      {answered && (
        <footer
          className="shrink-0 border-t px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
          style={{ background: 'var(--panel-solid)', borderColor: 'var(--edge)' }}
        >
          <div className="mx-auto flex w-full max-w-lg items-center gap-2.5">
            {data.topicHref ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className={`min-h-12 rounded-xl px-4 text-sm font-bold active:scale-[0.98] ${r.item}`}
                >
                  Kapat
                </button>
                <Link
                  href={data.topicHref}
                  onClick={onClose}
                  className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white active:scale-[0.98] ${r.btnNeon}`}
                >
                  <span className="truncate">{data.topicTitle} konusunu çalış</span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className={`flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-bold text-white active:scale-[0.98] ${r.btnNeon}`}
              >
                Tamam, Kapat
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}

export function DailyQuestionFullScreen({
  open,
  onClose,
  set,
}: {
  open: boolean;
  onClose: () => void;
  set: DailyQuestionSet;
}) {
  const todayKey = useSyncExternalStore(noopSubscribe, istanbulDateKey, () => set.startKey);
  const item = resolveDailyQuestionItem(set, todayKey);
  useDismissOnBack(open, onClose);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Günün Sorusu"
      className={`fixed inset-0 z-[90] flex h-[100dvh] w-full flex-col overflow-hidden ${roboticFontVars} ${r.themeVars} ${r.sheetEnter}`}
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <DailyQuestionFullScreenBody key={item.question.id} data={item} onClose={onClose} />
    </div>,
    document.body,
  );
}
