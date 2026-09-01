'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../src/context/AuthContext';
import { getRecentActivities } from '../../src/lib/dashboardActivities';
import { Activity } from '../../src/models/types';
import { ActivityFeed } from '../../src/components/ActivityFeed';
import { AuthPrompt } from '../../src/components/AuthPrompt';

const HISTORY_LIMIT = 50;

export default function ActivityHistoryPage() {
  const { user, loading: authLoading, supabase } = useAuth();
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-grid p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/panel" className="text-sm text-muted-foreground hover:text-default transition-colors mb-4 inline-block">
          ← Panele Dön
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-default mb-6">Tüm Aktivitelerin</h1>

        {!user ? (
          <AuthPrompt message="Geçmiş çalışmalarını görmek için giriş yap." />
        ) : (
          <ActivityFeed activities={activities} />
        )}
      </div>
    </div>
  );
}
