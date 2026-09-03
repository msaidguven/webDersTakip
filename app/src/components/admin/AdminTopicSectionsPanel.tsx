'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { markdownToHtml } from '@/app/src/lib/topicContentV11';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';
import { copyText } from '@/app/src/lib/clipboard';
import SectionContent from '@/app/ders/SectionContent';

type Outcome = {
  id: number;
  description: string;
  order_index: number | null;
  code: string | null;
  previewCode: string;
  startWeek: number | null;
  endWeek: number | null;
};

function outcomeWeekLabel(o: Outcome): string {
  if (o.startWeek == null || o.endWeek == null) return 'Hafta atanmamış';
  return o.startWeek === o.endWeek ? `${o.startWeek}. Hafta` : `${o.startWeek}–${o.endWeek}. Hafta`;
}
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
type Highlight = { id: number; icon: string | null; title: string; description: string; order_no: number };

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
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [deletingSectionId, setDeletingSectionId] = useState<number | null>(null);
  const [publishSaving, setPublishSaving] = useState(false);

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

  async function handleTogglePublish() {
    if (!bundle?.topicContent) return;
    setPublishSaving(true);
    try {
      const res = await fetch('/api/admin/topic-sections/topic-content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicContentId: bundle.topicContent.id, isPublished: !bundle.topicContent.is_published }),
      });
      if (res.ok) await load();
    } finally {
      setPublishSaving(false);
    }
  }

  async function handleDeleteSection(sectionId: number) {
    if (!confirm('Bu alt başlığı silmek istediğinize emin misiniz?')) return;
    setDeletingSectionId(sectionId);
    try {
      const res = await fetch(`/api/admin/topic-sections/section/${sectionId}`, { method: 'DELETE' });
      if (res.ok) await load();
    } finally {
      setDeletingSectionId(null);
    }
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
  const distinctWeekRanges = new Set(
    bundle.outcomes.map((o) => (o.startWeek == null ? 'none' : `${o.startWeek}-${o.endWeek}`))
  );
  const outcomesSpanMultipleWeeks = distinctWeekRanges.size > 1;

  return (
    <div className="rounded-2xl border border-dashed border-[#6c63ff]/40 bg-[#15121f] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-[#b5b0ff]">Admin</div>
          <h3 className="text-lg font-black text-[#e8eaf0]">Alt Başlık &amp; İçerik Yönetimi</h3>
        </div>
        {bundle.topicContent && (
          <button
            onClick={handleTogglePublish}
            disabled={publishSaving}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-xs font-extrabold transition-colors disabled:opacity-50 ${
              bundle.topicContent.is_published
                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                : 'border-slate-500/30 bg-slate-500/15 text-slate-300 hover:bg-slate-500/25'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${bundle.topicContent.is_published ? 'bg-emerald-400' : 'bg-slate-400'}`} />
            {publishSaving ? '...' : bundle.topicContent.is_published ? 'Yayında — Taslağa Al' : 'Taslak — Yayınla'}
          </button>
        )}
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
        {outcomesSpanMultipleWeeks && (
          <p className="mb-2 text-xs font-bold text-amber-300">
            Bu konunun kazanımları birden fazla haftaya yayılmış — aşağıdaki hafta etiketlerine bak.
          </p>
        )}
        {bundle.outcomes.length === 0 ? (
          <p className="text-xs text-[#8b90a7]">Bu konu için tanımlı kazanım bulunamadı.</p>
        ) : (
          <ul className="space-y-1.5">
            {bundle.outcomes.map((o) => (
              <li key={o.id} className="flex items-start gap-2 text-xs text-[#c8cad8]">
                <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono font-bold ${o.code ? 'bg-[#222636] text-[#b5b0ff]' : 'bg-amber-400/10 text-amber-300'}`}>
                  {o.code || `${o.previewCode}?`}
                </span>
                <span className="flex-1">{o.description}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${o.startWeek == null ? 'bg-amber-400/10 text-amber-300' : 'bg-[#222636] text-[#8b90a7]'}`}>
                  {outcomeWeekLabel(o)}
                </span>
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
          <p className="mb-3 text-xs text-[#8b90a7]">
            AI ile içerik/görsel oluşturma soldaki içindekiler menüsünde ilgili alt başlığın yanındaki ⋮ simgesinden yapılıyor.
            Küçük düzeltme veya eklemeler için aşağıda her alt başlığın yanındaki <Pencil className="inline h-3 w-3 align-[-1px]" /> simgesiyle içeriği doğrudan (AI&apos;a gitmeden) düzenleyebilirsiniz.
          </p>
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
                    onClick={() => setEditingSection(section)}
                    className="shrink-0 rounded-lg border border-[#6c63ff]/30 bg-[#6c63ff]/10 p-1.5 text-[#b5b0ff] hover:bg-[#6c63ff]/20 transition-colors"
                    title="İçeriği düzenle"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSection(section.id)}
                    disabled={deletingSectionId === section.id}
                    className="shrink-0 rounded-lg border border-[#ff6584]/30 bg-[#ff6584]/10 p-1.5 text-[#ff6584] hover:bg-[#ff6584]/20 disabled:opacity-50 transition-colors"
                    title="Alt başlığı sil"
                  >
                    {deletingSectionId === section.id ? (
                      <span className="block h-3.5 w-3.5 rounded-full border-2 border-[#ff6584] border-t-transparent animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
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
          topicId={topicId}
          topicContent={bundle.topicContent}
          highlights={bundle.highlights}
          heroImagePrompt={bundle.heroImagePrompt}
          onSaved={load}
        />
      )}

      {planModalOpen && (
        <PlanModal topicId={topicId} onClose={() => setPlanModalOpen(false)} onSaved={() => { setPlanModalOpen(false); load(); }} />
      )}

      {editingSection && (
        <SectionContentEditModal
          section={editingSection}
          onClose={() => setEditingSection(null)}
          onSaved={() => { setEditingSection(null); load(); }}
        />
      )}
    </div>
  );
}

export type EditableSection = {
  id: number;
  heading: string;
  body_markdown: string | null;
  image_url: string | null;
  image_prompt: string | null;
  diagram_svg?: string | null;
};

// Küçük düzeltme/ekleme için alt başlık metnini doğrudan (AI prompt turu olmadan)
// düzenlemeyi sağlar. Tasarım tamamen markdown'dan (kalın terim, madde/alt madde)
// üretildiği için sağdaki önizleme, gerçek sayfadaki render'ın birebir aynısını kullanır —
// admin kaydetmeden önce tasarımı bozup bozmadığını görebilir. Hem bu panelden hem de
// ders sayfasındaki "İçeriği Düzenle" butonundan (DersClient) ortak kullanılır.
export function SectionContentEditModal({
  section,
  onClose,
  onSaved,
}: {
  section: EditableSection;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState(section.body_markdown || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewHtml = useMemo(() => (text.trim() ? markdownToHtml(text) : ''), [text]);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/topic-sections/section/${section.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body_markdown: text,
          needs_image: Boolean(section.image_prompt),
          image_prompt: section.image_prompt,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Kaydedilemedi.');
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl rounded-2xl border border-[#2e3348] bg-[#12151f] p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-black text-[#e8eaf0]">İçeriği Düzenle — {section.heading}</h4>
          <button onClick={onClose} className="text-[#8b90a7] hover:text-[#e8eaf0] transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-xs text-[#8b90a7] leading-relaxed">
          Küçük düzeltme/eklemeler için metni doğrudan değiştirebilirsiniz. Tasarımın bozulmaması için mevcut biçimi koruyun:
          kalın terim için <code className="text-[#b5b0ff]">**terim**: açıklama</code>, madde için satır başında{' '}
          <code className="text-[#b5b0ff]">- </code>, alt madde için bir kademe içeri{' '}
          <code className="text-[#b5b0ff]">&nbsp;&nbsp;- </code>. Sağdaki önizleme gerçek sayfadaki görünümün birebir aynısıdır.
        </p>

        {error && <p className="mb-3 text-xs font-bold text-[#ff6584]">{error}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-[#8b90a7] block mb-1.5">Markdown</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={18}
              className="w-full rounded-xl border border-[#2e3348] bg-black/40 p-3 text-xs text-[#e8eaf0] font-mono resize-none focus:border-[#6c63ff] outline-none"
            />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-[#8b90a7] block mb-1.5">Önizleme</span>
            <div className="rounded-xl border border-[#2e3348] bg-[#f9fafb] p-4 max-h-[420px] overflow-y-auto">
              {previewHtml ? (
                <SectionContent html={previewHtml} imageUrl={section.image_url} caption={section.heading} diagramSvg={section.diagram_svg} />
              ) : (
                <p className="text-sm text-slate-400 italic">İçerik boş.</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-[#2e3348] px-4 py-2 text-xs font-bold text-[#c8cad8] hover:bg-[#1a1d27] transition-colors"
          >
            Vazgeç
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="rounded-xl bg-[#6c63ff] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroHighlightsPanel({
  topicId,
  topicContent,
  highlights,
  heroImagePrompt,
  onSaved,
}: {
  topicId: number;
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
  const [showGallery, setShowGallery] = useState(false);

  const [concepts, setConcepts] = useState<{ icon: string; title: string; description: string }[]>(() =>
    highlights.length
      ? highlights.map((h) => ({ icon: h.icon || '', title: h.title, description: h.description }))
      : [{ icon: '', title: '', description: '' }]
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

  async function handleHeroGallerySelect(path: string) {
    setHeroBusy(true);
    setHeroError(null);
    try {
      const formData = new FormData();
      formData.append('existingPath', path);
      formData.append('topicContentId', String(topicContent.id));
      const res = await fetch('/api/admin/topic-sections/hero-image', { method: 'POST', body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setHeroError(data?.error || 'Seçilemedi.');
        return;
      }
      setHeroUrl(data.imageUrl);
      setShowGallery(false);
      onSaved();
    } finally {
      setHeroBusy(false);
    }
  }

  async function handleHeroRemove() {
    if (!confirm('Kapak görselini bu konudan kaldırmak istediğinize emin misiniz? (Dosya galeride kalır, silinmez.)')) return;
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

  function updateConcept(idx: number, field: 'icon' | 'title' | 'description', value: string) {
    setConcepts((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  }

  function addConcept() {
    setConcepts((prev) => [...prev, { icon: '', title: '', description: '' }]);
  }

  function removeConcept(idx: number) {
    setConcepts((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleHighlightsSave() {
    setHighlightsSaving(true);
    setHighlightsError(null);
    try {
      const payload = concepts
        .map((c, idx) => ({ ...c, order_no: idx }))
        .filter((c) => c.title.trim() && c.description.trim());

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
      <span className="text-[11px] font-extrabold tracking-[0.14em] uppercase text-[#8b90a7] block mb-3">Kapak Görseli &amp; Anahtar Kavramlar</span>

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
        <div className="space-y-3">
          {heroUrl && (
            <div className="flex items-center gap-3">
              <img src={heroUrl} alt="" className="h-20 w-32 rounded-lg object-cover border border-[#2e3348]" />
              <button
                onClick={handleHeroRemove}
                disabled={heroBusy}
                className="rounded-lg border border-[#ff6584]/30 bg-[#ff6584]/10 px-3 py-1.5 text-xs font-bold text-[#ff6584] hover:bg-[#ff6584]/20 disabled:opacity-50 transition-colors"
              >
                {heroBusy ? 'İşleniyor...' : 'Bu Konudan Kaldır'}
              </button>
            </div>
          )}
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
              {heroBusy ? 'Yükleniyor...' : 'Yeni Dosya Yükle'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowGallery((v) => !v)}
            className="text-xs font-bold text-[#6c63ff] hover:underline"
          >
            {showGallery ? 'Galeriyi gizle' : 'Galeriden Seç'}
          </button>
          {showGallery && (
            <ImageGalleryGrid topicId={topicId} kind="hero" onSelect={handleHeroGallerySelect} />
          )}
        </div>
        {heroError && <p className="mt-2 text-xs font-bold text-[#ff6584]">{heroError}</p>}
      </div>

      <div>
        <span className="text-xs font-bold text-[#8b90a7] block mb-2">
          Anahtar Kavramlar (opsiyonel — konunun en önemli terimleri ve tanımları)
        </span>
        <div className="space-y-3">
          {concepts.map((c, idx) => (
            <div key={idx} className="rounded-lg border border-[#2e3348] bg-[#12151f] p-3">
              <div className="flex gap-2 mb-2">
                <input
                  value={c.icon}
                  onChange={(e) => updateConcept(idx, 'icon', e.target.value)}
                  placeholder="🧠"
                  maxLength={4}
                  className="w-14 shrink-0 rounded-lg border border-[#2e3348] bg-black/40 px-2 py-1.5 text-center text-sm text-[#e8eaf0] focus:border-[#6c63ff] outline-none"
                />
                <input
                  value={c.title}
                  onChange={(e) => updateConcept(idx, 'title', e.target.value)}
                  placeholder="Kavram / terim"
                  className="flex-1 rounded-lg border border-[#2e3348] bg-black/40 px-3 py-1.5 text-xs text-[#e8eaf0] focus:border-[#6c63ff] outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeConcept(idx)}
                  className="shrink-0 rounded-lg border border-[#ff6584]/30 bg-[#ff6584]/10 px-2 text-[#ff6584] hover:bg-[#ff6584]/20 transition-colors"
                  aria-label="Kavramı sil"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <textarea
                value={c.description}
                onChange={(e) => updateConcept(idx, 'description', e.target.value)}
                placeholder="Açıklama / tanım"
                rows={2}
                className="w-full rounded-lg border border-[#2e3348] bg-black/40 px-3 py-1.5 text-xs text-[#e8eaf0] resize-none focus:border-[#6c63ff] outline-none"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addConcept}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#2e3348] px-3 py-1.5 text-xs font-bold text-[#8b90a7] hover:text-[#e8eaf0] hover:border-[#6c63ff]/40 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Kavram Ekle
        </button>
        {highlightsError && <p className="mt-2 text-xs font-bold text-[#ff6584]">{highlightsError}</p>}
        <button
          onClick={handleHighlightsSave}
          disabled={highlightsSaving}
          className="mt-3 block rounded-xl bg-[#6c63ff] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
        >
          {highlightsSaving ? 'Kaydediliyor...' : highlightsSaved ? 'Kaydedildi' : 'Anahtar Kavramları Kaydet'}
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
                AI&apos;dan gelen JSON sonucu buraya yapıştırın (alt başlıklar + kapak görseli + anahtar kavramlar tek seferde kaydedilir)
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
              Kazanım / kapak görseli / anahtar kavramlar yönetimi
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

export function NotebookPlanModal({
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
  const [aiModel, setAiModel] = useState('NotebookLM');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assigningCodes, setAssigningCodes] = useState(false);

  const loadPrompt = useCallback(async () => {
    setLoadingPrompt(true);
    setError(null);
    const res = await fetch(`/api/admin/topic-sections/prompt?topicId=${topicId}&type=full`);
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

  // Yapıştırılan JSON'da AI kendi model adını "ai_model" alanında bildiriyor;
  // geçerli bir JSON olur olmaz bunu otomatik alıp alandaki değeri güncelliyoruz
  // (admin yine de elle düzeltebilir, o yüzden state olarak tutmaya devam ediyoruz).
  useEffect(() => {
    if (!pasted.trim()) return;
    try {
      const obj = extractJson(pasted) as { ai_model?: unknown };
      if (typeof obj.ai_model === 'string' && obj.ai_model.trim()) {
        setAiModel(obj.ai_model.trim());
      }
    } catch {
      // henüz geçerli JSON değil, sessizce yoksay
    }
  }, [pasted]);

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
        body: JSON.stringify({ topicId, sections: parsedSections, cover: parsedCover, ai_model: aiModel.trim() || null }),
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
    <ModalShell title="Google NotebookLM — Tek Prompt (Alt Başlık + İçerik)" onClose={onClose}>
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
            <p className="text-xs text-[#8b90a7]">
              Bu promptu NotebookLM&apos;e, kaynak olarak ders kitabının PDF&apos;ini yüklediğiniz notebook&apos;ta sorun. Alt başlıklar, her başlığın içeriği ve görsel promptları TEK seferde JSON olarak gelir; aşağıya yapıştırıp tek seferde kaydedin.
            </p>
            <PromptCopyBox prompt={prompt} loading={loadingPrompt} />

            <div>
              <span className="text-xs font-bold text-[#8b90a7] block mb-2">
                NotebookLM&apos;den gelen JSON sonucu buraya yapıştırın (alt başlıklar + içerik + kapak görseli + anahtar kavramlar tek seferde kaydedilir)
              </span>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={10}
                placeholder='{"ai_model": "...", "sections": [{"heading": "...", "body_markdown": "...", ...}], "cover": {"subtitle": "...", "image_prompt": "...", "highlights": [...]}}'
                className="w-full rounded-xl border border-[#2e3348] bg-black/40 p-3 text-xs text-[#e8eaf0] font-mono resize-none focus:border-[#6c63ff] outline-none"
              />
            </div>

            <div>
              <span className="text-xs font-bold text-[#8b90a7] block mb-2">AI modeli (JSON&apos;daki &quot;ai_model&quot;den otomatik alınır, gerekirse düzeltin — boş bırakılırsa Manuel sayılır)</span>
              <input
                list="ai-model-options-notebook"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="ör. NotebookLM"
                className="w-full rounded-xl border border-[#2e3348] bg-black/40 p-2.5 text-xs text-[#e8eaf0] focus:border-[#6c63ff] outline-none"
              />
              <datalist id="ai-model-options-notebook">
                <option value="NotebookLM" />
                <option value="Claude Sonnet 5" />
                <option value="Claude Opus 5" />
                <option value="GPT-5.1" />
                <option value="Gemini 3 Pro" />
              </datalist>
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
              Kazanım / kapak görseli / anahtar kavramlar yönetimi
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
  image_alt?: string | null;
  diagram_svg?: string | null;
};

const MIXED_QUESTIONS_PLACEHOLDER =
  '{"ai_model": "...", "questions": [' +
  '{"type": "multiple_choice", "question_text": "...", "solution_text": "...", "svg_prompt": null, "svg_position": "above", "choices": [{"text": "...", "is_correct": true}, ...]}, ' +
  '{"type": "blank", "question_text": "... _____ ...", "solution_text": "...", "svg_prompt": null, "svg_position": "above", "options": [{"text": "...", "is_correct": true}, ...]}, ' +
  '{"type": "matching", "pairs": [{"left_text": "...", "right_text": "..."}, ...]}' +
  ']}';

export function QuestionsModal({
  topicId,
  section,
  variant = 'general',
  onClose,
}: {
  topicId: number;
  section: { id: number; heading: string };
  variant?: 'general' | 'notebooklm';
  onClose: () => void;
}) {
  const isNotebook = variant === 'notebooklm';
  const [prompt, setPrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [aiModel, setAiModel] = useState(isNotebook ? 'NotebookLM' : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingPrompt(true);
    setPromptError(null);
    const promptType = isNotebook ? 'questions_notebooklm' : 'mixed_questions';
    (async () => {
      const res = await fetch(`/api/admin/topic-sections/prompt?topicId=${topicId}&sectionId=${section.id}&type=${promptType}`);
      const data = await res.json().catch(() => null);
      if (!cancelled) {
        if (res.ok) {
          setPrompt(data?.prompt || '');
        } else {
          setPromptError(data?.error || 'Prompt oluşturulamadı.');
        }
        setLoadingPrompt(false);
      }
    })();
    return () => { cancelled = true; };
  }, [topicId, section.id, isNotebook]);

  // Yapıştırılan JSON'da AI kendi model adını "ai_model" alanında bildiriyor;
  // geçerli bir JSON olur olmaz bunu otomatik alıp alandaki değeri güncelliyoruz
  // (admin yine de elle düzeltebilir, o yüzden state olarak tutmaya devam ediyoruz).
  useEffect(() => {
    if (!pasted.trim()) return;
    try {
      const obj = extractJson(pasted) as { ai_model?: unknown };
      if (typeof obj.ai_model === 'string' && obj.ai_model.trim()) {
        setAiModel(obj.ai_model.trim());
      }
    } catch {
      // henüz geçerli JSON değil, sessizce yoksay
    }
  }, [pasted]);

  async function handleSave() {
    setError(null);
    setSavedCount(null);
    let parsed: unknown;
    try {
      parsed = extractJson(pasted);
    } catch {
      setError('Yapıştırılan metin geçerli bir JSON değil.');
      return;
    }

    const obj = parsed as { questions?: unknown };
    if (!Array.isArray(obj.questions) || !obj.questions.length) {
      setError('JSON içinde "questions" listesi bulunamadı.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/topic-sections/section/${section.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: obj.questions, ai_model: aiModel.trim() || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Kaydedilemedi.');
        return;
      }
      setSavedCount(data?.savedCount ?? obj.questions.length);
      setPasted('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Soru Ekle${isNotebook ? ' (NotebookLM)' : ''} — ${section.heading}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-[#8b90a7]">
          {isNotebook
            ? 'Bu promptu NotebookLM\'e, kaynak olarak ders kitabının PDF\'ini yüklediğiniz notebook\'ta sorun. Çoktan seçmeli, boşluk doldurma ve eşleştirme karışık 3-7 soru kitaba dayanarak üretilir; AI çıktısını aşağıya yapıştırıp tek seferde kaydedin.'
            : 'Tek promptla çoktan seçmeli, boşluk doldurma ve eşleştirme karışık 3-7 soru üretilir; AI çıktısını aşağıya yapıştırıp tek seferde kaydedin.'}
        </p>

        {promptError ? (
          <p className="text-xs font-bold text-[#ff6584]">{promptError}</p>
        ) : (
          <PromptCopyBox prompt={prompt} loading={loadingPrompt} />
        )}

        <div>
          <span className="text-xs font-bold text-[#8b90a7] block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={12}
            placeholder={MIXED_QUESTIONS_PLACEHOLDER}
            className="w-full rounded-xl border border-[#2e3348] bg-black/40 p-3 text-xs text-[#e8eaf0] font-mono resize-none focus:border-[#6c63ff] outline-none"
          />
        </div>

        <div>
          <span className="text-xs font-bold text-[#8b90a7] block mb-2">AI modeli (JSON&apos;daki &quot;ai_model&quot;den otomatik alınır, gerekirse düzeltin — boş bırakılırsa Manuel sayılır)</span>
          <input
            list={isNotebook ? 'ai-model-options-notebook-questions' : 'ai-model-options-questions'}
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            placeholder={isNotebook ? 'ör. NotebookLM' : 'ör. Claude Sonnet 5'}
            className="w-full rounded-xl border border-[#2e3348] bg-black/40 p-2.5 text-xs text-[#e8eaf0] focus:border-[#6c63ff] outline-none"
          />
          {isNotebook ? (
            <datalist id="ai-model-options-notebook-questions">
              <option value="NotebookLM" />
            </datalist>
          ) : (
            <datalist id="ai-model-options-questions">
              <option value="Claude Sonnet 5" />
              <option value="Claude Opus 5" />
              <option value="GPT-5.1" />
              <option value="Gemini 3 Pro" />
            </datalist>
          )}
        </div>

        {error && <p className="text-xs font-bold text-[#ff6584]">{error}</p>}
        {savedCount != null && <p className="text-xs font-bold text-emerald-400">{savedCount} soru kaydedildi.</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-[#2e3348] px-4 py-2 text-xs font-bold text-[#8b90a7] hover:text-[#e8eaf0] transition-colors">
            Kapat
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

export function SectionModal({
  topicId,
  section,
  variant = 'general',
  onClose,
  onSaved,
}: {
  topicId: number;
  section: SectionModalSection;
  variant?: 'general' | 'notebooklm';
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNotebook = variant === 'notebooklm';
  const [prompt, setPrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [pasted, setPasted] = useState('');
  const [aiModel, setAiModel] = useState(isNotebook ? 'NotebookLM' : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const promptType = isNotebook ? 'section_notebooklm' : 'section';
    (async () => {
      const res = await fetch(`/api/admin/topic-sections/prompt?topicId=${topicId}&sectionId=${section.id}&type=${promptType}`);
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
  }, [topicId, section.id, isNotebook]);

  useEffect(() => {
    if (isNotebook) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/topic-sections/section/${section.id}`);
      const data = await res.json().catch(() => null);
      if (!cancelled && res.ok && data?.source === 'ai_generated' && data?.ai_model) {
        setAiModel(data.ai_model);
      }
    })();
    return () => { cancelled = true; };
  }, [section.id, isNotebook]);

  // Yapıştırılan JSON'da AI kendi model adını "ai_model" alanında bildiriyor;
  // geçerli bir JSON olur olmaz bunu otomatik alıp alandaki değeri güncelliyoruz
  // (admin yine de elle düzeltebilir, o yüzden state olarak tutmaya devam ediyoruz).
  useEffect(() => {
    if (!pasted.trim()) return;
    try {
      const obj = extractJson(pasted) as { ai_model?: unknown };
      if (typeof obj.ai_model === 'string' && obj.ai_model.trim()) {
        setAiModel(obj.ai_model.trim());
      }
    } catch {
      // henüz geçerli JSON değil, sessizce yoksay
    }
  }, [pasted]);

  async function handleSave() {
    setError(null);
    let parsed: unknown;
    try {
      parsed = extractJson(pasted);
    } catch {
      setError('Yapıştırılan metin geçerli bir JSON değil.');
      return;
    }

    const obj = parsed as { body_markdown?: unknown };
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
          source: aiModel.trim() ? 'ai_generated' : 'manual',
          ai_model: aiModel.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Kaydedilemedi.');
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`İçerik Ekle${isNotebook ? ' (NotebookLM)' : ''} — ${section.heading}`} onClose={onClose}>
      <div className="space-y-4">
        {isNotebook && (
          <p className="text-xs text-[#8b90a7]">
            Bu promptu NotebookLM&apos;e, kaynak olarak ders kitabının PDF&apos;ini yüklediğiniz notebook&apos;ta sorun; içerik kitaba dayanarak üretilir.
          </p>
        )}

        <PromptCopyBox prompt={prompt} loading={loadingPrompt} />

        <div>
          <span className="text-xs font-bold text-[#8b90a7] block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={8}
            placeholder='{"body_markdown": "...", "ai_model": "..."}'
            className="w-full rounded-xl border border-[#2e3348] bg-black/40 p-3 text-xs text-[#e8eaf0] font-mono resize-none focus:border-[#6c63ff] outline-none"
          />
        </div>

        <div>
          <span className="text-xs font-bold text-[#8b90a7] block mb-2">AI modeli (JSON&apos;daki &quot;ai_model&quot;den otomatik alınır, gerekirse düzeltin — boş bırakılırsa Manuel sayılır)</span>
          <input
            list={isNotebook ? 'ai-model-options-notebook-section' : 'ai-model-options'}
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            placeholder={isNotebook ? 'ör. NotebookLM' : 'ör. Claude Sonnet 5'}
            className="w-full rounded-xl border border-[#2e3348] bg-black/40 p-2.5 text-xs text-[#e8eaf0] focus:border-[#6c63ff] outline-none"
          />
          {isNotebook ? (
            <datalist id="ai-model-options-notebook-section">
              <option value="NotebookLM" />
            </datalist>
          ) : (
            <datalist id="ai-model-options">
              <option value="Claude Sonnet 5" />
              <option value="Claude Opus 5" />
              <option value="GPT-5.1" />
              <option value="Gemini 3 Pro" />
            </datalist>
          )}
        </div>

        {error && <p className="text-xs font-bold text-[#ff6584]">{error}</p>}

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

const IMAGE_PROMPT_TURKISH_TEXT_SUFFIX =
  ' If the image includes any text, labels, or signs, they must be written in Turkish.';

type GalleryItem = { path: string; url: string; inUse: boolean };

// Aynı ünitede daha önce yüklenmiş görselleri (kullanılan/kullanılmayan hepsi) listeleyip
// tekrar seçilebilmesini sağlar. Hem bölüm görselleri hem konu kapak görselleri için ortak.
function ImageGalleryGrid({
  topicId,
  kind,
  onSelect,
}: {
  topicId: number;
  kind: 'hero' | 'section';
  onSelect: (path: string) => void;
}) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/topic-sections/image-gallery?topicId=${topicId}&kind=${kind}`);
      const data = await res.json().catch(() => null);
      if (cancelled) return;
      if (res.ok) {
        setItems(data?.items || []);
      } else {
        setError(data?.error || 'Galeri yüklenemedi.');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [topicId, kind]);

  async function handleDelete(path: string) {
    if (!confirm('Bu görseli galeriden kalıcı olarak silmek istediğinize emin misiniz?')) return;
    setDeletingPath(path);
    try {
      const res = await fetch(`/api/admin/topic-sections/image-gallery?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.path !== path));
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Silinemedi.');
      }
    } finally {
      setDeletingPath(null);
    }
  }

  if (loading) return <p className="text-xs text-[#8b90a7]">Galeri yükleniyor...</p>;
  if (error) return <p className="text-xs font-bold text-[#ff6584]">{error}</p>;
  if (!items.length) return <p className="text-xs text-[#8b90a7]">Bu ünitede henüz başka görsel yok.</p>;

  return (
    <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
      {items.map((item) => (
        <div key={item.path} className="relative group">
          <button
            type="button"
            onClick={() => onSelect(item.path)}
            className="block w-full aspect-square overflow-hidden rounded-lg border border-[#2e3348] hover:border-[#6c63ff] transition-colors"
            title={item.inUse ? 'Kullanımda' : 'Kullanılmıyor'}
          >
            <img src={item.url} alt="" className="h-full w-full object-cover" />
          </button>
          {item.inUse && (
            <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-bold text-[#c8cad8]">
              kullanımda
            </span>
          )}
          {!item.inUse && (
            <button
              type="button"
              onClick={() => handleDelete(item.path)}
              disabled={deletingPath === item.path}
              className="absolute top-1 right-1 rounded bg-black/70 p-1 text-[#ff6584] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              title="Kalıcı sil"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function ImageModal({
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
  const [metaPrompt, setMetaPrompt] = useState('');
  const [loadingMetaPrompt, setLoadingMetaPrompt] = useState(true);
  const [metaPromptError, setMetaPromptError] = useState<string | null>(null);

  const [rawPrompt, setRawPrompt] = useState('');
  const [savedImagePrompt, setSavedImagePrompt] = useState<string | null>(section.image_prompt);
  const [savedImageAlt, setSavedImageAlt] = useState<string | null>(section.image_alt ?? null);
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(section.image_url);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingMetaPrompt(true);
    setMetaPromptError(null);
    (async () => {
      const res = await fetch(`/api/admin/topic-sections/prompt?topicId=${topicId}&sectionId=${section.id}&type=image`);
      const data = await res.json().catch(() => null);
      if (!cancelled) {
        if (res.ok) {
          setMetaPrompt(data?.prompt || '');
        } else {
          setMetaPromptError(data?.error || 'Prompt oluşturulamadı.');
        }
        setLoadingMetaPrompt(false);
      }
    })();
    return () => { cancelled = true; };
  }, [topicId, section.id]);

  async function handleSavePrompt() {
    setPromptError(null);
    if (!rawPrompt.trim()) {
      setPromptError('Önce AI\'dan gelen JSON çıktısını yapıştırın.');
      return;
    }
    let parsed: unknown;
    try {
      parsed = extractJson(rawPrompt);
    } catch {
      setPromptError('Yapıştırılan metin geçerli bir JSON değil.');
      return;
    }
    const obj = parsed as { image_prompt?: unknown; alt_text?: unknown };
    if (typeof obj.image_prompt !== 'string' || !obj.image_prompt.trim()) {
      setPromptError('JSON içinde "image_prompt" alanı bulunamadı.');
      return;
    }
    const finalPrompt = `${obj.image_prompt.trim()}${IMAGE_PROMPT_TURKISH_TEXT_SUFFIX}`;
    const altText = typeof obj.alt_text === 'string' ? obj.alt_text.trim() : '';
    setPromptSaving(true);
    try {
      const res = await fetch(`/api/admin/topic-sections/section/${section.id}/image`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_prompt: finalPrompt, image_alt: altText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setPromptError(data?.error || 'Kaydedilemedi.');
        return;
      }
      setSavedImagePrompt(finalPrompt);
      setSavedImageAlt(altText || null);
      setRawPrompt('');
      onSaved();
    } finally {
      setPromptSaving(false);
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

  async function handleGallerySelect(path: string) {
    setImageBusy(true);
    setImageError(null);
    try {
      const formData = new FormData();
      formData.append('existingPath', path);
      const res = await fetch(`/api/admin/topic-sections/section/${section.id}/image`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setImageError(data?.error || 'Seçilemedi.');
        return;
      }
      setImageUrl(data.imageUrl);
      setShowGallery(false);
      onImageChanged();
    } finally {
      setImageBusy(false);
    }
  }

  async function handleImageRemove() {
    if (!confirm('Görseli bu bölümden kaldırmak istediğinize emin misiniz? (Dosya galeride kalır, silinmez.)')) return;
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
    <ModalShell title={`Görsel Ekle — ${section.heading}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-[#8b90a7]">
          Önce bu promptu bir AI&apos;a sorun; hem görsel üretim promptunu hem de görselin kısa Türkçe alt metnini (SEO/erişilebilirlik için) JSON olarak üretir. Ardından AI&apos;dan gelen JSON&apos;u aşağıya yapıştırıp kaydedin — &quot;görselde yazı varsa Türkçe olsun&quot; kuralı image_prompt&apos;un sonuna otomatik eklenir. Son olarak hazır promptu bir görsel üretim aracına verip görseli yükleyin.
        </p>

        {metaPromptError ? (
          <p className="text-xs font-bold text-[#ff6584]">{metaPromptError}</p>
        ) : (
          <PromptCopyBox prompt={metaPrompt} loading={loadingMetaPrompt} />
        )}

        <div>
          <span className="text-xs font-bold text-[#8b90a7] block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
          <textarea
            value={rawPrompt}
            onChange={(e) => setRawPrompt(e.target.value)}
            rows={5}
            placeholder='{"image_prompt": "A clean, educational illustration of ...", "alt_text": "..."}'
            className="w-full rounded-xl border border-[#2e3348] bg-black/40 p-3 text-xs text-[#e8eaf0] font-mono resize-none focus:border-[#6c63ff] outline-none"
          />
          <button
            type="button"
            onClick={handleSavePrompt}
            disabled={promptSaving || !rawPrompt.trim()}
            className="mt-2 rounded-lg bg-[#6c63ff] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
          >
            {promptSaving ? 'Kaydediliyor...' : 'Promptu Kaydet'}
          </button>
          {promptError && <p className="mt-2 text-xs font-bold text-[#ff6584]">{promptError}</p>}
        </div>

        {savedImagePrompt && (
          <div>
            <span className="text-[10px] font-bold text-[#6c63ff] block mb-1.5">AI görsel üretim promptu (kopyalayıp bir görsel aracına verin)</span>
            <PromptCopyBox prompt={savedImagePrompt} loading={false} />
          </div>
        )}

        {savedImageAlt && (
          <p className="text-xs text-[#8b90a7]">
            <span className="font-bold text-[#6c63ff]">Alt metin:</span> {savedImageAlt}
          </p>
        )}

        <div className="border-t border-[#2e3348] pt-4 space-y-3">
          <span className="text-xs font-bold text-[#8b90a7] block">Görsel Dosyası</span>

          {imageUrl && (
            <div className="flex items-center gap-3">
              <img src={imageUrl} alt="" className="h-20 w-20 rounded-lg object-cover border border-[#2e3348]" />
              <button
                type="button"
                onClick={handleImageRemove}
                disabled={imageBusy}
                className="rounded-lg border border-[#ff6584]/30 bg-[#ff6584]/10 px-3 py-1.5 text-xs font-bold text-[#ff6584] hover:bg-[#ff6584]/20 disabled:opacity-50 transition-colors"
              >
                {imageBusy ? 'İşleniyor...' : 'Bu Bölümden Kaldır'}
              </button>
            </div>
          )}

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
              {imageBusy ? 'Yükleniyor...' : 'Yeni Dosya Yükle'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowGallery((v) => !v)}
            className="text-xs font-bold text-[#6c63ff] hover:underline"
          >
            {showGallery ? 'Galeriyi gizle' : 'Galeriden Seç'}
          </button>
          {showGallery && (
            <ImageGalleryGrid topicId={topicId} kind="section" onSelect={handleGallerySelect} />
          )}

          {imageError && <p className="text-xs font-bold text-[#ff6584]">{imageError}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-[#2e3348] px-4 py-2 text-xs font-bold text-[#8b90a7] hover:text-[#e8eaf0] transition-colors">
            Kapat
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// Harici bir görsel üretim aracına ihtiyaç duymadan, AI'ın doğrudan yazdığı SVG diyagram
// kodunu (sayı doğrusu, kesir modeli, ölçü etiketli geometrik şekil vb.) kaydetmek için.
// Görsel akışının aksine dosya yükleme yok — AI çıktısı doğrudan metin olarak yapıştırılır.
// Render tarafında ham SVG DOMPurify ile temizlenir (bkz. sanitizeSvg.ts, SectionContent.tsx).
export function DiagramModal({
  topicId,
  section,
  onClose,
  onSaved,
}: {
  topicId: number;
  section: SectionModalSection;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [metaPrompt, setMetaPrompt] = useState('');
  const [loadingMetaPrompt, setLoadingMetaPrompt] = useState(true);
  const [metaPromptError, setMetaPromptError] = useState<string | null>(null);

  const [rawPrompt, setRawPrompt] = useState('');
  const [savedSvg, setSavedSvg] = useState<string | null>(section.diagram_svg ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingMetaPrompt(true);
    setMetaPromptError(null);
    (async () => {
      const res = await fetch(`/api/admin/topic-sections/prompt?topicId=${topicId}&sectionId=${section.id}&type=diagram`);
      const data = await res.json().catch(() => null);
      if (!cancelled) {
        if (res.ok) {
          setMetaPrompt(data?.prompt || '');
        } else {
          setMetaPromptError(data?.error || 'Prompt oluşturulamadı.');
        }
        setLoadingMetaPrompt(false);
      }
    })();
    return () => { cancelled = true; };
  }, [topicId, section.id]);

  async function handleSave() {
    setError(null);
    if (!rawPrompt.trim()) {
      setError('Önce AI\'dan gelen JSON çıktısını yapıştırın.');
      return;
    }
    let parsed: unknown;
    try {
      parsed = extractJson(rawPrompt);
    } catch {
      setError('Yapıştırılan metin geçerli bir JSON değil.');
      return;
    }
    const obj = parsed as { diagram_svg?: unknown };
    const svg = typeof obj.diagram_svg === 'string' ? obj.diagram_svg.trim() : '';
    if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) {
      setError('JSON içindeki "diagram_svg" geçerli bir <svg>...</svg> kodu değil.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/topic-sections/section/${section.id}/diagram`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagram_svg: svg }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Kaydedilemedi.');
        return;
      }
      setSavedSvg(svg);
      setRawPrompt('');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!confirm('Diyagramı kaldırmak istediğinize emin misiniz?')) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/topic-sections/section/${section.id}/diagram`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Silinemedi.');
        return;
      }
      setSavedSvg(null);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Diyagram Ekle — ${section.heading}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-[#8b90a7]">
          Önce bu promptu bir AI&apos;a sorun; ders notundaki sayı/ölçüyle birebir tutarlı bir SVG diyagram kodu üretir
          (sayı doğrusu, kesir modeli, ölçü etiketli şekil vb.). Ardından AI&apos;dan gelen JSON&apos;u aşağıya yapıştırıp kaydedin —
          harici bir görsel aracına gitmenize gerek yok, kod doğrudan sayfada render edilir.
        </p>

        {metaPromptError ? (
          <p className="text-xs font-bold text-[#ff6584]">{metaPromptError}</p>
        ) : (
          <PromptCopyBox prompt={metaPrompt} loading={loadingMetaPrompt} />
        )}

        <div>
          <span className="text-xs font-bold text-[#8b90a7] block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
          <textarea
            value={rawPrompt}
            onChange={(e) => setRawPrompt(e.target.value)}
            rows={6}
            placeholder='{"diagram_svg": "<svg viewBox=\"0 0 300 160\">...</svg>"}'
            className="w-full rounded-xl border border-[#2e3348] bg-black/40 p-3 text-xs text-[#e8eaf0] font-mono resize-none focus:border-[#6c63ff] outline-none"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !rawPrompt.trim()}
            className="mt-2 rounded-lg bg-[#6c63ff] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Kaydediliyor...' : 'Diyagramı Kaydet'}
          </button>
          {error && <p className="mt-2 text-xs font-bold text-[#ff6584]">{error}</p>}
        </div>

        {savedSvg && (
          <div className="border-t border-[#2e3348] pt-4">
            <span className="text-xs font-bold text-[#8b90a7] block mb-2">Kayıtlı diyagram</span>
            <div
              className="rounded-lg border border-[#2e3348] bg-white p-3 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-xs"
              dangerouslySetInnerHTML={{ __html: sanitizeMathSvg(savedSvg) || '' }}
            />
            <button
              type="button"
              onClick={handleRemove}
              disabled={saving}
              className="mt-2 rounded-lg border border-[#ff6584]/30 bg-[#ff6584]/10 px-3 py-1.5 text-xs font-bold text-[#ff6584] hover:bg-[#ff6584]/20 disabled:opacity-50 transition-colors"
            >
              {saving ? 'İşleniyor...' : 'Diyagramı Kaldır'}
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-[#2e3348] px-4 py-2 text-xs font-bold text-[#8b90a7] hover:text-[#e8eaf0] transition-colors">
            Kapat
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// Konu kapak görselini, alt başlıklar/içerikle uğraşmadan tek başına güncellemek için.
// Sidebar'daki ana konu ⋮ menüsünden açılır.
export function TopicCoverImageModal({
  topicId,
  onClose,
  onSaved,
}: {
  topicId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loadingBundle, setLoadingBundle] = useState(true);
  const [topicContentId, setTopicContentId] = useState<number | null>(null);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [savedPrompt, setSavedPrompt] = useState<string | null>(null);
  const [savedAlt, setSavedAlt] = useState<string | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);

  const [metaPrompt, setMetaPrompt] = useState('');
  const [loadingMetaPrompt, setLoadingMetaPrompt] = useState(true);
  const [metaPromptError, setMetaPromptError] = useState<string | null>(null);

  const [rawPrompt, setRawPrompt] = useState('');
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroBusy, setHeroBusy] = useState(false);
  const [heroError, setHeroError] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);

  const loadBundle = useCallback(async () => {
    setLoadingBundle(true);
    setBundleError(null);
    try {
      const res = await fetch(`/api/admin/topic-sections?topicId=${topicId}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setBundleError(data?.error || 'Konu bilgisi yüklenemedi.');
        return;
      }
      setTopicContentId(data?.topicContent?.id ?? null);
      setHeroUrl(data?.topicContent?.hero_image_url ?? null);
      setSavedPrompt(data?.heroImagePrompt ?? null);
      setSavedAlt(data?.heroImageAlt ?? null);
    } finally {
      setLoadingBundle(false);
    }
  }, [topicId]);

  useEffect(() => {
    loadBundle();
  }, [loadBundle]);

  useEffect(() => {
    let cancelled = false;
    setLoadingMetaPrompt(true);
    setMetaPromptError(null);
    (async () => {
      const res = await fetch(`/api/admin/topic-sections/prompt?topicId=${topicId}&type=cover_image`);
      const data = await res.json().catch(() => null);
      if (!cancelled) {
        if (res.ok) {
          setMetaPrompt(data?.prompt || '');
        } else {
          setMetaPromptError(data?.error || 'Prompt oluşturulamadı.');
        }
        setLoadingMetaPrompt(false);
      }
    })();
    return () => { cancelled = true; };
  }, [topicId]);

  async function handleSavePrompt() {
    if (!topicContentId) return;
    setPromptError(null);
    if (!rawPrompt.trim()) {
      setPromptError('Önce AI\'dan gelen JSON çıktısını yapıştırın.');
      return;
    }
    let parsed: unknown;
    try {
      parsed = extractJson(rawPrompt);
    } catch {
      setPromptError('Yapıştırılan metin geçerli bir JSON değil.');
      return;
    }
    const obj = parsed as { image_prompt?: unknown; alt_text?: unknown };
    if (typeof obj.image_prompt !== 'string' || !obj.image_prompt.trim()) {
      setPromptError('JSON içinde "image_prompt" alanı bulunamadı.');
      return;
    }
    const finalPrompt = `${obj.image_prompt.trim()}${IMAGE_PROMPT_TURKISH_TEXT_SUFFIX}`;
    const altText = typeof obj.alt_text === 'string' ? obj.alt_text.trim() : '';
    setPromptSaving(true);
    try {
      const res = await fetch('/api/admin/topic-sections/topic-content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicContentId, heroImagePrompt: finalPrompt, heroImageAlt: altText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setPromptError(data?.error || 'Kaydedilemedi.');
        return;
      }
      setSavedPrompt(finalPrompt);
      setSavedAlt(altText || null);
      setRawPrompt('');
      onSaved();
    } finally {
      setPromptSaving(false);
    }
  }

  async function handleHeroUpload() {
    if (!heroFile || !topicContentId) return;
    setHeroBusy(true);
    setHeroError(null);
    try {
      const formData = new FormData();
      formData.append('file', heroFile);
      formData.append('topicContentId', String(topicContentId));
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

  async function handleHeroGallerySelect(path: string) {
    if (!topicContentId) return;
    setHeroBusy(true);
    setHeroError(null);
    try {
      const formData = new FormData();
      formData.append('existingPath', path);
      formData.append('topicContentId', String(topicContentId));
      const res = await fetch('/api/admin/topic-sections/hero-image', { method: 'POST', body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setHeroError(data?.error || 'Seçilemedi.');
        return;
      }
      setHeroUrl(data.imageUrl);
      setShowGallery(false);
      onSaved();
    } finally {
      setHeroBusy(false);
    }
  }

  async function handleHeroRemove() {
    if (!topicContentId) return;
    if (!confirm('Kapak görselini bu konudan kaldırmak istediğinize emin misiniz? (Dosya galeride kalır, silinmez.)')) return;
    setHeroBusy(true);
    setHeroError(null);
    try {
      const res = await fetch(`/api/admin/topic-sections/hero-image?topicContentId=${topicContentId}`, { method: 'DELETE' });
      if (res.ok) {
        setHeroUrl(null);
        onSaved();
      }
    } finally {
      setHeroBusy(false);
    }
  }

  return (
    <ModalShell title="Konu Kapak Görseli" onClose={onClose}>
      {loadingBundle ? (
        <p className="text-sm text-[#8b90a7]">Yükleniyor...</p>
      ) : bundleError ? (
        <p className="text-xs font-bold text-[#ff6584]">{bundleError}</p>
      ) : !topicContentId ? (
        <p className="text-sm text-[#8b90a7]">
          Önce bu konu için alt başlık planı oluşturulmalı (sidebar&apos;daki &quot;Alt Başlık Planı Prompt&apos;u&quot; ile).
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-[#8b90a7]">
            Önce bu promptu bir AI&apos;a sorun; hem görsel üretim promptunu hem de görselin kısa Türkçe alt metnini (SEO/erişilebilirlik için) JSON olarak üretir. Ardından AI&apos;dan gelen JSON&apos;u aşağıya yapıştırıp kaydedin — &quot;görselde yazı varsa Türkçe olsun&quot; kuralı image_prompt&apos;un sonuna otomatik eklenir. Son olarak hazır promptu bir görsel üretim aracına verip görseli yükleyin.
          </p>

          {metaPromptError ? (
            <p className="text-xs font-bold text-[#ff6584]">{metaPromptError}</p>
          ) : (
            <PromptCopyBox prompt={metaPrompt} loading={loadingMetaPrompt} />
          )}

          <div>
            <span className="text-xs font-bold text-[#8b90a7] block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
            <textarea
              value={rawPrompt}
              onChange={(e) => setRawPrompt(e.target.value)}
              rows={5}
              placeholder='{"image_prompt": "A clean, educational illustration of ...", "alt_text": "..."}'
              className="w-full rounded-xl border border-[#2e3348] bg-black/40 p-3 text-xs text-[#e8eaf0] font-mono resize-none focus:border-[#6c63ff] outline-none"
            />
            <button
              type="button"
              onClick={handleSavePrompt}
              disabled={promptSaving || !rawPrompt.trim()}
              className="mt-2 rounded-lg bg-[#6c63ff] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
            >
              {promptSaving ? 'Kaydediliyor...' : 'Promptu Kaydet'}
            </button>
            {promptError && <p className="mt-2 text-xs font-bold text-[#ff6584]">{promptError}</p>}
          </div>

          {savedPrompt && (
            <div>
              <span className="text-[10px] font-bold text-[#6c63ff] block mb-1.5">AI görsel üretim promptu (kopyalayıp bir görsel aracına verin)</span>
              <PromptCopyBox prompt={savedPrompt} loading={false} />
            </div>
          )}

          {savedAlt && (
            <p className="text-xs text-[#8b90a7]">
              <span className="font-bold text-[#6c63ff]">Alt metin:</span> {savedAlt}
            </p>
          )}

          <div className="border-t border-[#2e3348] pt-4 space-y-3">
            <span className="text-xs font-bold text-[#8b90a7] block">Görsel Dosyası</span>

            {heroUrl && (
              <div className="flex items-center gap-3">
                <img src={heroUrl} alt="" className="h-20 w-32 rounded-lg object-cover border border-[#2e3348]" />
                <button
                  type="button"
                  onClick={handleHeroRemove}
                  disabled={heroBusy}
                  className="rounded-lg border border-[#ff6584]/30 bg-[#ff6584]/10 px-3 py-1.5 text-xs font-bold text-[#ff6584] hover:bg-[#ff6584]/20 disabled:opacity-50 transition-colors"
                >
                  {heroBusy ? 'İşleniyor...' : 'Bu Konudan Kaldır'}
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => setHeroFile(e.target.files?.[0] || null)}
                className="flex-1 text-xs text-[#c8cad8] file:mr-3 file:rounded-lg file:border-0 file:bg-[#222636] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#e8eaf0]"
              />
              <button
                type="button"
                onClick={handleHeroUpload}
                disabled={!heroFile || heroBusy}
                className="shrink-0 rounded-lg bg-[#6c63ff] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
              >
                {heroBusy ? 'Yükleniyor...' : 'Yeni Dosya Yükle'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowGallery((v) => !v)}
              className="text-xs font-bold text-[#6c63ff] hover:underline"
            >
              {showGallery ? 'Galeriyi gizle' : 'Galeriden Seç'}
            </button>
            {showGallery && (
              <ImageGalleryGrid topicId={topicId} kind="hero" onSelect={handleHeroGallerySelect} />
            )}

            {heroError && <p className="text-xs font-bold text-[#ff6584]">{heroError}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl border border-[#2e3348] px-4 py-2 text-xs font-bold text-[#8b90a7] hover:text-[#e8eaf0] transition-colors">
              Kapat
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

// Anahtar kavramları, konunun geri kalanına (alt başlık, ders notu, kapak görseli) hiç
// dokunmadan tek başına yeniden üretmek/güncellemek için. Sidebar'daki ana konu ⋮ menüsünden açılır.
export function TopicHighlightsModal({
  topicId,
  onClose,
  onSaved,
}: {
  topicId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loadingBundle, setLoadingBundle] = useState(true);
  const [topicContentId, setTopicContentId] = useState<number | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);

  const [prompt, setPrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [promptError, setPromptError] = useState<string | null>(null);

  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const loadBundle = useCallback(async () => {
    setLoadingBundle(true);
    setBundleError(null);
    try {
      const res = await fetch(`/api/admin/topic-sections?topicId=${topicId}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setBundleError(data?.error || 'Konu bilgisi yüklenemedi.');
        return;
      }
      setTopicContentId(data?.topicContent?.id ?? null);
    } finally {
      setLoadingBundle(false);
    }
  }, [topicId]);

  useEffect(() => {
    loadBundle();
  }, [loadBundle]);

  useEffect(() => {
    let cancelled = false;
    setLoadingPrompt(true);
    setPromptError(null);
    (async () => {
      const res = await fetch(`/api/admin/topic-sections/prompt?topicId=${topicId}&type=highlights`);
      const data = await res.json().catch(() => null);
      if (!cancelled) {
        if (res.ok) {
          setPrompt(data?.prompt || '');
        } else {
          setPromptError(data?.error || 'Prompt oluşturulamadı.');
        }
        setLoadingPrompt(false);
      }
    })();
    return () => { cancelled = true; };
  }, [topicId]);

  async function handleSave() {
    if (!topicContentId) return;
    setError(null);
    setSavedCount(null);
    let parsed: unknown;
    try {
      parsed = extractJson(pasted);
    } catch {
      setError('Yapıştırılan metin geçerli bir JSON değil.');
      return;
    }

    const obj = parsed as { highlights?: unknown };
    if (!Array.isArray(obj.highlights) || !obj.highlights.length) {
      setError('JSON içinde "highlights" listesi bulunamadı.');
      return;
    }

    const payload = (obj.highlights as { icon?: unknown; title?: unknown; description?: unknown }[])
      .map((h, idx) => ({
        icon: typeof h.icon === 'string' ? h.icon : '',
        title: typeof h.title === 'string' ? h.title : '',
        description: typeof h.description === 'string' ? h.description : '',
        order_no: idx,
      }))
      .filter((h) => h.title.trim() && h.description.trim());

    if (!payload.length) {
      setError('JSON içindeki kavramların başlık/açıklama alanları boş.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/topic-sections/highlights', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicContentId, highlights: payload }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Kaydedilemedi.');
        return;
      }
      setSavedCount(payload.length);
      setPasted('');
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Anahtar Kavramları Güncelle" onClose={onClose}>
      {loadingBundle ? (
        <p className="text-sm text-[#8b90a7]">Yükleniyor...</p>
      ) : bundleError ? (
        <p className="text-xs font-bold text-[#ff6584]">{bundleError}</p>
      ) : !topicContentId ? (
        <p className="text-sm text-[#8b90a7]">
          Önce bu konu için alt başlık planı oluşturulmalı (sidebar&apos;daki &quot;Alt Başlık Planı Prompt&apos;u&quot; ile).
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-[#8b90a7]">
            Bu prompt SADECE anahtar kavramları üretir; konunun diğer alanlarına (alt başlık, ders notu, kapak görseli) dokunmadan sadece bu listeyi günceller. AI çıktısını aşağıya yapıştırıp kaydedin — mevcut kavramların yerine geçer.
          </p>

          {promptError ? (
            <p className="text-xs font-bold text-[#ff6584]">{promptError}</p>
          ) : (
            <PromptCopyBox prompt={prompt} loading={loadingPrompt} />
          )}

          <div>
            <span className="text-xs font-bold text-[#8b90a7] block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={10}
              placeholder='{"highlights": [{"icon": "🧠", "title": "...", "description": "..."}]}'
              className="w-full rounded-xl border border-[#2e3348] bg-black/40 p-3 text-xs text-[#e8eaf0] font-mono resize-none focus:border-[#6c63ff] outline-none"
            />
          </div>

          {error && <p className="text-xs font-bold text-[#ff6584]">{error}</p>}
          {savedCount != null && <p className="text-xs font-bold text-emerald-400">{savedCount} kavram kaydedildi.</p>}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl border border-[#2e3348] px-4 py-2 text-xs font-bold text-[#8b90a7] hover:text-[#e8eaf0] transition-colors">
              Kapat
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
      )}
    </ModalShell>
  );
}

// Alt başlıklara değil, doğrudan konunun geneline ait (section_id boş) 10-15 sentez/genel
// tekrar sorusu üretir — ünite testinde kullanılacak. QuestionsModal'dan farkı: promptun
// tek bir alt başlığın notuna değil, konunun TÜM alt başlıklarının notuna dayanması ve
// kaydederken sectionId gerektirmemesi (bkz. api/admin/topic-sections/topic/[topicId]/questions).
export function TopicQuestionsModal({
  topicId,
  topicTitle,
  variant = 'notebooklm',
  onClose,
}: {
  topicId: number;
  topicTitle: string;
  variant?: 'general' | 'notebooklm';
  onClose: () => void;
}) {
  const isNotebook = variant === 'notebooklm';
  const [prompt, setPrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [aiModel, setAiModel] = useState(isNotebook ? 'NotebookLM' : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingPrompt(true);
    setPromptError(null);
    const promptType = isNotebook ? 'topic_questions' : 'topic_questions_mixed';
    (async () => {
      const res = await fetch(`/api/admin/topic-sections/prompt?topicId=${topicId}&type=${promptType}`);
      const data = await res.json().catch(() => null);
      if (!cancelled) {
        if (res.ok) {
          setPrompt(data?.prompt || '');
        } else {
          setPromptError(data?.error || 'Prompt oluşturulamadı.');
        }
        setLoadingPrompt(false);
      }
    })();
    return () => { cancelled = true; };
  }, [topicId, isNotebook]);

  useEffect(() => {
    if (!pasted.trim()) return;
    try {
      const obj = extractJson(pasted) as { ai_model?: unknown };
      if (typeof obj.ai_model === 'string' && obj.ai_model.trim()) {
        setAiModel(obj.ai_model.trim());
      }
    } catch {
      // henüz geçerli JSON değil, sessizce yoksay
    }
  }, [pasted]);

  async function handleSave() {
    setError(null);
    setSavedCount(null);
    let parsed: unknown;
    try {
      parsed = extractJson(pasted);
    } catch {
      setError('Yapıştırılan metin geçerli bir JSON değil.');
      return;
    }

    const obj = parsed as { questions?: unknown };
    if (!Array.isArray(obj.questions) || !obj.questions.length) {
      setError('JSON içinde "questions" listesi bulunamadı.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/topic-sections/topic/${topicId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: obj.questions, ai_model: aiModel.trim() || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Kaydedilemedi.');
        return;
      }
      setSavedCount(data?.savedCount ?? obj.questions.length);
      setPasted('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Genel Sorular (Ünite Testi)${isNotebook ? '' : ' — Diğer AI'} — ${topicTitle}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-[#8b90a7]">
          {isNotebook
            ? 'Bu promptu NotebookLM\'e, kaynak olarak ders kitabının PDF\'ini yüklediğiniz notebook\'ta sorun. Tek bir alt başlığa değil konunun bütününe bakan, en az iki alt başlığı birleştiren/karşılaştıran 10-15 sentez sorusu üretilir; bunlar ünite testinde alt başlık sorularıyla birlikte gösterilir. AI çıktısını aşağıya yapıştırıp tek seferde kaydedin.'
            : 'Bu promptu ChatGPT, Claude, Gemini gibi kitap yüklemediğiniz bir AI\'a sorun — konunun tüm alt başlıklarının ders notu prompt içine gömülür. Tek bir alt başlığa değil konunun bütününe bakan, en az iki alt başlığı birleştiren/karşılaştıran 10-15 sentez sorusu üretilir; bunlar ünite testinde alt başlık sorularıyla birlikte gösterilir. AI çıktısını aşağıya yapıştırıp tek seferde kaydedin.'}
        </p>

        {promptError ? (
          <p className="text-xs font-bold text-[#ff6584]">{promptError}</p>
        ) : (
          <PromptCopyBox prompt={prompt} loading={loadingPrompt} />
        )}

        <div>
          <span className="text-xs font-bold text-[#8b90a7] block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={12}
            placeholder={MIXED_QUESTIONS_PLACEHOLDER}
            className="w-full rounded-xl border border-[#2e3348] bg-black/40 p-3 text-xs text-[#e8eaf0] font-mono resize-none focus:border-[#6c63ff] outline-none"
          />
        </div>

        <div>
          <span className="text-xs font-bold text-[#8b90a7] block mb-2">AI modeli (JSON&apos;daki &quot;ai_model&quot;den otomatik alınır, gerekirse düzeltin — boş bırakılırsa Manuel sayılır)</span>
          <input
            list={isNotebook ? 'ai-model-options-topic-questions-notebook' : 'ai-model-options-topic-questions'}
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            placeholder={isNotebook ? 'ör. NotebookLM' : 'ör. Claude Sonnet 5'}
            className="w-full rounded-xl border border-[#2e3348] bg-black/40 p-2.5 text-xs text-[#e8eaf0] focus:border-[#6c63ff] outline-none"
          />
          {isNotebook ? (
            <datalist id="ai-model-options-topic-questions-notebook">
              <option value="NotebookLM" />
            </datalist>
          ) : (
            <datalist id="ai-model-options-topic-questions">
              <option value="Claude Sonnet 5" />
              <option value="Claude Opus 5" />
              <option value="GPT-5.1" />
              <option value="Gemini 3 Pro" />
            </datalist>
          )}
        </div>

        {error && <p className="text-xs font-bold text-[#ff6584]">{error}</p>}
        {savedCount != null && <p className="text-xs font-bold text-emerald-400">{savedCount} soru kaydedildi.</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-[#2e3348] px-4 py-2 text-xs font-bold text-[#8b90a7] hover:text-[#e8eaf0] transition-colors">
            Kapat
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

// Tek bir anahtar kavramı, AI'a gitmeden, elle hızlıca eklemek için. Ders sayfasındaki
// "Anahtar Kavramlar" başlığının yanındaki + butonundan açılır; mevcut kavramların üzerine
// yenisini ekler (listeyi sıfırlamaz).
export function TopicHighlightQuickAddModal({
  topicId,
  onClose,
  onSaved,
}: {
  topicId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [topicContentId, setTopicContentId] = useState<number | null>(null);
  const [existing, setExisting] = useState<{ icon: string | null; title: string; description: string }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [icon, setIcon] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/topic-sections?topicId=${topicId}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setLoadError(data?.error || 'Konu bilgisi yüklenemedi.');
        return;
      }
      setTopicContentId(data?.topicContent?.id ?? null);
      setExisting(((data?.highlights || []) as { icon: string | null; title: string; description: string }[]));
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    if (!topicContentId) return;
    setError(null);
    if (!title.trim() || !description.trim()) {
      setError('Başlık ve açıklama zorunlu.');
      return;
    }
    setSaving(true);
    try {
      const merged = [
        ...existing.map((h) => ({ icon: h.icon || '', title: h.title, description: h.description })),
        { icon: icon.trim(), title: title.trim(), description: description.trim() },
      ].map((h, idx) => ({ ...h, order_no: idx }));

      const res = await fetch('/api/admin/topic-sections/highlights', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicContentId, highlights: merged }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Kaydedilemedi.');
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Yeni Anahtar Kavram Ekle" onClose={onClose}>
      {loading ? (
        <p className="text-sm text-[#8b90a7]">Yükleniyor...</p>
      ) : loadError ? (
        <p className="text-xs font-bold text-[#ff6584]">{loadError}</p>
      ) : !topicContentId ? (
        <p className="text-sm text-[#8b90a7]">
          Önce bu konu için alt başlık planı oluşturulmalı (sidebar&apos;daki &quot;Alt Başlık Planı Prompt&apos;u&quot; ile).
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🧠"
              maxLength={4}
              className="w-14 shrink-0 rounded-lg border border-[#2e3348] bg-black/40 px-2 py-2 text-center text-sm text-[#e8eaf0] focus:border-[#6c63ff] outline-none"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kavram / terim"
              className="flex-1 rounded-lg border border-[#2e3348] bg-black/40 px-3 py-2 text-sm text-[#e8eaf0] focus:border-[#6c63ff] outline-none"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Açıklama / tanım"
            rows={3}
            className="w-full rounded-lg border border-[#2e3348] bg-black/40 px-3 py-2 text-sm text-[#e8eaf0] resize-none focus:border-[#6c63ff] outline-none"
          />
          {error && <p className="text-xs font-bold text-[#ff6584]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl border border-[#2e3348] px-4 py-2 text-xs font-bold text-[#8b90a7] hover:text-[#e8eaf0] transition-colors">
              İptal
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !title.trim() || !description.trim()}
              className="rounded-xl bg-[#6c63ff] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Ekleniyor...' : 'Ekle'}
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

// Var olan TEK bir anahtar kavramı elle düzenlemek (veya silmek) için. Ders sayfasındaki
// her anahtar kavram kartının üzerindeki kalem ikonundan açılır. index, o an ekranda
// gösterilen (order_no'ya göre sıralı) highlights listesindeki konumu; kaydederken
// güncel listeyi tazeden çekip sadece o pozisyonu değiştiriyoruz.
export function TopicHighlightEditModal({
  topicId,
  index,
  onClose,
  onSaved,
}: {
  topicId: number;
  index: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [topicContentId, setTopicContentId] = useState<number | null>(null);
  const [existing, setExisting] = useState<{ icon: string | null; title: string; description: string }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [icon, setIcon] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/topic-sections?topicId=${topicId}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setLoadError(data?.error || 'Konu bilgisi yüklenemedi.');
        return;
      }
      setTopicContentId(data?.topicContent?.id ?? null);
      const list = (data?.highlights || []) as { icon: string | null; title: string; description: string }[];
      setExisting(list);
      const current = list[index];
      if (current) {
        setIcon(current.icon || '');
        setTitle(current.title);
        setDescription(current.description);
      } else {
        setLoadError('Bu kavram artık bulunamadı, güncel listeyle uyuşmuyor olabilir.');
      }
    } finally {
      setLoading(false);
    }
  }, [topicId, index]);

  useEffect(() => {
    load();
  }, [load]);

  async function persist(nextList: { icon: string; title: string; description: string }[]) {
    if (!topicContentId) return false;
    setError(null);
    const res = await fetch('/api/admin/topic-sections/highlights', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicContentId,
        highlights: nextList.map((h, idx) => ({ ...h, order_no: idx })),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || 'Kaydedilemedi.');
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!title.trim() || !description.trim()) {
      setError('Başlık ve açıklama zorunlu.');
      return;
    }
    setSaving(true);
    try {
      const next = existing.map((h, i) =>
        i === index
          ? { icon: icon.trim(), title: title.trim(), description: description.trim() }
          : { icon: h.icon || '', title: h.title, description: h.description }
      );
      const ok = await persist(next);
      if (ok) {
        onSaved();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Bu anahtar kavramı silmek istediğinize emin misiniz?')) return;
    setSaving(true);
    try {
      const next = existing
        .filter((_, i) => i !== index)
        .map((h) => ({ icon: h.icon || '', title: h.title, description: h.description }));
      const ok = await persist(next);
      if (ok) {
        onSaved();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Anahtar Kavramı Düzenle" onClose={onClose}>
      {loading ? (
        <p className="text-sm text-[#8b90a7]">Yükleniyor...</p>
      ) : loadError ? (
        <p className="text-xs font-bold text-[#ff6584]">{loadError}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🧠"
              maxLength={4}
              className="w-14 shrink-0 rounded-lg border border-[#2e3348] bg-black/40 px-2 py-2 text-center text-sm text-[#e8eaf0] focus:border-[#6c63ff] outline-none"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kavram / terim"
              className="flex-1 rounded-lg border border-[#2e3348] bg-black/40 px-3 py-2 text-sm text-[#e8eaf0] focus:border-[#6c63ff] outline-none"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Açıklama / tanım"
            rows={3}
            className="w-full rounded-lg border border-[#2e3348] bg-black/40 px-3 py-2 text-sm text-[#e8eaf0] resize-none focus:border-[#6c63ff] outline-none"
          />
          {error && <p className="text-xs font-bold text-[#ff6584]">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handleDelete}
              disabled={saving}
              className="rounded-xl border border-[#ff6584]/30 bg-[#ff6584]/10 px-4 py-2 text-xs font-bold text-[#ff6584] hover:bg-[#ff6584]/20 disabled:opacity-50 transition-colors"
            >
              Sil
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="rounded-xl border border-[#2e3348] px-4 py-2 text-xs font-bold text-[#8b90a7] hover:text-[#e8eaf0] transition-colors">
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim() || !description.trim()}
                className="rounded-xl bg-[#6c63ff] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
