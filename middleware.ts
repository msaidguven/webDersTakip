import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Eski site sürümünde konu adresleri "fb-5-4-3-..." gibi kod önekiyle başlıyordu
// (ör. fb-5-4-3-tam-golgenin-olusumu). Artık slug'lar sadece açıklayıcı kısmı
// içeriyor (tam-golgenin-olusumu). Google'da hâlâ bu eski önekli adresler
// indeksli olduğu için, konu sayfası adreslerinde bu önek görülürse atıp
// kalıcı olarak yeni adrese yönlendiriyoruz.
const LEGACY_TOPIC_SLUG = /^[a-z]{2,5}-\d+-\d+-\d+-(.+)$/;

export function middleware(request: NextRequest) {
  // Admin sayfalarına erişimi kontrol et
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Rewrite yerine direkt sayfaya git
    return NextResponse.rewrite(new URL(request.nextUrl.pathname, request.url));
  }

  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  if (segments.length === 4) {
    const match = segments[3].match(LEGACY_TOPIC_SLUG);
    if (match) {
      const newPath = `/${segments[0]}/${segments[1]}/${segments[2]}/${match[1]}`;
      return NextResponse.redirect(new URL(newPath, request.url), 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/admin', '/:gradeSlug/:lessonSlug/:unitSlug/:topicSlug'],
};
