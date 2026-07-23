'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { GraduationCap, ChevronLeft, Check } from 'lucide-react';

type ModuleBlock =
  | { type: 'markdown'; body: string }
  | { type: 'svg'; svg: string; caption?: string }
  | { type: 'misconception'; wrong: string; correct: string; tip?: string };

type ModuleSection = {
  id: string;
  order: number;
  title: string;
  icon?: string;
  content: ModuleBlock[];
};

type ModuleData = {
  topic: { id: number; title: string; slug: string; unit_id: number };
  moduleTitle: string;
  sections: ModuleSection[];
};

function safeText(x: unknown, fallback = ''): string {
  return typeof x === 'string' ? x : fallback;
}

function asRecord(x: unknown): Record<string, unknown> | null {
  if (!x || typeof x !== 'object') return null;
  return x as Record<string, unknown>;
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function markdownToHtml(md: string) {
  // Minimal, safe-ish markdown renderer for our known content.
  // We intentionally escape HTML first, then apply markdown transforms.
  const src = escapeHtml(md).replaceAll('\r\n', '\n');

  const lines = src.split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const flushLists = () => {
    if (inUl) out.push('</ul>');
    if (inOl) out.push('</ol>');
    inUl = false;
    inOl = false;
  };

  const inline = (s: string) =>
    s
      .replaceAll(/`([^`]+)`/g, '<code>$1</code>')
      .replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushLists();
      continue;
    }

    if (line.startsWith('### ')) {
      flushLists();
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushLists();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      flushLists();
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
      continue;
    }

    const ul = line.match(/^\s*-\s+(.*)$/);
    if (ul) {
      if (inOl) {
        out.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    flushLists();
    out.push(`<p>${inline(line)}</p>`);
  }

  flushLists();
  return out.join('\n');
}

function normalizeV11ToModule(payload: unknown, fallbackTitle: string): { moduleTitle: string; sections: ModuleSection[] } {
  const p = asRecord(payload);
  if (!p) {
    return {
      moduleTitle: fallbackTitle,
      sections: [
        {
          id: 'section_01',
          order: 1,
          title: fallbackTitle,
          icon: '📘',
          content: [{ type: 'markdown', body: `<p>İçerik bulunamadı.</p>` }],
        },
      ],
    };
  }

  // Our DB JSON is stored like topicContent.json:
  // { lessonModule: { title, sections:[{ content:[{type, content:{...}}] }]} }
  const lessonModule = asRecord(p.lessonModule) || p;
  const moduleTitle = safeText(lessonModule.title, fallbackTitle) || fallbackTitle;

  const sectionsRaw = lessonModule.sections;
  if (!Array.isArray(sectionsRaw) || sectionsRaw.length === 0) {
    return {
      moduleTitle,
      sections: [
        {
          id: 'section_01',
          order: 1,
          title: moduleTitle,
          icon: '📘',
          content: [{ type: 'markdown', body: `<p>İçerik bulunamadı.</p>` }],
        },
      ],
    };
  }

  const sections: ModuleSection[] = sectionsRaw
    .map((s, idx) => {
      const so = asRecord(s) || {};
      const id = safeText(so.id, `section_${String(idx + 1).padStart(2, '0')}`);
      const order = typeof so.order === 'number' ? so.order : idx + 1;
      const title = safeText(so.title, `Bölüm ${order}`);
      const icon = safeText(so.icon, '📘');

      const contentRaw = so.content;
      const content: ModuleBlock[] = Array.isArray(contentRaw)
        ? contentRaw
            .map((b) => {
              const bo = asRecord(b);
              if (!bo) return null;
              const type = safeText(bo.type);
              const contentObj = asRecord(bo.content) || {};

              if (type === 'markdown') {
                const md = safeText(contentObj.body);
                return { type: 'markdown', body: markdownToHtml(md) } as const;
              }

              if (type === 'image') {
                const svg = safeText(contentObj.svgCode);
                const caption = safeText(contentObj.caption);
                if (!svg) return null;
                return { type: 'svg', svg, caption } as const;
              }

              if (type === 'misconception') {
                return {
                  type: 'misconception',
                  wrong: safeText(contentObj.wrong),
                  correct: safeText(contentObj.correct),
                  tip: safeText(contentObj.tip),
                } as const;
              }
              // Unknown block types -> ignore for now
              return null;
            })
            .filter((x): x is ModuleBlock => x !== null)
        : [];

      return { id, order, title, icon, content };
    })
    .filter((x) => x.content.length > 0);

  return {
    moduleTitle,
    sections: sections.length
      ? sections.sort((a, b) => a.order - b.order)
      : [
          {
            id: 'section_01',
            order: 1,
            title: moduleTitle,
            icon: '📘',
            content: [{ type: 'markdown', body: `<p>İçerik bulunamadı.</p>` }],
          },
        ],
  };
}

export default function TopicDetailPageClient({ gradeSlug, lessonSlug, unitSlug, topicSlug }: { gradeSlug: string; lessonSlug: string; unitSlug: string; topicSlug: string }) {
  const [data, setData] = useState<ModuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      
      // Topic'i bul (slug veya id)
      let topicQuery = supabase.from('topics').select('*');
      if (!isNaN(Number(topicSlug))) {
        topicQuery = topicQuery.eq('id', topicSlug);
      } else {
        topicQuery = topicQuery.eq('slug', topicSlug);
      }
      
      const { data: topicData } = await topicQuery.single();
      
      if (!topicData) {
        setLoading(false);
        return;
      }

      // V11 içerik (öncelikli)
      const { data: v11 } = await supabase
        .from('topic_contents_v11')
        .select('title, payload, version_no')
        .eq('topic_id', topicData.id)
        .eq('is_published', true)
        .order('version_no', { ascending: false })
        .limit(1)
        .maybeSingle();

      let moduleTitle = topicData.title as string;
      let sections: ModuleSection[] = [];

      if (v11?.payload) {
        const normalized = normalizeV11ToModule(v11.payload, topicData.title as string);
        moduleTitle = v11.title || normalized.moduleTitle || topicData.title;
        sections = normalized.sections;
      } else {
        // Fallback: v0 topic_contents -> tek bölüm gibi göster
        const { data: contentsData } = await supabase
          .from('topic_contents')
          .select('title, content, order_no')
          .eq('topic_id', topicData.id)
          .order('order_no');

        const blocks: ModuleBlock[] = ((contentsData as { title: string; content: string; order_no: number }[] | null) || []).map((c) => ({
          type: 'markdown',
          body: `<h2>${c.title}</h2>${c.content}`,
        }));

        sections = [
          {
            id: 'section_01',
            order: 1,
            title: topicData.title as string,
            icon: '📘',
            content: blocks.length ? blocks : [{ type: 'markdown', body: `<p>İçerik bulunamadı.</p>` }],
          },
        ];
      }

      setActiveSectionIdx(0);
      setData({
        topic: topicData,
        moduleTitle,
        sections,
      });
      setLoading(false);
    }

    load();
  }, [topicSlug]);

  if (loading) return <div className="p-8">Yükleniyor...</div>;
  if (!data) return <div className="p-8">Konu bulunamadı</div>;

  const activeSection = data.sections[Math.min(activeSectionIdx, data.sections.length - 1)];

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e8eaf0]">
      {/* Sticky Header (lessonModul referansı) */}
      <div className="sticky top-0 z-20 h-16 px-6 border-b border-[#2e3348] bg-gradient-to-br from-[#1a1d27] to-[#12151f] flex items-center gap-4">
        <span className="text-[11px] font-extrabold tracking-[0.18em] uppercase rounded-full bg-[#6c63ff] px-3 py-1 text-white">
          {gradeSlug.replaceAll('-', ' ')}
        </span>

        <div className="min-w-0 font-extrabold text-sm truncate">
          {data.moduleTitle}
        </div>

        <div className="ml-auto hidden md:flex items-center gap-3 text-xs text-[#8b90a7] font-semibold">
          <span className="flex items-center gap-1"><GraduationCap className="h-4 w-4" /> Modül</span>
          <span className="text-[#e8eaf0] font-extrabold">{activeSectionIdx + 1}/{data.sections.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] min-h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <aside className="hidden md:block border-r border-[#2e3348] bg-[#1a1d27] sticky top-16 h-[calc(100vh-64px)] overflow-y-auto py-6">
          <div className="px-5 text-[11px] font-extrabold tracking-[0.18em] uppercase text-[#8b90a7] mb-3">
            Modül İçeriği
          </div>

          <div className="px-2 space-y-2">
            {data.sections.map((s, idx) => {
              const isActive = idx === activeSectionIdx;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSectionIdx(idx)}
                  className={[
                    'w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
                    isActive ? 'bg-[#6c63ff]/10 text-[#e8eaf0]' : 'text-[#8b90a7] hover:bg-[#222636] hover:text-[#e8eaf0]',
                    'border border-transparent hover:border-[#2e3348]',
                  ].join(' ')}
                >
                  <div className="h-9 w-9 rounded-lg bg-[#222636] border border-[#2e3348] flex items-center justify-center text-base shrink-0">
                    {s.icon || '📘'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{s.title}</div>
                    <div className="text-[11px] font-semibold text-[#8b90a7]">Bölüm {s.order}</div>
                  </div>
                  {isActive ? <Check className="h-4 w-4 text-[#43e97b]" /> : null}
                </button>
              );
            })}

            <div className="px-3 pt-4">
              <Link
                href={`/${gradeSlug}/${lessonSlug}/${unitSlug}`}
                className="inline-flex items-center gap-2 text-xs font-bold text-[#8b90a7] hover:text-[#e8eaf0] transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Konulara Dön
              </Link>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="px-5 sm:px-8 py-8 max-w-[860px]">
          {/* Mobile back */}
          <div className="md:hidden mb-6">
            <Link
              href={`/${gradeSlug}/${lessonSlug}/${unitSlug}`}
              className="inline-flex items-center gap-2 text-sm font-bold text-[#8b90a7] hover:text-[#e8eaf0] transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
              Konulara Dön
            </Link>
          </div>

          {/* Section header */}
          <div className="flex items-start gap-4 mb-8">
            <div className="h-14 w-14 rounded-2xl bg-[#222636] border border-[#2e3348] flex items-center justify-center text-2xl shrink-0">
              {activeSection.icon || '📘'}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-[#8b90a7]">
                Bölüm {activeSection.order} / {data.sections.length}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black leading-tight mt-1">{activeSection.title}</h1>
            </div>
          </div>

          {/* Content blocks */}
          <div className="space-y-5">
            {activeSection.content.map((block, i) => {
              if (block.type === 'markdown') {
                return (
                  <section
                    key={i}
                    className="bg-[#1a1d27] border border-[#2e3348] rounded-2xl p-7"
                  >
                    <div
                      className="prose prose-invert max-w-none prose-headings:font-extrabold prose-h2:text-xl prose-h3:text-base prose-h3:text-[#4facfe] prose-p:text-[#c8cad8] prose-li:text-[#c8cad8] prose-strong:text-[#e8eaf0] prose-a:text-[#6c63ff]"
                      dangerouslySetInnerHTML={{ __html: block.body }}
                    />
                  </section>
                );
              }

              if (block.type === 'svg') {
                return (
                  <section
                    key={i}
                    className="bg-[#1a1d27] border border-[#2e3348] rounded-2xl p-5"
                  >
                    <div dangerouslySetInnerHTML={{ __html: block.svg }} />
                    {block.caption ? (
                      <div className="text-center text-xs text-[#8b90a7] mt-3 italic">{block.caption}</div>
                    ) : null}
                  </section>
                );
              }

              if (block.type === 'misconception') {
                return (
                  <section
                    key={i}
                    className="bg-[#1a1d27] border border-[#2e3348] rounded-2xl p-6"
                  >
                    <div className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-[#ff6584] mb-4">
                      ⚠️ Yaygın Yanlış Anlama
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-xl border border-[#ff6584]/30 bg-[#ff6584]/10 px-4 py-3 text-sm text-[#e8a0ad] flex gap-3">
                        <span className="font-black">✗</span>
                        <div>{block.wrong}</div>
                      </div>
                      <div className="rounded-xl border border-[#43e97b]/30 bg-[#43e97b]/10 px-4 py-3 text-sm text-[#96e6b0] flex gap-3">
                        <span className="font-black">✓</span>
                        <div>{block.correct}</div>
                      </div>
                      {block.tip ? (
                        <div className="rounded-xl border border-[#f7971e]/30 bg-[#f7971e]/10 px-4 py-3 text-sm text-[#f7c97e] flex gap-3">
                          <span className="font-black">💡</span>
                          <div>{block.tip}</div>
                        </div>
                      ) : null}
                    </div>
                  </section>
                );
              }

              return null;
            })}
          </div>

          {/* Bottom nav */}
          <div className="mt-10 pt-6 border-t border-[#2e3348] flex items-center justify-between gap-4">
            <button
              onClick={() => setActiveSectionIdx((x) => Math.max(0, x - 1))}
              disabled={activeSectionIdx === 0}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[#2e3348] bg-[#1a1d27] text-sm font-extrabold disabled:opacity-40"
            >
              ← Önceki
            </button>

            <div className="text-xs font-semibold text-[#8b90a7]">
              {activeSectionIdx + 1} / {data.sections.length}
            </div>

            <button
              onClick={() => setActiveSectionIdx((x) => Math.min(data.sections.length - 1, x + 1))}
              disabled={activeSectionIdx >= data.sections.length - 1}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[#6c63ff] bg-[#6c63ff] text-sm font-extrabold text-white disabled:opacity-40"
            >
              Sonraki →
            </button>
          </div>

          {/* Test CTA (mevcut route) */}
          <div className="mt-8">
            <Link
              href={`/${gradeSlug}/${lessonSlug}/${unitSlug}/${topicSlug}/test`}
              className="inline-flex items-center justify-center rounded-2xl px-7 py-4 font-extrabold text-white bg-gradient-to-r from-[#2563eb] via-[#6c63ff] to-[#43e97b]"
            >
              📝 Konu Testi Çöz
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
