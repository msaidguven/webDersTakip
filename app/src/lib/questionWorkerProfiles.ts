import type { GeminiWorkerProfile } from '@/app/src/lib/geminiWorkerProfile';

// Saf veri — sunucu (geminiQuestionGen.ts) ve admin paneli (client) import eder; key'lerin
// kendisi değil sadece env değişkeni ADLARI burada.

// Soru taslağı üretimi 3 bağımsız worker'dan (kullanıcının 2026-09-28 isteği: tek worker
// sorusu eksik ~320 alt başlığa yetişemiyordu). Hepsi aynı prompt ve alt başlık seçim
// RPC'sini (find_next_ai_question_draft_section) kullanır; farklı dakikalarda çalışır ve
// ayrı key'leri var. Key'ler, görev değiştiren worker'lardan devralındı:
//  - secondary: ikinci içerik worker'ının key'i (ai-content-draft-worker-2 pasife alındı)
//  - tertiary: anahtar kavram worker'ının key'i (kuyruğu bitti, job pasife alındı). Bu key
//    içerik worker'ı (primary, gemini-3.6-flash) ile ortak — kota proje+model başına
//    sayıldığı için ana model bilerek farklı (3.8).
export type QuestionWorkerId = 'primary' | 'secondary' | 'tertiary';

export interface QuestionWorkerProfile extends GeminiWorkerProfile {
  id: QuestionWorkerId;
  // Admin panelinde çalışma kayıtlarında gösterilen ad (iki worker aynı modeli kullandığı
  // için model adı ayırt etmiyor).
  label: string;
  // pg_cron'daki çalışma dakikası (bilgi amaçlı).
  cronMinute: number;
  // true: her çalışmada önce otomatik yazılı kuyruğuna bakar (yazili/worker.ts), iş yoksa test partisine geçer.
  yazili?: boolean;
  // true: her çalışmada önce etkileşimli ders işine bakar (interactiveLesson/worker.ts: eksik Bit sesleri, sonra
  // sıradaki konunun dersi), iş yoksa test partisine geçer.
  interactiveLesson?: boolean;
}

export const QUESTION_WORKER_PROFILES: Record<QuestionWorkerId, QuestionWorkerProfile> = {
  // GEMINI_API_KEY (öğrenci sohbeti) toplu işte yedek OLMAZ (2026-10-04 kotası tükenmişti; 2026-10-12
  // otomatik partiyle kaldırıldı) — 429'da worker bu turu atlar, sonraki saatte dener.
  primary: {
    id: 'primary',
    label: 'Soru AI 1',
    model: 'gemini-3.6-flash',
    fallbackModels: ['gemini-3.8-flash', 'gemini-3.5-flash'],
    cronMinute: 37,
    apiKeyEnvs: ['GEMINI_API_KEY_QUESTIONS'],
  },
  secondary: {
    id: 'secondary',
    label: 'Soru AI 2',
    model: 'gemini-3.6-flash',
    // 2026-11-06: 3.6/3.8 sık 503 veriyordu; 3.5-flash aynı anahtarlarla çalışıyor (ayrı günlük kota).
    fallbackModels: ['gemini-3.8-flash', 'gemini-3.5-flash'],
    cronMinute: 13,
    // 2026-11-03: kullanıcının aldığı ek anahtar (Vercel'e eklendi) — ilk anahtarın kotası dolunca ders üretimi buna geçer.
    apiKeyEnvs: ['NEW_GEMINI_API_KEY_CONTENT', 'GEMINI_API_KEY_IMAGE'],
    // 2026-11-01 kullanıcı kararı: içerikli konuların etkileşimli dersleri bitene kadar önce bu işe çalışır.
    interactiveLesson: true,
  },
  tertiary: {
    id: 'tertiary',
    label: 'Soru AI 3',
    model: 'gemini-3.8-flash',
    fallbackModels: ['gemini-3.6-flash', 'gemini-3.5-flash'],
    cronMinute: 51,
    apiKeyEnvs: ['GEMINI_API_KEY_CONTENT'],
    // 2026-10-31 kullanıcı kararı: yazılı v1 soruları bitene kadar önce yazılıya çalışır.
    yazili: true,
  },
};

export function isQuestionWorkerId(value: unknown): value is QuestionWorkerId {
  return typeof value === 'string' && Object.hasOwn(QUESTION_WORKER_PROFILES, value);
}
