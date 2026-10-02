'use client';

// Günlük hedef seçimi — 5–100 soru, 5'er adım (2026-10-02, önceden 10/20/40). İki yerde:
// İlerlemem başlığında sade (−/+) ve Profilim → Ayarlar'da hızlı seçimlerle ('full'). İkisi aynı
// ayarı (profiles.daily_goal, set_my_daily_goal RPC) değiştirir.
// Seçim anında görünür; kayıt, art arda +/- basışlarında her tıkta değil, kullanıcı durunca bir kez
// yapılır. Hata olursa son kaydedilen değere döner. Anasayfadaki "Günlük hedef" kartı da tazelenir.
import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useSWRConfig } from 'swr';
import { useAuth } from '@/app/src/context/AuthContext';
import { useMyProfileBasics, type MyProfileBasics } from '@/app/src/hooks/useMyGradeSlug';
import { DAILY_GOAL_MAX, DAILY_GOAL_MIN, DAILY_GOAL_PRESETS, DAILY_GOAL_STEP, type DailyGoal } from '@/app/src/lib/dashboardStreak';

const SAVE_DELAY_MS = 700;

export function DailyGoalPicker({ variant = 'compact' }: { variant?: 'compact' | 'full' }) {
  const { user, supabase } = useAuth();
  const profile = useMyProfileBasics();
  const { mutate } = useSWRConfig();
  const [draft, setDraft] = useState<DailyGoal | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!user || !profile) return null;
  const value = draft ?? profile.dailyGoal;
  const profileKey = ['my-profile-basics', user.id];

  const save = async (goal: DailyGoal) => {
    setStatus('saving');
    const { error } = await supabase.rpc('set_my_daily_goal', { p_goal: goal });
    if (error) {
      setDraft(null);
      setStatus('error');
      return;
    }
    await mutate(profileKey, (current?: MyProfileBasics) => (current ? { ...current, dailyGoal: goal } : current), { revalidate: false });
    void mutate(['student-today', user.id]);
    setDraft(null);
    setStatus('saved');
  };

  const choose = (goal: DailyGoal) => {
    const clamped = Math.min(DAILY_GOAL_MAX, Math.max(DAILY_GOAL_MIN, goal));
    setDraft(clamped);
    setStatus('idle');
    if (timer.current) clearTimeout(timer.current);
    if (clamped === profile.dailyGoal) { setDraft(null); return; }
    timer.current = setTimeout(() => void save(clamped), SAVE_DELAY_MS);
  };

  const stepBtn =
    'flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-background hover:text-default disabled:opacity-30 disabled:hover:bg-transparent';

  const stepper = (
    // Ayarlar kartı zaten surface-elevated zeminde — orada kenarlıklı/ayrı zemin ki düğme gibi görünsün.
    <div
      role="group"
      aria-labelledby="gunluk-hedef-etiket"
      className={`flex items-center gap-1 rounded-2xl p-1 ${variant === 'full' ? 'border border-default bg-background' : 'bg-surface-elevated'}`}
    >
      <button type="button" onClick={() => choose(value - DAILY_GOAL_STEP)} disabled={value <= DAILY_GOAL_MIN} aria-label="Hedefi 5 azalt" className={stepBtn}>
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <output aria-live="polite" className="min-w-[5.5rem] text-center text-base font-extrabold tabular-nums text-default">
        {value} soru
      </output>
      <button type="button" onClick={() => choose(value + DAILY_GOAL_STEP)} disabled={value >= DAILY_GOAL_MAX} aria-label="Hedefi 5 artır" className={stepBtn}>
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );

  const feedback =
    status === 'error' ? (
      <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">Hedefin kaydedilemedi, tekrar dener misin?</p>
    ) : status === 'saved' && variant === 'full' ? (
      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Kaydedildi.</p>
    ) : null;

  if (variant === 'compact') {
    return (
      <div className="flex flex-col items-start gap-1.5 sm:items-end">
        <div className="flex items-center gap-3">
          <span id="gunluk-hedef-etiket" className="whitespace-nowrap text-sm font-bold text-muted-foreground">Günlük hedefin</span>
          {stepper}
        </div>
        {feedback}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span id="gunluk-hedef-etiket" className="sr-only">Günlük hedefin</span>
        {stepper}
        <div className="flex flex-wrap gap-1.5" aria-label="Hızlı seçim">
          {DAILY_GOAL_PRESETS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={g === value}
              onClick={() => choose(g)}
              className={`min-h-9 rounded-xl px-3 text-sm font-bold transition-colors ${
                g === value ? 'bg-indigo-600 text-white' : 'border border-default bg-background text-muted-foreground hover:text-default'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      {feedback}
    </div>
  );
}
