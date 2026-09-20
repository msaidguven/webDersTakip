'use client';

// RAG sentez metni hazır olan ama alt başlığı/içeriği hiç üretilmemiş konular için, her
// 20 dakikada bir otomatik üretilen taslakları admin onayına sunar (kullanıcının 2026-09-19
// isteği: "ayrı bi tablo ve admin panelde ayrı bi arayüz olsun"). Soru taslakları panelinin
// aksine burada inline düzenleme YOK — konu tek seferde 6-8 alt başlıklık uzun bir içerik
// olduğu için düzenleme yerine sadece OKU + Onayla/Reddet sunuyoruz; onay sonrası içerik
// mevcut "İçeriği Güncelle" akışıyla (topic-sections prompt/plan) elle iyileştirilebilir.
// "Onayla": mevcut /api/admin/topic-sections/plan'ı (manuel NotebookLM akışının kaydetme
// endpoint'i) ÇAĞIRIR — paralel bir yayınlama mantığı icat edilmiyor.
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

type DraftSection = {
  heading: string;
  order_no: number;
  matched_outcome_codes: string[];
  explanation_markdown: string;
  activity_prompt_markdown: string | null;
  activity_example_markdown: string | null;
  review_summary: string | null;
};

type Draft = {
  id: number;
  topicId: number;
  aiModel: string | null;
  cover: { subtitle?: string } | null;
  sections: DraftSection[];
  summaryMarkdown: string | null;
  discussionPromptMarkdown: string | null;
  createdAt: string;
  topicTitle: string;
  unitTitle: string;
  lessonName: string;
  gradeName: string;
};

type WorkerRun = {
  id: number;
  generated: boolean;
  reason: string | null;
  draft_id: number | null;
  created_at: string;
};

export default function AiContentDraftsPanel() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [workerRuns, setWorkerRuns] = useState<WorkerRun[]>([]);
  const [runsOpen, setRunsOpen] = useState(false);

  function showNotice(kind: 'success' | 'error', text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 6000);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ai-content-drafts');
      const data = await res.json().catch(() => null);
      if (res.ok) setDrafts((data?.drafts as Draft[] | null) || []);
    } finally {
      setLoading(false);
    }
  }

  async function loadRuns() {
    try {
      const res = await fetch('/api/admin/ai-content-drafts/worker-runs');
      const data = await res.json().catch(() => null);
      if (res.ok) setWorkerRuns((data?.runs as WorkerRun[] | null) || []);
    } catch {
      // sessizce geç — bu bilgilendirme amaçlı bir panel, ana akışı bozmasın
    }
  }

  useEffect(() => {
    load();
    loadRuns();
  }, []);

  async function persistStatus(draftId: number, action: 'reject' | 'mark_saved') {
    const res = await fetch(`/api/admin/ai-content-drafts/${draftId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) return { ok: false, claimed: false };
    const data = await res.json().catch(() => null);
    return { ok: true, claimed: data?.claimed !== false };
  }

  // Soru taslaklarındaki AYNI çift-kaydetme önleme deseni: durum önce atomik olarak
  // 'saved'e çevrilir, sadece bu istek "claimed" ederse gerçek yayınlama isteği atılır.
  async function handleApprove(draft: Draft) {
    setBusyId(draft.id);
    try {
      const { ok, claimed } = await persistStatus(draft.id, 'mark_saved');
      if (!ok) { showNotice('error', 'İşlem başarısız oldu'); return; }
      if (!claimed) {
        setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
        showNotice('error', 'Bu taslak zaten işlenmiş — tekrar yayınlanmadı');
        return;
      }

      const publishRes = await fetch('/api/admin/topic-sections/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: draft.topicId,
          sections: draft.sections,
          cover: draft.cover,
          ai_model: draft.aiModel,
          summary_markdown: draft.summaryMarkdown,
          discussion_prompt_markdown: draft.discussionPromptMarkdown,
        }),
      });
      const publishData = await publishRes.json().catch(() => null);
      if (!publishRes.ok) {
        showNotice('error', `${publishData?.error || 'İçerik yayınlanamadı'} — taslağın durumu değişti, admin ile kontrol edin`);
        return;
      }

      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      showNotice('success', `"${draft.topicTitle}" içeriği yayınlandı (${draft.sections.length} alt başlık)`);
    } catch {
      showNotice('error', 'Ağ hatası oluştu');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(draft: Draft) {
    setBusyId(draft.id);
    try {
      const { ok, claimed } = await persistStatus(draft.id, 'reject');
      if (!ok) { showNotice('error', 'İşlem başarısız oldu'); return; }
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      showNotice(claimed ? 'success' : 'error', claimed ? 'Taslak reddedildi' : 'Bu taslak zaten işlenmişti');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div className={`rounded-xl px-4 py-3 text-sm ${notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
          {notice.text}
        </div>
      )}

      {workerRuns.length > 0 && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setRunsOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-surface"
          >
            <span className="text-xs font-bold text-muted-foreground">
              Son Çalışmalar · son {workerRuns.length} çalıştırmadan {workerRuns.filter((r) => r.generated).length} tanesi taslak üretti
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${runsOpen ? 'rotate-180' : ''}`} />
          </button>
          {runsOpen && (
            <div className="border-t border-border divide-y divide-border">
              {workerRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                  <span className="text-muted-foreground shrink-0">{new Date(run.created_at).toLocaleString('tr-TR')}</span>
                  <span className={`truncate text-right ${run.generated ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {run.generated ? 'Taslak üretildi' : run.reason || 'Üretilmedi'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">Yükleniyor…</p>
      ) : drafts.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <p className="text-muted-foreground text-sm">Onay bekleyen AI içerik taslağı yok 🎉</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {drafts.map((draft) => {
            const busy = busyId === draft.id;
            const isOpen = expandedId === draft.id;
            return (
              <div key={draft.id} className="bg-card rounded-2xl border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId((cur) => (cur === draft.id ? null : draft.id))}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-surface"
                >
                  <div className="min-w-0 flex-1">
                    <span className="mb-1 inline-block text-xs px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300">
                      {draft.gradeName} · {draft.lessonName} · {draft.unitTitle}
                    </span>
                    <p className="truncate text-sm font-bold text-foreground">{draft.topicTitle}</p>
                  </div>
                  <span className="shrink-0 text-xs font-black text-muted-foreground">{draft.sections.length} alt başlık</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                <div className="border-t border-border p-4 pt-3 sm:p-6 sm:pt-4">
                <p className="mb-3 text-xs text-muted-foreground">{new Date(draft.createdAt).toLocaleString('tr-TR')} tarihinde üretildi · {draft.aiModel}</p>

                {draft.cover?.subtitle && (
                  <p className="mb-3 rounded-xl bg-surface px-3 py-2 text-xs italic text-muted-foreground">{draft.cover.subtitle}</p>
                )}

                <div className="space-y-3">
                  {draft.sections.map((s, idx) => (
                    <div key={idx} className="rounded-xl border border-border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-foreground">{idx + 1}. {s.heading}</span>
                        {s.matched_outcome_codes.length > 0 && (
                          <span className="shrink-0 text-[10px] font-black text-muted-foreground">{s.matched_outcome_codes.join(', ')}</span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">{s.explanation_markdown}</p>
                      {s.activity_prompt_markdown && (
                        <p className="rounded-lg bg-indigo-500/10 px-2 py-1.5 text-[11px] text-indigo-200">
                          <strong>Etkinlik:</strong> {s.activity_prompt_markdown}
                        </p>
                      )}
                      {s.review_summary && (
                        <p className="rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
                          <strong>Tekrar özeti:</strong> {s.review_summary}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {draft.summaryMarkdown && (
                  <div className="mt-3 rounded-xl border border-border p-3">
                    <p className="mb-1 text-[10px] font-black uppercase text-muted-foreground">Özet</p>
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">{draft.summaryMarkdown}</p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    onClick={() => handleReject(draft)}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-40"
                  >
                    Reddet
                  </button>
                  <button
                    onClick={() => handleApprove(draft)}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40"
                  >
                    Onayla ve Yayınla
                  </button>
                </div>
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
