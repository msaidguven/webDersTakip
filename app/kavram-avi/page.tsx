// Kavram Avı — herkese açık kelime oyunu: tanımdan kavramı bul, harf çemberinden kelimeleri kur.
// Veri: app/src/data/kavramlar.json · mantık: app/src/hooks/useKavramOyunu.ts
// Görünüm: anasayfayla aynı "robotik kontrol paneli" teması (bkz. app/src/components/robotic).
import type { Metadata } from 'next';
import { KavramAvi } from '@/app/src/components/kavram-avi/KavramAvi';
import { roboticFontVars } from '@/app/src/components/robotic/fonts';
import r from '@/app/src/components/robotic/robotic.module.css';

export const metadata: Metadata = {
  title: 'Kavram Avı — Kavramları Oyunla Öğren',
  description:
    'Tanımı oku, harf çemberinden kelimeleri kur, kavramı bul! 5-6. sınıf öğrencileri için ders kavramlarını öğreten ücretsiz kelime oyunu.',
  alternates: { canonical: '/kavram-avi' },
  robots: { index: true, follow: true },
};

export default function KavramAviPage() {
  return (
    <div className={`${roboticFontVars} ${r.root}`}>
      <main className="px-4 pb-16 pt-3 sm:px-8 sm:pt-10">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 sm:gap-6">
          <KavramAvi
            baslik={
              <header className={`${r.panel} ${r.hero} flex flex-col gap-3 p-5 sm:p-7`}>
                <span className={r.scan} aria-hidden="true" />
                <span className={`inline-flex w-fit items-center gap-2 ${r.label}`}>
                  <i className={r.led} aria-hidden="true" />
                  5-6. sınıf · Kelime oyunu
                </span>
                <h1 className={`text-[28px] leading-tight sm:text-4xl ${r.chrome}`}>Kavram Avı</h1>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  Tanımı oku, harflerin üzerinden parmağını kaydırarak kelimeleri kur ve gizli kavramı yakala!
                </p>
              </header>
            }
          />
        </div>
      </main>
    </div>
  );
}
