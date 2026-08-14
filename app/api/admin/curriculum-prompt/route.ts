import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';

// Ders sayfası header'ındaki "Müfredat Prompt'u" butonunun kaynağı: bu sınıf/ders
// için müfredatın Claude Code'a hazırlatılmasını başlatacak hazır talimatı döner.
// Şablon app/prompt/00-curriculum-kickoff.md dosyasında tutulur (01/02 promptlarıyla
// aynı klasörde) — düzenlemek için kod değil, o dosya güncellenir.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const gradeName = request.nextUrl.searchParams.get('grade');
  const lessonName = request.nextUrl.searchParams.get('lesson');
  if (!gradeName || !lessonName) {
    return NextResponse.json({ error: 'grade ve lesson parametreleri gerekli' }, { status: 400 });
  }

  const templatePath = path.join(process.cwd(), 'app', 'prompt', '00-curriculum-kickoff.md');
  const template = await readFile(templatePath, 'utf8');

  const prompt = template.replaceAll('{grade}', gradeName).replaceAll('{lesson}', lessonName);

  return NextResponse.json({ prompt });
}
