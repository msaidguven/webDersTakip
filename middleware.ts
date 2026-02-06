import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Admin sayfalarına erişimi kontrol et
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Rewrite yerine direkt sayfaya git
    return NextResponse.rewrite(new URL(request.nextUrl.pathname, request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/admin'],
};
