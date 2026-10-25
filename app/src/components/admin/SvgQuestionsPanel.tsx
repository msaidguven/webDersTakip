'use client';

import { useCallback, useEffect, useState } from 'react';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';
import { SITE_URL } from '@/app/src/lib/site';
import { buildAnswerSvgPrompt, buildSvgGenerationPrompt } from '@/app/src/lib/svgPromptRules';
import { QuestionEditModal } from '@/app/src/components/admin/ManagementTab';
import MathText from '@/app/src/components/MathText';
import { inlineToHtml } from '@/app/src/lib/recapCards';

type SvgQuestionItem = {
  id: number;
  question_text: string;
  svg_prompt: string | null;
  svg_content: string | null;
  svg_position: 'above' | 'below';
  topicTitle: string | null;
  href: string | null;
};

// Cevap görseli işi (yazılı klasik soruları, ?tur=cevap): sorunun kendi alanlarına ek olarak.
type AnswerSvgItem = SvgQuestionItem & {
  model_answer: string | null;
  answer_svg_prompt: string;
  answer_svg_content: string | null;
  questionSvgPending: boolean;
};

// Hap bilgi örneğinin şekli (?tur=kart, bkz. app/api/admin/recap-figures): id = bölüm id'si.
type RecapFigureItem = {
  id: number;
  heading: string;
  topicTitle: string | null;
  question: string;
  solution: string;
  figure_prompt: string;
  figure_svg: string | null;
  href: string | null;
};

type Status = 'pending' | 'done' | 'all';
type Mode = 'question' | 'answer' | 'card';

const STATUS_TABS: { key: Status; label: string }[] = [
  { key: 'pending', label: 'SVG Bekleyen' },
  { key: 'done', label: 'Tamamlanan' },
  { key: 'all', label: 'Tümü' },
];

function CopyButton({ text, label = 'Kopyala' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
      className="text-xs font-bold text-indigo-400 hover:text-indigo-300 whitespace-nowrap"
    >
      {copied ? 'Kopyalandı ✓' : label}
    </button>
  );
}

function CardHeader({ item, isDone }: { item: SvgQuestionItem; isDone: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {item.topicTitle && <p className="text-[11px] font-bold text-indigo-400 truncate">{item.topicTitle}</p>}
        <p className="text-sm text-foreground line-clamp-2"><MathText text={item.question_text} /></p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${isDone ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
        {isDone ? 'Tamamlandı' : 'Bekliyor'}
      </span>
    </div>
  );
}

// Onaylanmış (svg_content dolu) sorular için sade görünüm — kod kutusu yerine
// direkt SVG önizlemesi + düzenlemek için asıl soru düzenleme modalına link
// (kullanıcı isteği 2026-09-04: "kod yerine direk soruları önizleme olarak görsem").
function DoneSvgCard({ item, onEdit }: { item: SvgQuestionItem; onEdit: () => void }) {
  const clean = item.svg_content ? sanitizeMathSvg(item.svg_content) : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <CardHeader item={item} isDone />

      <div className="light flex min-h-[7rem] items-center justify-center rounded-xl border border-border bg-white p-3">
        {clean ? (
          <div className="w-full [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-h-40 [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: clean }} />
        ) : (
          <span className="text-xs text-gray-400">Önizleme yok</span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button type="button" onClick={onEdit} className="text-xs font-bold text-indigo-400 hover:text-indigo-300">
          Düzenle
        </button>
        {item.href && (
          <>
            <a href={item.href} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-muted-foreground hover:text-foreground">
              Soru Bankasında Göster ↗
            </a>
            <CopyButton text={`${SITE_URL}${item.href}`} label="Linki Kopyala" />
          </>
        )}
      </div>
    </div>
  );
}

function PendingSvgCard({ item, onSaved }: { item: SvgQuestionItem; onSaved: () => void }) {
  const [svgContent, setSvgContent] = useState(item.svg_content || '');
  const [svgPosition, setSvgPosition] = useState<'above' | 'below'>(item.svg_position);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch('/api/admin/manage/questions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, patch: { svg_content: svgContent || null, svg_position: svgPosition } }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setError(data?.error || 'Kaydedilemedi');
      return;
    }
    onSaved();
  }

  const clean = svgContent.trim() ? sanitizeMathSvg(svgContent) : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <CardHeader item={item} isDone={false} />

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">SVG Prompt</span>
          {item.svg_prompt && (
            <CopyButton text={buildSvgGenerationPrompt({ questionText: item.question_text, svgPrompt: item.svg_prompt, topicTitle: item.topicTitle })} />
          )}
        </div>
        <div className="max-h-28 overflow-y-auto rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
          {item.svg_prompt || '—'}
        </div>
      </div>

      <div>
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">AI&apos;den dönen SVG kodunu buraya yapıştır</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <textarea
            value={svgContent}
            onChange={(e) => setSvgContent(e.target.value)}
            rows={5}
            placeholder="<svg ...>...</svg>"
            spellCheck={false}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-indigo-500"
          />
          <div className="light flex min-h-[7rem] items-center justify-center rounded-xl border border-border bg-white p-3">
            {!clean ? (
              <span className="text-xs text-gray-400">{svgContent.trim() ? 'Geçersiz SVG' : 'Önizleme'}</span>
            ) : (
              <div className="w-full [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-h-40 [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: clean }} />
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Konum:</span>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input type="radio" name={`pos-${item.id}`} checked={svgPosition === 'above'} onChange={() => setSvgPosition('above')} className="accent-indigo-500" />
            Üstte
          </label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input type="radio" name={`pos-${item.id}`} checked={svgPosition === 'below'} onChange={() => setSvgPosition('below')} className="accent-indigo-500" />
            Altta
          </label>
        </div>
        <div className="flex items-center gap-3">
          {item.href && (
            <a href={item.href} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-muted-foreground hover:text-foreground">
              Soru Bankasında Göster ↗
            </a>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
      {error && <p className="text-xs font-bold text-rose-400">{error}</p>}
    </div>
  );
}

function SvgPreview({ svg, emptyLabel }: { svg: string; emptyLabel: string }) {
  const clean = svg.trim() ? sanitizeMathSvg(svg) : null;
  return (
    <div className="light flex min-h-[7rem] items-center justify-center rounded-xl border border-border bg-white p-3">
      {clean ? (
        <div className="w-full [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-h-40 [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: clean }} />
      ) : (
        <span className="text-xs text-gray-400">{svg.trim() ? 'Geçersiz SVG' : emptyLabel}</span>
      )}
    </div>
  );
}

// Cevap görseli kartı (plan: docs/yazili-sorulari-plani.md "Cevap görseli"). Sorunun görseli bekleniyorsa
// "Kopyala" kapalı: cevap görseli ondan türetilir. Kaydetmek yayına dokunmaz; gereksiz tarif kaldırılabilir.
function AnswerSvgCard({ item, onSaved }: { item: AnswerSvgItem; onSaved: () => void }) {
  const [svgContent, setSvgContent] = useState(item.answer_svg_content || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDone = !!item.answer_svg_content;

  async function patch(answerSvg: { content?: string | null; prompt?: null }) {
    setSaving(true);
    setError(null);
    const res = await fetch('/api/admin/manage/questions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, answerSvg }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) return setError(data?.error || 'Kaydedilemedi');
    onSaved();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <CardHeader item={item} isDone={isDone} />
      {item.model_answer && <p className="text-xs text-muted-foreground"><span className="font-semibold">Yazılı cevap:</span> <MathText text={item.model_answer} /></p>}

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Cevap görseli prompt&apos;u</span>
          {item.questionSvgPending ? (
            <span className="text-xs font-bold text-amber-500">Önce soru görseli</span>
          ) : (
            <CopyButton
              text={buildAnswerSvgPrompt({
                questionText: item.question_text,
                answerSvgPrompt: item.answer_svg_prompt,
                modelAnswer: item.model_answer,
                questionSvg: item.svg_content,
                topicTitle: item.topicTitle,
              })}
            />
          )}
        </div>
        <div className="max-h-28 overflow-y-auto rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
          {item.answer_svg_prompt}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Soru görseli</span>
          <SvgPreview svg={item.svg_content || ''} emptyLabel={item.questionSvgPending ? 'Bekleniyor' : 'Yok'} />
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Cevap SVG kodu</span>
          <textarea
            value={svgContent}
            onChange={(e) => setSvgContent(e.target.value)}
            rows={6}
            placeholder="<svg ...>...</svg>"
            spellCheck={false}
            aria-label="Cevap SVG kodu"
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Cevap görseli önizleme</span>
          <SvgPreview svg={svgContent} emptyLabel="Önizleme" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            if (confirm('Bu soru için cevap görseli gereksiz mi? Tarif ve varsa görsel silinir.')) void patch({ prompt: null, content: null });
          }}
          className="text-xs font-bold text-muted-foreground hover:text-rose-400 disabled:opacity-50"
        >
          Gereksiz — kaldır
        </button>
        <button
          type="button"
          onClick={() => void patch({ content: svgContent || null })}
          disabled={saving || svgContent === (item.answer_svg_content || '')}
          className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
      {error && <p className="text-xs font-bold text-rose-400">{error}</p>}
    </div>
  );
}

// Hap bilgi örneği şekli: şekil kaydedilene kadar örnek konu sayfasında gizli. Prompt soru görselleriyle aynı
// kurallarla kurulur (buildSvgGenerationPrompt). "Şekilsiz yayınla": tarif gereksizse kaldırılır, örnek şekilsiz görünür.
function RecapFigureCard({ item, onSaved }: { item: RecapFigureItem; onSaved: () => void }) {
  const [svgContent, setSvgContent] = useState(item.figure_svg || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDone = !!item.figure_svg;

  async function patch(body: { svg?: string | null; dropFigure?: true }) {
    setSaving(true);
    setError(null);
    const res = await fetch('/api/admin/recap-figures', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: item.id, ...body }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) return setError(data?.error || 'Kaydedilemedi');
    onSaved();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-indigo-400 truncate">{[item.topicTitle, item.heading].filter(Boolean).join(' · ')}</p>
          <p className="text-sm text-foreground" dangerouslySetInnerHTML={{ __html: inlineToHtml(item.question) }} />
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${isDone ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
          {isDone ? 'Tamamlandı' : 'Bekliyor'}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        <span className="font-semibold">Çözüm:</span>
        {item.solution.split('\n').filter((l) => l.trim()).map((line, i) => (
          <p key={i} dangerouslySetInnerHTML={{ __html: inlineToHtml(line) }} />
        ))}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Şekil tarifi</span>
          <CopyButton text={buildSvgGenerationPrompt({ questionText: item.question, svgPrompt: item.figure_prompt, topicTitle: item.topicTitle })} label="Promptu Kopyala" />
        </div>
        <div className="max-h-28 overflow-y-auto rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
          {item.figure_prompt}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <textarea
          value={svgContent}
          onChange={(e) => setSvgContent(e.target.value)}
          rows={6}
          placeholder="AI'den dönen <svg ...>...</svg> kodunu yapıştır"
          spellCheck={false}
          aria-label="Şekil SVG kodu"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-indigo-500"
        />
        <SvgPreview svg={svgContent} emptyLabel="Önizleme" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            if (confirm('Bu örnek şekilsiz anlaşılıyor mu? Tarif ve varsa şekil kaldırılır, örnek şekilsiz yayınlanır.')) void patch({ dropFigure: true });
          }}
          className="text-xs font-bold text-muted-foreground hover:text-rose-400 disabled:opacity-50"
        >
          Şekilsiz yayınla
        </button>
        <div className="flex items-center gap-3">
          {item.href && (
            <a href={item.href} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-muted-foreground hover:text-foreground">
              Konu sayfasında göster ↗
            </a>
          )}
          <button
            type="button"
            onClick={() => void patch({ svg: svgContent || null })}
            disabled={saving || svgContent === (item.figure_svg || '')}
            className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-50"
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
      {error && <p className="text-xs font-bold text-rose-400">{error}</p>}
    </div>
  );
}

export default function SvgQuestionsPanel({ initialClassicalOnly = false, initialMode = 'question' }: { initialClassicalOnly?: boolean; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [status, setStatus] = useState<Status>('pending');
  // Yazılı Soruları ekranından gelince (?tur=klasik) yalnız klasik sorular.
  const [classicalOnly, setClassicalOnly] = useState(initialClassicalOnly);
  const [items, setItems] = useState<(SvgQuestionItem | RecapFigureItem)[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editQuestionId, setEditQuestionId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setItems(null);
    setError(null);
    const tur = mode === 'answer' ? '&tur=cevap' : classicalOnly ? '&tur=klasik' : '';
    const res = await fetch(mode === 'card' ? `/api/admin/recap-figures?status=${status}` : `/api/admin/svg-questions?status=${status}${tur}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error || 'Yüklenemedi');
      setItems([]);
      return;
    }
    setItems(data.items || []);
  }, [status, classicalOnly, mode]);

  useEffect(() => {
    load();
  }, [load]);

  function showNotice(kind: 'success' | 'error', text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 5000);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist" aria-label="İş türü">
        {([
          ['question', 'Soru görseli'],
          ['answer', 'Cevap görseli (yazılı)'],
          ['card', 'Hap bilgi şekli'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => {
              setItems(null);
              setMode(key);
            }}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap border transition-all ${
              mode === key ? 'border-indigo-500 text-indigo-400' : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
              status === t.key ? 'bg-indigo-500 text-white' : 'bg-surface text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
        {mode === 'question' && (
          <label className="ml-auto flex shrink-0 items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <input type="checkbox" checked={classicalOnly} onChange={(e) => setClassicalOnly(e.target.checked)} />
            Yalnız yazılı (klasik) soruları
          </label>
        )}
      </div>

      {error && <p className="text-sm font-bold text-rose-400">{error}</p>}
      {notice && (
        <div
          className={`px-4 py-3 rounded-xl text-sm ${
            notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'
          }`}
        >
          {notice.text}
        </div>
      )}
      {items === null && <p className="text-sm text-muted-foreground py-8 text-center">Yükleniyor...</p>}
      {items && items.length === 0 && !error && (
        <div className="rounded-2xl border border-border bg-card p-8 sm:p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {mode === 'card'
              ? status === 'pending' ? 'Şekil bekleyen hap bilgi örneği yok 🎉' : status === 'done' ? 'Henüz çizilen hap bilgi şekli yok' : 'Şekil istenen hap bilgi örneği yok'
              : mode === 'answer'
              ? status === 'pending' ? 'Bekleyen cevap görseli yok 🎉' : status === 'done' ? 'Henüz tamamlanan cevap görseli yok' : 'Cevap görseli istenen soru yok'
              : status === 'pending' ? 'Bekleyen SVG sorusu yok 🎉' : status === 'done' ? 'Henüz tamamlanan SVG sorusu yok' : 'SVG istenen soru yok'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items?.map((item) =>
          mode === 'card' ? (
            <RecapFigureCard key={item.id} item={item as RecapFigureItem} onSaved={load} />
          ) : mode === 'answer' ? (
            <AnswerSvgCard key={item.id} item={item as AnswerSvgItem} onSaved={load} />
          ) : (item as SvgQuestionItem).svg_content ? (
            <DoneSvgCard key={item.id} item={item as SvgQuestionItem} onEdit={() => setEditQuestionId(item.id)} />
          ) : (
            <PendingSvgCard key={item.id} item={item as SvgQuestionItem} onSaved={load} />
          )
        )}
      </div>

      {editQuestionId !== null && (
        <QuestionEditModal
          questionId={editQuestionId}
          onClose={() => setEditQuestionId(null)}
          onSaved={() => {
            setEditQuestionId(null);
            load();
          }}
          showNotice={showNotice}
        />
      )}
    </div>
  );
}
