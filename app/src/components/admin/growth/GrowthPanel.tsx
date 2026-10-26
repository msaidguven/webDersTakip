'use client';

// Admin "Site Gelişimi" paneli (2026-10-25): /api/admin/growth (admin_growth_stats RPC) tek istek.
// Özet kutuları önceki eş dönemle karşılaştırılır; çizelgeler günlük; listeler kayıt kaynağı + sınıf.
import { useEffect, useState } from 'react';
import { DailyBarChart, SERIES_COLORS } from './DailyBarChart';

type Count = { label: string; count: number };
type Day = {
  day: string;
  new_students: number;
  new_teachers: number;
  active_new: number;
  active_returning: number;
  answers: number;
  tests_started: number;
  tests_completed: number;
};
type Growth = {
  days: number;
  today: string;
  tracking_since: string;
  totals: {
    members: number;
    students: number;
    teachers: number;
    new_period: number;
    new_prev: number;
    active_today: number;
    active_7d: number;
    active_7d_prev: number;
    active_period: number;
    answers_period: number;
    answers_prev: number;
    daily_q_period: number;
    daily_q_guest_period: number;
    retention_cohort: number;
    retention_returned: number;
  };
  series: Day[];
  acquisition: { with_data: number; new_in_period: number; sources: Count[]; landing_pages: Count[]; devices: Count[]; methods: Count[] };
  grades: Count[];
};

const PERIODS = [
  { days: 30, label: 'Son 30 gün' },
  { days: 90, label: 'Son 90 gün' },
];

const LABELS: Record<string, string> = {
  mobile: 'Telefon',
  desktop: 'Bilgisayar',
  tablet: 'Tablet',
  email: 'E-posta',
  google: 'Google ile',
  bilinmiyor: 'Bilinmiyor',
};

// Önceki dönem çok küçükse yüzde yanıltır (5 → 1.327 "%26440") — sayıyı göster.
const MIN_BASE_FOR_PERCENT = 20;

function Delta({ now, prev }: { now: number; prev: number }) {
  if (prev === 0 && now === 0) return null;
  if (prev < MIN_BASE_FOR_PERCENT) {
    return <span className="text-xs text-muted-foreground">önceki dönem: {prev.toLocaleString('tr-TR')}</span>;
  }
  const pct = Math.round(((now - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span className={`text-xs font-medium ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
      {up ? '▲' : '▼'} %{Math.abs(pct)} <span className="font-normal text-muted-foreground">önceki döneme göre</span>
    </span>
  );
}

function Tile({ label, value, hint, children }: { label: string; value: string | number; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CountList({ title, items, note }: { title: string; items: Count[]; note?: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-label={title}>
      <h2 className="font-semibold text-foreground">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Henüz veri yok.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((i) => (
            <li key={i.label} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-foreground" title={i.label}>{LABELS[i.label] ?? i.label}</span>
                <span className="tabular-nums text-muted-foreground">{i.count}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden="true">
                <div className={`h-full rounded-full ${SERIES_COLORS[0]}`} style={{ width: `${(i.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function GrowthPanel() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Growth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/growth?days=${days}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Veri alınamadı');
        return json as Growth;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const loading = !data || data.days !== days;
  const t = data?.totals;
  const retention = t && t.retention_cohort > 0 ? Math.round((t.retention_returned / t.retention_cohort) * 100) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Dönem" className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              aria-pressed={p.days === days}
              onClick={() => setDays(p.days)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${p.days === days ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {data && (
          <p className="text-xs text-muted-foreground">
            Yalnız üyeler (admin hariç). Siteye giriş verisi {new Date(`${data.tracking_since}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} tarihinden beri tutuluyor.
          </p>
        )}
      </div>

      {error && <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

      {loading && !error ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : data && t ? (
        <>
          <section aria-label="Özet" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Tile label="Toplam üye" value={t.members} hint={`${t.students} öğrenci · ${t.teachers} öğretmen`} />
            <Tile label={`Yeni üye (${days} gün)`} value={t.new_period}>
              <Delta now={t.new_period} prev={t.new_prev} />
            </Tile>
            <Tile label="Bugün siteye giren öğrenci" value={t.active_today} />
            <Tile label="Son 7 günde giren öğrenci" value={t.active_7d}>
              <Delta now={t.active_7d} prev={t.active_7d_prev} />
            </Tile>
            <Tile label={`Çözülen soru (${days} gün)`} value={t.answers_period.toLocaleString('tr-TR')}>
              <Delta now={t.answers_period} prev={t.answers_prev} />
            </Tile>
            <Tile
              label="Geri dönüş oranı"
              value={retention === null ? '—' : `%${retention}`}
              hint={
                retention === null
                  ? 'Kayıttan 7 gün geçmiş yeni üye yok.'
                  : `Kayıttan sonraki 7 gün içinde tekrar gelen: ${t.retention_returned}/${t.retention_cohort} yeni öğrenci`
              }
            />
          </section>

          <DailyBarChart
            title="Yeni üye / gün"
            series={[
              { label: 'Öğrenci', className: SERIES_COLORS[0] },
              { label: 'Öğretmen', className: SERIES_COLORS[1] },
            ]}
            data={data.series.map((d) => ({ day: d.day, values: [d.new_students, d.new_teachers] }))}
          />
          <DailyBarChart
            title="Siteye giren öğrenci / gün"
            description="O gün en az bir sayfa açan öğrenciler. Yeni: o gün kayıt olan · Geri dönen: daha önce kayıt olmuş."
            series={[
              { label: 'Geri dönen', className: SERIES_COLORS[0] },
              { label: 'Yeni', className: SERIES_COLORS[1] },
            ]}
            data={data.series.map((d) => ({ day: d.day, values: [d.active_returning, d.active_new] }))}
            showTotals={false}
          />
          <DailyBarChart
            title="Çözülen soru / gün"
            description={`Testlerde verilen cevaplar. Dönemde ${data.series.reduce((a, d) => a + d.tests_started, 0)} test başlatıldı, ${data.series.reduce((a, d) => a + d.tests_completed, 0)} test bitirildi.`}
            series={[{ label: 'Cevap', className: SERIES_COLORS[0] }]}
            data={data.series.map((d) => ({ day: d.day, values: [d.answers] }))}
          />

          <section aria-label="Günün sorusu" className="grid grid-cols-2 gap-3">
            <Tile label={`Günün sorusu cevabı (${days} gün)`} value={t.daily_q_period} hint="Anasayfadaki günün sorusu" />
            <Tile label="…bunlardan misafir" value={t.daily_q_guest_period} hint="Giriş yapmadan cevaplayan — misafir ilgisinin tek izi" />
          </section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CountList
              title="Üyeler nereden geliyor?"
              items={data.acquisition.sources}
              note={`Dönemde kayıt olan ${data.acquisition.new_in_period} üyeden ${data.acquisition.with_data} tanesinin kaynağı biliniyor.`}
            />
            <CountList title="Kayıt öncesi ilk açılan sayfa" items={data.acquisition.landing_pages} />
            <CountList title="Cihaz" items={data.acquisition.devices} />
            <CountList
              title="Kayıt yöntemi"
              items={data.acquisition.methods}
              note="Dönemde kayıt olan üyeler. Bilinmiyor: bu bilgi tutulmaya başlamadan önceki kayıtlar."
            />
            <CountList title="Sınıflara göre öğrenci" items={data.grades} note="Tüm öğrenciler." />
          </div>
        </>
      ) : null}
    </div>
  );
}
