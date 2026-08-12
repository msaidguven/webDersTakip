import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function StaticPageLayout({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-14">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-default transition-colors mb-6 sm:mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Ana Sayfa
        </Link>

        <h1 className="text-2xl sm:text-4xl font-black text-default mb-2 tracking-tight">{title}</h1>
        {updatedAt && <p className="text-xs sm:text-sm text-muted-foreground mb-6 sm:mb-8">Son güncelleme: {updatedAt}</p>}

        <div className="space-y-4 sm:space-y-5 text-sm sm:text-base leading-relaxed text-default [&_h2]:text-lg [&_h2]:sm:text-xl [&_h2]:font-black [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:text-indigo-500 [&_a]:font-bold [&_a]:hover:underline">
          {children}
        </div>
      </div>
    </div>
  );
}
