'use client';

// Soru bankası konu sayfasında girişli öğrenci için üst başlığı sadeleştirir:
// - Sunucu HTML'i (SEO / misafir / öğretmen) olduğu gibi kalır (rozetler + Kazanım kutusu açık).
// - Girişli öğrencide (useProfileRole() === 'student') SEO rozetleri gizlenir ve Kazanım tek satırlık
//   açılır ("Kazanımı gör") alana dönüşür; böylece Konu Gelişimin karnesi mobilde ilk ekrana girer.
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { useProfileRole } from '@/app/src/hooks/useIsAdmin';
import r from '@/app/src/components/robotic/robotic.module.css';

export function StudentTopicHeaderWrapper({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const role = useProfileRole();
  const isStudent = isAuthenticated && role === 'student';

  return (
    <div className={isStudent ? '[&_.sb-seo-pills]:hidden' : undefined}>
      {children}
    </div>
  );
}

export function TopicLearningOutcome({ text }: { text: string }) {
  const { isAuthenticated } = useAuth();
  const role = useProfileRole();
  const isStudent = isAuthenticated && role === 'student';

  if (isStudent) {
    return (
      <details className="group mt-3">
        <summary className={`inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-default ${r.mono}`}>
          <span>Kazanımı gör</span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <p className={`mt-2 rounded-r-xl border-l-[3px] ${r.neonBorder} bg-background px-3.5 py-2 text-sm text-muted-foreground`}>
          <span className="font-semibold text-default">Kazanım:</span> {text}
        </p>
      </details>
    );
  }

  return (
    <p className={`mt-4 rounded-r-xl border-l-[3px] ${r.neonBorder} bg-background px-4 py-2.5 text-sm text-muted-foreground`}>
      <span className="font-semibold text-default">Kazanım:</span> {text}
    </p>
  );
}
