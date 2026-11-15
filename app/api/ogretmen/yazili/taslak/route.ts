import { NextRequest, NextResponse } from 'next/server';
import { getTeacherAccess } from '@/app/src/lib/teacherAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { listTeacherExams } from '@/app/src/lib/yazili/teacher';

// Öğretmenin kağıt taslağını hesabına kaydeder (teacher_paper_drafts). İstemci her değişiklikte (bekletmeli) gönderir.
// Sorular yalnız biçim olarak doğrulanır: kağıt üretilirken (pdf/word/önizleme) her soru zaten yazılının havuzunda
// yeniden doğrulanıyor, havuzda olmayan id'ler orada reddedilir.
const MAX_ITEMS = 60;

export async function PUT(request: NextRequest) {
  const auth = await getTeacherAccess();
  if (!auth.ok) return NextResponse.json({ error: auth.reason === 'login' ? 'Oturum gerekli' : 'Bu alan sadece öğretmenler içindir' }, { status: auth.reason === 'login' ? 401 : 403 });

  const b = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const examId = Number(b.examId);
  const rawItems = Array.isArray(b.items) ? b.items : null;
  if (!Number.isInteger(examId) || !rawItems || rawItems.length > MAX_ITEMS) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }
  const items: { id: number; points: number; auto?: boolean }[] = [];
  for (const it of rawItems as Record<string, unknown>[]) {
    const id = Number(it?.id);
    const points = Number(it?.points);
    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(points) || points < 0 || points > 100) {
      return NextResponse.json({ error: 'Geçersiz soru' }, { status: 400 });
    }
    items.push(it.auto === true ? { id, points: Math.round(points), auto: true } : { id, points: Math.round(points) });
  }

  // Yalnız erişebildiği yazılılar için kayıt (öğretmen kendi branşı, admin hepsi).
  const exams = await listTeacherExams(auth);
  if (!exams.some((e) => e.id === examId)) return NextResponse.json({ error: 'Bu yazılıya erişimin yok' }, { status: 403 });

  const { error } = await createServiceClient().from('teacher_paper_drafts').upsert({
    teacher_id: auth.user.id,
    exam_id: examId,
    items,
    auto_points: b.autoPoints !== false,
    title: typeof b.title === 'string' ? b.title.slice(0, 120) : null,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: 'Kaydedilemedi' }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
