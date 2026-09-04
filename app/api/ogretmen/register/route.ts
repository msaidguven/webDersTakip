import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const MAX_LESSONS = 10;

// Öğrenci kaydından farkı: role/is_verified gibi güvenlik açısından kritik alanları
// istemciye BIRAKMIYORUZ — student kaydı (useRegisterViewModel) profiles satırını
// doğrudan client'tan (RLS ile) yazıyor, role JS'te sabit 'student'. Burada aynı
// deseni öğretmen için tekrarlamak riskli olurdu (bir client role='admin' de
// gönderebilirdi) — bu yüzden auth.signUp client'ta yapılıyor ama profil satırı
// SADECE bu sunucu route'undan, oturumu (cookie) doğrulayıp role/is_verified'ı
// burada sabitleyerek yazılıyor.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { fullName?: unknown; lessonIds?: unknown } | null;
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
  const lessonIds = Array.isArray(body?.lessonIds)
    ? (body!.lessonIds as unknown[]).filter((v): v is number => typeof v === 'number' && Number.isInteger(v))
    : [];

  if (!fullName || !lessonIds.length || lessonIds.length > MAX_LESSONS) {
    return NextResponse.json({ error: `Ad soyad ve 1-${MAX_LESSONS} arası ders (branş) gerekli` }, { status: 400 });
  }

  const service = createServiceClient();

  const { error: profileError } = await service
    .from('profiles')
    .upsert({ id: user.id, full_name: fullName, role: 'teacher', is_verified: false }, { onConflict: 'id' });
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const { error: lessonsError } = await service
    .from('teacher_lessons')
    .insert(lessonIds.map((lessonId) => ({ teacher_id: user.id, lesson_id: lessonId })));
  if (lessonsError) return NextResponse.json({ error: lessonsError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
