import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { revalidateUnitPagesForTopics } from '@/app/src/lib/topicPageRevalidation';

// Öğrencilerin "Hatalı soru bildir" kayıtları (question_reports.sql) — açık bildirimler ve öğrencinin geri
// yazdığı (awaiting_admin_at) bildirimler soru bazında gruplanır; her bildirimin yazışması da gelir
// (question_report_messages.sql, cevap yazma: ./reply). POST ile admin kararı:
//   hide    → soru yayından kalkar, bildirimler 'resolved'
//   fixed   → admin soruyu düzeltti; bildirimler 'resolved', otomatik gizlendiyse geri açılır
//   dismiss → soru doğru; bildirimler 'dismissed', otomatik gizlendiyse geri açılır
// Karar resolution'a yazılır (fixed/hidden/no_error) ve bildiren her öğrenciye sonuç zil bildirimiyle gider;
// öğrenci /profil/bildirdigim-sorular'da "Tamamlanan" sekmesinde görür (kapalı bildirime yazılamaz).

const RESOLUTION = { hide: 'hidden', fixed: 'fixed', dismiss: 'no_error' } as const;
const CLOSE_NOTICE: Record<keyof typeof RESOLUTION, { title: string; body: string }> = {
  fixed: { title: 'Bildirdiğin soru düzeltildi', body: 'Hata giderildi. Katkın için teşekkürler!' },
  hide: { title: 'Bildirdiğin soru yayından kaldırıldı', body: 'Soru düzeltilene kadar kimseye gösterilmeyecek. Katkın için teşekkürler!' },
  dismiss: { title: 'Bildirdiğin soru incelendi', body: 'Soruda hata bulunmadı. Ayrıntıyı görmek için dokun.' },
};

type Embed<T> = T | T[] | null;
const one = <T,>(v: Embed<T>): T | null => (!v ? null : Array.isArray(v) ? v[0] ?? null : v);

type QuestionEmbed = {
  id: number;
  question_text: string;
  solution_text: string | null;
  question_type_id: number;
  is_active: boolean;
  auto_hidden_at: string | null;
  ai_model: string | null;
  question_choices: { id: number; choice_text: string; is_correct: boolean }[];
  question_blank_options: { option_text: string; is_correct: boolean }[];
  topics: Embed<{ id: number; title: string; units: Embed<{ title: string; grades: Embed<{ name: string }>; lessons: Embed<{ name: string }> }> }>;
};

type MessageRow = { sender: 'admin' | 'student'; body: string; created_at: string };
type ReportRow = {
  id: number;
  question_id: number;
  user_id: string;
  reason: string;
  note: string | null;
  status: string;
  created_at: string;
  question_report_messages: MessageRow[];
  questions: Embed<QuestionEmbed>;
};
type ReportOut = {
  id: number;
  reason: string;
  note: string | null;
  createdAt: string;
  isOpen: boolean;
  studentName: string;
  chosenAnswer: string | null;
  messages: { sender: 'admin' | 'student'; body: string; createdAt: string }[];
};

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('question_reports')
    .select(
      'id, question_id, user_id, reason, note, status, created_at, question_report_messages(sender, body, created_at), questions!inner(id, question_text, solution_text, question_type_id, is_active, auto_hidden_at, ai_model, question_choices(id, choice_text, is_correct), question_blank_options(option_text, is_correct), topics(id, title, units(title, grades(name), lessons(name))))'
    )
    .or('status.eq.open,awaiting_admin_at.not.is.null')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data as ReportRow[] | null) || [];

  // Cevap yazarken işe yarar: öğrencinin adı ve o soruda en son işaretlediği şık.
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const questionIds = [...new Set(rows.map((r) => r.question_id))];
  const [profilesRes, answersRes] = userIds.length
    ? await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', userIds),
        supabase
          .from('test_session_answers')
          .select('user_id, question_id, selected_option_id, created_at')
          .in('user_id', userIds)
          .in('question_id', questionIds)
          .order('created_at', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];
  const names = new Map(((profilesRes.data as { id: string; full_name: string | null }[] | null) || []).map((p) => [p.id, p.full_name?.trim() || 'Öğrenci']));
  const lastChoice = new Map<string, number | null>();
  for (const a of (answersRes.data as { user_id: string; question_id: number; selected_option_id: number | null }[] | null) || []) {
    const key = `${a.user_id}:${a.question_id}`;
    if (!lastChoice.has(key)) lastChoice.set(key, a.selected_option_id);
  }

  const byQuestion = new Map<number, { question: QuestionEmbed; reports: ReportOut[] }>();
  for (const r of rows) {
    const q = one(r.questions);
    if (!q) continue;
    const entry = byQuestion.get(q.id) ?? { question: q, reports: [] };
    const chosenId = lastChoice.get(`${r.user_id}:${r.question_id}`);
    entry.reports.push({
      id: r.id,
      reason: r.reason,
      note: r.note,
      createdAt: r.created_at,
      isOpen: r.status === 'open',
      studentName: names.get(r.user_id) ?? 'Öğrenci',
      chosenAnswer: q.question_choices.find((c) => c.id === chosenId)?.choice_text ?? null,
      messages: [...r.question_report_messages].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((m) => ({ sender: m.sender, body: m.body, createdAt: m.created_at })),
    });
    byQuestion.set(q.id, entry);
  }

  const items = [...byQuestion.values()]
    .map(({ question: q, reports }) => {
      const topic = one(q.topics);
      const unit = one(topic?.units ?? null);
      const correct = q.question_choices.find((c) => c.is_correct)?.choice_text ?? q.question_blank_options.find((o) => o.is_correct)?.option_text ?? null;
      return {
        questionId: q.id,
        questionText: q.question_text,
        solutionText: q.solution_text,
        correctAnswer: correct,
        isActive: q.is_active,
        autoHidden: !!q.auto_hidden_at,
        aiModel: q.ai_model,
        topicId: topic?.id ?? null,
        context: [one(unit?.grades ?? null)?.name, one(unit?.lessons ?? null)?.name, topic?.title].filter(Boolean).join(' · '),
        reportCount: reports.length,
        hasOpen: reports.some((r) => r.isOpen),
        reports,
      };
    })
    .sort((a, b) => b.reportCount - a.reportCount);

  // Başarısız / son konu partileri (otomatik soru üretimi durumu).
  const { data: batchRows } = await supabase
    .from('ai_topic_question_batches')
    .select('topic_id, round_no, status, started_at, published_at, question_count, svg_pending_count, last_error, topics(title)')
    .order('started_at', { ascending: false })
    .limit(30);
  const batches = ((batchRows as { topic_id: number; round_no: number; status: string; started_at: string; published_at: string | null; question_count: number | null; svg_pending_count: number | null; last_error: string | null; topics: Embed<{ title: string }> }[] | null) || []).map((b) => ({
    topicId: b.topic_id,
    roundNo: b.round_no,
    topicTitle: one(b.topics)?.title ?? `Konu ${b.topic_id}`,
    status: b.status,
    startedAt: b.started_at,
    publishedAt: b.published_at,
    questionCount: b.question_count,
    svgPendingCount: b.svg_pending_count,
    lastError: b.last_error,
  }));

  return NextResponse.json({ items, batches });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { questionId?: unknown; action?: unknown } | null;
  const questionId = Number(body?.questionId);
  const action = body?.action;
  if (!Number.isInteger(questionId) || (action !== 'hide' && action !== 'fixed' && action !== 'dismiss')) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: q, error: qError } = await supabase.from('questions').select('id, topic_id, auto_hidden_at').eq('id', questionId).maybeSingle();
  if (qError || !q) return NextResponse.json({ error: 'Soru bulunamadı' }, { status: 404 });
  const question = q as { id: number; topic_id: number | null; auto_hidden_at: string | null };

  if (action === 'hide') {
    const { error } = await supabase.from('questions').update({ is_active: false, auto_hidden_at: null }).eq('id', questionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (question.auto_hidden_at) {
    const { error } = await supabase.from('questions').update({ is_active: true, auto_hidden_at: null }).eq('id', questionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: closed, error: rError } = await supabase
    .from('question_reports')
    .update({ status: action === 'dismiss' ? 'dismissed' : 'resolved', resolution: RESOLUTION[action], resolved_at: new Date().toISOString(), awaiting_admin_at: null })
    .eq('question_id', questionId)
    .eq('status', 'open')
    .select('id, user_id');
  if (rError) return NextResponse.json({ error: rError.message }, { status: 500 });

  const notice = CLOSE_NOTICE[action];
  const rows = ((closed as { id: number; user_id: string }[] | null) || []).map((r) => ({
    user_id: r.user_id,
    type: 'question_report_closed',
    title: notice.title,
    body: notice.body,
    link: `/profil/bildirdigim-sorular?bildirim=${r.id}`,
  }));
  if (rows.length) {
    const { error: notifyError } = await supabase.from('notifications').insert(rows);
    // Karar asıl iş; bildirim gitmezse geri alınmaz, öğrenci sayfada yine görür.
    if (notifyError) console.error('[question-reports] kapanış bildirimi eklenemedi:', notifyError.message);
  }

  if (question.topic_id != null && (action === 'hide' || question.auto_hidden_at)) await revalidateUnitPagesForTopics(supabase, [question.topic_id]);
  return NextResponse.json({ ok: true });
}
