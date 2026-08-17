import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Eski site sürümünde konu adresleri "fb-5-4-3-..." gibi kod önekiyle başlıyordu
// (ör. fb-5-4-3-tam-golgenin-olusumu). Artık slug'lar sadece açıklayıcı kısmı
// içeriyor (tam-golgenin-olusumu). Google'da hâlâ bu eski önekli adresler
// indeksli olduğu için, konu sayfası adreslerinde bu önek görülürse atıp
// kalıcı olarak yeni adrese yönlendiriyoruz.
const LEGACY_TOPIC_SLUG = /^[a-z]{2,5}-\d+-\d+-\d+-(.+)$/;

// Eski site sürümünde bir konunun soru/test sayfası, konu slug'ının sonuna
// "-sorular" eklenerek adresleniyordu (ör. .../gruplar-ve-roller-sorular).
// Artık konu testi ayrı bir "kavrama-testi" alt adresinde; bu önekli eski
// adresler gelirse eki atıp yeni konu kavrama testi adresine yönlendiriyoruz.
const LEGACY_SORULAR_SUFFIX = /^(.+)-sorular$/;

export function middleware(request: NextRequest) {
  // Admin sayfalarına erişimi kontrol et
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Rewrite yerine direkt sayfaya git
    return NextResponse.rewrite(new URL(request.nextUrl.pathname, request.url));
  }

  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  if (segments.length === 4) {
    const prefixMatch = segments[3].match(LEGACY_TOPIC_SLUG);
    if (prefixMatch) {
      const newPath = `/${segments[0]}/${segments[1]}/${segments[2]}/${prefixMatch[1]}`;
      return NextResponse.redirect(new URL(newPath, request.url), 308);
    }

    const sorularMatch = segments[3].match(LEGACY_SORULAR_SUFFIX);
    if (sorularMatch) {
      const newPath = `/${segments[0]}/${segments[1]}/${segments[2]}/${sorularMatch[1]}/kavrama-testi`;
      return NextResponse.redirect(new URL(newPath, request.url), 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/admin', '/:gradeSlug/:lessonSlug/:unitSlug/:topicSlug'],
};
