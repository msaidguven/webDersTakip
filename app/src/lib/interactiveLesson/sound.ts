// Etkileşimli dersin sesi (yalnız tarayıcı): telifsiz, tarayıcıda üretilen sakin müzik döngüsü, kısa efektler
// ve Bit'in önceden üretilmiş konuşma dosyaları. Hepsi tek Web Audio bağlamında: bağlam ilk dokunuşta açılır
// (tarayıcı kuralı), sonra her cümle iOS'ta da çalar. Bit konuşurken müzik kısılır.
type Sfx = 'ok' | 'retry' | 'tap' | 'win';

const CHORDS = [
  [130.81, 164.81, 196.0, 246.94],
  [110.0, 130.81, 164.81, 196.0],
  [87.31, 110.0, 130.81, 164.81],
  [98.0, 123.47, 146.83, 164.81],
];
const EIGHTH = 60 / 84 / 2;
const ARP = [0, 2, 1, 3, 2, 1, 3, 2];

class LessonSound {
  private ctx: AudioContext | null = null;
  private music!: GainNode;
  private fx!: GainNode;
  private voice!: GainNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private next = 0;
  private beat = 0;
  private playing = false;
  private current: AudioBufferSourceNode | null = null;
  private token = 0;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();

  private init(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    this.music = ctx.createGain();
    this.music.gain.value = 0;
    this.fx = ctx.createGain();
    this.fx.connect(ctx.destination);
    this.voice = ctx.createGain();
    this.voice.connect(ctx.destination);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    const delay = ctx.createDelay();
    delay.delayTime.value = EIGHTH * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    this.music.connect(lp);
    lp.connect(ctx.destination);
    lp.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(ctx.destination);
    this.ctx = ctx;
    return ctx;
  }

  private tone(f: number, t: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, attack = 0.02) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private schedule = () => {
    const ctx = this.ctx!;
    while (this.next < ctx.currentTime + 0.4) {
      const ch = CHORDS[Math.floor(this.beat / 8) % 4];
      if (this.beat % 8 === 0) {
        ch.forEach((f) => this.tone(f, this.next, EIGHTH * 8.6, 'triangle', 0.02, this.music, 0.7));
        this.tone(ch[0] / 2, this.next, EIGHTH * 4, 'sine', 0.06, this.music);
      }
      if (this.beat % 8 === 4) this.tone(ch[0] / 2, this.next, EIGHTH * 4, 'sine', 0.045, this.music);
      if (Math.random() > 0.22) this.tone(ch[ARP[this.beat % 8]] * 4, this.next, EIGHTH * 3, 'sine', 0.028, this.music, 0.01);
      this.beat++;
      this.next += EIGHTH;
    }
  };

  /** Kullanıcı dokunuşunun içinden çağrılmalı (ses bağlamını açar). */
  unlock() {
    void this.init()?.resume();
  }

  startMusic() {
    const ctx = this.init();
    if (!ctx) return;
    void ctx.resume();
    this.playing = true;
    if (!this.timer) {
      this.next = ctx.currentTime + 0.1;
      this.timer = setInterval(this.schedule, 100);
    }
    this.music.gain.cancelScheduledValues(ctx.currentTime);
    this.music.gain.setTargetAtTime(this.current ? 0.35 : 1, ctx.currentTime, 0.4);
  }

  stopMusic() {
    const ctx = this.ctx;
    if (!ctx) return;
    this.playing = false;
    this.music.gain.cancelScheduledValues(ctx.currentTime);
    this.music.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    setTimeout(() => {
      if (!this.playing && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }, 600);
  }

  private duck(on: boolean) {
    if (this.ctx && this.playing) this.music.gain.setTargetAtTime(on ? 0.35 : 1, this.ctx.currentTime, 0.25);
  }

  sfx(kind: Sfx) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    if (kind === 'ok') [659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.09, 0.4, 'sine', 0.11, this.fx, 0.01));
    else if (kind === 'retry') {
      this.tone(392, t, 0.22, 'triangle', 0.07, this.fx, 0.01);
      this.tone(329.63, t + 0.12, 0.3, 'triangle', 0.07, this.fx, 0.01);
    } else if (kind === 'tap') this.tone(1318.5, t, 0.14, 'sine', 0.05, this.fx, 0.005);
    else [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, t + i * 0.11, 0.6, 'sine', 0.1, this.fx, 0.01));
  }

  private load(url: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(url);
    if (!p) {
      const ctx = this.ctx!;
      p = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => ctx.decodeAudioData(b))
        .catch(() => null);
      this.buffers.set(url, p);
    }
    return p;
  }

  /** Önceden indir (ekran açılınca), konuşma anında gecikme olmasın. */
  preload(urls: string[]) {
    if (this.ctx) urls.forEach((u) => void this.load(u));
  }

  // Seslendirilmemiş cümle (ör. sonradan düzeltilen soru) için yedek: cihazın Türkçe sesi, varsa.
  private turkishVoice(): SpeechSynthesisVoice | null {
    if (typeof speechSynthesis === 'undefined') return null;
    const vs = speechSynthesis.getVoices().filter((v) => /^tr/i.test(v.lang));
    return vs.find((v) => /google|neural|online|yelda|emel|filiz/i.test(v.name)) ?? vs[0] ?? null;
  }

  private speakText(text: string): Promise<void> {
    const voice = this.turkishVoice();
    if (!voice) return Promise.resolve();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 1.03;
      u.pitch = 1.25;
      u.onend = u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
  }

  /** Cümleleri sırayla okur (url: önceden üretilmiş ses, yoksa cihaz sesi); yeni bir speak/hush öncekini keser. */
  async speak(items: { url: string | null; text: string }[], onEnd: () => void) {
    this.hush();
    const my = ++this.token;
    const ctx = this.ctx;
    if (!ctx || !items.length) return onEnd();
    void ctx.resume();
    this.duck(true);
    for (const item of items) {
      if (!item.url) {
        await this.speakText(item.text);
        if (my !== this.token) return;
        continue;
      }
      const buf = await this.load(item.url);
      if (my !== this.token) return;
      if (!buf) continue;
      await new Promise<void>((resolve) => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.voice);
        src.onended = () => resolve();
        this.current = src;
        src.start();
      });
      if (my !== this.token) return;
    }
    this.current = null;
    this.duck(false);
    onEnd();
  }

  hush() {
    this.token++;
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    const c = this.current;
    this.current = null;
    if (c) {
      c.onended = null;
      try {
        c.stop();
      } catch {}
    }
    this.duck(false);
  }

  suspend() {
    this.hush();
    void this.ctx?.suspend();
  }

  resume() {
    if (this.playing) void this.ctx?.resume();
  }

  close() {
    this.hush();
    this.stopMusic();
  }
}

let instance: LessonSound | null = null;
export function lessonSound(): LessonSound {
  instance ??= new LessonSound();
  return instance;
}
