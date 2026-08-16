import type { SupabaseClient } from '@supabase/supabase-js';

type ProfileRoleRow = { role: string | null };

// requireAdmin() (adminAuth.ts) 401/403 fırlatır; bu ise public SSR sayfalarında
// "ziyaretçi admin mi, yayında olmayan (is_active=false) içeriği görebilir mi"
// kontrolü için kullanılan, fırlatmayan hali.
export async function isViewerAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return (profile as ProfileRoleRow | null)?.role === 'admin';
}
