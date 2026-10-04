'use client';

// Anasayfadaki Günün Sorusu (2026-09-27). Soru sunucuda gün tarihine göre seçiliyor (bkz.
// homeHighlights.getDailyQuestion) — herkes aynı gün aynı soruyu görür. Cevap anında burada
// gösterilir; "öğrencilerin %X'i doğru bildi" istatistiği arkadan gelir (yol haritası 3b,
// supabase/migrations/daily_question_answers.sql). Doğruluk SUNUCUDA hesaplanır, istemci sadece
// seçilen şıkkı yollar. İstatistik isteği başarısızsa (ör. migration yok) satır sessizce gizlenir.
// Hafif tutuldu: anasayfa bundle'ına ağır soru bileşenlerini (QuizClient) çekmiyor.
import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { CheckCircle2, Sun, Users, XCircle } from 'lucide-react';
import MathText from '@/app/src/components/MathText';
import { useAuth } from '@/app/src/context/AuthContext';
import type { DailyQuestion, DailyQuestionSet } from '@/app/src/lib/homeHighlights';

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

export function DailyQuestionCard({ data }: { data: DailyQuestion }) {
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
    // Sade kart (anasayfa v4, 2026-10-02): beyaz zemin, ince çerçeve, renkli bant yok.
    <section aria-labelledby="gunun-sorusu" className="flex flex-col gap-4 rounded-[20px] border border-default bg-background p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="gunun-sorusu" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          <Sun className="h-3.5 w-3.5" aria-hidden="true" /> Günün sorusu
        </h2>
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {data.gradeName} · {data.lessonName}
        </span>
      </div>

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
                  : 'border-default bg-background text-default hover:border-indigo-400 hover:bg-indigo-500/5';
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
        <div aria-live="polite" className="flex flex-col gap-2 rounded-xl bg-surface p-4 text-sm">
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
// yenilenmiyor — set sunucuda seçilir (homeHighlights.getDailyQuestionSet), gün tarayıcıda belirlenir.
// Sunucu HTML'i setin ilk sorusuyla çizilir; tarayıcı bugünün İstanbul tarihini okuyunca (hydration
// sonrası, uyuşmazlık yok) setin başlangıcından bu yana geçen gün kadar ilerler. Set 7 günden uzun
// önbellekte kalırsa başa döner — her gün yine bir soru görünür.
export function DailyQuestionOfTheDay({ set }: { set: DailyQuestionSet }) {
  const todayKey = useSyncExternalStore(noopSubscribe, istanbulDateKey, () => set.startKey);
  const dayOffset = Math.round((Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${set.startKey}T00:00:00Z`)) / 86_400_000);
  const count = set.items.length;
  const item = set.items[(((Number.isFinite(dayOffset) ? dayOffset : 0) % count) + count) % count];
  return <DailyQuestionCard key={item.question.id} data={item} />;
}
