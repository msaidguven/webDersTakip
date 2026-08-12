import type { Metadata } from 'next';
import { Mail } from 'lucide-react';
import { StaticPageLayout } from '@/app/src/components/StaticPageLayout';

const canonicalPath = '/iletisim';
const CONTACT_EMAIL = 'info@derstakip.net';

export const metadata: Metadata = {
  title: 'İletişim',
  description: 'Sorularınız, görüş ve önerileriniz için Ders Takip ile iletişime geçin.',
  alternates: { canonical: canonicalPath },
  openGraph: { title: 'İletişim | Ders Takip', url: canonicalPath },
};

export default function ContactPage() {
  return (
    <StaticPageLayout title="İletişim">
      <p>
        Sorularınız, hata bildirimleriniz veya önerileriniz için aşağıdaki e-posta adresinden bize
        ulaşabilirsiniz. Mesajlarınıza en kısa sürede dönüş yapmaya çalışıyoruz.
      </p>

      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="inline-flex items-center gap-2 rounded-xl border border-default bg-surface-elevated px-4 py-3 font-bold text-default hover:border-indigo-500/30 transition-colors"
      >
        <Mail className="h-4 w-4 text-indigo-500" /> {CONTACT_EMAIL}
      </a>
    </StaticPageLayout>
  );
}
