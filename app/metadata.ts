import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ders Takip - Öğrenme Platformu",
  description: "Ders Takip ile derslerinizi takip edin, konu testleri çözün ve haftalık değerlendirmelerle öğrenmenizi güçlendirin. 5-8. sınıf matematik ve fen bilimleri içerikleri.",
  keywords: ["ders takip", "eğitim", "matematik", "fen bilimleri", "online test", "konu anlatımı", "5. sınıf", "6. sınıf", "7. sınıf", "8. sınıf"],
  authors: [{ name: "Ders Takip" }],
  creator: "Ders Takip",
  publisher: "Ders Takip",
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "https://derstakip.vercel.app",
    siteName: "Ders Takip",
    title: "Ders Takip - Öğrenme Platformu",
    description: "Ders Takip ile derslerinizi takip edin, konu testleri çözün ve haftalık değerlendirmelerle öğrenmenizi güçlendirin.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ders Takip - Öğrenme Platformu",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ders Takip - Öğrenme Platformu",
    description: "Ders Takip ile derslerinizi takip edin, konu testleri çözün ve haftalık değerlendirmelerle öğrenmenizi güçlendirin.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://derstakip.vercel.app",
  },
  verification: {
    google: "your-google-verification-code",
  },
};
