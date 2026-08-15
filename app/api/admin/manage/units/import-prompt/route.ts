import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin } from '@/app/src/lib/adminAuth';

// app/prompt/00-unit-import.md şablonunu {grade}/{lesson}/{url} ile doldurup döner.
// Admin panelindeki "Promptu Kopyala" butonu bu metni panoya kopyalar.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const url = request.nextUrl.searchParams.get('url')?.trim() || '';
  const gradeLabel = request.nextUrl.searchParams.get('gradeLabel')?.trim() || 'ilgili sınıf';
  const lessonLabel = request.nextUrl.searchParams.get('lessonLabel')?.trim() || 'ilgili ders';

  if (!url) {
    return NextResponse.json({ error: 'url zorunlu' }, { status: 400 });
  }

  const templatePath = path.join(process.cwd(), 'app/prompt/00-unit-import.md');
  const template = await fs.readFile(templatePath, 'utf-8');

  const prompt = template
    .replaceAll('{grade}', gradeLabel)
    .replaceAll('{lesson}', lessonLabel)
    .replaceAll('{url}', url);

  return NextResponse.json({ prompt });
}
