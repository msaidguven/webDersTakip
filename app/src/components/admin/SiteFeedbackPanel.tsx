'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Bell, Check, CheckCircle2, ExternalLink, Loader2, Mail, MessageSquareReply, StickyNote, Trash2 } from 'lucide-react';
import {
  AREA_LABEL,
  CATEGORY_LABEL,
  FEEDBACK_CATEGORIES,
  ROLE_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  type FeedbackCategory,
  type FeedbackRole,
  type FeedbackStatus,
  type SiteFeedbackRow,
} from '@/app/src/lib/siteFeedback';

type Counts = {
  newTotal: number;
  newTeacher: number;
  newStudent: number;
  newGuest: number;
};

type FeedbackResponse = {
  items: SiteFeedbackRow[];
  counts: Counts;
};

const ROLE_BADGE: Record<FeedbackRole, string> = {
  teacher: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
  student: 'bg-indigo-500/15 text-indigo-700 border-indigo-500/30 dark:text-indigo-300',
  guest: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300',
  admin: 'bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-300',
};

const STATUS_BADGE: Record<FeedbackStatus, string> = {
  new: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300',
  read: 'bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-300',
  resolved: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300',
};

const TEACHER_SNIPPETS = [
  'Çok teşekkür ederim {ad} Hocam, önerinizi notlarıma aldım; kısa sürede ekleyeceğim.',
  'Geri bildiriminiz için çok teşekkürler {ad} Hocam, belirttiğiniz noktayı düzelttik.',
];

const STUDENT_SNIPPETS = [
  'Geri bildirimin için çok teşekkürler {ad}! Önerini değerlendirmeye aldık.',
  'Bildirimin için teşekkürler {ad}, belirttiğin sorunu düzelttik!',
];

const fetchFeedback = async (url: string): Promise<FeedbackResponse> => {
  const res = await fetch(url);
  const data = (await res.json().catch(() => null)) as (FeedbackResponse & { error?: string }) | null;
  if (!res.ok || !data) {
    throw new Error(data?.error || 'Geri bildirimler yüklenemedi');
  }
  return data;
};

export default function SiteFeedbackPanel() {
  const [roleFilter, setRoleFilter] = useState<'all' | FeedbackRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | FeedbackCategory>('all');

  const [openReplyId, setOpenReplyId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [openNoteId, setOpenNoteId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const params = new URLSearchParams();
  if (roleFilter !== 'all') params.set('role', roleFilter);
  if (statusFilter !== 'all') params.set('status', statusFilter);
  if (categoryFilter !== 'all') params.set('category', categoryFilter);
  const queryKey = `/api/admin/feedback?${params.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<FeedbackResponse, Error>(queryKey, fetchFeedback, {
    revalidateOnFocus: false,
  });

  const items = data?.items ?? [];
  const counts = data?.counts ?? { newTotal: 0, newTeacher: 0, newStudent: 0, newGuest: 0 };

  async function updateStatus(item: SiteFeedbackRow, nextStatus: FeedbackStatus) {
    setBusyId(item.id);
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status: nextStatus }),
      });
      if (res.ok) await mutate();
    } finally {
      setBusyId(null);
    }
  }

  async function saveAdminNote(item: SiteFeedbackRow) {
    setBusyId(item.id);
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, adminNote: noteText }),
      });
      if (res.ok) {
        setOpenNoteId(null);
        await mutate();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function sendReply(item: SiteFeedbackRow) {
    if (replyText.trim().length < 2) return;
    setBusyId(item.id);
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, reply: replyText.trim(), markResolved: true }),
      });
      const resData = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        alert(resData?.error || 'Yanıt gönderilemedi');
        return;
      }
      setOpenReplyId(null);
      setReplyText('');
      await mutate();
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(item: SiteFeedbackRow) {
    if (!window.confirm('Bu geri bildirimi kalıcı olarak silmek istiyor musunuz?')) return;
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/admin/feedback?id=${item.id}`, { method: 'DELETE' });
      if (res.ok) await mutate();
    } finally {
      setBusyId(null);
    }
  }

  const pillCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
      active
        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
        : 'border-border bg-card text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="space-y-5">
      {/* Filtre Çubuğu */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-bold text-muted-foreground">Rol:</span>
          <button type="button" onClick={() => setRoleFilter('all')} className={pillCls(roleFilter === 'all')}>
            Tümü
            {counts.newTotal > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">{counts.newTotal}</span>
            )}
          </button>
          <button type="button" onClick={() => setRoleFilter('teacher')} className={pillCls(roleFilter === 'teacher')}>
            Öğretmen
            {counts.newTeacher > 0 && (
              <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] text-white">{counts.newTeacher}</span>
            )}
          </button>
          <button type="button" onClick={() => setRoleFilter('student')} className={pillCls(roleFilter === 'student')}>
            Öğrenci
            {counts.newStudent > 0 && (
              <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] text-white">{counts.newStudent}</span>
            )}
          </button>
          <button type="button" onClick={() => setRoleFilter('guest')} className={pillCls(roleFilter === 'guest')}>
            Misafir
            {counts.newGuest > 0 && (
              <span className="rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] text-white">{counts.newGuest}</span>
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-bold text-muted-foreground">Durum:</span>
            <button type="button" onClick={() => setStatusFilter('all')} className={pillCls(statusFilter === 'all')}>
              Tümü
            </button>
            {(['new', 'read', 'resolved'] as const).map((st) => (
              <button key={st} type="button" onClick={() => setStatusFilter(st)} className={pillCls(statusFilter === st)}>
                {STATUS_LABEL[st]}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            Kategori:
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'all' | FeedbackCategory)}
              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-indigo-500"
            >
              <option value="all">Tüm Kategoriler</option>
              {FEEDBACK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-600 dark:text-rose-400">
          {error.message}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Yükleniyor…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Seçili filtrelere uygun geri bildirim bulunamadı.
        </div>
      ) : (
        <div className="space-y-3.5">
          {items.map((item) => {
            const isReplying = openReplyId === item.id;
            const isNoting = openNoteId === item.id;
            const isBusy = busyId === item.id;
            const snippets = item.role === 'teacher' ? TEACHER_SNIPPETS : STUDENT_SNIPPETS;
            const mailtoHref =
              item.sender_email
                ? `mailto:${encodeURIComponent(item.sender_email)}?subject=${encodeURIComponent('Ders Takip — Mesajınız Hakkında')}&body=${encodeURIComponent(
                    `Merhaba${item.sender_name ? ` ${item.sender_name}` : ''},\n\nDers Takip üzerinden ilettiğiniz mesaj için teşekkür ederiz:\n"${item.message ?? ''}"\n\n`,
                  )}`
                : null;

            return (
              <article
                key={item.id}
                className={`rounded-2xl border bg-card p-4 sm:p-5 transition-colors ${
                  item.status === 'new' ? 'border-amber-500/50 shadow-sm' : 'border-border'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${ROLE_BADGE[item.role]}`}>
                      {ROLE_LABEL[item.role]}
                      {item.role === 'teacher' && item.context?.isVerified && ' ✓'}
                    </span>
                    <span className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${STATUS_BADGE[item.status]}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                    <span className="rounded-lg border border-border bg-accent px-2 py-0.5 text-xs font-semibold text-foreground">
                      {CATEGORY_LABEL[item.category] ?? item.category}
                    </span>
                    {item.area && (
                      <span className="rounded-lg border border-border px-2 py-0.5 text-xs text-muted-foreground">
                        {AREA_LABEL[item.area] ?? item.area}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">· {SOURCE_LABEL[item.source] ?? item.source}</span>
                  </div>
                  <time className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString('tr-TR')}
                  </time>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {item.sender_name || (item.user_id ? 'İsimsiz Üye' : 'Anonim Misafir')}
                  </span>
                  {item.sender_email && <span>{item.sender_email}</span>}
                  {item.context?.lessons && item.context.lessons.length > 0 && (
                    <span>· Branş: <b className="text-foreground">{item.context.lessons.join(', ')}</b></span>
                  )}
                  {item.context?.gradeName && (
                    <span>· Sınıf: <b className="text-foreground">{item.context.gradeName}</b></span>
                  )}
                  {item.context?.school && <span>· {item.context.school}</span>}
                  {typeof item.context?.streak === 'number' && <span>· 🔥 {item.context.streak} gün seri</span>}
                  {item.context?.examTitle && <span>· Yazılı: {item.context.examTitle}</span>}
                  {item.context?.viewport && <span>· {item.context.viewport === 'mobile' ? 'Mobil' : 'Masaüstü'}</span>}
                  {item.page_path && (
                    <Link href={item.page_path} target="_blank" className="inline-flex items-center gap-0.5 text-indigo-500 hover:underline">
                      {item.page_path} <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>

                {item.message ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{item.message}</p>
                ) : (
                  <p className="mt-3 text-xs italic text-muted-foreground">
                    Not bırakılmadı (yalnızca hızlı tepki / kategori seçildi).
                  </p>
                )}

                {item.admin_reply && (
                  <div className="mt-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3 text-xs">
                    <p className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400">
                      <Bell className="h-3.5 w-3.5" /> Gönderilen Zil Yanıtı
                      {item.replied_at && (
                        <span className="font-normal text-muted-foreground">
                          · {new Date(item.replied_at).toLocaleString('tr-TR')}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-foreground">{item.admin_reply}</p>
                  </div>
                )}

                {item.admin_note && !isNoting && (
                  <div className="mt-2.5 rounded-xl border border-border bg-accent/60 px-3 py-2 text-xs text-muted-foreground">
                    <b className="text-foreground">Not:</b> {item.admin_note}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  {item.status === 'new' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void updateStatus(item, 'read')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-accent px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/80 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Okundu İşaretle
                    </button>
                  )}

                  {item.status !== 'resolved' ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void updateStatus(item, 'resolved')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-300"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Çözüldü İşaretle
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void updateStatus(item, 'read')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Yeniden Aç
                    </button>
                  )}

                  {item.user_id && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setOpenReplyId(isReplying ? null : item.id);
                        setReplyText(item.admin_reply ?? '');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-300"
                    >
                      <MessageSquareReply className="h-3.5 w-3.5" />
                      {item.admin_reply ? 'Yeni Zil Yanıtı Gönder' : 'Zil ile Yanıtla'}
                    </button>
                  )}

                  {mailtoHref && (
                    <a
                      href={mailtoHref}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-accent px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/80"
                    >
                      <Mail className="h-3.5 w-3.5" /> E-posta Gönder
                    </a>
                  )}

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      setOpenNoteId(isNoting ? null : item.id);
                      setNoteText(item.admin_note ?? '');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <StickyNote className="h-3.5 w-3.5" /> {item.admin_note ? 'Notu Düzenle' : 'Not Ekle'}
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void removeItem(item)}
                    aria-label="Sil"
                    className="ml-auto inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Sil
                  </button>
                </div>

                {isReplying && item.user_id && (
                  <div className="mt-3 space-y-2.5 rounded-xl border border-indigo-500/30 bg-background p-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {snippets.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setReplyText(s)}
                          className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:border-indigo-500/40 hover:text-foreground"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      maxLength={2000}
                      placeholder="Kullanıcının bildirim çanına (🔔) düşecek yanıtınızı yazın ({ad} ilk adla değişir)…"
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-indigo-500"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        Gönderildiğinde kullanıcının bildirim çanına düşer ve durum Çözüldü olur.
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setOpenReplyId(null)}
                          className="rounded-xl px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                        >
                          Vazgeç
                        </button>
                        <button
                          type="button"
                          disabled={isBusy || replyText.trim().length < 2}
                          onClick={() => void sendReply(item)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {isBusy ? 'Gönderiliyor…' : 'Yanıtı Gönder'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {isNoting && (
                  <div className="mt-3 space-y-2 rounded-xl border border-border bg-background p-3.5">
                    <textarea
                      rows={2}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      maxLength={2000}
                      placeholder="Yalnızca senin göreceğin iç not…"
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-indigo-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenNoteId(null)}
                        className="rounded-xl px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                      >
                        Vazgeç
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void saveAdminNote(item)}
                        className="rounded-xl bg-foreground px-3.5 py-1.5 text-xs font-bold text-background hover:opacity-90 disabled:opacity-50"
                      >
                        Kaydet
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
