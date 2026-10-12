import type { Config } from "tailwindcss";

// Tema değişkenine bağlı renk; saydamlık eki (bg-card/60, dark:bg-surface/95) çalışsın diye color-mix ile.
// Düz "var(--x)" iken Tailwind bu ekleri sessizce ÜRETMİYORDU (2026-10-12: karanlık temada üst/alt menü beyaz kalıyordu).
const tokenColor = (cssVar: string) => `color-mix(in srgb, var(${cssVar}) calc(<alpha-value> * 100%), transparent)`;

const config: Config = {
  // .dark (html) altında karanlık; AMA .light ile işaretli bölgelerde (her zaman açık kalan soru/slayt
  // sahnesi, admin'in açık tema seçimi) dark: varyantları uygulanmaz — tema değişkenleri .light'ta zaten
  // açık değerlere dönüyor (globals.css), sınıflar da onlarla tutarlı kalsın (2026-10-12: karanlık temada
  // beyaz soru sahnesindeki yazılar okunmuyordu).
  darkMode: ["variant", "&:is(.dark *):not(:is(.light, .light *))"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tema yüzeyleri (globals.css --surface*) — önceden Tailwind'de tanımsızdı, bg-surface/95 üretilmiyordu.
        surface: {
          DEFAULT: tokenColor('--surface'),
          elevated: tokenColor('--surface-elevated'),
        },
        background: tokenColor('--background'),
        foreground: tokenColor('--foreground'),
        card: {
          DEFAULT: tokenColor('--card'),
          foreground: tokenColor('--card-foreground'),
        },
        popover: {
          DEFAULT: tokenColor('--popover'),
          foreground: tokenColor('--popover-foreground'),
        },
        primary: {
          DEFAULT: tokenColor('--primary'),
          foreground: tokenColor('--primary-foreground'),
        },
        secondary: {
          DEFAULT: tokenColor('--secondary'),
          foreground: tokenColor('--secondary-foreground'),
        },
        muted: {
          DEFAULT: tokenColor('--muted'),
          foreground: tokenColor('--muted-foreground'),
        },
        accent: {
          DEFAULT: tokenColor('--accent'),
          foreground: tokenColor('--accent-foreground'),
        },
        destructive: {
          DEFAULT: tokenColor('--destructive'),
          foreground: tokenColor('--destructive-foreground'),
        },
        border: tokenColor('--border'),
        input: tokenColor('--input'),
        ring: tokenColor('--ring'),
        chart: {
          "1": tokenColor('--chart-1'),
          "2": tokenColor('--chart-2'),
          "3": tokenColor('--chart-3'),
          "4": tokenColor('--chart-4'),
          "5": tokenColor('--chart-5'),
        },
        sidebar: {
          DEFAULT: tokenColor('--sidebar'),
          foreground: tokenColor('--sidebar-foreground'),
          primary: tokenColor('--sidebar-primary'),
          "primary-foreground": tokenColor('--sidebar-primary-foreground'),
          accent: tokenColor('--sidebar-accent'),
          "accent-foreground": tokenColor('--sidebar-accent-foreground'),
          border: tokenColor('--sidebar-border'),
          ring: tokenColor('--sidebar-ring'),
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;