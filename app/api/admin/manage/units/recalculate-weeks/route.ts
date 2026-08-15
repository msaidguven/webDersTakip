import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { recalculateUnitWeeks } from '@/app/src/lib/recalculateUnitWeeks';

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { lessonId?: unknown; gradeId?: unknown } | null;
  const lessonId = Number(body?.lessonId);
  const gradeId = Number(body?.gradeId);
  if (!Number.isFinite(lessonId) || !Number.isFinite(gradeId)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const result = await recalculateUnitWeeks(supabase, lessonId, gradeId);
  return NextResponse.json(result);
}
