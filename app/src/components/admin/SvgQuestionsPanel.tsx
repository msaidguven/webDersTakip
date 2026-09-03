'use client';

import { useCallback, useEffect, useState } from 'react';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';
import { SITE_URL } from '@/app/src/lib/site';

type SvgQuestionItem = {
  id: number;
  question_text: string;
  svg_prompt: string | null;
  svg_content: string | null;
  svg_position: 'above' | 'below';
  topicTitle: string | null;
  href: string | null;
};

type Status = 'pending' | 'done' | 'all';

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

function SvgQuestionCard({ item, onSaved }: { item: SvgQuestionItem; onSaved: () => void }) {
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
  const isDone = !!item.svg_content;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111114] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {item.topicTitle && <p className="text-[11px] font-bold text-indigo-400 truncate">{item.topicTitle}</p>}
          <p className="text-sm text-white line-clamp-2">{item.question_text}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${isDone ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
          {isDone ? 'Tamamlandı' : 'Bekliyor'}
        </span>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400">SVG Prompt</span>
          {item.svg_prompt && <CopyButton text={item.svg_prompt} />}
        </div>
        <div className="max-h-28 overflow-y-auto rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-gray-300 whitespace-pre-wrap">
          {item.svg_prompt || '—'}
        </div>
      </div>

      <div>
        <span className="mb-1 block text-xs font-semibold text-gray-400">AI&apos;den dönen SVG kodunu buraya yapıştır</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <textarea
            value={svgContent}
            onChange={(e) => setSvgContent(e.target.value)}
            rows={5}
            placeholder="<svg ...>...</svg>"
            spellCheck={false}
            className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2 font-mono text-xs text-white outline-none focus:border-indigo-500"
          />
          <div className="flex min-h-[7rem] items-center justify-center rounded-xl border border-white/10 bg-white p-3">
            {!clean ? (
              <span className="text-xs text-gray-400">{svgContent.trim() ? 'Geçersiz SVG' : 'Önizleme'}</span>
            ) : (
              <div className="max-h-40 max-w-full [&_svg]:max-h-40 [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: clean }} />
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Konum:</span>
          <label className="flex items-center gap-1 text-xs text-gray-300">
            <input type="radio" name={`pos-${item.id}`} checked={svgPosition === 'above'} onChange={() => setSvgPosition('above')} className="accent-indigo-500" />
            Üstte
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-300">
            <input type="radio" name={`pos-${item.id}`} checked={svgPosition === 'below'} onChange={() => setSvgPosition('below')} className="accent-indigo-500" />
            Altta
          </label>
        </div>
        <div className="flex items-center gap-3">
          {item.href && (
            <>
              <a href={item.href} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-gray-400 hover:text-white">
                Canlı Aç ↗
              </a>
              <CopyButton text={`${SITE_URL}${item.href}`} label="Linki Kopyala" />
            </>
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

export default function SvgQuestionsPanel() {
  const [status, setStatus] = useState<Status>('pending');
  const [items, setItems] = useState<SvgQuestionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setItems(null);
    setError(null);
    const res = await fetch(`/api/admin/svg-questions?status=${status}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error || 'Yüklenemedi');
      setItems([]);
      return;
    }
    setItems(data.items || []);
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
              status === t.key ? 'bg-indigo-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm font-bold text-rose-400">{error}</p>}
      {items === null && <p className="text-sm text-gray-400 py-8 text-center">Yükleniyor...</p>}
      {items && items.length === 0 && !error && (
        <div className="rounded-2xl border border-white/5 bg-[#111114] p-8 sm:p-12 text-center">
          <p className="text-sm text-gray-400">
            {status === 'pending' ? 'Bekleyen SVG sorusu yok 🎉' : status === 'done' ? 'Henüz tamamlanan SVG sorusu yok' : 'SVG istenen soru yok'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items?.map((item) => (
          <SvgQuestionCard key={item.id} item={item} onSaved={load} />
        ))}
      </div>
    </div>
  );
}
