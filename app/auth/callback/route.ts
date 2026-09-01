import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Google (ve ileride eklenebilecek başka OAuth sağlayıcıların) giriş akışının
// döndüğü yer: Supabase bize bir "code" verir, bunu oturuma çeviriyoruz. İlk kez
// giriş yapan bir Google kullanıcısının profiles tablosunda satırı olmaz (o satır
// e-posta/şifre kayıt formunda elle oluşturuluyordu) — burada yoksa Google'ın
// verdiği ad/avatar ile bir tane oluşturuyoruz ki geri kalan uygulama (rol
// kontrolü, avatar gösterimi, RAG/yorum akışları vb.) sorunsuz çalışsın.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawRedirect = searchParams.get('redirectTo') || '/';
  // Açık yönlendirme (open redirect) riskine karşı sadece aynı site içi, göreli
  // yollara izin veriyoruz.
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!existingProfile) {
        const meta = data.user.user_metadata || {};
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: meta.full_name || meta.name || null,
          avatar_url: meta.avatar_url || meta.picture || null,
          role: 'student',
        });
      }

      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
