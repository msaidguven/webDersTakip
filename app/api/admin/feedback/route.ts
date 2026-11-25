import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_ROLES,
  FEEDBACK_STATUSES,
  type FeedbackRole,
  type FeedbackStatus,
  type SiteFeedbackRow,
} from '@/app/src/lib/siteFeedback';

export const dynamic = 'force-dynamic';

function isOneOf<T extends string>(list: readonly T[], val: unknown): val is T {
  return typeof val === 'string' && (list as readonly string[]).includes(val);
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { searchParams } = new URL(request.url);
  const roleParam = searchParams.get('role');
  const statusParam = searchParams.get('status');
  const categoryParam = searchParams.get('category');

  const supabase = createServiceClient();

  let query = supabase
    .from('site_feedback')
    .select('id, user_id, role, category, area, message, source, page_path, sender_name, sender_email, context, status, admin_note, admin_reply, replied_at, created_at')
    .order('created_at', { ascending: false })
    .limit(250);

  if (isOneOf(FEEDBACK_ROLES, roleParam)) query = query.eq('role', roleParam);
  if (isOneOf(FEEDBACK_STATUSES, statusParam)) query = query.eq('status', statusParam);
  if (isOneOf(FEEDBACK_CATEGORIES, categoryParam)) query = query.eq('category', categoryParam);

  const [listRes, newAll, newTeacher, newStudent, newGuest] = await Promise.all([
    query,
    supabase.from('site_feedback').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('site_feedback').select('id', { count: 'exact', head: true }).eq('status', 'new').eq('role', 'teacher'),
    supabase.from('site_feedback').select('id', { count: 'exact', head: true }).eq('status', 'new').eq('role', 'student'),
    supabase.from('site_feedback').select('id', { count: 'exact', head: true }).eq('status', 'new').eq('role', 'guest'),
  ]);

  if (listRes.error) {
    return NextResponse.json({ error: listRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    items: (listRes.data as SiteFeedbackRow[] | null) ?? [],
    counts: {
      newTotal: newAll.count ?? 0,
      newTeacher: newTeacher.count ?? 0,
      newStudent: newStudent.count ?? 0,
      newGuest: newGuest.count ?? 0,
    },
  });
}

// Durum (Yeni / Okundu / Çözüldü) veya admin notu güncelleme
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    status?: unknown;
    adminNote?: unknown;
  } | null;

  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Geçersiz kayıt kimliği' }, { status: 400 });
  }

  const patch: { status?: FeedbackStatus; admin_note?: string | null } = {};
  if (body?.status !== undefined) {
    if (!isOneOf(FEEDBACK_STATUSES, body.status)) {
      return NextResponse.json({ error: 'Geçersiz durum' }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (body?.adminNote !== undefined) {
    if (body.adminNote === null || body.adminNote === '') {
      patch.admin_note = null;
    } else if (typeof body.adminNote === 'string' && body.adminNote.length <= 2000) {
      patch.admin_note = body.adminNote.trim() || null;
    } else {
      return NextResponse.json({ error: 'Admin notu en fazla 2000 karakter olabilir' }, { status: 400 });
    }
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from('site_feedback').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// Üyeye bildirim çanı (notifications) üzerinden tek yönlü yanıt / teşekkür gönderme
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    reply?: unknown;
    markResolved?: unknown;
  } | null;

  const id = Number(body?.id);
  const rawReply = typeof body?.reply === 'string' ? body.reply.trim() : '';
  if (!Number.isInteger(id) || id <= 0 || rawReply.length < 2 || rawReply.length > 2000) {
    return NextResponse.json({ error: 'Yanıt 2-2000 karakter olmalı' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: row, error: rError } = await supabase
    .from('site_feedback')
    .select('id, user_id, role, sender_name, status')
    .eq('id', id)
    .maybeSingle();

  if (rError || !row) {
    return NextResponse.json({ error: 'Geri bildirim bulunamadı' }, { status: 404 });
  }

  const fb = row as { id: number; user_id: string | null; role: FeedbackRole; sender_name: string | null; status: FeedbackStatus };
  if (!fb.user_id) {
    return NextResponse.json({ error: 'Misafir mesajlarına e-posta ile dönüş yapabilirsiniz.' }, { status: 400 });
  }

  const firstName = fb.sender_name?.trim().split(/\s+/)[0] || '';
  const finalReply = (firstName ? rawReply.replaceAll('{ad}', firstName) : rawReply.replace(/\s*\{ad\}/g, '')).slice(0, 2000);
  const repliedAt = new Date().toISOString();
  const nextStatus: FeedbackStatus = body?.markResolved === false
    ? (fb.status === 'new' ? 'read' : fb.status)
    : 'resolved';

  const { error: uError } = await supabase
    .from('site_feedback')
    .update({
      admin_reply: finalReply,
      replied_at: repliedAt,
      status: nextStatus,
    })
    .eq('id', id);

  if (uError) return NextResponse.json({ error: uError.message }, { status: 500 });

  const title = fb.role === 'teacher' ? 'Mesajınıza yanıt geldi, Hocam' : 'Geri bildirimine yanıt geldi';
  const { error: notifyError } = await supabase.from('notifications').insert({
    user_id: fb.user_id,
    type: 'feedback_reply',
    title,
    body: finalReply,
    link: null,
  });

  if (notifyError) {
    console.error('[admin/feedback] bildirim eklenemedi:', notifyError.message);
  }

  return NextResponse.json({ ok: true, admin_reply: finalReply, replied_at: repliedAt, status: nextStatus });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Geçersiz kimlik' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from('site_feedback').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
