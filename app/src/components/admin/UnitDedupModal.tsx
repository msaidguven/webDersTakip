'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, X } from 'lucide-react';
import { copyText } from '@/app/src/lib/clipboard';
import { extractJson } from '@/app/src/lib/extractJson';

type CurrentSection = {
  sectionId: number;
  topicTitle: string;
  heading: string;
  explanationMarkdown: string;
  notebookMarkdown: string;
};

type ParsedEdit = {
  sectionId: number;
  reason: string;
  explanationMarkdown: string;
  notebookMarkdown: string;
};

function PromptCopyBox({ prompt, loading }: { prompt: string; loading: boolean }) {
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

export function UnitDedupModal({
  unitId,
  unitTitle,
  onClose,
  onApplied,
}: {
  unitId: number;
  unitTitle: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [includedTopics, setIncludedTopics] = useState<string[]>([]);
  const [skippedTopics, setSkippedTopics] = useState<string[]>([]);
  const [currentById, setCurrentById] = useState<Map<number, CurrentSection>>(new Map());

  const [pasted, setPasted] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [edits, setEdits] = useState<ParsedEdit[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<string | null>(null);

  const loadPrompt = useCallback(async () => {
    setLoadingPrompt(true);
    setLoadError(null);
    const res = await fetch(`/api/admin/rag/unit-dedup-prompt?unitId=${unitId}`);
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setPrompt(data?.prompt || '');
      setIncludedTopics(data?.includedTopics || []);
      setSkippedTopics(data?.skippedTopics || []);
      const map = new Map<number, CurrentSection>();
      for (const s of (data?.currentSections as CurrentSection[] | undefined) || []) {
        map.set(s.sectionId, s);
      }
      setCurrentById(map);
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
    try {
      const obj = extractJson(pasted) as { summary?: unknown; edits?: unknown };
      const rawEdits = Array.isArray(obj.edits) ? obj.edits : [];
      const clean: ParsedEdit[] = rawEdits
        .filter((e): e is { section_id: number } => typeof (e as { section_id?: unknown })?.section_id === 'number')
        .map((e) => {
          const row = e as { section_id: number; reason?: unknown; explanation_markdown?: unknown; notebook_markdown?: unknown };
          return {
            sectionId: row.section_id,
            reason: typeof row.reason === 'string' ? row.reason : '',
            explanationMarkdown: typeof row.explanation_markdown === 'string' ? row.explanation_markdown : '',
            notebookMarkdown: typeof row.notebook_markdown === 'string' ? row.notebook_markdown : '',
          };
        })
        .filter((e) => currentById.has(e.sectionId));
      setEdits(clean);
      setSelectedIds(new Set(clean.map((e) => e.sectionId)));
      setSummary(typeof obj.summary === 'string' ? obj.summary : null);
      if (!clean.length) setParseError('JSON geçerli ama uygulanabilir bir düzenleme bulunamadı (tekrar yoktur ya da section_id eşleşmedi).');
    } catch {
      setParseError('Yapıştırılan metin geçerli bir JSON değil.');
      setEdits([]);
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

  const selectedEdits = useMemo(() => edits.filter((e) => selectedIds.has(e.sectionId)), [edits, selectedIds]);

  async function handleApply() {
    if (!selectedEdits.length) return;
    setApplying(true);
    setApplyError(null);
    try {
      const res = await fetch('/api/admin/rag/unit-dedup-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId,
          edits: selectedEdits.map((e) => ({
            section_id: e.sectionId,
            explanation_markdown: e.explanationMarkdown,
            notebook_markdown: e.notebookMarkdown,
          })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setApplyError(data?.error || 'Kaydedilemedi.');
        return;
      }
      setApplyResult(`${data.updated} alt başlık güncellendi.`);
      setEdits([]);
      onApplied();
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-surface-elevated p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-base font-black text-foreground">Ünite İçi Tekrar Kontrolü</h4>
            <p className="text-xs text-muted-foreground">{unitTitle}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loadError ? (
          <p className="text-sm text-red-400">{loadError}</p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Bu promptu dışarıda bir AI&apos;a (Gemini vb.) sorun, dönen JSON&apos;u aşağıya yapıştırıp önce &quot;Analiz Et&quot;e, önerileri gözden geçirdikten sonra &quot;Uygula&quot;ya basın. Sadece işaretli
              alt başlıkların içeriği güncellenir — başlıklar ve bölüm sayısı değişmez.
            </p>
            {includedTopics.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Karşılaştırılan konular: <span className="text-foreground">{includedTopics.join(', ')}</span>
                {skippedTopics.length > 0 && (
                  <>
                    {' '}
                    — içeriği hazır olmadığı için atlanan: <span className="text-foreground">{skippedTopics.join(', ')}</span>
                  </>
                )}
              </p>
            )}

            <PromptCopyBox prompt={prompt} loading={loadingPrompt} />

            <div>
              <span className="text-xs font-bold text-muted-foreground block mb-2">AI&apos;dan gelen JSON sonucu buraya yapıştırın</span>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={5}
                placeholder='{"summary": "...", "edits": [...] }'
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
                  const current = currentById.get(edit.sectionId);
                  const checked = selectedIds.has(edit.sectionId);
                  return (
                    <div key={edit.sectionId} className="rounded-xl border border-border bg-surface p-3">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelected(edit.sectionId)}
                          className="mt-0.5 accent-indigo-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-foreground">
                            <span className="text-muted-foreground">{current?.topicTitle}</span>
                            <span>→</span>
                            <span>{current?.heading}</span>
                          </div>
                          {edit.reason && <p className="text-[11px] text-muted-foreground mt-1">{edit.reason}</p>}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Eski Konu Anlatımı</p>
                              <p className="text-[11px] text-muted-foreground whitespace-pre-wrap line-clamp-6">{current?.explanationMarkdown || '(boş)'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Yeni Konu Anlatımı</p>
                              <p className="text-[11px] text-foreground whitespace-pre-wrap">{edit.explanationMarkdown || '(boş)'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Eski Defter Notu</p>
                              <p className="text-[11px] text-muted-foreground whitespace-pre-wrap line-clamp-6">{current?.notebookMarkdown || '(boş)'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Yeni Defter Notu</p>
                              <p className="text-[11px] text-foreground whitespace-pre-wrap">{edit.notebookMarkdown || '(boş)'}</p>
                            </div>
                          </div>
                        </div>
                      </label>
                    </div>
                  );
                })}

                {applyError && <p className="text-xs text-red-400">{applyError}</p>}
                {applyResult && <p className="text-xs text-emerald-400">{applyResult}</p>}

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
          </div>
        )}
      </div>
    </div>
  );
}
