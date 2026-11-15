// app/src/lib/cacheInvalidation.ts
// Sayfa önbelleği geçersiz kılma çağrılarının tek kapısı. Kod Next sunucusunda çalışırken doğrudan
// next/cache'i çağırır. Worker'lar Vercel DIŞINDA (GitHub Actions → scripts/run-worker.ts) çalışırken
// ortada Next sunucusu yoktur: istekler biriktirilir ve çalışma sonunda flushRemoteRevalidation() ile
// sitedeki /api/internal/revalidate ucuna TEK istekte gönderilir. Mod, WORKER_REVALIDATE_URL ortam
// değişkeniyle seçilir (yalnız betik ortamında tanımlı).
import { revalidatePath as nextRevalidatePath, revalidateTag as nextRevalidateTag } from 'next/cache';

export type RevalidatePathType = 'layout' | 'page';
export interface RevalidationPayload {
  paths: { path: string; type?: RevalidatePathType }[];
  tags: string[];
}

const pendingPaths = new Map<string, { path: string; type?: RevalidatePathType }>();
const pendingTags = new Set<string>();

const isRemote = () => !!process.env.WORKER_REVALIDATE_URL;

export function revalidatePath(path: string, type?: RevalidatePathType): void {
  if (isRemote()) pendingPaths.set(`${type ?? ''}:${path}`, { path, type });
  else nextRevalidatePath(path, type);
}

// Etiketli önbelleği hemen düşürür (bayat yanıt sunulmaz).
export function expireTag(tag: string): void {
  if (isRemote()) pendingTags.add(tag);
  else nextRevalidateTag(tag, { expire: 0 });
}

// Yalnız betik modunda iş yapar. Hata fırlatmaz: yenileme ulaşmazsa sayfalar haftalık yenilemede düzelir,
// üretilen içerik kaybolmaz — ama sessiz de kalmaz, çağıran sonucu loglar.
export async function flushRemoteRevalidation(): Promise<{ sent: number; error?: string }> {
  const url = process.env.WORKER_REVALIDATE_URL;
  const sent = pendingPaths.size + pendingTags.size;
  if (!url || sent === 0) return { sent: 0 };
  const payload: RevalidationPayload = { paths: [...pendingPaths.values()], tags: [...pendingTags] };
  pendingPaths.clear();
  pendingTags.clear();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RAG_QUEUE_WORKER_SECRET ?? ''}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
    return res.ok ? { sent } : { sent: 0, error: `HTTP ${res.status}` };
  } catch (e) {
    return { sent: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
