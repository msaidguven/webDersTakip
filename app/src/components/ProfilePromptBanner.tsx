'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRoundPen, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type PromptProfile = { username: string | null; profile_prompt_pending?: boolean };

// Yeni üyeye bir kez "profilini güncelle" uyarısı (profiles.profile_prompt_pending; bkz.
// supabase/migrations/username_auto_and_profile_prompt.sql). Kapatınca, bağlantıya
// tıklayınca ya da profilde herhangi bir şey kaydedince (PATCH bayrağı sıfırlıyor) bir
// daha çıkmaz. Test çözerken dikkat dağıtmasın diye test sayfalarında gösterilmez.
function isHiddenRoute(pathname: string) {
  return (
    pathname.startsWith('/profil') ||
    pathname.startsWith('/admin') ||
    pathname.endsWith('/kavrama-testi') ||
    pathname.endsWith('/unite-testi')
  );
}

export function ProfilePromptBanner() {
  const pathname = usePathname() ?? '';
  const { user } = useAuth();
  const userId = user?.id;
  const [profile, setProfile] = useState<PromptProfile | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetch('/api/profile/update')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { profile?: PromptProfile | null } | null) => {
        if (!cancelled) setProfile(data?.profile ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      setProfile(null);
    };
  }, [userId]);

  if (!userId || !profile?.profile_prompt_pending || isHiddenRoute(pathname)) return null;

  function dismiss() {
    setProfile((p) => (p ? { ...p, profile_prompt_pending: false } : p));
    fetch('/api/profile/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patch: { profile_prompt_pending: false } }),
    }).catch(() => {});
  }

  return (
    <div role="status" className="px-3 sm:px-8 pt-3">
      <div className="max-w-7xl mx-auto flex items-start sm:items-center gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-3 sm:p-4">
        <UserRoundPen className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5 sm:mt-0" aria-hidden="true" />
        <p className="flex-1 min-w-0 text-sm text-default">
          <span className="font-semibold">Aramıza hoş geldin!</span>{' '}
          {profile.username ? (
            <>Kullanıcı adın <span className="font-medium">@{profile.username}</span>. </>
          ) : null}
          Profil fotoğrafını, kullanıcı adını ve sınıfını profilinden güncelleyebilirsin.
        </p>
        <Link
          href="/profil"
          onClick={dismiss}
          className="shrink-0 rounded-xl bg-indigo-500 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-indigo-600"
        >
          Profili güncelle
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Uyarıyı kapat"
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-default hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
