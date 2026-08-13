const LETTERS = ['a', 'b', 'c', 'ç', 'd', 'e', 'f', 'g', 'ğ', 'h', 'ı', 'i', 'j', 'k', 'l'];

export function outcomeLetterAt(index: number): string {
  return LETTERS[index] ?? `k${index + 1}`;
}

type CodedOutcome = { id: number; order_index: number | null; code: string | null; startWeek?: number | null };

// order_index tek başına güvenilir değil: kaynak müfredat dokümanında her hafta
// kendi "a,b,c..." listesiyle 1'den başlıyor, yani aynı konudaki farklı haftalara
// ait kazanımlar aynı order_index değerini paylaşabiliyor. Önce haftaya, hafta eşitse
// order_index'e göre sıralayarak haftalar arası rastgele iç içe geçmeyi önlüyoruz.
function compareOutcomes(a: CodedOutcome, b: CodedOutcome): number {
  const weekA = a.startWeek ?? Infinity;
  const weekB = b.startWeek ?? Infinity;
  if (weekA !== weekB) return weekA - weekB;
  return (a.order_index ?? 0) - (b.order_index ?? 0);
}

export function sortOutcomesByWeek<T extends CodedOutcome>(outcomes: T[]): T[] {
  return [...outcomes].sort(compareOutcomes);
}

// Görüntüleme amaçlı: DB'deki gerçek code varsa onu kullanır, yoksa
// sırasına göre bir önizleme harfi üretir (DB'ye yazmaz).
export function withPreviewCodes<T extends CodedOutcome>(outcomes: T[]) {
  const sorted = sortOutcomesByWeek(outcomes);
  return sorted.map((o, idx) => ({ ...o, code: o.code?.trim() || null, previewCode: o.code?.trim() || outcomeLetterAt(idx) }));
}

// code'u NULL olan kazanımlara, sıralarına göre atanacak harfleri hesaplar.
// Zaten code'u olan kazanımlara dokunmaz.
export function computeMissingCodeAssignments<T extends CodedOutcome>(outcomes: T[]) {
  const sorted = sortOutcomesByWeek(outcomes);
  return sorted
    .map((o, idx) => ({ id: o.id, code: outcomeLetterAt(idx) }))
    .filter((assignment, idx) => !sorted[idx].code?.trim());
}
