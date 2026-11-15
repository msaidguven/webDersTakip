'use client';

// Hesabımı sil (2026-11-15): üye silme isteği verir, hesap 30 gün sonra kalıcı silinir; o güne kadar
// giriş yapıp buradan geri alabilir. Sayfa girişsiz de açılır (uygulama mağazaları, hesabın nasıl
// silineceğini anlatan herkese açık bir adres ister). Ayarlar → Hesap'taki bağlantı buraya getirir.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/src/context/AuthContext';
import { clearMyProfileCache, fetchMyProfile } from '@/app/src/lib/myProfileClient';
import { ACCOUNT_DELETION_GRACE_DAYS, formatDeletionDate } from '@/app/src/lib/accountDeletion';
import { roboticFontVars } from '@/app/src/components/robotic/fonts';
import r from '@/app/src/components/robotic/robotic.module.css';

const primaryBtn = `inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-bold disabled:opacity-60 ${r.btnNeon} ${r.btnText}`;
const ghostBtn = `inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-bold disabled:opacity-60 ${r.btnGhost}`;
const dangerBtn = 'inline-flex min-h-11 items-center rounded-xl bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60';

export default function HesapSilmeClient() {
  const { user, loading, signOut } = useAuth();
  // undefined: okunuyor · null: silme isteği yok · metin: isteğin verildiği an
  const [requestedAt, setRequestedAt] = useState<string | null | undefined>(undefined);
  // İstek bu ekranda az önce verildi (oturum kapandığı için user artık yok).
  const [justRequestedAt, setJustRequestedAt] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchMyProfile(userId).then((data) => {
      if (!cancelled) setRequestedAt((data?.profile?.deletion_requested_at as string | null | undefined) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const send = async (method: 'POST' | 'DELETE') => {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/profile/hesap-silme', { method }).catch(() => null);
    const data = res ? ((await res.json().catch(() => null)) as { requestedAt?: string | null; error?: string } | null) : null;
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? 'İşlem yapılamadı, tekrar dene.');
    clearMyProfileCache();
    if (method === 'POST' && data?.requestedAt) {
      setJustRequestedAt(data.requestedAt);
      await signOut();
    } else {
      setRequestedAt(null);
      setRestored(true);
    }
  };

  const body = () => {
    if (justRequestedAt) {
      return (
        <>
          <p className="font-semibold text-default">Silme isteğin alındı, oturumun kapatıldı.</p>
          <p className="text-sm text-muted-foreground">
            Hesabın {formatDeletionDate(justRequestedAt)} tarihinde kalıcı olarak silinecek. Vazgeçersen o tarihe kadar
            giriş yapıp hesabını geri alabilirsin.
          </p>
          <Link href="/" className={`self-start ${ghostBtn}`}>Anasayfaya dön</Link>
        </>
      );
    }
    if (loading || (user && requestedAt === undefined)) {
      return <div aria-busy="true" aria-label="Yükleniyor" className="h-32 animate-pulse rounded-xl bg-surface" />;
    }
    if (user && requestedAt) {
      return (
        <>
          <p className="font-semibold text-default">
            Hesabın {formatDeletionDate(requestedAt)} tarihinde kalıcı olarak silinecek.
          </p>
          <p className="text-sm text-muted-foreground">Vazgeçtiysen hesabını geri al; hiçbir şeyin kaybolmaz.</p>
          <button type="button" onClick={() => void send('DELETE')} disabled={busy} className={`self-start ${primaryBtn}`}>
            {busy ? 'Geri alınıyor…' : 'Hesabımı geri al'}
          </button>
        </>
      );
    }
    return (
      <>
        {restored && <p role="status" className="font-semibold text-default">Hesabın geri alındı. Silme isteği iptal edildi.</p>}
        <p className="text-sm text-default">
          Hesabını sildiğinde profilin, çözdüğün sorular ve ilerlemen, yazılı denemelerin ve fotoğrafların, yorumların
          ve bildirimlerin silinir.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Hesabın hemen silinmez: {ACCOUNT_DELETION_GRACE_DAYS} gün bekler, sonra kalıcı olarak silinir.</li>
          <li>Bu {ACCOUNT_DELETION_GRACE_DAYS} gün içinde giriş yaparsan hesabını geri alabilirsin.</li>
          <li>Süre dolunca silinenler geri getirilemez.</li>
        </ul>
        {!user ? (
          <Link href="/login?redirectTo=/hesap-silme" className={`self-start ${primaryBtn}`}>
            Giriş yap
          </Link>
        ) : confirming ? (
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void send('POST')} disabled={busy} className={dangerBtn}>
              {busy ? 'Gönderiliyor…' : `Evet, ${ACCOUNT_DELETION_GRACE_DAYS} gün sonra silinsin`}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={ghostBtn}>
              Vazgeç
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => { setRestored(false); setConfirming(true); }} className={`self-start ${dangerBtn}`}>
            Hesabımı sil
          </button>
        )}
      </>
    );
  };

  return (
    <div className={`${roboticFontVars} ${r.root}`}>
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <h1 className={`text-3xl font-bold uppercase text-default sm:text-4xl ${r.display}`}>Hesabımı sil</h1>
        <section className={`flex flex-col gap-4 p-6 ${r.panel}`}>
          {body()}
          {error && <p role="alert" className="text-sm font-semibold text-red-500">{error}</p>}
        </section>
      </main>
    </div>
  );
}
