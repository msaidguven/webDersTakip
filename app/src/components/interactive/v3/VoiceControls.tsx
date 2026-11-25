'use client';

// Alt Navigasyon Barı İçi Sabit Medya Ses Kontrolü:
// Kartların içine girip sayfa düzenini bozmaz; her ekranda aynı sabit noktada durur.
import { Pause, Play, RotateCcw, Volume2 } from 'lucide-react';
import s from './v3.module.css';

export type VoiceStatus = 'idle' | 'playing' | 'paused';

export type VoiceControlsProps = {
  status: VoiceStatus;
  onPause: () => void;
  onResume: () => void;
  onReplay: () => void;
  replayLabel?: string;
};

export function VoiceControls({
  status,
  onPause,
  onResume,
  onReplay,
  replayLabel = 'Tekrar Dinle',
}: VoiceControlsProps) {
  return (
    <div className={s.hudVoiceDock} role="group" aria-label="Seslendirme kontrolü">
      {status === 'playing' && (
        <button
          type="button"
          onClick={onPause}
          className={`${s.hudVoiceMainBtn} ${s.hudVoicePause}`}
          aria-label="Seslendirmeyi duraklat"
          title="Duraklat"
        >
          <Pause className="h-3.5 w-3.5 fill-current shrink-0" aria-hidden="true" />
          <span className={s.hudVoiceLabel}>Durdur</span>
        </button>
      )}

      {status === 'paused' && (
        <button
          type="button"
          onClick={onResume}
          className={`${s.hudVoiceMainBtn} ${s.hudVoiceResume}`}
          aria-label="Seslendirmeye devam et"
          title="Devam Et"
        >
          <Play className="h-3.5 w-3.5 fill-current shrink-0" aria-hidden="true" />
          <span className={s.hudVoiceLabel}>Başlat</span>
        </button>
      )}

      {status === 'idle' ? (
        <button
          type="button"
          onClick={onReplay}
          className={`${s.hudVoiceMainBtn} ${s.hudVoiceIdle}`}
          aria-label={replayLabel}
          title={replayLabel}
        >
          <Volume2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className={s.hudVoiceLabel}>Dinle</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onReplay}
          className={s.hudVoiceReplayBtn}
          aria-label="Baştan dinle"
          title="Tekrar Dinle"
        >
          <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
