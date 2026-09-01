'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../src/context/AuthContext';
import { AuthPrompt } from '../../src/components/AuthPrompt';
import { LeaderboardCard } from '../../src/components/LeaderboardCard';

export default function LeaderboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
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
        <h1 className="text-xl sm:text-2xl font-bold text-default mb-2">Haftalık Sıralama</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Sınıfındaki (aynı sınıf seviyesindeki) herkesle bu hafta çözdüğün soru sayısına göre karşılaştırma — tamamen isimsiz.
        </p>

        {!user ? (
          <AuthPrompt message="Sıralamanı görmek için giriş yap." />
        ) : (
          <LeaderboardCard limit={100} showSeeAll={false} />
        )}
      </div>
    </div>
  );
}
