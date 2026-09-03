'use client';

import React, { useCallback, useEffect, useState } from 'react';

type Item = {
  id: string;
  kind: 'comment' | 'ai';
  status: 'pending' | 'published' | 'rejected' | 'deleted';
  createdAt: string;
  contextLabel: string | null;
  href: string | undefined;
  student: { id: string; username: string | null; fullName: string | null } | null;
  isReply: boolean;
  body?: string;
  question?: string;
  answer?: string;
  mode?: 'hocam' | 'kanka';
  // Yorumlar artık moderasyon beklemeden yayınlanıyor — bu, admin'in "gördüm" dediği,
  // yayın durumundan bağımsız ayrı bir işaret. null ise henüz bakılmamış demektir.
  reviewedAt: string | null;
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tüm Durumlar' },
  { value: 'published', label: 'Yayınlanan' },
  { value: 'pending', label: 'Bekleyen' },
  { value: 'rejected', label: 'Reddedilen' },
  { value: 'deleted', label: 'Silinen' },
] as const;

const REVIEWED_OPTIONS = [
  { value: '', label: 'İncelenme Durumu (hepsi)' },
  { value: 'no', label: 'İncelenmedi' },
  { value: 'yes', label: 'İncelendi' },
] as const;

const KIND_OPTIONS = [
  { value: 'all', label: 'Hepsi' },
  { value: 'comment', label: 'Yorumlar' },
  { value: 'ai', label: "AI'ye Sorulanlar" },
] as const;

const STATUS_BADGE: Record<Item['status'], { text: string; className: string }> = {
  published: { text: 'Yayında', className: 'bg-emerald-500/20 text-emerald-300' },
  pending: { text: 'Bekliyor', className: 'bg-amber-500/20 text-amber-300' },
  rejected: { text: 'Reddedildi', className: 'bg-red-500/20 text-red-300' },
  deleted: { text: 'Silindi', className: 'bg-gray-500/20 text-gray-400' },
};

const KIND_BADGE: Record<string, { text: string; className: string }> = {
  comment: { text: 'Yorum', className: 'bg-indigo-500/20 text-indigo-300' },
  reply: { text: 'Yanıt', className: 'bg-indigo-500/20 text-indigo-300' },
  hocam: { text: '🎓 Hocam', className: 'bg-sky-500/20 text-sky-300' },
  kanka: { text: '😄 Kanka', className: 'bg-purple-500/20 text-purple-300' },
};

function studentLabel(student: Item['student']): string {
  if (!student) return 'Silinmiş kullanıcı';
  return student.username || student.fullName || student.id.slice(0, 8);
}

const PAGE_SIZE = 30;

export default function AllCommentsPanel() {
  const [status, setStatus] = useState<string>('all');
  const [kind, setKind] = useState<string>('all');
  const [reviewed, setReviewed] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  function showNotice(kind: 'success' | 'error', text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 6000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status, kind, page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (reviewed) params.set('reviewed', reviewed);
      const res = await fetch(`/api/admin/all-comments?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setItems((data.items as Item[] | null) || []);
        setTotal(data.total || 0);
        setHasMore(!!data.hasMore);
      } else {
        showNotice('error', data.error || 'Yüklenemedi');
      }
    } finally {
      setLoading(false);
    }
  }, [status, kind, search, reviewed, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Filtre/arama değişince ilk sayfaya dön — eski sayfa numarasıyla kalırsa boş bir sonuç
  // ekranı gösterebilir (ör. 3. sayfadayken filtre değişip toplam kayıt azalırsa).
  useEffect(() => {
    setPage(1);
  }, [status, kind, search, reviewed]);

  async function handleAction(item: Item, action: 'publish' | 'reject' | 'delete' | 'restore' | 'review') {
    setBusyId(item.id);
    try {
      const numericId = item.id.replace(/^(comment|ai)-/, '');
      const res = await fetch(`/api/admin/all-comments/${numericId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: item.kind, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'İşlem başarısız');
        return;
      }
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? action === 'review'
              ? { ...it, reviewedAt: new Date().toISOString() }
              : { ...it, status: data.status }
            : it
        )
      );
      const labels: Record<string, string> = {
        publish: 'Yayınlandı',
        reject: 'Reddedildi',
        delete: 'Silindi',
        restore: 'Geri yüklendi (inceleme bekliyor)',
        review: 'İncelendi olarak işaretlendi',
      };
      showNotice('success', labels[action]);
    } catch {
      showNotice('error', 'İşlem sırasında hata oluştu');
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
        >
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={reviewed}
          onChange={(e) => setReviewed(e.target.value)}
          className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
        >
          {REVIEWED_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
            placeholder="Yorum/soru/cevap içinde ara..."
            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-500"
          />
          <button onClick={() => setSearch(searchInput)} className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm shrink-0">
            Ara
          </button>
        </div>
      </div>

      {notice && (
        <div className={`rounded-xl px-4 py-3 text-sm ${notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
          {notice.text}
        </div>
      )}

      <p className="text-xs text-gray-500">{total} kayıt</p>

      {loading ? (
        <p className="text-gray-500 text-sm">Yükleniyor…</p>
      ) : items.length === 0 ? (
        <div className="bg-[#111114] rounded-2xl border border-white/5 p-8 text-center">
          <p className="text-gray-500 text-sm">Filtreyle eşleşen kayıt yok.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const statusBadge = STATUS_BADGE[item.status];
            const kindBadge = item.kind === 'comment' ? KIND_BADGE[item.isReply ? 'reply' : 'comment'] : KIND_BADGE[item.mode || 'hocam'];
            return (
              <div key={item.id} className="bg-[#111114] rounded-2xl border border-white/5 p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${kindBadge.className}`}>{kindBadge.text}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusBadge.className}`}>{statusBadge.text}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${item.reviewedAt ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-gray-400'}`}>
                    {item.reviewedAt ? '✓ İncelendi' : 'İncelenmedi'}
                  </span>
                  <span className="text-xs text-gray-500">{studentLabel(item.student)}</span>
                  <span className="text-xs text-gray-600 ml-auto">{new Date(item.createdAt).toLocaleString('tr-TR')}</span>
                </div>

                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">Bağlam</p>
                  {item.href ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 text-sm underline underline-offset-2">
                      {item.contextLabel || 'Soruya git'} ↗
                    </a>
                  ) : (
                    <p className="text-white text-sm">{item.contextLabel || '—'}</p>
                  )}
                </div>

                {item.kind === 'comment' ? (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Yorum</p>
                    <p className="text-gray-200 text-sm whitespace-pre-wrap break-words">{item.body}</p>
                  </div>
                ) : (
                  <div className="mb-4 space-y-2">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Soru</p>
                      <p className="text-gray-200 text-sm whitespace-pre-wrap break-words">{item.question}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Cevap</p>
                      <p className="text-gray-400 text-sm whitespace-pre-wrap break-words">{item.answer}</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {(item.status === 'pending' || item.status === 'rejected') && (
                    <button
                      onClick={() => handleAction(item, 'publish')}
                      disabled={busyId === item.id}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40"
                    >
                      Yayınla
                    </button>
                  )}
                  {(item.status === 'pending' || item.status === 'published') && (
                    <button
                      onClick={() => handleAction(item, 'reject')}
                      disabled={busyId === item.id}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-40"
                    >
                      Reddet
                    </button>
                  )}
                  {item.status !== 'deleted' && (
                    <button
                      onClick={() => handleAction(item, 'delete')}
                      disabled={busyId === item.id}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-500/20 text-gray-300 hover:bg-gray-500/30 disabled:opacity-40"
                    >
                      Sil
                    </button>
                  )}
                  {item.status === 'deleted' && (
                    <button
                      onClick={() => handleAction(item, 'restore')}
                      disabled={busyId === item.id}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-40"
                    >
                      Geri Yükle
                    </button>
                  )}
                  {!item.reviewedAt && (
                    <button
                      onClick={() => handleAction(item, 'review')}
                      disabled={busyId === item.id}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 disabled:opacity-40"
                    >
                      İncelendi İşaretle
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm disabled:opacity-30"
          >
            ← Önceki
          </button>
          <span className="text-xs text-gray-500">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm disabled:opacity-30"
          >
            Sonraki →
          </button>
        </div>
      )}
    </div>
  );
}
