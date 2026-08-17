import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { importUnits } from '@/app/src/lib/yillikPlan/importer';
import type { ParsedRow } from '@/app/src/lib/yillikPlan/docxParser';

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { rows?: ParsedRow[]; lessonId?: number; gradeId?: number } | null;
  const rows = body?.rows;
  const lessonId = Number(body?.lessonId);
  const gradeId = Number(body?.gradeId);

  if (!Array.isArray(rows) || !rows.length || !Number.isFinite(lessonId) || !Number.isFinite(gradeId)) {
    return NextResponse.json({ error: 'rows, lessonId ve gradeId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { logs, result } = await importUnits(supabase, rows, lessonId, gradeId);
  return NextResponse.json({ logs, result });
}
