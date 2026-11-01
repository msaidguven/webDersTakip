import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { buildYaziliPrompt } from '@/app/src/lib/yazili/prompt';

// Yazılı soruları — konu bazlı klasik soru promptu (manuel: kopyala → AI → JSON yapıştır). Prompt metni ve
// kaynak seçenekleri için bkz. yazili/prompt.ts (otomatik yazılı worker'ı da aynısını kullanır).

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const sp = request.nextUrl.searchParams;
  const topicId = Number(sp.get('topicId'));
  if (!Number.isInteger(topicId)) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const result = await buildYaziliPrompt(createServiceClient(), topicId, {
    source: sp.get('source') === 'questions' ? 'questions' : 'content',
    compact: sp.get('compact') === '1',
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ prompt: result.prompt, length: result.prompt.length, existingCount: result.existingCount });
}
