import { NextRequest, NextResponse } from 'next/server';
import { getTeacherAccess } from '@/app/src/lib/teacherAuth';
import { buildTeacherPaperHtml, resolvePaperRequest } from '@/app/src/lib/yazili/teacher';

// Yazılı hazırla → "Önizle": PDF'in basıldığı HTML'in aynısı (Chromium yok — anında ve CPU'suz). Ekranda
// A4 kağıt gibi görünsün diye yalnız ekran için sayfa çerçevesi eklenir; istemci sandbox'lı iframe'de gösterir.
export const dynamic = 'force-dynamic';

// Dar ekranda kağıt yeniden dizilmez, A4 düzeni korunup küçültülür (iframe'de betik yok → kademeli zoom).
const ZOOM_STEPS: [number, number][] = [[840, 0.95], [760, 0.86], [680, 0.76], [600, 0.67], [520, 0.58], [450, 0.5], [400, 0.45], [360, 0.4]];
const SCREEN_A4 = `<style>@media screen {
  html { background: #d9dee6; }
  body { background: #fff; width: 210mm; min-height: 297mm; margin: 16px auto; padding: 12mm; box-sizing: border-box; box-shadow: 0 6px 24px rgba(15, 23, 42, .18); }
}
${ZOOM_STEPS.map(([w, z]) => `@media screen and (max-width: ${w}px) { body { zoom: ${z}; } }`).join('\n')}</style>`;

export async function POST(request: NextRequest) {
  const access = await getTeacherAccess();
  if (!access.ok) return NextResponse.json({ error: 'Bu alan sadece öğretmenler içindir' }, { status: access.reason === 'login' ? 401 : 403 });

  const resolved = await resolvePaperRequest(access, await request.json().catch(() => null));
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  const html = buildTeacherPaperHtml(resolved.req).replace('</head>', `${SCREEN_A4}</head>`);
  return NextResponse.json({ html }, { headers: { 'Cache-Control': 'private, no-store' } });
}
