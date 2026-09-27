const LETTERS = [
  'a', 'b', 'c', 'ç', 'd', 'e', 'f', 'g', 'ğ', 'h', 'ı', 'i', 'j', 'k', 'l',
  'm', 'n', 'o', 'ö', 'p', 'r', 's', 'ş', 't', 'u', 'ü', 'v', 'y', 'z',
];

export function outcomeLetterAt(index: number): string {
  if (index < LETTERS.length) return LETTERS[index];
  // 29 harflik Türk alfabesi bittiyse (pratikte olmaz) alfabeyi tekrar dolaşıp sıra numarası ekler.
  const cycle = Math.floor(index / LETTERS.length) + 1;
  return `${LETTERS[index % LETTERS.length]}${cycle}`;
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

// ---------------------------------------------------------------------------------------
// Prompt'taki kazanım ANAHTARLARI + AI'ın döndürdüğü kodu geri çözme (2026-09-27).
//
// Bir konu birden fazla öğrenme çıktısı (topic_learning_outcomes) içerebiliyor ve her birinin
// kazanımları kendi içinde a, b, c diye numaralı — yani aynı konuda iki tane "a" olabiliyor.
// AI'a sadece "a) … / a) …" verildiğinde hangisini kastettiğini yazamıyor, kendi kodunu
// uyduruyordu (F.5.2.1.1, FB.7.2.1.a …); bunlar eşleşmeyip sessizce atılıyor, bölümler
// kazanımsız kalıyor, soru worker'ı da o konuları atlıyordu (13 konu etkilendi).
//
// Kural: harfler konu içinde benzersizse anahtar = harf (eskisiyle birebir aynı prompt);
// tekrar varsa anahtar = "<öğrenme çıktısı kodu>.<harf>" (ör. FB.5.2.1.a).
// ---------------------------------------------------------------------------------------

export type KeyableOutcome = { id: number; code: string | null; learningOutcomeCode?: string | null };

export function buildOutcomeKeys<T extends KeyableOutcome>(outcomes: T[]): Map<number, string> {
  const letters = outcomes.map((o) => o.code?.trim() || '');
  const hasDuplicateLetters = new Set(letters).size < letters.length;
  const keys = new Map<number, string>();
  const used = new Set<string>();
  outcomes.forEach((o, idx) => {
    const letter = letters[idx] || outcomeLetterAt(idx);
    const lo = o.learningOutcomeCode?.trim();
    let key = hasDuplicateLetters && lo ? `${lo}.${letter}` : letter;
    // Öğrenme çıktısı kodu yoksa ya da yine çakışıyorsa: a, a2, a3…
    for (let n = 2; used.has(key); n++) key = `${letter}${n}`;
    used.add(key);
    keys.set(o.id, key);
  });
  return keys;
}

function normalizeCode(raw: string): string {
  return raw.trim().replace(/^[(\[]+|[)\].:\s]+$/g, '').toLocaleLowerCase('tr');
}

// AI'ın döndürdüğü kodu kazanım id'sine çevirir; emin olamıyorsa null (TAHMİN ETMEZ — yanlış
// kazanıma bağlanan bölüm, yanlış kazanıma soru üretilmesi demek).
//   1) anahtarla birebir (FB.5.2.1.a / a)
//   2) tek harf ve o harf konuda tekse
//   3) "<öğrenme çıktısı kodu>.<harf>" — tek öğrenme çıktılı konularda AI tam kod yazdıysa
export function resolveOutcomeCode<T extends KeyableOutcome>(raw: string, outcomes: T[], keys: Map<number, string>): number | null {
  const norm = normalizeCode(raw);
  if (!norm) return null;
  for (const o of outcomes) if (normalizeCode(keys.get(o.id) || '') === norm) return o.id;

  const byLetter = (letter: string) => outcomes.filter((o) => normalizeCode(o.code || '') === letter);
  if (!norm.includes('.')) {
    const matches = byLetter(norm);
    return matches.length === 1 ? matches[0].id : null;
  }
  const dot = norm.lastIndexOf('.');
  const prefix = norm.slice(0, dot);
  const letter = norm.slice(dot + 1);
  const matches = byLetter(letter).filter((o) => normalizeCode(o.learningOutcomeCode || '') === prefix);
  return matches.length === 1 ? matches[0].id : null;
}

// outcomes satırlarına öğrenme çıktısı kodunu (topic_learning_outcomes.code) ekler.
export async function attachLearningOutcomeCodes<T extends { learning_outcome_id?: number | null }>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  outcomes: T[]
): Promise<(T & { learningOutcomeCode: string | null })[]> {
  const loIds = [...new Set(outcomes.map((o) => o.learning_outcome_id).filter((id): id is number => id != null))];
  const codeById = new Map<number, string | null>();
  if (loIds.length) {
    const { data } = await supabase.from('topic_learning_outcomes').select('id, code').in('id', loIds);
    for (const row of (data as { id: number; code: string | null }[] | null) || []) codeById.set(row.id, row.code);
  }
  return outcomes.map((o) => ({ ...o, learningOutcomeCode: o.learning_outcome_id != null ? codeById.get(o.learning_outcome_id) ?? null : null }));
}
