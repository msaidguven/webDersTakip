import Link from 'next/link';
import { Award, CheckCircle2, ClipboardCheck, Compass, PlayCircle, Target, Trophy } from 'lucide-react';

const WHY_JOIN_ITEMS = [
  'İlerlemeni kayıt altına al',
  'Doğru & yanlış istatistiklerini gör',
  'Kaldığın yerden devam et',
];

const HOW_IT_WORKS_STEPS = [
  { icon: Compass, title: 'Sınıfını Seç', description: 'Kendi sınıfını seçerek başlayın.' },
  { icon: ClipboardCheck, title: 'Dersi ve Konuyu Seç', description: 'İlgilendiğin dersi ve konuyu seç.' },
  { icon: PlayCircle, title: 'Öğren ve Pekiştir', description: 'Konu anlatımını izle, örnekleri incele.' },
  { icon: Target, title: 'Soruları Çöz', description: 'Bilgini pekiştirmek için soruları çöz.' },
];

// Giriş yapmış kullanıcıya "üye ol" çağrısı yapmak anlamsız — bu bölüm sadece misafir
// kullanıcıya gösterilir (bkz. HomeClient.tsx). Panel'e ihtiyacı varsa zaten header'daki
// "Panel" linkinden ulaşabiliyor.
export function WhyJoin() {
  return (
    <div className="rounded-2xl border border-default bg-surface-elevated p-5 sm:p-6">
      <h3 className="mb-4 flex items-center gap-2 text-base font-black text-default">
        <Trophy className="h-5 w-5 text-amber-500" /> Neden Üye Olmalısın?
      </h3>
      <ul className="mb-5 space-y-2.5">
        {WHY_JOIN_ITEMS.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm font-medium text-default">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            {item}
          </li>
        ))}
      </ul>
      <div className="mb-3 flex justify-center">
        <Award className="h-14 w-14 text-amber-400" />
      </div>
      <Link
        href="/register"
        className="block w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-3 text-center text-sm font-black text-white transition-opacity hover:opacity-90"
      >
        Ücretsiz Üye Ol
      </Link>
      <p className="mt-2.5 text-center text-xs font-medium text-muted-foreground">Sadece 1 dakikada üye ol, tüm avantajları kazan!</p>
    </div>
  );
}

export function HowItWorks() {
  return (
    <div className="rounded-2xl border border-default bg-surface-elevated p-5 sm:p-6">
      <h3 className="mb-4 flex items-center gap-2 text-base font-black text-default">
        <Compass className="h-5 w-5 text-indigo-500" /> Nasıl Çalışır?
      </h3>
      <ol className="space-y-4">
        {HOW_IT_WORKS_STEPS.map((step, i) => (
          <li key={step.title} className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-black text-white">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-bold text-default">{step.title}</p>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
