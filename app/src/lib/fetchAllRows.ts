// PostgREST tek istekte en fazla 1000 satır döndürür (Supabase max-rows) — sınırı aşan bir
// sorgu hata vermez, SESSİZCE ilk 1000 satırı döner. Satır sayısı büyüyebilen sorgularda
// (kullanıcının tüm cevapları, bir konu kümesinin tüm soruları…) bunu kullanın. Sadece sayı
// gerekiyorsa satır çekmek yerine DB'de sayın (ör. count_questions_by_topic RPC'si).
//
// build(from, to) her sayfa için YENİ bir sorgu kurmalı ve kararlı bir sıralama (genelde
// .order('id')) içermeli — aksi halde sayfalar arasında satır atlanabilir/tekrarlanabilir.
const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data as T[] | null) || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}
