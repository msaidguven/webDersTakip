'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Clipboard, Plus, RefreshCw, Trash2, X } from 'lucide-react';

type Outcome = { id: number; description: string; order_index: number | null; code: string | null; previewCode: string };
type TopicContent = {
  id: number;
  title: string;
  body_markdown: string | null;
  is_published: boolean;
  hero_image_url: string | null;
  subtitle: string | null;
} | null;
type SectionOutcome = { id: number; code: string | null; description: string };
type Section = {
  id: number;
  topic_content_id: number;
  order_no: number;
  heading: string;
  body_markdown: string | null;
  image_url: string | null;
  image_prompt: string | null;
  status: 'planned' | 'content_ready' | 'image_ready' | 'published';
  outcomes: SectionOutcome[];
};
type Highlight = { id: number; position: string; icon: string | null; title: string; description: string; order_no: number };

type Bundle = {
  topic: { id: number; title: string };
  unit: { id: number; title: string } | null;
  lesson: { id: number; name: string } | null;
  grade: { id: number; name: string } | null;
  outcomes: Outcome[];
  missingCodeCount: number;
  topicContent: TopicContent;
  heroImagePrompt: string | null;
  highlights: Highlight[];
  sections: Section[];
};

const HIGHLIGHT_POSITIONS: { key: string; label: string }[] = [
  { key: 'top-left', label: 'Sol Üst' },
  { key: 'mid-left', label: 'Sol Orta' },
  { key: 'bottom-left', label: 'Sol Alt' },
  { key: 'top-right', label: 'Sağ Üst' },
  { key: 'mid-right', label: 'Sağ Orta' },
  { key: 'bottom-right', label: 'Sağ Alt' },
];

const STATUS_LABELS: Record<Section['status'], string> = {
  planned: 'Planlandı',
  content_ready: 'İçerik Hazır',
  image_ready: 'Görsel Hazır',
  published: 'Yayında',
};

const STATUS_COLORS: Record<Section['status'], string> = {
  planned: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  content_ready: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  image_ready: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  published: 'bg-[#6c63ff]/15 text-[#b5b0ff] border-[#6c63ff]/30',
};

export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // düşer: aşağıdaki execCommand fallback'i dener
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  const jsonSlice = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
  return JSON.parse(jsonSlice);
}

export default function AdminTopicSectionsPanel({ topicId }: { topicId: number }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/topic-sections?topicId=${topicId}`);
      if (res.ok) {
        setBundle(await res.json());
        setReloadCount((c) => c + 1);
      }
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAssignCodes() {
    setAssigning(true);
    setAssignError(null);
    try {
      const res = await fetch('/api/admin/topic-sections/assign-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId }),
      });
      if (res.ok) {
        await load();
      } else {
        const data = await res.json().catch(() => null);
        setAssignError(data?.error || 'Kod ataması başarısız oldu.');
      }
    } catch {
      setAssignError('Kod ataması sırasında bir ağ hatası oluştu.');
    } finally {
      setAssigning(false);
    }
  }

  async function handleDeleteSection(sectionId: number) {
    if (!confirm('Bu alt başlığı silmek istediğinize emin misiniz?')) return;
    const res = await fetch(`/api/admin/topic-sections/section/${sectionId}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-dashed border-[#2e3348] bg-[#1a1d27]/60 p-6 text-sm text-[#8b90a7]">
        Yönetim paneli yükleniyor...
      </div>
    );
  }

  if (!bundle) return null;

  const canCreatePlan = bundle.missingCodeCount === 0;

  return (
    <div className="rounded-2xl border border-dashed border-[#6c63ff]/40 bg-[#15121f] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-[#b5b0ff]">Admin</div>
          <h3 className="text-lg font-black text-[#e8eaf0]">Alt Başlık &amp; İçerik Yönetimi</h3>
        </div>
      </div>

      {/* Kazanımlar */}
      <div className="mb-5 rounded-xl border border-[#2e3348] bg-[#1a1d27] p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-extrabold tracking-[0.14em] uppercase text-[#8b90a7]">Kazanımlar</span>
          {bundle.missingCodeCount > 0 && (
            <button
              onClick={handleAssignCodes}
              disabled={assigning}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-400/20 disabled:opacity-50 transition-colors"
            >
              {assigning ? 'Atanıyor...' : `Eksik Kodları Ata (${bundle.missingCodeCount})`}
            </button>
          )}
        </div>
        {assignError && <p className="mb-2 text-xs font-bold text-[#ff6584]">{assignError}</p>}
        {bundle.outcomes.length === 0 ? (
          <p className="text-xs text-[#8b90a7]">Bu konu için tanımlı kazanım bulunamadı.</p>
        ) : (
          <ul className="space-y-1.5">
            {bundle.outcomes.map((o) => (
              <li key={o.id} className="flex items-start gap-2 text-xs text-[#c8cad8]">
                <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono font-bold ${o.code ? 'bg-[#222636] text-[#b5b0ff]' : 'bg-amber-400/10 text-amber-300'}`}>
                  {o.code || `${o.previewCode}?`}
                </span>
                <span>{o.description}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Plan oluştur */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] font-extrabold tracking-[0.14em] uppercase text-[#8b90a7]">Alt Başlıklar</span>
        <button
          onClick={() => setPlanModalOpen(true)}
          disabled={!canCreatePlan}
          title={!canCreatePlan ? 'Önce tüm kazanımlara kod atanmalı' : undefined}
          className="inline-flex items-center gap-2 rounded-xl border border-[#6c63ff] bg-[#6c63ff]/20 px-4 py-2 text-xs font-extrabold text-[#e8eaf0] hover:bg-[#6c63ff]/30 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          {bundle.sections.length ? <RefreshCw className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {bundle.sections.length ? 'Planı Yeniden Oluştur' : 'Alt Başlık Planı Oluştur'}
        </button>
      </div>

      {bundle.sections.length === 0 ? (
        <p className="text-sm text-[#8b90a7]">
          {canCreatePlan
            ? 'Bu konu için henüz alt başlık planı yok. Yukarıdaki butonla 1. prompt’u kopyalayıp AI’a verin, sonucu yapıştırıp kaydedin.'
            : 'Plan oluşturmadan önce yukarıdaki "Eksik Kodları Ata" butonuyla tüm kazanımlara kod atayın.'}
        </p>
      ) : (
        <div className="rounded-xl border border-[#2e3348] bg-[#1a1d27] p-4">
          {/* Ağacın kökü: ana konu */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base leading-none">📘</span>
            <span className="text-sm font-black text-[#e8eaf0]">{bundle.topic.title}</span>
          </div>

          {/* Alt başlıklar: ana konunun altında hiyerarşik dallar */}
          <div className="ml-3 border-l border-[#2e3348] pl-4 space-y-2.5">
            {bundle.sections.map((section, idx) => (
              <div key={section.id} className="relative">
                <span className="absolute -left-4 top-[18px] h-px w-4 bg-[#2e3348]" />
                <div className="flex items-start gap-3 rounded-xl border border-[#2e3348] bg-[#12151f] px-4 py-3">
                  <div className="h-7 w-7 shrink-0 rounded-lg bg-[#222636] border border-[#2e3348] flex items-center justify-center text-xs font-black text-[#8b90a7] mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#e8eaf0] truncate">{section.heading}</div>
                    {section.outcomes.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {section.outcomes.map((o) => (
                          <span key={o.id} className="rounded bg-[#222636] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#b5b0ff]" title={o.description}>
                            {o.code}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${STATUS_COLORS[section.status]}`}>
                    {STATUS_LABELS[section.status]}
                  </span>
                  <button
                    onClick={() => setActiveSection(section)}
                    className="shrink-0 rounded-lg border border-[#2e3348] bg-[#222636] px-3 py-1.5 text-xs font-bold text-[#e8eaf0] hover:bg-[#2a2f42] transition-colors"
                  >
                    {section.status === 'planned' ? 'İçerik Oluştur' : 'İçeriği Düzenle'}
                  </button>
                  <button
                    onClick={() => handleDeleteSection(section.id)}
                    className="shrink-0 rounded-lg border border-[#ff6584]/30 bg-[#ff6584]/10 p-1.5 text-[#ff6584] hover:bg-[#ff6584]/20 transition-colors"
                    title="Alt başlığı sil"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bundle.topicContent && (
        <HeroHighlightsPanel
          key={`${bundle.topicContent.id}-${reloadCount}`}
          topicContent={bundle.topicContent}
          highlights={bundle.highlights}
          heroImagePrompt={bundle.heroImagePrompt}
          onSaved={load}
        />
      )}

      {planModalOpen && (
        <PlanModal topicId={topicId} onClose={() => setPlanModalOpen(false)} onSaved={() => { setPlanModalOpen(false); load(); }} />
      )}

      {activeSection && (
        <SectionModal
          topicId={topicId}
          section={activeSection}
          onClose={() => setActiveSection(null)}
          onSaved={() => { setActiveSection(null); load(); }}
          onImageChanged={load}
        />
      )}
    </div>
  );
}

function buildSlotsFromHighlights(highlights: Highlight[]) {
  const map: Record<string, { icon: string; title: string; description: string }> = {};
  for (const p of HIGHLIGHT_POSITIONS) {
    const existing = highlights.find((h) => h.position === p.key);
    map[p.key] = { icon: existing?.icon || '', title: existing?.title || '', description: existing?.description || '' };
  }
  return map;
}

function HeroHighlightsPanel({
  topicContent,
  highlights,
  heroImagePrompt,
  onSaved,
}: {
  topicContent: NonNullable<TopicContent>;
  highlights: Highlight[];
  heroImagePrompt: string | null;
  onSaved: () => void;
}) {
  const [subtitle, setSubtitle] = useState(topicContent.subtitle || '');
  const [subtitleSaving, setSubtitleSaving] = useState(false);
  const [subtitleSaved, setSubtitleSaved] = useState(false);

  const [heroUrl, setHeroUrl] = useState(topicContent.hero_image_url);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroBusy, setHeroBusy] = useState(false);
  const [heroError, setHeroError] = useState<string | null>(null);

  const [slots, setSlots] = useState<Record<string, { icon: string; title: string; description: string }>>(() =>
    buildSlotsFromHighlights(highlights)
  );
  const [highlightsSaving, setHighlightsSaving] = useState(false);
  const [highlightsError, setHighlightsError] = useState<string | null>(null);
  const [highlightsSaved, setHighlightsSaved] = useState(false);

  async function handleSubtitleSave() {
    setSubtitleSaving(true);
    try {
      const res = await fetch('/api/admin/topic-sections/topic-content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicContentId: topicContent.id, subtitle }),
      });
      if (res.ok) {
        setSubtitleSaved(true);
        setTimeout(() => setSubtitleSaved(false), 1800);
        onSaved();
      }
    } finally {
      setSubtitleSaving(false);
    }
  }

  async function handleHeroUpload() {
    if (!heroFile) return;
    setHeroBusy(true);
    setHeroError(null);
    try {
      const formData = new FormData();
      formData.append('file', heroFile);
      formData.append('topicContentId', String(topicContent.id));
      const res = await fetch('/api/admin/topic-sections/hero-image', { method: 'POST', body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setHeroError(data?.error || 'Yükleme başarısız.');
        return;
      }
      setHeroUrl(data.imageUrl);
      setHeroFile(null);
      onSaved();
    } finally {
      setHeroBusy(false);
    }
  }

  async function handleHeroRemove() {
    if (!confirm('Kapak görselini kaldırmak istediğinize emin misiniz?')) return;
    setHeroBusy(true);
    setHeroError(null);
    try {
      const res = await fetch(`/api/admin/topic-sections/hero-image?topicContentId=${topicContent.id}`, { method: 'DELETE' });
      if (res.ok) {
        setHeroUrl(null);
        onSaved();
      }
    } finally {
      setHeroBusy(false);
    }
  }

  function updateSlot(position: string, field: 'icon' | 'title' | 'description', value: string) {
    setSlots((prev) => ({ ...prev, [position]: { ...prev[position], [field]: value } }));
  }

  async function handleHighlightsSave() {
    setHighlightsSaving(true);
    setHighlightsError(null);
    try {
      const payload = HIGHLIGHT_POSITIONS
        .map((p, idx) => ({ position: p.key, ...slots[p.key], order_no: idx }))
        .filter((h) => h.title.trim() && h.description.trim());

      const res = await fetch('/api/admin/topic-sections/highlights', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicContentId: topicContent.id, highlights: payload }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setHighlightsError(data?.error || 'Kaydedilemedi.');
        return;
      }
      setHighlightsSaved(true);
      setTimeout(() => setHighlightsSaved(false), 1800);
      onSaved();
    } finally {
      setHighlightsSaving(false);
    }
  }

  return (
    <div className="mb-5 rounded-xl border border-[#2e3348] bg-[#1a1d27] p-4">
      <span className="text-[11px] font-extrabold tracking-[0.14em] uppercase text-[#8b90a7] block mb-3">Kapak Görseli &amp; Vurgular</span>

      <div className="mb-4">
        <span className="text-xs font-bold text-[#8b90a7] block mb-1.5">Alt Başlık (konu başlığının hemen altında görünür)</span>
        <div className="flex gap-2">
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Örn. Bilgisayarın beyni"
            className="flex-1 rounded-lg border border-[#2e3348] bg-black/40 px-3 py-2 text-xs text-[#e8eaf0] focus:border-[#6c63ff] outline-none"
          />
          <button
            onClick={handleSubtitleSave}
            disabled={subtitleSaving}
            className="shrink-0 rounded-lg bg-[#6c63ff] px-3 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
          >
            {subtitleSaving ? '...' : subtitleSaved ? 'Kaydedildi' : 'Kaydet'}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <span className="text-xs font-bold text-[#8b90a7] block mb-1.5">Kapak Görseli</span>
        {heroImagePrompt && (
          <div className="mb-3">
            <span className="text-[10px] font-bold text-[#6c63ff] block mb-1.5">AI görsel üretim promptu (kopyalayıp bir görsel aracına verin)</span>
            <PromptCopyBox prompt={heroImagePrompt} loading={false} />
          </div>
        )}
        {heroUrl ? (
          <div className="flex items-center gap-3">
            <img src={heroUrl} alt="" className="h-20 w-32 rounded-lg object-cover border border-[#2e3348]" />
            <button
              onClick={handleHeroRemove}
              disabled={heroBusy}
              className="rounded-lg border border-[#ff6584]/30 bg-[#ff6584]/10 px-3 py-1.5 text-xs font-bold text-[#ff6584] hover:bg-[#ff6584]/20 disabled:opacity-50 transition-colors"
            >
              {heroBusy ? 'İşleniyor...' : 'Kaldır'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => setHeroFile(e.target.files?.[0] || null)}
              className="flex-1 text-xs text-[#c8cad8] file:mr-3 file:rounded-lg file:border-0 file:bg-[#222636] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#e8eaf0]"
            />
            <button
              onClick={handleHeroUpload}
              disabled={!heroFile || heroBusy}
              className="shrink-0 rounded-lg bg-[#6c63ff] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
            >
              {heroBusy ? 'Yükleniyor...' : 'Yükle'}
            </button>
          </div>
        )}
        {heroError && <p className="mt-2 text-xs font-bold text-[#ff6584]">{heroError}</p>}
      </div>

      <div>
        <span className="text-xs font-bold text-[#8b90a7] block mb-2">
          Vurgu Kartları (görselin etrafında, opsiyonel — boş bırakılan pozisyon gösterilmez)
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {HIGHLIGHT_POSITIONS.map((p) => (
            <div key={p.key} className="rounded-lg border border-[#2e3348] bg-[#12151f] p-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-[#6c63ff] block mb-2">{p.label}</span>
              <div className="flex gap-2 mb-2">
                <input
                  value={slots[p.key].icon}
                  onChange={(e) => updateSlot(p.key, 'icon', e.target.value)}
                  placeholder="🧠"
                  maxLength={4}
                  className="w-14 shrink-0 rounded-lg border border-[#2e3348] bg-black/40 px-2 py-1.5 text-center text-sm text-[#e8eaf0] focus:border-[#6c63ff] outline-none"
                />
                <input
                  value={slots[p.key].title}
                  onChange={(e) => updateSlot(p.key, 'title', e.target.value)}
                  placeholder="Başlık"
                  className="flex-1 rounded-lg border border-[#2e3348] bg-black/40 px-3 py-1.5 text-xs text-[#e8eaf0] focus:border-[#6c63ff] outline-none"
                />
              </div>
              <textarea
                value={slots[p.key].description}
                onChange={(e) => updateSlot(p.key, 'description', e.target.value)}
                placeholder="Kısa açıklama"
                rows={2}
                className="w-full rounded-lg border border-[#2e3348] bg-black/40 px-3 py-1.5 text-xs text-[#e8eaf0] resize-none focus:border-[#6c63ff] outline-none"
              />
            </div>
          ))}
        </div>
        {highlightsError && <p className="mt-2 text-xs font-bold text-[#ff6584]">{highlightsError}</p>}
        <button
          onClick={handleHighlightsSave}
          disabled={highlightsSaving}
          className="mt-3 rounded-xl bg-[#6c63ff] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
        >
          {highlightsSaving ? 'Kaydediliyor...' : highlightsSaved ? 'Kaydedildi' : 'Vurgu Kartlarını Kaydet'}
        </button>
      </div>
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl border border-[#2e3348] bg-[#12151f] p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-black text-[#e8eaf0]">{title}</h4>
          <button onClick={onClose} className="text-[#8b90a7] hover:text-[#e8eaf0] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PromptCopyBox({ prompt, loading }: { prompt: string; loading: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await copyText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.alert('Kopyalama başarısız oldu. Metni elle seçip kopyalayın.');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-[#8b90a7]">Prompt</span>
        <button
          onClick={handleCopy}
          disabled={loading || !prompt}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#6c63ff]/40 bg-[#6c63ff]/10 px-3 py-1.5 text-xs font-bold text-[#b5b0ff] hover:bg-[#6c63ff]/20 disabled:opacity-50 transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </button>
      </div>
      <textarea
        readOnly
        value={loading ? 'Yükleniyor...' : prompt}
        rows={6}
        className="w-full rounded-xl border border-[#2e3348] bg-black/40 p-3 text-xs text-[#c8cad8] font-mono resize-none"
      />
    </div>
  );
}

export function PlanModal({
  topicId,
  onClose,
  onSaved,
  onManageMore,
}: {
  topicId: number;
  onClose: () => void;
  onSaved: () => void;
  onManageMore?: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assigningCodes, setAssigningCodes] = useState(false);

  const loadPrompt = useCallback(async () => {
    setLoadingPrompt(true);
    setError(null);
    const res = await fetch(`/api/admin/topic-sections/prompt?topicId=${topicId}&type=plan`);
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setPrompt(data?.prompt || '');
    } else {
      setError(data?.error || 'Prompt oluşturulamadı.');
    }
    setLoadingPrompt(false);
  }, [topicId]);

  useEffect(() => {
    loadPrompt();
  }, [loadPrompt]);

  async function handleAssignCodes() {
    setAssigningCodes(true);
    try {
      const res = await fetch('/api/admin/topic-sections/assign-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId }),
      });
      if (res.ok) {
        await loadPrompt();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Kod ataması başarısız oldu.');
      }
    } finally {
      setAssigningCodes(false);
    }
  }

  async function handleSave() {
    setError(null);
    setWarning(null);
    let parsed: unknown;
    try {
      parsed = extractJson(pasted);
    } catch {
      setError('Yapıştırılan metin geçerli bir JSON değil.');
      return;
    }

    const parsedObj = parsed as { sections?: unknown; cover?: unknown };
    const parsedSections = parsedObj?.sections;
    if (!Array.isArray(parsedSections) || !parsedSections.length) {
      setError('JSON içinde "sections" listesi bulunamadı.');
      return;
    }
    const parsedCover = parsedObj?.cover && typeof parsedObj.cover === 'object' ? parsedObj.cover : undefined;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/topic-sections/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, sections: parsedSections, cover: parsedCover }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Kaydedilemedi.');
        return;
      }
      if (data?.unresolvedCodes?.length) {
        setWarning(`Şu kazanım kodları eşleşmedi: ${data.unresolvedCodes.join(', ')}`);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const missingCodes = !loadingPrompt && !!error && error.includes('kodu eksik');

  return (
    <ModalShell title="1. Adım: Alt Başlık Planı" onClose={onClose}>
      <div className="space-y-4">
        {missingCodes ? (
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4">
            <p className="mb-3 text-xs font-bold text-amber-300">{error}</p>
            <button
              onClick={handleAssignCodes}
              disabled={assigningCodes}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-400/20 disabled:opacity-50 transition-colors"
            >
              {assigningCodes ? 'Atanıyor...' : 'Eksik Kodları Ata'}
            </button>
          </div>
        ) : (
          <>
            <PromptCopyBox prompt={prompt} loading={loadingPrompt} />

            <div>
              <span className="text-xs font-bold text-[#8b90a7] block mb-2">
                AI&apos;dan gelen JSON sonucu buraya yapıştırın (alt başlıklar + kapak görseli + vurgu kartları tek seferde kaydedilir)
              </span>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={8}
                placeholder='{"sections": [...], "cover": {"subtitle": "...", "image_prompt": "...", "highlights": [...]}}'
                className="w-full rounded-xl border border-[#2e3348] bg-black/40 p-3 text-xs text-[#e8eaf0] font-mono resize-none focus:border-[#6c63ff] outline-none"
              />
            </div>

            {error && <p className="text-xs font-bold text-[#ff6584]">{error}</p>}
            {warning && <p className="text-xs font-bold text-amber-300">{warning}</p>}
          </>
        )}

        <div className="flex items-center justify-between gap-2">
          {onManageMore ? (
            <button
              onClick={onManageMore}
              className="text-xs font-bold text-[#8b90a7] hover:text-[#b5b0ff] transition-colors underline underline-offset-2"
            >
              Kazanım / kapak görseli / vurgu kartları yönetimi
            </button>
          ) : <span />}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl border border-[#2e3348] px-4 py-2 text-xs font-bold text-[#8b90a7] hover:text-[#e8eaf0] transition-colors">
              İptal
            </button>
            {!missingCodes && (
              <button
                onClick={handleSave}
                disabled={saving || !pasted.trim()}
                className="rounded-xl bg-[#6c63ff] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

export type SectionModalSection = {
  id: number;
  heading: string;
  image_url: string | null;
  image_prompt: string | null;
};

export function SectionModal({
  topicId,
  section,
  onClose,
  onSaved,
  onImageChanged,
}: {
  topicId: number;
  section: SectionModalSection;
  onClose: () => void;
  onSaved: () => void;
  onImageChanged: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [imageUrl, setImageUrl] = useState<string | null>(section.image_url);
  const [imagePrompt, setImagePrompt] = useState<string | null>(section.image_prompt);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/topic-sections/prompt?topicId=${topicId}&sectionId=${section.id}&type=section`);
      const data = await res.json().catch(() => null);
      if (!cancelled) {
        if (res.ok) {
          setPrompt(data?.prompt || '');
        } else {
          setError(data?.error || 'Prompt oluşturulamadı.');
        }
        setLoadingPrompt(false);
      }
    })();
    return () => { cancelled = true; };
  }, [topicId, section.id]);

  async function handleSave() {
    setError(null);
    let parsed: unknown;
    try {
      parsed = extractJson(pasted);
    } catch {
      setError('Yapıştırılan metin geçerli bir JSON değil.');
      return;
    }

    const obj = parsed as { body_markdown?: unknown; needs_image?: unknown; image_prompt?: unknown };
    if (typeof obj.body_markdown !== 'string' || !obj.body_markdown.trim()) {
      setError('JSON içinde "body_markdown" alanı bulunamadı.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/topic-sections/section/${section.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body_markdown: obj.body_markdown,
          needs_image: Boolean(obj.needs_image),
          image_prompt: typeof obj.image_prompt === 'string' ? obj.image_prompt : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Kaydedilemedi.');
        return;
      }
      setImagePrompt(typeof obj.image_prompt === 'string' ? obj.image_prompt : null);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload() {
    if (!imageFile) return;
    setImageBusy(true);
    setImageError(null);
    try {
      const formData = new FormData();
      formData.append('file', imageFile);
      const res = await fetch(`/api/admin/topic-sections/section/${section.id}/image`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setImageError(data?.error || 'Yükleme başarısız.');
        return;
      }
      setImageUrl(data.imageUrl);
      setImageFile(null);
      onImageChanged();
    } finally {
      setImageBusy(false);
    }
  }

  async function handleImageRemove() {
    if (!confirm('Görseli kaldırmak istediğinize emin misiniz?')) return;
    setImageBusy(true);
    setImageError(null);
    try {
      const res = await fetch(`/api/admin/topic-sections/section/${section.id}/image`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setImageError(data?.error || 'Silinemedi.');
        return;
      }
      setImageUrl(null);
      onImageChanged();
    } finally {
      setImageBusy(false);
    }
  }

  return (
    <ModalShell title={`2. Adım: İçerik — ${section.heading}`} onClose={onClose}>
      <div className="space-y-4">
        <PromptCopyBox prompt={prompt} loading={loadingPrompt} />

        <div>
          <span className="text-xs font-bold text-[#8b90a7] block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={8}
            placeholder='{"body_markdown": "...", "needs_image": false, "image_prompt": null}'
            className="w-full rounded-xl border border-[#2e3348] bg-black/40 p-3 text-xs text-[#e8eaf0] font-mono resize-none focus:border-[#6c63ff] outline-none"
          />
        </div>

        {error && <p className="text-xs font-bold text-[#ff6584]">{error}</p>}

        <div className="border-t border-[#2e3348] pt-4">
          <span className="text-xs font-bold text-[#8b90a7] block mb-2">3. Adım: Görsel (opsiyonel)</span>

          {imagePrompt && (
            <div className="mb-3">
              <PromptCopyBox prompt={imagePrompt} loading={false} />
            </div>
          )}

          {imageUrl ? (
            <div className="flex items-center gap-3">
              <img src={imageUrl} alt="" className="h-20 w-20 rounded-lg object-cover border border-[#2e3348]" />
              <button
                type="button"
                onClick={handleImageRemove}
                disabled={imageBusy}
                className="rounded-lg border border-[#ff6584]/30 bg-[#ff6584]/10 px-3 py-1.5 text-xs font-bold text-[#ff6584] hover:bg-[#ff6584]/20 disabled:opacity-50 transition-colors"
              >
                {imageBusy ? 'İşleniyor...' : 'Görseli Kaldır'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="flex-1 text-xs text-[#c8cad8] file:mr-3 file:rounded-lg file:border-0 file:bg-[#222636] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#e8eaf0]"
              />
              <button
                type="button"
                onClick={handleImageUpload}
                disabled={!imageFile || imageBusy}
                className="shrink-0 rounded-lg bg-[#6c63ff] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
              >
                {imageBusy ? 'Yükleniyor...' : 'Yükle'}
              </button>
            </div>
          )}

          {imageError && <p className="mt-2 text-xs font-bold text-[#ff6584]">{imageError}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-[#2e3348] px-4 py-2 text-xs font-bold text-[#8b90a7] hover:text-[#e8eaf0] transition-colors">
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !pasted.trim()}
            className="rounded-xl bg-[#6c63ff] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
