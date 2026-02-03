import { createClient } from '@/utils/supabase/server';
import ProfilClient from './ProfilClient';

// Force dynamic rendering for user-specific data
export const dynamic = 'force-dynamic';

async function getUserData() {
  console.log('[getUserData] Kullanici bilgisi cekiliyor...');
  const supabase = await createClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('[getUserData] Auth hatasi:', error);
    return null;
  }
  
  if (!user) {
    console.log('[getUserData] Kullanici bulunamadi (giris yapilmamis)');
    return null;
  }
  
  console.log('[getUserData] Kullanici bulundu:', user.id);
  return user;
}

export default async function ProfilPage() {
  console.log('[ProfilPage] Sayfa yukleniyor...');
  const user = await getUserData();
  
  if (!user) {
    console.log('[ProfilPage] Kullanici yok, login sayfasina yonlendiriliyor');
    // Otomatik yonlendirme yerine manuel giris ekrani gosteriyoruz (Donguyu kirmak icin)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-default p-4">
        <h1 className="text-2xl font-bold text-default mb-4">Oturum Doğrulanamadı</h1>
        <p className="text-muted mb-8 text-center max-w-md">
          Güvenlik nedeniyle oturum bilginize erişilemedi. Lütfen tekrar giriş yapın.
        </p>
        <a href="/login?redirectTo=/profil" className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">
          Giriş Yap
        </a>
      </div>
    );
  }
  
  console.log('[ProfilPage] Kullanici var, profil gosteriliyor');

  // Pass minimal user data to client
  const userData = {
    id: user.id,
    email: user.email,
    fullName: user.user_metadata?.full_name || 'Öğrenci',
    avatarUrl: user.user_metadata?.avatar_url || null,
  };

  return <ProfilClient user={userData} />;
}
