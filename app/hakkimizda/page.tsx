import type { Metadata } from 'next';
import Link from 'next/link';
import { StaticPageLayout } from '@/app/src/components/StaticPageLayout';

const canonicalPath = '/hakkimizda';

export const metadata: Metadata = {
  title: 'Hakkımızda',
  description: 'Ders Takip nedir, ne sunar? Ortaokul ve lise öğrencileri için MEB müfredatına uygun konu anlatımı, soru bankası ve test platformu hakkında bilgi alın.',
  alternates: { canonical: canonicalPath },
  openGraph: { title: 'Hakkımızda | Ders Takip', url: canonicalPath },
};

export default function AboutPage() {
  return (
    <StaticPageLayout title="Hakkımızda">
      <p>
        Ders Takip, ortaokul ve lise öğrencileri (5-12. sınıf) için hazırlanan, MEB müfredatına uygun bir online
        konu anlatımı, soru bankası ve test platformudur. Sınıflar kademeli olarak ekleniyor. Amacımız, öğrencilerin haftalık müfredat akışını takip ederek düzenli çalışmasını
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

      <h2>Resmi Kaynaklar ve Sorumluluk Reddi</h2>
      <p>
        Ders Takip bağımsız bir eğitim platformudur. T.C. Millî Eğitim Bakanlığı (MEB) veya herhangi bir devlet
        kurumuyla bağlantılı değildir, hiçbir devlet kuruluşunu temsil etmez ve resmi devlet hizmeti sunmaz.
      </p>
      <p>
        Platformdaki müfredat uyumlu konu sıralamaları, haftalık yıllık planlar, yazılı konu-soru dağılımları ve
        belge hesaplama kuralları aşağıdaki resmi kaynaklar referans alınarak hazırlanmıştır:
      </p>
      <ul>
        <li>
          <a href="https://tymm.meb.gov.tr" target="_blank" rel="noopener noreferrer">
            tymm.meb.gov.tr
          </a>{' '}
          — Türkiye Yüzyılı Maarif Modeli Öğretim Programları
        </li>
        <li>
          <a href="https://mufredat.meb.gov.tr" target="_blank" rel="noopener noreferrer">
            mufredat.meb.gov.tr
          </a>{' '}
          — MEB Öğretim Programları
        </li>
        <li>
          <a href="https://odsgm.meb.gov.tr" target="_blank" rel="noopener noreferrer">
            odsgm.meb.gov.tr
          </a>{' '}
          — MEB Ölçme, Değerlendirme ve Sınav Hizmetleri Genel Müdürlüğü
        </li>
        <li>
          <a href="https://mevzuat.meb.gov.tr" target="_blank" rel="noopener noreferrer">
            mevzuat.meb.gov.tr
          </a>{' '}
          — MEB Mevzuat Bankası
        </li>
      </ul>

      <h2>İletişim</h2>
      <p>
        Sorularınız, görüş ve önerileriniz için <Link href="/iletisim">iletişim sayfamızdan</Link> bize ulaşabilirsiniz.
      </p>
    </StaticPageLayout>
  );
}
