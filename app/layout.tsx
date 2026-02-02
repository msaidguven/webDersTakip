import type { Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { metadata, viewport as customViewport } from "./metadata";
import { AuthProvider } from "./src/context/AuthContext";
import { MainLayout } from "./src/components/MainLayout";
import { StructuredData } from "./src/components/StructuredData";

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
    <html lang="tr">
      <head>
        <StructuredData />
        <script dangerouslySetInnerHTML={{ __html: setThemeScript }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <MainLayout>
            {children}
          </MainLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
