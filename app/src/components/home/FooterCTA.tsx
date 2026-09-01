import Link from 'next/link';

export function FooterCTA({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-default bg-surface-elevated p-6 text-center sm:flex-row sm:justify-between sm:text-left">
      <div>
        <p className="text-lg font-black text-default sm:text-xl">
          Öğrenme yolculuğuna <span className="gradient-text">şimdi başla!</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Binlerce konu, on binlerce soru ve daha fazlası seni bekliyor.</p>
      </div>
      <div className="flex shrink-0 gap-2.5">
        {isAuthenticated ? (
          <Link
            href="/panel"
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-sm font-black text-white transition-opacity hover:opacity-90"
          >
            Panele Git
          </Link>
        ) : (
          <>
            <Link
              href="/register"
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2.5 text-sm font-black text-white transition-opacity hover:opacity-90"
            >
              Ücretsiz Üye Ol
            </Link>
            <Link
              href="/hakkimizda"
              className="rounded-xl border border-default bg-surface px-5 py-2.5 text-sm font-black text-default transition-colors hover:bg-surface-elevated"
            >
              Daha Sonra
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
