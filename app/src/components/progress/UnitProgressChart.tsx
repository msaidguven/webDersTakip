'use client';

// Ders raporu: ünitelere göre başarı (2026-10-12, kullanıcı: "daha modern ve anlaşılır"). Her ünite TEK
// parçalı çubuk — çubuğun tamamı ünitenin soruları; yeşil doğru, kırmızı yanlış, gri çözülmemiş (son
// cevaplara göre). Böylece tamamlama ve başarı tek bakışta okunur. Başarı oranı rozeti en az
// MASTERY_RULES.minSolvedToJudge soruda; daha azında "veri az", hiç çözülmemişse "başlanmadı".
// Üniteye dokununca konuları AYNI biçimde açılır (kullanıcı kararı; eski ayrı "Tüm konular" bölümünün
// yerine) — konu satırına dokununca o konunun soru sayfası açılır. Tüm üniteler müfredat sırasıyla.
// Renk tek başına anlam taşımaz: rozet ve alt satır sayıları yazıyla verir.
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { MASTERY_RULES, type TopicMastery } from '@/app/src/lib/topicMastery';
import { accuracyTone, totalsOf, type Totals, type UnitReport } from '@/app/src/lib/lessonReports';

const PILL = {
  good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  mid: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  bad: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
  none: 'bg-surface-elevated text-muted-foreground',
} as const;

function Legend() {
  const items = [
    ['bg-emerald-500', 'Doğru'],
    ['bg-rose-500', 'Yanlış'],
    ['bg-slate-200 dark:bg-slate-700', 'Çözülmedi'],
  ] as const;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground">
      {items.map(([cls, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${cls}`} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}

function Pill({ totals }: { totals: Totals }) {
  const { solved, accuracy } = totals;
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-black tabular-nums ${PILL[accuracyTone(accuracy)]}`}>
      {solved === 0 ? 'başlanmadı' : accuracy == null ? 'veri az' : `%${accuracy} başarı`}
    </span>
  );
}

// Parçalı çubuk + "%43 tamamlandı · 17/40 soru | 8 doğru · 9 yanlış" — ünite ve konu satırında ortak.
function Progress({ totals, thin = false }: { totals: Totals; thin?: boolean }) {
  const { total, solved, correct } = totals;
  const wrong = solved - correct;
  return (
    <>
      <span
        className={`flex overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 ${thin ? 'h-2' : 'h-3'}`}
        role="img"
        aria-label={`${total} sorunun ${correct} doğru, ${wrong} yanlış, ${total - solved} çözülmedi`}
      >
        <span className="h-full bg-emerald-500" style={{ width: `${(correct / total) * 100}%` }} />
        <span className="h-full bg-rose-500" style={{ width: `${(wrong / total) * 100}%` }} />
      </span>
      <span className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          <strong className="font-bold text-default">%{Math.round((solved / total) * 100)}</strong> tamamlandı · {solved}/{total} soru
        </span>
        <span className="tabular-nums">
          {correct} doğru · {wrong} yanlış
        </span>
      </span>
    </>
  );
}

function TopicRow({ t }: { t: TopicMastery }) {
  if (t.total === 0) {
    return (
      <li className="flex items-start justify-between gap-3 py-3">
        <span className="min-w-0 text-sm font-semibold leading-snug text-muted-foreground">{t.title}</span>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">Soruları hazırlanıyor</span>
      </li>
    );
  }
  const totals = totalsOf([t]);
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-sm font-semibold leading-snug text-default">{t.title}</span>
        <span className="flex shrink-0 items-center gap-1">
          <Pill totals={totals} />
          {t.href && <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        </span>
      </span>
      <Progress totals={totals} thin />
    </>
  );
  // Satırın tamamı konunun soru sayfasına gider (ayrı "Çöz" düğmesi mobilde başlığı 3 satıra bölüyordu).
  return (
    <li>
      {t.href ? (
        <Link href={t.href} aria-label={`${t.title} sorularını çöz`} className="-mx-3 flex flex-col gap-1.5 rounded-lg px-3 py-3 transition-colors hover:bg-surface-elevated sm:-mx-4 sm:px-4">
          {body}
        </Link>
      ) : (
        <div className="flex flex-col gap-1.5 py-3">{body}</div>
      )}
    </li>
  );
}

function UnitRow({ u }: { u: UnitReport }) {
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-col gap-2 rounded-xl py-3.5 [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0 text-[15px] font-bold leading-snug text-default">{u.title}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              <Pill totals={u.totals} />
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
            </span>
          </span>
          <Progress totals={u.totals} />
        </summary>
        <ul className="mb-3 flex flex-col divide-y divide-[var(--border)] rounded-xl bg-surface px-3 sm:px-4">
          {u.topics.map((t) => (
            <TopicRow key={t.id} t={t} />
          ))}
        </ul>
      </details>
    </li>
  );
}

export function UnitProgressChart({ units }: { units: UnitReport[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-default p-4 sm:p-5">
      <Legend />
      <ul className="flex flex-col divide-y divide-[var(--border)]">
        {units.map((u) => (
          <UnitRow key={u.key} u={u} />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Konularını görmek için üniteye, soru çözmek için konuya dokun. Başarı oranı, son cevaplarına göre doğru / çözülen soru; {MASTERY_RULES.minSolvedToJudge} sorudan azında oran verilmez.
      </p>
    </div>
  );
}
