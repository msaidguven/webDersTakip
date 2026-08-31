import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { processRagDocument } from '@/app/src/lib/rag/processDocument';

const BUCKET = 'rag-documents';
const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const gradeId = request.nextUrl.searchParams.get('gradeId');
  const lessonId = request.nextUrl.searchParams.get('lessonId');
  const supabase = createServiceClient();

  let query = supabase
    .from('rag_documents')
    .select('id, grade_id, lesson_id, title, page_count, chunk_count, status, error_message, created_at')
    .order('created_at', { ascending: false });
  if (gradeId) query = query.eq('grade_id', Number(gradeId));
  if (lessonId) query = query.eq('lesson_id', Number(lessonId));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [] });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  const gradeId = Number(formData?.get('gradeId'));
  const lessonId = Number(formData?.get('lessonId'));

  if (!Number.isFinite(gradeId) || !Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'gradeId ve lessonId gerekli' }, { status: 400 });
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Sadece PDF yükleyebilirsiniz' }, { status: 400 });
  }
  if (file.size > MAX_PDF_SIZE) {
    return NextResponse.json({ error: 'Dosya 20MB\'tan büyük olamaz' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // lesson_grades: bu dersin gerçekten bu sınıfta okutulduğunu doğrular.
  const { data: lessonGrade } = await supabase
    .from('lesson_grades')
    .select('lesson_id')
    .eq('grade_id', gradeId)
    .eq('lesson_id', lessonId)
    .maybeSingle();
  if (!lessonGrade) return NextResponse.json({ error: 'Bu sınıf/ders kombinasyonu bulunamadı' }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = `${gradeId}-${lessonId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: 'application/pdf' });
  if (uploadError) {
    return NextResponse.json({ error: `Dosya yüklenemedi: ${uploadError.message}` }, { status: 500 });
  }

  const { data: document, error: insertError } = await supabase
    .from('rag_documents')
    .insert({
      grade_id: gradeId,
      lesson_id: lessonId,
      title: file.name,
      file_path: storagePath,
      status: 'processing',
      uploaded_by: admin.user.id,
    })
    .select('id')
    .single();

  if (insertError || !document) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: insertError?.message || 'Belge kaydedilemedi' }, { status: 500 });
  }

  try {
    await processRagDocument(supabase, document.id, gradeId, lessonId, buffer);
  } catch (err) {
    // processRagDocument zaten rag_documents.status='failed' yazdı; admin panelinde görünür.
    const message = err instanceof Error ? err.message : String(err);
    console.error('RAG belge işleme hatası', message);
  }

  return NextResponse.json({ id: document.id });
}
