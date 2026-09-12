import { redirect } from 'next/navigation';

// Ayrı bir "Öğretmen Girişi/Kaydı" sayfası kaldırıldı (kullanıcı isteği, 2026-09-12) —
// öğrenci/öğretmen ayrımı artık tek kayıt formunda (/register) yapılıyor. Bu route eski
// bağlantılar/yer imleri kırılmasın diye SADECE oraya yönlendiriyor.
export default function OgretmenKayitPage() {
  redirect('/register');
}
