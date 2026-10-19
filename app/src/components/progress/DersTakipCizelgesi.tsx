'use client';

// Ders takip çizelgesi (herkese açık sayfanın etkileşimli kısmı). Giriş yapmamış ziyaretçi boş
// çizelgeyi (0 soru) görür ve giriş yapmaya yönlendirilir; giriş yapan öğrenci kendi verisini görür.
// Alt kısım: sınıf + ay seçilip PDF olarak indirilebilen boş çizelge.
import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { useTopicMastery } from '@/app/src/hooks/useTopicMastery';
import { useMonthlyActivity } from '@/app/src/hooks/useMonthlyActivity';
import { istanbulToday } from '@/app/src/lib/progressActivity';
import {
  daysInMonth,
  monthLabel,
  schoolYearMonths,
  shiftMonth,
  summarizeMonth,
} from '@/app/src/lib/monthlyActivity';
import { MonthlySummary } from './MonthlySummary';
import { MonthlyTable } from './MonthlyTable';
import { PrintableSheet } from './PrintableSheet';

export interface PublicGrade {
  id: number;
  name: string;
  slug: string;
}

const PAGE_PATH = '/ders-takip-cizelgesi';
const EMPTY_SUMMARY = summarizeMonth([]);

function shortMonth(month: string): string {
  return monthLabel(month).split(' ')[0];
}

export function DersTakipCizelgesi({ grades }: { grades: PublicGrade[] }) {
  const { user, loading } = useAuth();
  const today = istanbulToday();
  const currentMonth = today.slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const { data: mastery, error: masteryError } = useTopicMastery();
  const { data: rows, error, isLoading } = useMonthlyActivity(month);

  const [gradeId, setGradeId] = useState<number | null>(grades[0]?.id ?? null);
  const grade = grades.find((g) => g.id === gradeId) ?? null;
  const months = schoolYearMonths(today);
  const [printMonth, setPrintMonth] = useState(months.includes(currentMonth) ? currentMonth : months[0]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  const lessons = (mastery?.lessons ?? []).map((l) => ({ id: l.id, name: l.name }));

  async function downloadPdf() {
    if (!grade) return;
    setPdfBusy(true);
    setPdfError(false);
    try {
      // PDF kütüphanesi ve font yalnız indirmede yüklenir; sayfanın ilk paketini büyütmez.
      const { buildMonthlySheetPdf } = await import('@/app/src/lib/cizelgePdf');
      const bytes = await buildMonthlySheetPdf(`${grade.name} · ${monthLabel(printMonth)}`, daysInMonth(printMonth));
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${grade.slug}-ders-takip-cizelgesi-${printMonth}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setPdfError(true);
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <section aria-labelledby="cizelge-baslik" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cizelge-baslik" className="text-2xl font-black tracking-tight text-default sm:text-3xl">
          Aylık çizelge
        </h2>
        <MonthNav month={month} currentMonth={currentMonth} onChange={setMonth} />
      </div>

      {loading ? (
        <div aria-busy="true" className="h-96 animate-pulse rounded-2xl bg-surface-elevated" />
      ) : !user ? (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-500/30 dark:bg-indigo-500/10 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex flex-col gap-1">
              <p className="font-extrabold text-default">Çizelgeni online doldur</p>
              <p className="text-sm text-muted-foreground">
                Giriş yaptığında çözdüğün her soru otomatik işlenir. Ay sonunda derslere göre doğru ve yanlış toplamların hazır olur.
              </p>
            </div>
            <Link
              href={`/login?redirectTo=${PAGE_PATH}`}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-sm font-bold text-white hover:shadow-lg hover:shadow-indigo-500/30"
            >
              Giriş yap
            </Link>
          </div>
          <MonthlySummary summary={EMPTY_SUMMARY} />
          <SheetPreview month={month} gradeName={grade?.name ?? null} />
        </>
      ) : error || masteryError ? (
        <p role="alert" className="rounded-2xl border border-default bg-surface p-4 text-sm text-muted-foreground">
          Çizelge şu an yüklenemedi. Sayfayı yenilemeyi dene.
        </p>
      ) : isLoading || mastery === undefined ? (
        <div aria-busy="true" aria-label="Çizelge yükleniyor" className="h-96 animate-pulse rounded-2xl bg-surface-elevated" />
      ) : (
        <>
          <MonthlySummary summary={summarizeMonth(rows ?? [])} />
          <MonthlyTable month={month} lessons={lessons} rows={rows ?? []} />
        </>
      )}

      <div className="flex flex-col gap-4 rounded-2xl border border-default bg-background p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-extrabold text-default">Yazdırılabilir çizelge (PDF)</h3>
          <p className="text-sm text-muted-foreground">
            Sınıfını ve ayını seç, çizelgeyi PDF olarak indir. Dersleri kendin yazabilirsin.
          </p>
        </div>

        {grades.length === 0 ? (
          <p className="text-sm text-muted-foreground">Şu an çizelge için sınıf bulunmuyor.</p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm font-bold text-default sm:max-w-xs">
              Sınıf
              <select
                value={gradeId ?? ''}
                onChange={(e) => setGradeId(Number(e.target.value))}
                className="rounded-xl border border-default bg-background px-3 py-2 font-medium"
              >
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>

            <div role="group" aria-label="Ay önizlemeleri" className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {months.map((m) => {
                const selected = m === printMonth;
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPrintMonth(m)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition-colors ${
                      selected ? 'border-indigo-500 bg-indigo-50 text-default dark:bg-indigo-500/10' : 'border-default text-muted-foreground hover:border-indigo-400'
                    }`}
                  >
                    <MiniPreview />
                    {shortMonth(m)}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              <div className="overflow-x-auto rounded-xl border border-default">
                <PrintableSheet title={`${grade?.name ?? ''} · ${monthLabel(printMonth)}`} days={daysInMonth(printMonth)} />
              </div>
              <button
                type="button"
                onClick={downloadPdf}
                disabled={pdfBusy}
                className="inline-flex w-fit items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-sm font-bold text-white hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-60"
              >
                <Download className="h-4 w-4" aria-hidden="true" /> {pdfBusy ? 'Hazırlanıyor…' : 'PDF indir'}
              </button>
              {pdfError && (
                <p role="alert" className="text-sm text-muted-foreground">
                  PDF hazırlanamadı. Tekrar dene.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function MonthNav({ month, currentMonth, onChange }: { month: string; currentMonth: string; onChange: (m: string) => void }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Ay seçimi">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label="Önceki ay"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-default bg-background text-default hover:border-indigo-400"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <span className="min-w-[10rem] text-center text-base font-extrabold text-default" aria-live="polite">
        {monthLabel(month)}
      </span>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        disabled={month >= currentMonth}
        aria-label="Sonraki ay"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-default bg-background text-default hover:border-indigo-400 disabled:opacity-40"
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

// Giriş yapmamış ziyaretçiye boş ekran: seçilen ayın gün satırları, ders adları boş.
function SheetPreview({ month, gradeName }: { month: string; gradeName: string | null }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-default">
      <PrintableSheet title={`${gradeName ?? ''} · ${monthLabel(month)}`} days={daysInMonth(month)} />
    </div>
  );
}

function MiniPreview() {
  return (
    <span aria-hidden="true" className="grid grid-cols-6 gap-px rounded-sm bg-neutral-300 p-px">
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className="h-1.5 w-1.5 bg-white" />
      ))}
    </span>
  );
}
