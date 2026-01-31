## Project snapshot ✅
- Framework: **Next.js (App Router)** (see `app/` folder). Server components by default; add `"use client"` at the top of a file to opt into client components.
- Language: **TypeScript** (strict mode on in `tsconfig.json`).
- Styling: **Tailwind CSS** imported via `app/globals.css` (`@import "tailwindcss"`) and CSS variables for light/dark in the same file.
- Fonts: Loaded via `next/font/google` in `app/layout.tsx` using the `variable` option (e.g., `Geist` & `Geist_Mono`).
- Images: Use `next/image` and store assets in `public/` (examples: `/next.svg`, `/vercel.svg`).

---

## Key workflows & commands ⚙️
- Dev server: `npm run dev` → runs `next dev`
- Build: `npm run build` → runs `next build`; use `npm start` to run the built app
- Lint: `npm run lint` (configured by `eslint.config.mjs` using `eslint-config-next` presets)
- No test runner detected in repository (add tests if you introduce business logic)

---

## Conventions & patterns 🧭
- Routing: Add pages by creating nested folders under `app/`. Example: `app/subjects/page.tsx` → route `/subjects`.
- Server vs Client:
  - Files in `app/` are **React Server Components** by default. Use `"use client"` (first line) when the file uses client hooks (e.g., `useState`, `useEffect`).
  - Export `metadata` from route files or `layout.tsx` for route metadata (see `app/layout.tsx`).
- TypeScript: Keep `strict: true` and use exported types where available (e.g., `Metadata` from `next`).
- Imports: Path alias `@/*` maps to project root per `tsconfig.json` (`"paths"` setting).
- Styling:
  - Global variables and color scheme use `:root` and `prefers-color-scheme` in `app/globals.css`.
  - Tailwind utility classes are used pervasively (e.g., `dark:bg-black`, `flex`, `min-h-screen`).
- Linting: `eslint.config.mjs` composes `eslint-config-next` presets; respect its default ignores (e.g., `.next/**`).

---

## Integration & deployment notes 🔌
- Intended for Vercel (project scaffolded with Create Next App). Use standard Vercel settings for Next.js 16+.
- When adding dependencies, match the major versions in `package.json` (Next 16, React 19, TypeScript 5).
- PostCSS/Tailwind: `postcss.config.mjs` includes `@tailwindcss/postcss` plugin.

---

## Practical suggestions for AI edits ✍️
- When adding UI routes/components: place files under `app/` and follow server/client rules; add `"use client"` only when necessary.
- Prefer `next/font/google` for fonts and `next/image` for images to keep performance patterns consistent with the project.
- Small UI change example (client component):

```tsx
// app/counter/page.tsx
"use client";
import { useState } from "react";
export default function Counter(){
  const [n,setN]=useState(0);
  return <button onClick={()=>setN(n+1)}>Clicked {n} times</button>;
}
```

- Before changing build or runtime behavior, run `npm run build` locally to catch type or config regressions.

---

## Where to look in this repo 🔍
- Root scripts & deps: `package.json`
- App entry/layout: `app/layout.tsx` and `app/page.tsx`
- Global styles: `app/globals.css`
- Lint config: `eslint.config.mjs`
- Tailwind postcss config: `postcss.config.mjs`
- TypeScript config & path aliases: `tsconfig.json`

---

If anything here is unclear or you'd like more rules (e.g., commit message style, branching rules, or component naming conventions), tell me which area you want expanded and I'll update this file. 🚀