import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
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
    redirect('/login?redirectTo=/profil');
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
