import Link from 'next/link';
import Image from 'next/image';
import { Info, LayoutDashboard, UserPlus } from 'lucide-react';

export function HomeHero({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-10">
      <div className="text-center lg:text-left">
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-default bg-surface-elevated px-3 py-1.5 text-[11px] font-bold text-muted-foreground sm:mb-5 sm:text-xs">
          🎓 MEB Müfredatına Uygun
        </span>
        <h1 className="mb-3 text-3xl font-black tracking-tight text-default sm:mb-4 sm:text-5xl">
          Öğrenmek hiç bu kadar <span className="gradient-text">kolay</span>! 🚀
        </h1>
        <p className="mx-auto mb-6 max-w-xl text-sm text-muted-foreground sm:mb-8 sm:text-lg lg:mx-0">
          5. sınıftan 12. sınıfa kadar tüm dersler, konular, soru çözümleri ve daha fazlası seni bekliyor.
        </p>
        <div className="flex flex-col items-center justify-center gap-2.5 sm:flex-row lg:justify-start">
          <a
            href="#derslerimiz"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3 text-sm font-black text-white transition-opacity hover:opacity-90 sm:w-auto"
          >
            Dersleri Keşfet →
          </a>
          {isAuthenticated ? (
            <Link
              href="/panel"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-default bg-surface-elevated px-6 py-3 text-sm font-black text-default transition-colors hover:bg-surface sm:w-auto"
            >
              <LayoutDashboard className="h-4 w-4" /> Panele Git
            </Link>
          ) : (
            <Link
              href="/register"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-default bg-surface-elevated px-6 py-3 text-sm font-black text-default transition-colors hover:bg-surface sm:w-auto"
            >
              <UserPlus className="h-4 w-4" /> Ücretsiz Üye Ol
            </Link>
          )}
        </div>
        {!isAuthenticated && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground sm:mt-5 lg:justify-start">
            <Info className="h-3.5 w-3.5" /> Üye olmadan tüm içerikleri kullanabilirsin. Sadece ilerlemen kayıt altına alınmaz.
          </p>
        )}
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-default">
        <Image
          src="/hero-student.jpeg"
          alt="Tüm dersler tek platformda — soru çöz, konu anlatımı izle, deneme çöz"
          width={1278}
          height={832}
          priority
          className="h-auto w-full"
        />
      </div>
    </div>
  );
}
