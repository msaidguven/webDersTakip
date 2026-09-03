import Link from 'next/link';
import AllCommentsPanel from '@/app/src/components/admin/AllCommentsPanel';

export const dynamic = 'force-dynamic';

export default function TumYorumlarPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      <header className="sticky top-0 z-10 bg-[#111114] border-b border-white/5 px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/admin" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
          <span>←</span> Admin Paneline Dön
        </Link>
        <h1 className="font-bold text-white text-sm sm:text-base">Tüm Yorumlar ve Sorular</h1>
      </header>
      <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-4xl mx-auto">
        <AllCommentsPanel />
      </main>
    </div>
  );
}
