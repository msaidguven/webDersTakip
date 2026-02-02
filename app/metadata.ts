import type { Metadata, Viewport } from "next";

// Ana metadata yapılandırması
export const metadata: Metadata = {
  metadataBase: new URL("https://derstakip.vercel.app"),
  title: {
    default: "Ders Takip - 5-8. Sınıf Online Test ve Konu Anlatımı",
    template: "%s | Ders Takip",
  },
  description: "5-8. sınıf matematik ve fen bilimleri için haftalık müfredata uygun konu anlatımları, interaktif testler ve kazanım değerlendirmeleri. MEB müfredatı ile tam uyumlu.",
  keywords: [
    "ders takip", 
    "online test", 
    "konu anlatımı",
    "5. sınıf matematik",
    "6. sınıf matematik", 
    "7. sınıf matematik",
    "8. sınıf matematik",
    "fen bilimleri",
    "MEB müfredatı",
    "haftalık test",
    "kazanım değerlendirme",
    "eğitim",
    "öğrenme platformu"
  ],
  authors: [{ name: "Ders Takip", url: "https://derstakip.vercel.app" }],
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
    url: "https://derstakip.vercel.app",
    siteName: "Ders Takip",
    title: "Ders Takip - 5-8. Sınıf Online Test ve Konu Anlatımı",
    description: "MEB müfredatına uygun haftalık konu anlatımları ve interaktif testler. Matematik ve fen bilimleri için kapsamlı öğrenme platformu.",
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
    title: "Ders Takip - 5-8. Sınıf Online Test ve Konu Anlatımı",
    description: "MEB müfredatına uygun haftalık konu anlatımları ve interaktif testler.",
    images: ["/og-image.png"],
    creator: "@derstakip",
  },
  alternates: {
    canonical: "https://derstakip.vercel.app",
    languages: {
      "tr-TR": "https://derstakip.vercel.app",
    },
  },
  verification: {
    google: "your-google-verification-code",
    yandex: "your-yandex-verification-code",
  },
  category: "education",
  classification: "Education",
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
  url: "https://derstakip.vercel.app",
  description: "5-8. sınıf matematik ve fen bilimleri için online test ve konu anlatım platformu",
  inLanguage: "tr-TR",
  publisher: {
    "@type": "Organization",
    name: "Ders Takip",
    logo: {
      "@type": "ImageObject",
      url: "https://derstakip.vercel.app/logo.png",
    },
  },
  potentialAction: {
    "@type": "SearchAction",
    target: "https://derstakip.vercel.app/search?q={search_term_string}",
    "query-input": "required name=search_term_string",
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
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "1250",
  },
};
