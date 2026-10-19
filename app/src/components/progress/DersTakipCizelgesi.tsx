'use client';

// Ders takip çizelgesi (herkese açık sayfanın etkileşimli kısmı). Giriş yapmamış ziyaretçi giriş
// çağrısını görür; giriş yapan öğrenci genel durumunu (tüm zamanlar, ders ders) ve seçtiği ayın
// çizelgesini görür. Alt kısım: sınıf + ay seçilip PDF olarak indirilebilen boş çizelge.
// Görünüm: robotik tema (kök sınıf sayfada, bkz. app/ders-takip-cizelgesi/page.tsx).
import { useState } from 'react';
import Link from 'next/link';
import { ChartColumn, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { useTopicMastery } from '@/app/src/hooks/useTopicMastery';
import { useMonthlyActivity } from '@/app/src/hooks/useMonthlyActivity';
import { istanbulToday } from '@/app/src/lib/progressActivity';
import { MASTERY_RULES, type LessonMastery } from '@/app/src/lib/topicMastery';
import { daysInMonth, monthLabel, schoolYearMonths, shiftMonth, summarizeMonth } from '@/app/src/lib/monthlyActivity';
import { MonthlyTable } from './MonthlyTable';
import { PrintableSheet } from './PrintableSheet';
import r from '../robotic/robotic.module.css';

export interface PublicGrade {
  id: number;
  name: string;
  slug: string;
}

const PAGE_PATH = '/ders-takip-cizelgesi';
const card = `rounded-[22px] ${r.panel}`;

function shortMonth(month: string): string {
  return monthLabel(month).split(' ')[0];
}

function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

export function DersTakipCizelgesi({ grades }: { grades: PublicGrade[] }) {
  const { user, loading } = useAuth();

  return (
    <>
      {loading ? (
        <div aria-busy="true" className="h-64 animate-pulse rounded-[22px] bg-surface-elevated" />
      ) : user ? (
        <MemberSummary />
      ) : (
        <section aria-label="Online çizelge" className={`${card} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7`}>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-extrabold text-default">Çizelgeni online doldur</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Giriş yaptığında çözdüğün her soru otomatik işlenir. Ay sonunda derslere göre doğru ve yanlış toplamların hazır olur.
            </p>
          </div>
          <Link
            href={`/login?redirectTo=${PAGE_PATH}`}
            className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl px-5 text-sm font-bold ${r.btnNeon} ${r.btnText}`}
          >
            Giriş yap
          </Link>
        </section>
      )}

      <PrintableSection grades={grades} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 p-3 sm:p-4 ${r.stat}`}>
      <span className="truncate text-xs font-semibold text-muted-foreground">{label}</span>
      <span className={`whitespace-nowrap text-xl sm:text-2xl ${r.statValue}`}>{value}</span>
    </div>
  );
}

function MemberSummary() {
  const currentMonth = istanbulToday().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const { data: mastery, error: masteryError } = useTopicMastery();
  const { data: rows, error, isLoading } = useMonthlyActivity(month);

  if (error || masteryError) {
    return (
      <p role="alert" className={`${card} p-5 text-sm text-muted-foreground`}>
        Çizelge şu an yüklenemedi. Sayfayı yenilemeyi dene.
      </p>
    );
  }

  const lessons = mastery?.lessons ?? [];
  const summary = summarizeMonth(rows ?? []);

  return (
    <>
      {mastery === undefined ? (
        <div aria-busy="true" aria-label="Genel durum yükleniyor" className="h-48 animate-pulse rounded-[22px] bg-surface-elevated" />
      ) : (
        lessons.length > 0 && <OverallSummary lessons={lessons} />
      )}

      <section aria-labelledby="cizelge-baslik" className={`${card} flex min-w-0 flex-col gap-5 p-5 sm:p-7`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="cizelge-baslik" className="text-lg font-extrabold text-default">
            Aylık çizelgen
          </h2>
          <MonthNav month={month} currentMonth={currentMonth} onChange={setMonth} />
        </div>
        {isLoading || mastery === undefined ? (
          <div aria-busy="true" aria-label="Çizelge yükleniyor" className="h-96 animate-pulse rounded-2xl bg-surface-elevated" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Toplam soru" value={String(summary.answered)} />
              <Stat label="Doğru" value={String(summary.correct)} />
              <Stat label="Yanlış" value={String(summary.wrong)} />
              <Stat label="Başarı oranı" value={summary.accuracy == null ? '—' : `%${summary.accuracy}`} />
              <Stat label="Aktif gün" value={String(summary.activeDays)} />
            </div>
            <MonthlyTable month={month} lessons={lessons.map((l) => ({ id: l.id, name: l.name }))} rows={rows ?? []} />
          </>
        )}
      </section>
    </>
  );
}

// Tüm zamanlar: ders ders çözülen / toplam soru, doğruluk ve öğrenilen konu; satır ders raporuna gider.
function OverallSummary({ lessons }: { lessons: LessonMastery[] }) {
  const all = lessons.flatMap((l) => l.topics);
  const solved = all.reduce((s, t) => s + t.solved, 0);
  const correct = all.reduce((s, t) => s + t.correct, 0);
  const learned = lessons.reduce((s, l) => s + l.counts.learned, 0);
  const accuracy = solved >= MASTERY_RULES.minSolvedToJudge ? percent(correct, solved) : null;

  return (
    <section aria-labelledby="genel-durum" className={`${card} flex flex-col gap-5 p-5 sm:p-7`}>
      <div className="flex flex-col gap-1">
        <span className={r.label}>Tüm çalışmaların</span>
        <h2 id="genel-durum" className="text-lg font-extrabold text-default">
          Genel durumun
        </h2>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Çözülen soru" value={String(solved)} />
        <Stat label="Başarı oranı" value={accuracy == null ? '—' : `%${accuracy}`} />
        <Stat label="Öğrenilen konu" value={String(learned)} />
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {lessons.map((l) => (
          <li key={l.id}>
            <LessonRow lesson={l} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LessonRow({ lesson }: { lesson: LessonMastery }) {
  const total = lesson.topics.reduce((s, t) => s + t.total, 0);
  const solved = lesson.topics.reduce((s, t) => s + t.solved, 0);
  const correct = lesson.topics.reduce((s, t) => s + t.correct, 0);
  const done = percent(solved, total) ?? 0;
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-[15px] font-bold text-default">{lesson.name}</span>
        {lesson.slug && <ChartColumn className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      </span>
      <span className={r.track} role="img" aria-label={`${total} sorunun ${solved} tanesi çözüldü`}>
        <span className={`block ${r.fill}`} style={{ width: `${done}%` }} />
      </span>
      <span className="flex flex-wrap justify-between gap-x-3 text-xs tabular-nums text-muted-foreground">
        <span>
          {solved}/{total} soru
        </span>
        <span>
          {correct} doğru · {solved - correct} yanlış · {lesson.counts.learned} konu öğrenildi
        </span>
      </span>
    </>
  );
  const cls = `flex flex-col gap-2.5 rounded-2xl p-4 ${r.item}`;
  return lesson.slug ? (
    <Link href={`/ilerlemem/${lesson.slug}`} aria-label={`${lesson.name} raporunu göster`} className={`${cls} hover:-translate-y-0.5`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function PrintableSection({ grades }: { grades: PublicGrade[] }) {
  const today = istanbulToday();
  const currentMonth = today.slice(0, 7);
  const months = schoolYearMonths(today);
  const [gradeId, setGradeId] = useState<number | null>(grades[0]?.id ?? null);
  const grade = grades.find((g) => g.id === gradeId) ?? null;
  const [printMonth, setPrintMonth] = useState(months.includes(currentMonth) ? currentMonth : months[0]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState(false);

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
    <section aria-labelledby="yazdirilabilir" className={`${card} flex min-w-0 flex-col gap-5 p-5 sm:p-7`}>
      <div className="flex flex-col gap-1">
        <h2 id="yazdirilabilir" className="text-lg font-extrabold text-default">
          Yazdırılabilir çizelge (PDF)
        </h2>
        <p className="text-sm text-muted-foreground">Sınıfını ve ayını seç, çizelgeyi PDF olarak indir. Dersleri kendin yazabilirsin.</p>
      </div>

      {grades.length === 0 ? (
        <p className="text-sm text-muted-foreground">Şu an çizelge için sınıf bulunmuyor.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground sm:w-44">
              Sınıf
              <select
                value={gradeId ?? ''}
                onChange={(e) => setGradeId(Number(e.target.value))}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${r.item}`}
              >
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <div role="group" aria-label="Ay" className={r.tabs}>
              {months.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={m === printMonth}
                  onClick={() => setPrintMonth(m)}
                  className={`${r.tab} ${m === printMonth ? r.tabActive : ''}`}
                >
                  {shortMonth(m)}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[28rem] overflow-auto rounded-xl border border-default">
            <PrintableSheet title={`${grade?.name ?? ''} · ${monthLabel(printMonth)}`} days={daysInMonth(printMonth)} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={downloadPdf}
              disabled={pdfBusy}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold disabled:opacity-60 ${r.btnNeon} ${r.btnText}`}
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
    </section>
  );
}

function MonthNav({ month, currentMonth, onChange }: { month: string; currentMonth: string; onChange: (m: string) => void }) {
  const btn = `flex h-9 w-9 items-center justify-center rounded-xl disabled:opacity-40 ${r.item} ${r.itemHover}`;
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Ay seçimi">
      <button type="button" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Önceki ay" className={btn}>
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <span className={`min-w-[9rem] text-center text-sm font-semibold text-default ${r.mono}`} aria-live="polite">
        {monthLabel(month)}
      </span>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        disabled={month >= currentMonth}
        aria-label="Sonraki ay"
        className={btn}
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
