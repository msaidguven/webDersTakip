'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ListTree, Loader2, Pause, Play, RotateCcw, X } from 'lucide-react';
import { narrationManifestPath, narrationPublicUrl } from '@/app/src/lib/narration/config';
import { NARRATION_MANIFEST_VERSION, type NarrationManifest, type NarrationScreen } from '@/app/src/lib/narration/types';
import { useViewportRemScale } from '@/app/src/hooks/useViewportRemScale';
import s from './NarrationPlayer.module.css';

// "Video / Sesli Anlatım" oynatıcısı (PROTOTİP, 2026-10-01). Konunun sayfadaki metni cümle cümle,
// büyük puntoda ve seslendirmeyle eşzamanlı (2-4 kelimelik gruplar halinde) oynatılır. Veri
// scripts/generate-narration.ts'in Storage'a yazdığı manifestten gelir; burada AI/TTS çağrısı yok.

type Props = { topicId: number; onClose: () => void };

type FlatScreen = { screen: NarrationScreen; sectionIndex: number; offset: number };

const RATES = [1, 1.25, 1.5, 0.85] as const;
const PROGRESS_KEY = (topicId: number) => `narration-progress:${topicId}`;
const RATE_KEY = 'narration-rate';
const PAUSE_BETWEEN_SCREENS_MS = 280;
const PAUSE_BEFORE_SECTION_MS = 750;

function readStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStorage(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* gizli sekme vb. — ilerleme kaydı opsiyonel */ }
}

function readStoredRate(): number {
  const stored = Number(readStorage(RATE_KEY));
  return RATES.includes(stored as (typeof RATES)[number]) ? stored : 1;
}

// Hızlı gezinmede (art arda ileri) önceki play() "yeni yükleme tarafından kesildi" (AbortError)
// ile reddedilir — bu bir hata değil, sonraki ekranın play()'i zaten çalışıyor; oynatıcıyı duraklatma.
function playSafely(audio: HTMLAudioElement, onBlocked: () => void) {
  const src = audio.src;
  audio.play().catch((err: unknown) => {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    if (audio.src === src) onBlocked();
  });
}

const formatTime = (sec: number) => {
  const total = Math.max(0, Math.round(sec));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

function textSizeClass(screen: NarrationScreen): string {
  if (screen.kind === 'title') return 'text-[clamp(2rem,6.2vw,4.4rem)] leading-[1.08]';
  if (screen.kind === 'heading') return 'text-[clamp(1.75rem,5vw,3.4rem)] leading-[1.12]';
  const len = screen.chunks.reduce((n, c) => n + c.parts.reduce((m, p) => m + p.t.length + 1, 0), 0);
  if (len <= 70) return 'text-[clamp(1.9rem,5.4vw,3.7rem)] leading-[1.18]';
  if (len <= 130) return 'text-[clamp(1.65rem,4.4vw,3.05rem)] leading-[1.22]';
  if (len <= 210) return 'text-[clamp(1.4rem,3.5vw,2.5rem)] leading-[1.28]';
  return 'text-[clamp(1.2rem,2.9vw,2.1rem)] leading-[1.32]';
}

export default function NarrationPlayer({ topicId, onClose }: Props) {
  const [manifest, setManifest] = useState<NarrationManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'intro' | 'running' | 'ended'>('intro');
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Ekrandaki gruplardan sesin ulaştığı (başlamış) grup sayısı; tüm cümle baştan görünür,
  // sadece okunan grup vurgulanır (kullanıcının 2026-10-02 isteği).
  const [revealed, setRevealed] = useState(0);
  // Ekranın sesi şu an okunuyor ya da okunurken duraklatıldı mı — vurgu sadece o sırada görünür.
  const [speaking, setSpeaking] = useState(false);
  // Akıllı tahtada her şey ekrana orantılı büyür (bkz. useViewportRemScale) — oynatıcı hep tam ekran.
  useViewportRemScale(true);
  // Bileşen sadece istemcide yükleniyor (dynamic, ssr:false) — başlangıçta localStorage okunabilir.
  const [rate, setRate] = useState<number>(readStoredRate);
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedIndex, setSavedIndex] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segmentFillRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const timeRef = useRef<HTMLSpanElement | null>(null);
  const indexRef = useRef(0);
  const rateRef = useRef(rate);

  useEffect(() => {
    let cancelled = false;
    fetch(narrationPublicUrl(narrationManifestPath(topicId)))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((m: NarrationManifest) => {
        if (cancelled) return;
        if (m.version !== NARRATION_MANIFEST_VERSION) throw new Error('Desteklenmeyen anlatım sürümü');
        setManifest(m);
      })
      .catch(() => { if (!cancelled) setError('Bu konunun sesli anlatımı yüklenemedi.'); });
    return () => { cancelled = true; };
  }, [topicId]);

  const flat = useMemo<FlatScreen[]>(() => {
    if (!manifest) return [];
    const out: FlatScreen[] = [];
    let offset = 0;
    manifest.sections.forEach((sec, sectionIndex) => {
      for (const screen of sec.screens) {
        out.push({ screen, sectionIndex, offset });
        offset += screen.audio.duration;
      }
    });
    return out;
  }, [manifest]);
  const totalDuration = flat.length ? flat[flat.length - 1].offset + flat[flat.length - 1].screen.audio.duration : 0;
  const sectionStarts = useMemo(() => {
    const starts: number[] = [];
    flat.forEach((f, i) => { if (starts[f.sectionIndex] === undefined) starts[f.sectionIndex] = i; });
    return starts;
  }, [flat]);
  const sectionSpans = useMemo(() => (manifest?.sections ?? []).map((sec, si) => {
    const start = flat[sectionStarts[si]]?.offset ?? 0;
    return { sectionId: sec.sectionId, title: sec.title, start, end: start + sec.screens.reduce((n, x) => n + x.audio.duration, 0) };
  }), [flat, manifest, sectionStarts]);

  useEffect(() => {
    if (!flat.length) return;
    const saved = Number(readStorage(PROGRESS_KEY(topicId)));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- manifest yüklendikten sonra tek seferlik okuma
    if (Number.isInteger(saved) && saved > 0 && saved < flat.length) setSavedIndex(saved);
  }, [flat, topicId]);

  const clearAdvance = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
  };

  // Bir ekranı yükler; autoplay ise sesi baştan çalar (kullanıcı tıklamasının içinden çağrılmalı —
  // tarayıcıların otomatik oynatma kuralı). Duraklatılmış gezinmede ekran tam metniyle gösterilir.
  const goTo = useCallback((i: number, autoplay: boolean) => {
    const audio = audioRef.current;
    const target = flat[i];
    if (!audio || !target) return;
    clearAdvance();
    indexRef.current = i;
    setIndex(i);
    setMenuOpen(false);
    audio.src = narrationPublicUrl(target.screen.audio.path);
    audio.defaultPlaybackRate = rateRef.current;
    audio.playbackRate = rateRef.current;
    const next = flat[i + 1];
    if (next && preloadRef.current) preloadRef.current.src = narrationPublicUrl(next.screen.audio.path);
    writeStorage(PROGRESS_KEY(topicId), String(i));
    if (autoplay) {
      setRevealed(0);
      setSpeaking(true);
      setPlaying(true);
      playSafely(audio, () => setPlaying(false));
    } else {
      setRevealed(target.screen.chunks.length);
      setSpeaking(false);
      setPlaying(false);
    }
  }, [flat, topicId]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    const preload = new Audio();
    preload.preload = 'auto';
    audioRef.current = audio;
    preloadRef.current = preload;
    return () => {
      audio.pause();
      audio.removeAttribute('src');
      preload.removeAttribute('src');
      clearAdvance();
    };
  }, []);

  // Ekranın sesi bitince kısa bir nefes payıyla sonrakine geç; son ekransa bitiş ekranı.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      const i = indexRef.current;
      const cur = flat[i];
      if (cur) setRevealed(cur.screen.chunks.length);
      setSpeaking(false);
      if (i >= flat.length - 1) {
        setPlaying(false);
        setPhase('ended');
        writeStorage(PROGRESS_KEY(topicId), null);
        return;
      }
      const delay = flat[i + 1].sectionIndex !== cur?.sectionIndex ? PAUSE_BEFORE_SECTION_MS : PAUSE_BETWEEN_SCREENS_MS;
      advanceTimer.current = setTimeout(() => goTo(i + 1, true), delay / rateRef.current);
    };
    const onError = () => {
      setPlaying(false);
      setError('Ses dosyası yüklenemedi. Bağlantını kontrol edip tekrar dene.');
    };
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [flat, goTo, topicId]);

  // Ses-metin eşzamanlama: çalarken her karede sesin konumuna göre görünen grup sayısını hesapla.
  // İlerleme çubuğu/saat doğrudan DOM'a yazılır (her karede React render'ı olmasın).
  useEffect(() => {
    const audio = audioRef.current;
    const cur = flat[index];
    if (!audio || !cur) return;
    let raf = 0;
    const tick = () => {
      const t = audio.currentTime;
      if (playing) {
        const count = cur.screen.chunks.filter((c) => c.start <= t + 0.06).length;
        setRevealed((prev) => (count > prev ? count : prev));
      }
      const elapsed = cur.offset + Math.min(t, cur.screen.audio.duration);
      sectionSpans.forEach((span, si) => {
        const el = segmentFillRefs.current[si];
        if (el) el.style.width = `${Math.min(1, Math.max(0, (elapsed - span.start) / Math.max(0.01, span.end - span.start))) * 100}%`;
      });
      if (timeRef.current) timeRef.current.textContent = `${formatTime(elapsed)} / ${formatTime(totalDuration)}`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [flat, index, playing, sectionSpans, totalDuration]);

  const start = (from: number) => {
    setPhase('running');
    setError(null);
    goTo(from, true);
  };

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || phase !== 'running') return;
    if (playing) {
      audio.pause();
      clearAdvance();
      setPlaying(false);
    } else {
      const cur = flat[indexRef.current];
      // Ekranın sesi bitmişse (ör. geçiş beklerken duraklatıldıysa) sonraki ekrana geç.
      if (cur && audio.ended) { goTo(Math.min(indexRef.current + 1, flat.length - 1), true); return; }
      setPlaying(true);
      playSafely(audio, () => setPlaying(false));
    }
  }, [flat, goTo, phase, playing]);

  const step = useCallback((delta: number) => {
    if (phase !== 'running') return;
    const i = Math.min(flat.length - 1, Math.max(0, indexRef.current + delta));
    goTo(i, playing);
  }, [flat.length, goTo, phase, playing]);

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate as (typeof RATES)[number]) + 1) % RATES.length];
    setRate(next);
    rateRef.current = next;
    if (audioRef.current) { audioRef.current.playbackRate = next; audioRef.current.defaultPlaybackRate = next; }
    writeStorage(RATE_KEY, String(next));
  };

  const close = useCallback(() => {
    audioRef.current?.pause();
    clearAdvance();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (menuOpen) setMenuOpen(false); else close(); }
      else if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [close, menuOpen, step, togglePlay]);

  const cur = flat[index];
  const sectionCount = manifest?.sections.length ?? 0;
  const section = cur ? manifest?.sections[cur.sectionIndex] : null;
  const currentChunk = speaking ? revealed - 1 : -1;

  return (
    <div className={`fixed inset-0 z-[120] flex flex-col text-white ${s.stage}`} role="dialog" aria-modal="true" aria-label="Video / Sesli Anlatım">
      {/* Üst çubuk */}
      <div className="flex items-center gap-3 px-4 sm:px-6 pt-[max(env(safe-area-inset-top),12px)] pb-2">
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[.14em] text-indigo-300/90">Video / Sesli Anlatım</p>
          <p className="truncate text-sm font-medium text-white/80">
            {section && phase === 'running' ? <>Bölüm {cur!.sectionIndex + 1}/{sectionCount} · {section.title}</> : manifest?.topicTitle ?? ''}
          </p>
        </div>
        <button type="button" onClick={close} aria-label="Kapat" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Sahne */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-5 sm:px-12" onClick={phase === 'running' ? togglePlay : undefined}>
        {!manifest && !error && <Loader2 className="h-9 w-9 animate-spin text-white/60" aria-label="Yükleniyor" />}

        {error && (
          <div className="max-w-md text-center">
            <p className="text-lg text-white/90">{error}</p>
            {manifest && (
              <button type="button" onClick={(e) => { e.stopPropagation(); start(index); }} className="mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900">
                Tekrar dene
              </button>
            )}
          </div>
        )}

        {manifest && !error && phase === 'intro' && (
          <div className={`max-w-2xl text-center ${s.titleIn}`}>
            <p className="text-sm font-medium text-white/60">{sectionCount} bölüm · yaklaşık {Math.max(1, Math.round(totalDuration / 60))} dakika</p>
            <h2 className="mt-3 text-[clamp(2rem,6vw,3.8rem)] font-extrabold leading-tight">{manifest.topicTitle}</h2>
            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              {savedIndex != null ? (
                <>
                  <button type="button" onClick={() => start(savedIndex)} className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-bold text-slate-900 shadow-lg shadow-indigo-500/30 hover:scale-[1.03] transition-transform">
                    <Play className="h-5 w-5" fill="currentColor" aria-hidden="true" /> Kaldığın yerden devam et
                  </button>
                  <button type="button" onClick={() => start(0)} className="rounded-full px-5 py-3 text-sm font-semibold text-white/80 ring-1 ring-white/25 hover:bg-white/10">
                    Baştan başla
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => start(0)} className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-bold text-slate-900 shadow-lg shadow-indigo-500/30 hover:scale-[1.03] transition-transform">
                  <Play className="h-[1.375rem] w-[1.375rem]" fill="currentColor" aria-hidden="true" /> Başlat
                </button>
              )}
            </div>
            {savedIndex != null && (
              <p className="mt-4 text-sm text-white/50">Bölüm {flat[savedIndex].sectionIndex + 1}: {manifest.sections[flat[savedIndex].sectionIndex].title}</p>
            )}
          </div>
        )}

        {manifest && !error && phase === 'ended' && (
          <div className={`max-w-xl text-center ${s.titleIn}`}>
            <p className="text-sm font-semibold uppercase tracking-[.14em] text-indigo-300">Anlatım bitti</p>
            <h2 className="mt-3 text-[clamp(1.8rem,5vw,3rem)] font-extrabold leading-tight">{manifest.topicTitle}</h2>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button type="button" onClick={() => start(0)} className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-slate-900">
                <RotateCcw className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" /> Baştan izle
              </button>
              <button type="button" onClick={close} className="rounded-full px-5 py-3 text-sm font-semibold text-white/80 ring-1 ring-white/25 hover:bg-white/10">
                Konuya dön
              </button>
            </div>
          </div>
        )}

        {cur && !error && phase === 'running' && (
          cur.screen.kind === 'title' ? (
            <div key={cur.screen.id} className="relative w-full max-w-5xl">
              <span aria-hidden="true" className={`pointer-events-none absolute -left-2 -top-24 select-none text-[clamp(7rem,22vw,15rem)] font-black leading-none text-white/[.06] ${s.ghostNo}`}>
                {String(cur.sectionIndex + 1).padStart(2, '0')}
              </span>
              <p className={`relative text-sm font-semibold uppercase tracking-[.18em] text-indigo-300 ${s.screenIn}`}>Bölüm {cur.sectionIndex + 1} / {sectionCount}</p>
              <h2 className={`relative mt-3 font-extrabold ${textSizeClass(cur.screen)} ${s.titleIn}`}>
                {cur.screen.chunks.flatMap((c) => c.parts).map((p) => p.t).join(' ')}
              </h2>
            </div>
          ) : cur.screen.kind === 'heading' ? (
            // Ara başlık (### …): bölüm başlığından küçük, cümlelerden belirgin.
            <div key={cur.screen.id} className="w-full max-w-5xl">
              <p className={`text-sm font-semibold uppercase tracking-[.16em] text-indigo-300/80 ${s.screenIn}`}>{section?.title}</p>
              <h3 className={`mt-3 border-l-[0.3rem] border-indigo-400 pl-[0.5em] font-extrabold text-indigo-100 ${textSizeClass(cur.screen)} ${s.titleIn}`}>
                {cur.screen.chunks.flatMap((c) => c.parts).map((p) => p.t).join(' ')}
              </h3>
            </div>
          ) : (
            <div key={cur.screen.id} className={`w-full max-w-5xl ${s.screenIn}`}>
              {cur.screen.eyebrow && (
                <p className="mb-5 inline-block rounded-full bg-indigo-400/15 px-3.5 py-1 text-xs font-semibold uppercase tracking-[.12em] text-indigo-200 ring-1 ring-indigo-300/25 sm:text-sm">
                  {cur.screen.eyebrow}
                </p>
              )}
              <p className={`font-bold ${textSizeClass(cur.screen)}`}>
                {cur.screen.chunks.map((c, ci) => {
                  // Tüm cümle baştan görünür: okunmuş gruplar tam beyaz, okunan grup vurgulu kutuda,
                  // sıradakiler soluk ama okunur.
                  const state = ci === currentChunk ? s.chunkCurrent : ci >= revealed ? s.chunkUpcoming : s.chunkDone;
                  return (
                    <Fragment key={ci}>
                      {ci > 0 ? ' ' : ''}
                      <span className={`${s.chunk} ${state}`}>
                        {c.parts.map((p, pi) => {
                          const formula = p.t.startsWith('=');
                          const cls = formula
                            ? 'rounded-md bg-emerald-400/15 px-1.5 font-mono text-emerald-200 ring-1 ring-emerald-300/30'
                            : p.em ? 'text-amber-300' : '';
                          return <span key={pi}>{pi > 0 ? ' ' : ''}<span className={cls}>{p.t}</span></span>;
                        })}
                      </span>
                    </Fragment>
                  );
                })}
              </p>
            </div>
          )
        )}

        {/* Bölüm listesi */}
        {menuOpen && manifest && (
          <div className="absolute inset-x-3 bottom-3 top-3 z-10 mx-auto max-w-md overflow-y-auto rounded-2xl bg-slate-900/95 p-3 shadow-2xl ring-1 ring-white/10 backdrop-blur sm:inset-x-auto sm:right-6 sm:w-96" onClick={(e) => e.stopPropagation()}>
            <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-[.14em] text-white/50">Bölümler</p>
            <ol className="space-y-1">
              {manifest.sections.map((sec, si) => {
                const active = cur?.sectionIndex === si;
                return (
                  <li key={sec.sectionId}>
                    <button type="button" onClick={() => { setPhase('running'); goTo(sectionStarts[si], true); }} className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/10 ${active ? 'bg-white/10 text-white' : 'text-white/75'}`}>
                      <span className="mt-0.5 font-mono text-xs text-indigo-300">{String(si + 1).padStart(2, '0')}</span>
                      <span>{sec.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>

      {/* Alt kontrol çubuğu */}
      <div className="px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-2 sm:px-6">
        {/* Her bölüm bir segment (genişliği süresiyle orantılı); tıklayınca o bölüme atlar. */}
        <div className="flex h-2 w-full gap-1">
          {sectionSpans.map((span, si) => (
            <button
              key={span.sectionId}
              type="button"
              tabIndex={-1}
              title={span.title}
              aria-label={`Bölüm ${si + 1}: ${span.title}`}
              onClick={() => { setPhase('running'); goTo(sectionStarts[si], true); }}
              className="relative h-full overflow-hidden rounded-full bg-white/15 hover:bg-white/25"
              style={{ flexGrow: Math.max(1, span.end - span.start), flexBasis: 0 }}
            >
              <span
                ref={(el) => { segmentFillRefs.current[si] = el; }}
                className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-400 to-pink-400"
                style={{ width: 0 }}
              />
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span ref={timeRef} className="w-24 shrink-0 font-mono text-xs tabular-nums text-white/60">0:00 / {formatTime(totalDuration)}</span>
          <div className="flex flex-1 items-center justify-center gap-2 sm:gap-4">
            <button type="button" onClick={() => step(-1)} disabled={phase !== 'running' || index === 0} aria-label="Önceki ekran" className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10 disabled:opacity-30">
              <ChevronLeft className="h-[1.625rem] w-[1.625rem]" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={phase === 'running' ? togglePlay : () => start(phase === 'ended' ? 0 : savedIndex ?? 0)}
              disabled={!manifest}
              aria-label={playing ? 'Duraklat' : 'Oynat'}
              className="grid h-14 w-14 place-items-center rounded-full bg-white text-slate-900 shadow-lg shadow-indigo-500/30 transition-transform hover:scale-105 disabled:opacity-40"
            >
              {playing ? <Pause className="h-6 w-6" fill="currentColor" aria-hidden="true" /> : <Play fill="currentColor" className="h-6 w-6 translate-x-0.5" aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => step(1)} disabled={phase !== 'running' || index >= flat.length - 1} aria-label="Sonraki ekran" className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10 disabled:opacity-30">
              <ChevronRight className="h-[1.625rem] w-[1.625rem]" aria-hidden="true" />
            </button>
          </div>
          <div className="flex w-24 shrink-0 items-center justify-end gap-1">
            <button type="button" onClick={cycleRate} aria-label={`Oynatma hızı ${rate}x`} className="h-9 min-w-[3rem] rounded-full px-2 font-mono text-xs font-semibold text-white/80 ring-1 ring-white/20 hover:bg-white/10">
              {rate}x
            </button>
            <button type="button" onClick={() => setMenuOpen((o) => !o)} disabled={!manifest} aria-label="Bölümler" aria-expanded={menuOpen} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10 disabled:opacity-30">
              <ListTree className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
