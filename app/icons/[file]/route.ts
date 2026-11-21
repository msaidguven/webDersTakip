import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

// Firebase App Hosting'de 2 segmentli /icons/<dosya> isteklerinin app/[gradeSlug]/[lessonSlug]
// dinamik rotasına düşmesini engeller ve public/icons içindeki PNG ikonlarını doğrudan servis eder.
const ALLOWED_ICONS = new Set([
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'badge-96.png',
]);

export async function GET(
  _req: Request,
  context: { params: Promise<{ file: string }> },
) {
  const { file } = await context.params;
  if (!ALLOWED_ICONS.has(file)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  try {
    const absPath = path.join(process.cwd(), 'public', 'icons', file);
    const bytes = await readFile(absPath);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }
}
