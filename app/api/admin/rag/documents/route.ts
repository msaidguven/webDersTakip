import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { processRagDocument } from '@/app/src/lib/rag/processDocument';

const BUCKET = 'rag-documents';
const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const topicId = request.nextUrl.searchParams.get('topicId');
  const supabase = createServiceClient();

  let query = supabase
    .from('rag_documents')
    .select('id, topic_id, title, page_count, chunk_count, status, error_message, created_at')
    .order('created_at', { ascending: false });
  if (topicId) query = query.eq('topic_id', Number(topicId));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [] });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  const topicIdRaw = formData?.get('topicId');
  const topicId = typeof topicIdRaw === 'string' ? Number(topicIdRaw) : NaN;

  if (!Number.isFinite(topicId)) {
    return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });
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

  const { data: topic } = await supabase.from('topics').select('id').eq('id', topicId).maybeSingle();
  if (!topic) return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = `${topicId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: 'application/pdf' });
  if (uploadError) {
    return NextResponse.json({ error: `Dosya yüklenemedi: ${uploadError.message}` }, { status: 500 });
  }

  const { data: document, error: insertError } = await supabase
    .from('rag_documents')
    .insert({
      topic_id: topicId,
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
    await processRagDocument(supabase, document.id, topicId, buffer);
  } catch (err) {
    // processRagDocument zaten rag_documents.status='failed' yazdı; admin panelinde görünür.
    const message = err instanceof Error ? err.message : String(err);
    console.error('RAG belge işleme hatası', message);
  }

  return NextResponse.json({ id: document.id });
}
