// app/soru/[id]/route.ts
// LEGACY — sadece redirect, yeni UI'dan buraya link VERME.
// Eski tekil soru paylaşım sayfası — artık burada render YOK, sadece 301/308 (kalıcı)
// yönlendirme var. Hedef, sorunun ait olduğu konunun /soru-bankasi sayfası, aynı soru
// id'si ?soru= parametresiyle taşınıyor (bkz. app/soru-bankasi/.../page.tsx). Böylece daha
// önce paylaşılmış/backlink verilmiş /soru/[id] linkleri kırılmıyor.
//
// BİLEREK bir page.tsx (Server Component) DEĞİL, bir Route Handler: bu projede
// 'next/navigation'ın redirect()/permanentRedirect()'i sayfa bileşenlerinden çağrıldığında
// gerçek bir HTTP 3xx ÜRETMİYOR (mevcut Next.js 16.1.6 kurulumunda doğrulandı — hatasız,
// sessizce 200 + not-found içeriği dönüyor; zaten var olan
// app/[gradeSlug]/[lessonSlug]/icerik/page.tsx'teki redirect() de aynı şekilde etkileniyor,
// bu proje genelinde ayrı, önceden var olan bir sorun). 'next/server'ın
// NextResponse.redirect()'i (Route Handler) ise doğru çalışıyor, o yüzden burada o
// kullanılıyor.
import { NextResponse, type NextRequest } from 'next/server';
import { getPublicQuestionContext } from '@/app/src/lib/publicQuestion';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const questionId = Number(id);
  if (!Number.isFinite(questionId) || questionId <= 0) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const context = await getPublicQuestionContext(questionId);
  if (!context) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const target = `/soru-bankasi/${context.gradeSlug}/${context.lessonSlug}/${context.unitSlug}/${context.topicSlug}?soru=${questionId}`;
  return NextResponse.redirect(new URL(target, request.url), 308);
}
