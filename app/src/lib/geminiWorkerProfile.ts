// Saf tip + yardımcı — worker profil dosyaları (contentWorkerProfiles.ts,
// questionWorkerProfiles.ts) admin panelinde client'ta da import edildiği için sunucu kodu
// (geminiJsonGen.ts) buraya girmez.
export interface GeminiWorkerProfile {
  model: string;
  // Ana model 503 (yoğunluk) verirse AYNI key ile sırayla denenen modeller. Free-tier kotası
  // proje+model başına sayıldığı için model değiştirmek başka bir işin kotasını yemiyor.
  fallbackModels: string[];
  // Sırayla denenen key'ler — sadece 429/503'te bir sonrakine geçilir.
  apiKeyEnvs: string[];
}

// 'gemini-3.8-flash' → 'Gemini 3.8 Flash'
export function prettyModelName(model: string): string {
  return model
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
