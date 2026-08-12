import type { Metadata } from 'next';
import Link from 'next/link';
import { StaticPageLayout } from '@/app/src/components/StaticPageLayout';

const canonicalPath = '/hakkimizda';

export const metadata: Metadata = {
  title: 'Hakkımızda',
  description: 'Ders Takip nedir, ne sunar? 5-8. sınıf öğrencileri için MEB müfredatına uygun konu anlatımı ve interaktif test platformu hakkında bilgi alın.',
  alternates: { canonical: canonicalPath },
  openGraph: { title: 'Hakkımızda | Ders Takip', url: canonicalPath },
};

export default function AboutPage() {
  return (
    <StaticPageLayout title="Hakkımızda">
      <p>
        Ders Takip, 5-8. sınıf öğrencileri için hazırlanmış, MEB müfredatına uygun bir online konu anlatımı ve
        test platformudur. Amacımız, öğrencilerin haftalık müfredat akışını takip ederek düzenli çalışmasını
        kolaylaştırmak.
      </p>

      <h2>Neler sunuyoruz?</h2>
      <ul>
        <li>Sınıf ve derse göre haftalık müfredat akışı, ünite ve konu bazlı içerik</li>
        <li>Kazanımlara dayalı konu anlatımları</li>
        <li>Çoktan seçmeli, boşluk doldurma ve eşleştirme türünde interaktif testler</li>
        <li>Konu ve ünite bazlı ilerleme takibi</li>
      </ul>

      <h2>Kimler için?</h2>
      <p>
        Haftalık müfredatını takip etmek isteyen öğrenciler, çalışmalarını konu/kazanım bazında planlamak
        isteyen veliler ve öğrenciler için ek kaynak arayan öğretmenler platformumuzu kullanabilir.
      </p>

      <h2>İletişim</h2>
      <p>
        Sorularınız, görüş ve önerileriniz için <Link href="/iletisim">iletişim sayfamızdan</Link> bize ulaşabilirsiniz.
      </p>
    </StaticPageLayout>
  );
}
