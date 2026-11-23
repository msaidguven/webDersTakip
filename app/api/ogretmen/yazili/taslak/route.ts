import { NextRequest, NextResponse } from 'next/server';
import { getTeacherAccess } from '@/app/src/lib/teacherAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { listTeacherExams, loadPaperDraft } from '@/app/src/lib/yazili/teacher';

// Öğretmenin kağıt taslağını hesabından okur (GET) ve hesabına kaydeder (PUT, teacher_paper_drafts).
// Telefonda seçilen sorular hesapta saklanır, PC'de aynı yazılı açıldığında otomatik geri gelir.
const MAX_ITEMS = 60;

export async function GET(request: NextRequest) {
  const auth = await getTeacherAccess();
  if (!auth.ok) return NextResponse.json({ error: auth.reason === 'login' ? 'Oturum gerekli' : 'Bu alan sadece öğretmenler içindir' }, { status: auth.reason === 'login' ? 401 : 403 });

  if (request.nextUrl.searchParams.get('list') === '1') {
    const [exams, draftRes] = await Promise.all([
      listTeacherExams(auth),
      createServiceClient()
        .from('teacher_paper_drafts')
        .select('exam_id, items, title, updated_at')
        .eq('teacher_id', auth.user.id)
        .order('updated_at', { ascending: false })
        .limit(10),
    ]);
    const examById = new Map(exams.map((e) => [e.id, e]));
    type DraftRow = { exam_id: number; items: unknown; title: string | null; updated_at: string };
    const drafts = ((draftRes.data as DraftRow[] | null) ?? []).flatMap((row) => {
      const exam = examById.get(row.exam_id);
      const itemCount = Array.isArray(row.items) ? row.items.length : 0;
      if (!exam || itemCount === 0) return [];
      return [{
        examId: exam.id,
        gradeName: exam.gradeName,
        lessonName: exam.lessonName,
        label: exam.label,
        title: row.title?.trim() || `${exam.gradeName} ${exam.lessonName} · ${exam.label}`,
        itemCount,
        updatedAt: row.updated_at,
      }];
    });
    const upcomingExams = exams
      .filter((e): e is typeof e & { examDate: string } => Boolean(e.examDate))
      .map((e) => ({ id: e.id, gradeName: e.gradeName, lessonName: e.lessonName, label: e.label, examDate: e.examDate }));
    return NextResponse.json({ drafts, upcomingExams }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  const examId = Number(request.nextUrl.searchParams.get('examId'));
  if (!Number.isInteger(examId) || examId <= 0) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }
  const exams = await listTeacherExams(auth);
  if (!exams.some((e) => e.id === examId)) {
    return NextResponse.json({ error: 'Bu yazılıya erişimin yok' }, { status: 403 });
  }
  const draft = await loadPaperDraft(auth.user.id, examId);
  return NextResponse.json({ draft }, { headers: { 'Cache-Control': 'private, no-store' } });
}

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
