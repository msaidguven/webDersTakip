// Etkileşimli dersin sesi (yalnız tarayıcı): telifsiz, tarayıcıda üretilen sakin müzik döngüsü, kısa efektler
// ve Atom'un önceden üretilmiş konuşma dosyaları. Hepsi tek Web Audio bağlamında: bağlam ilk dokunuşta açılır
// (tarayıcı kuralı), sonra her cümle iOS'ta da çalar. Atom konuşurken müzik kısılır.
export type LessonSfx = 'ok' | 'retry' | 'tap' | 'win' | 'warp' | 'link' | 'unlock' | 'combo';
type Sfx = LessonSfx;

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
  private currentBuf: AudioBuffer | null = null;
  private voiceStartedAt = 0;
  private voiceOffset = 0;
  private voicePaused = false;
  private voiceActive = false;
  private speakingSpeechSynthesis = false;
  private resumeWaiter: (() => void) | null = null;
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

  /** Ses bağlamı bir dokunuşla açıldı mı (ör. konu sayfasındaki "Etkileşimli derse başla" tıklaması). */
  isUnlocked(): boolean {
    return this.ctx?.state === 'running';
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

  sfx(kind: Sfx, stepIndex = 0) {
    const ctx = this.ctx ?? this.init();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    if (kind === 'ok') [659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.09, 0.4, 'sine', 0.11, this.fx, 0.01));
    else if (kind === 'retry') {
      this.tone(392, t, 0.22, 'triangle', 0.07, this.fx, 0.01);
      this.tone(329.63, t + 0.12, 0.3, 'triangle', 0.07, this.fx, 0.01);
    } else if (kind === 'tap') this.tone(1318.5, t, 0.14, 'sine', 0.05, this.fx, 0.005);
    else if (kind === 'warp') {
      [320, 520, 780].forEach((f, i) => this.tone(f, t + i * 0.1, 0.22, 'sine', 0.09, this.fx, 0.01));
    } else if (kind === 'link') {
      this.tone(420 + Math.min(stepIndex, 10) * 65, t, 0.08, 'sine', 0.07, this.fx, 0.005);
    } else if (kind === 'unlock') {
      this.tone(523.25, t, 0.11, 'triangle', 0.09, this.fx, 0.005);
      this.tone(783.99, t + 0.09, 0.14, 'triangle', 0.1, this.fx, 0.005);
      this.tone(1174.66, t + 0.18, 0.34, 'sine', 0.11, this.fx, 0.01);
    } else if (kind === 'combo') {
      const base = 587.33 + Math.min(stepIndex, 6) * 55;
      [base, base * 1.25, base * 1.5].forEach((f, i) => this.tone(f, t + i * 0.06, 0.24, 'sine', 0.095, this.fx, 0.008));
    } else [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, t + i * 0.11, 0.6, 'sine', 0.1, this.fx, 0.01));
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
      this.speakingSpeechSynthesis = true;
      u.onend = u.onerror = () => {
        this.speakingSpeechSynthesis = false;
        resolve();
      };
      speechSynthesis.speak(u);
    });
  }

  private playBuffer(ctx: AudioContext, buf: AudioBuffer, my: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const startFrom = (from: number) => {
        if (my !== this.token) return resolve();
        if (this.voicePaused) {
          this.voiceOffset = from;
          this.resumeWaiter = () => startFrom(this.voiceOffset);
          return;
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.voice);
        this.current = src;
        this.currentBuf = buf;
        this.voiceStartedAt = ctx.currentTime;
        this.voiceOffset = from;
        this.resumeWaiter = () => startFrom(this.voiceOffset);
        src.onended = () => {
          if (this.current === src) this.current = null;
          if (my !== this.token) return resolve();
          if (this.voicePaused) return;
          this.currentBuf = null;
          this.voiceOffset = 0;
          this.resumeWaiter = null;
          resolve();
        };
        try {
          const safeOffset = Math.max(0, Math.min(from, Math.max(0, buf.duration - 0.01)));
          src.start(0, safeOffset);
        } catch {
          this.current = null;
          this.currentBuf = null;
          this.resumeWaiter = null;
          resolve();
        }
      };
      startFrom(0);
    });
  }

  private waitGap(ms: number, my: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      let remaining = ms;
      const run = () => {
        if (my !== this.token) return resolve();
        if (this.voicePaused) {
          this.resumeWaiter = () => run();
          return;
        }
        const started = performance.now();
        const id = setTimeout(() => {
          if (my !== this.token) return resolve();
          if (this.voicePaused) {
            remaining = Math.max(0, remaining - (performance.now() - started));
            this.resumeWaiter = () => run();
            return;
          }
          this.resumeWaiter = null;
          resolve();
        }, remaining);
        this.resumeWaiter = () => {
          clearTimeout(id);
          run();
        };
      };
      run();
    });
  }

  /** Cümleleri sırayla okur (url: önceden üretilmiş ses, yoksa cihaz sesi); yeni bir speak/hush öncekini keser. */
  async speak(
    items: { url: string | null; text: string }[],
    onEnd: () => void,
    opts?: { onItemStart?: (index: number) => void; gapMs?: number },
  ) {
    this.hush();
    const my = ++this.token;
    const ctx = this.ctx;
    if (!ctx || !items.length) return onEnd();
    void ctx.resume();
    this.voiceActive = true;
    this.voicePaused = false;
    this.duck(true);
    const gapMs = opts?.gapMs ?? 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // Sıradaki parçayı arka planda önceden indir: geçişte sıfır gecikme.
      const nextUrl = items[i + 1]?.url;
      if (nextUrl) void this.load(nextUrl);

      if (!item.url) {
        opts?.onItemStart?.(i);
        await this.speakText(item.text);
        if (my !== this.token) return;
      } else {
        const buf = await this.load(item.url);
        if (my !== this.token) return;
        if (!buf) continue;
        opts?.onItemStart?.(i);
        await this.playBuffer(ctx, buf, my);
        if (my !== this.token) return;
      }

      if (i < items.length - 1 && gapMs > 0) {
        await this.waitGap(gapMs, my);
        if (my !== this.token) return;
      }
    }
    this.current = null;
    this.currentBuf = null;
    this.voiceActive = false;
    this.voicePaused = false;
    this.resumeWaiter = null;
    this.duck(false);
    onEnd();
  }

  /** Aktif seslendirmeyi kaldığı yerden duraklatır. */
  pauseVoice(): boolean {
    if (!this.voiceActive || this.voicePaused) return false;
    this.voicePaused = true;
    if (this.speakingSpeechSynthesis && typeof speechSynthesis !== 'undefined') {
      speechSynthesis.pause();
      this.duck(false);
      return true;
    }
    const c = this.current;
    if (c && this.ctx && this.currentBuf) {
      const elapsed = Math.max(0, this.ctx.currentTime - this.voiceStartedAt);
      this.voiceOffset = Math.min(this.voiceOffset + elapsed, Math.max(0, this.currentBuf.duration - 0.05));
      this.current = null;
      c.onended = null;
      try {
        c.stop();
      } catch {}
    }
    this.duck(false);
    return true;
  }

  /** Duraklatılmış seslendirmeyi kaldığı yerden devam ettirir. */
  resumeVoice(): boolean {
    if (!this.voiceActive || !this.voicePaused) return false;
    this.voicePaused = false;
    if (this.speakingSpeechSynthesis && typeof speechSynthesis !== 'undefined') {
      speechSynthesis.resume();
      this.duck(true);
      return true;
    }
    void this.ctx?.resume();
    this.duck(true);
    const fn = this.resumeWaiter;
    this.resumeWaiter = null;
    fn?.();
    return true;
  }

  hush() {
    this.token++;
    this.voiceActive = false;
    this.voicePaused = false;
    this.voiceOffset = 0;
    this.currentBuf = null;
    this.resumeWaiter = null;
    this.speakingSpeechSynthesis = false;
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
