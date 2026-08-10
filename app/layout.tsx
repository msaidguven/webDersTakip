import type { Viewport } from "next";
import { Inter } from "next/font/google";
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "./globals.css";
import { metadata, viewport as customViewport } from "./metadata";
import { AuthProvider } from "./src/context/AuthContext";
import { MainLayout } from "./src/components/MainLayout";
import { StructuredData } from "./src/components/StructuredData";
import { PrimeReactProvider } from "primereact/api";

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
      </head>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <PrimeReactProvider>
          <AuthProvider>
            <MainLayout>
              {children}
            </MainLayout>
          </AuthProvider>
          <StructuredData />
        </PrimeReactProvider>
      </body>
    </html>
  );
}