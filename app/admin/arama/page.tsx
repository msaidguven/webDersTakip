import Link from 'next/link';
import SearchTab from '@/app/src/components/admin/SearchTab';

export const dynamic = 'force-dynamic';

export default function AramaPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      <header className="sticky top-0 z-10 bg-[#111114] border-b border-white/5 px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/admin" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
          <span>←</span> Admin Paneline Dön
        </Link>
        <h1 className="font-bold text-white text-sm sm:text-base">İçerik ve Soru Arama</h1>
      </header>
      <main className="px-4 sm:px-6 py-6 sm:py-8">
        <SearchTab />
      </main>
    </div>
  );
}
