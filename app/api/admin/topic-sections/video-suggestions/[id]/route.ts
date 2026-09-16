import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

interface Params {
  id: string;
}

// Admin listeden kötü/alakasız bir öneriyi kalıcı silebilir — onaylama bundan bağımsız
// (bkz. section/[sectionId]/video PATCH), onaylanan öneri de burada kalmaya devam eder.
export async function DELETE(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const supabase = createServiceClient();

  const { error } = await supabase.from('topic_section_video_suggestions').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Silinemedi' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
