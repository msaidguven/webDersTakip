'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';
import { renderLatexInHtml } from '@/app/src/lib/renderLatex';

const DOT_COLORS = ['bg-indigo-400', 'bg-purple-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400', 'bg-sky-400'];

function splitBullet(liInnerHtml: string): { titleHtml: string | null; bodyHtml: string } {
  const trimmed = liInnerHtml.trim();

  // AI bazen "terim: açıklama" cümlesinin tamamını tek bir <strong> içine alıyor.
  // Böyle durumda sadece ilk ":" öncesini kalın başlık say, gerisini normal metne çevir.
  const wholeBold = trimmed.match(/^<strong>([\s\S]*)<\/strong>$/);
  if (wholeBold) {
    const inner = wholeBold[1];
    const colonIdx = inner.indexOf(':');
    if (colonIdx !== -1) {
      return { titleHtml: inner.slice(0, colonIdx).trim(), bodyHtml: inner.slice(colonIdx + 1).trim() };
    }
    return { titleHtml: null, bodyHtml: trimmed };
  }

  const m = trimmed.match(/^<strong>(.*?)<\/strong>\s*:?\s*/);
  if (m) return { titleHtml: m[1].replace(/:\s*$/, '').trim(), bodyHtml: trimmed.slice(m[0].length).trim() };
  return { titleHtml: null, bodyHtml: trimmed };
}

function BulletRow({ titleHtml, bodyHtml, badge, colorIdx }: { titleHtml: string | null; bodyHtml: string; badge: number | null; colorIdx: number }) {
  return (
    <div className="flex items-start gap-2.5">
      {badge != null ? (
        <span className="mt-0.5 w-4 shrink-0 text-xs font-black text-slate-400">{badge}.</span>
      ) : (
        <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${DOT_COLORS[colorIdx % DOT_COLORS.length]}`} />
      )}
      <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
        {titleHtml && (
          <span className="font-black text-slate-900" dangerouslySetInnerHTML={{ __html: `${titleHtml}: ` }} />
        )}
        <span dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      </p>
    </div>
  );
}

function directListChild(li: Element): Element | null {
  return Array.from(li.children).find((c) => c.tagName === 'UL' || c.tagName === 'OL') || null;
}

function ownLiHtml(li: Element): string {
  const clone = li.cloneNode(true) as Element;
  const nestedInClone = Array.from(clone.children).find((c) => c.tagName === 'UL' || c.tagName === 'OL');
  if (nestedInClone) clone.removeChild(nestedInClone);
  return clone.innerHTML.trim();
}

// Bir liste, alt liste içeren (grup başlığı) ve içermeyen (düz madde) <li>'leri karışık
// biçimde barındırabilir. Düz maddeler ardışık satırlar hâlinde birikir; alt liste içeren
// <li>'ler kalın bir grup başlığı + girintili/çizgili bir alt blok olur. Kutu/kart yok,
// hiyerarşi tamamen tipografi ve girintiyle kuruluyor.
function renderList(node: Element, keyPrefix: string, dotIdx: { current: number }): React.ReactNode[] {
  const ordered = node.tagName === 'OL';
  const liEls = Array.from(node.children).filter((c) => c.tagName === 'LI');
  const blocks: React.ReactNode[] = [];
  let flatBuffer: { titleHtml: string | null; bodyHtml: string }[] = [];

  const flushFlat = (key: string) => {
    if (!flatBuffer.length) return;
    blocks.push(
      <div key={key} className="space-y-2.5">
        {flatBuffer.map((it, idx) => {
          const row = (
            <BulletRow
              titleHtml={it.titleHtml}
              bodyHtml={it.bodyHtml}
              badge={ordered ? idx + 1 : null}
              colorIdx={dotIdx.current}
            />
          );
          dotIdx.current += 1;
          return <React.Fragment key={idx}>{row}</React.Fragment>;
        })}
      </div>
    );
    flatBuffer = [];
  };

  liEls.forEach((li, idx) => {
    const nested = directListChild(li);
    if (nested) {
      flushFlat(`${keyPrefix}-f${idx}`);
      const headerHtml = ownLiHtml(li).replace(/:\s*$/, '');
      const childBlocks = renderList(nested, `${keyPrefix}-${idx}`, dotIdx);
      blocks.push(
        <div key={`${keyPrefix}-g${idx}`} className="mt-5 first:mt-0">
          <p className="mb-2.5 flex items-center gap-2 text-sm sm:text-base font-black text-slate-900">
            <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLORS[dotIdx.current % DOT_COLORS.length]}`} />
            <span dangerouslySetInnerHTML={{ __html: headerHtml }} />
          </p>
          <div className="space-y-2.5 border-l-2 border-slate-100 pl-4">{childBlocks}</div>
        </div>
      );
      return;
    }
    flatBuffer.push(splitBullet(li.innerHTML));
  });
  flushFlat(`${keyPrefix}-fend`);

  return blocks;
}

function buildBlocks(html: string): React.ReactNode[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const children = Array.from(doc.body.firstElementChild?.children || []);
  const blocks: React.ReactNode[] = [];
  const dotIdx = { current: 0 };

  children.forEach((node, i) => {
    if (node.tagName === 'UL' || node.tagName === 'OL') {
      blocks.push(...renderList(node, `n${i}`, dotIdx));
      return;
    }
    blocks.push(<div key={`b-${i}`} dangerouslySetInnerHTML={{ __html: node.outerHTML }} />);
  });

  return blocks;
}

// Delikli/spiralli, kırmızı çizgili "defter sayfası" görünümü — öğrencinin deftere
// geçireceği kısa notlar için. notebookHtml verilmediğinde (henüz yeniden üretilmemiş
// eski bölümler) bu kutuyu doğrudan konu anlatımı için kullanıyoruz — eski görünüm
// böylece hiç bozulmuyor.
function NotebookBox({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-100 bg-[#fffdf6] shadow-sm">
      <div className="absolute inset-y-0 left-0 hidden w-12 flex-col items-center justify-evenly py-5 sm:flex">
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} className="h-2 w-2 rounded-full bg-white shadow-inner ring-1 ring-amber-200" />
        ))}
      </div>
      <div className="absolute inset-y-0 left-12 hidden w-px bg-rose-200 sm:block" />
      <div className="space-y-3 px-5 py-5 sm:py-6 sm:pl-16 sm:pr-6">
        {label && (
          <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-amber-700">
            📝 {label}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

// "Konu Anlatımı" için Defterine Not Al kutusuyla eşleşen ama farklı renk ailesinde
// (defter = amber/kağıt, anlatım = gök mavisi/eflatun degrade) sevimli bir kart —
// öğrenci iki bloğu ("oku" vs "ezberle") ilk bakışta ayırt edebilsin diye.
function ExplanationBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-indigo-50 shadow-sm">
      <div className="space-y-3 px-5 py-5 sm:py-6 sm:px-6">
        <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-indigo-600">
          📖 Konu Anlatımı
        </p>
        {children}
      </div>
    </div>
  );
}

export default function SectionContent({
  html,
  notebookHtml,
  imageUrl,
  caption,
  imageAlt,
  diagramSvg,
}: {
  html: string;
  notebookHtml?: string | null;
  imageUrl?: string | null;
  caption?: string | null;
  imageAlt?: string | null;
  diagramSvg?: string | null;
}) {
  const [blocks, setBlocks] = useState<React.ReactNode[] | null>(null);
  const [notebookBlocks, setNotebookBlocks] = useState<React.ReactNode[] | null>(null);
  const [cleanSvg, setCleanSvg] = useState<string | null>(null);
  const [diagramZoomed, setDiagramZoomed] = useState(false);
  const [imageZoomed, setImageZoomed] = useState(false);

  const mathHtml = useMemo(() => (html ? renderLatexInHtml(html) : html), [html]);
  const mathNotebookHtml = useMemo(
    () => (notebookHtml ? renderLatexInHtml(notebookHtml) : notebookHtml || null),
    [notebookHtml]
  );

  useEffect(() => {
    setBlocks(mathHtml ? buildBlocks(mathHtml) : []);
  }, [mathHtml]);

  useEffect(() => {
    setNotebookBlocks(mathNotebookHtml ? buildBlocks(mathNotebookHtml) : null);
  }, [mathNotebookHtml]);

  useEffect(() => {
    setCleanSvg(diagramSvg ? sanitizeMathSvg(diagramSvg) : null);
  }, [diagramSvg]);

  useEffect(() => {
    if (!diagramZoomed && !imageZoomed) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDiagramZoomed(false);
        setImageZoomed(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [diagramZoomed, imageZoomed]);

  return (
    <div className="not-prose space-y-4">
      {imageUrl && (
        <>
          <button
            type="button"
            onClick={() => setImageZoomed(true)}
            title="Büyütmek için tıkla"
            className="block w-full cursor-zoom-in rounded-2xl border border-slate-100 bg-slate-50 shadow-sm transition hover:border-slate-200 hover:shadow-md"
          >
            <img
              src={imageUrl}
              alt={imageAlt || caption || 'Konu anlatım görseli'}
              className="w-full max-h-[420px] object-contain rounded-2xl"
              loading="lazy"
              decoding="async"
            />
          </button>
          {imageZoomed && typeof document !== 'undefined' && createPortal(
            <div
              className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 sm:p-8"
              onClick={() => setImageZoomed(false)}
            >
              <div
                className="relative max-h-full w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setImageZoomed(false)}
                  aria-label="Kapat"
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                >
                  ✕
                </button>
                <img
                  src={imageUrl}
                  alt={imageAlt || caption || 'Konu anlatım görseli'}
                  className="mx-auto h-auto w-full max-h-[80vh] object-contain"
                  decoding="async"
                />
              </div>
            </div>,
            document.body
          )}
        </>
      )}
      {cleanSvg && (
        <>
          <button
            type="button"
            onClick={() => setDiagramZoomed(true)}
            title="Büyütmek için tıkla"
            role="img"
            aria-label={caption || 'Konu anlatım diyagramı'}
            className="block w-full cursor-zoom-in rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-slate-200 hover:shadow-md [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-md"
            dangerouslySetInnerHTML={{ __html: cleanSvg }}
          />
          {diagramZoomed && typeof document !== 'undefined' && createPortal(
            <div
              className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 sm:p-8"
              onClick={() => setDiagramZoomed(false)}
            >
              <div
                className="relative max-h-full w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setDiagramZoomed(false)}
                  aria-label="Kapat"
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                >
                  ✕
                </button>
                <div role="img" aria-label={caption || 'Konu anlatım diyagramı'} dangerouslySetInnerHTML={{ __html: cleanSvg }} />
              </div>
            </div>,
            document.body
          )}
        </>
      )}
      {notebookHtml ? (
        <>
          <ExplanationBox>
            <div className="space-y-3 text-sm sm:text-base leading-relaxed text-slate-700 [&_h1]:text-lg [&_h1]:font-black [&_h1]:text-slate-900 [&_h2]:text-lg [&_h2]:font-black [&_h2]:text-slate-900 [&_h3]:flex [&_h3]:items-center [&_h3]:gap-1.5 [&_h3]:text-sm [&_h3]:sm:text-base [&_h3]:font-black [&_h3]:text-indigo-700 [&_h3]:before:content-[''] [&_h3]:before:h-1.5 [&_h3]:before:w-1.5 [&_h3]:before:shrink-0 [&_h3]:before:rounded-full [&_h3]:before:bg-indigo-400 [&_strong]:font-black [&_strong]:text-indigo-700 [&_em]:italic [&_em]:text-sky-700">
              {blocks ?? (mathHtml ? <div dangerouslySetInnerHTML={{ __html: mathHtml }} /> : null)}
            </div>
          </ExplanationBox>
          <NotebookBox label="Defterine Not Al">{notebookBlocks}</NotebookBox>
        </>
      ) : (
        <NotebookBox>
          {blocks ?? (mathHtml ? <div dangerouslySetInnerHTML={{ __html: mathHtml }} /> : null)}
        </NotebookBox>
      )}
    </div>
  );
}
