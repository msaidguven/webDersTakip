// Ders takip çizelgesi — herkese açık, üst düzey sayfa (kişisel İlerlemem alanının dışında). Metinler sunucuda
// HTML'e yazılır ki arama motoru içeriği JS çalıştırmadan görsün; etkileşimli kısım client bileşeni.
import type { Metadata } from 'next';
import { createAnonClient } from '@/utils/supabase/server-anon';
import { DersTakipCizelgesi, type PublicGrade } from '@/app/src/components/progress/DersTakipCizelgesi';

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

export default async function DersTakipCizelgesiPage() {
  const grades = await getGrades();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-black tracking-tight text-default sm:text-5xl">Ders takip çizelgesi</h1>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
            Ders takip çizelgesi, bir ayın her gününde hangi dersten kaç soru çözdüğünü ve bunların kaçının doğru, kaçının yanlış
            olduğunu tek tabloda gösterir. Düzenli çalışmanın izini sürmek ve hangi derste zorlandığını görmek için kullanılır.
            Aşağıdaki çizelgeyi yazdırıp elle doldurabilir ya da giriş yaparak çözdüğün soruların otomatik işlenmesini sağlayabilirsin.
          </p>
        </header>

        <DersTakipCizelgesi grades={grades} />

        <section aria-labelledby="nasil-tutulur" className="flex flex-col gap-4">
          <h2 id="nasil-tutulur" className="text-2xl font-black tracking-tight text-default">
            Soru çözüm çizelgesi nasıl tutulur?
          </h2>
          <ol className="flex list-decimal flex-col gap-3 pl-5 text-base leading-relaxed text-muted-foreground">
            <li>Her gün çalışmaya başlamadan önce çizelgede o günün satırını bul.</li>
            <li>
              Çözdüğün her dersin doğru ve yanlış sütununa, o gün çözdüğün soru sayısını yaz. Doğru ve yanlışı ayrı ayrı yaz.
            </li>
            <li>Günün sonunda toplam sütununa o günkü toplam soru sayısını yaz ve satırı kontrol et.</li>
            <li>
              Ay sonunda sütunların altındaki toplamlara bak. Hangi dersten çok soru çözdüğünü ve hangisinde yanlışların arttığını
              bu tablodan görebilirsin.
            </li>
          </ol>
        </section>

        <section aria-labelledby="neden-tut" className="flex flex-col gap-4">
          <h2 id="neden-tut" className="text-2xl font-black tracking-tight text-default">
            Çizelgeyi neden tutmalısın?
          </h2>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
            Yazılı kayıt, yalnızca çalıştığını hissettiğin şeyi değil gerçekte yaptığını gösterir. Aynı ay içindeki dersler arasındaki
            dengeyi ve yanlış oranındaki değişimi fark etmeyi kolaylaştırır. Bir sonraki ay ne kadar ilerlediğini de karşılaştırmanı sağlar.
          </p>
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
