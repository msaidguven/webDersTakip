// Giriş yapmış öğrencinin test cevaplarını (test_session_answers) kaybetmeden sunucuya
// ulaştırır (kullanıcı bildirimi, 2026-09-27: "çözdüğü sorular boşa gitmesin"). Önceden her
// cevap tek bir insert'le gönderiliyor, hata olursa sadece console'a yazılıp kayboluyordu.
//
//   * Giden kutusu: her cevap ÖNCE localStorage'a yazılır, sunucu onaylayınca silinir —
//     sekme kapanır/ağ kopar/hata olursa bir sonraki ziyarette (AnswerOutboxFlusher) gönderilir.
//   * Yeniden deneme: geçici hatalarda artan aralıklarla tekrar dener.
//   * İdempotent: (test_session_id, question_id) benzersiz (bkz. supabase/migrations/
//     test_session_answers_dedupe_and_unique.sql) — aynı cevap iki kez gönderilse de (yeniden
//     deneme, iki sekme, sayfa kapanışı) tek satır oluşur.
//   * Güvenlik (2026-10-08, Sınav Hazırlık'taki düzeltmenin aynısı): tablo doğrudan yazılmaz;
//     submit_test_answers RPC'si oturum sahipliğini ve cevabın soruya aitliğini denetler,
//     doğruluğu SUNUCUDA hesaplar (bkz. supabase/migrations/secure_test_answers_2_lockdown.sql). Bunun için
//     cevabın kendisi gider: çoktan seçmeli/boşluk doldurmada seçilen seçenek, eşleştirmede
//     atama. is_correct yalnız ekrandaki anlık geri bildirim için istemcide tutulur.
import type { SupabaseClient } from '@supabase/supabase-js';

// Kayıt çağıranlarının ilettiği cevap ayrıntısı (AnswerRow'a selected_option_id / match olarak geçer).
export type AnswerDetail = { optionId?: number | null; match?: Record<number, number> | null };

export type AnswerRow = {
  test_session_id: number;
  question_id: number;
  user_id: string;
  client_id: string;
  is_correct: boolean;
  duration_seconds: number;
  // Seçilen seçenek: çoktan seçmelide question_choices.id, boşluk doldurmada
  // question_blank_options.id. Süre dolduysa null (yanlış sayılır).
  selected_option_id?: number | null;
  // Eşleştirme: sol çift id → seçilen sağ çift id (doğru = her çift kendisiyle eşleşmiş).
  match?: Record<string, number> | null;
};

const OUTBOX_KEY = 'answer-outbox-v1';
const RETRY_DELAYS_MS = [1000, 3000, 8000, 20000];
// Tekrar denemekle düzelmeyecek hatalar — kutuda sonsuza kadar dönmesinler:
// 23503 oturum/soru silinmiş (FK), 42501 RLS (başka kullanıcının satırı), 22P02 geçersiz veri.
const PERMANENT_ERROR_CODES = new Set(['23503', '42501', '22P02', '23502']);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;
type DbError = { code?: string; message: string } | null;

const rowKey = (r: Pick<AnswerRow, 'test_session_id' | 'question_id'>) => `${r.test_session_id}:${r.question_id}`;

function readOutbox(): AnswerRow[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOutbox(rows: AnswerRow[]) {
  try {
    if (rows.length) localStorage.setItem(OUTBOX_KEY, JSON.stringify(rows));
    else localStorage.removeItem(OUTBOX_KEY);
  } catch {
    // Depolama kapalı/dolu: cevaplar yine de bu sekmede bellekten gönderilmeye çalışılır.
  }
}

// localStorage kullanılamazsa kutu bu sekmenin belleğinde yaşar.
let memoryOutbox: AnswerRow[] = [];

function loadAll(): AnswerRow[] {
  const stored = readOutbox();
  const byKey = new Map<string, AnswerRow>();
  for (const r of [...stored, ...memoryOutbox]) byKey.set(rowKey(r), r);
  return [...byKey.values()];
}

function saveAll(rows: AnswerRow[]) {
  memoryOutbox = rows;
  writeOutbox(rows);
}

function removeSent(sent: AnswerRow[]) {
  const sentKeys = new Set(sent.map(rowKey));
  saveAll(loadAll().filter((r) => !sentKeys.has(rowKey(r))));
}

// Sunucuya giden alanlar: doğruluk (is_correct) ve kullanıcı (user_id) sunucuda belirlenir.
const toPayload = (rows: AnswerRow[]) =>
  rows.map((r) => ({
    test_session_id: r.test_session_id,
    question_id: r.question_id,
    client_id: r.client_id,
    selected_option_id: r.selected_option_id ?? null,
    match: r.match ?? null,
    duration_seconds: r.duration_seconds,
  }));

// Geçersiz satırlar (oturum yok, seçenek soruya ait değil…) RPC'de atlanır, parti bozulmaz; kutudan
// yine çıkarılır — tekrar göndermek sonucu değiştirmez.
async function sendRows(supabase: Supabase, rows: AnswerRow[]): Promise<DbError> {
  const { data, error } = await supabase.rpc('submit_test_answers', { p_rows: toPayload(rows) });
  const skipped = (data as { skipped?: { reason: string }[] } | null)?.skipped;
  if (skipped?.length) console.warn('Bazı cevaplar sunucuda reddedildi:', skipped);
  return error as DbError;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let inFlight: Promise<void> | null = null;

// Kutudaki, BU kullanıcıya ait cevapları gönderir (paylaşılan cihazda başka kullanıcının
// satırları RLS'e takılır — onlar kendi sahibi giriş yapınca gider). Aynı anda tek gönderim.
export function flushAnswerOutbox(supabase: Supabase, userId: string): Promise<void> {
  if (inFlight) return inFlight;
  // Temizlik .finally'de: async gövde beklemeden biterse (kutu boş) eski try/finally içindeki
  // `inFlight = null` atamadan ÖNCE çalışıyor, ardından çözülmüş söz inFlight'a yazılıp hiç
  // temizlenmiyordu → o sekmede sonraki tüm gönderimler sessizce atlanıyor, cevaplar ancak bir
  // sonraki sayfa açılışında gidiyordu (2026-10-08).
  const run = async () => {
    for (let attempt = 0; ; attempt++) {
      const rows = loadAll().filter((r) => r.user_id === userId);
      if (!rows.length) return;
      const error = await sendRows(supabase, rows);
      if (!error) {
        removeSent(rows);
        return;
      }
      if (error.code && PERMANENT_ERROR_CODES.has(error.code)) {
        console.error('Cevap kalıcı hatayla reddedildi, kutudan çıkarıldı:', error.message);
        removeSent(rows);
        return;
      }
      if (attempt >= RETRY_DELAYS_MS.length) {
        console.warn('Cevaplar gönderilemedi, sonraki ziyarette tekrar denenecek:', error.message);
        return;
      }
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  };
  const current = run().finally(() => {
    if (inFlight === current) inFlight = null;
  });
  inFlight = current;
  return current;
}

export function submitAnswers(supabase: Supabase, rows: AnswerRow[]): Promise<void> {
  if (!rows.length) return Promise.resolve();
  const byKey = new Map(loadAll().map((r) => [rowKey(r), r]));
  for (const r of rows) byKey.set(rowKey(r), r);
  saveAll([...byKey.values()]);
  // Önceki bir gönderim sürüyorsa onun bitmesini bekleyip yeni satırlar için tekrar gönder.
  const userId = rows[0].user_id;
  return (inFlight ?? Promise.resolve()).then(() => flushAnswerOutbox(supabase, userId));
}

// Sekme kapanırken/arka plana geçerken: bekleyen cevapları keepalive ile gönder — tarayıcı
// sayfa gittikten sonra da isteği tamamlar. Başarısı bilinemediği için kutudan SİLİNMEZ;
// sonraki ziyarette tekrar gönderilir, benzersiz indeks sayesinde çift satır oluşmaz.
export function beaconAnswerOutbox(userId: string, accessToken: string) {
  const rows = loadAll().filter((r) => r.user_id === userId);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!rows.length || !url || !apiKey) return;
  try {
    void fetch(`${url}/rest/v1/rpc/submit_test_answers`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_rows: toPayload(rows) }),
    });
  } catch {
    // keepalive gövde sınırı (64 KB) vb. — kutu zaten duruyor, sonraki ziyarette gider.
  }
}

// Oturum açma RPC'si geçici bir hatayla dönerse birkaç kez daha dener; başaramazsa null.
export async function startSessionWithRetry<T>(call: () => PromiseLike<{ data: T | null; error: DbError }>): Promise<T | null> {
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await call();
    if (!error) return data;
    if ((error.code && PERMANENT_ERROR_CODES.has(error.code)) || attempt >= 2) {
      console.error('start_web_quiz_session error:', error.message);
      return null;
    }
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}
