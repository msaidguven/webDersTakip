import Link from 'next/link';

export default function BannedPage() {
  return (
    <div className="min-h-screen bg-default flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">⛔</span>
        </div>
        <h1 className="text-2xl font-bold text-default mb-2">Hesabınız Askıya Alındı</h1>
        <p className="text-muted-foreground mb-8">
          Hesabınız yönetici tarafından askıya alınmıştır. Bunun bir hata olduğunu düşünüyorsanız bizimle iletişime geçin.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/iletisim"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
          >
            İletişime Geç
          </Link>
          <Link href="/" className="text-muted-foreground hover:text-default text-sm">
            ← Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
