'use client';

// Admin "Site Gelişimi" içindeki Saatlik Ziyaretçi & Üye Trafiği bloğu.
// GrowthPanel.tsx ile aynı kart/renk/tipografi dilini paylaşır.
import { SERIES_COLORS } from './DailyBarChart';

export type TrafficDeviceRow = { label: string; count: number; members: number; guests: number };
export type TrafficCountRow = { label: string; count: number };
export type TrafficLandingRow = { label: string; total: number; mobile: number; tablet: number; desktop: number };
export type TrafficHourRow = { hour: number; mobile: number; tablet: number; desktop: number };

export type TrafficStats = {
  tracking_since: string | null;
  total: number;
  prev_total: number;
  members: number;
  guests: number;
  by_device: TrafficDeviceRow[];
  by_app_mode: TrafficCountRow[];
  by_source: TrafficCountRow[];
  by_landing: TrafficLandingRow[];
  by_hour: TrafficHourRow[];
};

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Telefon',
  desktop: 'Bilgisayar',
  tablet: 'Tablet',
};

const APP_MODE_LABELS: Record<string, string> = {
  browser: 'Normal tarayıcı',
  pwa: 'Ana ekrana eklenen (PWA)',
  in_app: 'Uygulama içi tarayıcı (Instagram/WA vb.)',
};

const SOURCE_LABELS: Record<string, string> = {
  google: 'Google',
  direct: 'Doğrudan',
  social: 'Sosyal medya',
  other_search: 'Diğer arama motoru',
  referral: 'Diğer siteler',
};

const LANDING_LABELS: Record<string, string> = {
  anasayfa: 'Anasayfa',
  'ders-konu': 'Ders & Konu Anlatımı',
  'soru-bankasi': 'Soru Bankası / Test',
  yazili: 'Yazılı Soruları',
  'takdir-hesaplama': 'Takdir / Teşekkür',
  'kavram-avi': 'Kavram Avı',
  diger: 'Diğer sayfalar',
};

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function SimpleList({
  title,
  items,
  labels,
  total,
}: {
  title: string;
  items: TrafficCountRow[];
  labels: Record<string, string>;
  total: number;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-label={title}>
      <h3 className="font-semibold text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Henüz veri yok.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {items.map((i) => (
            <li key={i.label} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-foreground">{labels[i.label] ?? i.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {i.count.toLocaleString('tr-TR')} <span className="text-xs">(%{pct(i.count, total)})</span>
                </span>
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

export function TrafficSection({ traffic, days }: { traffic: TrafficStats; days: number }) {
  const mobileRow = traffic.by_device.find((d) => d.label === 'mobile');
  const mobileCount = mobileRow?.count ?? 0;
  const maxHourTotal = Math.max(1, ...traffic.by_hour.map((h) => h.mobile + h.tablet + h.desktop));

  return (
    <section aria-label="Ziyaretçi ve Üye Trafiği" className="flex flex-col gap-4 pt-2 border-t border-border">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-foreground">Ziyaretçi & Üye Trafiği (Saatlik Tekil)</h2>
          <p className="text-xs text-muted-foreground">
            Her ziyaretçi saatte en fazla 1 kez sayılır (admin, test hesapları ve botlar hariç).
          </p>
        </div>
        {traffic.tracking_since && (
          <p className="text-xs text-muted-foreground">
            Başlangıç: {new Date(`${traffic.tracking_since}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* 4'lü özet kutusu */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Saatlik ziyaret ({days} gün)</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">{traffic.total.toLocaleString('tr-TR')}</p>
          {traffic.prev_total > 0 && (
            <p className="text-xs text-muted-foreground">önceki dönem: {traffic.prev_total.toLocaleString('tr-TR')}</p>
          )}
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Misafir</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">{traffic.guests.toLocaleString('tr-TR')}</p>
          <p className="text-xs text-muted-foreground">%{pct(traffic.guests, traffic.total)} toplam trafik</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Üye</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">{traffic.members.toLocaleString('tr-TR')}</p>
          <p className="text-xs text-muted-foreground">%{pct(traffic.members, traffic.total)} toplam trafik</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Telefon (Mobil) payı</p>
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {traffic.total > 0 ? `%${pct(mobileCount, traffic.total)}` : '—'}
          </p>
          <p className="text-xs text-muted-foreground">{mobileCount.toLocaleString('tr-TR')} saatlik ziyaret</p>
        </div>
      </div>

      {/* Cihaz × Üye/Misafir kırılımı */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="Cihaz dağılımı">
          <h3 className="font-semibold text-foreground">Cihaz Dağılımı (Üye vs Misafir)</h3>
          {traffic.by_device.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Henüz veri yok.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {traffic.by_device.map((d) => {
                const max = Math.max(1, ...traffic.by_device.map((x) => x.count));
                return (
                  <li key={d.label} className="text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-foreground">{DEVICE_LABELS[d.label] ?? d.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {d.count.toLocaleString('tr-TR')} <span className="text-xs">(%{pct(d.count, traffic.total)})</span>
                      </span>
                    </div>
                    <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div
                        className={SERIES_COLORS[0]}
                        style={{ width: `${(d.members / max) * 100}%` }}
                        title={`Üye: ${d.members}`}
                      />
                      <div
                        className={SERIES_COLORS[1]}
                        style={{ width: `${(d.guests / max) * 100}%` }}
                        title={`Misafir: ${d.guests}`}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      Üye: {d.members.toLocaleString('tr-TR')} · Misafir: {d.guests.toLocaleString('tr-TR')}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <SimpleList title="Nereden Geliyorlar?" items={traffic.by_source} labels={SOURCE_LABELS} total={traffic.total} />
      </div>

      {/* Sayfa grubu × Cihaz + Platform Modu */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5 lg:col-span-2" aria-label="Bölüm bazında cihaz">
          <h3 className="font-semibold text-foreground">Hangi Bölüme Hangi Cihazla Geliniyor?</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Mobil vs masaüstü önceliklendirmesi için bölüm kırılımı.</p>
          {traffic.by_landing.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Henüz veri yok.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Bölüm</th>
                    <th className="py-2 px-2 text-right font-medium">Toplam</th>
                    <th className="py-2 px-2 text-right font-medium">Telefon</th>
                    <th className="py-2 px-2 text-right font-medium">Tablet</th>
                    <th className="py-2 pl-2 text-right font-medium">Bilgisayar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 tabular-nums">
                  {traffic.by_landing.map((row) => (
                    <tr key={row.label}>
                      <td className="py-2 pr-3 font-medium text-foreground">{LANDING_LABELS[row.label] ?? row.label}</td>
                      <td className="py-2 px-2 text-right text-foreground">{row.total.toLocaleString('tr-TR')}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">
                        {row.mobile.toLocaleString('tr-TR')} <span className="text-[11px]">(%{pct(row.mobile, row.total)})</span>
                      </td>
                      <td className="py-2 px-2 text-right text-muted-foreground">
                        {row.tablet.toLocaleString('tr-TR')}
                      </td>
                      <td className="py-2 pl-2 text-right text-muted-foreground">
                        {row.desktop.toLocaleString('tr-TR')} <span className="text-[11px]">(%{pct(row.desktop, row.total)})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <SimpleList title="Tarayıcı / Platform Modu" items={traffic.by_app_mode} labels={APP_MODE_LABELS} total={traffic.total} />
      </div>

      {/* Günün saatlerine göre Mobil vs Masaüstü */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="Saatlik yoğunluk">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-foreground">Günün Saatlerine Göre Yoğunluk (TR Saati)</h3>
            <p className="text-xs text-muted-foreground">00:00 – 23:00 arası telefon ve bilgisayar dağılımı.</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${SERIES_COLORS[0]}`} /> Telefon
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${SERIES_COLORS[1]}`} /> Bilgisayar / Tablet
            </span>
          </div>
        </div>
        {traffic.total === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Henüz saatlik veri oluşmadı.</p>
        ) : (
          <div className="mt-4 flex items-end gap-0.5 sm:gap-1 h-28" role="img" aria-label="Saatlik trafik dağılımı">
            {traffic.by_hour.map((h) => {
              const other = h.desktop + h.tablet;
              const sum = h.mobile + other;
              const totalPct = (sum / maxHourTotal) * 100;
              const mobilePart = sum > 0 ? (h.mobile / sum) * 100 : 0;
              return (
                <div
                  key={h.hour}
                  className="flex flex-1 min-w-0 flex-col items-center gap-1 h-full justify-end"
                  title={`${String(h.hour).padStart(2, '0')}:00 — Toplam: ${sum} (Telefon: ${h.mobile}, Bilgisayar: ${h.desktop}, Tablet: ${h.tablet})`}
                >
                  <div className="w-full flex flex-col justify-end rounded-t bg-muted/40 overflow-hidden" style={{ height: `${Math.max(sum > 0 ? 6 : 2, totalPct)}%` }}>
                    {other > 0 && <div className={`w-full ${SERIES_COLORS[1]}`} style={{ height: `${100 - mobilePart}%` }} />}
                    {h.mobile > 0 && <div className={`w-full ${SERIES_COLORS[0]}`} style={{ height: `${mobilePart}%` }} />}
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {h.hour % 3 === 0 ? String(h.hour).padStart(2, '0') : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
