'use client';

// Admin ana sayfası üstündeki uyarı kutusu — bkz. app/api/admin/alerts/route.ts. Yapılacak iş yoksa
// hiç görünmez.
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Alerts = { svgPending: number; openReports: number; studentReplies: number; autoHidden: number; failedBatches: number; awaitingReview: number; recapFiguresPending: number; recapFailed: number };
// href yoksa iş Claude'a söylenerek yapılır, gidilecek sayfa yok.
type AlertItem = { href?: string; text: string };

export function AdminAlerts() {
  const [alerts, setAlerts] = useState<Alerts | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/alerts')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Alerts | null) => {
        if (!cancelled) setAlerts(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!alerts) return null;
  const items = [
    alerts.openReports > 0 && { href: '/admin/soru-bildirimleri', text: `${alerts.openReports} soru için öğrenci "hatalı soru" bildirimi var` },
    alerts.studentReplies > 0 && { href: '/admin/soru-bildirimleri', text: `${alerts.studentReplies} soru bildiriminde öğrenci sana geri yazdı` },
    alerts.autoHidden > 0 && { href: '/admin/soru-bildirimleri', text: `${alerts.autoHidden} soru 3+ "cevap yanlış" bildirimiyle otomatik gizlendi` },
    alerts.svgPending > 0 && { href: '/admin/svg-sorulari', text: `${alerts.svgPending} soru çizim (SVG) bekliyor — çizim eklenene kadar yayında değil` },
    alerts.awaitingReview > 0 && { href: '/admin/soru-uretimi', text: `${alerts.awaitingReview} Türkçe konusunun soruları inceleme bekliyor — Claude'a "Türkçe sorularını kontrol et" de, sonra Yayınla` },
    alerts.failedBatches > 0 && { href: '/admin/soru-uretimi', text: `${alerts.failedBatches} konuda otomatik soru üretimi eksik kaldı (içerik yok ya da hata, adım atlandı)` },
    alerts.recapFiguresPending > 0 && { href: '/admin/svg-sorulari?tur=kart', text: `${alerts.recapFiguresPending} hap bilgi örneği şekil bekliyor (çizilene kadar gizli) — promptu kopyala ya da Claude'a "kart şekillerini çiz" de` },
    alerts.recapFailed > 0 && { text: `${alerts.recapFailed} konuda hap bilgi kartı 3 denemede üretilemedi — Claude'a "başarısız kartlara bak" de` },
  ].filter((x): x is AlertItem => !!x);
  if (!items.length) return null;

  return (
    <section aria-label="Yapılacaklar" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10">
      <h2 className="mb-2 text-sm font-bold text-amber-900 dark:text-amber-200">Senin yapman gerekenler</h2>
      <ul className="flex flex-col gap-1.5">
        {items.map((it) => (
          <li key={it.text}>
            {it.href ? (
              <Link href={it.href} className="text-sm font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700 dark:text-amber-100">
                {it.text} →
              </Link>
            ) : (
              <span className="text-sm font-medium text-amber-900 dark:text-amber-100">{it.text}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
