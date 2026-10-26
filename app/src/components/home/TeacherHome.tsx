'use client';

// Öğretmen anasayfası (2026-10-22, 2026-10-26 sıfırdan sadeleştirildi): üstte selamlama + hafta + tek ana eylem
// (Yazılı hazırla); ortada Derslerim (ders sekmeli, bkz. TeacherLessonsQuick); altta üç kısa liste yan yana —
// Araçlar, Tüm sınıflar, Yaklaşan yazılılar. Kutu ızgarası yok, her şey satır. Onay bekleyen öğretmene durum
// yazılır — panel sayfaları da onaysız hesabı zaten içeri almıyor (bkz. teacherAuth.ts).
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight, Hourglass } from 'lucide-react';
import r from '@/app/src/components/robotic/robotic.module.css';
import { ListCard, RowLink, TeacherLessonsQuick } from './TeacherLessonsQuick';
import type { ThisWeekTopicItem } from '@/app/src/lib/homeHighlights';

const TOOLS = [
  { href: '/ogretmen', label: 'Konudan soru seç' },
  { href: '/yazili-sorulari', label: 'Yazılı soruları' },
  { href: '/yillik-plan', label: 'Yıllık plan' },
  { href: '/ders-takip-cizelgesi', label: 'Ders takip çizelgesi' },
] as const;

export function TeacherHome({
  firstName,
  isVerified,
  grades,
  thisWeek,
  upcomingExams,
}: {
  firstName: string | null;
  isVerified: boolean;
  grades: { id: string; slug?: string; name: string }[];
  thisWeek: { week: number; byGradeId: Record<string, ThisWeekTopicItem[]> };
  upcomingExams?: ReactNode;
}) {
  return (
    <section aria-labelledby="ogretmen-baslik" className="flex flex-col gap-8">
      <div className={`flex flex-col gap-4 rounded-[22px] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7 ${r.panel} ${r.hero}`}>
        <span className={r.scan} aria-hidden="true" />
        <div>
          <p className={r.label}>Öğretmen paneli · {thisWeek.week}. öğretim haftası</p>
          <h1 id="ogretmen-baslik" className={`mt-1 text-[26px] leading-tight sm:text-3xl ${r.chrome}`}>
            {firstName ? `Merhaba, ${firstName} Hocam` : 'Merhaba Hocam'}
          </h1>
        </div>
        {isVerified ? (
          <Link href="/ogretmen/yazili" className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-5 text-sm font-bold ${r.btnNeon} ${r.btnText}`}>
            Yazılı hazırla <ChevronRight className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
          </Link>
        ) : (
          <p className="flex max-w-sm items-start gap-2 text-sm text-muted-foreground">
            <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
            Hesabın onay bekliyor. Yönetici onaylayınca yazılı hazırlayabilirsin.
          </p>
        )}
      </div>

      <TeacherLessonsQuick grades={grades} thisWeek={thisWeek} />

      <div className="grid grid-cols-1 items-start gap-4 lg:auto-cols-fr lg:grid-flow-col">
        <ListCard title="Araçlar" id="araclar-baslik">
          <ul className="flex flex-col gap-2">
            {TOOLS.map(({ href, label }) => (
              <li key={href}>
                <RowLink href={href}><span className="font-semibold text-default">{label}</span></RowLink>
              </li>
            ))}
          </ul>
        </ListCard>

        {/* Derslerim'de olmayan bir dersi incelemek için: sınıf sayfası o sınıfın tüm dersleri. */}
        <ListCard title="Tüm sınıflar" id="tum-siniflar">
          <ul className="flex flex-col gap-2">
            {grades.map((g) => g.slug && (
              <li key={g.slug}>
                <RowLink href={`/${g.slug}`}>
                  <span className="font-semibold text-default">{g.name}</span>
                  <span className="text-sm text-muted-foreground"> · Tüm dersler</span>
                </RowLink>
              </li>
            ))}
          </ul>
        </ListCard>

        {upcomingExams}
      </div>
    </section>
  );
}
