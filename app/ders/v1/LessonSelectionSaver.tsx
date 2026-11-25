'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookmarkPlus, Check, X } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { saveStudyItem } from '@/app/src/lib/savedStudyItems';

interface PendingSelection {
  text: string;
  sectionHeading: string | null;
  sectionAnchor: string | null;
}

function serializeInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  const tag = el.tagName;
  if (tag === 'BUTTON' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG') return '';
  if (el.getAttribute('aria-hidden') === 'true') return '';

  const inner = Array.from(el.childNodes).map(serializeInline).join('');
  if (!inner.trim()) return inner;

  if (tag === 'STRONG' || tag === 'B' || tag === 'DT') {
    const trimmed = inner.trim();
    const lead = inner.startsWith(' ') ? ' ' : '';
    const trail = inner.endsWith(' ') ? ' ' : '';
    return `${lead}**${trimmed}**${trail}`;
  }
  if (tag === 'BR') return '\n';
  return inner;
}

function serializeBlock(node: Node, out: string[], skipHeading?: string | null) {
  if (node.nodeType === Node.TEXT_NODE) {
    const txt = (node.textContent ?? '').replace(/[ \t]+/g, ' ').trim();
    if (txt) out.push(txt);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  const tag = el.tagName;
  if (tag === 'BUTTON' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG') return;
  if (el.getAttribute('aria-hidden') === 'true') return;

  const cls = typeof el.className === 'string' ? el.className : '';

  // Konunun kendi ana bölüm başlığı zaten kartın üstünde renkli başlık olarak gösteriliyor; gövdede tekrar etmesin.
  if (tag === 'H2' || (tag === 'H3' && (cls.includes('sheetTitle') || cls.includes('partTitle') || cls.includes('detailTitle')))) {
    const hText = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (skipHeading && hText === skipHeading) return;
    if (hText) out.push(`### ${hText}`);
    return;
  }

  // Konu içindeki mavi sol çizgili ara başlıklar (.recapLabel veya prose içi h3)
  if (tag === 'H3' || cls.includes('recapLabel')) {
    const labelText = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (labelText) out.push(`### ${labelText}`);
    return;
  }

  // Not / Dikkat / Örnek renkli bilgi kutuları
  if (cls.includes('recapNote')) {
    const raw = serializeInline(el).replace(/^\s*\*\*Not\*\*\s*:?\s*/i, '').replace(/\s+/g, ' ').trim();
    if (raw) out.push(`!NOT: ${raw}`);
    return;
  }
  if (cls.includes('recapWarn')) {
    const raw = serializeInline(el).replace(/^\s*\*\*Dikkat\*\*\s*:?\s*/i, '').replace(/\s+/g, ' ').trim();
    if (raw) out.push(`!DİKKAT: ${raw}`);
    return;
  }
  if (cls.includes('recapExample')) {
    const raw = serializeInline(el).replace(/^\s*\*\*Örnek\*\*\s*:?\s*/i, '').replace(/\s+/g, ' ').trim();
    if (raw) out.push(`!ÖRNEK: ${raw}`);
    return;
  }

  if (tag === 'LI') {
    const line = serializeInline(el).replace(/\s+/g, ' ').trim();
    if (line) out.push(`• ${line}`);
    return;
  }

  if (tag === 'P') {
    const line = serializeInline(el).replace(/\s+/g, ' ').trim();
    if (line) out.push(line);
    return;
  }

  const hasBlockChildren = Array.from(el.children).some((c) =>
    /^(DIV|SECTION|ARTICLE|UL|OL|LI|P|H1|H2|H3|DL|DD|DT|BLOCKQUOTE)$/.test(c.tagName)
  );
  if (hasBlockChildren) {
    Array.from(el.childNodes).forEach((child) => serializeBlock(child, out, skipHeading));
  } else {
    const line = serializeInline(el).replace(/\s+/g, ' ').trim();
    if (line) out.push(line);
  }
}

function extractFormattedSelection(range: Range, sectionHeading: string | null): string {
  const frag = range.cloneContents();
  const lines: string[] = [];
  Array.from(frag.childNodes).forEach((node) => serializeBlock(node, lines, sectionHeading));

  // Kullanıcı tek bir <li> veya <strong><em>...</em></strong> içinden parça seçtiyse üst düğüme bakarak vurguyu koru
  if (lines.length <= 1) {
    const ancestor =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as HTMLElement)
        : range.commonAncestorContainer.parentElement;
    if (ancestor?.closest('strong, b') && lines[0] && !lines[0].includes('**')) {
      lines[0] = `**${lines[0]}**`;
    }
  }

  const joined = lines.join('\n').trim();
  return joined || range.toString().replace(/[ \t]+/g, ' ').trim();
}

export function LessonSelectionSaver({
  topicId,
  containerRef,
  onRequireAuth,
}: {
  topicId: number;
  containerRef: React.RefObject<HTMLElement | null>;
  onRequireAuth: () => void;
}) {
  const { user, supabase } = useAuth();
  const [selection, setSelection] = useState<PendingSelection | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;

    const inspectSelection = () => {
      const root = containerRef.current;
      const sel = window.getSelection();
      if (!root || !sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelection(null);
        return;
      }

      const range = sel.getRangeAt(0);
      const common = range.commonAncestorContainer;
      const hostEl = common.nodeType === Node.ELEMENT_NODE ? (common as HTMLElement) : common.parentElement;
      if (!hostEl || !root.contains(hostEl) || hostEl.closest('#konu-tartisma')) {
        setSelection(null);
        return;
      }

      const plainLen = sel.toString().replace(/\s+/g, ' ').trim().length;
      if (plainLen < 8 || plainLen > 1200) {
        setSelection(null);
        return;
      }

      const partEl = hostEl.closest<HTMLElement>('[data-part]');
      const sectionAnchor =
        partEl?.dataset.sectionAnchor ??
        (hostEl.closest('#ozet') ? 'ozet' : hostEl.closest('#kavramlar') ? 'kavramlar' : null);
      const headingEl = partEl?.querySelector('h3');
      const sectionHeading =
        headingEl?.textContent?.trim() ||
        (hostEl.closest('#ozet') ? 'Konu özeti' : hostEl.closest('#kavramlar') ? 'Anahtar kavramlar' : null);

      const formatted = extractFormattedSelection(range, sectionHeading);
      if (formatted.length < 8 || formatted.length > 1500) {
        setSelection(null);
        return;
      }

      setSelection({ text: formatted, sectionHeading, sectionAnchor });
    };

    const scheduleCheck = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(inspectSelection, 140);
    };

    document.addEventListener('selectionchange', scheduleCheck);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('selectionchange', scheduleCheck);
    };
  }, [containerRef]);

  const handleSave = async () => {
    if (!selection || saving) return;
    if (!user) {
      onRequireAuth();
      return;
    }

    setSaving(true);
    try {
      await saveStudyItem(supabase, {
        kind: 'note',
        topicId,
        sectionHeading: selection.sectionHeading,
        sectionAnchor: selection.sectionAnchor,
        excerpt: selection.text,
      });
      window.getSelection()?.removeAllRanges();
      setSelection(null);
      setSavedNotice('Ders notlarına kaydedildi!');
      window.setTimeout(() => setSavedNotice(null), 2600);
    } catch {
      setSavedNotice('Kaydedilemedi, tekrar dener misin?');
      window.setTimeout(() => setSavedNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  if (typeof document === 'undefined' || (!selection && !savedNotice)) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[85] flex justify-center px-4 sm:bottom-6">
      {savedNotice ? (
        <div
          role="status"
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-slate-900/95 px-4 py-2.5 text-xs font-bold text-emerald-300 shadow-xl backdrop-blur-md sm:text-sm"
        >
          <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
          {savedNotice}
        </div>
      ) : selection ? (
        <div className="pointer-events-auto inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-400/45 bg-slate-900/95 p-1.5 pl-3.5 text-white shadow-[0_10px_30px_-6px_rgba(6,182,212,0.5)] backdrop-blur-md">
          <button
            type="button"
            disabled={saving}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void handleSave()}
            className="inline-flex min-h-9 items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 px-4 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-60 sm:text-sm"
          >
            <BookmarkPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
            {saving ? 'Kaydediliyor…' : 'Seçimi Notlarıma Kaydet'}
          </button>
          <button
            type="button"
            aria-label="Kapat"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              window.getSelection()?.removeAllRanges();
              setSelection(null);
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>,
    document.body
  );
}
