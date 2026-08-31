// Ders notu metnini 500-800 token hedefli, hafif örtüşmeli parçalara böler.
// Gerçek bir tokenizer çağırmak (her cümle için) gereksiz yavaş olacağından,
// yaygın bir yaklaşım olan karakter/4 ≈ token tahminini kullanıyoruz.

export type TextChunk = { content: string; tokenCount: number };

const MIN_TOKENS = 500;
const MAX_TOKENS = 800;
const OVERLAP_TOKENS = 100;
const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// Paragraf ve cümle sınırlarında bölerek parçaların ortasından kelime kesmemeye çalışır.
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…:])\s+|\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function chunkText(text: string): TextChunk[] {
  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) return [];

  const chunks: TextChunk[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  let i = 0;
  while (i < sentences.length) {
    const sentence = sentences[i];
    const sentenceTokens = estimateTokens(sentence);

    current.push(sentence);
    currentTokens += sentenceTokens;
    i++;

    const isLast = i >= sentences.length;
    if (currentTokens >= MAX_TOKENS || (isLast && currentTokens >= MIN_TOKENS) || isLast) {
      const content = current.join(' ').trim();
      if (content) chunks.push({ content, tokenCount: estimateTokens(content) });

      if (isLast) break;

      // Örtüşme: bir sonraki parçaya son ~OVERLAP_TOKENS kadar cümleyi taşı.
      let overlapTokens = 0;
      const overlapSentences: string[] = [];
      for (let j = current.length - 1; j >= 0 && overlapTokens < OVERLAP_TOKENS; j--) {
        overlapSentences.unshift(current[j]);
        overlapTokens += estimateTokens(current[j]);
      }
      current = overlapSentences;
      currentTokens = overlapTokens;
    }
  }

  return chunks;
}
