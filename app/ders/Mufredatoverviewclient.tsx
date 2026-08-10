// app/ders/Mufredatoverviewclient.tsx
// (İçerik MufredatOverviewClient.tsx ile birebir aynı — sadece istenen dosya yoluna göre yeniden adlandırıldı.)

'use client';

import React, { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export type Unit = {
  id: number;
  title: string;
  slug: string | null;
  order_no: number;
  start_week: number | null;
  end_week: number | null;
  topicCount?: number | null;
};

interface MufredatOverviewClientProps {
  gradeName: string;
  lessonName: string;
  gradeSlug: string | null;
  lessonSlug: string | null;
  gradeId: string;
  lessonId: string;
  units: Unit[];
  currentWeek: number;
  totalWeeks?: number;
  currentTopicTitle?: string | null;
}

const UNIT_ICONS = ['🌞', '📦', '🧪', '🧬', '💡', '🧲', '🌍', '⚙️'];

export default function MufredatOverviewClient({
  gradeName,
  lessonName,
  gradeSlug,
  lessonSlug,
  gradeId,
  lessonId,
  units,
  currentWeek,
  totalWeeks = 38,
  currentTopicTitle,
}: MufredatOverviewClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goToWeek = (weekNo: number) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set('hafta', String(weekNo));

    if (gradeSlug && lessonSlug) {
      router.push(`/${gradeSlug}/${lessonSlug}/icerik?${params.toString()}`);
    } else {
      params.set('sinif', gradeId);
      params.set('ders', lessonId);
      router.push(`/ders/icerik?${params.toString()}`);
    }
  };

  const activeUnit = useMemo(
    () => units.find((u) => currentWeek >= (u.start_week || 1) && currentWeek <= (u.end_week || totalWeeks)),
    [units, currentWeek, totalWeeks]
  );

  const overallProgressPct = Math.min(100, Math.round(((currentWeek - 1) / totalWeeks) * 100));

  return (
    <div className="min-h-screen bg-[#f9fafb] text-slate-800 font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">{lessonName}</h1>
            <div className="flex items-center gap-1 text-xs sm:text-sm font-bold text-slate-400 mt-0.5">
              <span>{gradeName}</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-black">
            <Sparkles className="h-3.5 w-3.5" /> %{overallProgressPct} tamamlandı
          </div>
        </div>

        {activeUnit && (
          <button
            onClick={() => goToWeek(currentWeek)}
            className="w-full text-left mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 sm:px-6 py-4 flex items-center justify-between gap-4 hover:bg-amber-100/70 transition-colors group"
          >
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-amber-400 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-black text-amber-700 uppercase tracking-wide">
                  MEB&apos;de Bu Hafta &middot; Hafta {currentWeek}
                </div>
                <div className="text-sm sm:text-base font-extrabold text-slate-800 truncate">
                  {activeUnit.order_no}. Ünite &ndash; {activeUnit.title}
                </div>
                {currentTopicTitle && (
                  <div className="text-xs sm:text-sm text-slate-500 font-medium truncate">
                    {currentTopicTitle} konusuna devam ediliyor.
                  </div>
                )}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-amber-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}

        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-black text-slate-800">Üniteler</h2>
        </div>

        <div className="space-y-4">
          {units.map((unit, i) => {
            const start = unit.start_week || 1;
            const end = unit.end_week || totalWeeks;
            const isCompleted = currentWeek > end;
            const isActive = currentWeek >= start && currentWeek <= end;
            const weeksInUnit = Math.max(1, end - start + 1);
            const weeksDone = Math.min(weeksInUnit, Math.max(0, currentWeek - start));
            const unitProgressPct = isCompleted ? 100 : Math.round((weeksDone / weeksInUnit) * 100);
            const weekNumbers = Array.from({ length: weeksInUnit }, (_, idx) => start + idx);

            const statusLabel = isCompleted ? 'Tamamlandı' : isActive ? 'Devam Ediyor' : 'Başlamadı';
            const ctaLabel = isCompleted ? 'Tekrar Çalış' : isActive ? 'Devam Et' : 'İncele';
            const ctaWeek = isCompleted ? start : isActive ? currentWeek : start;

            return (
              <div
                key={unit.id}
                className={`
                  rounded-2xl border overflow-hidden transition-shadow
                  ${isActive ? 'border-amber-200 bg-amber-50/40 shadow-sm' : 'border-slate-200 bg-white'}
                `}
              >
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl shrink-0">
                      {UNIT_ICONS[i % UNIT_ICONS.length]}
                    </div>
                    <div className="min-w-0">
                      <span
                        className={`inline-block text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md mb-1
                          ${isActive ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {unit.order_no}. Ünite
                      </span>
                      <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">{unit.title}</h3>
                      {unit.topicCount != null && (
                        <div className="flex items-center gap-1 text-xs text-slate-400 font-bold mt-0.5">
                          <BookOpen className="h-3 w-3" /> {unit.topicCount} konu
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0 min-w-[120px]">
                    <div className={`flex items-center gap-1 text-xs font-black ${isCompleted ? 'text-emerald-600' : isActive ? 'text-amber-600' : 'text-slate-400'}`}>
                      {isCompleted && <CheckCircle2 className="h-3.5 w-3.5" />}
                      {statusLabel}
                    </div>
                    <div className="h-1.5 w-full min-w-[100px] bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-amber-400'}`}
                        style={{ width: `${unitProgressPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex items-center gap-2 flex-wrap">
                  {weekNumbers.map((w) => {
                    const wCompleted = w < currentWeek;
                    const wIsCurrent = w === currentWeek;
                    return (
                      <button
                        key={w}
                        onClick={() => goToWeek(w)}
                        className={`
                          flex flex-col items-center justify-center px-3 py-2 rounded-xl text-xs font-bold border transition-colors min-w-[76px]
                          ${wIsCurrent
                            ? 'bg-amber-400 border-amber-400 text-white shadow-sm'
                            : wCompleted
                              ? 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}
                        `}
                      >
                        <span className="flex items-center gap-1">
                          {wCompleted && !wIsCurrent && <CheckCircle2 className="h-3 w-3" />}
                          Hafta {w}
                        </span>
                        {wIsCurrent && <span className="text-[9px] font-black uppercase tracking-wide">MEB&apos;de Bu Hafta</span>}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => goToWeek(ctaWeek)}
                    className={`
                      ml-auto flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-colors shrink-0
                      ${isActive
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}
                    `}
                  >
                    {ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {units.length === 0 && (
            <div className="text-center p-8 bg-white rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400 font-bold">
              Bu ders için ünite bulunamadı.
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-400 font-medium mt-6 text-center">
          Haftaların tarih aralıkları MEB takvimine göredir ve değişiklik gösterebilir.
        </p>
      </div>
    </div>
  );
}