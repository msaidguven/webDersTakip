import { Suspense } from 'react';
import Link from 'next/link';
import MemberActivityPanel from '@/app/src/components/admin/MemberActivityPanel';
import AdminThemeToggle from '@/app/src/components/admin/AdminThemeToggle';

export const dynamic = 'force-dynamic';

export default function UyeAktivitesiPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/admin" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <span>←</span> Admin Paneline Dön
        </Link>
        <h1 className="font-bold text-foreground text-sm sm:text-base flex-1">Üye Aktivitesi</h1>
        <AdminThemeToggle />
      </header>
      <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-6xl mx-auto">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Yükleniyor...</p>}>
          <MemberActivityPanel />
        </Suspense>
      </main>
    </div>
  );
}
