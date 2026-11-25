import Link from 'next/link';
import AdminThemeToggle from '@/app/src/components/admin/AdminThemeToggle';
import SiteFeedbackPanel from '@/app/src/components/admin/SiteFeedbackPanel';

export const dynamic = 'force-dynamic';

export default function AdminFeedbackPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-card px-4 py-3 sm:px-6">
        <Link href="/admin" className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <span>←</span> Admin Paneline Dön
        </Link>
        <h1 className="flex-1 text-sm font-bold text-foreground sm:text-base">Geri Bildirimler & İletişim Mesajları</h1>
        <AdminThemeToggle />
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <SiteFeedbackPanel />
      </main>
    </div>
  );
}
