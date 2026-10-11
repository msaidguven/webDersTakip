'use client';

// Yalnız admin'e görünen "Bu sayfayı yenile" düğmesi (2026-10-04). Sayfalar haftalık önbellekte
// (pazartesi 03:00 TR); hafta içi bir düzeltmenin hemen görünmesi gerekirse admin o sayfayı açıp
// buna basar → /api/admin/revalidate-page (konu/soru bankası konu sayfasında bağlı 4 sayfa
// birlikte). İsteğe bağlı anasayfa da (kapak resmi "Yeni eklenenler"de görünür). Yetki
// sunucuda (requireAdmin); burada yalnız göster/gizle.
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Check, Loader2, RefreshCw, X } from 'lucide-react';
import { useIsAdmin } from '@/app/src/hooks/useIsAdmin';

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; count: number } | { kind: 'error'; message: string };

export function AdminPageRefresh() {
  const isAdmin = useIsAdmin();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [withHome, setWithHome] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  if (!isAdmin || !pathname || pathname.startsWith('/admin')) return null;

  async function refresh() {
    if (!pathname) return;
    setStatus({ kind: 'busy' });
    try {
      const paths = withHome && pathname !== '/' ? [pathname, '/'] : [pathname];
      const res = await fetch('/api/admin/revalidate-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Yenilenemedi');
      setStatus({ kind: 'done', count: Array.isArray(data?.revalidated) ? data.revalidated.length : paths.length });
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Yenilenemedi' });
    }
  }

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 z-40 md:bottom-20">
      {open ? (
        <div role="dialog" aria-label="Sayfayı yenile" className="w-72 rounded-2xl border border-default bg-background p-4 shadow-lg">
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-default">Bu sayfayı yenile</p>
            <button type="button" onClick={() => { setOpen(false); setStatus({ kind: 'idle' }); }} aria-label="Kapat" className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-elevated">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Önbellekteki kopya silinir, sayfa bir sonraki açılışta güncel veriyle üretilir. Konu sayfalarında soru bankası ve ünite sayfaları da yenilenir.
          </p>
          {pathname !== '/' && (
            <label className="mb-3 flex items-center gap-2 text-sm text-default">
              <input type="checkbox" checked={withHome} onChange={(e) => setWithHome(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
              Anasayfayı da yenile
            </label>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={status.kind === 'busy'}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            {status.kind === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
            Yenile
          </button>
          <p className="mt-2 min-h-5 text-xs" aria-live="polite">
            {status.kind === 'done' && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" aria-hidden="true" /> {status.count} sayfa yenilendi
              </span>
            )}
            {status.kind === 'error' && <span className="text-rose-600 dark:text-rose-400">{status.message}</span>}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Bu sayfayı yenile (admin)"
          title="Bu sayfayı yenile (admin)"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-default bg-background text-muted-foreground shadow-lg transition-colors hover:text-indigo-600"
        >
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
