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
}

export const QUESTION_WORKER_PROFILES: Record<QuestionWorkerId, QuestionWorkerProfile> = {
  // GEMINI_API_KEY (öğrenci sohbeti) sadece 429'da son çare olarak devreye giriyor.
  primary: {
    id: 'primary',
    label: 'Soru AI 1',
    model: 'gemini-3.6-flash',
    fallbackModels: ['gemini-3.8-flash'],
    cronMinute: 37,
    apiKeyEnvs: ['GEMINI_API_KEY_QUESTIONS', 'GEMINI_API_KEY'],
  },
  secondary: {
    id: 'secondary',
    label: 'Soru AI 2',
    model: 'gemini-3.6-flash',
    fallbackModels: ['gemini-3.8-flash'],
    cronMinute: 13,
    apiKeyEnvs: ['NEW_GEMINI_API_KEY_CONTENT'],
  },
  tertiary: {
    id: 'tertiary',
    label: 'Soru AI 3',
    model: 'gemini-3.8-flash',
    fallbackModels: ['gemini-3.6-flash'],
    cronMinute: 51,
    apiKeyEnvs: ['GEMINI_API_KEY_CONTENT'],
  },
};

export function isQuestionWorkerId(value: unknown): value is QuestionWorkerId {
  return typeof value === 'string' && Object.hasOwn(QUESTION_WORKER_PROFILES, value);
}
