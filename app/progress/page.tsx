import { redirect } from 'next/navigation';

// Ayrı istatistik sayfası kaldırıldı — panelin kendi İstatistik kartları (StatsRow)
// aynı bilgiyi zaten gösteriyor. Eski link/bookmark'lar kırılmasın diye /panel'e
// yönlendiriyoruz (bkz. app/dashboard/page.tsx'teki aynı desen).
export default function ProgressPage() {
  redirect('/panel');
}
