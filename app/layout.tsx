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
  return (
    <html lang="tr" className="dark">
      <head>
        <StructuredData />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-[#0f0f11] text-white`}>
        <AuthProvider>
          <MainLayout>
            {children}
          </MainLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
