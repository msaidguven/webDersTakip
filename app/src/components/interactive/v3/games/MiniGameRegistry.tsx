'use client';

// Modüler Oyun Kayıt Sistemi (MiniGameRegistry).
// Yeni bir pekiştirme oyunu (örn. Kablolu Eşleştirme, Hata Avcısı, Bilgi Kasası, Sıralama, Deney Sürgüsü)
// eklemek için aynı MiniGameProps sözleşmesini uygulayan bir bileşen yazıp MINI_GAME_REGISTRY'ye kaydetmek yeterlidir.
import type { ComponentType } from 'react';
import type { LessonSfx } from '@/app/src/lib/interactiveLesson/sound';
import type { V3KavramAviConfig, V3MiniGameConfig } from '@/app/src/lib/interactiveLesson/typesV3';
import type { RobotMood } from '../../RobotGuide';
import type { VoiceStatus } from '../VoiceControls';
import { KavramAviSession } from './KavramAviSession';

export type MiniGameProgress = {
  current: number;
  total: number;
  label?: string;
};

export type MiniGameFeedback = {
  mood: RobotMood;
  text: string;
  tone?: 'normal' | 'ok' | 'oops';
  sfx?: LessonSfx;
  linkStep?: number;
};

export type MiniGameResult = {
  score: number;
  total: number;
  mistakes: number;
};

export type MiniGameProps<TConfig extends V3MiniGameConfig = V3MiniGameConfig> = {
  config: TConfig;
  onProgress: (info: MiniGameProgress) => void;
  onFeedback: (fb: MiniGameFeedback) => void;
  onComplete: (result: MiniGameResult) => void;
  onSpeak?: (text: string, force?: boolean) => void;
  canSpeak?: (text: string) => boolean;
  voiceStatus?: VoiceStatus;
  onPauseVoice?: () => void;
  onResumeVoice?: () => void;
};

type GameComponentMap = {
  kavram_avi: ComponentType<MiniGameProps<V3KavramAviConfig>>;
};

export const MINI_GAME_REGISTRY: GameComponentMap = {
  kavram_avi: KavramAviSession,
};

export function MiniGameHost({
  config,
  onProgress,
  onFeedback,
  onComplete,
  onSpeak,
  canSpeak,
  voiceStatus,
  onPauseVoice,
  onResumeVoice,
}: MiniGameProps) {
  const GameComponent = MINI_GAME_REGISTRY[config.kind];
  if (!GameComponent) return null;
  return (
    <GameComponent
      config={config}
      onProgress={onProgress}
      onFeedback={onFeedback}
      onComplete={onComplete}
      onSpeak={onSpeak}
      canSpeak={canSpeak}
      voiceStatus={voiceStatus}
      onPauseVoice={onPauseVoice}
      onResumeVoice={onResumeVoice}
    />
  );
}
