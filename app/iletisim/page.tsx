import type { Metadata } from 'next';
import { Mail } from 'lucide-react';
import { StaticPageLayout } from '@/app/src/components/StaticPageLayout';
import { ContactForm } from './ContactForm';

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
        Ders Takip’i öğretmen ve öğrencilerimizin geri bildirimleriyle geliştiriyoruz. Öneri, fikir,
        müfredat düzeltmesi veya hata bildirimlerinizi doğrudan aşağıdaki formdan iletebilirsiniz.
      </p>

      <ContactForm />

      <div className="pt-2">
        <p className="!text-xs mb-2">Dilerseniz doğrudan e-posta da gönderebilirsiniz:</p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="inline-flex items-center gap-2 rounded-xl border border-default bg-surface-elevated px-4 py-2.5 text-sm font-bold text-default hover:border-indigo-500/30 transition-colors !no-underline"
        >
          <Mail className="h-4 w-4 text-indigo-500" /> {CONTACT_EMAIL}
        </a>
      </div>
    </StaticPageLayout>
  );
}
