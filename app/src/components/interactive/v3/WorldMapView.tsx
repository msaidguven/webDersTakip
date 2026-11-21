'use client';

// Ana Ekran: Özgün "Atom Keşif Dünyası" Haritası.
// Yalnızca konunun alt konularını (4 bölüm) özgün bir kavisli enerji rotası ve mücevher tonlu
// dokunsal istasyon kartlarıyla gösterir; herhangi birine tıklandığında o bölümün oyun ekranı açılır.
import { Check, Gamepad2, Play, Sparkles, Star } from 'lucide-react';
import type { HydratedLessonV3 } from '@/app/src/lib/interactiveLesson/typesV3';
import RobotGuide from '../RobotGuide';
import s from './v3.module.css';

const STATION_OFFSETS = [76, 18, 84, 14];
const ACCENT_CLASS = [s.portalSky, s.portalAmber, s.portalEmerald, s.portalRose];

export function WorldMapView({
  lesson,
  currentSectionIdx,
  completedSections,
  onSelectSection,
}: {
  lesson: HydratedLessonV3;
  currentSectionIdx: number;
  completedSections: number[];
  onSelectSection: (sectionIdx: number) => void;
}) {
  const doneSet = new Set(completedSections);
  const doneCount = lesson.sections.filter((sec) => doneSet.has(sec.sectionId)).length;

  return (
    <div className={s.worldRoot}>
      <div className={s.worldViewport}>
        {/* Özgün Atmosferik Arka Plan: Yörünge halkaları & yumuşak ufuk tepeleri */}
        <svg
          className={s.worldBackdropSvg}
          viewBox="0 0 1440 640"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="hillBack" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#BFD7F2" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#A9C7EB" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="hillFront" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#9EC1E8" stopOpacity="0.72" />
              <stop offset="100%" stopColor="#84B0E2" stopOpacity="0.92" />
            </linearGradient>
          </defs>
          {/* İnce bilimsel yörünge halkaları */}
          <circle cx="220" cy="140" r="180" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.55" />
          <circle cx="1220" cy="120" r="220" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="8 10" opacity="0.45" />
          <circle cx="720" cy="290" r="340" fill="none" stroke="#93C5FD" strokeWidth="1.2" opacity="0.35" />
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

        {/* Üst Keşif Başlık Şeridi */}
        <div className={s.worldTopBanner}>
          <span className={s.worldTopicBanner}>
            <Sparkles className="h-4 w-4 text-sky-600" aria-hidden="true" />
            <span>
              {lesson.courseLabel} • {lesson.topicTitle}
            </span>
          </span>
        </div>

        {/* 4 Alt Konu İstasyonu + Kavisli Bağlantı Yolu */}
        <div className={s.worldStageWrap}>
          {/* Masaüstünde 4 istasyonu bağlayan akıcı kavisli rota */}
          <svg
            className={s.worldCurvePath}
            viewBox="0 0 1000 220"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M 125 132 C 250 132, 260 66, 375 66 C 490 66, 510 142, 625 142 C 740 142, 760 62, 875 62"
              fill="none"
              stroke="rgba(255,255,255,0.85)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M 125 132 C 250 132, 260 66, 375 66 C 490 66, 510 142, 625 142 C 740 142, 760 62, 875 62"
              fill="none"
              stroke="#0284C7"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="10 10"
              className={s.svgFlow}
            />
          </svg>

          <div className={s.worldGrid}>
            {lesson.sections.map((sec, idx) => {
              const isDone = doneSet.has(sec.sectionId);
              const isCurrent = idx === currentSectionIdx;
              const offsetTop = STATION_OFFSETS[idx % STATION_OFFSETS.length];
              const accent = ACCENT_CLASS[idx % ACCENT_CLASS.length];

              return (
                <div
                  key={sec.sectionId}
                  className={s.worldSubtopicCol}
                  style={{ marginTop: offsetTop }}
                >
                  {isCurrent && (
                    <div className={s.worldAtomMarker} aria-hidden="true">
                      <RobotGuide mood={isDone ? 'celebrate' : 'happy'} className="w-12 xl:w-16" />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectSection(idx)}
                    className={`${s.worldTile} ${s.worldTileLarge} ${accent} ${
                      isCurrent ? s.worldTileActive : isDone ? s.worldTileDone : ''
                    }`}
                  >
                    <span className={s.worldTileCode}>0{idx + 1}</span>
                    <span className={s.worldTileIcon}>
                      {isDone ? (
                        <Check className="h-9 w-9 stroke-[3]" aria-hidden="true" />
                      ) : (
                        <Play className="h-9 w-9 fill-current" aria-hidden="true" />
                      )}
                    </span>
                  </button>

                  <div className={s.worldCardMeta}>
                    <span className={s.worldTileLabelLarge}>{sec.title}</span>
                    <span className={s.worldTileSub}>
                      {sec.beats.length} sahne •{' '}
                      <Gamepad2 className="inline h-3.5 w-3.5 text-amber-600" aria-hidden="true" /> Kavram Avı •{' '}
                      {sec.checkQuestions.length} soru
                    </span>
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
          {lesson.sections.map((sec, idx) => (
            <button
              key={sec.sectionId}
              type="button"
              onClick={() => onSelectSection(idx)}
              title={sec.title}
              className={`${s.bottomCapsule} ${
                doneSet.has(sec.sectionId)
                  ? s.bottomCapsuleDone
                  : idx === currentSectionIdx
                    ? s.bottomCapsuleActive
                    : ''
              }`}
            />
          ))}
        </div>
        <span className={s.bottomStarStat}>
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
          {doneCount} / {lesson.sections.length}
        </span>
      </footer>
    </div>
  );
}
