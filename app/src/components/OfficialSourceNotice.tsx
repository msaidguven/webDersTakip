// Resmi kaynak ve sorumluluk reddi bildirimi (Google Play Yanıltıcı İddialar Politikası uyumu).
// Resmi MEB kaynaklarını referans alan sayfalarda, kullanıcıya ve inceleyicilere doğrudan görünür.
import { ExternalLink, Info } from 'lucide-react';

export const OFFICIAL_SOURCES = {
  tymm: {
    label: 'tymm.meb.gov.tr',
    title: 'MEB Türkiye Yüzyılı Maarif Modeli Öğretim Programları',
    href: 'https://tymm.meb.gov.tr',
  },
  mufredat: {
    label: 'mufredat.meb.gov.tr',
    title: 'MEB Öğretim Programları',
    href: 'https://mufredat.meb.gov.tr',
  },
  odsgm: {
    label: 'odsgm.meb.gov.tr',
    title: 'MEB Ölçme, Değerlendirme ve Sınav Hizmetleri Genel Müdürlüğü',
    href: 'https://odsgm.meb.gov.tr',
  },
  mevzuat: {
    label: 'mevzuat.meb.gov.tr',
    title: 'MEB Mevzuat Bankası',
    href: 'https://mevzuat.meb.gov.tr',
  },
} as const;

export type OfficialSourceKey = keyof typeof OFFICIAL_SOURCES;

export function OfficialSourceNotice({
  sources,
  description,
  className = '',
}: {
  sources: OfficialSourceKey[];
  description?: string;
  className?: string;
}) {
  return (
    <aside
      aria-label="Resmi kaynaklar ve sorumluluk reddi"
      className={`rounded-2xl border border-default bg-surface/80 px-4 py-3 text-xs leading-relaxed text-muted-foreground ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="flex flex-col gap-1.5">
          <p>
            <strong className="font-semibold text-default">Sorumluluk Reddi:</strong> Ders Takip bağımsız bir eğitim
            platformudur; T.C. Millî Eğitim Bakanlığı (MEB) veya herhangi bir devlet kurumuyla bağlantılı değildir ve
            resmi bir devlet kuruluşunu temsil etmez.
            {description ? ` ${description}` : ''}
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-default">Resmi kaynaklar:</span>
            {sources.map((key) => {
              const src = OFFICIAL_SOURCES[key];
              return (
                <a
                  key={key}
                  href={src.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={src.title}
                  className="inline-flex items-center gap-1 font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-500 dark:text-indigo-400"
                >
                  {src.label}
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                </a>
              );
            })}
          </p>
        </div>
      </div>
    </aside>
  );
}
