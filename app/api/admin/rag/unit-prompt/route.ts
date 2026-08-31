import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// 50MB Storage limitini aşan PDF'ler için: admin bu prompt'u NotebookLM'e
// (kaynak olarak kitabın PDF'ini yüklediği notebook'ta) sorar, dönen düz metni
// /api/admin/rag/documents/from-text ile sisteme kaydeder.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const unitId = Number(request.nextUrl.searchParams.get('unitId'));
  if (!Number.isFinite(unitId)) return NextResponse.json({ error: 'unitId gerekli' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: unit } = await supabase
    .from('units')
    .select('id, title, grade_id, lesson_id')
    .eq('id', unitId)
    .maybeSingle();
  if (!unit) return NextResponse.json({ error: 'Ünite bulunamadı' }, { status: 404 });

  const [{ data: grade }, { data: lesson }] = await Promise.all([
    supabase.from('grades').select('name').eq('id', unit.grade_id).maybeSingle(),
    supabase.from('lessons').select('name').eq('id', unit.lesson_id).maybeSingle(),
  ]);

  const templatePath = path.join(process.cwd(), 'app', 'prompt', '13-rag-unit-text.md');
  const template = await readFile(templatePath, 'utf8');

  const prompt = template
    .replaceAll('{grade}', grade?.name || '')
    .replaceAll('{lesson}', lesson?.name || '')
    .replaceAll('{unit}', unit.title);

  return NextResponse.json({
    prompt,
    unitTitle: unit.title,
    gradeId: unit.grade_id,
    lessonId: unit.lesson_id,
  });
}
