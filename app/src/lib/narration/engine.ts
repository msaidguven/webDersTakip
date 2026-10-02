import type { NarrationManifest } from './types';

// Bir TTS sağlayıcısının üretim çekirdeğine (generateTopicNarration) sunduğu arayüz. Çekirdek
// sağlayıcıyı bilmez; yeni bir sağlayıcı eklemek = bu arayüzü uygulayan bir fabrika yazmak.
export type NarrationEngine = {
  provider: NarrationManifest['voice']['provider'];
  model: string;
  voice: string;
  // Sesin sonundaki doğal sessizlik (sn) — grup zamanlaması konuşmanın bittiği ana göre dağıtılır.
  trailingSilence: number;
  synthesize: (text: string) => Promise<{ mp3: Uint8Array; duration: number }>;
};
