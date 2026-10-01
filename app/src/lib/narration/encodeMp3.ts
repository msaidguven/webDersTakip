// Ses tek kanal konuşma: 48 kbps MP3 konuşma için yeterli, ham PCM'in ~1/8'i boyut.
// @breezystack/lamejs'in CommonJS (iife) derlemesi module.exports'a bir şey yazmıyor; bu yüzden
// statik import yerine dinamik import() ile her ortamda ESM derlemesi yükleniyor.
export async function encodeMp3(pcm: Int16Array, sampleRate: number, kbps = 48): Promise<Uint8Array> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const parts: Uint8Array[] = [];
  const BLOCK = 1152;
  for (let i = 0; i < pcm.length; i += BLOCK) {
    const out = encoder.encodeBuffer(pcm.subarray(i, i + BLOCK));
    if (out.length) parts.push(new Uint8Array(out));
  }
  const tail = encoder.flush();
  if (tail.length) parts.push(new Uint8Array(tail));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const mp3 = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { mp3.set(p, off); off += p.length; }
  return mp3;
}
