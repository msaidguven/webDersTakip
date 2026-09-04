'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, AlertTriangle, Flag, ChevronDown, MessageCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const MAX_LENGTH = 300;
const HOCAM_TAG = '@hocam'; // ders notuna bağlı, sıkı cevap
const KANKA_TAG = '@kanka'; // serbest, genel bilgi de verebilen samimi sohbet
type AiMode = 'hocam' | 'kanka';

type Availability = 'loading' | 'available' | 'unavailable';
type AuthState = 'loading' | 'in' | 'out';
type ReportState = 'idle' | 'open' | 'sending' | 'sent';
// Yanıt kutusunun kime yazıldığını tutar: bir yoruma mı, bir AI cevabına mı —
// ikisi de aynı tek yanıt input'unu paylaşır, "@ai" içerirse yine AI'ye gider.
type ReplyTarget = { type: 'comment' | 'ai'; id: number } | null;

type Profile = { username: string | null; full_name: string | null; avatar_url: string | null } | null;

type CommentEntry = {
  kind: 'comment';
  id: number;
  parent_comment_id: number | null;
  parent_ai_answer_id: number | null;
  body: string;
  status: 'pending' | 'published' | 'rejected' | 'deleted';
  created_at: string;
  student_id: string;
  profiles: Profile | Profile[];
};

type AiAnswerStatus = 'queued' | 'processing' | 'failed' | 'published';

type AiEntry = {
  kind: 'ai';
  id: number;
  question: string;
  answer: string | null;
  status: AiAnswerStatus;
  model: string;
  created_at: string;
  student_id: string;
  profiles: Profile | Profile[];
  reportState: ReportState;
  reportReason: string;
  parent_comment_id: number | null;
  parent_rag_answer_id: number | null;
};

type FeedEntry = CommentEntry | AiEntry;

// Yorum-önce mimarisinde (2026-09-04) her @hocam/@kanka sorusu artık İKİ kayıt
// üretiyor (soru yorumu + cevap), bu yüzden bir yanıta verilen yanıt (ör. "teşekkürler"
// -> AI cevabı) her zaman İKİ seviye iç içe geçiyor — önceki tek-seviyelik sınır bunu
// gösteremiyordu, ikinci alışveriş sessizce kayboluyordu (kullanıcı bildirimi). ReplyRow/
// ReplyAiRow artık kendi yanıtlarını da (recursive) render ediyor; tüm ortak
// handler'lar tek tek prop olarak değil, bu paket üzerinden geçiliyor.
type DiscussionHandlers = {
  userId: string | null;
  editingId: number | null;
  editText: string;
  commentBusyId: number | null;
  replyTarget: ReplyTarget;
  replyText: string;
  submitting: boolean;
  onStartEdit: (c: CommentEntry) => void;
  onCancelEdit: () => void;
  onSaveEdit: (c: CommentEntry) => void;
  onEditTextChange: (v: string) => void;
  onDeleteComment: (c: CommentEntry) => void;
  onReportPatch: (id: number, patch: Partial<AiEntry>) => void;
  onReportSubmit: (item: AiEntry) => void;
  onSetReplyTarget: (target: ReplyTarget) => void;
  onReplyTextChange: (v: string) => void;
  onReplySubmit: () => void;
  repliesOfComment: (id: number) => FeedEntry[];
  repliesOfAi: (id: number) => FeedEntry[];
};

function displayNameOf(profiles: Profile | Profile[]): string {
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  return p?.username || p?.full_name || 'Öğrenci';
}

// AiEntry kendi başına hangi tag ile soruldunu tutmuyor — model alanındaki
// "-kanka" ekinden geri çıkarıyoruz (bkz. gemini.ts generateBuddyAnswer).
function tagForModel(model: string): string {
  return model.includes('kanka') ? KANKA_TAG : HOCAM_TAG;
}

function avatarUrlOf(profiles: Profile | Profile[]): string | null {
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  return p?.avatar_url || null;
}

// @hocam/@kanka'nın karakter görselleri (public/ai-hocam.webp, public/ai-kanka.webp) —
// önceki jenerik "Bot" ikonu yerine, hangi modda cevap verildiğini görsel olarak da
// ayırt etsin diye (kullanıcı isteği, 2026-09-03).
function AiAvatar({ model, sizeClass }: { model: string; sizeClass: string }) {
  const isKanka = model.includes('kanka');
  return (
    <div className={`${sizeClass} rounded-full overflow-hidden shrink-0 bg-gray-100`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={isKanka ? '/ai-kanka.webp' : '/ai-hocam.webp'}
        alt={isKanka ? KANKA_TAG : HOCAM_TAG}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

// Sorular artık senkron cevaplanmıyor (bkz. /api/rag/process-queue) — cevap gelene
// kadar bu placeholder gösteriliyor, item.status 'queued'/'processing' olduğu sürece
// (hasPendingAi effect'i feed'i periyodik yeniden çekip cevap gelince günceller).
function AiPendingOrFailed({ status }: { status: 'queued' | 'processing' | 'failed' }) {
  if (status === 'failed') {
    return <p className="text-sm text-red-500">Bu soruya şu an cevap üretilemedi, tekrar sorabilirsin.</p>;
  }
  return (
    <p className="flex items-center gap-2 text-sm text-gray-500">
      <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-400" />
      Cevap hazırlanıyor, birkaç dakika sürebilir…
    </p>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="h-8 w-8 rounded-full object-cover shrink-0" />;
  }
  return (
    <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// Bunlar bilerek modül seviyesinde (component'in İÇİNDE değil) tanımlı: içeride
// tanımlansaydı her render'da yeni bir component tipi olarak sayılıp React'ı
// input'ları unmount/remount etmeye zorlardı — bu da reply kutusuna her harf
// yazışta focus kaybına yol açardı.
function ReplyRow({ comment, handlers }: { comment: CommentEntry; handlers: DiscussionHandlers }) {
  const { userId, editingId, editText, commentBusyId, onStartEdit, onCancelEdit, onSaveEdit, onDeleteComment, onEditTextChange, repliesOfComment } =
    handlers;
  const isOwn = comment.student_id === userId;
  const isEditing = editingId === comment.id;
  const isBusy = commentBusyId === comment.id;
  const nested = repliesOfComment(comment.id);
  const name = displayNameOf(comment.profiles);
  return (
    <div id={`disc-c${comment.id}`} className="flex items-start gap-2.5">
      <Avatar name={name} url={avatarUrlOf(comment.profiles)} />
      <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">{name}</span>
        <span className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleDateString('tr-TR')}</span>
      </div>
      {isEditing ? (
        <div className="space-y-1.5">
          <textarea
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value.slice(0, MAX_LENGTH))}
            rows={2}
            disabled={isBusy}
            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onSaveEdit(comment)}
              disabled={isBusy || !editText.trim()}
              className="px-3 py-1 rounded-md text-xs font-bold bg-indigo-500/15 text-indigo-600 hover:bg-indigo-500/25 disabled:opacity-40"
            >
              Kaydet
            </button>
            <button onClick={onCancelEdit} className="px-3 py-1 rounded-md text-xs text-gray-500 hover:bg-gray-100">
              Vazgeç
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.body}</p>
      )}
      {comment.status !== 'published' && comment.status !== 'deleted' && isOwn && (
        <p className="mt-0.5 text-[11px] text-amber-500">Onay bekliyor, sadece sen görüyorsun.</p>
      )}
      {!isEditing && (
        <div className="mt-0.5 flex items-center gap-3">
          <button
            onClick={() => handlers.onSetReplyTarget(handlers.replyTarget?.type === 'comment' && handlers.replyTarget.id === comment.id ? null : { type: 'comment', id: comment.id })}
            className="text-[11px] font-bold text-indigo-500 hover:text-indigo-400"
          >
            Yanıtla
          </button>
          {isOwn && (
            <>
              <button
                onClick={() => onStartEdit(comment)}
                disabled={isBusy}
                className="text-[11px] font-bold text-gray-400 hover:text-gray-600 disabled:opacity-40"
              >
                Düzenle
              </button>
              <button
                onClick={() => onDeleteComment(comment)}
                disabled={isBusy}
                className="text-[11px] font-bold text-red-400 hover:text-red-600 disabled:opacity-40"
              >
                Sil
              </button>
            </>
          )}
        </div>
      )}

      {nested.length > 0 && (
        <div className="mt-2 ml-1 space-y-2 border-l-2 border-gray-100 pl-3">
          {nested.map((r) =>
            r.kind === 'comment' ? (
              <ReplyRow key={`c${r.id}`} comment={r} handlers={handlers} />
            ) : (
              <ReplyAiRow key={`a${r.id}`} item={r} handlers={handlers} showQuestion={false} />
            )
          )}
        </div>
      )}

      <ReplyBox
        target={{ type: 'comment', id: comment.id }}
        replyTarget={handlers.replyTarget}
        replyText={handlers.replyText}
        submitting={handlers.submitting}
        onReplyTextChange={handlers.onReplyTextChange}
        onSubmit={handlers.onReplySubmit}
      />
      </div>
    </div>
  );
}

function ReplyBox({
  target,
  replyTarget,
  replyText,
  submitting,
  onReplyTextChange,
  onSubmit,
}: {
  target: NonNullable<ReplyTarget>;
  replyTarget: ReplyTarget;
  replyText: string;
  submitting: boolean;
  onReplyTextChange: (v: string) => void;
  onSubmit: () => void;
}) {
  if (replyTarget?.type !== target.type || replyTarget.id !== target.id) return null;
  return (
    <div className="mt-2 flex gap-2">
      <input
        value={replyText}
        onChange={(e) => onReplyTextChange(e.target.value.slice(0, MAX_LENGTH))}
        placeholder={`Yanıtını yaz, ya da ${HOCAM_TAG} / ${KANKA_TAG} ile soru sor…`}
        disabled={submitting}
        className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      />
      <button
        onClick={onSubmit}
        disabled={submitting || !replyText.trim()}
        className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-500/15 text-indigo-600 hover:bg-indigo-500/25 disabled:opacity-40"
      >
        Gönder
      </button>
    </div>
  );
}

// Bir yoruma ya da başka bir AI cevabına "yanıt" olarak sorulmuş @hocam/@kanka
// sorusu — nested bir yanıt olduğu için tekrar "Yanıtla" düğmesi taşımıyor
// (mevcut tek seviyelik iç içe geçme sınırıyla tutarlı).
function ReplyAiRow({
  item,
  handlers,
  showQuestion,
}: {
  item: AiEntry;
  handlers: DiscussionHandlers;
  // Yorum-önce mimarisinde (2026-09-04) bir AI cevabı artık HER ZAMAN kendi soru
  // yorumunun altına nest oluyor (parent_comment_id) — o yorum kimin sorduğunu, ne
  // zaman sorduğunu ve soruyu zaten kendi başlığında gösterdiği için burada AYNI
  // isim/tarih/soru üçlüsünü TEKRAR basmak çift görünüme yol açardı (kullanıcı
  // bildirimi, iki ayrı raporla: önce soru metni, sonra isim/tarih). Sadece parent'ı
  // BAŞKA bir AI cevabıysa (repliesOfAi — artık yeni akışta hiç oluşmuyor, sadece
  // eski/uç durumlar için varsayılan true kalıyor) bu üst bilgi burada gösterilir.
  showQuestion?: boolean;
}) {
  const { onReportPatch, onReportSubmit, repliesOfAi } = handlers;
  const name = displayNameOf(item.profiles);
  const nested = repliesOfAi(item.id);
  return (
    <div id={`disc-a${item.id}`} className="space-y-1.5">
      {showQuestion !== false && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-800">{name}</span>
          <span className="text-[11px] text-gray-400">{new Date(item.created_at).toLocaleDateString('tr-TR')}</span>
        </div>
      )}
      {showQuestion !== false && (
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{tagForModel(item.model)} {item.question}</p>
      )}
      <div className="rounded-lg bg-gray-50/80 p-2.5 flex items-start gap-2">
        <AiAvatar model={item.model} sizeClass="h-6 w-6" />
        <div className="min-w-0 flex-1">
          {item.status !== 'published' ? (
            <AiPendingOrFailed status={item.status} />
          ) : (
            <>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.answer}</p>
              <div className="mt-2">
                {item.reportState === 'idle' && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => handlers.onSetReplyTarget(handlers.replyTarget?.type === 'ai' && handlers.replyTarget.id === item.id ? null : { type: 'ai', id: item.id })}
                      className="text-[11px] font-bold text-indigo-500 hover:text-indigo-400"
                    >
                      Yanıtla
                    </button>
                    <button
                      onClick={() => onReportPatch(item.id, { reportState: 'open' })}
                      className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Flag className="h-3 w-3" /> Bu cevapta hata var, bildir
                    </button>
                  </div>
                )}
                {item.reportState === 'open' && (
                  <div className="space-y-2">
                    <textarea
                      value={item.reportReason}
                      onChange={(e) => onReportPatch(item.id, { reportReason: e.target.value.slice(0, 500) })}
                      placeholder="Neyin yanlış/eksik olduğunu kısaca yazabilirsin (opsiyonel)"
                      rows={2}
                      className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => onReportSubmit(item)}
                        className="px-3 py-1 rounded-md bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100"
                      >
                        Bildir
                      </button>
                      <button
                        onClick={() => onReportPatch(item.id, { reportState: 'idle', reportReason: '' })}
                        className="px-3 py-1 rounded-md text-gray-500 text-xs hover:bg-gray-100"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                )}
                {item.reportState === 'sending' && <p className="text-xs text-gray-400">Gönderiliyor…</p>}
                {item.reportState === 'sent' && <p className="text-xs text-emerald-600">Bildirdiğin için teşekkürler, incelenecek.</p>}
              </div>

              {nested.length > 0 && (
                <div className="mt-3 space-y-2 border-l-2 border-gray-200 pl-3">
                  {nested.map((r) =>
                    r.kind === 'comment' ? (
                      <ReplyRow key={`c${r.id}`} comment={r} handlers={handlers} />
                    ) : (
                      <ReplyAiRow key={`a${r.id}`} item={r} handlers={handlers} />
                    )
                  )}
                </div>
              )}

              <ReplyBox
                target={{ type: 'ai', id: item.id }}
                replyTarget={handlers.replyTarget}
                replyText={handlers.replyText}
                submitting={handlers.submitting}
                onReplyTextChange={handlers.onReplyTextChange}
                onSubmit={handlers.onReplySubmit}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Test sayfasında (quizQuestionId dolu) her şey sadece o soruya, ders sayfasında
// (quizQuestionId boş) sadece o üniteye özel: hem yorumlar hem AI soru-cevapları.
// Tek kutu, tek akış: öğrenci normal bir şey yazarsa yorum olur (admin onayı
// bekler), "@ai" yazarsa soru olarak Gemini'ye gider (otomatik yayınlanır) —
// X'teki "@grok" mantığı gibi, AI sadece çağrıldığında araya giriyor. Hem
// yorumların hem AI cevaplarının altına yanıt yazılabilir (yine ister yoruma
// ister tekrar "@ai" ile) — ama AI cevapları kendi aralarında gerçek bir
// konuşma hafızası taşımaz, "@ai" yanıtı her zaman bağımsız yeni bir sorudur.
export default function UnitDiscussion({
  gradeId,
  lessonId,
  unitId,
  quizQuestionId,
  unitName,
  questionContext,
  defaultExpanded,
  hideToggle,
  highlightTarget,
}: {
  gradeId: number;
  lessonId: number;
  unitId: number;
  quizQuestionId?: number | null;
  // Sadece ders sayfasında (quizQuestionId boş) başlıkta kullanılır; test
  // sayfasında "Bu Soru Hakkında" gösterildiği için gerekmez.
  unitName?: string;
  questionContext?: string | null;
  // Soru bankası gibi, component'in "yorumları göster" tıklanınca ilk kez monte
  // edildiği yerlerde açık başlasın diye (bkz. QuestionBankBoard.tsx) — orada zaten
  // dıştaki toggle bir kez tıklanmış oluyor, ikinci bir tıklama istemek gereksiz.
  defaultExpanded?: boolean;
  // true ise kendi "Bu Soru Hakkında" başlığını/chevron'unu hiç göstermez, dıştan zaten
  // açık bir kapsayıcı (bkz. QuestionBankBoard.tsx'teki modal) içine gömülü, tek başına
  // bir accordion gibi davranmasın diye — kullanıcı "modalde direkt görünsün, ayrıca
  // açılır menü olmasın" istedi (2026-09-03).
  hideToggle?: boolean;
  // Profildeki "Yorumlarım"dan gelen bir linkin işaret ettiği belirli kayıt —
  // "c88" bir yorum, "a56" bir AI cevabı (bkz. QuestionBankBoard.tsx). Feed
  // yüklenip bu id'ye sahip element DOM'a girince otomatik oraya kaydırılıp
  // kısa süreliğine vurgulanıyor.
  highlightTarget?: string | null;
}) {
  const pathname = usePathname();
  // Yorumlar artık soru cevaplanır cevaplanmaz otomatik açık gelmiyor — "Yorumlar"
  // başlığına tıklanınca açılıp kapanan bir panel (kullanıcı kararı, 2026-09-02).
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  // Yorumlar varsayılan açık gösterildiği yerlerde (bkz. DersClient) çok yorumlu bir
  // konu sayfayı aşırı uzatmasın diye önce sadece ilk 7 üst seviye yorum/AI cevabı
  // gösteriliyor, "Daha Fazla Göster" ile 7'şer artıyor (kullanıcı isteği, 2026-09-05).
  const [visibleFeedCount, setVisibleFeedCount] = useState(7);
  // Yeni bir soruya geçilince panel tekrar kapalı başlar — açık kalsaydı bir önceki
  // sorunun yorum listesi yeni soruda da (kısa an) görünür kalırdı. hideToggle modunda
  // (soru bankası modali) bu geçerli değil: her modal açılışı zaten TAZE bir mount, "aynı
  // instance'ta soru değişimi" hiç olmuyor — bu effect ilk mount'ta da çalıştığı için
  // hideToggle kontrolü olmasaydı defaultExpanded'i hemen geri kapatıp bozardı.
  useEffect(() => {
    if (hideToggle) return;
    setExpanded(false);
  }, [quizQuestionId, hideToggle]);
  const [availability, setAvailability] = useState<Availability>('loading');
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null);
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [aiEntries, setAiEntries] = useState<AiEntry[]>([]);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget>(null);
  const [replyText, setReplyText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [commentBusyId, setCommentBusyId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/rag/status?gradeId=${gradeId}&lessonId=${lessonId}`);
      const data = await res.json().catch(() => null);
      setAvailability(res.ok && data?.available ? 'available' : 'unavailable');
      if (res.ok && typeof data?.dailyRemaining === 'number') setDailyRemaining(data.dailyRemaining);
    })();
  }, [gradeId, lessonId]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthState(user ? 'in' : 'out');
      setUserId(user?.id ?? null);
    });
  }, []);

  const loadComments = React.useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from('question_comments')
      .select(
        'id, parent_comment_id, parent_ai_answer_id, body, status, created_at, student_id, profiles!question_comments_student_id_fkey(username, full_name, avatar_url)'
      )
      .order('created_at', { ascending: true });
    query = quizQuestionId != null ? query.eq('question_id', quizQuestionId) : query.eq('unit_id', unitId);
    const { data } = await query;
    setComments(
      ((data as CommentEntry[] | null) || [])
        .filter((c) => c.status !== 'deleted')
        .map((c) => ({ ...c, kind: 'comment' as const }))
    );
  }, [unitId, quizQuestionId]);

  const loadAiFeed = React.useCallback(async () => {
    const url = quizQuestionId != null ? `/api/rag/unit-feed?questionId=${quizQuestionId}` : `/api/rag/unit-feed?unitId=${unitId}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    if (res.ok && Array.isArray(data?.items)) {
      setAiEntries(
        data.items.map(
          (it: {
            id: number;
            question: string;
            answer: string | null;
            status?: AiAnswerStatus;
            model: string;
            created_at: string;
            student_id: string;
            profiles: Profile;
            parent_comment_id: number | null;
            parent_rag_answer_id: number | null;
          }) => ({
            ...it,
            status: it.status ?? 'published',
            kind: 'ai' as const,
            reportState: 'idle' as ReportState,
            reportReason: '',
          })
        )
      );
    }
  }, [unitId, quizQuestionId]);

  useEffect(() => {
    loadComments();
    loadAiFeed();
    setVisibleFeedCount(7);
  }, [loadComments, loadAiFeed]);

  // Sorular artık senkron cevaplanmıyor (bkz. /api/rag/process-queue, 5 dakikada bir
  // GitHub Actions'tan tetiklenen worker) — kendi kuyrukta/işlenmekte olan bir sorum
  // varken feed'i periyodik olarak yeniden çekip cevap gelince otomatik güncelliyoruz.
  const hasPendingAi = aiEntries.some((a) => a.status === 'queued' || a.status === 'processing');
  useEffect(() => {
    if (!hasPendingAi) return;
    const timer = window.setInterval(loadAiFeed, 15000);
    return () => window.clearInterval(timer);
  }, [hasPendingAi, loadAiFeed]);

  // highlightTarget doluysa (bkz. QuestionBankBoard.tsx), feed yüklenip ilgili
  // yorum/AI cevabı DOM'a girer girmez ona kaydırıp kısa süreliğine vurguluyor —
  // her comments/aiEntries güncellemesinde tekrar dener (hedef henüz gelmemiş
  // olabilir, ör. cevap hâlâ kuyrukta), bir kez bulunca bir daha denemiyor.
  const hasScrolledToTargetRef = React.useRef(false);
  useEffect(() => {
    if (!highlightTarget || hasScrolledToTargetRef.current) return;
    const el = document.getElementById(`disc-${highlightTarget}`);
    if (!el) return;
    hasScrolledToTargetRef.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-indigo-500');
    setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-500'), 2500);
  }, [highlightTarget, comments, aiEntries]);

  function updateAiEntry(id: number, patch: Partial<AiEntry>) {
    setAiEntries((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  async function submitComment(body: string, parentCommentId: number | null, parentAiAnswerId: number | null) {
    const trimmed = body.trim();
    if (!trimmed) return false;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Bunun için giriş yapmalısın');
        return false;
      }
      const insertRow: Record<string, unknown> = {
        student_id: user.id,
        body: trimmed,
        parent_comment_id: parentCommentId,
        parent_ai_answer_id: parentAiAnswerId,
      };
      if (quizQuestionId != null) insertRow.question_id = quizQuestionId;
      else insertRow.unit_id = unitId;

      const { data, error: insertError } = await supabase
        .from('question_comments')
        .insert(insertRow)
        .select('id, parent_comment_id, parent_ai_answer_id, body, status, created_at, student_id')
        .single();
      if (insertError) {
        setError('Gönderilemedi, lütfen tekrar deneyin');
        return false;
      }
      setComments((prev) => [...prev, { ...(data as CommentEntry), kind: 'comment' }]);
      // Yanıtlanan kişiye bildirim — ana akışı bloklamasın diye fire-and-forget
      // (bkz. /api/comments/[id]/notify'daki not, kullanıcı isteği 2026-09-04).
      if (parentCommentId != null || parentAiAnswerId != null) {
        fetch(`/api/comments/${(data as CommentEntry).id}/notify`, { method: 'POST' }).catch(() => {});
      }
      return true;
    } catch {
      setError('Gönderilemedi, lütfen tekrar deneyin');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteComment(comment: CommentEntry) {
    if (!window.confirm('Bu yorumu silmek istediğine emin misin? Yanıtı varsa onlar da kaldırılır.')) return;
    setCommentBusyId(comment.id);
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Silinemedi');
        return;
      }
      // Üst yorumsa hem yorum hem AI yanıtları kaldı — sadeliği korumak için
      // her iki akışı da yeniden yüklüyoruz.
      if (comment.parent_comment_id == null) {
        await Promise.all([loadComments(), loadAiFeed()]);
      } else {
        setComments((prev) => prev.filter((c) => c.id !== comment.id));
      }
    } catch {
      setError('Silinemedi, lütfen tekrar deneyin');
    } finally {
      setCommentBusyId(null);
    }
  }

  function startEdit(comment: CommentEntry) {
    setEditingId(comment.id);
    setEditText(comment.body);
  }

  async function saveEdit(comment: CommentEntry) {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setCommentBusyId(comment.id);
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', body: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Düzenlenemedi');
        return;
      }
      setComments((prev) =>
        prev.map((c) => (c.id === comment.id ? { ...c, body: trimmed, status: data.status || c.status } : c))
      );
      setEditingId(null);
      setEditText('');
    } catch {
      setError('Düzenlenemedi, lütfen tekrar deneyin');
    } finally {
      setCommentBusyId(null);
    }
  }

  async function submitAiQuestion(raw: string, mode: AiMode, target: ReplyTarget) {
    const tag = mode === 'hocam' ? HOCAM_TAG : KANKA_TAG;
    const question = raw.replace(new RegExp(tag, 'gi'), '').trim() || raw.trim();
    // Bir yoruma/AI cevabına yanıt olarak soruluyorsa parent_* burada set edilir —
    // hem doğru yerde (nested) görünsün hem de sunucu tarafında bağlam olarak kullanılsın.
    const parentCommentId = target?.type === 'comment' ? target.id : null;
    const parentRagAnswerId = target?.type === 'ai' ? target.id : null;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gradeId,
          lessonId,
          unitId,
          quizQuestionId: quizQuestionId ?? undefined,
          question,
          questionContext: questionContext || undefined,
          mode,
          parentCommentId: parentCommentId ?? undefined,
          parentRagAnswerId: parentRagAnswerId ?? undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Sorunuz gönderilemedi, lütfen tekrar deneyin');
        if (res.status === 429) setDailyRemaining(0);
        return false;
      }
      // Soru artık moderasyon beklemeden hemen normal bir yorum olarak yayınlanıyor
      // (kullanıcı isteği, 2026-09-04: "benim yorumum hemen yayınlansa, AI'nin
      // cevabı da ayrı birinin yorumu gibi yayınlansa"). Cevap hâlâ senkron
      // gelmiyor — altına, gerçek cevap gelene kadar yerel bir "hazırlanıyor"
      // yer tutucusu ekleniyor (hasPendingAi polling'i, gerçek cevap rag_answers'a
      // bu yoruma yanıt olarak yazılınca yerini alacak).
      const nowIso = new Date().toISOString();
      const commentBody = `${tag} ${question}`;
      setComments((prev) => [
        ...prev,
        {
          kind: 'comment',
          id: data.commentId,
          parent_comment_id: parentCommentId,
          parent_ai_answer_id: parentRagAnswerId,
          body: commentBody,
          status: 'published',
          created_at: nowIso,
          student_id: userId || '',
          profiles: data.profile || null,
        },
      ]);
      if (data.queueId != null) {
        setAiEntries((prev) => [
          {
            id: data.queueId,
            question,
            answer: null,
            status: 'queued',
            model: mode === 'kanka' ? 'gemini-2.5-flash-kanka' : 'gemini-2.5-flash',
            created_at: nowIso,
            student_id: userId || '',
            profiles: null,
            kind: 'ai',
            reportState: 'idle',
            reportReason: '',
            parent_comment_id: data.commentId,
            parent_rag_answer_id: null,
          },
          ...prev,
        ]);
      }
      if (typeof data.remaining === 'number') setDailyRemaining(data.remaining);
      return true;
    } catch {
      setError('Sorunuz gönderilemedi, lütfen tekrar deneyin');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  // Hem ana kutu hem "Yanıtla" kutusu bunu kullanır: "@hocam"/"@kanka" içeriyorsa
  // AI'ye soru gider (target doluysa yanıt verilen yorumun/cevabın ALTINA nested
  // olarak), yoksa target'a göre yorum/yanıt olur.
  async function submitSmart(raw: string, target: ReplyTarget): Promise<boolean> {
    const trimmed = raw.trim();
    if (!trimmed || submitting) return false;
    const lower = trimmed.toLowerCase();
    const mode: AiMode | null = lower.includes(HOCAM_TAG) ? 'hocam' : lower.includes(KANKA_TAG) ? 'kanka' : null;
    if (mode) {
      // @kanka ders notuna bağlı olmadığı için "ders notu var mı" kontrolüne ihtiyaç duymaz.
      if (mode === 'hocam' && availability !== 'available') {
        setError(`Bu ders için henüz ders notu eklenmedi, ${HOCAM_TAG} ile soru sorulamıyor — ${KANKA_TAG} ile sohbet edebilir ya da yorum yapabilirsin.`);
        return false;
      }
      if (dailyRemaining === 0) {
        setError('Bugünkü AI soru hakkını doldurdun. Yarın tekrar sorabilirsin.');
        return false;
      }
      return submitAiQuestion(trimmed, mode, target);
    }
    const parentCommentId = target?.type === 'comment' ? target.id : null;
    const parentAiAnswerId = target?.type === 'ai' ? target.id : null;
    return submitComment(trimmed, parentCommentId, parentAiAnswerId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await submitSmart(text, null);
    if (ok) setText('');
  }

  async function handleReplySubmit() {
    if (!replyTarget) return;
    const ok = await submitSmart(replyText, replyTarget);
    if (ok) {
      setReplyText('');
      setReplyTarget(null);
    }
  }

  async function submitReport(item: AiEntry) {
    updateAiEntry(item.id, { reportState: 'sending' });
    try {
      const res = await fetch('/api/rag/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ragAnswerId: item.id, reason: item.reportReason }),
      });
      if (!res.ok) {
        updateAiEntry(item.id, { reportState: 'open' });
        return;
      }
      updateAiEntry(item.id, { reportState: 'sent' });
    } catch {
      updateAiEntry(item.id, { reportState: 'open' });
    }
  }

  if (availability === 'loading') return null;

  const topLevelComments = comments.filter((c) => !c.parent_comment_id && !c.parent_ai_answer_id);
  const topLevelAi = aiEntries.filter((a) => !a.parent_comment_id && !a.parent_rag_answer_id);
  // Bir yoruma verilmiş yanıt hem başka bir yorum hem de @hocam/@kanka ile
  // verilmiş bir AI cevabı olabilir — ikisini de zaman sırasına göre birleştiriyoruz.
  const repliesOfComment = (id: number): FeedEntry[] =>
    [...comments.filter((c) => c.parent_comment_id === id), ...aiEntries.filter((a) => a.parent_comment_id === id)].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  const repliesOfAi = (id: number): FeedEntry[] =>
    [...comments.filter((c) => c.parent_ai_answer_id === id), ...aiEntries.filter((a) => a.parent_rag_answer_id === id)].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  const feed: FeedEntry[] = [...topLevelComments, ...topLevelAi].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const commentTotal = comments.length + aiEntries.length;

  // ReplyRow/ReplyAiRow kendi yanıtlarını recursive render edebilsin diye tüm ortak
  // handler'lar burada tek pakette toplanıyor (bkz. DiscussionHandlers tanımı).
  const handlers: DiscussionHandlers = {
    userId,
    editingId,
    editText,
    commentBusyId,
    replyTarget,
    replyText,
    submitting,
    onStartEdit: startEdit,
    onCancelEdit: () => {
      setEditingId(null);
      setEditText('');
    },
    onSaveEdit: saveEdit,
    onEditTextChange: setEditText,
    onDeleteComment: handleDeleteComment,
    onReportPatch: (id, patch) => updateAiEntry(id, patch),
    onReportSubmit: submitReport,
    onSetReplyTarget: setReplyTarget,
    onReplyTextChange: setReplyText,
    onReplySubmit: handleReplySubmit,
    repliesOfComment,
    repliesOfAi,
  };

  return (
    <div className={hideToggle ? '' : 'bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 sm:p-7 mb-4 sm:mb-7'}>
      {!hideToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`flex w-full items-center gap-2 text-left ${expanded ? 'mb-3' : ''}`}
        >
          <MessageCircle className="h-5 w-5 shrink-0 text-indigo-500" />
          <h2 className="flex-1 text-base font-black text-slate-900">
            {quizQuestionId != null ? 'Bu Soru Hakkında' : unitName ? `${unitName} Ünitesi Hakkında` : 'Ünite Hakkında'}
            {commentTotal > 0 && <span className="ml-1.5 font-normal text-slate-400">({commentTotal})</span>}
          </h2>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}

      {!expanded ? null : authState === 'loading' ? null : authState === 'out' ? (
        <p className="text-sm text-gray-500">
          Yorum yapmak veya AI&apos;ye soru sormak için{' '}
          <a href={`/login?redirectTo=${encodeURIComponent(pathname || '/')}`} className="text-indigo-600 font-medium hover:underline">
            giriş yapman
          </a>{' '}
          gerekiyor.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
            placeholder={`Yorum yaz, ${HOCAM_TAG} ile ders notuna, ${KANKA_TAG} ile serbest bir şey sor…`}
            rows={3}
            disabled={submitting}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:opacity-60 resize-none"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-gray-400">
              {text.length}/{MAX_LENGTH}
              {dailyRemaining != null && ` · AI için bugün kalan hakkın: ${dailyRemaining}`}
            </span>
            <button
              type="submit"
              disabled={submitting || !text.trim()}
              className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Gönderiliyor…' : 'Gönder'}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}

      {expanded && feed.length > 0 && (
        <div className="mt-5 space-y-4 border-t border-gray-100 pt-5">
          {feed.slice(0, visibleFeedCount).map((item) => {
            if (item.kind === 'comment') {
              const name = displayNameOf(item.profiles);
              const isOwn = item.student_id === userId;
              const isEditing = editingId === item.id;
              const isBusy = commentBusyId === item.id;
              return (
                <div key={`c${item.id}`} id={`disc-c${item.id}`} className="space-y-2">
                  <div className="flex items-start gap-2.5">
                    <Avatar name={name} url={avatarUrlOf(item.profiles)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{name}</span>
                        <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString('tr-TR')}</span>
                      </div>

                      {isEditing ? (
                        <div className="mt-1 space-y-1.5">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value.slice(0, MAX_LENGTH))}
                            rows={2}
                            disabled={isBusy}
                            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(item)}
                              disabled={isBusy || !editText.trim()}
                              className="px-3 py-1 rounded-md text-xs font-bold bg-indigo-500/15 text-indigo-600 hover:bg-indigo-500/25 disabled:opacity-40"
                            >
                              Kaydet
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditText('');
                              }}
                              className="px-3 py-1 rounded-md text-xs text-gray-500 hover:bg-gray-100"
                            >
                              Vazgeç
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">{item.body}</p>
                      )}

                      {item.status !== 'published' && item.status !== 'deleted' && isOwn && (
                        <p className="mt-1 text-[11px] text-amber-500">Onay bekliyor, sadece sen görüyorsun.</p>
                      )}

                      {!isEditing && (
                        <div className="mt-1 flex items-center gap-3">
                          <button
                            onClick={() => setReplyTarget(replyTarget?.type === 'comment' && replyTarget.id === item.id ? null : { type: 'comment', id: item.id })}
                            className="text-[11px] font-bold text-indigo-500 hover:text-indigo-400"
                          >
                            Yanıtla
                          </button>
                          {isOwn && (
                            <>
                              <button
                                onClick={() => startEdit(item)}
                                disabled={isBusy}
                                className="text-[11px] font-bold text-gray-400 hover:text-gray-600 disabled:opacity-40"
                              >
                                Düzenle
                              </button>
                              <button
                                onClick={() => handleDeleteComment(item)}
                                disabled={isBusy}
                                className="text-[11px] font-bold text-red-400 hover:text-red-600 disabled:opacity-40"
                              >
                                Sil
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {repliesOfComment(item.id).length > 0 && (
                        <div className="mt-2 ml-1 space-y-2 border-l-2 border-gray-100 pl-3">
                          {repliesOfComment(item.id).map((r) =>
                            r.kind === 'comment' ? (
                              <ReplyRow key={`c${r.id}`} comment={r} handlers={handlers} />
                            ) : (
                              <ReplyAiRow key={`a${r.id}`} item={r} handlers={handlers} showQuestion={false} />
                            )
                          )}
                        </div>
                      )}

                      <ReplyBox
                        target={{ type: 'comment', id: item.id }}
                        replyTarget={replyTarget}
                        replyText={replyText}
                        submitting={submitting}
                        onReplyTextChange={setReplyText}
                        onSubmit={handleReplySubmit}
                      />
                    </div>
                  </div>
                </div>
              );
            }

            const name = displayNameOf(item.profiles);
            return (
              <div key={`a${item.id}`} id={`disc-a${item.id}`} className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <Avatar name={name} url={avatarUrlOf(item.profiles)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{name}</span>
                      <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString('tr-TR')}</span>
                    </div>
                    <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">{tagForModel(item.model)} {item.question}</p>
                  </div>
                </div>

                <div className="ml-[42px] flex items-start gap-2.5">
                  <AiAvatar model={item.model} sizeClass="h-8 w-8" />
                  <div className="min-w-0 flex-1 rounded-lg bg-gray-50/80 p-3">
                    {item.status !== 'published' ? (
                      <AiPendingOrFailed status={item.status} />
                    ) : (
                      <>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.answer}</p>
                        <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200/60 rounded-md px-2.5 py-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>Bu cevap yapay zeka tarafından üretildi, hata içerebilir.</span>
                        </div>

                        <div className="mt-2">
                          {item.reportState === 'idle' && (
                            <div className="flex items-center gap-3 flex-wrap">
                              <button
                                onClick={() => setReplyTarget(replyTarget?.type === 'ai' && replyTarget.id === item.id ? null : { type: 'ai', id: item.id })}
                                className="text-[11px] font-bold text-indigo-500 hover:text-indigo-400"
                              >
                                Yanıtla
                              </button>
                              <button
                                onClick={() => updateAiEntry(item.id, { reportState: 'open' })}
                                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <Flag className="h-3 w-3" /> Bu cevapta hata var, bildir
                              </button>
                            </div>
                          )}
                          {item.reportState === 'open' && (
                            <div className="space-y-2">
                              <textarea
                                value={item.reportReason}
                                onChange={(e) => updateAiEntry(item.id, { reportReason: e.target.value.slice(0, 500) })}
                                placeholder="Neyin yanlış/eksik olduğunu kısaca yazabilirsin (opsiyonel)"
                                rows={2}
                                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => submitReport(item)}
                                  className="px-3 py-1 rounded-md bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100"
                                >
                                  Bildir
                                </button>
                                <button
                                  onClick={() => updateAiEntry(item.id, { reportState: 'idle', reportReason: '' })}
                                  className="px-3 py-1 rounded-md text-gray-500 text-xs hover:bg-gray-100"
                                >
                                  Vazgeç
                                </button>
                              </div>
                            </div>
                          )}
                          {item.reportState === 'sending' && <p className="text-xs text-gray-400">Gönderiliyor…</p>}
                          {item.reportState === 'sent' && <p className="text-xs text-emerald-600">Bildirdiğin için teşekkürler, incelenecek.</p>}
                        </div>
                      </>
                    )}

                    {repliesOfAi(item.id).length > 0 && (
                      <div className="mt-3 space-y-2 border-l-2 border-gray-200 pl-3">
                        {repliesOfAi(item.id).map((r) =>
                          r.kind === 'comment' ? (
                            <ReplyRow key={`c${r.id}`} comment={r} handlers={handlers} />
                          ) : (
                            <ReplyAiRow key={`a${r.id}`} item={r} handlers={handlers} />
                          )
                        )}
                      </div>
                    )}

                    <ReplyBox
                      target={{ type: 'ai', id: item.id }}
                      replyTarget={replyTarget}
                      replyText={replyText}
                      submitting={submitting}
                      onReplyTextChange={setReplyText}
                      onSubmit={handleReplySubmit}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {feed.length > visibleFeedCount && (
            <button
              type="button"
              onClick={() => setVisibleFeedCount((n) => n + 7)}
              className="w-full rounded-lg border border-gray-200 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              Daha Fazla Göster ({feed.length - visibleFeedCount})
            </button>
          )}
        </div>
      )}

      {expanded && feed.length === 0 && authState !== 'loading' && (
        <p className="mt-5 text-sm text-gray-400 border-t border-gray-100 pt-5">
          {quizQuestionId != null ? 'Bu soru için henüz yorum yok, ilk yorumu sen yaz.' : 'Henüz yorum yok, ilk yorumu sen yaz.'}
        </p>
      )}

      {expanded && questionContext && (
        <p className="mt-3 text-xs text-gray-400">
          <Sparkles className="inline h-3 w-3 mr-1" />
          Sadece bu soru hakkında AI&apos;ye sormak için <span className="font-mono">{HOCAM_TAG}</span> yaz — örn. &quot;{HOCAM_TAG} neden A doğru?&quot;
        </p>
      )}
    </div>
  );
}
