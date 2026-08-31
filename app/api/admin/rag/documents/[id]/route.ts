import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const BUCKET = 'rag-documents';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const documentId = Number(id);
  if (!Number.isFinite(documentId)) return NextResponse.json({ error: 'Geçersiz id' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: document } = await supabase
    .from('rag_documents')
    .select('file_path')
    .eq('id', documentId)
    .maybeSingle();
  if (!document) return NextResponse.json({ error: 'Belge bulunamadı' }, { status: 404 });

  // rag_document_chunks, ON DELETE CASCADE ile otomatik silinir.
  const { error: deleteError } = await supabase.from('rag_documents').delete().eq('id', documentId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  await supabase.storage.from(BUCKET).remove([document.file_path]);

  return NextResponse.json({ ok: true });
}
