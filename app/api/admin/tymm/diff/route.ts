import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { buildTymmTopicDiffs } from '@/app/src/lib/tymm/buildTopicDiffs';
import type { TymmUnit } from '@/app/src/lib/tymm/tymmParser';

// SADECE OKUMA: admin'in elindeki (henüz kaydedilmemiş) bir unit'i DB ile YENİDEN
// kıyaslar — TYMM'den tekrar çekmeden. AiAssistPanel'de "AI JSON'u Uygula" ile
// learningOutcomes değiştirildiğinde /api/admin/tymm/fetch'te bir kere hesaplanan
// topicDiffs artık geçersiz kalıyordu (JSON'daki yeni topicTitle/components
// gruplamasını yansıtmıyordu, "DB'deki (eski)" ve "TYMM'den (yeni)" konu satırı boş/"—"
// görünüyordu) — bkz. YillikPlanPanel.tsx onAiApply (2026-09-24 kullanıcı bildirimi).
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { unit?: TymmUnit; lessonId?: unknown; gradeId?: unknown } | null;
  const unit = body?.unit;
  const lessonId = typeof body?.lessonId === 'number' ? body.lessonId : null;
  const gradeId = typeof body?.gradeId === 'number' ? body.gradeId : null;
  if (!unit || !Array.isArray(unit.learningOutcomes)) return NextResponse.json({ error: 'unit zorunlu' }, { status: 400 });
  if (!lessonId || !gradeId) return NextResponse.json({ error: 'lessonId ve gradeId zorunlu' }, { status: 400 });

  const topicDiffs = await buildTymmTopicDiffs(unit, lessonId, gradeId);
  return NextResponse.json({ topicDiffs });
}
