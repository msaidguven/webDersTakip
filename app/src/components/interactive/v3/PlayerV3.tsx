'use client';

// Etkileşimli Ders Oynatıcısı v3 — "Atom Keşif Dünyası" (Tek Ekran = Tek Bilgi veya Tek İşlem).
// Ana sayfa: 4 Alt Konulu Keşif Haritası.
// Bölüm içi her ekran SADECE 1 iş yapar:
//   - Anlatım ekranı: Yalnızca görsel + tek bilgi (soru yok)
//   - Hızlı Kontrol ekranı: Bir sonraki ekranda yalnızca 1 soru + anında kontrollü kartlar (cevap üstte görünmez)
//   - Oyun ekranı: Yalnızca Kavram Avı
//   - Bölüm Kontrolü: Her ekranda yalnızca 1 havuz sorusu (tıklar tıklamaz anında kontrol)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Home,
  Maximize2,
  Minimize2,
  Music,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import { trackContentEvent } from '@/app/src/lib/contentUsage';
import {
  GUIDE,
  ttsText,
  voiceAudioPath,
  voiceKey,
  voiceManifestPath,
  VOICE_BUCKET,
} from '@/app/src/lib/interactiveLesson/guide';
import { lessonSound } from '@/app/src/lib/interactiveLesson/sound';
import type {
  HydratedLessonV3,
  HydratedV3Question,
  HydratedV3Section,
  V3MiniGameConfig,
  V3TeachBeat,
} from '@/app/src/lib/interactiveLesson/typesV3';
import RobotGuide, { type RobotMood } from '../RobotGuide';
import { MiniGameHost, type MiniGameFeedback, type MiniGameResult } from './games/MiniGameRegistry';
import { PoolCheckStage } from './PoolCheckStage';
import { DigestiveScene } from './scenes/DigestiveScene';
import { GenericVisualScene } from './scenes/GenericVisualScene';
import { WorldMapView } from './WorldMapView';
import s from './v3.module.css';

type ScreenMode = 'map' | 'play';

type PlayScreen =
  | { kind: 'teach'; key: string; beat: V3TeachBeat }
  | { kind: 'quick'; key: string; beat: V3TeachBeat }
  | { kind: 'game'; key: string; game: V3MiniGameConfig }
  | { kind: 'check'; key: string; question: HydratedV3Question; checkIndex: number; checkTotal: number }
  | { kind: 'done'; key: string };

type SavedV3 = {
  completedSections: number[];
  solvedGates: string[];
};

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

function loadProgress(topicId: number): SavedV3 {
  try {
    const raw = localStorage.getItem(`il_v3_${topicId}`);
    if (!raw) return { completedSections: [], solvedGates: [] };
    const parsed = JSON.parse(raw) as Partial<SavedV3>;
    return {
      completedSections: Array.isArray(parsed.completedSections) ? parsed.completedSections : [],
      solvedGates: Array.isArray(parsed.solvedGates) ? parsed.solvedGates : [],
    };
  } catch {
    return { completedSections: [], solvedGates: [] };
  }
}

function saveProgress(topicId: number, data: SavedV3) {
  try {
    localStorage.setItem(`il_v3_${topicId}`, JSON.stringify(data));
  } catch {}
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
  const [progress, setProgress] = useState<SavedV3>(() => loadProgress(lesson.topicId));
  const [mode, setMode] = useState<ScreenMode>('map');
  const [sectionIdx, setSectionIdx] = useState(0);
  const [screenIdx, setScreenIdx] = useState(0);

  const [quickWrongIdx, setQuickWrongIdx] = useState<number | null>(null);
  const [solvedCheckIds, setSolvedCheckIds] = useState<Set<number>>(() => new Set());
  const [lastGameResult, setLastGameResult] = useState<MiniGameResult | null>(null);

  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [voiced, setVoiced] = useState<Set<string>>(() => new Set());
  const [talking, setTalking] = useState(false);
  const [atomMood, setAtomMood] = useState<RobotMood>('normal');

  const soundOnRef = useRef(soundOn);
  const voicedRef = useRef(voiced);
  useEffect(() => {
    soundOnRef.current = soundOn;
    voicedRef.current = voiced;
  });

  const activeSection = lesson.sections[sectionIdx];
  const screens = useMemo(
    () => (activeSection ? buildSectionScreens(activeSection) : []),
    [activeSection],
  );
  const activeScreen = screens[screenIdx];
  const playableCount = Math.max(1, screens.length - 1); // done hariç
  const solvedGateSet = useMemo(() => new Set(progress.solvedGates), [progress.solvedGates]);

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
    const onVis = () => (document.hidden ? sound.suspend() : sound.resume());
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        if (mode === 'play') setMode('map');
        else onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode, onClose]);

  const speakLine = useCallback((text: string) => {
    if (!soundOnRef.current) return;
    const key = voiceKey(text);
    if (!voicedRef.current.has(key)) return;
    setTalking(true);
    void lessonSound().speak([{ url: voiceUrl(text), text: ttsText(text) }], () => setTalking(false));
  }, []);

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

  const markSectionCompleted = useCallback(
    (idx: number) => {
      const sec = lesson.sections[idx];
      if (!sec) return;
      setProgress((old) => {
        const completed = old.completedSections.includes(sec.sectionId)
          ? old.completedSections
          : [...old.completedSections, sec.sectionId];
        const next: SavedV3 = { ...old, completedSections: completed };
        saveProgress(lesson.topicId, next);
        if (completed.length === lesson.sections.length) {
          trackContentEvent('interactive_finish', lesson.topicId);
        }
        return next;
      });
    },
    [lesson.sections, lesson.topicId],
  );

  const openSection = useCallback(
    (idx: number) => {
      const target = lesson.sections[idx];
      if (!target) return;
      lessonSound().unlock();
      if (soundOnRef.current) lessonSound().sfx('unlock');
      setSectionIdx(idx);
      setMode('play');
      setScreenIdx(0);
      setQuickWrongIdx(null);
      setLastGameResult(null);
      setAtomMood('normal');
      if (target.beats[0]?.fact) speakLine(target.beats[0].fact);
    },
    [lesson.sections, speakLine],
  );

  const goToScreen = useCallback(
    (targetIdx: number) => {
      const clamped = Math.max(0, Math.min(targetIdx, screens.length - 1));
      const scr = screens[clamped];
      if (!scr) return;
      lessonSound().unlock();
      setScreenIdx(clamped);
      setQuickWrongIdx(null);

      if (scr.kind === 'teach') {
        setAtomMood('normal');
        if (soundOnRef.current) lessonSound().sfx('tap');
        speakLine(scr.beat.fact);
      } else if (scr.kind === 'quick') {
        setAtomMood('think');
        if (soundOnRef.current) lessonSound().sfx('tap');
        if (scr.beat.quickCheck) speakLine(scr.beat.quickCheck.prompt);
      } else if (scr.kind === 'game') {
        setAtomMood('wow');
        if (soundOnRef.current) lessonSound().sfx('unlock');
      } else if (scr.kind === 'check') {
        setAtomMood('think');
        if (soundOnRef.current) lessonSound().sfx('tap');
      } else if (scr.kind === 'done') {
        markSectionCompleted(sectionIdx);
        setAtomMood('celebrate');
        if (soundOnRef.current) lessonSound().sfx('win');
      }
    },
    [markSectionCompleted, screens, sectionIdx, speakLine],
  );

  const handleQuickOption = (beat: V3TeachBeat, optIdx: number) => {
    if (!beat.quickCheck || solvedGateSet.has(beat.id)) return;
    lessonSound().unlock();
    if (optIdx === beat.quickCheck.answer) {
      setQuickWrongIdx(null);
      setProgress((old) => {
        const gates = old.solvedGates.includes(beat.id) ? old.solvedGates : [...old.solvedGates, beat.id];
        const next: SavedV3 = { ...old, solvedGates: gates };
        saveProgress(lesson.topicId, next);
        return next;
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
      else setMode('map');
      return;
    }
    goToScreen(screenIdx + 1);
  };

  const handleBack = () => {
    if (screenIdx > 0) goToScreen(screenIdx - 1);
    else setMode('map');
  };

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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void rootRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      void document.exitFullscreen?.().catch(() => {});
    }
  };

  const isNextDisabled =
    (activeScreen?.kind === 'quick' && !solvedGateSet.has(activeScreen.beat.id)) ||
    (activeScreen?.kind === 'check' && !solvedCheckIds.has(activeScreen.question.id));

  const doneCount = progress.completedSections.length;

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
        <button
          type="button"
          onClick={() => {
            if (soundOnRef.current) lessonSound().sfx('tap');
            setMode('map');
          }}
          className={s.gameBrandBtn}
          title="Keşif Haritasına Dön"
        >
          <span className="w-8 shrink-0">
            <RobotGuide mood={atomMood} talking={talking} />
          </span>
          <span className={s.gameBrandTitle}>{lesson.topicTitle}</span>
        </button>

        <div className={s.gameTopRight}>
          {mode === 'play' && (
            <span className={s.gameLevelPill}>
              Bölüm {sectionIdx + 1} / {lesson.sections.length}
            </span>
          )}

          <span className={s.gameStarPill} title="Tamamlanan bölümler">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
            <span>
              {doneCount}/{lesson.sections.length}
            </span>
          </span>

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

          <button
            type="button"
            onClick={() => {
              if (soundOnRef.current) lessonSound().sfx('tap');
              setMode(mode === 'map' ? 'play' : 'map');
            }}
            className={`${s.gameIconBtn} ${s.gameIconBlue}`}
            aria-label={mode === 'map' ? 'Derse dön' : 'Keşif Haritası'}
            title={mode === 'map' ? 'Derse dön' : 'Keşif Haritası'}
          >
            <Home className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className={`${s.gameIconBtn} ${s.gameIconGreen}`}
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

      {/* ==================== ANA KEŞİF HARİTASI veya TEK-İŞLEMLİ OYUN SAHNESİ ==================== */}
      {mode === 'map' ? (
        <WorldMapView
          lesson={lesson}
          currentSectionIdx={sectionIdx}
          completedSections={progress.completedSections}
          onSelectSection={openSection}
        />
      ) : (
        <div className={s.gamePlayRoot}>
          <div className={s.gamePlayStage}>
            <div className={s.worldClouds} aria-hidden="true">
              <div className={s.worldCloud} style={{ left: '8%', top: 36 }} />
              <div className={s.worldCloud} style={{ left: '34%', top: 20 }} />
              <div className={s.worldCloud} style={{ left: '72%', top: 54 }} />
            </div>

            <div className={s.gamePlayInner}>
              {/* 1) YALNIZCA ANLATIM EKRANI (TEK BİLGİ — SORU YOK) */}
              {activeScreen?.kind === 'teach' && (
                <div className={s.gameBeatStack}>
                  <div className="text-center">
                    <span className={s.gameKickerPill}>
                      {activeSection.tabLabel} • {activeScreen.beat.kicker}
                    </span>
                    <h2 className={s.gameBeatHeading}>{activeScreen.beat.title}</h2>
                  </div>

                  <div className={s.gameVisualFrame}>
                    {lesson.sceneId === 'digestive-system' && activeScreen.beat.focus ? (
                      <DigestiveScene focus={activeScreen.beat.focus} />
                    ) : (
                      <GenericVisualScene visual={activeScreen.beat.visual} title={activeScreen.beat.title} />
                    )}
                  </div>

                  <div className={s.gameDialogueBox}>
                    <div className="w-12 shrink-0 xl:w-16">
                      <RobotGuide mood={atomMood} talking={talking} />
                    </div>
                    <div className={s.gameDialogueInner}>
                      <p className="m-0">{activeScreen.beat.fact}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 2) AYRI HIZLI SORU EKRANI (YALNIZCA 1 SORU — ANLATIM YOK) */}
              {activeScreen?.kind === 'quick' && activeScreen.beat.quickCheck && (
                <div className={s.gameQuestionWrap}>
                  <div className={s.gameQuestionHeader}>
                    <div className="w-12 shrink-0 xl:w-16">
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
                    <div className="min-w-0 flex-1">
                      <span
                        className="mb-1 block font-extrabold uppercase tracking-wider text-sky-700"
                        style={{ fontSize: 'var(--fs-sm)' }}
                      >
                        Hızlı Kontrol • {activeScreen.beat.title}
                      </span>
                      <div className={s.gameQuestionText}>{activeScreen.beat.quickCheck.prompt}</div>
                    </div>
                  </div>

                  <div className={s.gameChoiceGrid}>
                    {activeScreen.beat.quickCheck.options.map((opt, idx) => {
                      const isOpen = solvedGateSet.has(activeScreen.beat.id);
                      const isOk = isOpen && idx === activeScreen.beat.quickCheck!.answer;
                      const isBad = quickWrongIdx === idx;
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
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className={s.gameChoiceBadge}>{idx === 0 ? 'A' : 'B'}</span>
                            {isOk && (
                              <span
                                className="inline-flex items-center gap-1 font-extrabold text-emerald-700"
                                style={{ fontSize: 'var(--fs-sm)' }}
                              >
                                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Harika!
                              </span>
                            )}
                            {isBad && (
                              <span
                                className="inline-flex items-center gap-1 font-extrabold text-rose-700"
                                style={{ fontSize: 'var(--fs-sm)' }}
                              >
                                <XCircle className="h-4 w-4" aria-hidden="true" /> Tekrar dene
                              </span>
                            )}
                          </div>
                          <div>{opt}</div>
                        </button>
                      );
                    })}
                  </div>

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
                  <div className="mt-2 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setMode('map')}
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

          {/* ALT OYUN NAVİGASYON ÇUBUĞU */}
          <footer className={s.gameBottomBar}>
            <button type="button" onClick={handleBack} className={s.arcadeBtnBlue}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>{screenIdx === 0 ? 'Harita' : 'Geri'}</span>
            </button>

            <div className={s.bottomSquares} aria-label="Bölüm ilerlemesi">
              {screens.slice(0, playableCount).map((scr, idx) => {
                const isActive = idx === screenIdx;
                const isPast = idx < screenIdx || activeScreen?.kind === 'done';
                return (
                  <button
                    key={scr.key}
                    type="button"
                    onClick={() => goToScreen(idx)}
                    title={`Adım ${idx + 1} / ${playableCount}`}
                    className={`${s.bottomSquare} ${
                      isActive ? s.bottomSquareActive : isPast ? s.bottomSquareDone : ''
                    }`}
                  />
                );
              })}
            </div>

            <button
              type="button"
              disabled={isNextDisabled}
              onClick={handleNext}
              className={s.arcadeBtnGreen}
            >
              <span>
                {activeScreen?.kind === 'done'
                  ? sectionIdx + 1 < lesson.sections.length
                    ? 'Sonraki Bölüm'
                    : 'Haritaya Dön'
                  : activeScreen?.kind === 'game'
                    ? 'Sorulara Geç'
                    : 'İleri'}
              </span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}
