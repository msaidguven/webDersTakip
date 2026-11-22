'use client';

// Ana Ekran: Özgün "Atom Keşif Dünyası" Haritası.
// Konunun tüm alt konularını (sayıdan bağımsız: 2, 3, 4, 5, 6+ bölüm) dinamik kavisli enerji rotası,
// net çalışma durumu rozetleri (Tamamlandı / Kaldığın Yer / Sıradaki / Başlanmadı),
// toplam tamamlama sayacı ve onaylı yeniden çalışma (sıfırlama) ile gösterir.
import { useState, type CSSProperties } from 'react';
import {
  Check,
  CheckCircle2,
  Gamepad2,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react';
import type { HydratedLessonV3, HydratedV3Section } from '@/app/src/lib/interactiveLesson/typesV3';
import RobotGuide from '../RobotGuide';
import s from './v3.module.css';

const ACCENT_CLASS = [s.portalSky, s.portalAmber, s.portalEmerald, s.portalRose, s.portalViolet];

function getStationOffset(idxInRow: number, rowLen: number): number {
  if (rowLen <= 1) return 18;
  if (rowLen >= 5) {
    return idxInRow % 2 === 0 ? 52 : 10;
  }
  return idxInRow % 2 === 0 ? 64 : 14;
}

type CurveSegment = { d: string; fromDone: boolean };

function buildCurveSegments(
  row: IndexedSection[],
  offsets: number[],
  doneSet: Set<number>,
): CurveSegment[] {
  const rowLen = row.length;
  if (rowLen <= 1) return [];
  const pts = offsets.map((off, i) => ({
    x: ((i + 0.5) / rowLen) * 1000,
    y: off + 48,
  }));
  const segments: CurveSegment[] = [];
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const midX = ((prev.x + curr.x) / 2).toFixed(1);
    const d = `M ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} C ${midX} ${prev.y.toFixed(1)}, ${midX} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    segments.push({ d, fromDone: doneSet.has(row[i - 1].sec.sectionId) });
  }
  return segments;
}

type IndexedSection = { sec: HydratedV3Section; globalIdx: number };

function splitIntoRows(sections: HydratedV3Section[]): IndexedSection[][] {
  const indexed: IndexedSection[] = sections.map((sec, globalIdx) => ({ sec, globalIdx }));
  const total = indexed.length;
  if (total <= 5) return [indexed];
  const perRow = total <= 6 ? 3 : 4;
  const rows: IndexedSection[][] = [];
  for (let i = 0; i < total; i += perRow) {
    rows.push(indexed.slice(i, i + perRow));
  }
  return rows;
}

export function WorldMapView({
  lesson,
  currentSectionIdx,
  completedSections,
  sectionProgress,
  sectionTotals,
  completionCount,
  hasActiveProgress,
  onSelectSection,
  onResetProgress,
}: {
  lesson: HydratedLessonV3;
  currentSectionIdx: number;
  completedSections: number[];
  sectionProgress: Record<string, number>;
  sectionTotals: Record<string, number>;
  completionCount: number;
  hasActiveProgress: boolean;
  onSelectSection: (sectionIdx: number) => void;
  onResetProgress: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);

  const doneSet = new Set(completedSections);
  const doneCount = lesson.sections.filter((sec) => doneSet.has(sec.sectionId)).length;
  const rows = splitIntoRows(lesson.sections);
  const isDense = rows.some((r) => r.length >= 5);
  const isMultiRow = rows.length > 1;

  // İlk tamamlanmamış bölüm (sıradaki önerilen durak)
  const firstPendingIdx = lesson.sections.findIndex((sec) => !doneSet.has(sec.sectionId));

  return (
    <div className={s.worldRoot} data-dense={isDense ? 'true' : 'false'}>
      {/* Özgün Atmosferik Arka Plan: Sabit gökyüzü, bulutlar, yörünge halkaları & ufuk tepeleri */}
      <svg
        className={s.worldBackdropSvg}
        viewBox="0 0 1440 640"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="hillBack" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#BFD7F2" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#A9C7EB" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="hillFront" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#9EC1E8" stopOpacity="0.78" />
            <stop offset="100%" stopColor="#84B0E2" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        {/* İnce bilimsel yörünge halkaları */}
        <circle cx="220" cy="140" r="180" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.55" />
        <circle cx="1220" cy="120" r="220" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="8 10" opacity="0.45" />
        <circle cx="720" cy="290" r="340" fill="none" stroke="#93C5FD" strokeWidth="1.4" opacity="0.42" />
        {/* Yumuşak oyun gökyüzü bulutları */}
        <g fill="#FFFFFF" opacity="0.55">
          <ellipse cx="560" cy="96" rx="64" ry="22" />
          <ellipse cx="600" cy="86" rx="38" ry="18" />
          <ellipse cx="880" cy="138" rx="72" ry="24" />
          <ellipse cx="842" cy="128" rx="40" ry="18" />
        </g>
        {/* Katmanlı yumuşak ufuk siluetleri */}
        <path
          d="M0 510 Q240 430 490 490 T990 475 T1440 445 L1440 640 L0 640 Z"
          fill="url(#hillBack)"
        />
        <path
          d="M0 560 Q320 495 660 545 T1220 520 T1440 535 L1440 640 L0 640 Z"
          fill="url(#hillFront)"
        />
      </svg>

      <div className={s.worldViewport}>
        {/* Üst Keşif Başlık Şeridi + Tamamlama Sayacı */}
        <div className={s.worldTopBanner}>
          <span className={s.worldTopicBanner}>
            <Sparkles className="h-4 w-4 shrink-0 text-sky-600" aria-hidden="true" />
            <span>
              {lesson.courseLabel} • {lesson.topicTitle}
            </span>
          </span>

          {completionCount > 0 && (
            <span
              className={s.worldCompletionPill}
              title={`Bu etkileşimli dersi toplam ${completionCount} kez tamamladın`}
            >
              <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
              <span>{completionCount} kez tamamladın</span>
            </span>
          )}
        </div>

        {/* Alt Konu İstasyonları + Dinamik Kavisli Bağlantı Yolları */}
        <div className={`${s.worldStageWrap} ${isMultiRow ? s.worldStageMultiRow : ''}`}>
          <div className={s.worldRowsStack}>
            {rows.map((row, rowIdx) => {
              const offsets = row.map((_, i) => getStationOffset(i, row.length));
              const segments = buildCurveSegments(row, offsets, doneSet);

              return (
                <div
                  key={rowIdx}
                  className={s.worldRow}
                  style={{ '--row-cols': row.length } as CSSProperties}
                >
                  {segments.length > 0 && (
                    <svg
                      className={s.worldCurvePath}
                      viewBox="0 0 1000 220"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      {segments.map((seg, segIdx) => (
                        <g key={segIdx}>
                          <path
                            d={seg.d}
                            fill="none"
                            stroke="rgba(255,255,255,0.86)"
                            strokeWidth="12"
                            strokeLinecap="round"
                          />
                          <path
                            d={seg.d}
                            fill="none"
                            stroke={seg.fromDone ? '#10B981' : '#0284C7'}
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray="10 10"
                            className={s.svgFlow}
                          />
                        </g>
                      ))}
                    </svg>
                  )}

                  <div className={s.worldGrid}>
                    {row.map(({ sec, globalIdx }, idxInRow) => {
                      const isDone = doneSet.has(sec.sectionId);
                      const savedStep = sectionProgress[String(sec.sectionId)] ?? 0;
                      const totalSteps = Math.max(1, sectionTotals[String(sec.sectionId)] ?? 1);
                      const isInProgress = !isDone && savedStep > 0;
                      const isCurrent = globalIdx === currentSectionIdx;
                      const isNext = !isDone && !isInProgress && globalIdx === firstPendingIdx;
                      const isUntouched = !isDone && !isInProgress && !isNext && !isCurrent;

                      const offsetTop = offsets[idxInRow];
                      const accent = ACCENT_CLASS[globalIdx % ACCENT_CLASS.length];
                      const isOdd = globalIdx % 2 === 1;
                      const hasNext = globalIdx < lesson.sections.length - 1;
                      const codeLabel = String(globalIdx + 1).padStart(2, '0');
                      const progressPct = Math.min(95, Math.max(12, Math.round(((savedStep + 1) / totalSteps) * 100)));

                      return (
                        <div key={sec.sectionId} className={s.worldNodeEntry}>
                          <div
                            className={`${s.worldSubtopicCol} ${isOdd ? s.worldSubtopicOdd : s.worldSubtopicEven}`}
                            style={{ '--station-offset': `${offsetTop}px` } as CSSProperties}
                          >
                            <div className={s.worldPortalAnchor}>
                              {isCurrent && (
                                <div className={s.worldAtomMarker} aria-hidden="true">
                                  <RobotGuide mood={isDone ? 'celebrate' : 'happy'} className="w-11 sm:w-12 xl:w-14" />
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => onSelectSection(globalIdx)}
                                className={`${s.worldTile} ${s.worldTileLarge} ${accent} ${
                                  isDone
                                    ? s.worldTileDone
                                    : isInProgress || isCurrent
                                      ? s.worldTileActive
                                      : isUntouched
                                        ? s.worldTileUntouched
                                        : ''
                                }`}
                              >
                                <span className={s.worldTileCode}>{codeLabel}</span>
                                <span className={s.worldTileIcon}>
                                  {isDone ? (
                                    <Check className="h-7 w-7 stroke-[3] sm:h-8 sm:w-8" aria-hidden="true" />
                                  ) : (
                                    <Play className="h-7 w-7 fill-current sm:h-8 sm:w-8" aria-hidden="true" />
                                  )}
                                </span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => onSelectSection(globalIdx)}
                              className={s.worldCardMeta}
                            >
                              {/* Net Çalışma Durumu Rozeti */}
                              {isDone ? (
                                <span className={`${s.stationStatusPill} ${s.stationStatusDone}`}>
                                  <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                                  Tamamlandı
                                </span>
                              ) : isInProgress ? (
                                <span className={`${s.stationStatusPill} ${s.stationStatusActive}`}>
                                  Kaldığın Yer • {Math.min(savedStep + 1, totalSteps)}/{totalSteps}
                                </span>
                              ) : isNext || isCurrent ? (
                                <span className={`${s.stationStatusPill} ${s.stationStatusNext}`}>
                                  Sıradaki
                                </span>
                              ) : (
                                <span className={`${s.stationStatusPill} ${s.stationStatusTodo}`}>
                                  Başlanmadı
                                </span>
                              )}

                              <span
                                className={`${s.worldTileLabelLarge} ${
                                  isDone
                                    ? s.worldTileLabelDone
                                    : isInProgress
                                      ? s.worldTileLabelActive
                                      : isUntouched
                                        ? s.worldTileLabelTodo
                                        : ''
                                }`}
                              >
                                <span>{sec.title}</span>
                                {isInProgress && (
                                  <span className={s.stationProgressTrack} aria-hidden="true">
                                    <span
                                      className={s.stationProgressFill}
                                      style={{ width: `${progressPct}%` }}
                                    />
                                  </span>
                                )}
                              </span>

                              <span className={s.worldTileSub}>
                                {sec.beats.length} sahne •{' '}
                                <Gamepad2 className="inline h-3.5 w-3.5 text-amber-600" aria-hidden="true" /> Kavram Avı •{' '}
                                {sec.checkQuestions.length} soru
                              </span>
                            </button>
                          </div>

                          {/* Dikey mobilde istasyonları birbirine bağlayan kıvrımlı oyun rotası */}
                          {hasNext && (
                            <svg
                              className={`${s.worldMobilePath} ${isDone ? s.worldMobilePathDone : ''}`}
                              viewBox="0 0 320 56"
                              preserveAspectRatio="none"
                              aria-hidden="true"
                            >
                              <path
                                d={
                                  isOdd
                                    ? 'M 264 2 C 264 32, 56 24, 56 54'
                                    : 'M 56 2 C 56 32, 264 24, 264 54'
                                }
                                fill="none"
                                stroke="rgba(255,255,255,0.88)"
                                strokeWidth="12"
                                strokeLinecap="round"
                              />
                              <path
                                d={
                                  isOdd
                                    ? 'M 264 2 C 264 32, 56 24, 56 54'
                                    : 'M 56 2 C 56 32, 264 24, 264 54'
                                }
                                fill="none"
                                stroke={isDone ? '#10B981' : '#0284C7'}
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeDasharray="9 9"
                                className={s.svgFlow}
                              />
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Alt Şık Keşif Barı */}
      <footer className={s.gameBottomBar}>
        <span className={s.bottomTitle}>Keşif Haritası</span>
        <div className={s.bottomSquares} aria-label={`${doneCount} / ${lesson.sections.length} bölüm tamamlandı`}>
          {lesson.sections.map((sec, idx) => {
            const isDone = doneSet.has(sec.sectionId);
            const isInProg = !isDone && (sectionProgress[String(sec.sectionId)] ?? 0) > 0;
            return (
              <button
                key={sec.sectionId}
                type="button"
                onClick={() => onSelectSection(idx)}
                title={sec.title}
                className={`${s.bottomCapsule} ${
                  isDone
                    ? s.bottomCapsuleDone
                    : isInProg || idx === currentSectionIdx
                      ? s.bottomCapsuleActive
                      : ''
                }`}
              />
            );
          })}
        </div>

        <div className={s.bottomRightGroup}>
          {hasActiveProgress && (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className={s.bottomResetBtn}
              title="İlerlemeyi sıfırla ve baştan çalış"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className={s.bottomResetLabel}>Sıfırla</span>
            </button>
          )}

          <span className={s.bottomStarStat}>
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
            {doneCount} / {lesson.sections.length}
          </span>
        </div>
      </footer>

      {/* Onaylı Sıfırlama / Yeniden Çalışma Penceresi */}
      {confirmReset && (
        <div
          className={s.confirmBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="İlerlemeyi sıfırla"
          onClick={() => setConfirmReset(false)}
        >
          <div className={s.confirmCard} onClick={(e) => e.stopPropagation()}>
            <div className={s.confirmIconWrap}>
              <RotateCcw className="h-6 w-6 text-amber-600" aria-hidden="true" />
            </div>
            <h3 className={s.confirmTitle}>İlerlemeyi Sıfırla ve Yeniden Çalış</h3>
            <p className={s.confirmDesc}>
              Bu dersteki mevcut bölüm işaretlerin ve kaldığın adım temizlenecek, tüm bölümleri baştan
              çalışabileceksin.
            </p>
            {completionCount > 0 && (
              <div className={s.confirmKeepNote}>
                <Trophy className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>
                  Bu dersi <strong>{completionCount} kez tamamladığın</strong> kaydı korunacak; tekrar
                  bitirdiğinde <strong>{completionCount + 1}. tamamlama</strong> olarak eklenecek.
                </span>
              </div>
            )}
            <div className={s.confirmActions}>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className={s.confirmCancelBtn}
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmReset(false);
                  onResetProgress();
                }}
                className={s.confirmDangerBtn}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Sıfırla ve Baştan Başla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
