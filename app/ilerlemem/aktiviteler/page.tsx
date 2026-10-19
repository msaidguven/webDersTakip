'use client';

// Tüm testlerim (İlerlemem'in alt sayfası). Yeni İlerlemem ile aynı kabuk; eski PanelShell kaldırıldı.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../src/context/AuthContext';
import { getRecentActivities } from '../../src/lib/dashboardActivities';
import { Activity } from '../../src/models/types';
import { ActivityFeed } from '../../src/components/ActivityFeed';
import { AuthPrompt } from '../../src/components/AuthPrompt';
import { useMyProfileBasics } from '../../src/hooks/useMyGradeSlug';

const HISTORY_LIMIT = 50;

export default function ActivityHistoryPage() {
  const { user, loading: authLoading, supabase } = useAuth();
  const profile = useMyProfileBasics();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setIsFetching(true);
      try {
        const result = await getRecentActivities(supabase, user.id, HISTORY_LIMIT);
        if (!cancelled) setActivities(result);
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, supabase]);

  const isLoading = authLoading || (!!user && isFetching);
  const meta = [profile?.gradeName, profile?.fullName].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-16 pt-8 sm:gap-8 sm:px-6 sm:pt-12 lg:px-8">
        <Link href="/ilerlemem" className="inline-flex w-fit items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-default">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> İlerlemem
        </Link>

        <header className="flex flex-col gap-1">
          {user && meta && <p className="text-sm font-bold text-muted-foreground">{meta}</p>}
          <h1 className="text-3xl font-black tracking-tight text-default sm:text-5xl">Tüm testlerim</h1>
          <p className="text-sm text-muted-foreground">Geçmişteki tüm test denemelerin.</p>
        </header>

        {isLoading ? (
          <div className="h-56 animate-pulse rounded-2xl bg-surface-elevated" />
        ) : !user ? (
          <AuthPrompt message="Geçmiş çalışmalarını görmek için giriş yap." />
        ) : (
          <ActivityFeed activities={activities} />
        )}
      </main>
    </div>
  );
}
