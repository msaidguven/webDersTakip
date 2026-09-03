import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { buildContextResolver, type Ref } from '@/app/src/lib/myComments';

const VALID_STATUSES = ['pending', 'published', 'rejected', 'deleted'] as const;
type Status = (typeof VALID_STATUSES)[number];

// Admin panelde "Tüm Yorumlar ve Sorular" görünümü için: question_comments (ünite/soru
// yorumları) ve rag_answers (AI'ye @hocam/@kanka ile sorulan sorular) TÜM statülerde
// (yayınlanan/bekleyen/reddedilen/silinen) tek, filtrelenip aranabilen, sayfalanan bir
// listede birleştirilir — hangi ünite/konuya ait olduğu da soru bankası linkiyle gösterilir
// (bkz. myComments.ts'teki buildContextResolver, profildeki "Yorumlarım"la aynı çözücü).
// Gerçek bir SQL UNION/view kurmak yerine (bu ölçekte gerek yok, dashboardActivities.ts/
// myComments.ts'teki "her kaynaktan makul bir üst sınırla çek, bellekte birleştir/sırala"
// deseniyle tutarlı kalınıyor) her tablodan en fazla PER_SOURCE_FETCH_LIMIT satır çekilip
// bellekte birleştirilip sayfalanıyor.
const PER_SOURCE_FETCH_LIMIT = 400;

function sanitizeSearch(raw: string): string {
  // ILIKE joker karakterleri (%, _) ve .or() filtre grameri (virgül, parantez) kırılmasın diye
  // arama metninden çıkarılıyor — admin-only bir alan olsa da girdi hâlâ temizleniyor.
  return raw.replace(/[%_,()]/g, ' ').trim().slice(0, 100);
}

type CommentRow = {
  id: number;
  body: string;
  status: string;
  created_at: string;
  question_id: number | null;
  unit_id: number | null;
  student_id: string;
  parent_comment_id: number | null;
  reviewed_at: string | null;
};

type AiRow = {
  id: number;
  question: string;
  answer: string;
  model: string;
  status: string;
  created_at: string;
  quiz_question_id: number | null;
  unit_id: number | null;
  student_id: string | null;
  parent_comment_id: number | null;
  parent_rag_answer_id: number | null;
  reviewed_at: string | null;
};

type UnifiedItem = {
  id: string;
  kind: 'comment' | 'ai';
  status: string;
  createdAt: string;
  contextLabel: string | null;
  href: string | undefined;
  student: { id: string; username: string | null; fullName: string | null } | null;
  isReply: boolean;
  body?: string;
  question?: string;
  answer?: string;
  mode?: 'hocam' | 'kanka';
  // Yorumlar artık yayınlanmadan önce onay beklemiyor (bkz. question_comments_auto_publish.sql)
  // — bu, admin'in "gördüm" dediği, yayın durumundan BAĞIMSIZ ayrı bir işaret (kullanıcı
  // isteği, 2026-09-04). null ise admin henüz bakmamış demektir.
  reviewedAt: string | null;
};

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const params = request.nextUrl.searchParams;
  const statusParam = params.get('status') || 'all';
  const status: Status | 'all' = (VALID_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as Status) : 'all';
  const kindParam = params.get('kind');
  const kind: 'comment' | 'ai' | 'all' = kindParam === 'comment' || kindParam === 'ai' ? kindParam : 'all';
  const search = sanitizeSearch(params.get('search') || '');
  const reviewedParam = params.get('reviewed'); // 'yes' | 'no' | null (=all)
  const page = Math.max(1, Math.trunc(Number(params.get('page')) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(params.get('pageSize')) || 30)));

  const supabase = createServiceClient();

  let commentRows: CommentRow[] = [];
  if (kind !== 'ai') {
    let q = supabase
      .from('question_comments')
      .select('id, body, status, created_at, question_id, unit_id, student_id, parent_comment_id, reviewed_at')
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE_FETCH_LIMIT);
    if (status !== 'all') q = q.eq('status', status);
    if (search) q = q.ilike('body', `%${search}%`);
    if (reviewedParam === 'yes') q = q.not('reviewed_at', 'is', null);
    if (reviewedParam === 'no') q = q.is('reviewed_at', null);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    commentRows = (data as CommentRow[] | null) || [];
  }

  let aiRows: AiRow[] = [];
  if (kind !== 'comment') {
    let q = supabase
      .from('rag_answers')
      .select('id, question, answer, model, status, created_at, quiz_question_id, unit_id, student_id, parent_comment_id, parent_rag_answer_id, reviewed_at')
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE_FETCH_LIMIT);
    if (status !== 'all') q = q.eq('status', status);
    if (search) q = q.or(`question.ilike.%${search}%,answer.ilike.%${search}%`);
    if (reviewedParam === 'yes') q = q.not('reviewed_at', 'is', null);
    if (reviewedParam === 'no') q = q.is('reviewed_at', null);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    aiRows = (data as AiRow[] | null) || [];
  }

  const refs: Ref[] = [
    ...commentRows.map((c) => ({ questionId: c.question_id, unitId: c.unit_id })),
    ...aiRows.map((a) => ({ questionId: a.quiz_question_id, unitId: a.unit_id })),
  ];
  const resolve = await buildContextResolver(supabase, refs);

  const studentIds = [
    ...new Set([...commentRows.map((c) => c.student_id), ...aiRows.map((a) => a.student_id).filter((id): id is string => id != null)]),
  ];
  const { data: profileRows } = studentIds.length
    ? await supabase.from('profiles').select('id, username, full_name').in('id', studentIds)
    : { data: [] };
  const profileById = new Map(
    ((profileRows as { id: string; username: string | null; full_name: string | null }[] | null) || []).map((p) => [p.id, p])
  );

  // Düz ?soru=ID linki artık yorumları otomatik açmıyor (bkz. QuestionBankHighlight.tsx'teki
  // 2026-09-04 notu) — admin panelden tıklayınca doğrudan ilgili kayda gitsin diye &yorum=
  // parametresi ekleniyor, tıpkı profildeki "Yorumlarım"da olduğu gibi.
  function withHighlight(href: string | undefined, target: string): string | undefined {
    return href ? `${href}&yorum=${target}` : href;
  }

  const commentItems: UnifiedItem[] = commentRows.map((c) => {
    const { contextLabel, href } = resolve({ questionId: c.question_id, unitId: c.unit_id });
    const profile = profileById.get(c.student_id);
    return {
      id: `comment-${c.id}`,
      kind: 'comment',
      status: c.status,
      createdAt: c.created_at,
      contextLabel,
      href: withHighlight(href, `c${c.id}`),
      student: { id: c.student_id, username: profile?.username ?? null, fullName: profile?.full_name ?? null },
      isReply: c.parent_comment_id != null,
      body: c.body,
      reviewedAt: c.reviewed_at,
    };
  });

  const aiItems: UnifiedItem[] = aiRows.map((a) => {
    const { contextLabel, href } = resolve({ questionId: a.quiz_question_id, unitId: a.unit_id });
    const profile = a.student_id ? profileById.get(a.student_id) : undefined;
    return {
      id: `ai-${a.id}`,
      kind: 'ai',
      status: a.status,
      createdAt: a.created_at,
      contextLabel,
      href: withHighlight(href, `a${a.id}`),
      student: a.student_id ? { id: a.student_id, username: profile?.username ?? null, fullName: profile?.full_name ?? null } : null,
      isReply: a.parent_comment_id != null || a.parent_rag_answer_id != null,
      question: a.question,
      answer: a.answer,
      mode: a.model.includes('kanka') ? 'kanka' : 'hocam',
      reviewedAt: a.reviewed_at,
    };
  });

  const merged = [...commentItems, ...aiItems].sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());

  const total = merged.length;
  const start = (page - 1) * pageSize;
  const pageItems = merged.slice(start, start + pageSize);

  return NextResponse.json({ items: pageItems, total, page, pageSize, hasMore: start + pageSize < total });
}
