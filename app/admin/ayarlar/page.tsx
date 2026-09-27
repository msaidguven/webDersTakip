import Link from 'next/link';
import SiteSettingsPanel from '@/app/src/components/admin/SiteSettingsPanel';
import AdminThemeToggle from '@/app/src/components/admin/AdminThemeToggle';

export const dynamic = 'force-dynamic';

// Site geneli, kod değişikliği gerektirmeyen ayarlar (kullanıcının 2026-09-27 isteği: "adminde
// ayarlar diye bir sayfa açalım, bundan sonraki özellikleri de oraya ekleriz"). Değerler
// site_settings tablosunda; yeni bir ayar = yeni bir anahtar + SiteSettingsPanel'de bir bölüm.
export default function AyarlarPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/admin" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <span>←</span> Admin Paneline Dön
        </Link>
        <h1 className="font-bold text-foreground text-sm sm:text-base flex-1">Ayarlar</h1>
        <AdminThemeToggle />
      </header>
      <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-3xl mx-auto">
        <SiteSettingsPanel />
      </main>
    </div>
  );
}
