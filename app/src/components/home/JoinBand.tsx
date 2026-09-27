import Link from 'next/link';

// Misafirin sayfa sonundaki TEK üyelik çağrısı (2026-09-27 sade tasarım) — eski FooterCTA +
// "Neden Üye Olmalısın?" kartının yerine. Üyeliğin somut faydasını söylüyor, soyut değil.
// Açık indigo tonlu (2026-09-28) — "Bugünkü görevin" kartıyla aynı dil; vurgu dolu butondan gelir.
export function JoinBand() {
  return (
    <section
      aria-labelledby="uye-ol"
      className="grid grid-cols-1 items-center gap-6 rounded-[28px] border border-indigo-200 bg-indigo-50 px-6 py-9 dark:border-indigo-500/30 dark:bg-indigo-500/10 sm:px-12 sm:py-14 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-12"
    >
      <div className="flex flex-col gap-3">
        <h2 id="uye-ol" className="text-3xl font-black leading-tight tracking-tight text-default sm:text-4xl">
          Çözdüğün her soru kaydedilsin.
        </h2>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Üye olunca yanlışların tekrar zamanı gelince önüne gelir, serini ve ilerlemeni görürsün, haftalık sıralamaya girersin.
        </p>
      </div>
      <div className="flex flex-col items-stretch gap-3 sm:items-start">
        <Link
          href="/register"
          className="rounded-2xl bg-indigo-600 px-7 py-4 text-center text-base font-black text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          Ücretsiz üye ol
        </Link>
        <span className="text-center text-sm text-muted-foreground sm:text-left">
          Google ile saniyeler içinde ·{' '}
          <Link href="/login" className="font-bold text-indigo-600 underline dark:text-indigo-400">
            Giriş yap
          </Link>
        </span>
      </div>
    </section>
  );
}
