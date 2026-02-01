import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EduSmart - Ders Takip ve Öğrenme Platformu",
  description: "EduSmart ile derslerinizi takip edin, konu testleri çözün ve haftalık değerlendirmelerle öğrenmenizi güçlendirin. 5-8. sınıf matematik ve fen bilimleri içerikleri.",
  keywords: ["ders takip", "eğitim", "matematik", "fen bilimleri", "online test", "konu anlatımı", "5. sınıf", "6. sınıf", "7. sınıf", "8. sınıf"],
  authors: [{ name: "EduSmart" }],
  creator: "EduSmart",
  publisher: "EduSmart",
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "https://edusmart.vercel.app",
    siteName: "EduSmart",
    title: "EduSmart - Ders Takip ve Öğrenme Platformu",
    description: "EduSmart ile derslerinizi takip edin, konu testleri çözün ve haftalık değerlendirmelerle öğrenmenizi güçlendirin.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "EduSmart - Ders Takip Platformu",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EduSmart - Ders Takip ve Öğrenme Platformu",
    description: "EduSmart ile derslerinizi takip edin, konu testleri çözün ve haftalık değerlendirmelerle öğrenmenizi güçlendirin.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://edusmart.vercel.app",
  },
  verification: {
    google: "your-google-verification-code",
  },
};
