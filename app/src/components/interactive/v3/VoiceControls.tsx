'use client';

// Atom Seslendirme Kontrol Çubuğu: Durdur / Devam Ettir ve Tekrar Dinle butonları.
import { Pause, Play, RotateCcw, Volume2 } from 'lucide-react';
import s from './v3.module.css';

export type VoiceStatus = 'idle' | 'playing' | 'paused';

export type VoiceControlsProps = {
  status: VoiceStatus;
  onPause: () => void;
  onResume: () => void;
  onReplay: () => void;
  replayLabel?: string;
  compact?: boolean;
};

export function VoiceControls({
  status,
  onPause,
  onResume,
  onReplay,
  replayLabel = 'Tekrar Dinle',
  compact = false,
}: VoiceControlsProps) {
  return (
    <div className={`${s.voiceControlGroup} ${compact ? s.voiceControlCompact : ''}`}>
      {status === 'playing' && (
        <button
          type="button"
          onClick={onPause}
          className={`${s.voiceBtn} ${s.voiceBtnPause}`}
          aria-label="Seslendirmeyi durdur"
          title="Durdur"
        >
          <Pause className="h-3.5 w-3.5 fill-current shrink-0" aria-hidden="true" />
          <span className={s.voiceBtnText}>Durdur</span>
        </button>
      )}

      {status === 'paused' && (
        <button
          type="button"
          onClick={onResume}
          className={`${s.voiceBtn} ${s.voiceBtnResume}`}
          aria-label="Seslendirmeye devam et"
          title="Devam Ettir"
        >
          <Play className="h-3.5 w-3.5 fill-current shrink-0" aria-hidden="true" />
          <span className={s.voiceBtnText}>Devam Ettir</span>
        </button>
      )}

      <button
        type="button"
        onClick={onReplay}
        className={`${s.voiceBtn} ${status === 'idle' ? s.voiceBtnIdle : s.voiceBtnReplay}`}
        aria-label={replayLabel}
        title={replayLabel}
      >
        {status === 'idle' ? (
          <Volume2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className={status === 'idle' ? s.voiceBtnText : s.voiceBtnSubText}>
          {status === 'idle' ? replayLabel : 'Tekrar Dinle'}
        </span>
      </button>
    </div>
  );
}
