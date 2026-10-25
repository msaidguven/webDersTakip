import { NextRequest, NextResponse } from 'next/server';
import { getTeacherAccess } from '@/app/src/lib/teacherAuth';
import { buildPaperDocx } from '@/app/src/lib/yazili/paperDocx';
import { resolvePaperRequest } from '@/app/src/lib/yazili/teacher';

// Öğretmen paneli → Yazılı hazırla → düzenlenebilir Word (kağıt + yeni sayfada cevap anahtarı).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const access = await getTeacherAccess();
  if (!access.ok) return NextResponse.json({ error: 'Bu alan sadece onaylı öğretmenler içindir' }, { status: access.reason === 'login' ? 401 : 403 });

  const resolved = await resolvePaperRequest(access, await request.json().catch(() => null));
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  const buffer = await buildPaperDocx(resolved.req);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${resolved.fileBase}.docx"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
