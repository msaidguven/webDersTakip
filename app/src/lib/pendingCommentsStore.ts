// app/src/lib/pendingCommentsStore.ts
// Kullanıcının kendi gönderdiği, herkese açık (CDN'de haftalık önbellekli) akışta henüz görünmeyen
// yorumları — onay bekleyenler ve @hocam/@kanka soru yorumları — tarayıcıda tutar (2026-10-04,
// CPU 2. tur, kullanıcı kararı). Akış artık herkese aynı önbellekli yanıtı veriyor
// (bkz. publicApiCache.ts); kişisel "onay bekliyor" kaydı sunucuya hiç gitmeden buradan eklenir.
// Kayıt, herkese açık akışta aynı id ile görünür olunca ya da MAX_AGE_MS dolunca düşer.
// Yalnız görüntü kolaylığı: localStorage erişilemezse (gizli pencere vb.) sessizce boş döner.

const STORAGE_KEY = 'ownPendingComments:v1';
const MAX_AGE_MS = 21 * 86_400_000;

export type StoredOwnComment = {
  id: number;
  parent_comment_id: number | null;
  parent_ai_answer_id: number | null;
  body: string;
  status: 'pending' | 'published' | 'rejected' | 'deleted';
  created_at: string;
  student_id: string;
  profiles: unknown;
};

type Stored = { scope: string; savedAt: number; comment: StoredOwnComment };

function readAll(): Stored[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Stored[]) : [];
    const now = Date.now();
    return Array.isArray(parsed) ? parsed.filter((s) => s && typeof s.scope === 'string' && now - s.savedAt < MAX_AGE_MS) : [];
  } catch {
    return [];
  }
}

function writeAll(items: Stored[]) {
  try {
    if (items.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // depolama kapalı — yerel kayıt tutulamaz, akış yine çalışır
  }
}

export function commentScopeKey(quizQuestionId: number | null | undefined, topicId: number | null | undefined, unitId: number): string {
  return quizQuestionId != null ? `q:${quizQuestionId}` : topicId != null ? `t:${topicId}` : `u:${unitId}`;
}

// Bu kapsamdaki, kullanıcıya ait ve akışta henüz olmayan yerel yorumlar; akışta görünenler temizlenir.
export function ownPendingComments(scope: string, userId: string, publicIds: Set<number>): StoredOwnComment[] {
  const all = readAll();
  const kept = all.filter((s) => !(s.scope === scope && publicIds.has(s.comment.id)));
  writeAll(kept);
  return kept.filter((s) => s.scope === scope && s.comment.student_id === userId).map((s) => s.comment);
}

export function rememberOwnComment(scope: string, comment: StoredOwnComment) {
  writeAll([...readAll().filter((s) => s.comment.id !== comment.id), { scope, savedAt: Date.now(), comment }]);
}

export function updateOwnComment(id: number, patch: Partial<StoredOwnComment>) {
  writeAll(readAll().map((s) => (s.comment.id === id ? { ...s, comment: { ...s.comment, ...patch } } : s)));
}

export function forgetOwnComment(id: number) {
  writeAll(readAll().filter((s) => s.comment.id !== id));
}
