'use client';

// Admin "Site Gelişimi" için günlük sütun çizelgesi (2026-10-25). Kütüphanesiz, HTML/CSS: tek eksen,
// 1-2 seri üst üste (yığılmış), seriler arası 2px boşluk, üstte 4px yuvarlak uç. Sütunun tamamı
// fareyle/klavyeyle odaklanınca ipucu gösterir; aynı veri "Tablo olarak gör" ile tablo halinde de var.
// Renkler doğrulandı (dataviz validate_palette): açık #0891B2/#3B5BFD (yüzey #F8FAFC),
// karanlık #0AA6C2/#6E78F7 (yüzey #121A28) — CVD ayrımı ve kontrast geçiyor.
import { useState } from 'react';

export type ChartSeries = { label: string; className: string };
export type ChartPoint = { day: string; values: number[] };

export const SERIES_COLORS = [
  'bg-[#0891B2] dark:bg-[#0AA6C2]',
  'bg-[#3B5BFD] dark:bg-[#6E78F7]',
] as const;

const fmtDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
const fmtDayLong = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });

// Eksen üst sınırı: 1-2-5 dizisinde en küçük "yuvarlak" sayı.
function niceMax(v: number): number {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * pow >= v) ?? 10) * pow;
}

// showTotals: göstergede dönem toplamı. Günlük tekil sayılarda (siteye giren öğrenci) toplam anlamsız —
// aynı öğrenci her gün yeniden sayılır — orada kapalı.
export function DailyBarChart({ title, description, series, data, showTotals = true }: { title: string; description?: string; series: ChartSeries[]; data: ChartPoint[]; showTotals?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map((d) => d.values.reduce((a, b) => a + b, 0));
  const max = niceMax(Math.max(0, ...totals));
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  const sum = series.map((_, si) => data.reduce((a, d) => a + (d.values[si] ?? 0), 0));
  const active = hover !== null ? data[hover] : null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {series.length > 1 && (
          <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Gösterge">
            {series.map((s, si) => (
              <li key={s.label} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-sm ${s.className}`} aria-hidden="true" />
                {s.label} {showTotals && <span className="tabular-nums text-foreground">{sum[si]}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* İpucu: sabit yükseklikte satır, çizelge kaymasın. */}
      <p className="mt-3 h-5 text-xs text-muted-foreground" aria-live="polite">
        {active ? (
          <>
            <span className="font-semibold text-foreground">{fmtDayLong(active.day)}</span>
            {series.map((s, si) => (
              <span key={s.label}> · {s.label}: <span className="tabular-nums text-foreground">{active.values[si] ?? 0}</span></span>
            ))}
          </>
        ) : (
          'Bir güne gel ya da dokun, sayısını gör.'
        )}
      </p>

      <div className="relative mt-2 h-44 pl-8">
        {[1, 0.5, 0].map((f) => (
          <div key={f} className="absolute left-8 right-0 border-t border-border/60" style={{ bottom: `${f * 100}%` }}>
            <span className="absolute -left-8 -top-2 w-7 text-right text-[10px] tabular-nums text-muted-foreground">{Math.round(max * f)}</span>
          </div>
        ))}
        <div className="relative flex h-full items-end gap-px" onMouseLeave={() => setHover(null)}>
          {data.map((d, i) => {
            const topIndex = d.values.reduce((last, v, si) => (v > 0 ? si : last), -1);
            return (
            <button
              key={d.day}
              type="button"
              className={`flex h-full min-w-0 flex-1 flex-col-reverse items-stretch gap-[2px] rounded-sm px-[1px] outline-none focus-visible:bg-accent ${hover === i ? 'bg-accent/70' : ''}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => setHover(i)}
              aria-label={`${fmtDayLong(d.day)}: ${series.map((s, si) => `${s.label} ${d.values[si] ?? 0}`).join(', ')}`}
            >
              {d.values.map((v, si) =>
                v > 0 ? (
                  <span
                    key={si}
                    className={`block w-full ${series[si].className} ${si === topIndex ? 'rounded-t-[4px]' : ''}`}
                    style={{ height: `${(v / max) * 100}%` }}
                  />
                ) : null
              )}
            </button>
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex pl-8 text-[10px] text-muted-foreground" aria-hidden="true">
        {data.map((d, i) => (
          <span key={d.day} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
            {i % labelEvery === 0 ? fmtDay(d.day) : ''}
          </span>
        ))}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Tablo olarak gör</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="py-1 pr-3 font-medium">Gün</th>
                {series.map((s) => (
                  <th key={s.label} scope="col" className="py-1 pr-3 text-right font-medium">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.day} className="border-t border-border">
                  <th scope="row" className="py-1 pr-3 text-left font-normal text-foreground">{fmtDay(d.day)}</th>
                  {series.map((s, si) => (
                    <td key={s.label} className="py-1 pr-3 text-right tabular-nums text-foreground">{d.values[si] ?? 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
