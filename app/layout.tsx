import type { Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import "katex/dist/katex.min.css";
import { metadata, viewport as customViewport } from "./metadata";
import { AuthProvider } from "./src/context/AuthContext";
import { MainLayout } from "./src/components/MainLayout";
import { StructuredData } from "./src/components/StructuredData";

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export { metadata };
export const viewport: Viewport = customViewport;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const setThemeScript = `(function(){try{const t=localStorage.getItem('theme');const prefersDark=window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; if(t==='dark' || (!t && prefersDark)){document.documentElement.classList.add('dark')} else {document.documentElement.classList.remove('dark')} }catch(e){} })()`;

  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: setThemeScript }}
          suppressHydrationWarning
        />
        {ADSENSE_CLIENT && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
        <AuthProvider>
          <MainLayout>
            {children}
          </MainLayout>
        </AuthProvider>
        <StructuredData />
      </body>
    </html>
  );
}