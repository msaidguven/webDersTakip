import Link from 'next/link';
import YillikPlanPanel from '@/app/src/components/admin/YillikPlanPanel';
import AdminThemeToggle from '@/app/src/components/admin/AdminThemeToggle';

export const dynamic = 'force-dynamic';

export default function YillikPlanPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/admin" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <span>←</span> Admin Paneline Dön
        </Link>
        <h1 className="font-bold text-foreground text-sm sm:text-base flex-1">Yıllık Plan Yükleme</h1>
        <AdminThemeToggle />
      </header>
      <main className="px-4 sm:px-6 py-6 sm:py-8">
        <YillikPlanPanel />
      </main>
    </div>
  );
}
