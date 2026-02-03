import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ProfilClient from './ProfilClient';

// Force dynamic rendering for user-specific data
export const dynamic = 'force-dynamic';

async function getUserData() {
  const supabase = createClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

export default async function ProfilPage() {
  const user = await getUserData();
  
  if (!user) {
    redirect('/login?redirectTo=/profil');
  }

  // Pass minimal user data to client
  const userData = {
    id: user.id,
    email: user.email,
    fullName: user.user_metadata?.full_name || 'Öğrenci',
    avatarUrl: user.user_metadata?.avatar_url || null,
  };

  return <ProfilClient user={userData} />;
}
