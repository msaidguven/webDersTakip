// Hap bilgi kartı (topic_content_sections.recap_card, bkz. supabase/migrations/topic_sections_recap_card.sql).
// Saf veri + doğrulama — hem üretim (recapCardsGen.ts) hem sayfa verisi (lessonWeekData.ts) kullanır.
// Maddeler satır içi markdown: **kalın** (renkli vurgu) ve matematikte $LaTeX$.
import katex from 'katex';

export type RecapCardGroup = { label: string | null; items: string[] };
export type RecapCard = {
  intro: string | null;
  groups: RecapCardGroup[];
  tags: string[];
  // Ek bilgi (turuncu "Not") ve sık karıştırılan / sınav tuzağı (kırmızı "Dikkat").
  note: string | null;
  warnings: string[];
  // Yalnız matematik: "kural + mini örnek". Şekil gerekiyorsa model yalnız tarif yazar (figure_prompt), SVG'yi
  // sonra Claude çizer (scripts/recap-figures.ts) — çizilene kadar örnek gösterilmez.
  example: { question: string; solution: string; figure_prompt: string | null; figure_svg: string | null } | null;
};

export const recapCardNeedsFigure = (card: RecapCard) => !!card.example?.figure_prompt && !card.example.figure_svg;

// Kaydedilecek şekil: sayfadaki sanitizeMathSvg ile aynı sınırlar (orada reddedilecek SVG kaydedilmesin).
export function isRecapFigureSvg(svg: string): boolean {
  const s = svg.trim();
  return s.startsWith('<svg') && s.endsWith('</svg>') && s.length <= 20_000;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

// DB'den ya da modelden gelen ham değeri temizler; kullanılabilir madde yoksa null (kart gösterilmez).
export function normalizeRecapCard(raw: unknown): RecapCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const groups = (Array.isArray(obj.groups) ? obj.groups : [])
    .map((g): RecapCardGroup | null => {
      if (!g || typeof g !== 'object') return null;
      const row = g as Record<string, unknown>;
      const items = (Array.isArray(row.items) ? row.items : []).map(str).filter(Boolean);
      return items.length ? { label: str(row.label) || null, items } : null;
    })
    .filter((g): g is RecapCardGroup => g !== null);
  if (!groups.length) return null;

  const ex = obj.example && typeof obj.example === 'object' ? (obj.example as Record<string, unknown>) : null;
  const question = str(ex?.question);
  const solution = str(ex?.solution);
  const figurePrompt = str(ex?.figure_prompt);
  const figureSvg = str(ex?.figure_svg);
  return {
    intro: str(obj.intro) || null,
    groups,
    tags: (Array.isArray(obj.tags) ? obj.tags : []).map(str).filter(Boolean).slice(0, 3),
    note: str(obj.note) || null,
    warnings: (Array.isArray(obj.warnings) ? obj.warnings : []).map(str).filter(Boolean).slice(0, 3),
    example: question && solution ? { question, solution, figure_prompt: figurePrompt || null, figure_svg: figureSvg || null } : null,
  };
}

// Sayfa için sunucu tarafında HTML'e çevrilmiş kart: **kalın** → <strong>, $…$ → KaTeX; geri kalan metin kaçışlanır.
export type RecapCardHtml = {
  introHtml: string | null;
  groups: { labelHtml: string | null; itemsHtml: string[] }[];
  tags: string[];
  noteHtml: string | null;
  warningsHtml: string[];
  // figureSvg ham SVG — istemcide sanitizeMathSvg'den geçirilerek basılır (RecapFigure.tsx).
  example: { questionHtml: string; stepsHtml: string[]; figureSvg: string | null } | null;
};

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Admin şekil ekranı da kullanır (soru/çözüm aynı biçimde görünsün).
export function inlineToHtml(text: string): string {
  // **$x$** biçiminde kalın formül bölünüp çıplak ** bırakmasın: formülde kalın düşürülür.
  return text
    .replace(/\*\*(\$[^$\n]+?\$)\*\*/g, '$1')
    .split(/(\$[^$\n]+?\$)/)
    .map((part) =>
      part.length > 2 && part.startsWith('$') && part.endsWith('$')
        ? katex.renderToString(part.slice(1, -1).trim(), { throwOnError: false })
        : escapeHtml(part).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    )
    .join('');
}

export function recapCardToHtml(card: RecapCard): RecapCardHtml {
  return {
    introHtml: card.intro ? inlineToHtml(card.intro) : null,
    groups: card.groups.map((g) => ({ labelHtml: g.label ? inlineToHtml(g.label) : null, itemsHtml: g.items.map(inlineToHtml) })),
    tags: card.tags,
    noteHtml: card.note ? inlineToHtml(card.note) : null,
    warningsHtml: card.warnings.map(inlineToHtml),
    example:
      card.example && !recapCardNeedsFigure(card)
        ? {
            questionHtml: inlineToHtml(card.example.question),
            stepsHtml: card.example.solution.split('\n').map((l) => l.trim()).filter(Boolean).map(inlineToHtml),
            figureSvg: card.example.figure_svg,
          }
        : null,
  };
}
