import type { Metadata, Viewport } from "next";
import { unstable_cache } from "next/cache";
import { SITE_URL } from "./src/lib/site";
import { formatGradeRange } from "./src/lib/homeMapping";
import { createAnonClient } from "@/utils/supabase/server-anon";

// Aktif sınıf seviyeleri (1 saat önbellekli) — site başlığı/açıklaması sınıf eklendikçe kendiliğinden
// güncellensin (2026-09-27: sınıflar her hafta ekleniyor, hedef 5-12; eskiden elle "5-8. Sınıf"
// yazıyordu ama 8. sınıf yoktu). Hata olursa boş liste → metinler sınıf aralığı olmadan kurulur.
const getActiveGradeLevels = unstable_cache(
  async (): Promise<number[]> => {
    try {
      const { data } = await createAnonClient().from("grades").select("order_no").eq("is_active", true);
      return ((data as { order_no: number | null }[] | null) || []).map((g) => g.order_no ?? 0).filter((n) => n > 0);
    } catch {
      return [];
    }
  },
  ["active-grade-levels"],
  { revalidate: 3600 }
);

export async function buildSiteMetadata(): Promise<Metadata> {
  const levels = await getActiveGradeLevels();
  const range = formatGradeRange(levels); // "5, 6 ve 7. sınıf" / "5-8. sınıf" / ""
  const titleRange = range ? range.replace(/sınıf$/, "Sınıf") : "";
  const title = titleRange ? `Ders Takip - ${titleRange} Konu Anlatımı ve Soru Bankası` : "Ders Takip - Konu Anlatımı ve Soru Bankası";
  const description = `${range ? `${range} için ` : ""}MEB müfredatına uygun konu anlatımları, cevap anahtarlı soru bankası ve kişisel testler.`;
  return {
    ...metadata,
    title: { default: title, template: "%s | Ders Takip" },
    description,
    keywords: [
      "ders takip",
      "konu anlatımı",
      "soru bankası",
      "online test",
      "MEB müfredatı",
      ...[...new Set(levels)].sort((a, b) => a - b).map((l) => `${l}. sınıf`),
    ],
    openGraph: { ...metadata.openGraph, title, description },
    twitter: { ...metadata.twitter, title, description },
  };
}

// Ana metadata yapılandırması — sınıfa bağlı metinler (title/description/keywords/OG) üstteki
// buildSiteMetadata'da üretiliyor; buradakiler sınıftan bağımsız sabitler.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Ders Takip - Konu Anlatımı ve Soru Bankası",
    template: "%s | Ders Takip",
  },
  description: "MEB müfredatına uygun konu anlatımları, cevap anahtarlı soru bankası ve kişisel testler.",
  authors: [{ name: "Ders Takip", url: SITE_URL }],
  creator: "Ders Takip",
  publisher: "Ders Takip",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: SITE_URL,
    siteName: "Ders Takip",
    title: "Ders Takip - Konu Anlatımı ve Soru Bankası",
    description: "MEB müfredatına uygun konu anlatımları, cevap anahtarlı soru bankası ve kişisel testler.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ders Takip - Online Eğitim Platformu",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ders Takip - Konu Anlatımı ve Soru Bankası",
    description: "MEB müfredatına uygun konu anlatımları, cevap anahtarlı soru bankası ve kişisel testler.",
    images: ["/og-image.png"],
    creator: "@derstakip",
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "tr-TR": SITE_URL,
    },
  },
  // Search Console / Yandex Webmaster'dan alınan gerçek doğrulama kodlarıyla değiştirilmeli.
  verification: {
    google: "fLSAOZnCMbw8ijTZLGgxVAwUqQXNmM9Eu8WjFWwPWKg",
    yandex: "88223de3e720ca00",
  },
  category: "education",
  classification: "Education",
  // "Ana ekrana ekle" + iPhone bildirimleri için (bkz. app/manifest.ts, public/sw.js — 2026-09-27).
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Ders Takip",
    statusBarStyle: "default",
  },
};

// Viewport yapılandırması
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f0f11" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

// JSON-LD Structured Data
export const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Ders Takip",
  url: SITE_URL,
  description: "MEB müfredatına uygun konu anlatımı, soru bankası ve online test platformu",
  inLanguage: "tr-TR",
  publisher: {
    "@type": "Organization",
    name: "Ders Takip",
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/logo.png`,
    },
  },
};

// Eğitim Platformu Structured Data
export const educationalAppData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Ders Takip",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "TRY",
  },
  description: "MEB müfredatına uygun online test ve konu anlatım platformu",
};
