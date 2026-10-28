import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { sendTeacherVerificationEmail } from '@/app/src/lib/emailVerification';

// Öğretmen profilindeki "Doğrulama e-postasını gönder" (ilk gönderim kayıtta yapılır; bkz. api/auth/register).
export async function POST() {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

  const service = createServiceClient();
  const { data } = await service.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle();
  const profile = data as { role: string | null; full_name: string | null } | null;
  if (profile?.role !== 'teacher') return NextResponse.json({ error: 'Yalnız öğretmen hesapları içindir' }, { status: 403 });

  const result = await sendTeacherVerificationEmail(service, user.id, user.email, profile.full_name);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
}
