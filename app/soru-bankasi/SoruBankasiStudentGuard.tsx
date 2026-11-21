'use client';

// Giriş yapmış öğrencinin /soru-bankasi dizin sayfasındaki yönlendirmesi:
//  - Sınıfı belliyse doğrudan kendi sınıfının soru bankasına (/soru-bankasi/<sinif>) geçer.
//  - Sınıfı henüz seçilmemişse tüm sınıfları göstermek yerine önce sınıfını seçmesini ister.
//  - Misafir, öğretmen ve admin (öğrenci önizlemesi hariç) normal ISR sınıf listesini görür (SEO korunur).
import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, GraduationCap, Loader2 } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { useProfileRole } from '@/app/src/hooks/useIsAdmin';
import { useMyProfileBasics } from '@/app/src/hooks/useMyGradeSlug';
import { buildSoruBankasiGradePath } from '@/app/src/lib/soruBankasiPaths';
import r from '@/app/src/components/robotic/robotic.module.css';

export function SoruBankasiStudentGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const role = useProfileRole();
  const basics = useMyProfileBasics();

  const isStudent = isAuthenticated && role === 'student';
  const gradeSlug = basics?.gradeSlug ?? null;

  useEffect(() => {
    if (isStudent && gradeSlug) {
      router.replace(buildSoruBankasiGradePath(gradeSlug));
    }
  }, [isStudent, gradeSlug, router]);

  // Misafir, öğretmen veya admin: ISR ile gelen sınıf listesini olduğu gibi göster.
  if (authLoading || !isAuthenticated || (role !== null && role !== 'student')) {
    return <>{children}</>;
  }

  // Rol veya profil bilgisi henüz yükleniyorsa ya da kendi sınıfına yönlendiriliyorsa kısa bekleme.
  if (role === null || basics === null || gradeSlug) {
    return (
      <section className={`mt-6 sm:mt-10 flex items-center justify-center gap-3 p-8 text-sm text-muted-foreground ${r.panel}`}>
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>Sınıfının soru bankasına yönlendiriliyorsun…</span>
      </section>
    );
  }

  // Girişli öğrenci ama sınıfını henüz seçmemiş.
  return (
    <section
      aria-labelledby="sinif-sec-uyari"
      className={`mt-6 sm:mt-10 flex flex-col items-start gap-4 p-6 sm:p-8 ${r.panel}`}
    >
      <div className="flex items-center gap-3">
        <span className={`h-11 w-11 shrink-0 rounded-2xl ${r.chipBox}`} aria-hidden="true">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div>
          <span className={`inline-flex items-center gap-2 ${r.label}`}>
            <i className={r.led} aria-hidden="true" />
            Sınıf seçimi gerekli
          </span>
          <h2 id="sinif-sec-uyari" className="mt-1 text-lg font-extrabold text-default sm:text-xl">
            Önce sınıfını seç
          </h2>
        </div>
      </div>
      <p className="max-w-[58ch] text-sm leading-relaxed text-muted-foreground">
        Soru bankasında kendi sınıfının derslerini ve sorularını doğrudan görmek için profilinden sınıfını seçmen gerekiyor.
      </p>
      <Link
        href="/profil?next=/soru-bankasi"
        className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white ${r.btnNeon} ${r.btnText}`}
      >
        Sınıfını seç
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
