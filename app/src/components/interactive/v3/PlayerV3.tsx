'use client';

// Etkileşimli Ders Oynatıcısı v3 — "Atom Keşif Dünyası".
// Supabase'teki 52 dersin ses kaydı (v3BeatSpeech) "1) Başlık → 2) Görsel Şema → 3) Atom Özeti (fact)"
// sırasıyla tek MP3 olarak üretildiği için anlatım ekranındaki görsel sıra sesle %100 birebir aynıdır:
//   1. Üstte: Konu etiketi + Başlık
//   2. Ortada: Görsel Şema / Canlı Sahne
//   3. Altta: Tam genişlik Atom özet balonu (içinde ses butonu yok, metin sıkışmaz)
// Ses kontrolleri (Durdur / Başlat / Dinle / Tekrar) alt lacivert oyun çubuğunun ortasında sabit durur.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Home,
  Lightbulb,
  Maximize2,
  Minimize2,
  Music,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import { trackContentEvent } from '@/app/src/lib/contentUsage';
import {
  GUIDE,
  ttsText,
  v3BeatVoiceCandidates,
  voiceAudioPath,
  voiceKey,
  voiceManifestPath,
  VOICE_BUCKET,
} from '@/app/src/lib/interactiveLesson/guide';
import {
  fetchRemoteProgressV3,
  hasAnyActiveProgressV3,
  loadLocalProgressV3,
  mergeProgressV3,
  resetRunProgressV3,
  saveLocalProgressV3,
  saveRemoteProgressV3,
  type SavedV3Progress,
} from '@/app/src/lib/interactiveLesson/progressV3';
import { lessonSound } from '@/app/src/lib/interactiveLesson/sound';
import {
  isInteractiveBeatVisual,
  type HydratedLessonV3,
  type HydratedV3Question,
  type HydratedV3Section,
  type V3MiniGameConfig,
  type V3TeachBeat,
} from '@/app/src/lib/interactiveLesson/typesV3';
import RobotGuide, { type RobotMood } from '../RobotGuide';
import { MiniGameHost, type MiniGameFeedback, type MiniGameResult } from './games/MiniGameRegistry';
import { PoolCheckStage } from './PoolCheckStage';
import { DigestiveScene } from './scenes/DigestiveScene';
import { GenericVisualScene } from './scenes/GenericVisualScene';
import { VoiceControls, type VoiceStatus } from './VoiceControls';
import { WorldMapView } from './WorldMapView';
import { useDismissOnBack } from '@/app/src/hooks/useDismissOnBack';
import s from './v3.module.css';

type ScreenMode = 'map' | 'play';

type PlayScreen =
  | { kind: 'teach'; key: string; beat: V3TeachBeat }
  | { kind: 'quick'; key: string; beat: V3TeachBeat }
  | { kind: 'game'; key: string; game: V3MiniGameConfig }
  | { kind: 'check'; key: string; question: HydratedV3Question; checkIndex: number; checkTotal: number }
  | { kind: 'done'; key: string };

function buildSectionScreens(sec: HydratedV3Section): PlayScreen[] {
  const list: PlayScreen[] = [];
  for (const beat of sec.beats) {
    list.push({ kind: 'teach', key: `teach-${beat.id}`, beat });
    if (beat.quickCheck) {
      list.push({ kind: 'quick', key: `quick-${beat.id}`, beat });
    }
  }
  list.push({ kind: 'game', key: `game-${sec.sectionId}`, game: sec.game });
  sec.checkQuestions.forEach((question, checkIndex) => {
    list.push({
      kind: 'check',
      key: `check-${question.id}`,
      question,
      checkIndex,
      checkTotal: sec.checkQuestions.length,
    });
  });
  list.push({ kind: 'done', key: `done-${sec.sectionId}` });
  return list;
}

function pickInitialSectionIdx(lesson: HydratedLessonV3, prog: SavedV3Progress): number {
  const maxIdx = Math.max(0, lesson.sections.length - 1);
  const doneSet = new Set(prog.completedSections);
  const lastSec = lesson.sections[prog.lastSectionIdx];
  if (lastSec && !doneSet.has(lastSec.sectionId)) {
    return Math.min(prog.lastSectionIdx, maxIdx);
  }
  const firstPending = lesson.sections.findIndex((sec) => !doneSet.has(sec.sectionId));
  if (firstPending >= 0) return firstPending;
  return Math.min(prog.lastSectionIdx, maxIdx);
}

function voiceUrl(text: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${VOICE_BUCKET}/${voiceAudioPath(voiceKey(text))}`;
}

export default function PlayerV3({
  lesson,
  onClose,
}: {
  lesson: HydratedLessonV3;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState<SavedV3Progress>(() => loadLocalProgressV3(lesson.topicId));
  const [mode, setMode] = useState<ScreenMode>('map');
  const [sectionIdx, setSectionIdx] = useState(() =>
    pickInitialSectionIdx(lesson, loadLocalProgressV3(lesson.topicId)),
  );
  const [screenIdx, setScreenIdx] = useState(0);

  const [quickWrongIdx, setQuickWrongIdx] = useState<number | null>(null);
  const [solvedCheckIds, setSolvedCheckIds] = useState<Set<number>>(() => new Set());
  const [completedLabKeys, setCompletedLabKeys] = useState<Set<string>>(() => new Set());
  const [lastGameResult, setLastGameResult] = useState<MiniGameResult | null>(null);

  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [voiced, setVoiced] = useState<Set<string>>(() => new Set());
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [lastVoicedText, setLastVoicedText] = useState<string | null>(null);
  const [gamePromptText, setGamePromptText] = useState<string | null>(null);
  const [atomMood, setAtomMood] = useState<RobotMood>('normal');
  const [zoomedVisual, setZoomedVisual] = useState(false);
  const talking = voiceStatus === 'playing';

  const soundOnRef = useRef(soundOn);
  const voicedRef = useRef(voiced);
  // Akıllı Niyet Takibi: Bölüm açıldığında ilk ekran sessiz başlar; kullanıcı "Dinle"ye
  // bastığı anda oturum sesli moda geçer ve sonraki sayfalarda otomatik okumaya devam eder.
  const autoVoiceRef = useRef(false);
  useEffect(() => {
    soundOnRef.current = soundOn;
    voicedRef.current = voiced;
  });

  const activeSection = lesson.sections[sectionIdx];
  const screens = useMemo(
    () => (activeSection ? buildSectionScreens(activeSection) : []),
    [activeSection],
  );
  const sectionTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const sec of lesson.sections) {
      map[String(sec.sectionId)] = Math.max(1, buildSectionScreens(sec).length - 1);
    }
    return map;
  }, [lesson.sections]);
  const activeScreen = screens[screenIdx];
  const playableCount = Math.max(1, screens.length - 1); // done hariç
  const solvedGateSet = useMemo(() => new Set(progress.solvedGates), [progress.solvedGates]);

  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  });

  const commitProgress = useCallback(
    (
      updater: (old: SavedV3Progress) => SavedV3Progress,
      opts?: { markTopicCompleted?: boolean },
    ) => {
      setProgress((old) => {
        const next = updater(old);
        saveLocalProgressV3(lesson.topicId, next);
        void saveRemoteProgressV3(lesson.topicId, next, opts);
        return next;
      });
    },
    [lesson.topicId],
  );

  // Giriş yapmış öğrencinin Supabase ilerlemesini çek ve yerel veriyle birleştir
  useEffect(() => {
    let alive = true;
    void fetchRemoteProgressV3(lesson.topicId).then((remote) => {
      if (!alive || !remote) return;
      const local = progressRef.current;
      const merged = mergeProgressV3(local, remote);
      saveLocalProgressV3(lesson.topicId, merged);
      setProgress(merged);
      setSectionIdx((cur) => (mode === 'map' ? pickInitialSectionIdx(lesson, merged) : cur));
      const localTs = local.updatedAt ? Date.parse(local.updatedAt) : 0;
      const remoteTs = remote.updatedAt ? Date.parse(remote.updatedAt) : 0;
      if (localTs > remoteTs) {
        void saveRemoteProgressV3(lesson.topicId, merged);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.topicId]);

  // Yaşam döngüsü, istatistik takibi, Azure ses listesi ve tam ekran
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
    const onVis = () => {
      if (document.hidden) {
        sound.suspend();
        setVoiceStatus('idle');
      } else {
        sound.resume();
      }
    };
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('fullscreenchange', onFs);
      sound.close();
    };
  }, [lesson.topicId]);

  const stopSpeech = useCallback(() => {
    lessonSound().hush();
    setVoiceStatus('idle');
  }, []);

  const pauseSpeech = useCallback(() => {
    autoVoiceRef.current = false;
    if (lessonSound().pauseVoice()) {
      setVoiceStatus('paused');
    }
  }, []);

  const resumeSpeech = useCallback(() => {
    autoVoiceRef.current = true;
    if (lessonSound().resumeVoice()) {
      setVoiceStatus('playing');
    }
  }, []);

  const returnToMap = useCallback(() => {
    stopSpeech();
    setZoomedVisual(false);
    setMode('map');
  }, [stopSpeech]);

  useEffect(() => {
    if (mode === 'map') {
      lessonSound().hush();
    }
  }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomedVisual) {
          setZoomedVisual(false);
          return;
        }
        if (!document.fullscreenElement) {
          if (mode === 'play') returnToMap();
          else {
            stopSpeech();
            onClose();
          }
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode, onClose, returnToMap, stopSpeech, zoomedVisual]);

  const speakLine = useCallback((text: string, force = false) => {
    const key = voiceKey(text);
    if (!voicedRef.current.has(key)) return;
    setLastVoicedText(text);
    if (!force && (!soundOnRef.current || !autoVoiceRef.current)) return;
    if (force) {
      autoVoiceRef.current = true;
      if (!soundOnRef.current) {
        setSoundOn(true);
        soundOnRef.current = true;
      }
    }
    lessonSound().unlock();
    setVoiceStatus('playing');
    void lessonSound().speak([{ url: voiceUrl(text), text: ttsText(text) }], () => setVoiceStatus('idle'));
  }, []);

  const handleGameSpeak = useCallback(
    (text: string, force = false) => {
      setGamePromptText(text);
      speakLine(text, force);
    },
    [speakLine],
  );

  // Anlatım ekranı ses metni: Önce doğal öğretmen anlatımı (`beat.narration`), yoksa yeni doğal yedek,
  // o da yoksa yayındaki mevcut eski MP3 anahtarları (sıfır kırılım) sırayla aranır.
  const resolveBeatVoice = useCallback((beat: V3TeachBeat, set: Set<string>): string | null => {
    for (const candidate of v3BeatVoiceCandidates(beat)) {
      if (set.has(voiceKey(candidate))) return candidate;
    }
    return null;
  }, []);

  const triggerScreenAudio = useCallback(
    (scr: PlayScreen | undefined, targetSectionIdx: number) => {
      if (!scr) return;
      setLastVoicedText(null);
      if (scr.kind !== 'game') setGamePromptText(null);

      if (scr.kind === 'teach') {
        setAtomMood('normal');
        const chosen = resolveBeatVoice(scr.beat, voicedRef.current);
        if (chosen) speakLine(chosen);
      } else if (scr.kind === 'quick') {
        setAtomMood('think');
        if (scr.beat.quickCheck) speakLine(scr.beat.quickCheck.prompt);
      } else if (scr.kind === 'game') {
        setAtomMood('wow');
        if (scr.game.kind === 'kavram_avi' && !scr.game.rounds[0]?.definition) {
          setGamePromptText(scr.game.intro);
          speakLine(scr.game.intro);
        }
      } else if (scr.kind === 'check') {
        setAtomMood('think');
        speakLine(scr.question.question_text);
      } else if (scr.kind === 'done') {
        setAtomMood('celebrate');
        if (soundOnRef.current) lessonSound().sfx('win');
        speakLine(
          targetSectionIdx === lesson.sections.length - 1
            ? (lesson.guide?.finish ?? GUIDE.finish)
            : GUIDE.v3SectionDone,
        );
      }
    },
    [lesson.guide?.finish, lesson.sections.length, resolveBeatVoice, speakLine],
  );

  const handleFeedback = useCallback(
    (fb: MiniGameFeedback) => {
      setAtomMood(fb.mood);
      if (soundOnRef.current && fb.sfx) {
        lessonSound().sfx(fb.sfx, fb.linkStep ?? 0);
      }
      speakLine(fb.text);
    },
    [speakLine],
  );

  const handleLabComplete = useCallback(
    (screenKey: string) => {
      setCompletedLabKeys((prev) => {
        if (prev.has(screenKey)) return prev;
        const next = new Set(prev);
        next.add(screenKey);
        return next;
      });
      setAtomMood('celebrate');
      if (soundOnRef.current) {
        lessonSound().sfx('ok');
      }
      speakLine(GUIDE.v3LabDone);
    },
    [speakLine],
  );

  const isInteractiveTeachLab =
    activeScreen?.kind === 'teach' && isInteractiveBeatVisual(activeScreen.beat.visual);
  const isActiveLabDone =
    isInteractiveTeachLab && activeScreen ? completedLabKeys.has(activeScreen.key) : false;

  const handleActiveLabComplete = useCallback(() => {
    if (activeScreen?.kind === 'teach') {
      handleLabComplete(activeScreen.key);
    }
  }, [activeScreen, handleLabComplete]);

  const markSectionCompleted = useCallback(
    (idx: number) => {
      const sec = lesson.sections[idx];
      if (!sec) return;
      const now = new Date().toISOString();
      let shouldMarkTopicCompleted = false;

      setProgress((old) => {
        const completed = old.completedSections.includes(sec.sectionId)
          ? old.completedSections
          : [...old.completedSections, sec.sectionId];
        const nextSectionProgress = { ...old.sectionProgress };
        delete nextSectionProgress[String(sec.sectionId)];

        const allDone = completed.length === lesson.sections.length;
        const newlyFinishedRun = allDone && !old.currentRunCounted;
        if (newlyFinishedRun) {
          shouldMarkTopicCompleted = true;
          trackContentEvent('interactive_finish', lesson.topicId);
        }

        const next: SavedV3Progress = {
          ...old,
          completedSections: completed,
          sectionProgress: nextSectionProgress,
          lastSectionIdx: idx,
          completionCount: newlyFinishedRun ? old.completionCount + 1 : old.completionCount,
          currentRunCounted: newlyFinishedRun ? true : old.currentRunCounted,
          firstCompletedAt: newlyFinishedRun ? (old.firstCompletedAt ?? now) : old.firstCompletedAt,
          lastCompletedAt: newlyFinishedRun ? now : old.lastCompletedAt,
          updatedAt: now,
        };
        saveLocalProgressV3(lesson.topicId, next);
        void saveRemoteProgressV3(lesson.topicId, next, {
          markTopicCompleted: shouldMarkTopicCompleted,
        });
        return next;
      });
    },
    [lesson.sections, lesson.topicId],
  );

  const handleResetProgress = useCallback(() => {
    stopSpeech();
    autoVoiceRef.current = false;
    if (soundOnRef.current) lessonSound().sfx('tap');
    commitProgress((old) => resetRunProgressV3(old));
    setSectionIdx(0);
    setScreenIdx(0);
    setQuickWrongIdx(null);
    setSolvedCheckIds(new Set());
    setCompletedLabKeys(new Set());
    setLastGameResult(null);
    setZoomedVisual(false);
    setAtomMood('normal');
    setMode('map');
  }, [commitProgress, stopSpeech]);

  const openSection = useCallback(
    (idx: number) => {
      const target = lesson.sections[idx];
      if (!target) return;
      stopSpeech();
      lessonSound().unlock();
      if (soundOnRef.current) lessonSound().sfx('unlock');

      const targetScreens = buildSectionScreens(target);
      const targetPlayable = Math.max(1, targetScreens.length - 1);
      const curProg = progressRef.current;
      const isAlreadyDone = curProg.completedSections.includes(target.sectionId);
      const savedStep = curProg.sectionProgress[String(target.sectionId)] ?? 0;
      const startIdx = !isAlreadyDone && savedStep > 0 ? Math.min(savedStep, targetPlayable - 1) : 0;

      setSectionIdx(idx);
      setMode('play');
      setScreenIdx(startIdx);
      setQuickWrongIdx(null);
      setLastGameResult(null);
      setZoomedVisual(false);

      commitProgress((old) => ({
        ...old,
        lastSectionIdx: idx,
        updatedAt: new Date().toISOString(),
      }));

      triggerScreenAudio(targetScreens[startIdx], idx);
    },
    [commitProgress, lesson.sections, stopSpeech, triggerScreenAudio],
  );

  const goToScreen = useCallback(
    (targetIdx: number) => {
      const clamped = Math.max(0, Math.min(targetIdx, screens.length - 1));
      const scr = screens[clamped];
      if (!scr) return;
      stopSpeech();
      lessonSound().unlock();
      setScreenIdx(clamped);
      setQuickWrongIdx(null);
      setZoomedVisual(false);

      if (activeSection && scr.kind !== 'done') {
        const secKey = String(activeSection.sectionId);
        commitProgress((old) => ({
          ...old,
          lastSectionIdx: sectionIdx,
          sectionProgress: {
            ...old.sectionProgress,
            [secKey]: Math.max(clamped, old.sectionProgress[secKey] ?? 0),
          },
          updatedAt: new Date().toISOString(),
        }));
      }

      if (scr.kind === 'done') {
        markSectionCompleted(sectionIdx);
      } else if (soundOnRef.current) {
        lessonSound().sfx(scr.kind === 'game' ? 'unlock' : 'tap');
      }

      triggerScreenAudio(scr, sectionIdx);
    },
    [activeSection, commitProgress, markSectionCompleted, screens, sectionIdx, stopSpeech, triggerScreenAudio],
  );

  const handleQuickOption = (beat: V3TeachBeat, optIdx: number) => {
    if (!beat.quickCheck || solvedGateSet.has(beat.id)) return;
    lessonSound().unlock();
    if (optIdx === beat.quickCheck.answer) {
      setQuickWrongIdx(null);
      commitProgress((old) => {
        const gates = old.solvedGates.includes(beat.id) ? old.solvedGates : [...old.solvedGates, beat.id];
        return {
          ...old,
          solvedGates: gates,
          updatedAt: new Date().toISOString(),
        };
      });
      handleFeedback({
        mood: 'happy',
        text: beat.quickCheck.okFeedback,
        tone: 'ok',
        sfx: 'ok',
      });
    } else {
      setQuickWrongIdx(optIdx);
      handleFeedback({
        mood: 'oops',
        text: beat.quickCheck.retryFeedback,
        tone: 'oops',
        sfx: 'retry',
      });
    }
  };

  const handleGameComplete = useCallback(
    (result: MiniGameResult) => {
      setLastGameResult(result);
      goToScreen(screenIdx + 1);
    },
    [goToScreen, screenIdx],
  );

  const handleNext = () => {
    if (!activeScreen) return;
    if (activeScreen.kind === 'done') {
      if (sectionIdx + 1 < lesson.sections.length) openSection(sectionIdx + 1);
      else returnToMap();
      return;
    }
    goToScreen(screenIdx + 1);
  };

  const handleBack = () => {
    if (screenIdx > 0) goToScreen(screenIdx - 1);
    else returnToMap();
  };

  // Mobilde sistem Geri tuşu: önce açık bölüm içindeyse haritaya döner, büyütülmüş görsel varsa önce onu kapatır.
  useDismissOnBack(mode === 'play', returnToMap);
  useDismissOnBack(zoomedVisual && mode === 'play', () => setZoomedVisual(false));

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    soundOnRef.current = next;
    if (!next) {
      autoVoiceRef.current = false;
      stopSpeech();
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void rootRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      void document.exitFullscreen?.().catch(() => {});
    }
  };

  const activeScreenVoiceText = useMemo(() => {
    if (!activeScreen) return null;
    if (activeScreen.kind === 'teach') {
      return resolveBeatVoice(activeScreen.beat, voiced);
    }
    if (activeScreen.kind === 'quick' && activeScreen.beat.quickCheck) {
      const p = activeScreen.beat.quickCheck.prompt;
      return voiced.has(voiceKey(p)) ? p : null;
    }
    if (activeScreen.kind === 'game') {
      const candidate = gamePromptText ?? activeScreen.game.rounds[0]?.definition ?? activeScreen.game.intro;
      return candidate && voiced.has(voiceKey(candidate)) ? candidate : null;
    }
    if (activeScreen.kind === 'check') {
      const q = activeScreen.question.question_text;
      return voiced.has(voiceKey(q)) ? q : null;
    }
    if (activeScreen.kind === 'done') {
      const doneLine =
        sectionIdx === lesson.sections.length - 1
          ? (lesson.guide?.finish ?? GUIDE.finish)
          : GUIDE.v3SectionDone;
      return voiced.has(voiceKey(doneLine)) ? doneLine : null;
    }
    return null;
  }, [
    activeScreen,
    gamePromptText,
    lesson.guide?.finish,
    lesson.sections.length,
    resolveBeatVoice,
    sectionIdx,
    voiced,
  ]);

  const replayTargetText = activeScreenVoiceText ?? lastVoicedText;
  const showBottomVoiceDock = Boolean(replayTargetText) || voiceStatus !== 'idle';

  const isNextDisabled =
    (activeScreen?.kind === 'quick' && !solvedGateSet.has(activeScreen.beat.id)) ||
    (activeScreen?.kind === 'check' && !solvedCheckIds.has(activeScreen.question.id));

  const doneCount = progress.completedSections.length;
  const currentStepDisplay = activeScreen?.kind === 'done' ? playableCount : Math.min(screenIdx + 1, playableCount);
  const stepProgressPct =
    activeScreen?.kind === 'done'
      ? 100
      : Math.min(100, Math.max(10, Math.round(((screenIdx + 1) / playableCount) * 100)));

  return (
    <div
      ref={rootRef}
      className={s.gameShell}
      data-fullscreen={isFullscreen ? 'true' : 'false'}
      role="dialog"
      aria-modal="true"
      aria-label={`${lesson.topicTitle} — Etkileşimli Ders`}
    >
      {/* ==================== ÜST OYUN HUD ÇUBUĞU ==================== */}
      <header className={s.gameTopBar}>
        {mode === 'play' ? (
          <button
            type="button"
            onClick={() => {
              if (soundOnRef.current) lessonSound().sfx('tap');
              returnToMap();
            }}
            className={s.gameBrandBtn}
            title="Keşif Haritasına Dön"
          >
            <span className="w-8 shrink-0">
              <RobotGuide mood={atomMood} talking={talking} />
            </span>
            <span className={s.gameBrandTitle}>{lesson.topicTitle}</span>
          </button>
        ) : (
          <div className={s.gameBrandStatic}>
            <span className="w-8 shrink-0">
              <RobotGuide mood="happy" talking={talking} />
            </span>
            <span className={s.gameBrandTitle}>{lesson.topicTitle}</span>
          </div>
        )}

        <div className={s.gameTopRight}>
          {mode === 'play' && (
            <span
              className={s.gameProgressPill}
              title={`Bölüm ${sectionIdx + 1}/${lesson.sections.length} • Adım ${currentStepDisplay}/${playableCount}`}
            >
              <span className={s.gameProgressPart}>
                <span className={s.gameProgressLabel}>Bölüm</span>{' '}
                <strong>
                  {sectionIdx + 1}/{lesson.sections.length}
                </strong>
              </span>
              <span className={s.gameProgressSep} aria-hidden="true" />
              <span className={s.gameProgressStep}>
                <span className={s.gameProgressLabel}>Adım</span>{' '}
                <strong>
                  {currentStepDisplay}/{playableCount}
                </strong>
              </span>
            </span>
          )}

          <button
            type="button"
            onClick={toggleSound}
            className={`${s.gameIconBtn} ${s.gameIconAmber} ${!soundOn ? 'opacity-50' : ''}`}
            aria-label="Ses aç/kapat"
            title="Ses aç/kapat"
          >
            {soundOn ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={toggleMusic}
            className={`${s.gameIconBtn} ${s.gameIconSky} ${!musicOn ? 'opacity-55' : ''}`}
            aria-label="Müzik aç/kapat"
            title="Müzik aç/kapat"
          >
            <Music className="h-4 w-4" aria-hidden="true" />
          </button>

          {mode === 'play' && (
            <button
              type="button"
              onClick={() => {
                if (soundOnRef.current) lessonSound().sfx('tap');
                returnToMap();
              }}
              className={`${s.gameIconBtn} ${s.gameIconBlue}`}
              aria-label="Keşif Haritasına dön"
              title="Keşif Haritasına dön"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className={`${s.gameIconBtn} ${s.gameIconGreen} ${s.hideOnMobile}`}
            aria-label="Tam ekran"
            title="Tam ekran"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className={`${s.gameIconBtn} ${s.gameIconRose}`}
            aria-label="Kapat"
            title="Kapat"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* ==================== ANA KEŞİF HARİTASI veya SENKRON OYUN SAHNESİ ==================== */}
      {mode === 'map' ? (
        <WorldMapView
          lesson={lesson}
          currentSectionIdx={sectionIdx}
          completedSections={progress.completedSections}
          sectionProgress={progress.sectionProgress}
          sectionTotals={sectionTotals}
          completionCount={progress.completionCount}
          hasActiveProgress={hasAnyActiveProgressV3(progress)}
          onSelectSection={openSection}
          onResetProgress={handleResetProgress}
        />
      ) : (
        <div className={s.gamePlayRoot}>
          <div className={s.playProgressRail} aria-hidden="true">
            <div className={s.playProgressFill} style={{ width: `${stepProgressPct}%` }} />
          </div>

          <div className={s.gamePlayStage}>
            <div className={s.worldClouds} aria-hidden="true">
              <div className={s.worldCloud} style={{ left: '8%', top: 36 }} />
              <div className={s.worldCloud} style={{ left: '34%', top: 20 }} />
              <div className={s.worldCloud} style={{ left: '72%', top: 54 }} />
            </div>

            <div className={s.gamePlayInner}>
              {/* 1) ANLATIM EKRANI (Ses sırasıyla birebir aynı: 1. Başlık → 2. Görsel Şema → 3. Tam Genişlik Atom Özeti) */}
              {activeScreen?.kind === 'teach' && (
                <div
                  key={activeScreen.key}
                  className={s.gameBeatStack}
                  data-accent={activeSection.accent}
                >
                  <div className="text-center">
                    <span className={s.gameKickerPill}>
                      <span className={s.gameKickerDot} aria-hidden="true" />
                      <span>
                        {activeSection.tabLabel} • {activeScreen.beat.kicker}
                      </span>
                    </span>
                    <h2 className={s.gameBeatHeading}>{activeScreen.beat.title}</h2>
                  </div>

                  {lesson.sceneId === 'digestive-system' && activeScreen.beat.focus ? (
                    <div
                      className={`${s.gameVisualFrame} ${s.gameVisualClickable}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setZoomedVisual(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setZoomedVisual(true);
                        }
                      }}
                      title="Görseli büyütmek için tıkla"
                      aria-label={`${activeScreen.beat.title} görselini büyüt`}
                    >
                      <span className={s.visualZoomHint} aria-hidden="true">
                        <ZoomIn className="h-4 w-4" />
                        <span>Büyüt</span>
                      </span>
                      <DigestiveScene focus={activeScreen.beat.focus} />
                    </div>
                  ) : (
                    <div
                      className={s.gameVisualFrame}
                      data-discovered={isActiveLabDone ? 'true' : 'false'}
                    >
                      <GenericVisualScene
                        visual={activeScreen.beat.visual}
                        title={activeScreen.beat.title}
                        accent={activeSection.accent}
                        soundOn={soundOn}
                        onLabComplete={isInteractiveTeachLab ? handleActiveLabComplete : undefined}
                      />
                    </div>
                  )}

                  <div
                    className={s.teachBottomSummary}
                    data-talking={talking ? 'true' : 'false'}
                    data-discovered={isActiveLabDone ? 'true' : 'false'}
                  >
                    <div className={s.teachBottomAvatar}>
                      <RobotGuide mood={isActiveLabDone ? 'celebrate' : atomMood} talking={talking} />
                    </div>
                    {isActiveLabDone ? (
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className={`${s.labDiscoveredPill} self-start`}>
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>Keşfedildi</span>
                        </span>
                        <p className={s.teachBottomText}>{activeScreen.beat.fact}</p>
                      </div>
                    ) : (
                      <p className={s.teachBottomText}>{activeScreen.beat.fact}</p>
                    )}
                  </div>
                </div>
              )}

              {/* 2) AYRI HIZLI SORU EKRANI */}
              {activeScreen?.kind === 'quick' && activeScreen.beat.quickCheck && (
                <div className={s.gameQuestionWrap}>
                  <div className={s.mentorCard}>
                    <div className={s.mentorAvatarDock}>
                      <RobotGuide
                        mood={
                          solvedGateSet.has(activeScreen.beat.id)
                            ? 'celebrate'
                            : quickWrongIdx !== null
                              ? 'oops'
                              : 'think'
                        }
                      />
                    </div>
                    <div className={s.mentorBody}>
                      <div className={s.mentorTopRow}>
                        <span className={s.mentorKickerBadge}>
                          Hızlı Kontrol • {activeScreen.beat.title}
                        </span>
                      </div>
                      <div className={s.gameQuestionText}>{activeScreen.beat.quickCheck.prompt}</div>
                    </div>
                  </div>

                  <div className={s.gameChoiceGrid}>
                    {activeScreen.beat.quickCheck.options.map((opt, idx) => {
                      const isOpen = solvedGateSet.has(activeScreen.beat.id);
                      const isOk = isOpen && idx === activeScreen.beat.quickCheck!.answer;
                      const isBad = !isOpen && quickWrongIdx === idx;
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={isOpen}
                          onClick={() => handleQuickOption(activeScreen.beat, idx)}
                          className={`${s.gameChoiceCard} ${
                            isOk ? s.gameChoiceOk : isBad ? s.gameChoiceBad : ''
                          }`}
                        >
                          <span className={s.gameChoiceBadge}>{idx === 0 ? 'A' : 'B'}</span>
                          <span className={s.gameChoiceText}>{opt}</span>
                          {isOk && (
                            <span
                              className="ml-auto inline-flex shrink-0 items-center gap-1 font-extrabold text-emerald-700"
                              style={{ fontSize: 'var(--fs-sm)' }}
                            >
                              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Harika!
                            </span>
                          )}
                          {isBad && (
                            <span
                              className="ml-auto inline-flex shrink-0 items-center gap-1 font-extrabold text-rose-700"
                              style={{ fontSize: 'var(--fs-sm)' }}
                            >
                              <XCircle className="h-4 w-4" aria-hidden="true" /> Tekrar dene
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {!solvedGateSet.has(activeScreen.beat.id) && quickWrongIdx !== null && (
                    <div className={s.gameRetryPanel}>
                      <Lightbulb className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                      <span>{activeScreen.beat.quickCheck.retryFeedback}</span>
                    </div>
                  )}

                  {solvedGateSet.has(activeScreen.beat.id) && (
                    <div className={s.gameSuccessPanel}>
                      <div className="flex items-center justify-center gap-1.5 font-black text-emerald-900">
                        <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
                        Doğru bildin!
                        <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
                      </div>
                      <p className="m-0 font-semibold text-emerald-950">
                        {activeScreen.beat.quickCheck.okFeedback}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 3) YALNIZCA KAVRAM AVI OYUN EKRANI */}
              {activeScreen?.kind === 'game' && (
                <div className={s.gameCardCenter}>
                  <MiniGameHost
                    key={activeScreen.key}
                    config={activeScreen.game}
                    onProgress={() => {}}
                    onFeedback={handleFeedback}
                    onComplete={handleGameComplete}
                    onSpeak={handleGameSpeak}
                  />
                </div>
              )}

              {/* 4) YALNIZCA 1 HAVUZ SORUSU EKRANI */}
              {activeScreen?.kind === 'check' && (
                <PoolCheckStage
                  key={activeScreen.key}
                  question={activeScreen.question}
                  index={activeScreen.checkIndex}
                  total={activeScreen.checkTotal}
                  onFeedback={handleFeedback}
                  onSolved={() =>
                    setSolvedCheckIds((prev) => new Set(prev).add(activeScreen.question.id))
                  }
                />
              )}

              {/* 5) BÖLÜM TAMAMLANDI EKRANI */}
              {activeScreen?.kind === 'done' && (
                <div className={s.gameCompleteBox}>
                  <div className="w-20">
                    <RobotGuide mood="celebrate" upgraded={sectionIdx === lesson.sections.length - 1} />
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Award className="h-6 w-6" aria-hidden="true" />
                    <span className="text-xs font-extrabold uppercase tracking-wider">
                      Bölüm {sectionIdx + 1} Tamamlandı
                    </span>
                  </div>
                  <h2 className="m-0 text-2xl font-black text-slate-900">{activeSection.title}</h2>
                  <p className="m-0 max-w-md text-sm font-semibold leading-relaxed text-slate-600">
                    {sectionIdx === lesson.sections.length - 1
                      ? lesson.guide?.finish ?? GUIDE.finish
                      : 'Harika iş çıkardın! Sıradaki bölüme geçebilir veya Keşif Haritasına dönebilirsin.'}
                  </p>
                  {lastGameResult && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1 text-xs font-extrabold text-amber-900">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      Kavram Avı: {lastGameResult.score}/{lastGameResult.total} kavram bulundu
                    </span>
                  )}
                  {progress.completionCount > 0 && doneCount === lesson.sections.length && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3.5 py-1 text-xs font-extrabold text-emerald-800">
                      <Trophy className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                      {progress.completionCount === 1
                        ? 'Tebrikler! Bu dersi ilk kez tamamladın.'
                        : `Harika! Bu dersi ${progress.completionCount} kez tamamladın.`}
                    </span>
                  )}
                  <div className="mt-2 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={returnToMap}
                      className={s.arcadeBtnBlue}
                    >
                      <Home className="h-4 w-4" aria-hidden="true" />
                      Keşif Haritası
                    </button>
                    {sectionIdx + 1 < lesson.sections.length && (
                      <button
                        type="button"
                        onClick={() => openSection(sectionIdx + 1)}
                        className={s.arcadeBtnGreen}
                      >
                        Sıradaki Bölüm: {lesson.sections[sectionIdx + 1].tabLabel}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ALT OYUN NAVİGASYON & SABİT SES KONTROL ÇUBUĞU */}
          <footer className={s.gameBottomBar}>
            <button type="button" onClick={handleBack} className={s.arcadeBtnBlue}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>{screenIdx === 0 ? 'Harita' : 'Geri'}</span>
            </button>

            <div className={s.bottomCenterGroup}>
              {showBottomVoiceDock ? (
                <VoiceControls
                  status={voiceStatus}
                  onPause={pauseSpeech}
                  onResume={resumeSpeech}
                  onReplay={() => {
                    if (replayTargetText) speakLine(replayTargetText, true);
                  }}
                  replayLabel="Sesli Dinle"
                />
              ) : (
                <span className={s.bottomStepIndicator}>
                  Adım {currentStepDisplay} / {playableCount}
                </span>
              )}
            </div>

            {activeScreen?.kind === 'game' ? (
              <span aria-hidden="true" className="w-[84px] shrink-0 sm:w-[104px]" />
            ) : (
              <button
                type="button"
                disabled={isNextDisabled}
                onClick={handleNext}
                className={s.arcadeBtnGreen}
              >
                <span>
                  {activeScreen?.kind === 'done'
                    ? sectionIdx + 1 < lesson.sections.length
                      ? 'Sonraki'
                      : 'Harita'
                    : 'İleri'}
                </span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </footer>
        </div>
      )}

      {/* ==================== GÖRSEL BÜYÜTME (LIGHTBOX) MODALI ==================== */}
      {zoomedVisual && mode === 'play' && activeScreen?.kind === 'teach' && (
        <div
          className={s.visualLightboxBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label={`${activeScreen.beat.title} — Büyütülmüş Görsel`}
          onClick={() => setZoomedVisual(false)}
        >
          <div className={s.visualLightboxCard} onClick={(e) => e.stopPropagation()}>
            <div className={s.visualLightboxHeader}>
              <h3 className={s.visualLightboxTitle}>{activeScreen.beat.title}</h3>
              <button
                type="button"
                onClick={() => setZoomedVisual(false)}
                className={s.visualLightboxClose}
                aria-label="Büyütülmüş görseli kapat"
                title="Kapat (Esc)"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div
              className={s.visualLightboxBody}
              onClick={() => setZoomedVisual(false)}
              title="Kapatmak için tıkla"
            >
              {lesson.sceneId === 'digestive-system' && activeScreen.beat.focus ? (
                <DigestiveScene focus={activeScreen.beat.focus} />
              ) : (
                <GenericVisualScene
                  visual={activeScreen.beat.visual}
                  title={activeScreen.beat.title}
                  accent={activeSection.accent}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
