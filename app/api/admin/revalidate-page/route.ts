// app/api/admin/revalidate-page/route.ts
// Admin'in "Bu sayfayı yenile" düğmesi (AdminPageRefresh, 2026-10-04). Sayfalar haftalık
// önbellekte (pazar 10:00 TR yenilenir); hafta içinde düzeltilen/eklenen içerik (kapak resmi,
// hatalı soru) pazarı beklemeden görünsün diye yalnız istenen sayfaları revalidate eder. Sayfa
// hemen üretilmez — bir sonraki ziyarette bir kez üretilir (sayfa başına ~1 sn CPU).
// Düğme hangi sitede açıksa onu yeniler (canlıda canlıyı); yerel geliştirme sunucusu zaten
// önbellek tutmadığı için orada etkisizdir.
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/app/src/lib/adminAuth';

const PATH_PATTERN = /^\/$|^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/;
const BLOCKED_PREFIXES = ['/api', '/admin', '/_next'];
const MAX_PATHS = 5;

// Konu ve soru bankası konu sayfası birbirine ve ünite sayfalarına bağlı (kapak resmi, soru
// sayısı) — biri yenilenince dördü birlikte yenilenir. Slug'lardan türetilir, sorgu gerekmez.
function withRelatedPaths(path: string): string[] {
  const parts = path.split('/').filter(Boolean);
  const slugs = parts[0] === 'soru-bankasi' ? parts.slice(1) : parts;
  if (slugs.length !== 4) return [path];
  const [grade, lesson, unit, topic] = slugs;
  return [
    `/${grade}/${lesson}/${unit}/${topic}`,
    `/soru-bankasi/${grade}/${lesson}/${unit}/${topic}`,
    `/${grade}/${lesson}/${unit}`,
    `/soru-bankasi/${grade}/${lesson}/${unit}`,
  ];
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { paths?: unknown } | null;
  const requested = Array.isArray(body?.paths) ? body.paths : [];
  if (!requested.length || requested.length > MAX_PATHS) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const paths = new Set<string>();
  for (const raw of requested) {
    const path = typeof raw === 'string' ? raw.trim() : '';
    if (path.length > 300 || !PATH_PATTERN.test(path) || BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
      return NextResponse.json({ error: 'Geçersiz sayfa yolu' }, { status: 400 });
    }
    withRelatedPaths(path).forEach((p) => paths.add(p));
  }

  paths.forEach((p) => revalidatePath(p));
  return NextResponse.json({ revalidated: [...paths] });
}
