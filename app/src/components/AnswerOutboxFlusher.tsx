'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { beaconAnswerOutbox, flushAnswerOutbox } from '../lib/answerSync';

// Giden kutusunda (bkz. app/src/lib/answerSync.ts) bekleyen test cevaplarını gönderir:
// giriş yapılınca/sayfa açılınca, internet geri gelince ve sekme kapanırken (keepalive).
export function AnswerOutboxFlusher() {
  const { user, supabase } = useAuth();
  const userId = user?.id;
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) tokenRef.current = data.session?.access_token ?? null;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      tokenRef.current = session?.access_token ?? null;
    });

    void flushAnswerOutbox(supabase, userId);
    const onOnline = () => void flushAnswerOutbox(supabase, userId);
    const onHide = () => {
      if (document.visibilityState === 'hidden' && tokenRef.current) beaconAnswerOutbox(userId, tokenRef.current);
    };
    const onPageHide = () => {
      if (tokenRef.current) beaconAnswerOutbox(userId, tokenRef.current);
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [userId, supabase]);

  return null;
}
