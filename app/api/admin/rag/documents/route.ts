import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { processRagDocument } from '@/app/src/lib/rag/processDocument';

const BUCKET = 'rag-documents';

// PDF metne çevirme artık sayfa-bazlı Gemini çağrılarına bölünüyor (bkz.
// pdfExtract.ts); büyük kitaplarda varsayılan süreyi aşabiliyor.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const gradeId = request.nextUrl.searchParams.get('gradeId');
  const lessonId = request.nextUrl.searchParams.get('lessonId');
  const supabase = createServiceClient();

  let query = supabase
    .from('rag_documents')
    .select('id, grade_id, lesson_id, unit_id, source, title, page_count, chunk_count, status, error_message, created_at, units(title)')
    .order('created_at', { ascending: false });
  if (gradeId) query = query.eq('grade_id', Number(gradeId));
  if (lessonId) query = query.eq('lesson_id', Number(lessonId));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [] });
}

// PDF, Vercel function'ların ~4.5MB'lık istek gövdesi limitine takılmaması için
// bu route'a hiç gönderilmiyor: tarayıcı dosyayı önce doğrudan Supabase Storage'a
// yüklüyor (bkz. RagDocumentsPanel.tsx), buraya sadece storage yolu geliyor.
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
  // Tarayıcı yükleme yolu her zaman "{gradeId}-{lessonId}/..." önekiyle oluşturuluyor;
  // başka bir sınıf/dersin klasöründeki dosya buraya bağlanamasın diye doğruluyoruz.
  if (!filePath.startsWith(`${gradeId}-${lessonId}/`)) {
    return NextResponse.json({ error: 'Geçersiz dosya yolu' }, { status: 400 });
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

  const { data: downloaded, error: downloadError } = await supabase.storage.from(BUCKET).download(filePath);
  if (downloadError || !downloaded) {
    return NextResponse.json({ error: `Yüklenen dosya bulunamadı: ${downloadError?.message || ''}` }, { status: 404 });
  }
  const buffer = Buffer.from(await downloaded.arrayBuffer());

  const { data: document, error: insertError } = await supabase
    .from('rag_documents')
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

  // Büyük kitaplarda (onlarca sayfa-batch'i) işlem maxDuration'ı (300sn) aşıp
  // fonksiyon platform tarafından sessizce (hiçbir catch/finally çalışmadan)
  // öldürülebiliyor — bu durumda satır kalıcı olarak 'processing'de takılı
  // kalıyordu (2026-09-08'de canlıda gözlemlendi). Bu yarış, gerçek kill'den
  // önce satırı 'failed' olarak işaretleyip admin panelinde görünür kılıyor.
  const SOFT_TIMEOUT_MS = 270_000;
  try {
    await Promise.race([
      processRagDocument(supabase, document.id, gradeId, lessonId, fileName, buffer),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('İşlem zaman aşımına uğradı (PDF çok büyük olabilir) — daha küçük parçalara bölüp tekrar deneyin.')), SOFT_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('RAG belge işleme hatası', message);
    // status='processing' koruması: processRagDocument kendi hatasında satırı
    // zaten 'failed' yazmış olabilir, ya da ilk segment bu sırada 'ready' olmuş
    // olabilir — sadece hâlâ 'processing'de takılı kalanı güncelliyoruz.
    await supabase
      .from('rag_documents')
      .update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() })
      .eq('id', document.id)
      .eq('status', 'processing');
  }

  return NextResponse.json({ id: document.id });
}
