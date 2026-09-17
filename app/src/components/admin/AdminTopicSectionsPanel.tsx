'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  AlertTriangle, Check, Clipboard, ImagePlus, ListChecks, MoreVertical, Pencil, Plus,
  RefreshCw, Shapes, Sparkles, Trash2, Video, Youtube, X,
} from 'lucide-react';
import { markdownToHtml } from '@/app/src/lib/topicContentV11';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';
import { copyText } from '@/app/src/lib/clipboard';
import { extractJson } from '@/app/src/lib/extractJson';
import SectionContent from '@/app/ders/SectionContent';
import { TopicSummaryBox } from '@/app/ders/DersClientCards';
import { computePlanHeadingDiff, fetchExistingSectionsForDiff, type ExistingSectionForDiff } from '@/app/src/lib/planHeadingDiff';
import { PlanHeadingDiffReview } from '@/app/src/components/admin/PlanHeadingDiffReview';
import { formatDersSaatiDuration } from '@/app/src/lib/topicPacing';

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

// Konuya MEB müfredatında ayrılan süreyi, ünitenin diğer konularına göre gösteren rozet —
// bkz. topicPacing.ts. "normal" pay için ayrıca bir vurgu yapmaya gerek yok, rozet basılmıyor.
const PACING_LABELS: Record<'ozet' | 'detayli', string> = { ozet: 'Özet', detayli: 'Detaylı' };
const PACING_COLORS: Record<'ozet' | 'detayli', string> = {
  ozet: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
  detayli: 'bg-sky-400/10 text-sky-300 border-sky-400/30',
};
function pacingBadgeText(p: TopicPacing): string | null {
  if (!p || p.label === 'normal') return null;
  const timeText = p.hoursEstimate ? `~${formatDersSaatiDuration(p.hoursEstimate)}` : `~${p.topicWeeks} hafta`;
  return `⏱ ${timeText} · Ünitenin ~%${p.sharePct}'i · ${PACING_LABELS[p.label]}`;
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
  notebook_markdown: string | null;
  activity_prompt_markdown: string | null;
  activity_example_markdown: string | null;
  image_url: string | null;
  image_prompt: string | null;
  image_alt: string | null;
  diagram_svg: string | null;
  video_url: string | null;
  video_prompt: string | null;
  video_type: 'ai_generated' | 'youtube' | null;
  status: 'planned' | 'content_ready' | 'image_ready' | 'published';
  outcomes: SectionOutcome[];
};
type Highlight = { id: number; icon: string | null; title: string; description: string; order_no: number };
type TopicPacing = {
  topicWeeks: number;
  unitWeeks: number;
  sharePct: number;
  label: 'ozet' | 'normal' | 'detayli';
  hoursEstimate: number | null;
} | null;

type Bundle = {
  topic: { id: number; title: string };
  unit: { id: number; title: string } | null;
  lesson: { id: number; name: string } | null;
  grade: { id: number; name: string } | null;
  outcomes: Outcome[];
  missingCodeCount: number;
  pacing: TopicPacing;
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

function SectionMenuItem({ icon: Icon, onClick, children }: { icon: ComponentType<{ className?: string }>; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-foreground hover:bg-accent transition-colors"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {children}
    </button>
  );
}

// NotebookLM'in normal sohbet kutusu, konu üretme promptlarımız için fazla dar (yayınlanmış
// bir rakam yok ama topluluk raporları ~2000 karakter civarı gösteriyor) — özellikle çok
// kazanımlı konularda kurallar+kazanımlar toplamı bunu aşıyordu (kullanıcı raporu, 2026-09-17).
// Bu, kalite kurallarını HER mesajda tekrar göndermek yerine notebook'un "Özel Talimatlar"
// alanına (10.000 karakter limitli, kalıcı) BİR KERE kaydetmeyi sağlıyor — bundan sonra
// 03/09/24. promptlar sadece konuya özgü kısa bağlamı taşıyor, kurallar tekrar edilmiyor.
// RAG kaynak hattının bu konu (ve ünitesi) için hangi aşamada olduğunu tek bakışta gösterir —
// kullanıcının 2026-09-17 isteği: "rag sisteminde nerede kaldığımı gösteren hangi aşamada
// olduğumu gösteren bi yapı olsaydı iyi olur". Veriler DersClient.tsx'ten kaldırılan (artık
// gereksiz olan çoklu-konu sidebar rozetleriyle aynı) route'lardan geliyor — o route'lar hâlâ
// duruyor, sadece TEK bir topicId/unitId ile çağrılıyor.
export const MIN_RAG_SOURCE_DRAFTS = 5;

type RagStage = 'done' | 'warning' | 'pending';

function RagStageChip({ stage, label }: { stage: RagStage; label: string }) {
  const styles: Record<RagStage, string> = {
    done: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300',
    warning: 'border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300',
    pending: 'border-border bg-surface text-muted-foreground',
  };
  const icon = stage === 'done' ? '✓' : stage === 'warning' ? '⚠' : '○';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${styles[stage]}`}>
      <span>{icon}</span> {label}
    </span>
  );
}

export function RagPipelineStatus({ topicId, unitId }: { topicId: number; unitId: number | null }) {
  const [loading, setLoading] = useState(true);
  const [draftCount, setDraftCount] = useState(0);
  const [synthesized, setSynthesized] = useState(false);
  const [hasOpenFlag, setHasOpenFlag] = useState(false);
  const [unitReady, setUnitReady] = useState(false);
  const [unitChecked, setUnitChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const requests = [
        fetch(`/api/admin/rag/topics-draft-counts?topicIds=${topicId}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/admin/rag/topics-with-synthesis?topicIds=${topicId}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/admin/rag/topics-review-status?topicIds=${topicId}`).then((r) => (r.ok ? r.json() : null)),
        unitId
          ? fetch(`/api/admin/rag/units-ready-for-dedup?unitIds=${unitId}`).then((r) => (r.ok ? r.json() : null))
          : Promise.resolve(null),
        unitId
          ? fetch(`/api/admin/rag/units-with-dedup-check?unitIds=${unitId}`).then((r) => (r.ok ? r.json() : null))
          : Promise.resolve(null),
      ] as const;
      const [drafts, synth, flags, ready, checked] = await Promise.all(requests);
      if (cancelled) return;
      setDraftCount(drafts?.counts?.[topicId] || 0);
      setSynthesized(Boolean(synth?.topicIds?.includes(topicId)));
      setHasOpenFlag(Boolean(flags?.topicIds?.includes(topicId)));
      setUnitReady(Boolean(unitId && ready?.unitIds?.includes(unitId)));
      setUnitChecked(Boolean(unitId && checked?.unitIds?.includes(unitId)));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [topicId, unitId]);

  if (loading) return <p className="text-xs text-muted-foreground">RAG durumu yükleniyor...</p>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {/* Sentezlenince ham taslaklar silinip yerine tek sentez metni geldiği için sayaç
          0'a düşüyor — ama sentezlenmiş olmak zaten en az MIN_RAG_SOURCE_DRAFTS şartıyla
          mümkün, o yüzden "synthesized" tek başına bu aşamayı da tamamlanmış sayar
          (kullanıcının 2026-09-18 bulduğu tutarsızlık: "2. adımı tamamlayınca taslak 0
          olduğu için 1. adım tamamlanmamış gibi duruyor"). */}
      <RagStageChip
        stage={draftCount >= MIN_RAG_SOURCE_DRAFTS || synthesized ? 'done' : 'pending'}
        label={synthesized ? '1. Kaynak Taslakları (tamamlandı)' : `1. Kaynak Taslakları (${draftCount}/${MIN_RAG_SOURCE_DRAFTS})`}
      />
      <RagStageChip stage={synthesized ? 'done' : 'pending'} label="2. Sentezlendi" />
      {unitId && (
        <RagStageChip
          stage={unitChecked ? 'done' : unitReady ? 'warning' : 'pending'}
          label={unitChecked ? '3. Ünite Sentezi — kontrol edildi' : unitReady ? '3. Ünite Sentezi — hazır, kontrol edilmedi' : '3. Ünite Sentezi — henüz hazır değil'}
        />
      )}
      {hasOpenFlag && <RagStageChip stage="warning" label="Açık not var" />}
    </div>
  );
}

function NotebookLmSetupModal({ onClose }: { onClose: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/admin/notebooklm-custom-instructions');
      const data = await res.json().catch(() => null);
      if (!cancelled) {
        setPrompt(data?.prompt || '');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <ModalShell title="NotebookLM Özel Talimatları — Bir Kere Kur" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Bu metni, içerik ürettiğiniz NotebookLM notebook&apos;unda sohbet ayarlarından (dişli ikonu)
          <strong className="text-foreground"> Özel Talimatlar </strong>
          alanına BİR KERE yapıştırın. Bundan sonra o notebook&apos;taki tüm konu/alt başlık üretme
          promptları çok daha kısa olur — kalite kuralları her mesajda tekrar gönderilmez, notebook
          hatırlar. Aynı kitabı kullanan her notebook için ayrı ayrı bir kere yapmanız yeterli.
        </p>
        <PromptCopyBox prompt={prompt} loading={loading} />
        <div className="flex justify-end">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
            Kapat
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// tone, kaynağa göre (NotebookLM/RAG sentez/ortak) hangi araç grubunda olduğunu tek bakışta
// ayırt ettirmek için — kullanıcının 2026-09-17 isteği: "notebook için olanlar bi tarafta,
// sentez için olanlar bi tarafta, ortak olanlar bi tarafta olsa çok daha güzel olmaz mı".
export const TOOL_BUTTON_TONES = {
  neutral: 'border-border bg-surface-elevated text-foreground hover:border-[#6c63ff]/50 hover:bg-[#6c63ff]/10',
  notebooklm: 'border-sky-400/30 bg-sky-400/10 text-sky-700 dark:text-sky-300 hover:bg-sky-400/20',
  // rag = kaynak metnini oluşturup güncel/tekilleştirilmiş tutmak (öğrenci soru-cevap RAG
  // sisteminin veri tabanı); synthesis = o kaynağı ders İÇERİĞİ (alt başlık/soru) üretmek
  // için GİRDİ olarak kullanmak — kullanıcının 2026-09-17 isteği: "rag oluşturma ayrı,
  // sentezden içerik oluşturma ayrı olmalı", ikisi birbirine karıştırılmasın diye ayrı ton.
  rag: 'border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-300 hover:bg-amber-400/20',
  synthesis: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-400/20',
} as const;

export function ToolButton({
  onClick,
  tone = 'neutral',
  disabled = false,
  title,
  children,
}: {
  onClick: () => void;
  tone?: keyof typeof TOOL_BUTTON_TONES;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent ${TOOL_BUTTON_TONES[tone]}`}
    >
      {children}
    </button>
  );
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

  // Aşağıdakiler, ders sayfasında (DersClient.tsx) dağınık duran tüm içerik üretme
  // modallerinin bu sayfaya taşınmasıyla eklendi (kullanıcının 2026-09-17 isteği: "bu sentez
  // sistemi ile içerik oluşturmayı admin panelde ayrı bi menü olarak yapsak" — hem daha ferah
  // bir CMS hem de öğrencinin indirdiği bundle'dan onlarca admin-only state/buton çıkıyor).
  const [sectionMenuOpenId, setSectionMenuOpenId] = useState<number | null>(null);
  const [sectionModalTarget, setSectionModalTarget] = useState<{ section: Section; variant: 'general' | 'notebooklm' | 'synthesis' } | null>(null);
  const [imageModalTarget, setImageModalTarget] = useState<Section | null>(null);
  const [diagramModalTarget, setDiagramModalTarget] = useState<Section | null>(null);
  const [videoModalTarget, setVideoModalTarget] = useState<Section | null>(null);
  const [videoSuggestionsModalTarget, setVideoSuggestionsModalTarget] = useState<Section | null>(null);
  const [questionsModalTarget, setQuestionsModalTarget] = useState<{ section: Section; variant: 'general' | 'notebooklm' | 'classical' | 'classical_notebooklm' } | null>(null);
  const [classicalGenerateTarget, setClassicalGenerateTarget] = useState<{ section: Section | null } | null>(null);
  const [notebookPlanVariant, setNotebookPlanVariant] = useState<'full' | 'content_refresh_notebooklm' | null>(null);
  const [notebookLmSetupOpen, setNotebookLmSetupOpen] = useState(false);
  const [coverImageModalOpen, setCoverImageModalOpen] = useState(false);
  const [highlightsModalOpen, setHighlightsModalOpen] = useState(false);
  const [highlightQuickAddOpen, setHighlightQuickAddOpen] = useState(false);
  const [highlightEditIndex, setHighlightEditIndex] = useState<number | null>(null);
  const [topicSummaryModalOpen, setTopicSummaryModalOpen] = useState(false);
  const [topicQuestionsVariant, setTopicQuestionsVariant] = useState<'general' | 'notebooklm' | 'classical' | 'classical_notebooklm' | null>(null);

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
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">
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
    <div className="rounded-2xl border border-dashed border-[#6c63ff]/40 bg-background p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-[#b5b0ff]">Admin</div>
          <h3 className="text-lg font-black text-foreground">Alt Başlık &amp; İçerik Yönetimi</h3>
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
      <div className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold tracking-[0.14em] uppercase text-muted-foreground">Kazanımlar</span>
            {pacingBadgeText(bundle.pacing) && (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${PACING_COLORS[bundle.pacing!.label as 'ozet' | 'detayli']}`}
                title="Bu konuya MEB müfredatında, ünitenin diğer konularına göre ayrılan süre — içerik üretim promptlarına otomatik yansıtılıyor"
              >
                {pacingBadgeText(bundle.pacing)}
              </span>
            )}
          </div>
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
          <p className="text-xs text-muted-foreground">Bu konu için tanımlı kazanım bulunamadı.</p>
        ) : (
          <ul className="space-y-1.5">
            {bundle.outcomes.map((o) => (
              <li key={o.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono font-bold ${o.code ? 'bg-surface-elevated text-[#b5b0ff]' : 'bg-amber-400/10 text-amber-300'}`}>
                  {o.code || `${o.previewCode}?`}
                </span>
                <span className="flex-1">{o.description}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${o.startWeek == null ? 'bg-amber-400/10 text-amber-300' : 'bg-surface-elevated text-muted-foreground'}`}>
                  {outcomeWeekLabel(o)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Konu geneline ait AI içerik üretim araçları — eskiden ders sayfasında (DersClient)
          dağınık duran tüm bu modaller artık burada, tek yerde. Fonksiyona göre değil KAYNAĞA
          göre gruplandı (NotebookLM / Ortak) — kullanıcının 2026-09-17 isteği. RAG Kaynak +
          Sentezden İçerik grupları buradan kaldırıldı, /admin/ders-notu-rag'daki "Sentezle RAG
          Oluştur" sekmesine taşındı (kullanıcının 2026-09-18 isteği: "rag sistemini artık
          buradan kaldırsak mı" — aynı araçlar iki yerde tekrarlanmasın, tek kanonik yer orası
          olsun). Aşama durumu (RagPipelineStatus) burada bilerek bırakıldı — bir bakışta bu
          konunun RAG'de nerede olduğunu görmek için ayrı sayfaya gitmeye gerek kalmasın. */}
      <div className="mb-5 rounded-xl border border-border bg-card p-4 space-y-3">
        <span className="text-[11px] font-extrabold tracking-[0.14em] uppercase text-muted-foreground block">İçerik Üretim Araçları</span>

        <div>
          <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 block mb-1.5">📘 NotebookLM (Kitap Yüklü Notebook)</span>
          <div className="flex flex-wrap gap-2">
            <ToolButton tone="notebooklm" onClick={() => setNotebookPlanVariant('full')}>Tam Konu Promptu</ToolButton>
            {bundle.sections.length > 0 && (
              <ToolButton tone="notebooklm" onClick={() => setNotebookPlanVariant('content_refresh_notebooklm')}>İçeriği Güncelle</ToolButton>
            )}
            <ToolButton tone="notebooklm" onClick={() => setTopicQuestionsVariant('notebooklm')}>Genel Sorular</ToolButton>
            <ToolButton tone="notebooklm" onClick={() => setTopicQuestionsVariant('classical_notebooklm')}>Açık Uçlu Sorular</ToolButton>
            <ToolButton tone="notebooklm" onClick={() => setNotebookLmSetupOpen(true)}>Özel Talimatları Kur (Bir Kere)</ToolButton>
          </div>
        </div>

        <div>
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block mb-1.5">🗂️ RAG Kaynağı (Kitapsız Ders)</span>
          <div className="mb-2">
            <RagPipelineStatus topicId={topicId} unitId={bundle.unit?.id ?? null} />
          </div>
          <a
            href={`/admin/ders-notu-rag?tab=build&topicId=${topicId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
          >
            RAG Kaynağını Yönet →
          </a>
        </div>

        <div>
          <span className="text-[10px] font-bold text-muted-foreground block mb-1.5">🧩 Ortak / Diğer AI</span>
          <div className="flex flex-wrap gap-2">
            <ToolButton onClick={() => setCoverImageModalOpen(true)}>Konu Kapak Görseli</ToolButton>
            <ToolButton onClick={() => setHighlightsModalOpen(true)}>Anahtar Kavramları Güncelle (AI)</ToolButton>
            <ToolButton onClick={() => setHighlightQuickAddOpen(true)}>Anahtar Kavram Ekle</ToolButton>
            <ToolButton onClick={() => setTopicSummaryModalOpen(true)}>Konu Özetini Düzenle</ToolButton>
            <ToolButton onClick={() => setTopicQuestionsVariant('general')}>Genel Sorular</ToolButton>
            <ToolButton onClick={() => setTopicQuestionsVariant('classical')}>Açık Uçlu Sorular</ToolButton>
            <ToolButton onClick={() => setClassicalGenerateTarget({ section: null })}>Açık Uçlu Soru Üret (AI)</ToolButton>
          </div>
        </div>
      </div>

      {/* Plan oluştur */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] font-extrabold tracking-[0.14em] uppercase text-muted-foreground">Alt Başlıklar</span>
        <button
          onClick={() => setPlanModalOpen(true)}
          disabled={!canCreatePlan}
          title={!canCreatePlan ? 'Önce tüm kazanımlara kod atanmalı' : undefined}
          className="inline-flex items-center gap-2 rounded-xl border border-[#6c63ff] bg-[#6c63ff]/20 px-4 py-2 text-xs font-extrabold text-foreground hover:bg-[#6c63ff]/30 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          {bundle.sections.length ? <RefreshCw className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {bundle.sections.length ? 'Planı Yeniden Oluştur' : 'Alt Başlık Planı Oluştur'}
        </button>
      </div>

      {bundle.sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canCreatePlan
            ? 'Bu konu için henüz alt başlık planı yok. Yukarıdaki butonla 1. prompt’u kopyalayıp AI’a verin, sonucu yapıştırıp kaydedin.'
            : 'Plan oluşturmadan önce yukarıdaki "Eksik Kodları Ata" butonuyla tüm kazanımlara kod atayın.'}
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            AI ile içerik/görsel/video/soru ekleme, aşağıda ilgili alt başlığın yanındaki ⋮ simgesinden yapılıyor.
            Küçük düzeltme veya eklemeler için aşağıda her alt başlığın yanındaki <Pencil className="inline h-3 w-3 align-[-1px]" /> simgesiyle içeriği doğrudan (AI&apos;a gitmeden) düzenleyebilirsiniz.
          </p>
          {/* Ağacın kökü: ana konu */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base leading-none">📘</span>
            <span className="text-sm font-black text-foreground">{bundle.topic.title}</span>
          </div>

          {/* Alt başlıklar: ana konunun altında hiyerarşik dallar */}
          <div className="ml-3 border-l border-border pl-4 space-y-2.5">
            {bundle.sections.map((section, idx) => (
              <div key={section.id} className="relative">
                <span className="absolute -left-4 top-[18px] h-px w-4 bg-border" />
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-elevated px-4 py-3">
                  <div className="h-7 w-7 shrink-0 rounded-lg bg-surface-elevated border border-border flex items-center justify-center text-xs font-black text-muted-foreground mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground truncate">{section.heading}</div>
                    {section.outcomes.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {section.outcomes.map((o) => (
                          <span key={o.id} className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#b5b0ff]" title={o.description}>
                            {o.code}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${STATUS_COLORS[section.status]}`}>
                    {STATUS_LABELS[section.status]}
                  </span>
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setSectionMenuOpenId((cur) => (cur === section.id ? null : section.id))}
                      className="rounded-lg border border-border bg-surface p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="İçerik/medya/soru ekle"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                    {sectionMenuOpenId === section.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setSectionMenuOpenId(null)} />
                        <div className="absolute right-0 top-8 z-50 w-64 rounded-xl border border-border bg-card p-1.5 shadow-lg max-h-[70vh] overflow-y-auto">
                          <span className="block px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-sky-600 dark:text-sky-400">📘 NotebookLM</span>
                          <SectionMenuItem icon={Clipboard} onClick={() => { setSectionMenuOpenId(null); setSectionModalTarget({ section, variant: 'notebooklm' }); }}>İçerik Ekle</SectionMenuItem>
                          <SectionMenuItem icon={ListChecks} onClick={() => { setSectionMenuOpenId(null); setQuestionsModalTarget({ section, variant: 'notebooklm' }); }}>Soru Ekle</SectionMenuItem>
                          <SectionMenuItem icon={ListChecks} onClick={() => { setSectionMenuOpenId(null); setQuestionsModalTarget({ section, variant: 'classical_notebooklm' }); }}>Açık Uçlu Soru Ekle</SectionMenuItem>
                          <span className="block px-2.5 py-1 mt-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">🔍 Sentezden İçerik</span>
                          <SectionMenuItem icon={Clipboard} onClick={() => { setSectionMenuOpenId(null); setSectionModalTarget({ section, variant: 'synthesis' }); }}>İçerik Ekle</SectionMenuItem>
                          <span className="block px-2.5 py-1 mt-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">🧩 Ortak / Diğer AI</span>
                          <SectionMenuItem icon={Clipboard} onClick={() => { setSectionMenuOpenId(null); setSectionModalTarget({ section, variant: 'general' }); }}>İçerik Ekle</SectionMenuItem>
                          <SectionMenuItem icon={ImagePlus} onClick={() => { setSectionMenuOpenId(null); setImageModalTarget(section); }}>Görsel Ekle</SectionMenuItem>
                          <SectionMenuItem icon={Shapes} onClick={() => { setSectionMenuOpenId(null); setDiagramModalTarget(section); }}>Diyagram Ekle</SectionMenuItem>
                          <SectionMenuItem icon={Video} onClick={() => { setSectionMenuOpenId(null); setVideoModalTarget(section); }}>Video Ekle</SectionMenuItem>
                          <SectionMenuItem icon={Youtube} onClick={() => { setSectionMenuOpenId(null); setVideoSuggestionsModalTarget(section); }}>YouTube Önerisi</SectionMenuItem>
                          <SectionMenuItem icon={ListChecks} onClick={() => { setSectionMenuOpenId(null); setQuestionsModalTarget({ section, variant: 'general' }); }}>Soru Ekle</SectionMenuItem>
                          <SectionMenuItem icon={ListChecks} onClick={() => { setSectionMenuOpenId(null); setQuestionsModalTarget({ section, variant: 'classical' }); }}>Açık Uçlu Soru Ekle</SectionMenuItem>
                          <SectionMenuItem icon={Sparkles} onClick={() => { setSectionMenuOpenId(null); setClassicalGenerateTarget({ section }); }}>Açık Uçlu Soru Üret (AI)</SectionMenuItem>
                        </div>
                      </>
                    )}
                  </div>
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

      {notebookPlanVariant === 'full' && (
        <NotebookPlanModal
          topicId={topicId}
          onClose={() => setNotebookPlanVariant(null)}
          onSaved={() => { setNotebookPlanVariant(null); load(); }}
        />
      )}
      {notebookPlanVariant === 'content_refresh_notebooklm' && (
        <NotebookPlanModal
          topicId={topicId}
          promptType="content_refresh_notebooklm"
          title="İçeriği Güncelle (NotebookLM) — Başlıklar Sabit"
          description="Alt başlıklar değişmez, mevcut listeleri prompt'a gömülü gelir; sadece her başlığın içeriği NotebookLM ile yeniden yazılır. Bu promptu NotebookLM'e, kaynak olarak ders kitabının PDF'ini yüklediğiniz notebook'ta sorun. AI çıktısını aşağıya yapıştırıp tek seferde kaydedin — görsel/diyagram/soru bağlantıları korunur."
          defaultAiModel="NotebookLM"
          onClose={() => setNotebookPlanVariant(null)}
          onSaved={() => { setNotebookPlanVariant(null); load(); }}
        />
      )}
      {notebookLmSetupOpen && (
        <NotebookLmSetupModal onClose={() => setNotebookLmSetupOpen(false)} />
      )}

      {coverImageModalOpen && (
        <TopicCoverImageModal topicId={topicId} onClose={() => setCoverImageModalOpen(false)} onSaved={() => { setCoverImageModalOpen(false); load(); }} />
      )}
      {highlightsModalOpen && (
        <TopicHighlightsModal topicId={topicId} onClose={() => setHighlightsModalOpen(false)} onSaved={() => { setHighlightsModalOpen(false); load(); }} />
      )}
      {highlightQuickAddOpen && (
        <TopicHighlightQuickAddModal topicId={topicId} onClose={() => setHighlightQuickAddOpen(false)} onSaved={() => { setHighlightQuickAddOpen(false); load(); }} />
      )}
      {highlightEditIndex != null && (
        <TopicHighlightEditModal topicId={topicId} index={highlightEditIndex} onClose={() => setHighlightEditIndex(null)} onSaved={() => { setHighlightEditIndex(null); load(); }} />
      )}
      {topicSummaryModalOpen && (
        <TopicSummaryEditModal topicId={topicId} onClose={() => setTopicSummaryModalOpen(false)} onSaved={() => { setTopicSummaryModalOpen(false); load(); }} />
      )}

      {topicQuestionsVariant && (
        <TopicQuestionsModal
          topicId={topicId}
          topicTitle={bundle.topic.title}
          variant={topicQuestionsVariant}
          onClose={() => { setTopicQuestionsVariant(null); load(); }}
        />
      )}
      {classicalGenerateTarget && (
        <ClassicalGenerateModal
          topicId={topicId}
          topicTitle={bundle.topic.title}
          section={classicalGenerateTarget.section}
          onClose={() => { setClassicalGenerateTarget(null); load(); }}
        />
      )}

      {sectionModalTarget && (
        <SectionModal
          topicId={topicId}
          section={sectionModalTarget.section}
          variant={sectionModalTarget.variant}
          onClose={() => setSectionModalTarget(null)}
          onSaved={() => { setSectionModalTarget(null); load(); }}
        />
      )}
      {imageModalTarget && (
        <ImageModal
          topicId={topicId}
          section={imageModalTarget}
          onClose={() => setImageModalTarget(null)}
          onSaved={load}
          onImageChanged={load}
        />
      )}
      {diagramModalTarget && (
        <DiagramModal topicId={topicId} section={diagramModalTarget} onClose={() => setDiagramModalTarget(null)} onSaved={load} />
      )}
      {videoModalTarget && (
        <VideoModal topicId={topicId} section={videoModalTarget} onClose={() => setVideoModalTarget(null)} onSaved={load} />
      )}
      {videoSuggestionsModalTarget && (
        <VideoSuggestionsModal topicId={topicId} section={videoSuggestionsModalTarget} onClose={() => setVideoSuggestionsModalTarget(null)} onSaved={load} />
      )}
      {questionsModalTarget && (
        <QuestionsModal
          topicId={topicId}
          section={questionsModalTarget.section}
          variant={questionsModalTarget.variant}
          onClose={() => { setQuestionsModalTarget(null); load(); }}
        />
      )}
    </div>
  );
}

export type EditableSection = {
  id: number;
  heading: string;
  body_markdown: string | null;
  // Eski format — sadece bunu zaten dolu olan (600cd8a'dan önce üretilmiş) konularda
  // düzenleniyor; yeni/aktivite-formatlı konularda activity_* alanları kullanılıyor.
  notebook_markdown: string | null;
  activity_prompt_markdown: string | null;
  activity_example_markdown: string | null;
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
  // Toplu kaydetme (plan/route.ts) başlığı sadece eşleştirme anahtarı olarak kullanır, hiç
  // güncellemez — bu yüzden "AI'ın önerdiği yeni başlığı beğendim ama görsel/diyagram/soruyu
  // kaybetmeden almak istiyorum" (kullanıcının 2026-09-17 sorusu) senaryosunda TEK yol: önce
  // toplu kaydı eski başlıkla eşleştirip kaybetmeden kaydet, sonra buradan başlığı elle
  // yeni haline çevir — id/medya/soru bağlantıları hep aynı satırda kalır.
  const [heading, setHeading] = useState(section.heading);
  const [text, setText] = useState(section.body_markdown || '');
  // Bu bölüm hâlâ eski formattaysa (notebook_markdown dolu, activity_prompt_markdown boş —
  // 600cd8a'dan önce üretilmiş) eski tek-kutu düzenlemeyi koru; aksi halde (yeni format ya
  // da hiç içeriği olmayan bölüm) yeni istem+örnek çiftini düzenlet (kullanıcının 2026-09-17
  // bulduğu tutarsızlık: bu modal hâlâ SADECE eski alanı düzenliyordu).
  const isLegacyNotebook = useMemo(() => !!section.notebook_markdown && !section.activity_prompt_markdown, [section]);
  const [notebookText, setNotebookText] = useState(section.notebook_markdown || '');
  const [activityPromptText, setActivityPromptText] = useState(section.activity_prompt_markdown || '');
  const [activityExampleText, setActivityExampleText] = useState(section.activity_example_markdown || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewHtml = useMemo(() => (text.trim() ? markdownToHtml(text) : ''), [text]);
  const notebookPreviewHtml = useMemo(() => (notebookText.trim() ? markdownToHtml(notebookText) : ''), [notebookText]);
  const activityPromptPreviewHtml = useMemo(() => (activityPromptText.trim() ? markdownToHtml(activityPromptText) : ''), [activityPromptText]);
  const activityExamplePreviewHtml = useMemo(() => (activityExampleText.trim() ? markdownToHtml(activityExampleText) : ''), [activityExampleText]);

  async function handleSave() {
    setError(null);
    if (!heading.trim()) {
      setError('Başlık boş olamaz.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/topic-sections/section/${section.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isLegacyNotebook
            ? {
                heading,
                body_markdown: text,
                notebook_markdown: notebookText,
                needs_image: Boolean(section.image_prompt),
                image_prompt: section.image_prompt,
              }
            : {
                heading,
                body_markdown: text,
                activity_prompt_markdown: activityPromptText,
                activity_example_markdown: activityExampleText,
                needs_image: Boolean(section.image_prompt),
                image_prompt: section.image_prompt,
              }
        ),
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
      <div className="w-full max-w-5xl rounded-2xl border border-border bg-surface-elevated p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-black text-foreground">İçeriği Düzenle</h4>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4">
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground block mb-1.5">Alt Başlık</span>
          <input
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm font-bold text-foreground outline-none focus:border-[#6c63ff]"
          />
          {heading.trim() !== section.heading && (
            <p className="mt-1.5 text-[11px] font-bold text-amber-500">
              Başlığı değiştiriyorsunuz — görsel/diyagram/video/sorular bu satıra (id&apos;ye) bağlı olduğu için kaybolmaz, ama tam konu yeniden üretiminde AI&apos;a artık &quot;{section.heading}&quot; değil bu yeni başlığı vermeniz gerekir (İçeriği Güncelle promptları başlıkları AYNEN kopyalar).
            </p>
          )}
        </div>

        <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
          Küçük düzeltme/eklemeler için metni doğrudan değiştirebilirsiniz. Tasarımın bozulmaması için mevcut biçimi koruyun:
          kalın terim için <code className="text-[#b5b0ff]">**terim**: açıklama</code>, madde için satır başında{' '}
          <code className="text-[#b5b0ff]">- </code>, alt madde için bir kademe içeri{' '}
          <code className="text-[#b5b0ff]">&nbsp;&nbsp;- </code>. Sağdaki önizleme gerçek sayfadaki görünümün birebir aynısıdır.
          <br />
          <strong className="text-foreground">Konu Anlatımı</strong> öğretmenin anlatacağı/öğrencinin okuyacağı akıcı metindir.{' '}
          {isLegacyNotebook ? (
            <>Bu bölüm eski formatta — <strong className="text-foreground">Defterine Not Al</strong>, öğrencinin defterine geçireceği kısa özettir; boş bırakılırsa kutu gösterilmez.</>
          ) : (
            <>
              <strong className="text-foreground">Etkinlik İstemi</strong>, öğrenciyi klavye gerektirmeden düşünmeye zorlayan kısa bir soru
              (&quot;Düşün:/Hayal Et:/Dene:/Sen Olsan?/Karşılaştır:/Günlük Hayattan Bul:&quot; ile başlar); <strong className="text-foreground">Örnek Yaklaşım</strong> ise
              öğrenci &quot;Örneğe Bak&quot;a basınca göreceği kısa cevap — ikisi de boş bırakılırsa kutu gösterilmez.
            </>
          )}
        </p>

        {error && <p className="mb-3 text-xs font-bold text-[#ff6584]">{error}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground block mb-1.5">Konu Anlatımı (Markdown)</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
              />
            </div>
            {isLegacyNotebook ? (
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground block mb-1.5">Defterine Not Al (Markdown, opsiyonel)</span>
                <textarea
                  value={notebookText}
                  onChange={(e) => setNotebookText(e.target.value)}
                  rows={8}
                  placeholder="- Terim: kısa tanım"
                  className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
                />
              </div>
            ) : (
              <>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground block mb-1.5">Etkinlik İstemi (Markdown, opsiyonel)</span>
                  <textarea
                    value={activityPromptText}
                    onChange={(e) => setActivityPromptText(e.target.value)}
                    rows={3}
                    placeholder="Düşün: ..."
                    className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground block mb-1.5">Örnek Yaklaşım (Markdown, opsiyonel)</span>
                  <textarea
                    value={activityExampleText}
                    onChange={(e) => setActivityExampleText(e.target.value)}
                    rows={4}
                    placeholder="Bir yaklaşım: ..."
                    className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
                  />
                </div>
              </>
            )}
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground block mb-1.5">Önizleme</span>
            <div className="rounded-xl border border-border bg-[#f9fafb] p-4 max-h-[560px] overflow-y-auto">
              {previewHtml ? (
                <SectionContent
                  html={previewHtml}
                  notebookHtml={isLegacyNotebook ? (notebookPreviewHtml || null) : null}
                  activityPromptHtml={isLegacyNotebook ? null : (activityPromptPreviewHtml || null)}
                  activityExampleHtml={isLegacyNotebook ? null : (activityExamplePreviewHtml || null)}
                  sectionId={section.id}
                  imageUrl={section.image_url}
                  caption={section.heading}
                  diagramSvg={section.diagram_svg}
                />
              ) : (
                <p className="text-sm text-slate-400 italic">İçerik boş.</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent transition-colors"
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

// Konu sonundaki tek toplu "Konu Özeti" kutusunu (topic_contents.summary_markdown, bkz.
// DersClientCards.tsx TopicSummaryBox) doğrudan düzenlemek için. Ders sayfası (DersClient)
// topicContentId'yi hazır tutmadığından, TopicCoverImageModal/TopicHighlightsModal'daki gibi
// kendi topicContentId'sini topicId üzerinden bundle endpoint'inden çözer.
export function TopicSummaryEditModal({
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

  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingBundle(true);
    setBundleError(null);
    (async () => {
      const res = await fetch(`/api/admin/topic-sections?topicId=${topicId}`);
      const data = await res.json().catch(() => null);
      if (cancelled) return;
      if (!res.ok) {
        setBundleError(data?.error || 'Konu bilgisi yüklenemedi.');
        setLoadingBundle(false);
        return;
      }
      setTopicContentId(data?.topicContent?.id ?? null);
      setText(data?.topicContent?.summary_markdown || '');
      setLoadingBundle(false);
    })();
    return () => { cancelled = true; };
  }, [topicId]);

  const previewHtml = useMemo(() => (text.trim() ? markdownToHtml(text) : ''), [text]);

  async function handleSave() {
    if (!topicContentId) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/topic-sections/topic-content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicContentId, summaryMarkdown: text }),
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
      <div className="w-full max-w-5xl rounded-2xl border border-border bg-surface-elevated p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-black text-foreground">Konu Özetini Düzenle</h4>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loadingBundle ? (
          <p className="text-sm text-muted-foreground">Yükleniyor...</p>
        ) : bundleError ? (
          <p className="text-xs font-bold text-[#ff6584]">{bundleError}</p>
        ) : !topicContentId ? (
          <p className="text-sm text-muted-foreground">Bu konu için henüz içerik oluşturulmamış.</p>
        ) : (
          <>
            <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
              Madde başına tek satır, tam cümle değil — öğrencinin defterine geçireceği kısa özet
              (<code className="text-[#b5b0ff]">**terim**: açıklama</code> veya düz madde). Boş bırakılırsa kutu sayfada
              gösterilmez. Sağdaki önizleme gerçek sayfadaki görünümün birebir aynısıdır.
            </p>

            {error && <p className="mb-3 text-xs font-bold text-[#ff6584]">{error}</p>}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground block mb-1.5">Konu Özeti (Markdown)</span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={14}
                  placeholder="- Terim: kısa tanım"
                  className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground block mb-1.5">Önizleme</span>
                <div className="rounded-xl border border-border bg-[#f9fafb] p-4 max-h-[560px] overflow-y-auto">
                  {previewHtml ? (
                    <TopicSummaryBox summaryHtml={previewHtml} />
                  ) : (
                    <p className="text-sm text-slate-400 italic">Özet boş — kutu sayfada gösterilmeyecek.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent transition-colors"
              >
                Vazgeç
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-[#6c63ff] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </>
        )}
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
    <div className="mb-5 rounded-xl border border-border bg-card p-4">
      <span className="text-[11px] font-extrabold tracking-[0.14em] uppercase text-muted-foreground block mb-3">Kapak Görseli &amp; Anahtar Kavramlar</span>

      <div className="mb-4">
        <span className="text-xs font-bold text-muted-foreground block mb-1.5">Alt Başlık (konu başlığının hemen altında görünür)</span>
        <div className="flex gap-2">
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Örn. Bilgisayarın beyni"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-[#6c63ff] outline-none"
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
        <span className="text-xs font-bold text-muted-foreground block mb-1.5">Kapak Görseli</span>
        {heroImagePrompt && (
          <div className="mb-3">
            <span className="text-[10px] font-bold text-[#6c63ff] block mb-1.5">AI görsel üretim promptu (kopyalayıp bir görsel aracına verin)</span>
            <PromptCopyBox prompt={heroImagePrompt} loading={false} />
          </div>
        )}
        <div className="space-y-3">
          {heroUrl && (
            <div className="flex items-center gap-3">
              <img src={heroUrl} alt="" className="h-20 w-32 rounded-lg object-cover border border-border" />
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
              className="flex-1 text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-elevated file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-foreground"
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
        <span className="text-xs font-bold text-muted-foreground block mb-2">
          Anahtar Kavramlar (opsiyonel — konunun en önemli terimleri ve tanımları)
        </span>
        <div className="space-y-3">
          {concepts.map((c, idx) => (
            <div key={idx} className="rounded-lg border border-border bg-surface-elevated p-3">
              <div className="flex gap-2 mb-2">
                <input
                  value={c.icon}
                  onChange={(e) => updateConcept(idx, 'icon', e.target.value)}
                  placeholder="🧠"
                  maxLength={4}
                  className="w-14 shrink-0 rounded-lg border border-border bg-surface px-2 py-1.5 text-center text-sm text-foreground focus:border-[#6c63ff] outline-none"
                />
                <input
                  value={c.title}
                  onChange={(e) => updateConcept(idx, 'title', e.target.value)}
                  placeholder="Kavram / terim"
                  className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:border-[#6c63ff] outline-none"
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
                className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground resize-none focus:border-[#6c63ff] outline-none"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addConcept}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:border-[#6c63ff]/40 transition-colors"
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
      <div className="w-full max-w-xl rounded-2xl border border-border bg-surface-elevated p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-base font-black text-foreground">{title}</h4>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
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
        <span className="text-xs font-bold text-muted-foreground">Prompt</span>
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
        className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground font-mono resize-none"
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
  const [existingSections, setExistingSections] = useState<ExistingSectionForDiff[]>([]);
  const [checkingDiff, setCheckingDiff] = useState(false);
  // Ayrıştırılan JSON'daki "sections" — normalde direkt kaydedilir, ama en az bir başlık
  // mevcutlarla eşleşmiyorsa (bkz. planHeadingDiff.ts) burada durup admin'e diff'i gösteririz.
  const [reviewSections, setReviewSections] = useState<Record<string, unknown>[] | null>(null);
  const [reviewCover, setReviewCover] = useState<unknown>(undefined);

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

  useEffect(() => {
    fetchExistingSectionsForDiff(topicId).then(setExistingSections);
  }, [topicId]);

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

  async function doSave(sections: unknown, cover: unknown) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/topic-sections/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, sections, cover }),
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

    // Kaydetmeden ÖNCE mevcut başlıklarla karşılaştır — eşleşmeyen varsa (ki bu, o satırın
    // görsel/diyagramının silineceği anlamına gelir) direkt kaydetmek yerine admin'e göster.
    // Bileşen açılışında arka planda çekilen `existingSections` yarış durumuna açık (admin
    // yapıştırıp hemen kaydete basarsa o istek daha bitmemiş olabilir) — o yüzden HER
    // kaydetmeden önce taze bir kopya çekilip kontrol ONUNLA yapılıyor.
    setCheckingDiff(true);
    let freshExisting: ExistingSectionForDiff[];
    try {
      freshExisting = await fetchExistingSectionsForDiff(topicId);
    } finally {
      setCheckingDiff(false);
    }
    setExistingSections(freshExisting);

    const headings = (parsedSections as Record<string, unknown>[]).map((s) => (typeof s.heading === 'string' ? s.heading : ''));
    const diff = computePlanHeadingDiff(freshExisting, headings);
    if (diff.removedSections.length > 0) {
      setReviewSections(parsedSections as Record<string, unknown>[]);
      setReviewCover(parsedCover);
      return;
    }

    doSave(parsedSections, parsedCover);
  }

  function handleReviewHeadingChange(idx: number, value: string) {
    setReviewSections((cur) => {
      if (!cur) return cur;
      const next = [...cur];
      next[idx] = { ...next[idx], heading: value };
      return next;
    });
  }

  const missingCodes = !loadingPrompt && !!error && error.includes('kodu eksik');

  return (
    <ModalShell title="1. Adım: Alt Başlık Planı" onClose={onClose}>
      {reviewSections ? (
        <PlanHeadingDiffReview
          pastedHeadings={reviewSections.map((s) => (typeof s.heading === 'string' ? s.heading : ''))}
          onHeadingChange={handleReviewHeadingChange}
          existingSections={existingSections}
          onBack={() => setReviewSections(null)}
          onConfirm={() => doSave(reviewSections, reviewCover)}
          saving={saving}
        />
      ) : (
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
              <span className="text-xs font-bold text-muted-foreground block mb-2">
                AI&apos;dan gelen JSON sonucu buraya yapıştırın (alt başlıklar + kapak altyazısı tek seferde kaydedilir)
              </span>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={8}
                placeholder='{"sections": [...], "cover": {"subtitle": "..."}}'
                className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
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
              className="text-xs font-bold text-muted-foreground hover:text-[#b5b0ff] transition-colors underline underline-offset-2"
            >
              Kazanım / kapak görseli / anahtar kavramlar yönetimi
            </button>
          ) : <span />}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
              İptal
            </button>
            {!missingCodes && (
              <button
                onClick={handleSave}
                disabled={saving || checkingDiff || !pasted.trim()}
                className="rounded-xl bg-[#6c63ff] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Kaydediliyor...' : checkingDiff ? 'Kontrol ediliyor...' : 'Kaydet'}
              </button>
            )}
          </div>
        </div>
      </div>
      )}
    </ModalShell>
  );
}

type RagAiSource = { id: number; title: string; status: string; createdAt: string; preview: string; aiModel: string | null };

// MEB'in kitap yayınlamadığı dersler için: unit-prompt (RagDocumentsPanel'deki NotebookLM
// akışı) "kitaptan çıkar" diyordu, bu modal ise kazanımlara dayanarak AI'a SIFIRDAN kaynak
// metin yazdırıp aynı /api/admin/rag/documents/from-text ucundan (source='ai_generated',
// topic_id ile) kaydediyor — PlanModal'la aynı iskelet (prompt kopyala → AI'a sor → düz
// metni yapıştır → kaydet), ama çıktı JSON değil düz metin (bkz. 18-rag-topic-source-
// notext.md).
//
// Kapatmadan ART ARDA birden fazla AI'ın çıktısını kaydedebilesin diye (kullanıcının
// istediği akış: "hepsini DB'ye kaydedeceğim, sonra tek tıkla sentez promptuyla vereceğim"
// — 2026-09-10) her kayıttan sonra modal KAPANMIYOR, aynı prompt kalıp textarea temizleniyor
// ve o ana kadar kaydedilmiş taslaklar altta listeleniyor (tek tek silinebilir).
export function RagTopicSourceModal({
  topicId,
  onClose,
  onSaved,
}: {
  topicId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [pasted, setPasted] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<{ topicTitle: string; unitId: number; gradeId: number; lessonId: number } | null>(null);
  const [sources, setSources] = useState<RagAiSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);

  const loadSources = useCallback(async () => {
    setLoadingSources(true);
    const res = await fetch(`/api/admin/rag/topic-ai-sources?topicId=${topicId}`);
    const data = await res.json().catch(() => null);
    if (res.ok) setSources(data?.sources || []);
    setLoadingSources(false);
  }, [topicId]);

  // Prompt (18-rag-topic-source-notext.md), nihai metinden SONRA "---" ile ayrılmış bir
  // satırda AI'ın kendi model adını yazmasını istiyor — RagTopicSourceSynthesisModal'daki
  // "Tutarsızlık Notu" ayıklamasıyla aynı desen. mainText kaydedilir (marker RAG arama
  // havuzuna karışmasın diye), detectedAiModel ise "hangi AI üretti" alanını otomatik
  // doldurur — admin yine de elle düzeltebilir.
  const { mainText, detectedAiModel } = useMemo(() => {
    const idx = pasted.indexOf('\n---');
    if (idx === -1) return { mainText: pasted.trim(), detectedAiModel: '' };
    return { mainText: pasted.slice(0, idx).trim(), detectedAiModel: pasted.slice(idx + 4).trim() };
  }, [pasted]);

  useEffect(() => {
    if (detectedAiModel) setAiModel(detectedAiModel);
  }, [detectedAiModel]);

  useEffect(() => {
    let cancelled = false;
    setLoadingPrompt(true);
    setError(null);
    fetch(`/api/admin/rag/topic-source-prompt?topicId=${topicId}`)
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => null) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) { setError(data?.error || 'Prompt oluşturulamadı.'); return; }
        setPrompt(data?.prompt || '');
        setMeta({ topicTitle: data.topicTitle, unitId: data.unitId, gradeId: data.gradeId, lessonId: data.lessonId });
      })
      .finally(() => { if (!cancelled) setLoadingPrompt(false); });
    loadSources();
    return () => { cancelled = true; };
  }, [topicId, loadSources]);

  async function handleSave() {
    if (!meta) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/rag/documents/from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gradeId: meta.gradeId,
          lessonId: meta.lessonId,
          unitId: meta.unitId,
          topicId,
          title: meta.topicTitle,
          source: 'ai_generated',
          text: mainText,
          aiModel,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Kaydedilemedi.');
        return;
      }
      setPasted('');
      setAiModel('');
      await loadSources();
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: number) {
    await fetch(`/api/admin/rag/topic-ai-sources?id=${id}`, { method: 'DELETE' });
    await loadSources();
  }

  return (
    <ModalShell title="RAG Kaynak Metni (Kitapsız Ders)" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Bu ders için MEB kitabı yok — aşağıdaki prompt, konunun kazanımlarına dayanarak AI&apos;a kaynak metni SIFIRDAN yazdırıyor.
          Dışarıda bir AI&apos;a (ChatGPT, Gemini vb.) sorup dönen düz metni aşağıya yapıştırıp kaydedin — istediğiniz kadar farklı AI ile
          tekrarlayabilirsiniz, modal kapanmaz. Hepsini kaydettikten sonra &quot;RAG Kaynak Metni Sentezle&quot; ile tek metne birleştirin.
        </p>
        <PromptCopyBox prompt={prompt} loading={loadingPrompt} />

        <div>
          <span className="text-xs font-bold text-muted-foreground block mb-2">Bu metni hangi AI üretti? (yapıştırınca prompt'un istediği "---" satırından otomatik alınır, gerekirse düzeltin)</span>
          <input
            list="ai-model-options-rag-source"
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            placeholder="ör. ChatGPT, Gemini, Claude..."
            className="w-full rounded-xl border border-border bg-surface p-2.5 text-xs text-foreground focus:border-[#6c63ff] outline-none"
          />
          <datalist id="ai-model-options-rag-source">
            <option value="ChatGPT" />
            <option value="Gemini" />
            <option value="Claude Sonnet 5" />
            <option value="Claude Opus 5" />
            <option value="Grok" />
            <option value="DeepSeek" />
          </datalist>
        </div>

        <div>
          <span className="text-xs font-bold text-muted-foreground block mb-2">AI&apos;dan gelen düz metni buraya yapıştırın</span>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={8}
            placeholder="AI'ın ürettiği kaynak metni buraya yapıştırın..."
            className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
          />
        </div>

        {error && <p className="text-xs font-bold text-[#ff6584]">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
            Kapat
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !mainText || !aiModel.trim() || !meta}
            title={!aiModel.trim() ? 'Önce hangi AI\'dan geldiğini yazın' : undefined}
            className="rounded-xl bg-[#6c63ff] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet ve Devam Et'}
          </button>
        </div>

        <div className="border-t border-border pt-3">
          <span className="text-xs font-bold text-muted-foreground block mb-2">
            {loadingSources ? 'Kayıtlı taslaklar yükleniyor...' : `Bu konu için kayıtlı taslaklar (${sources.length})`}
          </span>
          {!loadingSources && sources.length === 0 && <p className="text-[11px] text-muted-foreground italic">Henüz taslak kaydedilmedi.</p>}
          <div className="space-y-1.5">
            {sources.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-foreground">{s.aiModel || `Taslak ${i + 1}`}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{s.preview}...</p>
                </div>
                <button
                  onClick={() => handleRemove(s.id)}
                  className="flex-shrink-0 text-[10px] font-bold text-[#ff6584] hover:underline"
                >
                  Kaldır
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// RagTopicSourceModal'ın (18. prompt) DB'ye kaydettiği taslakları (bkz. topic-ai-sources
// route'u) 2-3 farklı AI'dan ayrı ayrı toplayıp tek bir sentez metnine birleştirir (19.
// prompt, ensemble/self-consistency mantığı — bkz. proje sohbeti 2026-09-10). Kaynaklar
// artık elle yapıştırılmıyor — hepsi zaten DB'de, tam prompt sunucuda hazırlanıp tek tıkla
// kopyalanıyor. Sentez kaydedilince (topic-source-synthesis route'u) ham taslaklar otomatik
// silinir — RAG arama havuzunda hem ham hem sentezlenmiş hali birden kalmasın diye. Prompt
// şablonundaki "Tutarsızlık Notu" ("---" sonrası) ayıklanıp admin'e ayrı bir kutuda
// gösteriliyor VE (kullanıcının 2026-09-14 isteği: "hataları düzeltmek için ne yapabiliriz")
// artık kaydedilince rag_topic_review_flags'e de yazılıyor — konu başlığının yanında uyarı
// ikonu olarak sürekli görünür kalsın diye, eskisi gibi modalde bir kerelik gösterilip
// kaybolmasın.
export function RagTopicSourceSynthesisModal({
  topicId,
  onClose,
  onSaved,
}: {
  topicId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftCount, setDraftCount] = useState(0);
  const [drafts, setDrafts] = useState<{ id: number; title: string; createdAt: string; aiModel: string | null }[]>([]);

  const [pasted, setPasted] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ deletedDrafts: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingPrompt(true);
    setLoadError(null);
    fetch(`/api/admin/rag/topic-source-synthesis-prompt?topicId=${topicId}`)
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => null) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) { setLoadError(data?.error || 'Prompt oluşturulamadı.'); return; }
        setPrompt(data?.prompt || '');
        setDraftCount(data?.draftCount || 0);
        setDrafts(data?.drafts || []);
      })
      .finally(() => { if (!cancelled) setLoadingPrompt(false); });
    return () => { cancelled = true; };
  }, [topicId]);

  // Prompt, nihai metinden sonra "---" ile ayrılmış bir "Tutarsızlık Notu" istiyor — bu
  // not sisteme kaydedilmesin diye ayıklanıp admin'e ayrı gösteriliyor.
  const { mainText, consistencyNote } = useMemo(() => {
    const idx = pasted.indexOf('\n---');
    if (idx === -1) return { mainText: pasted.trim(), consistencyNote: null as string | null };
    return { mainText: pasted.slice(0, idx).trim(), consistencyNote: pasted.slice(idx + 4).trim() || null };
  }, [pasted]);

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/rag/topic-source-synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, text: mainText, consistencyNote }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSaveError(data?.error || 'Kaydedilemedi.');
        return;
      }
      setSaved({ deletedDrafts: data?.deletedDrafts || 0 });
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <ModalShell title="RAG Kaynak Metni Sentezle (Çoklu AI)" onClose={() => { onSaved(); onClose(); }}>
        <div className="space-y-3">
          <p className="text-sm font-bold text-emerald-400">✓ Sentez kaydedildi.</p>
          {saved.deletedDrafts > 0 && (
            <p className="text-xs text-muted-foreground">{saved.deletedDrafts} ham taslak silindi — artık sadece bu sentez metni RAG&apos;de aranıyor.</p>
          )}
          <button
            onClick={() => { onSaved(); onClose(); }}
            className="rounded-xl bg-[#6c63ff] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] transition-colors"
          >
            Kapat
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="RAG Kaynak Metni Sentezle (Çoklu AI)" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          &quot;RAG Kaynak Metni&quot; ile kaydettiğin taslaklar aşağıdaki prompt&apos;a otomatik gömülü — kopyala, 4. bir AI&apos;a ver,
          dönen sonucu en alta yapıştır. Kaydedince ham taslaklar silinir, sadece bu sentez metni kalır.
        </p>

        {loadError && <p className="text-xs font-bold text-[#ff6584]">{loadError}</p>}

        {!loadError && (
          <>
            <div>
              <span className="text-xs font-bold text-muted-foreground block mb-1.5">Birleştirilecek taslaklar ({draftCount})</span>
              <div className="space-y-1">
                {drafts.map((d, i) => (
                  <p key={d.id} className="text-[11px] text-muted-foreground">{d.aiModel || `Taslak ${i + 1}`} — {new Date(d.createdAt).toLocaleString('tr-TR')}</p>
                ))}
              </div>
            </div>

            <PromptCopyBox prompt={prompt} loading={loadingPrompt} />

            <div>
              <span className="text-xs font-bold text-muted-foreground block mb-2">Sentez sonucunu (4. AI&apos;dan gelen) buraya yapıştırın</span>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={8}
                placeholder="AI'ın birleştirdiği nihai kaynak metni buraya yapıştırın..."
                className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
              />
            </div>

            {consistencyNote && (
              <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3">
                <p className="text-[11px] font-bold text-amber-300 mb-1">⚠️ Tutarsızlık Notu — kaydedilince konu başlığının yanında uyarı olarak görünecek</p>
                <p className="text-[11px] text-amber-200/90 whitespace-pre-wrap">{consistencyNote}</p>
              </div>
            )}

            {saveError && <p className="text-xs font-bold text-[#ff6584]">{saveError}</p>}
          </>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
            İptal
          </button>
          {!loadError && (
            <button
              onClick={handleSave}
              disabled={saving || !mainText}
              className="rounded-xl bg-[#6c63ff] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

type RagUnitSourceEntry = { topicId: number; topicTitle: string; rawText: string };
type RagUnitSourceEdit = { topicId: number; rawText: string };

// "===KONU: <topic_id>===\n<metin>" bloklarını ayrıştırır (bkz. 26-rag-unit-source-dedup.md).
// JSON değil düz metin biçimi bilinçli tercih — bu promptun kardeşleri (18/19) de aynı
// sebeple (uzun serbest metinde LaTeX/tırnak kaçışlarıyla JSON'un bozulma riski) düz metin
// döndürüyor.
function parseUnitSourceDedupResponse(pasted: string): { edits: RagUnitSourceEdit[]; summary: string | null } {
  const idx = pasted.indexOf('\n---');
  const mainText = (idx === -1 ? pasted : pasted.slice(0, idx)).trim();
  const summary = idx === -1 ? null : pasted.slice(idx + 4).trim() || null;

  const edits: RagUnitSourceEdit[] = [];
  const blockRegex = /===\s*KONU:\s*(\d+)\s*===\s*\n([\s\S]*?)(?=\n===\s*KONU:\s*\d+\s*===|$)/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(mainText)) !== null) {
    const rawText = match[2].trim();
    if (rawText) edits.push({ topicId: Number(match[1]), rawText });
  }
  return { edits, summary };
}

// unit-dedup (topic_content_sections) aracının RAG kaynak metni seviyesindeki karşılığı —
// bkz. unit-source-dedup-prompt/route.ts. topicId, karşılaştırılacak üniteyi bulmak için
// (o konunun unit_id'si) kullanılıyor; kaydetme topic-source-synthesis'le AYNI mekanizmayı
// (insert-yeni + eskiyi sil + yeniden embed) her değişen konu için ayrı ayrı çalıştırıyor.
export function RagUnitSourceDedupModal({
  unitId,
  onClose,
  onSaved,
}: {
  unitId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [includedTopics, setIncludedTopics] = useState<string[]>([]);
  const [skippedTopics, setSkippedTopics] = useState<string[]>([]);
  const [currentByTopicId, setCurrentByTopicId] = useState<Map<number, RagUnitSourceEntry>>(new Map());

  const [pasted, setPasted] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [edits, setEdits] = useState<RagUnitSourceEdit[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<string | null>(null);

  const loadPrompt = useCallback(async () => {
    setLoadingPrompt(true);
    setLoadError(null);
    const res = await fetch(`/api/admin/rag/unit-source-dedup-prompt?unitId=${unitId}`);
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setPrompt(data?.prompt || '');
      setIncludedTopics(data?.includedTopics || []);
      setSkippedTopics(data?.skippedTopics || []);
      const map = new Map<number, RagUnitSourceEntry>();
      for (const s of (data?.currentByTopicId as { topicId: number; topicTitle: string; rawText: string }[] | undefined) || []) {
        map.set(s.topicId, { topicId: s.topicId, topicTitle: s.topicTitle, rawText: s.rawText });
      }
      setCurrentByTopicId(map);
    } else {
      setLoadError(data?.error || 'Prompt oluşturulamadı.');
    }
    setLoadingPrompt(false);
  }, [unitId]);

  useEffect(() => {
    loadPrompt();
  }, [loadPrompt]);

  function handleParse() {
    setParseError(null);
    setApplyError(null);
    setApplyResult(null);
    const { edits: parsed, summary: parsedSummary } = parseUnitSourceDedupResponse(pasted);
    const clean = parsed.filter((e) => currentByTopicId.has(e.topicId));
    setEdits(clean);
    setSelectedIds(new Set(clean.map((e) => e.topicId)));
    setSummary(parsedSummary);
    if (!clean.length) {
      setParseError(
        pasted.includes('TEKRAR YOK')
          ? 'AI tekrar bulmadı — uygulanacak bir düzenleme yok.'
          : 'Metin ayrıştırılamadı ya da topic_id eşleşmedi. "===KONU: <id>===" biçimini kontrol edin.'
      );
    }
  }

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedEdits = useMemo(() => edits.filter((e) => selectedIds.has(e.topicId)), [edits, selectedIds]);

  async function handleApply() {
    if (!selectedEdits.length) return;
    setApplying(true);
    setApplyError(null);
    setApplyResult(null);
    try {
      const res = await fetch('/api/admin/rag/unit-source-dedup-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId,
          edits: selectedEdits.map((e) => ({ topic_id: e.topicId, raw_text: e.rawText })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setApplyError(data?.error || 'Kaydedilemedi.');
        return;
      }
      setApplyResult(`${data.updated} konunun RAG kaynak metni güncellendi.`);
      setEdits([]);
      setSelectedIds(new Set());
      setPasted('');
      setSummary(null);
      onSaved();
    } finally {
      setApplying(false);
    }
  }

  return (
    <ModalShell title="RAG Ünite Sentezi (Tekrar Kontrolü)" onClose={onClose}>
      <div className="space-y-4">
        {loadError ? (
          <p className="text-sm text-[#ff6584]">{loadError}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Ünitedeki, RAG kaynak metni sentezi tamamlanmış TÜM konuları tek promptta karşılaştırıp aralarındaki tekrarı bulduruyor.
              Dışarıda bir AI&apos;a sorun, dönen metni yapıştırıp önce &quot;Analiz Et&quot;e, gözden geçirdikten sonra &quot;Uygula&quot;ya basın.
            </p>
            {includedTopics.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Karşılaştırılan konular: <span className="text-foreground">{includedTopics.join(', ')}</span>
                {skippedTopics.length > 0 && (
                  <>
                    {' '}
                    — RAG sentezi tamamlanmadığı için atlanan: <span className="text-foreground">{skippedTopics.join(', ')}</span>
                  </>
                )}
              </p>
            )}

            {applyResult && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-400">
                ✓ {applyResult}
              </div>
            )}
            {applyError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs font-bold text-red-400">{applyError}</div>
            )}

            <PromptCopyBox prompt={prompt} loading={loadingPrompt} />

            <div>
              <span className="text-xs font-bold text-muted-foreground block mb-2">AI&apos;dan gelen düz metni buraya yapıştırın</span>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={6}
                placeholder="===KONU: 565===..."
                className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              {parseError && <p className="text-xs text-red-400 mt-1">{parseError}</p>}
              <button
                onClick={handleParse}
                disabled={!pasted.trim()}
                className="mt-2 rounded-xl bg-[#6c63ff] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
              >
                Analiz Et
              </button>
            </div>

            {summary && (
              <div className="rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground">
                <span className="font-bold text-foreground">Özet: </span>
                {summary}
              </div>
            )}

            {edits.length > 0 && (
              <div className="space-y-3">
                {edits.map((edit) => {
                  const current = currentByTopicId.get(edit.topicId);
                  const checked = selectedIds.has(edit.topicId);
                  return (
                    <div key={edit.topicId} className="rounded-xl border border-border bg-surface p-3">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelected(edit.topicId)}
                          className="mt-0.5 accent-indigo-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground">{current?.topicTitle}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Eski Kaynak Metin</p>
                              <p className="text-[11px] text-muted-foreground whitespace-pre-wrap line-clamp-6">{current?.rawText || '(boş)'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Yeni Kaynak Metin</p>
                              <p className="text-[11px] text-foreground whitespace-pre-wrap line-clamp-6">{edit.rawText}</p>
                            </div>
                          </div>
                        </div>
                      </label>
                    </div>
                  );
                })}

                <div className="flex justify-end">
                  <button
                    onClick={handleApply}
                    disabled={applying || !selectedEdits.length}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                  >
                    {applying ? 'Uygulanıyor...' : `Seçilenleri Uygula (${selectedEdits.length})`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ModalShell>
  );
}

// "Doğruluk Kontrolü" adımı kaldırıldı (kullanıcının 2026-09-18 isteği: "bu kadar aşamadan
// geçtikten sonra küçük bi kaynaktan bence doğru içerik üretir ai" — taslak+sentez+ünite
// tekilleştirme zaten yeterince güvenilir, NotebookLM akışında da ayrı bir doğrulama yok).
// Ama "Kaynak Metni Sentezle"/"Ünite: Kaynak Tekilleştir" adımlarının bıraktığı tutarsızlık
// notlarını (rag_topic_review_flags) hâlâ görüp çözebilmek gerekiyor — bu hafif bileşen
// sadece onu yapıyor, yeni bir "kontrol" başlatmıyor.
export function RagOpenNotesList({ topicId }: { topicId: number }) {
  const [flags, setFlags] = useState<{ id: number; note: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/rag/topic-review-flags?topicId=${topicId}`);
    const data = await res.json().catch(() => null);
    setFlags((data?.flags as { id: number; note: string; createdAt: string }[] | undefined) || []);
    setLoading(false);
  }, [topicId]);

  useEffect(() => { load(); }, [load]);

  async function handleResolve(id: number) {
    setResolvingId(id);
    try {
      const res = await fetch('/api/admin/rag/topic-review-flags/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setFlags((prev) => prev.filter((f) => f.id !== id));
    } finally {
      setResolvingId(null);
    }
  }

  if (loading || !flags.length) return null;

  return (
    <div className="space-y-2">
      <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" /> Açık Notlar ({flags.length})
      </span>
      {flags.map((f) => (
        <div key={f.id} className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3">
          <p className="text-[11px] text-muted-foreground whitespace-pre-wrap mb-2">{f.note}</p>
          <button
            onClick={() => handleResolve(f.id)}
            disabled={resolvingId === f.id}
            className="rounded-lg border border-emerald-500/40 px-2.5 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
          >
            {resolvingId === f.id ? 'İşaretleniyor...' : 'Çözüldü İşaretle'}
          </button>
        </div>
      ))}
    </div>
  );
}

export function NotebookPlanModal({
  topicId,
  onClose,
  onSaved,
  onManageMore,
  promptType = 'full',
  title = 'Google NotebookLM — Tek Prompt (Alt Başlık + İçerik)',
  // Görsel/video promptu ve kapak görseli/anahtar kavramlar artık BU promptta değil — kendi
  // ayrı, küçük promptlarında üretiliyor (ImageModal/VideoModal/TopicCoverImageModal/
  // TopicHighlightsModal), NotebookLM'in karakter sınırını aşmamak için (kullanıcı isteği,
  // 2026-09-17: "resim diyagram prompları için metni video d aynı şekilde 2. bi prompt
  // olarak ekleyebiliriz").
  description = 'Bu promptu NotebookLM’e, kaynak olarak ders kitabının PDF’ini yüklediğiniz notebook’ta sorun. Alt başlıklar ve her başlığın içeriği TEK seferde JSON olarak gelir; aşağıya yapıştırıp kaydedin. Görsel/video promptu, kapak görseli ve anahtar kavramlar ayrı, kendi butonlarından üretilir.',
  defaultAiModel = 'NotebookLM',
}: {
  topicId: number;
  onClose: () => void;
  onSaved: () => void;
  onManageMore?: () => void;
  // 'full' → NotebookLM/kitap kaynaklı (varsayılan, eski davranış). 'full_from_synthesis'
  // → kitabı olmayan dersler için, RAG'da zaten kullanılan çoklu-AI sentez metnini kaynak
  // alır (bkz. topic-sections/prompt/route.ts, 20-rag-synthesis-full-topic.md). Bu ikisi
  // alt başlıkları da AI'a yeniden ürettirir. 'content_refresh_notebooklm' /
  // 'content_refresh_from_synthesis' ise mevcut alt başlıkları SABİT girdi olarak verir,
  // sadece içeriği yeniden yazdırır — başlık hiç değişmediği için görsel/diyagram/soru
  // kaybetme riski yok (bkz. 23/24-topic-content-refresh-*.md, 2026-09-11 kullanıcı talebi).
  // Kaydetme mantığı (sections JSON, heading eşleştirmeli update) 4'ünde de aynı — component'i
  // çoğaltmak yerine sadece prompt kaynağı/başlık/açıklama parametrize edildi.
  promptType?: 'full' | 'full_from_synthesis' | 'content_refresh_notebooklm' | 'content_refresh_from_synthesis';
  title?: string;
  description?: string;
  defaultAiModel?: string;
}) {
  const [prompt, setPrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [pasted, setPasted] = useState('');
  const [aiModel, setAiModel] = useState(defaultAiModel);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assigningCodes, setAssigningCodes] = useState(false);
  const [existingSections, setExistingSections] = useState<ExistingSectionForDiff[]>([]);
  const [checkingDiff, setCheckingDiff] = useState(false);
  // Ayrıştırılan JSON'daki "sections" — normalde direkt kaydedilir, ama en az bir başlık
  // mevcutlarla eşleşmiyorsa (bkz. planHeadingDiff.ts) burada durup admin'e diff'i gösteririz.
  const [reviewSections, setReviewSections] = useState<Record<string, unknown>[] | null>(null);
  const [reviewCover, setReviewCover] = useState<unknown>(undefined);
  const [reviewSummaryMarkdown, setReviewSummaryMarkdown] = useState<string | undefined>(undefined);
  const [reviewDiscussionPromptMarkdown, setReviewDiscussionPromptMarkdown] = useState<string | undefined>(undefined);

  const loadPrompt = useCallback(async () => {
    setLoadingPrompt(true);
    setError(null);
    const res = await fetch(`/api/admin/topic-sections/prompt?topicId=${topicId}&type=${promptType}`);
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setPrompt(data?.prompt || '');
    } else {
      setError(data?.error || 'Prompt oluşturulamadı.');
    }
    setLoadingPrompt(false);
  }, [topicId, promptType]);

  useEffect(() => {
    loadPrompt();
  }, [loadPrompt]);

  useEffect(() => {
    fetchExistingSectionsForDiff(topicId).then(setExistingSections);
  }, [topicId]);

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

  async function doSave(sections: unknown, cover: unknown, summaryMarkdown?: string, discussionPromptMarkdown?: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/topic-sections/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId,
          sections,
          cover,
          ai_model: aiModel.trim() || null,
          summary_markdown: summaryMarkdown,
          discussion_prompt_markdown: discussionPromptMarkdown,
        }),
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

    const parsedObj = parsed as { sections?: unknown; cover?: unknown; summary_markdown?: unknown; discussion_prompt_markdown?: unknown };
    const parsedSections = parsedObj?.sections;
    if (!Array.isArray(parsedSections) || !parsedSections.length) {
      setError('JSON içinde "sections" listesi bulunamadı.');
      return;
    }
    const parsedCover = parsedObj?.cover && typeof parsedObj.cover === 'object' ? parsedObj.cover : undefined;
    const parsedSummaryMarkdown = typeof parsedObj?.summary_markdown === 'string' ? parsedObj.summary_markdown : undefined;
    const parsedDiscussionPromptMarkdown = typeof parsedObj?.discussion_prompt_markdown === 'string' ? parsedObj.discussion_prompt_markdown : undefined;

    // Kaydetmeden ÖNCE mevcut başlıklarla karşılaştır — eşleşmeyen varsa (ki bu, o satırın
    // görsel/diyagramının silineceği anlamına gelir) direkt kaydetmek yerine admin'e göster.
    // Bileşen açılışında arka planda çekilen `existingSections` yarış durumuna açık (admin
    // yapıştırıp hemen kaydete basarsa o istek daha bitmemiş olabilir) — o yüzden HER
    // kaydetmeden önce taze bir kopya çekilip kontrol ONUNLA yapılıyor.
    setCheckingDiff(true);
    let freshExisting: ExistingSectionForDiff[];
    try {
      freshExisting = await fetchExistingSectionsForDiff(topicId);
    } finally {
      setCheckingDiff(false);
    }
    setExistingSections(freshExisting);

    const headings = (parsedSections as Record<string, unknown>[]).map((s) => (typeof s.heading === 'string' ? s.heading : ''));
    const diff = computePlanHeadingDiff(freshExisting, headings);
    if (diff.removedSections.length > 0) {
      setReviewSections(parsedSections as Record<string, unknown>[]);
      setReviewCover(parsedCover);
      setReviewSummaryMarkdown(parsedSummaryMarkdown);
      setReviewDiscussionPromptMarkdown(parsedDiscussionPromptMarkdown);
      return;
    }

    doSave(parsedSections, parsedCover, parsedSummaryMarkdown, parsedDiscussionPromptMarkdown);
  }

  function handleReviewHeadingChange(idx: number, value: string) {
    setReviewSections((cur) => {
      if (!cur) return cur;
      const next = [...cur];
      next[idx] = { ...next[idx], heading: value };
      return next;
    });
  }

  const missingCodes = !loadingPrompt && !!error && error.includes('kodu eksik');

  return (
    <ModalShell title={title} onClose={onClose}>
      {reviewSections ? (
        <PlanHeadingDiffReview
          pastedHeadings={reviewSections.map((s) => (typeof s.heading === 'string' ? s.heading : ''))}
          onHeadingChange={handleReviewHeadingChange}
          existingSections={existingSections}
          onBack={() => setReviewSections(null)}
          onConfirm={() => doSave(reviewSections, reviewCover, reviewSummaryMarkdown, reviewDiscussionPromptMarkdown)}
          saving={saving}
        />
      ) : (
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
            <p className="text-xs text-muted-foreground">{description}</p>
            <PromptCopyBox prompt={prompt} loading={loadingPrompt} />

            <div>
              <span className="text-xs font-bold text-muted-foreground block mb-2">
                NotebookLM&apos;den gelen JSON sonucu buraya yapıştırın (alt başlıklar + içerik tek seferde kaydedilir)
              </span>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={10}
                placeholder='{"ai_model": "...", "sections": [{"heading": "...", "explanation_markdown": "...", ...}], "cover": {"subtitle": "..."}}'
                className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
              />
            </div>

            <div>
              <span className="text-xs font-bold text-muted-foreground block mb-2">AI modeli (JSON&apos;daki &quot;ai_model&quot;den otomatik alınır, gerekirse düzeltin — boş bırakılırsa Manuel sayılır)</span>
              <input
                list="ai-model-options-notebook"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="ör. NotebookLM"
                className="w-full rounded-xl border border-border bg-surface p-2.5 text-xs text-foreground focus:border-[#6c63ff] outline-none"
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
              className="text-xs font-bold text-muted-foreground hover:text-[#b5b0ff] transition-colors underline underline-offset-2"
            >
              Kazanım / kapak görseli / anahtar kavramlar yönetimi
            </button>
          ) : <span />}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
              İptal
            </button>
            {!missingCodes && (
              <button
                onClick={handleSave}
                disabled={saving || checkingDiff || !pasted.trim()}
                className="rounded-xl bg-[#6c63ff] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Kaydediliyor...' : checkingDiff ? 'Kontrol ediliyor...' : 'Kaydet'}
              </button>
            )}
          </div>
        </div>
      </div>
      )}
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
  video_url?: string | null;
  video_prompt?: string | null;
  video_type?: 'ai_generated' | 'youtube' | null;
};

const MIXED_QUESTIONS_PLACEHOLDER =
  '{"ai_model": "...", "questions": [' +
  '{"type": "multiple_choice", "question_text": "...", "solution_text": "...", "svg_prompt": null, "svg_position": "above", "choices": [{"text": "...", "is_correct": true}, ...]}, ' +
  '{"type": "blank", "question_text": "... _____ ...", "solution_text": "...", "svg_prompt": null, "svg_position": "above", "options": [{"text": "...", "is_correct": true}, ...]}, ' +
  '{"type": "matching", "pairs": [{"left_text": "...", "right_text": "..."}, ...]}' +
  ']}';

const CLASSICAL_QUESTIONS_PLACEHOLDER =
  '{"ai_model": "...", "questions": [' +
  '{"type": "classical", "question_text": "...", "svg_prompt": null, "svg_position": "above", "model_answer": "...", "key_terms": ["...", "..."]}' +
  ']}';

export function QuestionsModal({
  topicId,
  section,
  variant = 'general',
  onClose,
}: {
  topicId: number;
  section: { id: number; heading: string };
  variant?: 'general' | 'notebooklm' | 'classical' | 'classical_notebooklm';
  onClose: () => void;
}) {
  const isNotebook = variant === 'notebooklm' || variant === 'classical_notebooklm';
  const isClassical = variant === 'classical' || variant === 'classical_notebooklm';
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
    const promptType = isNotebook && isClassical ? 'classical_questions_notebooklm' : isNotebook ? 'questions_notebooklm' : isClassical ? 'classical_questions' : 'mixed_questions';
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
  }, [topicId, section.id, isNotebook, isClassical]);

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
    <ModalShell title={`${isClassical ? 'Açık Uçlu Soru Ekle' : 'Soru Ekle'}${isNotebook ? ' (NotebookLM)' : ''} — ${section.heading}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {isNotebook && isClassical
            ? 'Bu promptu NotebookLM\'e, kaynak olarak ders kitabının PDF\'ini yüklediğiniz notebook\'ta sorun. Klasik/açık uçlu (öğrencinin yazarak cevapladığı) 3-6 soru, kitaba dayanarak ve cevap anahtarıyla birlikte üretilir — özet ders notuna değil doğrudan kitaba bağlı kalır. AI çıktısını aşağıya yapıştırıp tek seferde kaydedin.'
            : isNotebook
            ? 'Bu promptu NotebookLM\'e, kaynak olarak ders kitabının PDF\'ini yüklediğiniz notebook\'ta sorun. Çoktan seçmeli, boşluk doldurma ve eşleştirme karışık 3-7 soru kitaba dayanarak üretilir; AI çıktısını aşağıya yapıştırıp tek seferde kaydedin.'
            : isClassical
            ? 'Tek promptla klasik/açık uçlu (öğrencinin yazarak cevapladığı) 3-6 soru, cevap anahtarıyla birlikte üretilir; AI çıktısını aşağıya yapıştırıp tek seferde kaydedin.'
            : 'Tek promptla çoktan seçmeli, boşluk doldurma ve eşleştirme karışık 3-7 soru üretilir; AI çıktısını aşağıya yapıştırıp tek seferde kaydedin.'}
        </p>

        {promptError ? (
          <p className="text-xs font-bold text-[#ff6584]">{promptError}</p>
        ) : (
          <PromptCopyBox prompt={prompt} loading={loadingPrompt} />
        )}

        <div>
          <span className="text-xs font-bold text-muted-foreground block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={12}
            placeholder={isClassical ? CLASSICAL_QUESTIONS_PLACEHOLDER : MIXED_QUESTIONS_PLACEHOLDER}
            className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
          />
        </div>

        <div>
          <span className="text-xs font-bold text-muted-foreground block mb-2">AI modeli (JSON&apos;daki &quot;ai_model&quot;den otomatik alınır, gerekirse düzeltin — boş bırakılırsa Manuel sayılır)</span>
          <input
            list={isNotebook ? 'ai-model-options-notebook-questions' : 'ai-model-options-questions'}
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            placeholder={isNotebook ? 'ör. NotebookLM' : 'ör. Claude Sonnet 5'}
            className="w-full rounded-xl border border-border bg-surface p-2.5 text-xs text-foreground focus:border-[#6c63ff] outline-none"
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
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
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
  variant?: 'general' | 'notebooklm' | 'synthesis';
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNotebook = variant === 'notebooklm';
  const isSynthesis = variant === 'synthesis';
  const [prompt, setPrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [pasted, setPasted] = useState('');
  const [aiModel, setAiModel] = useState(isNotebook ? 'NotebookLM' : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const promptType = isSynthesis ? 'section_from_synthesis' : isNotebook ? 'section_notebooklm' : 'section';
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
  }, [topicId, section.id, isNotebook, isSynthesis]);

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

    // explanation_markdown yeni şema; body_markdown eski (tek alanlı) şablonlardan kalma
    // önbelleklenmiş prompt'lar için geriye dönük uyumluluk. Aynı şekilde activity_prompt/
    // example yeni şema, notebook_markdown eski önbelleklenmiş promptlar için (kullanıcının
    // 2026-09-17 bulduğu tutarsızlık: bu akış hâlâ SADECE eski alanı kaydediyordu).
    const obj = parsed as {
      explanation_markdown?: unknown; body_markdown?: unknown;
      activity_prompt_markdown?: unknown; activity_example_markdown?: unknown; notebook_markdown?: unknown;
    };
    const explanationMarkdown = typeof obj.explanation_markdown === 'string' && obj.explanation_markdown.trim()
      ? obj.explanation_markdown
      : typeof obj.body_markdown === 'string' ? obj.body_markdown : '';
    if (!explanationMarkdown.trim()) {
      setError('JSON içinde "explanation_markdown" alanı bulunamadı.');
      return;
    }
    const hasNewActivityFields = typeof obj.activity_prompt_markdown === 'string' || typeof obj.activity_example_markdown === 'string';

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/topic-sections/section/${section.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body_markdown: explanationMarkdown,
          ...(hasNewActivityFields
            ? {
                activity_prompt_markdown: typeof obj.activity_prompt_markdown === 'string' ? obj.activity_prompt_markdown : '',
                activity_example_markdown: typeof obj.activity_example_markdown === 'string' ? obj.activity_example_markdown : '',
              }
            : { notebook_markdown: typeof obj.notebook_markdown === 'string' ? obj.notebook_markdown : '' }),
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
    <ModalShell title={`İçerik Ekle${isNotebook ? ' (NotebookLM)' : isSynthesis ? ' (Sentezden)' : ''} — ${section.heading}`} onClose={onClose}>
      <div className="space-y-4">
        {isNotebook && (
          <p className="text-xs text-muted-foreground">
            Bu promptu NotebookLM&apos;e, kaynak olarak ders kitabının PDF&apos;ini yüklediğiniz notebook&apos;ta sorun; içerik kitaba dayanarak üretilir.
          </p>
        )}
        {isSynthesis && (
          <p className="text-xs text-muted-foreground">
            Kitapsız ders — bu promptu ChatGPT, Claude, Gemini gibi kitap yüklemediğiniz bir AI&apos;a sorun. İçerik, RAG için zaten sentezlenmiş
            çoklu-AI kaynak metnine dayanarak SADECE bu alt başlık için üretilir. Diğer alt başlıklara, görsel/diyagram/sorularına dokunmaz —
            görsel/diyagram/soru kaybetme riski olmadan tek bir alt başlığı yeniden üretmek için en güvenli yoldur.
          </p>
        )}

        <PromptCopyBox prompt={prompt} loading={loadingPrompt} />

        <div>
          <span className="text-xs font-bold text-muted-foreground block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={8}
            placeholder='{"explanation_markdown": "...", "activity_prompt_markdown": "...", "activity_example_markdown": "...", "ai_model": "..."}'
            className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
          />
        </div>

        <div>
          <span className="text-xs font-bold text-muted-foreground block mb-2">AI modeli (JSON&apos;daki &quot;ai_model&quot;den otomatik alınır, gerekirse düzeltin — boş bırakılırsa Manuel sayılır)</span>
          <input
            list={isNotebook ? 'ai-model-options-notebook-section' : 'ai-model-options'}
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            placeholder={isNotebook ? 'ör. NotebookLM' : 'ör. Claude Sonnet 5'}
            className="w-full rounded-xl border border-border bg-surface p-2.5 text-xs text-foreground focus:border-[#6c63ff] outline-none"
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
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
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

  if (loading) return <p className="text-xs text-muted-foreground">Galeri yükleniyor...</p>;
  if (error) return <p className="text-xs font-bold text-[#ff6584]">{error}</p>;
  if (!items.length) return <p className="text-xs text-muted-foreground">Bu ünitede henüz başka görsel yok.</p>;

  return (
    <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
      {items.map((item) => (
        <div key={item.path} className="relative group">
          <button
            type="button"
            onClick={() => onSelect(item.path)}
            className="block w-full aspect-square overflow-hidden rounded-lg border border-border hover:border-[#6c63ff] transition-colors"
            title={item.inUse ? 'Kullanımda' : 'Kullanılmıyor'}
          >
            <img src={item.url} alt="" className="h-full w-full object-cover" />
          </button>
          {item.inUse && (
            <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-bold text-muted-foreground">
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
        <p className="text-xs text-muted-foreground">
          Önce bu promptu bir AI&apos;a sorun; hem görsel üretim promptunu hem de görselin kısa Türkçe alt metnini (SEO/erişilebilirlik için) JSON olarak üretir. Ardından AI&apos;dan gelen JSON&apos;u aşağıya yapıştırıp kaydedin — &quot;görselde yazı varsa Türkçe olsun&quot; kuralı image_prompt&apos;un sonuna otomatik eklenir. Son olarak hazır promptu bir görsel üretim aracına verip görseli yükleyin.
        </p>

        {metaPromptError ? (
          <p className="text-xs font-bold text-[#ff6584]">{metaPromptError}</p>
        ) : (
          <PromptCopyBox prompt={metaPrompt} loading={loadingMetaPrompt} />
        )}

        <div>
          <span className="text-xs font-bold text-muted-foreground block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
          <textarea
            value={rawPrompt}
            onChange={(e) => setRawPrompt(e.target.value)}
            rows={5}
            placeholder='{"image_prompt": "A clean, educational illustration of ...", "alt_text": "..."}'
            className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
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
          <p className="text-xs text-muted-foreground">
            <span className="font-bold text-[#6c63ff]">Alt metin:</span> {savedImageAlt}
          </p>
        )}

        <div className="border-t border-border pt-4 space-y-3">
          <span className="text-xs font-bold text-muted-foreground block">Görsel Dosyası</span>

          {imageUrl && (
            <div className="flex items-center gap-3">
              <img src={imageUrl} alt="" className="h-20 w-20 rounded-lg object-cover border border-border" />
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
              className="flex-1 text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-elevated file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-foreground"
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
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
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
        <p className="text-xs text-muted-foreground">
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
          <span className="text-xs font-bold text-muted-foreground block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
          <textarea
            value={rawPrompt}
            onChange={(e) => setRawPrompt(e.target.value)}
            rows={6}
            placeholder='{"diagram_svg": "<svg viewBox=\"0 0 300 160\">...</svg>"}'
            className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
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
          <div className="border-t border-border pt-4">
            <span className="text-xs font-bold text-muted-foreground block mb-2">Kayıtlı diyagram</span>
            <div
              className="rounded-lg border border-border bg-white p-3 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-xs"
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
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
            Kapat
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// Görsel/diyagram akışlarıyla AYNI iskelet: AI'a bir prompt verilir, dönen JSON yapıştırılıp
// kaydedilir. Farkı: video dosyası burada YÜKLENMİYOR (Vercel Functions'ın ~4.5MB istek gövdesi
// limiti kısa bir video için bile yetersiz, bkz. section/[sectionId]/video/route.ts) — admin,
// AI video üretim modeline (ör. Veo) verip ürettiği videoyu harici bir yerde barındırıp sadece
// URL'sini buraya yapıştırıyor (kullanıcının 2026-09-16 isteği).
export function VideoModal({
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
  const [savedVideoPrompt, setSavedVideoPrompt] = useState<string | null>(section.video_prompt ?? null);
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [notWorthIt, setNotWorthIt] = useState(false);

  const [videoUrl, setVideoUrl] = useState<string | null>(section.video_url ?? null);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingMetaPrompt(true);
    setMetaPromptError(null);
    (async () => {
      const res = await fetch(`/api/admin/topic-sections/prompt?topicId=${topicId}&sectionId=${section.id}&type=video`);
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
    setNotWorthIt(false);
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
    const obj = parsed as { worth_it?: unknown; video_prompt?: unknown };
    if (obj.worth_it === false) {
      setNotWorthIt(true);
      setRawPrompt('');
      return;
    }
    if (typeof obj.video_prompt !== 'string' || !obj.video_prompt.trim()) {
      setPromptError('JSON içinde "video_prompt" alanı bulunamadı.');
      return;
    }
    setPromptSaving(true);
    try {
      const res = await fetch(`/api/admin/topic-sections/section/${section.id}/video`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_prompt: obj.video_prompt.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setPromptError(data?.error || 'Kaydedilemedi.');
        return;
      }
      setSavedVideoPrompt(obj.video_prompt.trim());
      setRawPrompt('');
      onSaved();
    } finally {
      setPromptSaving(false);
    }
  }

  async function handleAttachVideo() {
    if (!videoUrlInput.trim()) return;
    setVideoBusy(true);
    setVideoError(null);
    try {
      const res = await fetch(`/api/admin/topic-sections/section/${section.id}/video`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: videoUrlInput.trim(), video_type: 'ai_generated' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setVideoError(data?.error || 'Kaydedilemedi.');
        return;
      }
      setVideoUrl(videoUrlInput.trim());
      setVideoUrlInput('');
      onSaved();
    } finally {
      setVideoBusy(false);
    }
  }

  async function handleRemoveVideo() {
    if (!confirm('Videoyu bu bölümden kaldırmak istediğinize emin misiniz?')) return;
    setVideoBusy(true);
    setVideoError(null);
    try {
      const res = await fetch(`/api/admin/topic-sections/section/${section.id}/video`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setVideoError(data?.error || 'Silinemedi.');
        return;
      }
      setVideoUrl(null);
      onSaved();
    } finally {
      setVideoBusy(false);
    }
  }

  return (
    <ModalShell title={`Video Ekle — ${section.heading}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Önce bu promptu bir AI&apos;a sorun — bu alt başlık için kısa bir videonun gerçekten
          anlamlı olup olmadığına AI karar verir (çoğu alt başlıkta OLMAZ). Anlamlıysa dönen
          video_prompt&apos;u kopyalayıp bir video üretim aracına (ör. Google Veo) verin, üretilen
          videoyu harici bir yerde barındırıp URL&apos;sini en altta yapıştırın.
        </p>

        {metaPromptError ? (
          <p className="text-xs font-bold text-[#ff6584]">{metaPromptError}</p>
        ) : (
          <PromptCopyBox prompt={metaPrompt} loading={loadingMetaPrompt} />
        )}

        <div>
          <span className="text-xs font-bold text-muted-foreground block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
          <textarea
            value={rawPrompt}
            onChange={(e) => setRawPrompt(e.target.value)}
            rows={5}
            placeholder='{"worth_it": true, "video_prompt": "A glass of water freezing...", "caption": "..."}'
            className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
          />
          <button
            type="button"
            onClick={handleSavePrompt}
            disabled={promptSaving || !rawPrompt.trim()}
            className="mt-2 rounded-lg bg-[#6c63ff] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
          >
            {promptSaving ? 'Kaydediliyor...' : 'Promptu Kaydet'}
          </button>
          {notWorthIt && <p className="mt-2 text-xs font-bold text-amber-500">AI, bu alt başlık için videoyu anlamlı bulmadı — kaydedilecek bir şey yok.</p>}
          {promptError && <p className="mt-2 text-xs font-bold text-[#ff6584]">{promptError}</p>}
        </div>

        {savedVideoPrompt && (
          <div>
            <span className="text-[10px] font-bold text-[#6c63ff] block mb-1.5">AI video üretim promptu (kopyalayıp bir video aracına verin)</span>
            <PromptCopyBox prompt={savedVideoPrompt} loading={false} />
          </div>
        )}

        <div className="border-t border-border pt-4 space-y-3">
          <span className="text-xs font-bold text-muted-foreground block">Video URL&apos;si</span>

          {videoUrl && (
            <div className="flex items-center gap-3">
              <video src={videoUrl} className="h-20 w-32 rounded-lg border border-border object-cover" muted />
              <button
                type="button"
                onClick={handleRemoveVideo}
                disabled={videoBusy}
                className="rounded-lg border border-[#ff6584]/30 bg-[#ff6584]/10 px-3 py-1.5 text-xs font-bold text-[#ff6584] hover:bg-[#ff6584]/20 disabled:opacity-50 transition-colors"
              >
                {videoBusy ? 'İşleniyor...' : 'Bu Bölümden Kaldır'}
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="url"
              value={videoUrlInput}
              onChange={(e) => setVideoUrlInput(e.target.value)}
              placeholder="https://..."
              className="flex-1 rounded-xl border border-border bg-surface p-2.5 text-xs text-foreground focus:border-[#6c63ff] outline-none"
            />
            <button
              type="button"
              onClick={handleAttachVideo}
              disabled={!videoUrlInput.trim() || videoBusy}
              className="shrink-0 rounded-lg bg-[#6c63ff] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
            >
              {videoBusy ? 'Kaydediliyor...' : 'Videoyu Bağla'}
            </button>
          </div>

          {videoError && <p className="text-xs font-bold text-[#ff6584]">{videoError}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
            Kapat
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// YouTube video önerileri — RAG kaynak taslakları ile AYNI desen: farklı AI'lardan (web
// arama/browsing yetenekli) gelen öneriler BİRİKİYOR, hiçbiri silinmiyor. Admin listeyi
// inceleyip birini "Onayla"yınca o önerinin video_url'i bu bölümün asıl video_url'ine
// kopyalanıyor (kullanıcının 2026-09-16 isteği: "ben youtube'dan aramak yerine bu önerileri
// inceleyip onay vereceğim").
type VideoSuggestion = { id: number; video_url: string; video_title: string | null; note: string | null; ai_model: string | null; created_at: string };

export function VideoSuggestionsModal({
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [suggestions, setSuggestions] = useState<VideoSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [approvedUrl, setApprovedUrl] = useState<string | null>(
    section.video_type === 'youtube' ? section.video_url ?? null : null
  );
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    const res = await fetch(`/api/admin/topic-sections/section/${section.id}/video-suggestions`);
    const data = await res.json().catch(() => null);
    if (res.ok) setSuggestions(data?.suggestions || []);
    setLoadingSuggestions(false);
  }, [section.id]);

  useEffect(() => {
    let cancelled = false;
    setLoadingMetaPrompt(true);
    setMetaPromptError(null);
    (async () => {
      const res = await fetch(`/api/admin/topic-sections/prompt?topicId=${topicId}&sectionId=${section.id}&type=video_suggestion`);
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

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  async function handleAddSuggestion() {
    setError(null);
    setNotFound(false);
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
    const obj = parsed as { found?: unknown; video_url?: unknown; video_title?: unknown; reasoning?: unknown; ai_model?: unknown };
    if (obj.found === false) {
      setNotFound(true);
      setRawPrompt('');
      return;
    }
    if (typeof obj.video_url !== 'string' || !obj.video_url.trim()) {
      setError('JSON içinde "video_url" alanı bulunamadı.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/topic-sections/section/${section.id}/video-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: obj.video_url.trim(),
          video_title: typeof obj.video_title === 'string' ? obj.video_title.trim() : undefined,
          note: typeof obj.reasoning === 'string' ? obj.reasoning.trim() : undefined,
          ai_model: typeof obj.ai_model === 'string' ? obj.ai_model.trim() : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Kaydedilemedi.');
        return;
      }
      setRawPrompt('');
      await loadSuggestions();
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(suggestion: VideoSuggestion) {
    setBusyId(suggestion.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/topic-sections/section/${section.id}/video`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: suggestion.video_url, video_type: 'youtube' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Onaylanamadı.');
        return;
      }
      setApprovedUrl(suggestion.video_url);
      onSaved();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemoveSuggestion(id: number) {
    if (!confirm('Bu öneriyi kalıcı olarak silmek istediğinize emin misiniz?')) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/topic-sections/video-suggestions/${id}`, { method: 'DELETE' });
      if (res.ok) setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ModalShell title={`YouTube Video Önerisi — ${section.heading}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Bu promptu web arama/browsing yeteneği olan farklı AI&apos;lara (ör. Gemini, ChatGPT,
          Perplexity) sorup dönen sonuçları tek tek buraya yapıştırın — her ekleme öncekileri
          SİLMEZ, listeye eklenir. Aşağıdaki listeyi inceleyip beğendiğiniz videoyu
          &quot;Onayla&quot;yın.
        </p>

        {metaPromptError ? (
          <p className="text-xs font-bold text-[#ff6584]">{metaPromptError}</p>
        ) : (
          <PromptCopyBox prompt={metaPrompt} loading={loadingMetaPrompt} />
        )}

        <div>
          <span className="text-xs font-bold text-muted-foreground block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
          <textarea
            value={rawPrompt}
            onChange={(e) => setRawPrompt(e.target.value)}
            rows={5}
            placeholder='{"found": true, "video_url": "https://www.youtube.com/watch?v=...", "video_title": "...", "reasoning": "...", "ai_model": "Gemini 3 Pro"}'
            className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
          />
          <button
            type="button"
            onClick={handleAddSuggestion}
            disabled={saving || !rawPrompt.trim()}
            className="mt-2 rounded-lg bg-[#6c63ff] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Ekleniyor...' : 'Öneriyi Ekle'}
          </button>
          {notFound && <p className="mt-2 text-xs font-bold text-amber-500">AI, gerçek/doğrulanmış bir video bulamadı — eklenecek bir şey yok.</p>}
          {error && <p className="mt-2 text-xs font-bold text-[#ff6584]">{error}</p>}
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          <span className="text-xs font-bold text-muted-foreground block">Biriken öneriler</span>
          {loadingSuggestions ? (
            <p className="text-xs text-muted-foreground">Yükleniyor...</p>
          ) : !suggestions.length ? (
            <p className="text-xs text-muted-foreground">Henüz öneri eklenmedi.</p>
          ) : (
            <div className="space-y-2">
              {suggestions.map((s) => {
                const isApproved = approvedUrl === s.video_url;
                return (
                  <div key={s.id} className={`rounded-xl border p-3 ${isApproved ? 'border-emerald-400 bg-emerald-400/10' : 'border-border bg-surface'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <a href={s.video_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#6c63ff] hover:underline break-all">
                          {s.video_title || s.video_url}
                        </a>
                        {s.note && <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>}
                        <p className="mt-1 text-[10px] font-bold text-muted-foreground">{s.ai_model || 'Bilinmiyor'}</p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        {isApproved ? (
                          <span className="rounded-lg bg-emerald-400/20 px-2.5 py-1.5 text-[10px] font-extrabold text-emerald-600">Onaylandı</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApprove(s)}
                            disabled={busyId === s.id}
                            className="rounded-lg bg-[#6c63ff] px-2.5 py-1.5 text-[10px] font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
                          >
                            Onayla
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveSuggestion(s.id)}
                          disabled={busyId === s.id}
                          className="rounded-lg border border-[#ff6584]/30 bg-[#ff6584]/10 p-1.5 text-[#ff6584] hover:bg-[#ff6584]/20 disabled:opacity-50 transition-colors"
                          title="Kaldır"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
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
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      ) : bundleError ? (
        <p className="text-xs font-bold text-[#ff6584]">{bundleError}</p>
      ) : !topicContentId ? (
        <p className="text-sm text-muted-foreground">
          Önce bu konu için alt başlık planı oluşturulmalı (sidebar&apos;daki &quot;Alt Başlık Planı Prompt&apos;u&quot; ile).
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Önce bu promptu bir AI&apos;a sorun; hem görsel üretim promptunu hem de görselin kısa Türkçe alt metnini (SEO/erişilebilirlik için) JSON olarak üretir. Ardından AI&apos;dan gelen JSON&apos;u aşağıya yapıştırıp kaydedin — &quot;görselde yazı varsa Türkçe olsun&quot; kuralı image_prompt&apos;un sonuna otomatik eklenir. Son olarak hazır promptu bir görsel üretim aracına verip görseli yükleyin.
          </p>

          {metaPromptError ? (
            <p className="text-xs font-bold text-[#ff6584]">{metaPromptError}</p>
          ) : (
            <PromptCopyBox prompt={metaPrompt} loading={loadingMetaPrompt} />
          )}

          <div>
            <span className="text-xs font-bold text-muted-foreground block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
            <textarea
              value={rawPrompt}
              onChange={(e) => setRawPrompt(e.target.value)}
              rows={5}
              placeholder='{"image_prompt": "A clean, educational illustration of ...", "alt_text": "..."}'
              className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
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
            <p className="text-xs text-muted-foreground">
              <span className="font-bold text-[#6c63ff]">Alt metin:</span> {savedAlt}
            </p>
          )}

          <div className="border-t border-border pt-4 space-y-3">
            <span className="text-xs font-bold text-muted-foreground block">Görsel Dosyası</span>

            {heroUrl && (
              <div className="flex items-center gap-3">
                <img src={heroUrl} alt="" className="h-20 w-32 rounded-lg object-cover border border-border" />
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
                className="flex-1 text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-elevated file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-foreground"
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
            <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
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
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      ) : bundleError ? (
        <p className="text-xs font-bold text-[#ff6584]">{bundleError}</p>
      ) : !topicContentId ? (
        <p className="text-sm text-muted-foreground">
          Önce bu konu için alt başlık planı oluşturulmalı (sidebar&apos;daki &quot;Alt Başlık Planı Prompt&apos;u&quot; ile).
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Bu prompt SADECE anahtar kavramları üretir; konunun diğer alanlarına (alt başlık, ders notu, kapak görseli) dokunmadan sadece bu listeyi günceller. AI çıktısını aşağıya yapıştırıp kaydedin — mevcut kavramların yerine geçer.
          </p>

          {promptError ? (
            <p className="text-xs font-bold text-[#ff6584]">{promptError}</p>
          ) : (
            <PromptCopyBox prompt={prompt} loading={loadingPrompt} />
          )}

          <div>
            <span className="text-xs font-bold text-muted-foreground block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={10}
              placeholder='{"highlights": [{"icon": "🧠", "title": "...", "description": "..."}]}'
              className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
            />
          </div>

          {error && <p className="text-xs font-bold text-[#ff6584]">{error}</p>}
          {savedCount != null && <p className="text-xs font-bold text-emerald-400">{savedCount} kavram kaydedildi.</p>}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
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
  variant?: 'general' | 'notebooklm' | 'classical' | 'classical_notebooklm' | 'rag_synthesis' | 'classical_rag_synthesis';
  onClose: () => void;
}) {
  const isNotebook = variant === 'notebooklm' || variant === 'classical_notebooklm';
  const isClassical = variant === 'classical' || variant === 'classical_notebooklm' || variant === 'classical_rag_synthesis';
  const isRagSynthesis = variant === 'rag_synthesis' || variant === 'classical_rag_synthesis';
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
    const promptType = isRagSynthesis && isClassical
      ? 'topic_questions_classical_from_synthesis'
      : isRagSynthesis
      ? 'topic_questions_from_synthesis'
      : isNotebook && isClassical
      ? 'topic_questions_classical_notebooklm'
      : isNotebook
      ? 'topic_questions'
      : isClassical
      ? 'topic_questions_classical'
      : 'topic_questions_mixed';
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
  }, [topicId, isNotebook, isClassical, isRagSynthesis]);

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
    <ModalShell title={`${isClassical ? 'Açık Uçlu Sorular (Ünite Testi)' : 'Genel Sorular (Ünite Testi)'}${isNotebook ? '' : isRagSynthesis ? ' — RAG Sentezi' : ' — Diğer AI'} — ${topicTitle}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {isRagSynthesis && isClassical
            ? 'Kitapsız ders — konunun tüm alt başlıklarını kapsayan, RAG için zaten sentezlenmiş çoklu-AI kaynak metnine dayanan 6-10 klasik/açık uçlu sentez sorusu, cevap anahtarıyla birlikte üretilir. Dışarıda bir AI\'a (ör. Claude) sorup dönen JSON\'u aşağıya yapıştırıp tek seferde kaydedin.'
            : isRagSynthesis
            ? 'Kitapsız ders — konunun tüm alt başlıklarını kapsayan, RAG için zaten sentezlenmiş çoklu-AI kaynak metnine dayanan 10-15 genel/sentez sorusu üretilir; bunlar ünite testinde alt başlık sorularıyla birlikte gösterilir. Dışarıda bir AI\'a (ör. Claude) sorup dönen JSON\'u aşağıya yapıştırıp tek seferde kaydedin.'
            : isNotebook && isClassical
            ? 'Bu promptu NotebookLM\'e, kaynak olarak ders kitabının PDF\'ini yüklediğiniz notebook\'ta sorun. Tek bir alt başlığa değil konunun bütününe bakan, en az iki alt başlığı birleştiren/karşılaştıran 6-10 klasik/açık uçlu sentez sorusu, kitaba dayanarak ve cevap anahtarıyla birlikte üretilir. AI çıktısını aşağıya yapıştırıp tek seferde kaydedin.'
            : isNotebook
            ? 'Bu promptu NotebookLM\'e, kaynak olarak ders kitabının PDF\'ini yüklediğiniz notebook\'ta sorun. Tek bir alt başlığa değil konunun bütününe bakan, en az iki alt başlığı birleştiren/karşılaştıran 10-15 sentez sorusu üretilir; bunlar ünite testinde alt başlık sorularıyla birlikte gösterilir. AI çıktısını aşağıya yapıştırıp tek seferde kaydedin.'
            : isClassical
            ? 'Bu promptu ChatGPT, Claude, Gemini gibi kitap yüklemediğiniz bir AI\'a sorun — konunun tüm alt başlıklarının ders notu prompt içine gömülür. Tek bir alt başlığa değil konunun bütününe bakan 6-10 klasik/açık uçlu sentez sorusu, cevap anahtarıyla birlikte üretilir. AI çıktısını aşağıya yapıştırıp tek seferde kaydedin.'
            : 'Bu promptu ChatGPT, Claude, Gemini gibi kitap yüklemediğiniz bir AI\'a sorun — konunun tüm alt başlıklarının ders notu prompt içine gömülür. Tek bir alt başlığa değil konunun bütününe bakan, en az iki alt başlığı birleştiren/karşılaştıran 10-15 sentez sorusu üretilir; bunlar ünite testinde alt başlık sorularıyla birlikte gösterilir. AI çıktısını aşağıya yapıştırıp tek seferde kaydedin.'}
        </p>

        {promptError ? (
          <p className="text-xs font-bold text-[#ff6584]">{promptError}</p>
        ) : (
          <PromptCopyBox prompt={prompt} loading={loadingPrompt} />
        )}

        <div>
          <span className="text-xs font-bold text-muted-foreground block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={12}
            placeholder={isClassical ? CLASSICAL_QUESTIONS_PLACEHOLDER : MIXED_QUESTIONS_PLACEHOLDER}
            className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground font-mono resize-none focus:border-[#6c63ff] outline-none"
          />
        </div>

        <div>
          <span className="text-xs font-bold text-muted-foreground block mb-2">AI modeli (JSON&apos;daki &quot;ai_model&quot;den otomatik alınır, gerekirse düzeltin — boş bırakılırsa Manuel sayılır)</span>
          <input
            list={isNotebook ? 'ai-model-options-topic-questions-notebook' : 'ai-model-options-topic-questions'}
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            placeholder={isNotebook ? 'ör. NotebookLM' : 'ör. Claude Sonnet 5'}
            className="w-full rounded-xl border border-border bg-surface p-2.5 text-xs text-foreground focus:border-[#6c63ff] outline-none"
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
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
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

type GeneratedClassicalQuestion = {
  question_text: string;
  model_answer: string;
  key_terms: string;         // düzenleme için virgülle ayrılmış tek metin, kaydederken diziye çevrilir
  svg_prompt: string;
  svg_position: 'above' | 'below';
};

// Manuel kopyala-yapıştır akışının aynısını (13/14 numaralı klasik soru promptu) tek
// tıkla, doğrudan Gemini API çağrısıyla üretir (bkz. classical-questions/generate route).
// Üretilen sorular ADMIN ONAYLAMADAN kaydedilmez — burada düzenlenip/silinip "Kaydet"
// denince, manuel akışla AYNI section/topic questions POST rotasına gönderilir.
export function ClassicalGenerateModal({
  topicId,
  topicTitle,
  section,
  onClose,
}: {
  topicId: number;
  topicTitle: string;
  section?: { id: number; heading: string } | null;
  onClose: () => void;
}) {
  const [count, setCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [questions, setQuestions] = useState<GeneratedClassicalQuestion[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError(null);
    setQuestions(null);
    setSavedCount(null);
    try {
      const res = await fetch('/api/admin/topic-sections/classical-questions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, sectionId: section?.id ?? null, count }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setGenerateError(data?.error || 'Üretim başarısız oldu.');
        return;
      }
      type RawQuestion = {
        question_text: string;
        model_answer: string;
        key_terms: string[];
        svg_prompt: string | null;
        svg_position: 'above' | 'below';
      };
      const raw = (data?.questions || []) as RawQuestion[];
      setQuestions(raw.map((q) => ({
        question_text: q.question_text,
        model_answer: q.model_answer,
        key_terms: (q.key_terms || []).join(', '),
        svg_prompt: q.svg_prompt || '',
        svg_position: q.svg_position === 'below' ? 'below' : 'above',
      })));
      setAiModel(data?.aiModel || null);
    } catch {
      setGenerateError('Ağ hatası oluştu.');
    } finally {
      setGenerating(false);
    }
  }

  function updateQuestion(idx: number, patch: Partial<GeneratedClassicalQuestion>) {
    setQuestions((cur) => (cur ? cur.map((q, i) => (i === idx ? { ...q, ...patch } : q)) : cur));
  }

  function removeQuestion(idx: number) {
    setQuestions((cur) => (cur ? cur.filter((_, i) => i !== idx) : cur));
  }

  async function handleSave() {
    if (!questions || !questions.length) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = questions.map((q) => ({
        type: 'classical',
        question_text: q.question_text.trim(),
        svg_prompt: q.svg_prompt.trim() || null,
        svg_position: q.svg_position,
        model_answer: q.model_answer.trim(),
        key_terms: q.key_terms.split(',').map((t) => t.trim()).filter(Boolean),
      }));
      const url = section
        ? `/api/admin/topic-sections/section/${section.id}/questions`
        : `/api/admin/topic-sections/topic/${topicId}/questions`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: payload, ai_model: aiModel }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSaveError(data?.error || 'Kaydedilemedi.');
        return;
      }
      setSavedCount(data?.savedCount ?? payload.length);
      setQuestions(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Açık Uçlu Soru Üret (AI) — ${section ? section.heading : topicTitle}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Aynı klasik soru promptu doğrudan Gemini&apos;ye gönderilir. Üretilen sorular burada düzenlenebilir/silinebilir; &quot;Kaydet&quot;e basmadan soru bankasına yazılmaz.
        </p>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-muted-foreground">Adet</label>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
            className="w-20 rounded-lg border border-border bg-surface p-2 text-xs text-foreground focus:border-[#6c63ff] outline-none"
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-xl bg-[#6c63ff] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
          >
            {generating ? 'Üretiliyor...' : 'Üret'}
          </button>
        </div>

        {generateError && <p className="text-xs font-bold text-[#ff6584]">{generateError}</p>}
        {savedCount != null && <p className="text-xs font-bold text-emerald-400">{savedCount} soru kaydedildi.</p>}

        {questions && (
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div key={idx} className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-black text-muted-foreground uppercase">Soru {idx + 1}</span>
                  <button onClick={() => removeQuestion(idx)} className="text-[10px] font-bold text-[#ff6584] hover:underline">
                    Sil
                  </button>
                </div>
                <textarea
                  value={q.question_text}
                  onChange={(e) => updateQuestion(idx, { question_text: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-surface p-2 text-xs text-foreground resize-none focus:border-[#6c63ff] outline-none"
                  placeholder="Soru metni"
                />
                <textarea
                  value={q.model_answer}
                  onChange={(e) => updateQuestion(idx, { model_answer: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-surface p-2 text-xs text-foreground resize-none focus:border-[#6c63ff] outline-none"
                  placeholder="Model cevap (cevap anahtarı)"
                />
                <input
                  value={q.key_terms}
                  onChange={(e) => updateQuestion(idx, { key_terms: e.target.value })}
                  className="w-full rounded-lg border border-border bg-surface p-2 text-xs text-foreground focus:border-[#6c63ff] outline-none"
                  placeholder="Anahtar kavramlar (virgülle ayrılmış)"
                />
                {q.svg_prompt && (
                  <p className="text-[10px] text-muted-foreground italic">SVG önerisi: {q.svg_prompt} ({q.svg_position === 'below' ? 'altta' : 'üstte'})</p>
                )}
              </div>
            ))}
          </div>
        )}

        {saveError && <p className="text-xs font-bold text-[#ff6584]">{saveError}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
            Kapat
          </button>
          {questions && questions.length > 0 && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-[#6c63ff] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Kaydediliyor...' : `Kaydet (${questions.length})`}
            </button>
          )}
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
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      ) : loadError ? (
        <p className="text-xs font-bold text-[#ff6584]">{loadError}</p>
      ) : !topicContentId ? (
        <p className="text-sm text-muted-foreground">
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
              className="w-14 shrink-0 rounded-lg border border-border bg-surface px-2 py-2 text-center text-sm text-foreground focus:border-[#6c63ff] outline-none"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kavram / terim"
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-[#6c63ff] outline-none"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Açıklama / tanım"
            rows={3}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground resize-none focus:border-[#6c63ff] outline-none"
          />
          {error && <p className="text-xs font-bold text-[#ff6584]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
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
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
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
              className="w-14 shrink-0 rounded-lg border border-border bg-surface px-2 py-2 text-center text-sm text-foreground focus:border-[#6c63ff] outline-none"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kavram / terim"
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-[#6c63ff] outline-none"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Açıklama / tanım"
            rows={3}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground resize-none focus:border-[#6c63ff] outline-none"
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
              <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
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
