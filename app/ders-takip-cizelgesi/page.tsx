// Ders takip çizelgesi — herkese açık, üst düzey sayfa (kişisel İlerlemem alanının dışında). Metinler sunucuda
// HTML'e yazılır ki arama motoru içeriği JS çalıştırmadan görsün; etkileşimli kısım client bileşeni.
// Görünüm: anasayfayla aynı "robotik kontrol paneli" teması (bkz. app/src/components/robotic).
import type { Metadata } from 'next';
import { createAnonClient } from '@/utils/supabase/server-anon';
import { DersTakipCizelgesi, type PublicGrade } from '@/app/src/components/progress/DersTakipCizelgesi';
import { roboticFontVars } from '@/app/src/components/robotic/fonts';
import r from '@/app/src/components/robotic/robotic.module.css';

export const metadata: Metadata = {
  title: 'Ders Takip Çizelgesi (Aylık, Yazdırılabilir)',
  description:
    'Her gün çözdüğün soruları derse göre takip et. Yazdırılabilir aylık ders takip çizelgesi; giriş yapınca çözdüğün sorular otomatik işlenir.',
  alternates: { canonical: '/ders-takip-cizelgesi' },
  robots: { index: true, follow: true },
};

async function getGrades(): Promise<PublicGrade[]> {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from('grades')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('order_no', { ascending: true });
  return (data as PublicGrade[] | null) ?? [];
}

const STEPS = [
  'Her gün çalışmaya başlamadan önce çizelgede o günün satırını bul.',
  'Çözdüğün her dersin doğru ve yanlış sütununa, o gün çözdüğün soru sayısını ayrı ayrı yaz.',
  'Günün sonunda toplam sütununa o günkü toplam soru sayısını yaz.',
  'Ay sonunda sütun toplamlarına bak: hangi dersten çok soru çözdüğünü, hangisinde yanlışların arttığını görürsün.',
];

const FAQ = [
  {
    q: 'Çizelgeye net yazılıyor mu?',
    a: 'Hayır. Çizelgede yalnızca doğru, yanlış ve toplam soru sayısı yer alır. Net hesabı yapılmaz.',
  },
  {
    q: 'Online çizelgemi başkaları görebilir mi?',
    a: 'Hayır. Online çizelgen yalnızca kendi hesabınla görünür.',
  },
  {
    q: 'Yazdırılabilir çizelgede dersler neden boş?',
    a: 'Ders adlarını kendin yazabilmen için boş bırakıldı. Kağıda istediğin dersleri yazarsın.',
  },
  {
    q: 'Çizelgeyi PDF olarak nasıl indiririm?',
    a: 'Sınıfını ve ayını seç, "PDF indir" düğmesine bas. Dosya cihazına iner; yazdırıp kullanabilirsin.',
  },
  {
    q: 'Online çizelge ile kağıt çizelge arasında fark var mı?',
    a: 'Online çizelgede her çözdüğün soru sistem tarafından kaydedilir ve gün gün otomatik dolar. Kağıt çizelgede ise her şeyi elle yazarsın.',
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

const card = `rounded-[22px] ${r.panel}`;

export default async function DersTakipCizelgesiPage() {
  const grades = await getGrades();

  return (
    <div className={`${roboticFontVars} ${r.root}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }} />
      <main className="px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <header className={`${card} ${r.hero} flex flex-col gap-3 p-5 sm:p-7`}>
            <span className={r.scan} aria-hidden="true" />
            <span className={`inline-flex w-fit items-center gap-2 ${r.label}`}>
              <i className={r.led} aria-hidden="true" />
              Aylık · Yazdırılabilir
            </span>
            <h1 className={`text-[28px] leading-tight sm:text-4xl ${r.chrome}`}>Ders takip çizelgesi</h1>
            <p className="max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
              Ders takip çizelgesi, bir ayın her gününde hangi dersten kaç soru çözdüğünü ve bunların kaçının doğru, kaçının yanlış
              olduğunu tek tabloda gösterir. Giriş yaparsan çözdüğün sorular otomatik işlenir; istersen boş çizelgeyi PDF olarak indirip
              elle doldurabilirsin.
            </p>
          </header>

          <DersTakipCizelgesi grades={grades} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section aria-labelledby="nasil-tutulur" className={`${card} flex flex-col gap-4 p-5 sm:p-7`}>
              <h2 id="nasil-tutulur" className="text-lg font-extrabold text-default">
                Soru çözüm çizelgesi nasıl tutulur?
              </h2>
              <ol className="flex flex-col gap-3">
                {STEPS.map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                    <span className={`h-7 w-7 shrink-0 text-xs ${r.chipBox}`} aria-hidden="true">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="neden-tut" className={`${card} flex flex-col gap-4 p-5 sm:p-7`}>
              <h2 id="neden-tut" className="text-lg font-extrabold text-default">
                Çizelgeyi neden tutmalısın?
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Yazılı kayıt, yalnızca çalıştığını hissettiğin şeyi değil gerçekte yaptığını gösterir. Aynı ay içindeki dersler
                arasındaki dengeyi ve yanlış oranındaki değişimi fark etmeyi kolaylaştırır. Bir sonraki ay ne kadar ilerlediğini de
                karşılaştırmanı sağlar.
              </p>
            </section>
          </div>

          <section aria-labelledby="sss" className={`${card} flex flex-col gap-4 p-5 sm:p-7`}>
            <h2 id="sss" className="text-lg font-extrabold text-default">
              Sık sorulan sorular
            </h2>
            <dl className="flex flex-col">
              {FAQ.map((item, i) => (
                <div key={item.q} className={`flex flex-col gap-1 py-4 ${i > 0 ? `border-t ${r.divider}` : 'pt-0'}`}>
                  <dt className="font-bold text-default">{item.q}</dt>
                  <dd className="text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>
    </div>
  );
}
