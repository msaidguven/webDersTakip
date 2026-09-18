import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { processTeacherGuideDocument } from '@/app/src/lib/teacherGuide/processTeacherGuideDocument';

const BUCKET = 'teacher-guide-documents';

// PDF, sayfa-bazlı Gemini çağrılarına bölünüyor (bkz. pdfExtract.ts); büyük kılavuz
// kitaplarında varsayılan süreyi aşabiliyor — rag/documents/route.ts ile aynı desen.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const gradeId = request.nextUrl.searchParams.get('gradeId');
  const lessonId = request.nextUrl.searchParams.get('lessonId');
  const supabase = createServiceClient();

  let query = supabase
    .from('teacher_guide_documents')
    .select('id, grade_id, lesson_id, unit_id, source, title, page_count, topic_count, status, error_message, created_at, units(title)')
    .order('created_at', { ascending: false });
  if (gradeId) query = query.eq('grade_id', Number(gradeId));
  if (lessonId) query = query.eq('lesson_id', Number(lessonId));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [] });
}

// PDF, tarayıcıdan doğrudan Supabase Storage'a yükleniyor (bkz. TeacherGuideDocumentsPanel.tsx),
// buraya sadece storage yolu geliyor — rag/documents/route.ts ile aynı desen (Vercel'in
// ~4.5MB istek gövdesi limitine takılmamak için).
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as
    | { gradeId?: unknown; lessonId?: unknown; filePath?: unknown; fileName?: unknown }
    | null;
  const gradeId = Number(body?.gradeId);
  const lessonId = Number(body?.lessonId);
  const filePath = typeof body?.filePath === 'string' ? body.filePath : '';
  const fileName = typeof body?.fileName === 'string' ? body.fileName : filePath;

  if (!Number.isFinite(gradeId) || !Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'gradeId ve lessonId gerekli' }, { status: 400 });
  }
  if (!filePath) return NextResponse.json({ error: 'filePath gerekli' }, { status: 400 });
  if (!filePath.startsWith(`${gradeId}-${lessonId}/`)) {
    return NextResponse.json({ error: 'Geçersiz dosya yolu' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: lessonGrade } = await supabase
    .from('lesson_grades')
    .select('lesson_id')
    .eq('grade_id', gradeId)
    .eq('lesson_id', lessonId)
    .maybeSingle();
  if (!lessonGrade) return NextResponse.json({ error: 'Bu sınıf/ders kombinasyonu bulunamadı' }, { status: 404 });

  const [{ data: grade }, { data: lesson }] = await Promise.all([
    supabase.from('grades').select('name').eq('id', gradeId).maybeSingle(),
    supabase.from('lessons').select('name').eq('id', lessonId).maybeSingle(),
  ]);

  const { data: downloaded, error: downloadError } = await supabase.storage.from(BUCKET).download(filePath);
  if (downloadError || !downloaded) {
    return NextResponse.json({ error: `Yüklenen dosya bulunamadı: ${downloadError?.message || ''}` }, { status: 404 });
  }
  const buffer = Buffer.from(await downloaded.arrayBuffer());

  const { data: document, error: insertError } = await supabase
    .from('teacher_guide_documents')
    .insert({
      grade_id: gradeId,
      lesson_id: lessonId,
      title: fileName,
      file_path: filePath,
      status: 'processing',
      uploaded_by: admin.user.id,
    })
    .select('id')
    .single();

  if (insertError || !document) {
    await supabase.storage.from(BUCKET).remove([filePath]);
    return NextResponse.json({ error: insertError?.message || 'Belge kaydedilemedi' }, { status: 500 });
  }

  // rag/documents/route.ts'deki soft-timeout deseniyle aynı: maxDuration (300sn) aşılırsa
  // fonksiyon sessizce öldürülüp satır kalıcı 'processing'de takılı kalmasın diye.
  const SOFT_TIMEOUT_MS = 270_000;
  try {
    await Promise.race([
      processTeacherGuideDocument(
        supabase,
        document.id,
        gradeId,
        lessonId,
        (grade as { name: string } | null)?.name || '',
        (lesson as { name: string } | null)?.name || '',
        buffer
      ),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('İşlem zaman aşımına uğradı (PDF çok büyük olabilir) — NotebookLM ile ünite bazında ekleyin.')), SOFT_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Kılavuz belge işleme hatası', message);
    await supabase
      .from('teacher_guide_documents')
      .update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() })
      .eq('id', document.id)
      .eq('status', 'processing');
  }

  return NextResponse.json({ id: document.id });
}
