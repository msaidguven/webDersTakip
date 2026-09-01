'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../src/context/AuthContext';
import { getRecentActivities } from '../../src/lib/dashboardActivities';
import { Activity } from '../../src/models/types';
import { ActivityFeed } from '../../src/components/ActivityFeed';
import { AuthPrompt } from '../../src/components/AuthPrompt';
import { PanelShell } from '../../src/components/PanelShell';

const HISTORY_LIMIT = 50;

export default function ActivityHistoryPage() {
  const { user, loading: authLoading, supabase } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [fullName, setFullName] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setIsFetching(true);
      try {
        const [result, { data: profile }] = await Promise.all([
          getRecentActivities(supabase, user.id, HISTORY_LIMIT),
          supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
        ]);
        if (!cancelled) {
          setActivities(result);
          setFullName((profile as { full_name: string | null } | null)?.full_name ?? null);
        }
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
    <PanelShell
      activeItem="home"
      isAuthenticated={!!user}
      userName={fullName || 'Öğrenci'}
      title="Tüm Aktivitelerin"
      subtitle="Geçmişteki tüm test denemelerin."
    >
      <div className="max-w-2xl mx-auto">
        {!user ? (
          <AuthPrompt message="Geçmiş çalışmalarını görmek için giriş yap." />
        ) : (
          <ActivityFeed activities={activities} />
        )}
      </div>
    </PanelShell>
  );
}
