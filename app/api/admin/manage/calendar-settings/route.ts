import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('curriculum_calendar_settings')
    .select('term_start_date, updated_at')
    .eq('id', 1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ termStartDate: data?.term_start_date ?? null, updatedAt: data?.updated_at ?? null });
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { termStartDate?: unknown } | null;
  const termStartDate = body?.termStartDate;

  if (typeof termStartDate !== 'string' || !DATE_RE.test(termStartDate)) {
    return NextResponse.json({ error: 'Geçersiz tarih (YYYY-MM-DD bekleniyor)' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('curriculum_calendar_settings')
    .upsert({ id: 1, term_start_date: termStartDate, updated_at: new Date().toISOString(), updated_by: admin.user.id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
