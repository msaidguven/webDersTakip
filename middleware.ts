import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
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

// Yıllık plandan gelen bazı ünite adları "2. Öğrenme Alanı: Evimiz Dünya" biçimindeydi ve
// slug'a da "2-ogrenme-alani-evimiz-dunya" olarak girmişti (6. sınıf Sosyal Bilgiler).
// Önek DB'den kaldırıldı (bkz. supabase/migrations/units_strip_ogrenme_alani_prefix.sql);
// Google'da indekslenmiş eski adresler yeni slug'a kalıcı yönlendiriliyor.
const LEGACY_UNIT_OGRENME_ALANI = /^\d+-ogrenme-alani-(.+)$/;

// Oturum gerektiren alanlar — banlı bir kullanıcının, henüz süresi dolmamış access
// token'ıyla bu sayfalara girmesini engellemek için her istekte is_banned kontrol edilir.
const PROTECTED_PREFIXES = ['/ilerlemem', '/profil', '/admin', '/ogretmen', '/dashboard'];

// auth.users.banned_until (bkz. app/api/admin/manage/members) yeni sign-in/refresh'i
// zaten engelliyor; ama tarayıcıda hâlâ geçerli bir access token varsa o token süresi
// dolana kadar teknik olarak işlevini sürdürür. Bu kontrol profiles.is_banned'ı okuyup
// böyle bir kullanıcıyı sayfa isteği anında yakalar ve oturumunu sonlandırır.
async function isRequestBanned(request: NextRequest, response: NextResponse): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return false;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_banned')
    .eq('id', user.id)
    .maybeSingle();

  if (!(profile as { is_banned: boolean | null } | null)?.is_banned) return false;

  await supabase.auth.signOut();
  return true;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const response = NextResponse.next();

  // ?soru= paylaşım linklerinin "noindex" başlığı artık next.config.ts headers() kuralında —
  // middleware normal sayfa ziyaretlerinde hiç çalışmıyor (bkz. aşağıdaki matcher notu).

  if (PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    if (await isRequestBanned(request, response)) {
      const redirect = NextResponse.redirect(new URL('/banned', request.url));
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }
  }

  // Admin sayfalarına erişimi kontrol et
  if (pathname.startsWith('/admin')) {
    // Rewrite yerine direkt sayfaya git
    return NextResponse.rewrite(new URL(pathname, request.url));
  }

  const segments = pathname.split('/').filter(Boolean);

  // Ünite slug'ı: /[sınıf]/[ders]/[ünite]/... → index 2; /soru-bankasi/[sınıf]/[ders]/[ünite]/... → index 3
  const unitIndex = segments[0] === 'soru-bankasi' ? 3 : 2;
  const unitMatch = segments[unitIndex]?.match(LEGACY_UNIT_OGRENME_ALANI);
  if (unitMatch && !pathname.startsWith('/admin') && !pathname.startsWith('/api')) {
    const fixed = [...segments];
    fixed[unitIndex] = unitMatch[1];
    const url = new URL(`/${fixed.join('/')}`, request.url);
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url, 308);
  }

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

  return response;
}

// Middleware SADECE gerektiği yerde çalışır (2026-10-02): önceden tüm konu/ünite/soru bankası
// sayfalarında çalışıyordu ve Vercel aktif CPU'sunun ~%24'ünü (ayda ~1,7 sa) yiyordu, oysa bu
// sayfalardaki tek işi nadir eski URL yönlendirmeleri + ?soru= noindex başlığıydı. Artık:
// - giriş gerektiren sayfalar (ban kontrolü),
// - eski URL biçimleri: "<n>-ogrenme-alani-<ünite>" ünite slug'ı, "<kod>-<n>-<n>-<n>-<konu>"
//   konu slug'ı ve "<konu>-sorular" — regex'ler aşağıdaki LEGACY_* sabitleriyle AYNI olmalı.
// ?soru= noindex başlığı next.config.ts headers()'ta (CPU harcamayan statik kural).
export const config = {
  matcher: [
    '/admin/:path*',
    '/admin',
    '/ilerlemem/:path*',
    '/ilerlemem',
    '/profil/:path*',
    '/profil',
    '/ogretmen/:path*',
    '/ogretmen',
    '/dashboard/:path*',
    '/dashboard',
    '/:gradeSlug/:lessonSlug/:unitSlug(\\d+-ogrenme-alani-[^/]+)/:rest*',
    '/soru-bankasi/:sinif/:ders/:unite(\\d+-ogrenme-alani-[^/]+)/:rest*',
    '/:gradeSlug/:lessonSlug/:unitSlug/:topicSlug([a-z]{2,5}-\\d+-\\d+-\\d+-[^/]+)',
    '/:gradeSlug/:lessonSlug/:unitSlug/:topicSlug([^/]+-sorular)',
  ],
};
