// "Robotik kontrol paneli" teması yazı tipleri (2026-10-19). Kökte roboticFontVars sınıfını ver;
// robotic.module.css bu değişkenleri (--font-r-display/body/mono) kullanır.
import { Chakra_Petch, Inter, JetBrains_Mono } from 'next/font/google';

const display = Chakra_Petch({ subsets: ['latin', 'latin-ext'], weight: ['500', '600', '700'], variable: '--font-r-display', display: 'swap' });
const body = Inter({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-r-body', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], weight: ['500', '600'], variable: '--font-r-mono', display: 'swap' });

export const roboticFontVars = `${display.variable} ${body.variable} ${mono.variable}`;
