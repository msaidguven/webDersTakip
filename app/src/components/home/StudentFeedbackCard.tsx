'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { FeedbackSheet } from '@/app/src/components/feedback/FeedbackSheet';
import { STUDENT_REACTIONS, type FeedbackCategory } from '@/app/src/lib/siteFeedback';
import r from '@/app/src/components/robotic/robotic.module.css';

const COOLDOWN_KEY = 'dt-student-feedback-until-v1';
const COOLDOWN_MS = 14 * 86_400_000; // 14 gün

export function StudentFeedbackCard({ streak }: { streak: number }) {
  const [hidden, setHidden] = useState(true);
  const [sheetCategory, setSheetCategory] = useState<FeedbackCategory | null>(null);

  useEffect(() => {
    let shouldHide = false;
    try {
      const until = Number(localStorage.getItem(COOLDOWN_KEY) || '0');
      if (Number.isFinite(until) && until > Date.now()) shouldHide = true;
    } catch {
      /* yok say */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage yalnız istemcide okunur
    setHidden(shouldHide);
  }, []);

  const snooze = () => {
    setHidden(true);
    try {
      localStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_MS));
    } catch {
      /* yok say */
    }
  };

  if (hidden && sheetCategory === null) return null;

  return (
    <>
      {!hidden && (
        <aside
          aria-label="Hızlı geri bildirim"
          className={`flex flex-col gap-2.5 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between ${r.item}`}
        >
          <div className="flex items-start justify-between gap-2 sm:items-center">
            <div>
              <p className="text-sm font-bold text-default">Ders Takip nasıl gidiyor?</p>
              <p className="text-xs text-muted-foreground">Tek tıkla fikrini paylaş, siteyi birlikte geliştirelim.</p>
            </div>
            <button
              type="button"
              onClick={snooze}
              aria-label="Geri bildirim kartını gizle"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-default sm:hidden"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="grid flex-1 grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
              {STUDENT_REACTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSheetCategory(item.value)}
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-[var(--edge)] bg-[var(--bg)] px-3 py-1.5 text-xs font-bold text-default transition-colors hover:border-[var(--neon)] hover:text-[var(--neon)] active:scale-[0.98]"
                >
                  <span aria-hidden="true">{item.emoji}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={snooze}
              aria-label="Geri bildirim kartını gizle"
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-default sm:flex"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </aside>
      )}

      <FeedbackSheet
        open={sheetCategory !== null}
        onClose={() => setSheetCategory(null)}
        variant="student"
        source="student_today"
        isAuthenticated
        initialCategory={sheetCategory ?? 'like'}
        extraContext={{ streak }}
        onSubmitted={snooze}
      />
    </>
  );
}
