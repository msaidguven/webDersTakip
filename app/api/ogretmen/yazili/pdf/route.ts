import { NextRequest, NextResponse } from 'next/server';
import { getTeacherAccess } from '@/app/src/lib/teacherAuth';
import { htmlToA4Pdf } from '@/app/src/lib/htmlToPdf';
import { buildTeacherPaperHtml, resolvePaperRequest } from '@/app/src/lib/yazili/teacher';

// Öğretmen paneli → Yazılı hazırla → "Sınav kağıdı" / "Cevap anahtarı" PDF'i (öğretmenin seçtiği sıra ve
// puanlarla). Doğrulama resolvePaperRequest'te; PDF üretimi örnek kağıtla aynı (htmlToPdf).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const access = await getTeacherAccess();
  if (!access.ok) return NextResponse.json({ error: 'Bu alan sadece onaylı öğretmenler içindir' }, { status: access.reason === 'login' ? 401 : 403 });

  const resolved = await resolvePaperRequest(access, await request.json().catch(() => null));
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  const { req, fileBase } = resolved;

  try {
    const pdf = await htmlToA4Pdf(buildTeacherPaperHtml(req));
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileBase}${req.answerKey ? '-cevap-anahtari' : ''}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[ogretmen/yazili/pdf] PDF üretilemedi:', err);
    return NextResponse.json({ error: 'PDF üretilemedi, tekrar deneyin' }, { status: 500 });
  }
}
