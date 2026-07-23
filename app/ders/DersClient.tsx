'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Ellipsis, GraduationCap, Minus, Plus } from 'lucide-react';
import type { CSSProperties } from 'react';

type Outcome = { id?: string | number; description: string };
type Content = { id: string | number; title: string; content?: string | null };

interface DersClientProps {
  initialData: {
    gradeName: string;
    lessonName: string;
    unitName: string;
    outcomes: Outcome[];
    contents: Content[];
    totalWeeks: number;
    gradeSlug: string | null;
    lessonSlug: string | null;
    unitSlug: string | null;
    topicTitle: string | null;
    topicSlug: string | null;
  };
  gradeId: string;
  lessonId: string;
  week: number;
}

function formatTR(date: Date) {
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(date);
}

function formatTRWithYear(date: Date) {
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getAcademicWeekRange(weekNo: number) {
  // Şemada başlangıç haftası için net bir tablo yok; geçici olarak 8 Eylül 2025'i "1. hafta" başlangıcı kabul ediyoruz.
  const week1Start = new Date(2025, 8, 8); // months are 0-based (8 => September)
  const start = addDays(week1Start, (weekNo - 1) * 7);
  const end = addDays(start, 6);
  return { start, end };
}

export default function DersClient({ initialData, gradeId, lessonId, week }: DersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fontScale, setFontScale] = useState<0 | 1 | 2>(1);

  const { gradeName, lessonName, unitName, outcomes, contents, totalWeeks, gradeSlug, lessonSlug, unitSlug, topicTitle, topicSlug } = initialData;

  const weeks = useMemo(() => {
    const max = Math.max(1, Math.min(52, totalWeeks || 30));
    const active = Number.isFinite(week) && week >= 1 ? week : 1;
    return Array.from({ length: max }, (_, i) => {
      const no = i + 1;
      const { start, end } = getAcademicWeekRange(no);
      return {
        no,
        isActive: no === active,
        isCompleted: no < active,
        start,
        end,
      };
    });
  }, [week, totalWeeks]);

  const activeWeekRange = useMemo(() => getAcademicWeekRange(week), [week]);
  const konuSayisi = contents?.length ?? 0;

  const dersBaslaHref = useMemo(() => {
    if (!gradeSlug || !lessonSlug || !unitSlug || !topicSlug) return null;
    return `/${gradeSlug}/${lessonSlug}/${unitSlug}/${topicSlug}`;
  }, [gradeSlug, lessonSlug, unitSlug, topicSlug]);

  const activeFont = useMemo(() => {
    if (fontScale === 0) return 'text-[15px] leading-7';
    if (fontScale === 2) return 'text-[19px] leading-8';
    return 'text-[17px] leading-7';
  }, [fontScale]);

  const handleSelectWeek = (weekNo: number) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set('sinif', gradeId);
    params.set('ders', lessonId);
    params.set('hafta', String(weekNo));
    router.push(`/ders?${params.toString()}`);
  };

  const handleFontDown = () => setFontScale((s) => (s === 0 ? 0 : ((s - 1) as 0 | 1 | 2)));
  const handleFontUp = () => setFontScale((s) => (s === 2 ? 2 : ((s + 1) as 0 | 1 | 2)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf7ff] via-[#f3f0ff] to-[#eef6ff]">
      <div className="flex min-h-screen">
        {/* Sol Sidebar - Haftalar */}
        <aside className="w-[320px] shrink-0 border-r border-default bg-white/70 backdrop-blur-xl">
          <div className="px-6 py-5 border-b border-default">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#6d28d9] via-[#7c3aed] to-[#2563eb] shadow-[0_10px_30px_-12px_rgba(99,102,241,0.55)] flex items-center justify-center text-white">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-default leading-5 truncate">Fen Bilimleri</div>
                <div className="text-xs text-muted leading-5 truncate">Haftalık plan</div>
              </div>
            </div>
          </div>

          <div className="px-3 py-4">
            <div
              className="max-h-[calc(100vh-88px)] overflow-y-auto pr-1"
              style={{ scrollbarWidth: 'thin' } satisfies CSSProperties}
            >
              <div className="space-y-2 px-3">
                {weeks.map((w) => (
                  <button
                    key={w.no}
                    onClick={() => handleSelectWeek(w.no)}
                    className={[
                      'w-full text-left rounded-2xl px-4 py-3 transition-all',
                      'border',
                      'hover:-translate-y-[1px] hover:shadow-[0_18px_40px_-24px_rgba(99,102,241,0.35)]',
                      w.isActive
                        ? 'bg-gradient-to-r from-[#2563eb] via-[#6d28d9] to-[#7c3aed] border-white/20 text-white shadow-[0_24px_60px_-26px_rgba(109,40,217,0.65)]'
                        : 'bg-[#f6f3ff] border-default text-default hover:bg-[#f1edff]',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={[
                          'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                          w.isCompleted
                            ? w.isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-emerald-500/15 text-emerald-600'
                            : w.isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-white text-muted border border-default',
                        ].join(' ')}
                      >
                        {w.isCompleted ? <Check className="h-4 w-4" /> : <span className="text-xs font-semibold">{w.no}</span>}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className={['font-semibold truncate', w.isActive ? 'text-white' : 'text-default'].join(' ')}>
                          Hafta {w.no}
                        </div>
                        <div className={['text-xs truncate', w.isActive ? 'text-white/80' : 'text-muted'].join(' ')}>
                          {formatTR(w.start)} – {formatTR(w.end)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Sağ İçerik Alanı */}
        <section className="flex-1 min-w-0">
          {/* Üst Header */}
          <div className="sticky top-0 z-10">
            <div className="mx-8 mt-6 rounded-2xl bg-white/85 backdrop-blur-xl border border-default shadow-[0_16px_50px_-30px_rgba(15,23,42,0.25)]">
              <div className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#6d28d9] via-[#8b5cf6] to-[#2563eb] flex items-center justify-center text-white shadow-[0_10px_30px_-14px_rgba(99,102,241,0.55)]">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-default leading-5 truncate">{lessonName || 'Fen Bilimleri'}</div>
                    <div className="text-xs text-muted leading-5 truncate">{gradeName || '5. Sınıf'}</div>
                  </div>
                </div>

                <div className="text-xs sm:text-sm font-semibold text-default whitespace-nowrap">
                  {week}. Hafta – {formatTR(activeWeekRange.start)} – {formatTRWithYear(activeWeekRange.end)}
                </div>
              </div>
            </div>
          </div>

          <main className="px-8 pb-16 pt-8">
            <div className="max-w-5xl mx-auto">
              {/* Başlık Alanı */}
              <div className="mb-8">
                <div className="text-4xl font-extrabold tracking-tight text-default">
                  {gradeName ? `${gradeName} ${lessonName}` : '5. Sınıf Fen Bilimleri'}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-[#6d28d9]/10 text-[#6d28d9] px-4 py-2 text-sm font-semibold">
                    {week}. hafta konuları
                  </span>
                  <span className="text-sm text-muted">
                    {konuSayisi} konu
                  </span>
                </div>
              </div>

              {/* İçerik Kartı */}
              <div className="relative rounded-[24px] bg-white border border-default shadow-[0_30px_80px_-55px_rgba(15,23,42,0.35)] overflow-hidden">
                {/* Sol accent */}
                <div className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-[#6d28d9] via-[#8b5cf6] to-[#2563eb]" />

                {/* Kart üst sağ kontroller */}
                <div className="absolute right-4 top-4 flex items-center gap-2">
                  <button
                    onClick={handleFontDown}
                    aria-label="Yazıyı küçült"
                    className="h-9 w-9 rounded-xl border border-default bg-white hover:bg-surface transition-colors flex items-center justify-center text-muted"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleFontUp}
                    aria-label="Yazıyı büyüt"
                    className="h-9 w-9 rounded-xl border border-default bg-white hover:bg-surface transition-colors flex items-center justify-center text-muted"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    aria-label="Diğer seçenekler"
                    className="h-9 w-9 rounded-xl border border-default bg-white hover:bg-surface transition-colors flex items-center justify-center text-muted"
                  >
                    <Ellipsis className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-8 pl-10">
                  <div className="space-y-6">
                    <div>
                      <div className="text-sm font-semibold text-muted">Ünite</div>
                      <div className="mt-1 text-xl font-bold text-default">
                        {unitName || 'Maddenin Doğası'}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-muted">Konu</div>
                      <div className="mt-1 text-lg font-semibold text-default">
                        {topicTitle || 'Konu'}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-muted">Öğrenme Çıktıları</div>
                      <div className={['mt-3 space-y-3', activeFont].join(' ')}>
                        {outcomes?.length ? (
                          <ol className="space-y-3">
                            {outcomes.map((o, idx) => (
                              <li key={o.id ?? idx} className="flex gap-3">
                                <span className="mt-[3px] inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#6d28d9]/10 text-[#6d28d9] text-sm font-bold shrink-0">
                                  {String.fromCharCode(97 + (idx % 26))}
                                </span>
                                <span className="text-default">{o.description}</span>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <ol className="space-y-3">
                            <li className="flex gap-3">
                              <span className="mt-[3px] inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#6d28d9]/10 text-[#6d28d9] text-sm font-bold shrink-0">
                                a
                              </span>
                              <span className="text-default">Isı yalıtımı ile ilgili model önerir.</span>
                            </li>
                            <li className="flex gap-3">
                              <span className="mt-[3px] inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#6d28d9]/10 text-[#6d28d9] text-sm font-bold shrink-0">
                                b
                              </span>
                              <span className="text-default">Yeni kanıtlarla modeli yeniler.</span>
                            </li>
                          </ol>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row gap-3">
                      {dersBaslaHref ? (
                        <Link
                          href={dersBaslaHref}
                          className="inline-flex items-center justify-center rounded-2xl px-7 py-4 font-bold text-white bg-gradient-to-r from-[#2563eb] via-[#6d28d9] to-[#7c3aed] shadow-[0_18px_50px_-24px_rgba(109,40,217,0.6)] hover:shadow-[0_22px_60px_-28px_rgba(109,40,217,0.7)] transition-shadow"
                        >
                          Derse Başla →
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center justify-center rounded-2xl px-7 py-4 font-bold text-white bg-gradient-to-r from-[#94a3b8] to-[#64748b] opacity-70 cursor-not-allowed"
                          title="Slug bilgileri eksik olduğu için yönlendirme yapılamadı."
                        >
                          Derse Başla →
                        </button>
                      )}

                      <div className="text-sm text-muted flex items-center">
                        Konu anlatımı ayrı sayfada gösterilecek.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alt CTA (mevcut test linki) */}
              <div className="mt-10 rounded-[24px] bg-white/70 backdrop-blur-xl border border-default p-8 shadow-[0_28px_70px_-55px_rgba(15,23,42,0.35)]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div>
                    <div className="text-xl font-bold text-default">Haftalık Test</div>
                    <div className="text-muted mt-1">
                      Çoktan seçmeli, boşluk doldurma, eşleştirme ve klasik soruların karıştığı test.
                    </div>
                  </div>
                  <Link
                    href={`/karisik-test?lesson_id=${lessonId}&week=${week}`}
                    className="inline-flex items-center justify-center rounded-2xl px-7 py-4 font-bold text-white bg-gradient-to-r from-[#2563eb] via-[#6d28d9] to-[#7c3aed] shadow-[0_18px_50px_-24px_rgba(109,40,217,0.6)] hover:shadow-[0_22px_60px_-28px_rgba(109,40,217,0.7)] transition-shadow"
                  >
                    Teste Başla →
                  </Link>
                </div>
              </div>
            </div>
          </main>
        </section>
      </div>
    </div>
  );
}
