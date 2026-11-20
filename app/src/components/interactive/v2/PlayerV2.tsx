'use client';

// Etkileşimli Ders Oynatıcısı v2 — Oyunlaştırılmış, tek-ekranda-tek-bilgi, dokunsal öğrenme motoru.
// Mevcut sound.ts, RobotGuide.tsx ve Kavram Avı bileşenleriyle tam entegredir.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Baloo_2 } from 'next/font/google';
import { Music, Volume2, VolumeX, X } from 'lucide-react';
import { lessonSound } from '@/app/src/lib/interactiveLesson/sound';
import { trackContentEvent } from '@/app/src/lib/contentUsage';
import { ttsText, voiceAudioPath, voiceKey, voiceManifestPath, VOICE_BUCKET } from '@/app/src/lib/interactiveLesson/guide';
import type { HydratedLessonV2, HydratedV2Step } from '@/app/src/lib/interactiveLesson/typesV2';
import RobotGuide, { type RobotMood } from '../RobotGuide';
import { AtomDialogue } from './AtomDialogue';
import { JourneyMap } from './JourneyMap';
import { AtmosphereBackdrop, MAP_ATMOSPHERE, STOP_ATMOSPHERES, ThemeDeviceSvg } from './ThemesV2';
import { KavramAviGame } from './games/KavramAviGame';
import { SliderGame } from './games/SliderGame';
import { MatchGame } from './games/MatchGame';
import { OrderGame } from './games/OrderGame';
import { HatGame } from './games/HatGame';
import { SwipeSortGame } from './games/SwipeSortGame';
import { SpotErrorGame } from './games/SpotErrorGame';
import { ScenarioGame } from './games/ScenarioGame';
import { PoolQuestionGame } from './games/PoolQuestionGame';
import s from './v2.module.css';

const display = Baloo_2({ subsets: ['latin', 'latin-ext'], weight: ['600', '700', '800'] });

const GAME_CHIP_LABELS: Record<HydratedV2Step['kind'], string> = {
  story: '✨ Hikâye',
  kavram_avi: '🎯 Kavram Avı',
  slider: '🎚️ Kaydır & Keşfet',
  hat: '🏅 Rozet Tak',
  match: '⚡ Hızlı Eşleştirme',
  order: '🪜 Sıraya Diz',
  swipe_sort: '👆 Kaydır & Ayır',
  spot_error: '🔎 Hata Avcısı',
  scenario: '🧭 Senaryo Kararı',
  pool_question: '💬 Atom Soruyor',
};

type SavedV2 = { openCount: number; stars: Record<number, number> };

function loadProgress(topicId: number): SavedV2 {
  try {
    const raw = localStorage.getItem(`il_v2_${topicId}`);
    if (!raw) return { openCount: 1, stars: {} };
    const parsed = JSON.parse(raw) as Partial<SavedV2>;
    return { openCount: Math.max(1, parsed.openCount ?? 1), stars: parsed.stars ?? {} };
  } catch {
    return { openCount: 1, stars: {} };
  }
}

function saveProgress(topicId: number, data: SavedV2) {
  try {
    localStorage.setItem(`il_v2_${topicId}`, JSON.stringify(data));
  } catch {}
}

function voiceUrl(text: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${VOICE_BUCKET}/${voiceAudioPath(voiceKey(text))}`;
}

function initialStepText(step: HydratedV2Step): string {
  if (step.kind === 'pool_question') {
    return step.say ?? 'Gerçek sınav sorusuyla bilgini test et!';
  }
  return step.say;
}

function ConfettiBurst() {
  const colors = ['#ff7a29', '#15b8d9', '#ffd166', '#22c55e', '#a78bfa'];
  return (
    <div className={s.confettiLayer} aria-hidden="true">
      {Array.from({ length: 34 }, (_, i) => (
        <i
          key={i}
          className={s.confettiPiece}
          style={
            {
              left: `${(i * 29) % 100}%`,
              background: colors[i % colors.length],
              '--dur': `${1.4 + (i % 5) * 0.22}s`,
              animationDelay: `${(i % 7) * 0.05}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

type RunSession = {
  stopIdx: number;
  queue: HydratedV2Step[];
  stepIdx: number;
  retryQueue: HydratedV2Step[];
  inRetryPass: boolean;
  misses: number;
  completedCount: number;
  totalCount: number;
  finished: boolean;
};

export default function PlayerV2({
  lesson,
  onClose,
}: {
  lesson: HydratedLessonV2;
  onClose: () => void;
}) {
  const [progress, setProgress] = useState<SavedV2>(() => loadProgress(lesson.topicId));
  const [mode, setMode] = useState<'map' | 'scene'>('map');
  const [warpingTo, setWarpingTo] = useState<number | null>(null);
  const [session, setSession] = useState<RunSession | null>(null);
  const [confetti, setConfetti] = useState(false);

  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  const [voiced, setVoiced] = useState<Set<string>>(() => new Set());

  const [atomMood, setAtomMood] = useState<RobotMood>('normal');
  const [atomTone, setAtomTone] = useState<'normal' | 'ok' | 'oops'>('normal');
  const [atomText, setAtomText] = useState('');
  const [talking, setTalking] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const soundOnRef = useRef(soundOn);
  const voicedRef = useRef(voiced);
  useEffect(() => {
    soundOnRef.current = soundOn;
    voicedRef.current = voiced;
  });

  // Ses listesi (varsa Azure TTS) ve yaşam döngüsü
  useEffect(() => {
    trackContentEvent('interactive_open', lesson.topicId);
    const controller = new AbortController();
    fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${VOICE_BUCKET}/${voiceManifestPath(lesson.topicId)}`,
      { signal: controller.signal, cache: 'no-store' },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((m: { keys?: string[] } | null) => {
        if (m?.keys?.length) setVoiced(new Set(m.keys));
      })
      .catch(() => {});

    const sound = lessonSound();
    const onVis = () => (document.hidden ? sound.suspend() : sound.resume());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', onVis);
      sound.close();
    };
  }, [lesson.topicId]);

  // Escape ile kapatma
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const speakLine = useCallback((text: string) => {
    if (!soundOnRef.current) return;
    const key = voiceKey(text);
    if (!voicedRef.current.has(key)) return;
    setTalking(true);
    void lessonSound().speak([{ url: voiceUrl(text), text: ttsText(text) }], () => setTalking(false));
  }, []);

  const react = useCallback(
    (
      mood: RobotMood,
      text: string,
      tone: 'normal' | 'ok' | 'oops' = 'normal',
      sfx?: 'ok' | 'retry' | 'tap' | 'link' | 'win' | 'warp',
      linkStep = 0,
    ) => {
      setAtomMood(mood);
      setAtomText(text);
      setAtomTone(tone);
      if (soundOnRef.current && sfx) {
        lessonSound().sfx(sfx, linkStep);
      }
      speakLine(text);
    },
    [speakLine],
  );

  const openStop = useCallback(
    (stopIdx: number) => {
      const stop = lesson.stops[stopIdx];
      if (!stop) return;
      const first = stop.steps[0];
      setSession({
        stopIdx,
        queue: [...stop.steps],
        stepIdx: 0,
        retryQueue: [],
        inRetryPass: false,
        misses: 0,
        completedCount: 0,
        totalCount: stop.steps.length,
        finished: false,
      });
      setMode('scene');
      if (first) {
        setAtomMood('normal');
        setAtomTone('normal');
        setAtomText(initialStepText(first));
        speakLine(initialStepText(first));
      }
      scrollRef.current?.scrollTo({ top: 0 });
    },
    [lesson.stops, speakLine],
  );

  const warpToStop = useCallback(
    (stopIdx: number) => {
      lessonSound().unlock();
      if (soundOnRef.current) lessonSound().sfx('warp');
      const reduceMotion =
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) {
        openStop(stopIdx);
        return;
      }
      setWarpingTo(stopIdx);
      window.setTimeout(() => {
        setWarpingTo(null);
        openStop(stopIdx);
      }, 680);
    },
    [openStop],
  );

  const handleMiss = useCallback(() => {
    setSession((prev) => {
      if (!prev || prev.finished) return prev;
      const cur = prev.queue[prev.stepIdx];
      const shouldQueue = !prev.inRetryPass && cur && !prev.retryQueue.includes(cur);
      return {
        ...prev,
        misses: prev.misses + 1,
        retryQueue: shouldQueue ? [...prev.retryQueue, cur] : prev.retryQueue,
      };
    });
  }, []);

  const handleAdvance = useCallback(() => {
    if (soundOnRef.current) lessonSound().sfx('tap');
    setSession((prev) => {
      if (!prev) return prev;
      const nextIdx = prev.stepIdx + 1;
      const nextDone = prev.completedCount + 1;

      if (nextIdx < prev.queue.length) {
        const nextStep = prev.queue[nextIdx];
        setAtomMood('normal');
        setAtomTone('normal');
        setAtomText(initialStepText(nextStep));
        speakLine(initialStepText(nextStep));
        scrollRef.current?.scrollTo({ top: 0 });
        return { ...prev, stepIdx: nextIdx, completedCount: nextDone };
      }

      // Akıllı tekrar kuyruğu: yanlış yapılan adımlar durak sonunda 1 kez daha oynanır.
      if (prev.retryQueue.length > 0 && !prev.inRetryPass) {
        const retryIntro: HydratedV2Step = {
          kind: 'story',
          emoji: '🔁',
          badge: 'Tekrar Zamanı',
          say: 'Harika gidiyorsun! Az önce zorlandığın adımı şimdi bir kez daha deneyip pekiştirelim.',
        };
        const retryList = [retryIntro, ...prev.retryQueue];
        setAtomMood('wow');
        setAtomTone('normal');
        setAtomText(retryIntro.say);
        speakLine(retryIntro.say);
        scrollRef.current?.scrollTo({ top: 0 });
        return {
          ...prev,
          queue: retryList,
          stepIdx: 0,
          retryQueue: [],
          inRetryPass: true,
          completedCount: nextDone,
          totalCount: prev.totalCount + retryList.length,
        };
      }

      // Durak tamamlandı!
      const stop = lesson.stops[prev.stopIdx];
      const earnedStars = prev.misses === 0 ? 3 : prev.misses <= 2 ? 2 : 1;
      const isLast = prev.stopIdx === lesson.stops.length - 1;

      setProgress((old) => {
        const updated: SavedV2 = {
          openCount: Math.min(lesson.stops.length, Math.max(old.openCount, prev.stopIdx + 2)),
          stars: { ...old.stars, [prev.stopIdx]: Math.max(old.stars[prev.stopIdx] ?? 0, earnedStars) },
        };
        saveProgress(lesson.topicId, updated);
        if (Object.keys(updated.stars).length === lesson.stops.length) {
          trackContentEvent('interactive_finish', lesson.topicId);
        }
        return updated;
      });

      const winMsg = isLast
        ? lesson.guide?.finish ?? 'Tebrikler! Tüm parçaları toplayarak macerayı tamamladın!'
        : `Harikasın! <b>${stop.part.name}</b> kapsüle takıldı!`;
      setAtomMood('happy');
      setAtomTone('ok');
      setAtomText(winMsg);
      if (soundOnRef.current) lessonSound().sfx('win');
      speakLine(winMsg);
      setConfetti(true);
      window.setTimeout(() => setConfetti(false), 2600);
      scrollRef.current?.scrollTo({ top: 0 });
      return { ...prev, completedCount: prev.totalCount, finished: true };
    });
  }, [lesson, speakLine]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    soundOnRef.current = next;
    if (!next) {
      lessonSound().hush();
      setTalking(false);
    } else {
      lessonSound().unlock();
      lessonSound().sfx('tap');
    }
  };

  const toggleMusic = () => {
    const next = !musicOn;
    setMusicOn(next);
    const sound = lessonSound();
    sound.unlock();
    if (next) sound.startMusic();
    else sound.stopMusic();
  };

  const backToMap = () => {
    if (soundOnRef.current) lessonSound().sfx('tap');
    lessonSound().hush();
    setTalking(false);
    setMode('map');
    setSession(null);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const resetProgress = () => {
    const empty: SavedV2 = { openCount: 1, stars: {} };
    setProgress(empty);
    saveProgress(lesson.topicId, empty);
    if (soundOnRef.current) lessonSound().sfx('tap');
  };

  const activeStop = session ? lesson.stops[session.stopIdx] : null;
  const activeStep = session && !session.finished ? session.queue[session.stepIdx] : null;
  const atmosphere =
    mode === 'scene' && session
      ? STOP_ATMOSPHERES[session.stopIdx % STOP_ATMOSPHERES.length]
      : MAP_ATMOSPHERE;
  const collectedCount = Object.keys(progress.stars).length;
  const progressPct = session
    ? session.finished
      ? 100
      : Math.round((session.completedCount / Math.max(1, session.totalCount)) * 100)
    : 0;

  return (
    <div
      className={`${s.root} ${display.className}`}
      style={{ '--tint': activeStop?.tint ?? '#efe9ff' } as React.CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-label={`${lesson.topicTitle} — Etkileşimli Ders`}
    >
      <AtmosphereBackdrop preset={atmosphere} />

      {/* Üst Çubuk */}
      <header className={`${s.header} ${atmosphere.dark ? s.headerDark : ''}`}>
        {mode === 'map' ? (
          <span className={s.courseLabel}>{lesson.courseLabel}</span>
        ) : (
          <button type="button" onClick={backToMap} className={s.pill}>
            ← Harita
          </button>
        )}

        <div className={s.progressWrap}>
          {mode === 'scene' && (
            <div className={s.progressBar} role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
              <i className={s.progressFill} style={{ width: `${progressPct}%` }} />
            </div>
          )}
        </div>

        <span className={s.pill} aria-label={`${collectedCount}/${lesson.stops.length} parça toplandı`}>
          ⚙️ {collectedCount}/{lesson.stops.length}
        </span>

        <button
          type="button"
          onClick={toggleMusic}
          className={`${s.pill} ${s.pillIcon} ${!musicOn ? s.pillOff : ''}`}
          aria-pressed={musicOn}
          aria-label="Arka plan müziği"
          title="Arka plan müziği"
        >
          <Music className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={toggleSound}
          className={`${s.pill} ${s.pillIcon} ${!soundOn ? s.pillOff : ''}`}
          aria-pressed={soundOn}
          aria-label="Ses efektleri ve konuşma"
          title="Ses aç/kapat"
        >
          {soundOn ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
        </button>

        <button type="button" onClick={onClose} className={`${s.pill} ${s.pillIcon}`} aria-label="Dersi kapat">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      {/* Ana İçerik */}
      <div ref={scrollRef} className={s.scrollArea}>
        {mode === 'map' && (
          <JourneyMap
            lesson={lesson}
            openCount={progress.openCount}
            stars={progress.stars}
            onSelectStop={warpToStop}
            onLockedTap={() => soundOnRef.current && lessonSound().sfx('retry')}
            onReset={resetProgress}
          />
        )}

        {mode === 'scene' && session && activeStop && (
          <div className={s.sceneWrap}>
            <div className={s.card} key={`${session.stopIdx}-${session.inRetryPass ? 'r' : 'm'}-${session.stepIdx}-${session.finished ? 'fin' : 'play'}`}>
              <div className={s.topTags}>
                <span className={s.eraChip}>{activeStop.subtitle}</span>
                {activeStep && <span className={s.gameChip}>{GAME_CHIP_LABELS[activeStep.kind]}</span>}
                {session.finished && <span className={s.gameChip}>🏆 Durak Tamamlandı</span>}
              </div>

              <AtomDialogue
                mood={atomMood}
                talking={talking}
                upgraded={session.finished && session.stopIdx === lesson.stops.length - 1}
                tone={atomTone}
                text={atomText}
                onReplay={() => speakLine(atomText)}
              />

              {/* Aktif Adım */}
              {!session.finished && activeStep && (
                <>
                  {activeStep.kind === 'story' && (
                    <>
                      <div className={s.stageOrb} aria-hidden="true">
                        {activeStep.emoji}
                      </div>
                      <button type="button" onClick={handleAdvance} className={s.goBtn}>
                        Devam →
                      </button>
                    </>
                  )}
                  {activeStep.kind === 'kavram_avi' && (
                    <KavramAviGame step={activeStep} onReact={react} onMiss={handleMiss} onComplete={handleAdvance} />
                  )}
                  {activeStep.kind === 'slider' && (
                    <SliderGame step={activeStep} onReact={react} onMiss={handleMiss} onComplete={handleAdvance} />
                  )}
                  {activeStep.kind === 'match' && (
                    <MatchGame step={activeStep} onReact={react} onMiss={handleMiss} onComplete={handleAdvance} />
                  )}
                  {activeStep.kind === 'order' && (
                    <OrderGame step={activeStep} onReact={react} onMiss={handleMiss} onComplete={handleAdvance} />
                  )}
                  {activeStep.kind === 'hat' && (
                    <HatGame step={activeStep} onReact={react} onMiss={handleMiss} onComplete={handleAdvance} />
                  )}
                  {activeStep.kind === 'swipe_sort' && (
                    <SwipeSortGame step={activeStep} onReact={react} onMiss={handleMiss} onComplete={handleAdvance} />
                  )}
                  {activeStep.kind === 'spot_error' && (
                    <SpotErrorGame step={activeStep} onReact={react} onMiss={handleMiss} onComplete={handleAdvance} />
                  )}
                  {activeStep.kind === 'scenario' && (
                    <ScenarioGame step={activeStep} onReact={react} onMiss={handleMiss} onComplete={handleAdvance} />
                  )}
                  {activeStep.kind === 'pool_question' && (
                    <PoolQuestionGame step={activeStep} onReact={react} onMiss={handleMiss} onComplete={handleAdvance} />
                  )}
                </>
              )}

              {/* Durak Ödül Ekranı */}
              {session.finished && (
                <>
                  <div className={`${s.stageOrb} ${s.stageOrbReward}`}>
                    {session.stopIdx === lesson.stops.length - 1 ? (
                      <div className="h-24 w-24">
                        <ThemeDeviceSvg themeId={lesson.themeId} collected={lesson.stops.length} total={lesson.stops.length} />
                      </div>
                    ) : (
                      <span aria-hidden="true">{activeStop.part.emoji}</span>
                    )}
                  </div>

                  <p className="text-center text-lg font-extrabold text-slate-900">
                    {session.stopIdx === lesson.stops.length - 1
                      ? `🏅 ${lesson.badgeTitle} Rozeti Kazanıldı!`
                      : `${activeStop.part.name} Takıldı (${collectedCount}/${lesson.stops.length})`}
                  </p>

                  {(() => {
                    const earned = session.misses === 0 ? 3 : session.misses <= 2 ? 2 : 1;
                    return (
                      <div className={s.starsRow} aria-label={`${earned} yıldız`}>
                        {'★'.repeat(earned)}
                        {'☆'.repeat(3 - earned)}
                      </div>
                    );
                  })()}

                  {session.stopIdx < lesson.stops.length - 1 && (
                    <button type="button" onClick={() => warpToStop(session.stopIdx + 1)} className={s.goBtn}>
                      Sıradaki Durağa Işınlan →
                    </button>
                  )}
                  <button type="button" onClick={backToMap} className={s.secBtn}>
                    Haritaya Dön
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Portal Işınlanma Geçişi */}
      {warpingTo !== null && lesson.stops[warpingTo] && (
        <div className={s.warpOverlay} aria-live="assertive">
          <div className={s.portal}>
            <div className={s.portalRing} />
            <div className={`${s.portalRing} ${s.portalRing2}`} />
            <div className="w-20">
              <RobotGuide mood="happy" />
            </div>
          </div>
          <span className={s.warpEra}>{lesson.stops[warpingTo].subtitle}</span>
          <h2 className={s.warpTitle}>{lesson.stops[warpingTo].title}</h2>
        </div>
      )}

      {confetti && <ConfettiBurst />}
    </div>
  );
}
