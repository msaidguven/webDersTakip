import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Korumalı rotalar - sadece giriş yapmış kullanıcılar erişebilir
const protectedRoutes = ['/profil', '/panel', '/admin'];

// Auth rotaları - giriş yapmış kullanıcılar erişemez (login/register)
const authRoutes = ['/login', '/register'];

// Supabase auth cookie'lerini kontrol et
function hasAuthCookie(request: NextRequest): boolean {
  const cookies = request.cookies;
  
  // Proje-specific cookie'ler (sb-<project-ref>-auth-token formatı)
  const projectRef = 'pwzbjhgrhkcdyowknmhe';
  const possibleAuthCookies = [
    `sb-${projectRef}-auth-token`,
    'sb-auth-token',
    'sb-access-token',
    'sb-refresh-token',
    'supabase-auth-token',
  ];
  
  // Tüm cookie'leri kontrol et
  for (const cookie of cookies.getAll()) {
    // Supabase auth cookie'lerini tespit et
    if (cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')) {
      return true;
    }
    if (possibleAuthCookies.includes(cookie.name) && cookie.value) {
      return true;
    }
    // Supabase session cookie'leri
    if (cookie.name.includes('supabase') && cookie.value) {
      return true;
    }
  }
  
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Auth durumunu kontrol et
  const isAuthenticated = hasAuthCookie(request);

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
