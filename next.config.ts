import type { NextConfig } from "next";
import { legacySlugRedirects } from "./app/src/lib/legacyRedirects";

const SHARP_LINUX_X64_TRACE_INCLUDES = [
  "./node_modules/@img/sharp-linux-x64/**/*",
  "./node_modules/@img/sharp-libvips-linux-x64/**/*",
];

// @resvg/resvg-js aynı sharp sorununu yaşıyor (native .node binary, platforma göre
// ayrı bir paketten dinamik require ile yükleniyor) — açık uçlu soru Word export'unda
// SVG diyagramları PNG'ye çevirmek için kullanılıyor (bkz. app/api/ogretmen/export/route.ts).
const RESVG_LINUX_X64_TRACE_INCLUDES = [
  "./node_modules/@resvg/resvg-js-linux-x64-gnu/**/*",
  "./node_modules/@resvg/resvg-js-linux-x64-musl/**/*",
  // SVG yazıları için (bkz. app/src/lib/svgToDocxImage.ts) — sunucuda sistem yazı tipi yok.
  "./public/fonts/NotoSans-Regular.ttf",
  "./public/fonts/NotoSans-Bold.ttf",
];

// @sparticuz/chromium, ders sayfasındaki "PDF Olarak İndir" için (bkz. app/api/
// topic-pdf/[topicId]/route.ts) — kendi Chromium binary'sini node_modules/@sparticuz/
// chromium/bin altında sıkıştırılmış (.br) olarak taşıyor, sharp/resvg'deki AYNI
// dinamik-require sorunu yüzünden output file tracing'e elle dahil edilmesi gerekiyor.
const CHROMIUM_TRACE_INCLUDES = [
  "./node_modules/@sparticuz/chromium/bin/**/*",
  // PDF'e gömülen matematik notasyonu (KaTeX) için — route.ts bunu process.cwd()
  // ile RUNTIME'da fs.readFileSync ediyor, sharp/resvg'deki dinamik require'la aynı
  // sebepten output file tracing bunu statik olarak göremiyor.
  "./node_modules/katex/dist/katex.min.css",
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["sharp", "@resvg/resvg-js", "@sparticuz/chromium", "puppeteer-core"],
  // sharp'ın native binary'leri (libvips .so dosyaları) sharp'ın kendi kodu
  // içinde process.platform/arch'a göre dinamik require ile yükleniyor. Next.js'in
  // build sırasında yaptığı statik dosya izleme (output file tracing) bu dinamik
  // require'ı göremiyor ve libvips-cpp.so'yu Vercel fonksiyon paketine dahil etmiyor,
  // bu da "ERR_DLOPEN_FAILED: libvips-cpp.so ... cannot open shared object file"
  // hatasıyla sonuçlanıyor. Bu görsel yükleme rotaları için binary'leri elle dahil ediyoruz.
  outputFileTracingIncludes: {
    "/api/admin/topic-sections/**": SHARP_LINUX_X64_TRACE_INCLUDES,
    "/api/ogretmen/export/**": RESVG_LINUX_X64_TRACE_INCLUDES,
    "/api/yazili/deneme/**": RESVG_LINUX_X64_TRACE_INCLUDES,
    "/api/topic-pdf/**": CHROMIUM_TRACE_INCLUDES,
    "/api/yazili-pdf/**": CHROMIUM_TRACE_INCLUDES,
    "/api/ogretmen/yazili/pdf/**": CHROMIUM_TRACE_INCLUDES,
    // Önizleme Chromium kullanmaz ama aynı şablon KaTeX CSS'ini çalışma anında okur.
    "/api/ogretmen/yazili/onizleme/**": ["./node_modules/katex/dist/katex.min.css"],
    "/api/ogretmen/yazili/word/**": RESVG_LINUX_X64_TRACE_INCLUDES,
  },
  images: {
    domains: [],
  },
  // Soru bankasına ?soru=ID paylaşım linkiyle gelindiğinde parametreli varyasyon ayrı sayfa olarak
  // indekslenmesin (canonical zaten parametresiz taban URL). Önceden middleware ekliyordu; middleware
  // her soru bankası isteğinde çalışıp Vercel aktif CPU'su harcadığı için (2026-10-02) statik kurala
  // taşındı — sayfanın ISR önbelleğine dokunmaz, searchParams sunucuda okunmaz.
  async headers() {
    return [
      {
        source: "/soru-bankasi/:path*",
        has: [{ type: "query", key: "soru" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
      },
    ];
  },
  async redirects() {
    return [
      // "Panel" → "İlerlemem" (2026-09-28): eski link/yer imleri ve alt sayfalar bozulmasın.
      { source: "/panel", destination: "/ilerlemem", permanent: true },
      { source: "/panel/:path*", destination: "/ilerlemem/:path*", permanent: true },
      // Eylül 2026'da değişen ünite/konu adresleri (Search Console 404 raporu, 2026-10-24).
      ...legacySlugRedirects,
      // Ayrı ünite/kavrama testi sayfaları kaldırıldı (2026-10-24): testler yalnız soru bankasında
      // açılıyor, yarım kalan test de oradan devam ediyor. Eski linkler/yer imleri oraya gider.
      {
        source: "/:gradeSlug((?!soru-bankasi)[^/]+)/:lessonSlug/:unitSlug/unite-testi",
        destination: "/soru-bankasi/:gradeSlug/:lessonSlug/:unitSlug",
        permanent: true,
      },
      {
        source: "/:gradeSlug((?!soru-bankasi)[^/]+)/:lessonSlug/:unitSlug/:topicSlug/kavrama-testi/:rest*",
        destination: "/soru-bankasi/:gradeSlug/:lessonSlug/:unitSlug/:topicSlug",
        permanent: true,
      },
      {
        source: "/5-sinif/fen-bilimleri/isigin-dunyasi/fb-5-4-3-tam-golgenin-olusumu",
        destination: "/5-sinif/fen-bilimleri/isigin-dunyasi/tam-golgenin-olusumu",
        permanent: true,
      },
      {
        source: "/default.aspx",
        destination: "/",
        permanent: true,
      },
      {
        source: "/Default.aspx",
        destination: "/",
        permanent: true,
      },
      {
        source: "/about.html",
        destination: "/hakkimizda",
        permanent: true,
      },
      {
        source: "/about",
        destination: "/hakkimizda",
        permanent: true,
      },
      {
        source: "/contact",
        destination: "/iletisim",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
