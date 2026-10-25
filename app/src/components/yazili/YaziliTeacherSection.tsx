'use client';

// Yazılı sayfasının "Öğretmenler için" bölümü (2026-10-25): MEB senaryo tablosu, kağıt indirme ve
// "Yazılı hazırla" öğrenciye değil öğretmene hitap ediyor — sayfanın sonunda kapalı durur, admin ya da
// onaylı öğretmen için kendiliğinden açılır. İçerik sunucuda çizilir (ISR), açık/kapalı yalnız istemcide.
import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useIsTeacherOrAdmin } from '@/app/src/components/yazili/PaperDownloads';
import r from '@/app/src/components/robotic/robotic.module.css';

export function YaziliTeacherSection({ children }: { children: ReactNode }) {
  const isTeacher = useIsTeacherOrAdmin();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (isTeacher && ref.current) ref.current.open = true;
  }, [isTeacher]);
  // Yan menüdeki "Öğretmen misiniz?" bağlantısı (#ogretmenler-icin) bölümü açar.
  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === '#ogretmenler-icin' && ref.current) ref.current.open = true;
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);

  return (
    <details ref={ref} id="ogretmenler-icin" className={`group p-5 sm:p-6 ${r.panel}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className={`block ${r.label}`}>Öğretmenler için</span>
          <span className={`mt-1 block text-lg font-bold uppercase text-default ${r.display}`}>Kapsam, kağıtlar ve yazılı hazırlama</span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 transition-transform group-open:rotate-180 ${r.accent}`} aria-hidden="true" />
      </summary>
      <div className="mt-5 flex flex-col gap-6">{children}</div>
    </details>
  );
}
