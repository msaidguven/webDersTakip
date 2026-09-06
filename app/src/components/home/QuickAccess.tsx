import Link from 'next/link';
import { BookOpen, FileQuestion, Layers, PlayCircle, Sparkles } from 'lucide-react';

// Bu kısayollardan "Soru Bankası" hariç hiçbirinin hedef sayfası yok (bkz.
// docs/site-iyilestirme-plani.md) — kartlar referans tasarımla aynı görünsün diye duruyor
// ama bilerek link değil (404'e düşürmesin). Soru Bankası artık gerçek bir sayfaya sahip
// (bkz. kullanıcının 2026-09-06 isteği: "anasayfaya soru bankası linki ekle") — sınıf
// seçimi kendi listeleme sayfasında yapıldığından (/soru-bankasi köküne) doğrudan gidiyor.
const ITEMS = [
  { icon: Layers, label: 'Üniteler', description: 'Tüm üniteleri görüntüle' },
  { icon: BookOpen, label: 'Konular', description: 'Konulara göz at' },
  { icon: FileQuestion, label: 'Soru Bankası', description: 'Binlerce soru çöz', href: '/soru-bankasi' },
  { icon: Sparkles, label: 'Denemeler', description: 'Deneme sınavları çöz' },
  { icon: PlayCircle, label: 'Konu Anlatımları', description: 'Video ve PDF içerikler' },
];

export function QuickAccess() {
  return (
    <div>
      <h2 className="mb-1 text-lg font-black text-default sm:text-xl">⚡ Hızlı Erişim</h2>
      <p className="mb-4 text-sm text-muted-foreground">Aradığın içeriğe hızlıca ulaş.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ITEMS.map(({ icon: Icon, label, description, href }) => {
          const content = (
            <>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 text-indigo-500">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-default">{label}</p>
                <p className="truncate text-xs text-muted-foreground">{description}</p>
              </div>
            </>
          );
          return href ? (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-3 rounded-2xl border border-default bg-surface-elevated p-4 transition-colors hover:border-indigo-400/50 hover:bg-indigo-500/5"
            >
              {content}
            </Link>
          ) : (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-default bg-surface-elevated p-4">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
