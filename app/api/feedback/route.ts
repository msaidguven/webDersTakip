import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getClientIp } from '@/app/src/lib/authSecurity';
import {
  FEEDBACK_AREAS,
  FEEDBACK_CATEGORIES,
  FEEDBACK_SOURCES,
  type FeedbackArea,
  type FeedbackCategory,
  type FeedbackContextData,
  type FeedbackRole,
  type FeedbackSource,
} from '@/app/src/lib/siteFeedback';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RATE_WINDOW_MS = 10 * 60_000;
const MAX_MEMBER_PER_WINDOW = 5;
const MAX_GUEST_PER_WINDOW = 3;
const MIN_CONTACT_FORM_MS = 2_000;

function hashIp(ip: string): string | null {
  if (!ip || ip === 'unknown') return null;
  const salt = process.env.NEXT_PUBLIC_SUPABASE_URL || 'derstakip-feedback';
  return createHash('sha256').update(`${ip}:${salt}`).digest('hex').slice(0, 32);
}

function isOneOf<T extends string>(list: readonly T[], val: unknown): val is T {
  return typeof val === 'string' && (list as readonly string[]).includes(val);
}

type ProfileLookup = {
  full_name: string | null;
  role: string | null;
  is_verified: boolean | null;
  school_name: string | null;
  grade_id: number | null;
  teacher_lessons: { lessons: { name: string } | null }[] | null;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  // Honeypot kontrolü
  if (typeof body.honeypot === 'string' && body.honeypot.trim() !== '') {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const category: FeedbackCategory | null = isOneOf(FEEDBACK_CATEGORIES, body.category) ? body.category : null;
  const source: FeedbackSource | null = isOneOf(FEEDBACK_SOURCES, body.source) ? body.source : null;
  const area: FeedbackArea | null = body.area == null || body.area === ''
    ? null
    : isOneOf(FEEDBACK_AREAS, body.area)
      ? body.area
      : null;

  if (!category || !source) {
    return NextResponse.json({ error: 'Kategori veya kaynak eksik' }, { status: 400 });
  }

  const rawMessage = typeof body.message === 'string' ? body.message.trim() : '';
  if (rawMessage.length > 2000) {
    return NextResponse.json({ error: 'Mesaj en fazla 2000 karakter olabilir' }, { status: 400 });
  }
  // Öğrenci anasayfa hızlı tepkisinde not isteğe bağlı; diğer tüm kanallarda en az 3 karakter.
  if (source !== 'student_today' && rawMessage.length < 3) {
    return NextResponse.json({ error: 'Lütfen kısaca mesajınızı yazın (en az 3 karakter).' }, { status: 400 });
  }
  const message = rawMessage.length > 0 ? rawMessage : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Misafir iletişim formunda çok hızlı bot gönderimlerini reddet
  if (!user && source === 'contact_page') {
    const renderedAt = Number(body.formRenderedAt);
    if (!Number.isFinite(renderedAt) || Date.now() - renderedAt < MIN_CONTACT_FORM_MS) {
      return NextResponse.json({ error: 'Lütfen formu doldurup tekrar deneyin.' }, { status: 400 });
    }
  }

  const ipHash = hashIp(getClientIp(request));
  const service = createServiceClient();

  // Hız sınırı (son 10 dk: üyede 5, misafirde 3)
  const sinceIso = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  if (user) {
    const { count } = await service
      .from('site_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', sinceIso);
    if ((count ?? 0) >= MAX_MEMBER_PER_WINDOW) {
      return NextResponse.json(
        { error: 'Kısa sürede çok fazla geri bildirim gönderdiniz. Lütfen birkaç dakika sonra tekrar deneyin.' },
        { status: 429 },
      );
    }
  } else if (ipHash) {
    const { count } = await service
      .from('site_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', sinceIso);
    if ((count ?? 0) >= MAX_GUEST_PER_WINDOW) {
      return NextResponse.json(
        { error: 'Kısa sürede çok fazla mesaj gönderildi. Lütfen birkaç dakika sonra tekrar deneyin.' },
        { status: 429 },
      );
    }
  }

  const pagePath = typeof body.pagePath === 'string' && body.pagePath.trim()
    ? body.pagePath.trim().slice(0, 500)
    : null;

  let role: FeedbackRole = 'guest';
  let senderName = typeof body.senderName === 'string' && body.senderName.trim()
    ? body.senderName.trim().slice(0, 120)
    : null;
  let senderEmail = typeof body.senderEmail === 'string' && body.senderEmail.trim()
    ? body.senderEmail.trim().slice(0, 254)
    : null;

  if (senderEmail && !EMAIL_RE.test(senderEmail)) {
    return NextResponse.json({ error: 'Geçerli bir e-posta adresi girin veya boş bırakın.' }, { status: 400 });
  }

  const rawCtx = body.context && typeof body.context === 'object' ? (body.context as Record<string, unknown>) : {};
  const context: FeedbackContextData = {};
  if (rawCtx.viewport === 'mobile' || rawCtx.viewport === 'desktop') {
    context.viewport = rawCtx.viewport;
  }
  if (typeof rawCtx.examId === 'number' && Number.isInteger(rawCtx.examId) && rawCtx.examId > 0) {
    context.examId = rawCtx.examId;
  }
  if (typeof rawCtx.examTitle === 'string' && rawCtx.examTitle.trim()) {
    context.examTitle = rawCtx.examTitle.trim().slice(0, 140);
  }
  if (typeof rawCtx.streak === 'number' && Number.isInteger(rawCtx.streak) && rawCtx.streak >= 0) {
    context.streak = rawCtx.streak;
  }
  if (typeof rawCtx.viewAs === 'string' && rawCtx.viewAs.trim()) {
    context.viewAs = rawCtx.viewAs.trim().slice(0, 24);
  }

  if (user) {
    const { data: profileRow } = await service
      .from('profiles')
      .select('full_name, role, is_verified, school_name, grade_id, teacher_lessons(lessons(name))')
      .eq('id', user.id)
      .maybeSingle();

    const p = profileRow as unknown as ProfileLookup | null;
    if (p?.role === 'teacher') role = 'teacher';
    else if (p?.role === 'admin') role = 'admin';
    else role = 'student';

    if (!senderName && p?.full_name?.trim()) {
      senderName = p.full_name.trim().slice(0, 120);
    }
    if (!senderEmail && user.email) {
      senderEmail = user.email.slice(0, 254);
    }

    if (p?.school_name) context.school = p.school_name;
    if (role === 'teacher') {
      context.isVerified = !!p?.is_verified;
      const lessons = (p?.teacher_lessons ?? []).flatMap((t) => (t.lessons?.name ? [t.lessons.name] : []));
      if (lessons.length > 0) context.lessons = lessons;
    }
    if (p?.grade_id) {
      const { data: gradeRow } = await service.from('grades').select('name').eq('id', p.grade_id).maybeSingle();
      const gName = (gradeRow as { name: string } | null)?.name;
      if (gName) context.gradeName = gName;
    }
  }

  const { error } = await service.from('site_feedback').insert({
    user_id: user?.id ?? null,
    role,
    category,
    area,
    message,
    source,
    page_path: pagePath,
    sender_name: senderName,
    sender_email: senderEmail,
    context,
    ip_hash: ipHash,
  });

  if (error) {
    console.error('[api/feedback] insert error:', error.message);
    return NextResponse.json({ error: 'Mesaj kaydedilemedi, lütfen tekrar deneyin.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
