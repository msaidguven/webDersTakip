// topic_contents_v11.payload -> tek parça HTML dönüşümü.
// Şema: { lessonModule: { title, sections: [{ title, icon, content: [{ type, content }] }] } }

function asRecord(x: unknown): Record<string, unknown> | null {
  if (!x || typeof x !== 'object') return null;
  return x as Record<string, unknown>;
}

function safeText(x: unknown, fallback = ''): string {
  return typeof x === 'string' ? x : fallback;
}

export function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

type ListItemLine = { indent: number; marker: 'ul' | 'ol'; text: string };

// items[start..] aynı girinti+madde tipindeki kardeşleri tüketir; daha derin girintili
// satırlarla karşılaşınca, üstündeki <li> kapanmadan içine iç içe bir liste açar.
function parseListLevel(items: ListItemLine[], start: number, indent: number, inline: (s: string) => string): [string, number] {
  const marker = items[start].marker;
  const liHtmls: string[] = [];
  let idx = start;

  while (idx < items.length && items[idx].indent === indent && items[idx].marker === marker) {
    let liContent = inline(items[idx].text);
    idx += 1;
    if (idx < items.length && items[idx].indent > indent) {
      const [childHtml, nextIdx] = parseListLevel(items, idx, items[idx].indent, inline);
      liContent += childHtml;
      idx = nextIdx;
    }
    liHtmls.push(`<li>${liContent}</li>`);
  }

  return [`<${marker}>${liHtmls.join('')}</${marker}>`, idx];
}

function renderListBlock(items: ListItemLine[], inline: (s: string) => string): string {
  const htmls: string[] = [];
  let idx = 0;
  while (idx < items.length) {
    const [html, nextIdx] = parseListLevel(items, idx, items[idx].indent, inline);
    htmls.push(html);
    idx = nextIdx;
  }
  return htmls.join('\n');
}

export function markdownToHtml(md: string) {
  const src = escapeHtml(md).replaceAll('\r\n', '\n');
  const lines = src.split('\n');
  const out: string[] = [];
  let listItems: ListItemLine[] = [];

  const inline = (s: string) =>
    s
      .replaceAll(/`([^`]+)`/g, '<code>$1</code>')
      .replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  const flushList = () => {
    if (listItems.length) {
      out.push(renderListBlock(listItems, inline));
      listItems = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }

    if (line.startsWith('### ')) {
      flushList();
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
      continue;
    }

    const ul = line.match(/^(\s*)-\s+(.*)$/);
    if (ul) {
      listItems.push({ indent: ul[1].length, marker: 'ul', text: ul[2] });
      continue;
    }

    const ol = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (ol) {
      listItems.push({ indent: ol[1].length, marker: 'ol', text: ol[2] });
      continue;
    }

    flushList();
    out.push(`<p>${inline(line)}</p>`);
  }

  flushList();
  return out.join('\n');
}

function misconceptionToHtml(wrong: string, correct: string, tip: string) {
  const tipHtml = tip
    ? `<div style="border:1px solid #fde68a;background:#fffbeb;border-radius:10px;padding:10px 14px;color:#92400e;font-size:0.95em;display:flex;gap:10px;margin-top:8px;"><strong>💡</strong><span>${escapeHtml(tip)}</span></div>`
    : '';

  return `<div style="border:1px solid #e2e8f0;background:#f8fafc;border-radius:14px;padding:18px;margin:1.5em 0;">
  <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#dc2626;margin-bottom:12px;">⚠️ Yaygın Yanlış Anlama</div>
  <div style="border:1px solid #fecdd3;background:#fff1f2;border-radius:10px;padding:10px 14px;color:#9f1239;font-size:0.95em;display:flex;gap:10px;margin-bottom:8px;"><strong>✗</strong><span>${escapeHtml(wrong)}</span></div>
  <div style="border:1px solid #bbf7d0;background:#f0fdf4;border-radius:10px;padding:10px 14px;color:#166534;font-size:0.95em;display:flex;gap:10px;"><strong>✓</strong><span>${escapeHtml(correct)}</span></div>
  ${tipHtml}
</div>`;
}

function imageBlockToHtml(svg: string, caption: string) {
  const captionHtml = caption
    ? `<figcaption style="text-align:center;font-size:0.85em;color:#94a3b8;font-style:italic;margin-top:10px;">${escapeHtml(caption)}</figcaption>`
    : '';
  return `<figure style="margin:1.5em 0;">${svg}${captionHtml}</figure>`;
}

export function topicContentV11ToHtml(payload: unknown): string | null {
  const p = asRecord(payload);
  if (!p) return null;

  const lessonModule = asRecord(p.lessonModule) || p;
  const sectionsRaw = lessonModule.sections;
  if (!Array.isArray(sectionsRaw) || sectionsRaw.length === 0) return null;

  const sections = sectionsRaw
    .map((s, idx) => {
      const so = asRecord(s) || {};
      const order = typeof so.order === 'number' ? so.order : idx + 1;
      const title = safeText(so.title, '');
      const icon = safeText(so.icon, '');

      const contentRaw = so.content;
      const blocksHtml: string[] = Array.isArray(contentRaw)
        ? contentRaw
            .map((b) => {
              const bo = asRecord(b);
              if (!bo) return '';
              const type = safeText(bo.type);
              const contentObj = asRecord(bo.content) || {};

              if (type === 'markdown') {
                return markdownToHtml(safeText(contentObj.body));
              }
              if (type === 'image') {
                const svg = safeText(contentObj.svgCode);
                if (!svg) return '';
                return imageBlockToHtml(svg, safeText(contentObj.caption));
              }
              if (type === 'misconception') {
                return misconceptionToHtml(
                  safeText(contentObj.wrong),
                  safeText(contentObj.correct),
                  safeText(contentObj.tip)
                );
              }
              // quiz ve tanınmayan blok tipleri konu anlatımı metnine dahil edilmez.
              return '';
            })
            .filter(Boolean)
        : [];

      if (!blocksHtml.length) return '';

      const heading = title ? `<h2>${icon ? `${icon} ` : ''}${escapeHtml(title)}</h2>` : '';
      return { order, html: `${heading}\n${blocksHtml.join('\n')}` };
    })
    .filter((s): s is { order: number; html: string } => Boolean(s))
    .sort((a, b) => a.order - b.order)
    .map((s) => s.html);

  return sections.length ? sections.join('\n\n') : null;
}
