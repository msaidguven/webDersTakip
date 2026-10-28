'use client';

// Öğretmen anasayfası (2026-10-22, 2026-10-26 sıfırdan sadeleştirildi): üstte selamlama + hafta + tek ana eylem
// (Yazılı hazırla); ortada Derslerim (ders sekmeli, bkz. TeacherLessonsQuick); altta üç kısa liste yan yana —
// Araçlar, Tüm sınıflar, Yaklaşan yazılılar. Kutu ızgarası yok, her şey satır. Onay yalnız rozeti açar
// (2026-10-28, bkz. teacherAuth.ts): araçlar onaysız öğretmene de açık.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { TeacherVerifiedBadge } from '@/app/src/components/teacher/TeacherVerifiedBadge';
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
          {isVerified && <div className="mt-2"><TeacherVerifiedBadge verified /></div>}
        </div>
        <Link href="/ogretmen/yazili" className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-5 text-sm font-bold ${r.btnNeon} ${r.btnText}`}>
          Yazılı hazırla <ChevronRight className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        </Link>
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
