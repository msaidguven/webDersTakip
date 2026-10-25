// Word çıktısı için **kalın** işaretlerini siler ve satır içi LaTeX'i (\( ... \), \[ ... \]) okunur düz metne çevirir. Word'de KaTeX yok;
// klasik sorulardaki matematik basit (×, ÷, üs, üstü çizili rakam, kesir), Unicode karşılığı yeterli.
const SUPERSCRIPT: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '⁺', n: 'ⁿ' };
const SYMBOLS: Record<string, string> = {
  times: '×', div: '÷', cdot: '·', pm: '±', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠',
  approx: '≈', degree: '°', circ: '°', pi: 'π', infty: '∞', angle: '∠', triangle: '△', perp: '⊥', parallel: '∥',
  ldots: '…', dots: '…', quad: ' ', qquad: '  ', left: '', right: '',
};

function convertMath(src: string): string {
  let s = src;
  // \frac{a}{b} → a/b (iç içe kesir nadir; tek seviye yeter)
  s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a: string, b: string) => `${a.length > 1 ? `(${a})` : a}/${b.length > 1 ? `(${b})` : b}`);
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
  // \overline{A14} → A̅1̅4̅ (rakam rakam üstü çizili)
  s = s.replace(/\\overline\{([^{}]*)\}/g, (_, x: string) => [...x].map((c) => `${c}̅`).join(''));
  s = s.replace(/\\(?:text|mathrm|mathbf|operatorname)\{([^{}]*)\}/g, '$1');
  s = s.replace(/\^\{([^{}]*)\}|\^(.)/g, (m, group: string | undefined, single: string | undefined) => {
    const raw = group ?? single ?? '';
    return [...raw].every((c) => SUPERSCRIPT[c]) ? [...raw].map((c) => SUPERSCRIPT[c]).join('') : `^${raw}`;
  });
  s = s.replace(/_\{([^{}]*)\}/g, '_$1');
  s = s.replace(/\\([a-zA-Z]+)/g, (m, name: string) => SYMBOLS[name] ?? name);
  s = s.replace(/\\[,;:! ]/g, ' ').replace(/[{}]/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

// Soru metinlerindeki **kalın** vurgu (bkz. topicContentV11.ts renderPlainTextMath). Düz metin
// gereken yerlerde (Word, paylaşım metni, kısa liste satırı) işaretler silinir, sözcük kalır.
export const EMPHASIS_RE = /\*\*([^*\n]+?)\*\*/g;

export function stripEmphasis(text: string): string {
  return text.replace(EMPHASIS_RE, '$1');
}

export function latexToPlain(text: string): string {
  return stripEmphasis(text).replace(/\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g, (_, inline: string | undefined, display: string | undefined) =>
    convertMath(inline ?? display ?? '')
  );
}
