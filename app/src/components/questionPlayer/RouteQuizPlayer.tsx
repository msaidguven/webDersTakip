'use client';

// Intercepting route'larla (app/ilerlemem/@modal, app/soru-bankasi/@modal) açılan testler için tam
// ekran oynatıcı (2026-09-27; eskiden QuizModal içinde "sayfa" görünümündeydi). Kapatınca bir
// önceki sayfaya (router.back) dönülür ve panel verisini tazelemesi için sinyal yayınlanır —
// panel bu slot'un altında mount'lu kaldığı için yeniden yüklenmiyor (bkz. panelRefreshBridge).
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import QuizWithAsk, { type QuizWithAskProps } from '@/app/src/components/QuizWithAsk';
import { emitQuizModalClosed } from '@/app/src/lib/panelRefreshBridge';

export default function RouteQuizPlayer(props: Omit<QuizWithAskProps, 'onExit' | 'presentation'>) {
  const router = useRouter();
  const close = useCallback(() => {
    emitQuizModalClosed();
    router.back();
  }, [router]);
  return <QuizWithAsk {...props} presentation="player" onExit={close} />;
}
