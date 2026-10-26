'use client';

// Öğretmen profili (2026-10-25): /profil aynı adres, öğretmen öğrenci istatistikleri (seri, halkalar,
// test sayıları) yerine derslerini (teacher_lessons) ve öğretmen araçlarını görür.
import Link from 'next/link';
import { ClipboardList, Hourglass, ListChecks } from 'lucide-react';
import { MAX_TEACHER_LESSONS, TeacherLessonsEditor } from '@/app/src/components/teacher/TeacherLessonsEditor';
import r from '@/app/src/components/robotic/robotic.module.css';

const TOOLS = [
  { href: '/ogretmen/yazili', label: 'Yazılı hazırla', Icon: ClipboardList },
  { href: '/ogretmen', label: 'Konudan soru seç', Icon: ListChecks },
] as const;

export function TeacherProfile({ isVerified }: { isVerified: boolean }) {
  return (
    <>
      <section aria-labelledby="derslerim" className={`flex flex-col gap-4 p-5 sm:p-6 ${r.panel}`}>
        <div>
          <h2 id="derslerim" className={r.label}>Derslerim</h2>
          <p className="mt-1 text-sm text-muted-foreground">Girdiğin ya da incelemek istediğin dersleri seç (en fazla {MAX_TEACHER_LESSONS}). Anasayfan ve öğretmen paneli buna göre gelir.</p>
        </div>
        <TeacherLessonsEditor />
      </section>

      {isVerified ? (
        <nav aria-label="Öğretmen araçları" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TOOLS.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={`flex items-center gap-3 rounded-2xl p-4 font-bold text-default ${r.item}`}>
              <span className={`h-10 w-10 shrink-0 ${r.chipBox}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
              {label}
            </Link>
          ))}
        </nav>
      ) : (
        <section className={`flex items-start gap-3 p-5 ${r.panel}`}>
          <span className={`h-10 w-10 shrink-0 ${r.chipBox}`}><Hourglass className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <h2 className="font-bold text-default">Hesabın onay bekliyor</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Yönetici onayladıktan sonra öğretmen paneline erişebilirsin.</p>
          </div>
        </section>
      )}
    </>
  );
}
