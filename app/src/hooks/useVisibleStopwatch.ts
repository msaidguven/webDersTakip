'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface VisibleStopwatch {
  reset(): void;
  elapsedMs(): number;
}

// Yalnız sekme GÖRÜNÜRKEN (ve running iken) işleyen kronometre (2026-10-23). Soru sayacı kalkınca
// Date.now() farkı anlamsızlaştı: sekmeyi açık bırakıp giden öğrenci "40 dakikada çözdü" görünüyordu.
// Değerler ref'te tutulur, render tetiklemez.
export function useVisibleStopwatch(running = true): VisibleStopwatch {
  const accumulatedRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const runningRef = useRef(running);

  const sync = useCallback(() => {
    const shouldRun = runningRef.current && typeof document !== 'undefined' && document.visibilityState === 'visible';
    if (shouldRun && startedAtRef.current == null) startedAtRef.current = Date.now();
    if (!shouldRun && startedAtRef.current != null) {
      accumulatedRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
  }, []);

  useEffect(() => {
    runningRef.current = running;
    sync();
  }, [running, sync]);

  useEffect(() => {
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [sync]);

  return useMemo(
    () => ({
      reset() {
        accumulatedRef.current = 0;
        startedAtRef.current = null;
        sync();
      },
      elapsedMs() {
        return accumulatedRef.current + (startedAtRef.current != null ? Date.now() - startedAtRef.current : 0);
      },
    }),
    [sync]
  );
}

// Testte kalınan toplam süreyi (test_sessions.active_seconds) kaydeder: biriken görünür süre sekme
// gizlenince, sayfadan çıkılınca ve oturum değişince/bileşen kapanınca gönderilir. Oturum ilk
// cevapta açıldığı için ondan önceki süre (ilk soruyu okuma) ilk gönderimde oturuma eklenir.
// Misafirde sessionId hiç oluşmaz, hiçbir şey gönderilmez. Öğrenciye gösterilmiyor.
export function useSessionActiveTime(supabase: SupabaseClient, sessionId: number | null, running = true) {
  const stopwatch = useVisibleStopwatch(running);
  const sentMsRef = useRef(0);

  useEffect(() => {
    if (sessionId == null) return;
    const flush = () => {
      const seconds = Math.floor((stopwatch.elapsedMs() - sentMsRef.current) / 1000);
      if (seconds <= 0) return;
      sentMsRef.current += seconds * 1000;
      void supabase.rpc('add_test_session_active_seconds', { p_session_id: sessionId, p_seconds: seconds }).then(({ error }) => {
        if (error) console.error('add_test_session_active_seconds error:', error.message);
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [sessionId, supabase, stopwatch]);
}
