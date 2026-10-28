// Öğretmen onay rozeti (2026-10-28): onay araçları açmaz (hepsi onaysız öğretmene de açık, bkz. teacherAuth.ts),
// yalnız "Onaylı öğretmen" rozetini verir; ileride öğrenci takibi de onaya bağlanacak.
import { BadgeCheck } from 'lucide-react';
import r from '@/app/src/components/robotic/robotic.module.css';

// Onaysız öğretmene hiçbir şey gösterilmez (2026-10-28 kullanıcı kararı: onayın şimdilik bir karşılığı yok,
// "onay bekliyor" uyarısı öğretmeni rahatsız etmesin).
export function TeacherVerifiedBadge({ verified }: { verified: boolean }) {
  if (!verified) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 ${r.badge}`}>
      <BadgeCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" /> Onaylı öğretmen
    </span>
  );
}
