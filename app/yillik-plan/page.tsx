// MEB yıllık plan — herkese açık. Her sınıf ve dersin konularını hangi haftada işleneceğiyle gösterir.
// Veri lib/yillikPlanPage.ts'te (anonim okuma, ISR). Bu hafta vurgusu yalnızca dönem içindeyse görünür.
import type { Metadata } from 'next';
import { createAnonClient } from '@/utils/supabase/server-anon';
import { getCurriculumCalendar } from '@/app/src/lib/curriculumCalendar';
import { getCurrentCurriculumWeek } from '@/app/src/lib/routeParsing';
import { istanbulToday } from '@/app/src/lib/progressActivity';
import { getYillikPlan } from '@/app/src/lib/yillikPlanPage';
import { PlanCard } from '@/app/src/components/yillikPlan/PlanCard';
import { ChevronDown } from 'lucide-react';

// Plan haftada bir değişir; gün içinde yenileme gerekmez.
export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'MEB Yıllık Plan (Hafta Hafta Konular)',
  description:
    'Ortaokul derslerinin MEB yıllık planı: hangi konunun hangi haftada işlendiği. Her konunun anlatımına ve sorularına tek tıkla geç.',
  alternates: { canonical: '/yillik-plan' },
  robots: { index: true, follow: true },
};

export default async function YillikPlanPage() {
  const supabase = createAnonClient();
  const [{ grades, maxWeek }, calendar] = await Promise.all([getYillikPlan(supabase), getCurriculumCalendar(supabase)]);

  // Dönem dışındaysa (yaz tatili gibi) hiçbir hafta "bu hafta" olmamalı.
  const today = istanbulToday();
  const inTerm =
    !!calendar.termStartDate && today >= calendar.termStartDate && (!calendar.termEndDate || today <= calendar.termEndDate);
  const currentWeek = inTerm ? getCurrentCurriculumWeek(maxWeek, calendar.termStartDate, calendar.breaks) : null;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-black tracking-tight text-default sm:text-5xl">MEB yıllık plan</h1>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
            Her sınıf ve dersin konularının hangi haftada işleneceğini gösterir. Bir konu başlığına tıklayarak anlatımına ve sorularına
            geçebilirsin.
            {currentWeek && (
              <>
                {' '}
                Şu an <strong className="text-default">{currentWeek}. hafta</strong>.
              </>
            )}
          </p>
        </header>

        {grades.length === 0 ? (
          <p className="text-sm text-muted-foreground">Yıllık plan henüz yayınlanmadı.</p>
        ) : (
          grades.map((grade) => (
            <details key={grade.name} className="group flex flex-col gap-5 rounded-3xl border border-default bg-surface p-5 sm:p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="flex flex-col">
                  <span className="text-2xl font-black tracking-tight text-default">{grade.name}</span>
                  <span className="text-sm font-semibold text-muted-foreground">
                    {grade.lessons.length} ders · {grade.lessons.reduce((n, l) => n + l.topicCount, 0)} konu
                  </span>
                </span>
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
                {grade.lessons.map((lesson) => (
                  <PlanCard key={lesson.href} lesson={lesson} currentWeek={currentWeek} />
                ))}
              </div>
            </details>
          ))
        )}
      </main>
    </div>
  );
}
