'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../src/context/AuthContext';
import { AuthPrompt } from '../../src/components/AuthPrompt';
import { LeaderboardCard } from '../../src/components/LeaderboardCard';
import { PanelShell } from '../../src/components/PanelShell';

export default function LeaderboardPage() {
  const { user, loading: authLoading, supabase } = useAuth();
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }: { data: { full_name: string | null } | null }) => {
        if (!cancelled) setFullName(data?.full_name ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, supabase]);

  return (
    <PanelShell
      isAuthenticated={!!user}
      userName={fullName || 'Öğrenci'}
      title="Haftalık Sıralama"
      subtitle="Sınıfındaki (aynı sınıf seviyesindeki) herkesle bu hafta çözdüğün soru sayısına göre karşılaştırma."
    >
      <div className="max-w-2xl mx-auto">
        {authLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !user ? (
          <AuthPrompt message="Sıralamanı görmek için giriş yap." />
        ) : (
          <LeaderboardCard limit={100} showSeeAll={false} />
        )}
      </div>
    </PanelShell>
  );
}
