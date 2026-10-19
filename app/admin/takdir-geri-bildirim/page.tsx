import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import AdminThemeToggle from '@/app/src/components/admin/AdminThemeToggle';

export const dynamic = 'force-dynamic';

interface BildirimSatiri {
  id: string;
  sinif_seviyesi: number;
  mesaj: string;
  ozet: {
    donem?: number;
    belge?: string;
    agirlikliOrtalama?: number;
    dersler?: { ad: string; haftalikSaat: number; donemNotu: number | null }[];
  } | null;
  user_id: string | null;
  created_at: string;
}

const BELGE_ADI: Record<string, string> = { takdir: 'Takdir', tesekkur: 'Teşekkür', yok: 'Belge yok' };

export default async function TakdirGeriBildirimPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('takdir_hesaplama_geri_bildirim')
    .select('id, sinif_seviyesi, mesaj, ozet, user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const satirlar = (data as BildirimSatiri[] | null) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/admin" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <span>←</span> Admin Paneline Dön
        </Link>
        <h1 className="font-bold text-foreground text-sm sm:text-base flex-1">Takdir Hesaplama Bildirimleri</h1>
        <AdminThemeToggle />
      </header>
      <main className="px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-4">
        {error && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            Bildirimler yüklenemedi: {error.message}
          </p>
        )}
        {!error && satirlar.length === 0 && <p className="text-sm text-muted-foreground">Henüz bildirim yok.</p>}
        {satirlar.map((s) => (
          <article key={s.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{new Date(s.created_at).toLocaleString('tr-TR')}</span>
              <span>· {s.sinif_seviyesi}. sınıf</span>
              {s.ozet?.donem && <span>· {s.ozet.donem}. dönem</span>}
              {s.ozet?.belge && <span>· {BELGE_ADI[s.ozet.belge] ?? s.ozet.belge}</span>}
              {s.ozet?.agirlikliOrtalama !== undefined && <span>· ortalama {s.ozet.agirlikliOrtalama.toFixed(2)}</span>}
              <span>· {s.user_id ? 'giriş yapmış' : 'anonim'}</span>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{s.mesaj}</p>
            {s.ozet?.dersler && s.ozet.dersler.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Girilen notlar ({s.ozet.dersler.length} ders)</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {s.ozet.dersler.map((d, i) => (
                    <li key={`${s.id}-${i}`}>
                      {d.ad} — {d.haftalikSaat} saat — dönem notu: {d.donemNotu ?? '—'}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        ))}
      </main>
    </div>
  );
}
