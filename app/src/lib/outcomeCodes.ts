const LETTERS = ['a', 'b', 'c', 'ç', 'd', 'e', 'f', 'g', 'ğ', 'h', 'ı', 'i', 'j', 'k', 'l'];

export function outcomeLetterAt(index: number): string {
  return LETTERS[index] ?? `k${index + 1}`;
}

type CodedOutcome = { id: number; order_index: number | null; code: string | null };

// Görüntüleme amaçlı: DB'deki gerçek code varsa onu kullanır, yoksa
// sırasına göre bir önizleme harfi üretir (DB'ye yazmaz).
export function withPreviewCodes<T extends CodedOutcome>(outcomes: T[]) {
  const sorted = [...outcomes].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  return sorted.map((o, idx) => ({ ...o, code: o.code?.trim() || null, previewCode: o.code?.trim() || outcomeLetterAt(idx) }));
}

// code'u NULL olan kazanımlara, sıralarına göre atanacak harfleri hesaplar.
// Zaten code'u olan kazanımlara dokunmaz.
export function computeMissingCodeAssignments<T extends CodedOutcome>(outcomes: T[]) {
  const sorted = [...outcomes].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  return sorted
    .map((o, idx) => ({ id: o.id, code: outcomeLetterAt(idx) }))
    .filter((assignment, idx) => !sorted[idx].code?.trim());
}
