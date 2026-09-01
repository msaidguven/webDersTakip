import { redirect } from 'next/navigation';

// Panelin eski, yanıtsız (non-responsive) ve "Ali" gibi sabit sahte veriler içeren
// bir kopyasıydı — tek gerçek sürüm artık /panel. Eski link/bookmark'lar kırılmasın
// diye 404 yerine oraya yönlendiriyoruz.
export default function DashboardPage() {
  redirect('/panel');
}
