// Giriş yapmış öğrencinin test cevaplarını (test_session_answers) kaybetmeden sunucuya
// ulaştırır (kullanıcı bildirimi, 2026-09-27: "çözdüğü sorular boşa gitmesin"). Önceden her
// cevap tek bir insert'le gönderiliyor, hata olursa sadece console'a yazılıp kayboluyordu.
//
//   * Giden kutusu: her cevap ÖNCE localStorage'a yazılır, sunucu onaylayınca silinir —
//     sekme kapanır/ağ kopar/hata olursa bir sonraki ziyarette (AnswerOutboxFlusher) gönderilir.
//   * Yeniden deneme: geçici hatalarda artan aralıklarla tekrar dener.
//   * İdempotent: (test_session_id, question_id) benzersiz (bkz. supabase/migrations/
//     test_session_answers_dedupe_and_unique.sql) + ignoreDuplicates — aynı cevap iki kez
//     gönderilse de (yeniden deneme, iki sekme, sayfa kapanışı) tek satır oluşur.
import type { SupabaseClient } from '@supabase/supabase-js';

export type AnswerRow = {
  test_session_id: number;
  question_id: number;
  user_id: string;
  client_id: string;
  is_correct: boolean;
  duration_seconds: number;
};

const OUTBOX_KEY = 'answer-outbox-v1';
const RETRY_DELAYS_MS = [1000, 3000, 8000, 20000];
// Tekrar denemekle düzelmeyecek hatalar — kutuda sonsuza kadar dönmesinler:
// 23503 oturum/soru silinmiş (FK), 42501 RLS (başka kullanıcının satırı), 22P02 geçersiz veri.
const PERMANENT_ERROR_CODES = new Set(['23503', '42501', '22P02', '23502']);
// Benzersiz indeks henüz yoksa (migration çalıştırılmadan deploy) on_conflict reddedilir —
// o durumda düz insert'e düşülür, hiçbir cevap bu yüzden kaybolmaz.
const NO_UNIQUE_INDEX_CODE = '42P10';

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

async function sendRows(supabase: Supabase, rows: AnswerRow[]): Promise<DbError> {
  const { error } = await supabase
    .from('test_session_answers')
    .upsert(rows, { onConflict: 'test_session_id,question_id', ignoreDuplicates: true });
  if ((error as DbError)?.code === NO_UNIQUE_INDEX_CODE) {
    const fallback = await supabase.from('test_session_answers').insert(rows);
    return fallback.error as DbError;
  }
  return error as DbError;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let inFlight: Promise<void> | null = null;

// Kutudaki, BU kullanıcıya ait cevapları gönderir (paylaşılan cihazda başka kullanıcının
// satırları RLS'e takılır — onlar kendi sahibi giriş yapınca gider). Aynı anda tek gönderim.
export function flushAnswerOutbox(supabase: Supabase, userId: string): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
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
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
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
    void fetch(`${url}/rest/v1/test_session_answers?on_conflict=test_session_id,question_id`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
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
