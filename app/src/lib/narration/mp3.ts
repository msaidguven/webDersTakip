// MP3 süresini çerçeve başlıklarından hesaplar (kodlama/çözme yok, CPU'suz). Azure MP3'ü doğrudan
// döndürdüğü için süreyi bilmenin tek yolu bu; grup zamanlaması süreye göre dağıtıldığından
// bayt/bitrate tahmini (VBR/başlık payı yüzünden ±%10) yetmiyor.
const BITRATES: Record<'1' | '2', number[]> = {
  '1': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  '2': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const SAMPLE_RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

export function mp3DurationSeconds(buf: Uint8Array): number {
  let off = 0;
  // ID3v2 etiketi varsa atla.
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    off = 10 + (((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f));
  }
  let seconds = 0;
  while (off + 4 <= buf.length) {
    if (buf[off] !== 0xff || (buf[off + 1] & 0xe0) !== 0xe0) { off++; continue; }
    const version = (buf[off + 1] >> 3) & 0x03; // 3: MPEG1, 2: MPEG2, 0: MPEG2.5
    const layer = (buf[off + 1] >> 1) & 0x03; // 1: Layer III
    const bitrateIdx = buf[off + 2] >> 4;
    const srIdx = (buf[off + 2] >> 2) & 0x03;
    const padding = (buf[off + 2] >> 1) & 0x01;
    const sampleRate = SAMPLE_RATES[version]?.[srIdx];
    if (layer !== 1 || version === 1 || !sampleRate || bitrateIdx === 0 || bitrateIdx === 15) { off++; continue; }
    const bitrate = BITRATES[version === 3 ? '1' : '2'][bitrateIdx] * 1000;
    const samples = version === 3 ? 1152 : 576;
    const frameLen = Math.floor(((samples / 8) * bitrate) / sampleRate) + padding;
    if (frameLen <= 4) { off++; continue; }
    seconds += samples / sampleRate;
    off += frameLen;
  }
  return seconds;
}
