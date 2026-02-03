import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Korumalı rotalar - sadece giriş yapmış kullanıcılar erişebilir
const protectedRoutes = ['/profil', '/panel', '/admin'];

// Auth rotaları - giriş yapmış kullanıcılar erişemez (login/register)
const authRoutes = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Token cookie'den al
  const token = request.cookies.get('sb-auth-token')?.value;
  const isAuthenticated = !!token;

  // Korumalı sayfaya erişmeye çalışıyor ve giriş yapmamış
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
  
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Auth sayfasına erişmeye çalışıyor ve giriş yapmış - anasayfaya yönlendir
  const isAuthRoute = authRoutes.some(route => pathname === route);
  
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
};
