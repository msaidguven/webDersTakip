'use client';

// Öğretmen anasayfası (2026-10-22): girişli öğretmenin "/" adresi öğretmen paneli. Asıl iş (yazılı kağıdı
// hazırlama) tek büyük kartta; diğer öğretmen araçları altında. Onay bekleyen öğretmene durum yazılır —
// panel sayfaları da onaysız hesabı zaten içeri almıyor (bkz. teacherAuth.ts).
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarRange, ChevronRight, ClipboardList, FileText, Hourglass, ListChecks, Table2 } from 'lucide-react';
import r from '@/app/src/components/robotic/robotic.module.css';

const card = `rounded-[22px] ${r.panel}`;

const TOOLS = [
  { href: '/ogretmen', label: 'Konudan soru seç', text: 'Ünite ve konulardan açık uçlu soruları Word olarak indir.', Icon: ListChecks },
  { href: '/yazili-sorulari', label: 'Yazılı soruları', text: 'Öğrencilerin gördüğü yazılı sayfaları ve örnek kağıtlar.', Icon: FileText },
  { href: '/yillik-plan', label: 'Yıllık plan', text: 'Haftalara göre kazanım ve konu dağılımı.', Icon: CalendarRange },
  { href: '/ders-takip-cizelgesi', label: 'Ders takip çizelgesi', text: 'Sınıf için yazdırılabilir takip çizelgesi.', Icon: Table2 },
] as const;

export function TeacherHome({ firstName, isVerified, upcomingExams }: { firstName: string | null; isVerified: boolean; upcomingExams?: ReactNode }) {
  return (
    <section aria-labelledby="ogretmen-baslik" className="flex flex-col gap-6">
      <div className={`flex flex-col gap-5 p-5 sm:p-7 ${card} ${r.hero}`}>
        <span className={r.scan} aria-hidden="true" />
        <div>
          <p className={r.label}>Öğretmen paneli</p>
          <h1 id="ogretmen-baslik" className={`mt-1 text-[26px] leading-tight sm:text-3xl ${r.chrome}`}>
            {firstName ? `Merhaba, ${firstName} Hocam` : 'Merhaba Hocam'}
          </h1>
        </div>

        {isVerified ? (
          <div className={`flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between ${r.divider}`}>
            <div className="flex items-start gap-3">
              <span className={`h-11 w-11 shrink-0 ${r.chipBox}`}><ClipboardList className="h-5 w-5" aria-hidden="true" /></span>
              <div>
                <h2 className="text-lg font-extrabold text-default">Yazılı hazırla</h2>
                <p className="mt-0.5 max-w-[52ch] text-sm text-muted-foreground">
                  Soru havuzundan seç, MEB dağılımına göre kontrol et; kağıdı ve cevap anahtarını PDF ya da Word olarak indir.
                </p>
              </div>
            </div>
            <Link href="/ogretmen/yazili" className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-5 text-sm font-bold ${r.btnNeon} ${r.btnText}`}>
              Kağıt hazırla <ChevronRight className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className={`flex items-start gap-3 border-t pt-5 ${r.divider}`}>
            <span className={`h-11 w-11 shrink-0 ${r.chipBox}`}><Hourglass className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <h2 className="text-lg font-extrabold text-default">Hesabın onay bekliyor</h2>
              <p className="mt-0.5 max-w-[56ch] text-sm text-muted-foreground">
                Öğretmen hesapları yönetici onayından sonra açılır. Onaylanınca buradan yazılı kağıdı hazırlayıp indirebileceksin; bu sırada yazılı sorularına ve araçlara göz atabilirsin.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <nav aria-label="Öğretmen araçları" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TOOLS.map(({ href, label, text, Icon }) => (
            <Link key={href} href={href} className={`group flex items-start gap-3 rounded-2xl p-4 hover:-translate-y-0.5 ${r.item}`}>
              <span className={`h-10 w-10 shrink-0 ${r.chipBox}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <span className="min-w-0">
                <span className="block font-bold text-default">{label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{text}</span>
              </span>
            </Link>
          ))}
        </nav>
        {upcomingExams}
      </div>
    </section>
  );
}
