import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const BUCKET = 'teacher-guide-documents';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const documentId = Number(id);
  if (!Number.isFinite(documentId)) return NextResponse.json({ error: 'Geçersiz id' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: document } = await supabase
    .from('teacher_guide_documents')
    .select('file_path')
    .eq('id', documentId)
    .maybeSingle();
  if (!document) return NextResponse.json({ error: 'Belge bulunamadı' }, { status: 404 });

  // topic_teacher_guide_notes SADECE bu belgenin ürettiği (document_id hâlâ bu belgeye
  // işaret eden) notları siler — bir konu daha sonra başka bir kılavuz belgesiyle
  // güncellenmişse (upsert), o notu bu silme etkilemez.
  await supabase.from('topic_teacher_guide_notes').delete().eq('document_id', documentId);

  const { error: deleteError } = await supabase.from('teacher_guide_documents').delete().eq('id', documentId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (document.file_path) {
    await supabase.storage.from(BUCKET).remove([document.file_path]);
  }

  return NextResponse.json({ ok: true });
}
