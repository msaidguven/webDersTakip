import type { NextConfig } from "next";

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
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["sharp", "@resvg/resvg-js"],
  // sharp'ın native binary'leri (libvips .so dosyaları) sharp'ın kendi kodu
  // içinde process.platform/arch'a göre dinamik require ile yükleniyor. Next.js'in
  // build sırasında yaptığı statik dosya izleme (output file tracing) bu dinamik
  // require'ı göremiyor ve libvips-cpp.so'yu Vercel fonksiyon paketine dahil etmiyor,
  // bu da "ERR_DLOPEN_FAILED: libvips-cpp.so ... cannot open shared object file"
  // hatasıyla sonuçlanıyor. Bu görsel yükleme rotaları için binary'leri elle dahil ediyoruz.
  outputFileTracingIncludes: {
    "/api/admin/topic-sections/**": SHARP_LINUX_X64_TRACE_INCLUDES,
    "/api/ogretmen/export/**": RESVG_LINUX_X64_TRACE_INCLUDES,
  },
  images: {
    domains: [],
  },
  async redirects() {
    return [
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
