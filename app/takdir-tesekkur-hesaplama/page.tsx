// Takdir/teşekkür belgesi hesaplama — herkese açık, üst düzey sayfa (ders-takip-cizelgesi ile
// aynı desen). Hesaplama kuralları ve kaynakları: app/src/lib/takdirTesekkurHesaplama.ts başına
// bakılabilir (MEB yönetmelik madde numaralarıyla).
import type { Metadata } from 'next';
import { TakdirTesekkurHesaplama } from '@/app/src/components/progress/TakdirTesekkurHesaplama';

export const metadata: Metadata = {
  title: 'Takdir / Teşekkür Belgesi Hesaplama (5-12. Sınıf)',
  description:
    'Ders notlarını gir, ağırlıklı ortalamanı ve takdir mi teşekkür mü alacağını anında öğren. Ortaokul ve lise için güncel MEB yönetmeliğine göre hesaplar.',
  alternates: { canonical: '/takdir-tesekkur-hesaplama' },
  robots: { index: true, follow: true },
};

const FAQ = [
  {
    q: 'Takdir belgesi kaç puanla alınır?',
    a: 'Ağırlıklı dönem ortalaman 85,00 ve üzeriyse takdir belgesi alırsın (ortaokulda ayrıca Türkçe\'den en az 70, diğer derslerin her birinden en az 50 puan şartı var).',
  },
  {
    q: 'Teşekkür belgesi kaç puanla alınır?',
    a: 'Ağırlıklı dönem ortalaman 70,00-84,99 arasındaysa teşekkür belgesi alırsın. Ortaokulda yine Türkçe\'den en az 70, diğer derslerin her birinden en az 50 puan şartı aranır.',
  },
  {
    q: 'Ağırlıklı ortalama nasıl hesaplanır?',
    a: 'Her dersin notu, o dersin haftalık ders saatiyle çarpılır. Bu çarpımların toplamı, tüm derslerin haftalık saatleri toplamına bölünür.',
  },
  {
    q: 'Lise ile ortaokulun şartları farklı mı?',
    a: 'Evet. Ortaokulda (5-8. sınıf) ders başına alt puan sınırı var. Lisede (9-12. sınıf) ders başına alt sınır yok; bunun yerine tüm derslerden başarılı olmak ve davranış puanının 100 olması gerekir.',
  },
  {
    q: 'Resim, Beden Eğitimi, Müzik gibi dersleri de ekleyebilir miyim?',
    a: 'Evet. "Başka bir ders adı yaz" kutusuna istediğin dersin adını yazıp ekleyebilirsin; haftalık ders saatini de kendin belirlersin.',
  },
  {
    q: 'Girdiğim notlar kaydediliyor mu?',
    a: 'Giriş yapmadan hesaplama yapabilirsin, hiçbir şey kaydedilmez. Giriş yaparsan "Kaydet" butonuyla notlarını saklayıp daha sonra devam edebilirsin.',
  },
];

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};

export default function TakdirTesekkurHesaplamaPage() {
  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-black tracking-tight text-default sm:text-5xl">Takdir / Teşekkür Belgesi Hesaplama</h1>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
            Derslerinin dönem notlarını ve haftalık ders saatlerini gir; ağırlıklı ortalamanı ve güncel MEB yönetmeliğine göre
            takdir mi, teşekkür mü alacağını anında gör. 5-8. sınıf (ortaokul) ve 9-12. sınıf (lise) kuralları farklıdır,
            aracı seçtiğin sınıfa göre otomatik uygular.
          </p>
        </header>

        <TakdirTesekkurHesaplama />

        <section aria-labelledby="nasil-hesaplanir" className="flex flex-col gap-4">
          <h2 id="nasil-hesaplanir" className="text-2xl font-black tracking-tight text-default">
            Takdir ve teşekkür belgesi nasıl hesaplanır?
          </h2>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
            Yönetmeliğe göre her dersin &ldquo;ağırlığı&rdquo; o dersin haftalık ders saatidir. Dersin notu haftalık saatiyle çarpılır,
            bu çarpımların toplamı tüm derslerin haftalık saat toplamına bölünür — çıkan sayı ağırlıklı dönem ortalamandır.
            Ortalaman 70,00-84,99 arasındaysa teşekkür, 85,00 ve üzerindeyse takdir belgesi almaya hak kazanırsın.
          </p>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-base leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-default">Ortaokul (5-8. sınıf):</strong> Ek olarak Türkçe&apos;den en az 70,00, diğer
              derslerin her birinden en az 50,00 puan almış olman gerekir.
            </li>
            <li>
              <strong className="text-default">Lise (9-12. sınıf):</strong> Ders başına alt sınır yoktur; bunun yerine tüm
              derslerden başarılı olman (sınıfı geçmen) ve davranış puanının 100 olması şartı vardır.
            </li>
          </ul>
        </section>

        <section aria-labelledby="sss" className="flex flex-col gap-4">
          <h2 id="sss" className="text-2xl font-black tracking-tight text-default">
            Sık sorulan sorular
          </h2>
          <dl className="flex flex-col gap-5">
            {FAQ.map((item) => (
              <div key={item.q} className="flex flex-col gap-1">
                <dt className="font-extrabold text-default">{item.q}</dt>
                <dd className="text-base leading-relaxed text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}
