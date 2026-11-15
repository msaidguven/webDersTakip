// app/api/internal/revalidate/route.ts
// Vercel dışında çalışan worker'ların (GitHub Actions, bkz. scripts/run-worker.ts) ürettiği içerik
// yayınlanınca ilgili sayfaların önbelleğini düşürmesi için — Next'in revalidatePath/Tag'i yalnız
// site sunucusunun içinden çağrılabilir. Diğer worker uçlarıyla aynı gizli anahtarı kullanır.
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';
import type { RevalidationPayload } from '@/app/src/lib/cacheInvalidation';

const MAX_PATHS = 2000;
const MAX_TAGS = 200;

function authorized(request: NextRequest): boolean {
  const secret = process.env.RAG_QUEUE_WORKER_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Partial<RevalidationPayload> | null;
  const paths = Array.isArray(body?.paths) ? body.paths : [];
  const tags = Array.isArray(body?.tags) ? body.tags : [];
  const validPath = (p: unknown): p is RevalidationPayload['paths'][number] => {
    const entry = p as { path?: unknown; type?: unknown } | null;
    return (
      typeof entry?.path === 'string' &&
      entry.path.startsWith('/') &&
      entry.path.length <= 500 &&
      (entry.type === undefined || entry.type === 'layout' || entry.type === 'page')
    );
  };
  if (paths.length > MAX_PATHS || tags.length > MAX_TAGS || !paths.every(validPath) || !tags.every((t) => typeof t === 'string' && t.length > 0 && t.length <= 200)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  for (const { path, type } of paths) revalidatePath(path, type);
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return NextResponse.json({ paths: paths.length, tags: tags.length });
}
